// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabaseUrl = "https://ttisvmwrxnfbedrboizq.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  console.log("=== COURSES FUNCTION ===");
  console.log("Method:", req.method);
  
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "NO_TOKEN" }, 401);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: auth } },
  });

  // Get current user and their role
  console.log("Getting user...");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log("User error:", userError);
  if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);

  // Get user role from user metadata
  const userRole = user.user_metadata?.role;
  console.log("User role:", userRole);
  if (!userRole) {
    return json({ error: "USER_ROLE_NOT_FOUND" }, 403);
  }

  const isTeacher = userRole === 'teacher';
  const isStudent = userRole === 'student';
  console.log("Is teacher:", isTeacher);

  const url = new URL(req.url);
  const courseId = decodeURIComponent(url.pathname.split('/').pop() || '');

  try {
    switch (req.method) {
      case "GET":
        if (courseId && courseId !== "courses") {
          // Get single course with teacher information
          const { data, error } = await supabase
            .from("course")
            .select(`
              *,
              teacher:teacher_id(teacher_name, teacher_title)
            `)
            .eq("course_id", courseId)
            .single();

          if (error) return json({ error: "COURSE_NOT_FOUND" }, 404);
          
          // Calculate credit points from assigned lessons
          const { data: lessons, error: lessonsError } = await supabase
            .from("course_lesson")
            .select(`
              lesson_id,
              lesson(lesson_credit)
            `)
            .eq("course_id", courseId);

          if (lessonsError) {
            console.error("Error fetching lessons for course:", courseId, lessonsError);
            return json({ course: { ...data, calculated_credits: data.course_credit || 0, assigned_lessons_count: 0 } });
          }

          // Calculate total credits from assigned lessons
          const totalCredits = lessons?.reduce((sum, item) => {
            return sum + (item.lesson?.lesson_credit || 0);
          }, 0) || 0;

          return json({ 
            course: {
              ...data,
              calculated_credits: totalCredits,
              assigned_lessons_count: lessons?.length || 0
            }
          });
        } else {
          console.log("Fetching courses...");
          
          // Use service role client to bypass RLS for teacher information
          const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);
          
          // Get courses - filter by status based on user role
          let query = serviceSupabase
            .from("course")
            .select(`
              *,
              teacher:teacher_id(teacher_name, teacher_title)
            `);

          // Students can only see published courses they're enrolled in
          if (!isTeacher) {
            console.log("Filtering for published courses (student)");
            query = query.eq("status", "published");
          } else {
            console.log("Showing all courses (teacher)");
          }

          console.log("Executing query...");
          const { data, error } = await query;
          console.log("Query result - Error:", error, "Data:", data);

          if (error) {
            console.error("Courses query failed:", error);
            return json({ error: "FETCH_ERROR", details: error.message }, 500);
          }
          
          // Calculate credit points for each course from assigned lessons and check enrollment for students
          const coursesWithCredits = await Promise.all((data || []).map(async (course) => {
            const { data: lessons, error: lessonsError } = await serviceSupabase
              .from("course_lesson")
              .select(`
                lesson_id,
                lesson(lesson_credit)
              `)
              .eq("course_id", course.course_id);

            if (lessonsError) {
              console.error("Error fetching lessons for course:", course.course_id, lessonsError);
              return { ...course, calculated_credits: course.course_credit || 0 };
            }

            // Calculate total credits from assigned lessons
            const totalCredits = lessons?.reduce((sum, item) => {
              return sum + (item.lesson?.lesson_credit || 0);
            }, 0) || 0;

            // Check if student is enrolled in this course
            let isEnrolled = false;
            if (!isTeacher) {
              const { data: enrollment } = await serviceSupabase
                .from("enrollment")
                .select("enrollment_id")
                .eq("student_id", user.id)
                .eq("course_id", course.course_id)
                .single();
              
              isEnrolled = !!enrollment;
            }

            return {
              ...course,
              calculated_credits: totalCredits,
              assigned_lessons_count: lessons?.length || 0,
              is_enrolled: isEnrolled
            };
          }));
          
          console.log("Courses query successful, returning", coursesWithCredits?.length || 0, "courses with calculated credits");
          return json({ courses: coursesWithCredits || [] });
        }

      case "POST":
        // Only teachers can create courses
        if (!isTeacher) {
          return json({ error: "TEACHER_ONLY" }, 403);
        }

        const { course_id, course_name, course_description, course_credit, status } = await req.json();
        console.log("Course creation data:", { course_id, course_name, course_description, course_credit, status });
        console.log("User ID:", user.id);
        
        if (!course_name) return json({ error: "COURSE_NAME_REQUIRED" }, 400);
        if (!course_id) return json({ error: "COURSE_ID_REQUIRED" }, 400);

        // Validate course ID format (should be non-empty string)
        if (typeof course_id !== 'string' || course_id.trim().length === 0) {
          return json({ error: "INVALID_COURSE_ID_FORMAT" }, 400);
        }

        // Use the provided course ID instead of generating a random one
        const newCourseId = course_id.trim();
        console.log("Trimmed course ID:", newCourseId);

        const courseData = {
          course_id: newCourseId,
          course_name,
          course_description,
          course_credit: course_credit || 0,
          teacher_id: user.id,
          status: status || "draft"
        };
        console.log("Inserting course data:", courseData);

        const { data, error } = await supabase
          .from("course")
          .insert(courseData)
          .select()
          .single();

        console.log("Course insertion result:", { data, error });
        if (error) {
          console.error("Course creation error:", error);
          if (error.code === "23505") { // Unique constraint violation
            return json({ error: "COURSE_ID_ALREADY_EXISTS" }, 409);
          }
          return json({ error: "CREATE_ERROR", details: error.message }, 500);
        }
        return json({ course: data });

      case "PUT":
        // Only teachers can update courses
        if (!isTeacher) {
          return json({ error: "TEACHER_ONLY" }, 403);
        }

        if (!courseId || courseId === "courses") {
          return json({ error: "COURSE_ID_REQUIRED" }, 400);
        }

        const updateData = await req.json();
        const { data: updatedCourse, error: updateError } = await supabase
          .from("course")
          .update(updateData)
          .eq("course_id", courseId)
          .eq("teacher_id", user.id)
          .select()
          .single();

        if (updateError) return json({ error: "UPDATE_ERROR" }, 500);
        return json({ course: updatedCourse });

      case "DELETE":
        // Only teachers can delete courses
        if (!isTeacher) {
          return json({ error: "TEACHER_ONLY" }, 403);
        }
        
        if (!courseId || courseId === "courses") {
          return json({ error: "COURSE_ID_REQUIRED" }, 400);
        }

        // First, verify the course exists and belongs to the user
        const { data: course, error: courseError } = await supabase
          .from("course")
          .select("course_id")
          .eq("course_id", courseId)
          .eq("teacher_id", user.id)
          .single();

        if (courseError || !course) {
          return json({ error: "COURSE_NOT_FOUND_OR_ACCESS_DENIED" }, 404);
        }

        // Delete all course_lesson assignments first (to handle foreign key constraints)
        const { error: courseLessonDeleteError } = await supabase
          .from("course_lesson")
          .delete()
          .eq("course_id", courseId);

        if (courseLessonDeleteError) {
          console.error("Error deleting course lessons:", courseLessonDeleteError);
          return json({ error: "DELETE_COURSE_LESSONS_ERROR" }, 500);
        }

        // Delete all classroom_lesson assignments
        const { error: classroomLessonDeleteError } = await supabase
          .from("classroom_lesson")
          .delete()
          .eq("course_id", courseId);

        if (classroomLessonDeleteError) {
          console.error("Error deleting classroom lessons:", classroomLessonDeleteError);
          return json({ error: "DELETE_CLASSROOM_LESSONS_ERROR" }, 500);
        }

        // Delete all enrollments
        const { error: enrollmentDeleteError } = await supabase
          .from("enrollment")
          .delete()
          .eq("course_id", courseId);

        if (enrollmentDeleteError) {
          console.error("Error deleting enrollments:", enrollmentDeleteError);
          return json({ error: "DELETE_ENROLLMENTS_ERROR" }, 500);
        }

        // Delete all marks
        const { error: markDeleteError } = await supabase
          .from("mark")
          .delete()
          .eq("course_id", courseId);

        if (markDeleteError) {
          console.error("Error deleting marks:", markDeleteError);
          return json({ error: "DELETE_MARKS_ERROR" }, 500);
        }

        // Finally, delete the course
        const { error: deleteError } = await supabase
          .from("course")
          .delete()
          .eq("course_id", courseId)
          .eq("teacher_id", user.id);

        if (deleteError) {
          console.error("Error deleting course:", deleteError);
          return json({ error: "DELETE_ERROR" }, 500);
        }

        return json({ message: "Course deleted successfully" });

      default:
        return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    }
  } catch (error) {
    console.error("Courses function error:", error);
    return json({ error: "INTERNAL_ERROR", details: error.message }, 500);
  }

});

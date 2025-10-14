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
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "NO_TOKEN" }, 401);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: auth } },
  });

  // Get current user and their role
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // For development with --no-verify-jwt, use a test user if JWT verification fails
  let currentUser = user;
  let userRole = user?.user_metadata?.role;
  
  if (userError || !user) {
    console.log('JWT verification failed in lessons function, using test user for development')
    console.log('User error:', userError)
    console.log('User:', user)
    // Use the student user ID from the database for testing
    currentUser = {
      id: 'bfd147a8-b1b0-43cc-a61e-19180843d134', // rey 999 student ID
      user_metadata: { role: 'student', name: 'rey 999' }
    };
    userRole = 'student';
  }
  
  console.log('Lessons function - Current user:', currentUser.id)
  console.log('Lessons function - User role:', userRole)

  if (!userRole) {
    return json({ error: "USER_ROLE_NOT_FOUND" }, 403);
  }

  const isTeacher = userRole === 'teacher';

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const lessonId = pathParts[pathParts.length - 1];
  const courseId = url.searchParams.get('course_id');
  const classroomId = url.searchParams.get('classroom_id'); // For classroom-specific queries
  const action = url.searchParams.get('action'); // For course assignment actions
  const available = url.searchParams.get('available'); // For getting available lessons

  try {
    switch (req.method) {
      case "GET":
        if (lessonId && lessonId !== "lessons") {
          // Get single lesson
          const { data, error } = await supabase
            .from("lesson")
            .select("*")
            .eq("lesson_id", lessonId)
            .single();

          if (error) return json({ error: "LESSON_NOT_FOUND" }, 404);
          return json({ lesson: data });
        } else {
          // Handle course-specific lesson requests
          if (courseId) {
            // Verify the user has access to the course
            let hasAccess = false;
            
            if (isTeacher) {
              // Teachers can access courses they own
              const { data: course, error: courseError } = await supabase
                .from("course")
                .select("course_id")
                .eq("course_id", courseId)
                .eq("teacher_id", currentUser.id)
                .single();
              
              hasAccess = !courseError && !!course;
            } else {
              // Students can access courses they're enrolled in
              console.log('Checking enrollment for student:', currentUser.id, 'course:', courseId)
              // Use service role key to bypass RLS for enrollment check
              const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);
              const { data: enrollment, error: enrollmentError } = await serviceSupabase
                .from("enrollment")
                .select("course_id")
                .eq("course_id", courseId)
                .eq("student_id", currentUser.id)
                .single();
              
              console.log('Enrollment check result:', { enrollment, enrollmentError })
              hasAccess = !enrollmentError && !!enrollment;
            }

            if (!hasAccess) {
              console.error("Course not found or access denied for user:", currentUser.id, "role:", isTeacher ? "teacher" : "student");
              return json({ error: "COURSE_NOT_FOUND_OR_ACCESS_DENIED" }, 404);
            }

            // Get lessons assigned to a specific course using service role to bypass RLS
            console.log('Fetching lessons for course:', courseId)
            const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);
            const { data: courseLessons, error: courseLessonsError } = await serviceSupabase
              .from("course_lesson")
              .select(`
                lesson_id,
                lesson(*)
              `)
              .eq("course_id", courseId);

            console.log('Course lessons query result:', { courseLessons, courseLessonsError })

            if (courseLessonsError) {
              console.error("Error fetching lessons for course:", courseId, courseLessonsError);
              return json({ error: "FETCH_ERROR" }, 500);
            }

            // Extract lessons from the junction table results
            const lessons = courseLessons?.map(item => item.lesson).filter(Boolean) || [];
            console.log('Extracted lessons:', lessons)
            
            // Apply status filtering for students
            const filteredLessons = !isTeacher 
              ? lessons.filter(lesson => lesson.status === "published")
              : lessons;
              
            console.log('Filtered lessons:', filteredLessons)

            return json({ lessons: filteredLessons });
          } else if (available === 'true') {
            // Get lessons that are not assigned to any course
            const { data: allLessons, error: allLessonsError } = await supabase
              .from("lesson")
              .select("*")
              .order("week_number", { ascending: true });

            if (allLessonsError) return json({ error: "FETCH_ERROR" }, 500);

            // Get all assigned lessons
            const { data: assignedLessons, error: assignedError } = await supabase
              .from("course_lesson")
              .select("lesson_id");

            if (assignedError) return json({ error: "FETCH_ERROR" }, 500);

            const assignedLessonIds = assignedLessons?.map(item => item.lesson_id) || [];
            
            // Filter out assigned lessons
            const availableLessons = allLessons?.filter(lesson => 
              !assignedLessonIds.includes(lesson.lesson_id)
            ) || [];

            // Apply status filtering for students
            const filteredLessons = !isTeacher 
              ? availableLessons.filter(lesson => lesson.status === "published")
              : availableLessons;

            return json({ lessons: filteredLessons });
          } else if (classroomId && available === 'true') {
            // Get lessons that are not assigned to the specific classroom
            console.log(`Getting available lessons for classroom: ${classroomId}`);
            
            const { data: allLessons, error: allLessonsError } = await supabase
              .from("lesson")
              .select("*")
              .order("week_number", { ascending: true });

            if (allLessonsError) return json({ error: "FETCH_ERROR" }, 500);
            console.log(`Total lessons found: ${allLessons?.length || 0}`);

            // Get lessons assigned to this classroom
            const { data: assignedLessons, error: assignedError } = await supabase
              .from("classroom_lesson")
              .select("lesson_id")
              .eq("classroom_id", classroomId);

            if (assignedError) return json({ error: "FETCH_ERROR" }, 500);
            console.log(`Lessons already assigned to classroom: ${assignedLessons?.length || 0}`);

            const assignedLessonIds = assignedLessons?.map(item => item.lesson_id) || [];
            
            // Filter out lessons assigned to this classroom
            const availableLessons = allLessons?.filter(lesson => 
              !assignedLessonIds.includes(lesson.lesson_id)
            ) || [];
            console.log(`Available lessons after filtering: ${availableLessons.length}`);

            // Apply status filtering for students
            const filteredLessons = !isTeacher 
              ? availableLessons.filter(lesson => lesson.status === "published")
              : availableLessons;

            console.log(`Final lessons to return: ${filteredLessons.length}`);
            return json({ lessons: filteredLessons });
          } else {
            // Get all lessons (both assigned and unassigned) with course information
            console.log("Fetching all lessons with course information...");
            
            // Use service role client to bypass RLS for course information
            const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);
            
            // First, get all lessons
            const { data: allLessons, error: allLessonsError } = await serviceSupabase
              .from("lesson")
              .select("*")
              .order("week_number", { ascending: true });

            if (allLessonsError) {
              console.error("Error fetching all lessons:", allLessonsError);
              return json({ error: "FETCH_ERROR" }, 500);
            }

            // Then get course assignments for lessons that have them
            const { data: courseAssignments, error: assignmentsError } = await serviceSupabase
              .from("course_lesson")
              .select(`
                lesson_id,
                course_id,
                course:course_id(course_id, course_name)
              `);

            if (assignmentsError) {
              console.error("Error fetching course assignments:", assignmentsError);
              return json({ error: "FETCH_ERROR" }, 500);
            }

            // Create a map of lesson_id to course information
            const courseMap = new Map();
            courseAssignments?.forEach(assignment => {
              courseMap.set(assignment.lesson_id, assignment.course);
            });

            // Combine lessons with their course information
            const lessons = allLessons?.map(lesson => ({
              ...lesson,
              course: courseMap.get(lesson.lesson_id) || null
            })) || [];

            // Apply filtering based on user role
            let filteredLessons = lessons;
            if (!isTeacher) {
              // Students can only see published lessons from courses they're enrolled in
              const { data: enrolledCourses, error: enrolledError } = await serviceSupabase
                .from("enrollment")
                .select("course_id")
                .eq("student_id", currentUser.id);

              if (enrolledError) {
                console.error("Error fetching enrolled courses:", enrolledError);
                return json({ error: "FETCH_ERROR" }, 500);
              }

              const enrolledCourseIds = enrolledCourses?.map(e => e.course_id) || [];
              
              filteredLessons = lessons.filter(lesson => {
                // Only show published lessons
                if (lesson.status !== "published") return false;
                
                // Only show lessons from enrolled courses (or unassigned lessons)
                if (lesson.course) {
                  return enrolledCourseIds.includes(lesson.course.course_id);
                }
                
                // Show unassigned lessons (no course)
                return true;
              });
            }

            console.log(`Returning ${filteredLessons.length} lessons (${courseAssignments?.length || 0} assigned to courses)`);
            return json({ lessons: filteredLessons });
          }
        }

      case "POST":
        // Handle course assignment
        if (action === 'assign_to_course') {
          const { course_id, lesson_id } = await req.json();
          
          if (!course_id || !lesson_id) {
            return json({ error: "COURSE_ID_AND_LESSON_ID_REQUIRED" }, 400);
          }

          // Verify the course exists and user owns it
          console.log("Looking up course:", course_id, "for user:", currentUser.id);
          const { data: course, error: courseError } = await supabase
            .from("course")
            .select("course_id")
            .eq("course_id", course_id)
            .eq("teacher_id", currentUser.id)
            .single();

          console.log("Course lookup result:", { course, courseError });
          if (courseError || !course) {
            console.error("Course not found or access denied:", courseError);
            return json({ error: "COURSE_NOT_FOUND_OR_ACCESS_DENIED" }, 404);
          }

          // Assign lesson to course using service role to bypass RLS
          console.log("Attempting to insert into course_lesson table:", { course_id, lesson_id });
          const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);
          const { data: assignmentData, error: assignmentError } = await serviceSupabase
            .from("course_lesson")
            .insert({
              course_id: course_id,
              lesson_id: lesson_id
            })
            .select()
            .single();

          console.log("Course lesson assignment result:", { assignmentData, assignmentError });
          if (assignmentError) {
            console.error("Assignment error details:", assignmentError);
            if (assignmentError.code === "23505") { // Unique constraint violation
              return json({ error: "LESSON_ALREADY_ASSIGNED_TO_COURSE" }, 409);
            }
            return json({ error: "ASSIGNMENT_ERROR" }, 500);
          }

          return json({ assignment: assignmentData }, 201);
        }

        // Create new lesson
        const { 
          lesson_title, 
          display_id,
          lesson_content, 
          lesson_outcome, 
          lesson_description, 
          reading_list, 
          assignment, 
          week_number, 
          course_id,
          lesson_credit,
          estimated_effort,
          prerequisite_lessons,
          status
        } = await req.json().catch(() => ({} as any));
        
        if (!lesson_title) {
          return json({ error: "LESSON_TITLE_REQUIRED" }, 400);
        }

        if (!display_id) {
          return json({ error: "LESSON_ID_REQUIRED" }, 400);
        }

        // course_id is optional - lessons can be created without course assignment

        // Check if lesson ID already exists
        const { data: existingLesson, error: existingError } = await supabase
          .from("lesson")
          .select("lesson_id")
          .eq("display_id", display_id)
          .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

        if (existingLesson) {
          return json({ error: "LESSON_ID_EXISTS" }, 409);
        }

        // Verify course exists if course_id is provided
        let course = null;
        if (course_id) {
          const { data: courseData, error: courseError } = await supabase
            .from("course")
            .select("course_id, course_name")
            .eq("course_id", course_id)
            .single();

          if (courseError || !courseData) {
            return json({ error: "COURSE_NOT_FOUND" }, 404);
          }
          course = courseData;
        }

        // Get teacher_id from teacher table based on user's auth ID
        const { data: teacherData, error: teacherError } = await supabase
          .from("teacher")
          .select("teacher_id")
          .eq("teacher_id", currentUser.id)
          .single();

        if (teacherError || !teacherData) {
          console.error("Teacher lookup error:", teacherError);
          return json({ error: "TEACHER_NOT_FOUND" }, 404);
        }

        const { data, error } = await supabase
          .from("lesson")
          .insert({
            lesson_title,
            lesson_content: lesson_content || "",
            lesson_outcome: lesson_outcome || "Learning outcomes will be defined for this lesson.",
            lesson_description: lesson_description || "No description available for this lesson.",
            reading_list: reading_list || "Reading materials will be provided for this lesson.",
            assignment: assignment || "Assignment details will be provided for this lesson.",
            week_number: week_number || 1,
            display_id: display_id, // Use manual display_id
            lesson_credit: lesson_credit || 1,
            estimated_effort: estimated_effort || 1,
            prerequisite_lessons: prerequisite_lessons || "No prerequisites required.",
            status: status || "published",
            teacher_id: teacherData.teacher_id // Use teacher_id from teacher table
          })
          .select("*")
          .single();

        if (error) return json({ error: "CREATE_ERROR" }, 500);
        return json({ lesson: data }, 201);

      case "PUT":
        if (!lessonId || lessonId === "lessons") {
          return json({ error: "LESSON_ID_REQUIRED" }, 400);
        }

        // Update lesson
        const updatePayload = await req.json().catch(() => ({} as any));
        
        // Note: course_id updates are not supported as lessons don't have direct course relationship
        // Course-lesson relationships should be managed through the course_lesson junction table
        
        const { data: updateData, error: updateError } = await supabase
          .from("lesson")
          .update(updatePayload)
          .eq("lesson_id", lessonId)
          .select("*")
          .single();

        if (updateError) {
          if (updateError.code === "PGRST116") return json({ error: "LESSON_NOT_FOUND" }, 404);
          return json({ error: "UPDATE_ERROR" }, 500);
        }

        return json({ lesson: updateData });

      case "DELETE":
        if (!lessonId || lessonId === "lessons") {
          return json({ error: "LESSON_ID_REQUIRED" }, 400);
        }

        // Get courses that have this lesson assigned before deleting
        const { data: courseAssignments, error: fetchError } = await supabase
          .from("course_lesson")
          .select("course_id")
          .eq("lesson_id", lessonId);

        // Remove lesson from all course assignments first
        const { error: removeAssignmentsError } = await supabase
          .from("course_lesson")
          .delete()
          .eq("lesson_id", lessonId);

        if (removeAssignmentsError) {
          console.error("Error removing lesson from course assignments:", removeAssignmentsError);
          return json({ error: "REMOVE_ASSIGNMENTS_ERROR" }, 500);
        }

        // Delete lesson
        const { error: deleteError } = await supabase
          .from("lesson")
          .delete()
          .eq("lesson_id", lessonId);

        if (deleteError) return json({ error: "DELETE_ERROR" }, 500);

        // Update course credit points for all courses that had this lesson assigned
        if (!fetchError && courseAssignments) {
          for (const assignment of courseAssignments) {
            await updateCourseCreditPoints(supabase, assignment.course_id);
          }
        }

        return json({ message: "Lesson deleted successfully" });

      default:
        return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    }
  } catch (error) {
    console.error("Lessons function error:", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

// Function to update course credit points based on assigned lessons
async function updateCourseCreditPoints(supabase: any, courseId: string) {
  try {
    // Get all lessons assigned to this course
    const { data: lessons, error: lessonsError } = await supabase
      .from("lesson")
      .select("lesson_credit")
      .eq("course_id", courseId);

    if (lessonsError) {
      console.error("Error fetching lessons for course:", lessonsError);
      return;
    }

    // Calculate total credit points
    const totalCredits = lessons?.reduce((sum: number, lesson: any) => {
      return sum + (lesson.lesson_credit || 0);
    }, 0) || 0;

    // Update course credit points
    const { error: updateError } = await supabase
      .from("course")
      .update({ course_credit: totalCredits })
      .eq("course_id", courseId);

    if (updateError) {
      console.error("Error updating course credit points:", updateError);
    }
  } catch (error) {
    console.error("Error in updateCourseCreditPoints:", error);
  }
}


import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = "https://ttisvmwrxnfbedrboizq.supabase.co"
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    console.log('User from auth:', user);
    console.log('User ID:', user?.id);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user role from user metadata
    const userRole = user.user_metadata?.role
    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'User role not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const classroomId = pathSegments[pathSegments.length - 1]

    switch (req.method) {
      case 'GET':
        if (classroomId && classroomId !== 'classrooms') {
          // Get single classroom
          return await getSingleClassroom(supabaseClient, classroomId, userRole, user.id)
        } else {
          // Get all classrooms
          return await getAllClassrooms(supabaseClient, userRole, user.id)
        }

      case 'POST':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can create classrooms' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await createClassroom(supabaseClient, req, user.id)

      case 'PUT':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can update classrooms' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await updateClassroom(supabaseClient, classroomId, req)

      case 'DELETE':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can delete classrooms' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await deleteClassroom(supabaseClient, classroomId)

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function getAllClassrooms(supabaseClient: any, userRole: string, userId: string) {
  try {
    console.log('getAllClassrooms called with:', { userRole, userId });
    
    // Use service role client to bypass RLS for teacher information
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);
    
    let query = serviceSupabase
      .from('classroom')
      .select(`
        *,
        teacher:classroom_supervisor (
          teacher_id,
          teacher_name
        )
      `)

    if (userRole === 'student') {
      console.log('Processing student request for userId:', userId);
      // Students can see classrooms that have courses they're enrolled in
      // The relationship is: Student -> Course (via Enrollment) -> Classroom (via classroom_lesson)
      
      // First get the student's enrolled courses
      const { data: enrollments, error: enrollmentError } = await serviceSupabase
        .from('enrollment')
        .select('course_id')
        .eq('student_id', userId)
      
      console.log('Enrollment query result:', { enrollments, enrollmentError });
      
      if (enrollmentError) {
        console.error('Error fetching student enrollments:', enrollmentError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch student enrollments' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (!enrollments || enrollments.length === 0) {
        console.log('Student has no enrollments, returning empty array');
        return new Response(
          JSON.stringify({ classrooms: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Extract course IDs
      const courseIds = enrollments.map(e => e.course_id)
      console.log('Student enrolled in course IDs:', courseIds);
      
      // Now get classroom IDs from classroom_lesson records
      const { data: classroomLessons, error: classroomLessonsError } = await serviceSupabase
        .from('classroom_lesson')
        .select('classroom_id')
        .in('course_id', courseIds)
      
      console.log('Classroom lessons query result:', { classroomLessons, classroomLessonsError });
      
      if (classroomLessonsError) {
        console.error('Error fetching classroom lessons:', classroomLessonsError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch classroom lessons' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (!classroomLessons || classroomLessons.length === 0) {
        console.log('No classrooms have courses the student is enrolled in, returning empty array');
        return new Response(
          JSON.stringify({ classrooms: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Extract classroom IDs
      const classroomIds = classroomLessons.map(cl => cl.classroom_id)
      console.log('Student can see classroom IDs:', classroomIds);
      
      // Query classrooms with the classroom IDs
      query = query.in('classroom_id', classroomIds)
    } else if (userRole === 'teacher') {
      console.log('Processing teacher request for userId:', userId);
      // Teachers can see classrooms they supervise
      query = query.eq('classroom_supervisor', userId)
    }

    console.log('Executing final query...');
    const { data, error } = await query.order('created_at', { ascending: false })
    console.log('Query result:', { data, error });

    if (error) {
      console.error('Error fetching classrooms:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch classrooms' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get assigned courses for each classroom
    const classroomsWithCourses = await Promise.all((data || []).map(async (classroom) => {
      const { data: classroomLessons, error: lessonsError } = await serviceSupabase
        .from('classroom_lesson')
        .select(`
          course_id,
          course:course_id (
            course_id,
            course_name,
            course_description
          )
        `)
        .eq('classroom_id', classroom.classroom_id)

      if (lessonsError) {
        console.error('Error fetching classroom lessons for', classroom.classroom_id, ':', lessonsError)
        return { ...classroom, assigned_courses: [] }
      }

      // Get unique courses from classroom_lesson
      const uniqueCourses = [...new Map(classroomLessons?.map(item => [item.course.course_id, item.course])).values()];
      
      return {
        ...classroom,
        assigned_courses: uniqueCourses.map(course => ({
          course_id: course.course_id,
          course: course
        }))
      }
    }))

    return new Response(
      JSON.stringify({ classrooms: classroomsWithCourses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getAllClassrooms:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getSingleClassroom(supabaseClient: any, classroomId: string, userRole: string, userId: string) {
  try {
    // Use service role client to bypass RLS for teacher information
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { data, error } = await serviceSupabase
      .from('classroom')
      .select(`
        *,
        teacher:classroom_supervisor (
          teacher_id,
          teacher_name
        )
      `)
      .eq('classroom_id', classroomId)
      .single()

    if (error) {
      console.error('Error fetching classroom:', error)
      return new Response(
        JSON.stringify({ error: 'Classroom not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get assigned courses by looking at classroom_lesson table
    const { data: classroomLessons, error: lessonsError } = await serviceSupabase
      .from('classroom_lesson')
      .select(`
        course_id,
        course:course_id (
          course_id,
          course_name,
          course_description
        )
      `)
      .eq('classroom_id', classroomId)

    if (lessonsError) {
      console.error('Error fetching classroom lessons:', lessonsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch classroom lessons' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get unique courses from classroom_lesson
    const uniqueCourses = [...new Map(classroomLessons?.map(item => [item.course.course_id, item.course])).values()];
    
    const classroomWithCourses = {
      ...data,
      assigned_courses: uniqueCourses.map(course => ({
        course_id: course.course_id,
        course: course
      }))
    }

    // Check if user has access to this classroom
    if (userRole === 'student') {
      // Check if student has attendance record for this classroom
      // First get student's enrollment IDs
      const { data: enrollments } = await serviceSupabase
        .from('enrollment')
        .select('enrollment_id')
        .eq('student_id', userId)

      if (!enrollments || enrollments.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const enrollmentIds = enrollments.map(e => e.enrollment_id)
      
      // Check if any of these enrollments have attendance records for this classroom
      const { data: attendance } = await serviceSupabase
        .from('attendence')
        .select('enrollment_id')
        .eq('classroom_id', classroomId)
        .in('enrollment_id', enrollmentIds)
        .single()

      if (!attendance) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (userRole === 'teacher' && data.classroom_supervisor !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ classroom: classroomWithCourses }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getSingleClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function createClassroom(supabaseClient: any, req: Request, userId: string) {
  try {
    console.log('createClassroom called with userId:', userId);
    const { classroom_name, classroom_supervisor, course_id, start_date, duration } = await req.json()
    console.log('Request data:', { classroom_name, classroom_supervisor, course_id, start_date, duration });

    if (!classroom_name || !classroom_supervisor) {
      return new Response(
        JSON.stringify({ error: 'Classroom name and supervisor are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the teacher exists in the teacher table
    const { data: teacherData, error: teacherError } = await supabaseClient
      .from("teacher")
      .select("teacher_id")
      .eq("teacher_id", userId)
      .single();

    if (teacherError || !teacherData) {
      console.error("Teacher lookup error:", teacherError);
      return new Response(
        JSON.stringify({ error: "TEACHER_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client to bypass RLS for classroom creation
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('About to insert classroom with:', {
      classroom_name,
      classroom_supervisor,
      created_by_teacher: userId
    });

    const { data, error } = await serviceSupabase
      .from('classroom')
      .insert({
        classroom_name,
        classroom_supervisor,
        created_by_teacher: userId
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating classroom:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create classroom' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ classroom: data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in createClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function updateClassroom(supabaseClient: any, classroomId: string, req: Request) {
  try {
    const updates = await req.json()

    // Use service role client to bypass RLS
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey)

    const { data, error } = await serviceSupabase
      .from('classroom')
      .update(updates)
      .eq('classroom_id', classroomId)
      .select()
      .single()

    if (error) {
      console.error('Error updating classroom:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to update classroom' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ classroom: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in updateClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function deleteClassroom(supabaseClient: any, classroomId: string) {
  try {
    console.log('deleteClassroom called with classroomId:', classroomId)
    
    // Use service role client to bypass RLS for all operations
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey)
    
    // First, delete all classroom_lesson assignments (cascading delete)
    console.log('Deleting classroom_lesson assignments...')
    const { error: classroomLessonError } = await serviceSupabase
      .from('classroom_lesson')
      .delete()
      .eq('classroom_id', classroomId)
    
    if (classroomLessonError) {
      console.error('Error deleting classroom_lesson assignments:', classroomLessonError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete classroom lesson assignments', details: classroomLessonError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Delete all attendance records
    console.log('Deleting attendance records...')
    const { error: attendanceError } = await serviceSupabase
      .from('attendence')
      .delete()
      .eq('classroom_id', classroomId)
    
    if (attendanceError) {
      console.error('Error deleting attendance records:', attendanceError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete attendance records', details: attendanceError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Finally, delete the classroom itself
    console.log('Deleting classroom...')
    const { error } = await serviceSupabase
      .from('classroom')
      .delete()
      .eq('classroom_id', classroomId)

    console.log('Delete result:', { error })

    if (error) {
      console.error('Error deleting classroom:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to delete classroom', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Classroom deleted successfully')
    return new Response(
      JSON.stringify({ message: 'Classroom deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in deleteClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}


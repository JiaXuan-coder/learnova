import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // For development with --no-verify-jwt, use a test user if JWT verification fails
    let currentUser = user;
    let userRole = user?.user_metadata?.role;
    
    if (userError || !user) {
      console.log('JWT verification failed, using test user for development')
      // Use the student user ID from the database for testing
      currentUser = {
        id: 'bfd147a8-b1b0-43cc-a61e-19180843d134', // rey 999 student ID
        user_metadata: { role: 'student', name: 'rey 999' }
      };
      userRole = 'student';
    }

    console.log('User role from metadata:', userRole)
    console.log('User ID:', currentUser.id)
    console.log('User metadata:', currentUser.user_metadata)
    
    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'User role not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const enrollmentId = pathSegments[pathSegments.length - 1]

    switch (req.method) {
      case 'GET':
        if (enrollmentId && enrollmentId !== 'enrollments') {
          // Get single enrollment
          return await getSingleEnrollment(supabaseClient, enrollmentId, userRole, currentUser.id)
        } else {
          // Get enrollments - check for course_id parameter for teachers
          const courseId = url.searchParams.get('course_id')
          if (courseId && userRole === 'teacher') {
            return await getCourseEnrollments(supabaseClient, courseId, currentUser.id)
          } else {
            // Get student's enrollments
            return await getStudentEnrollments(supabaseClient, userRole, currentUser.id)
          }
        }

      case 'POST':
        if (userRole !== 'student') {
          return new Response(
            JSON.stringify({ error: 'Only students can enroll' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Check if this is classroom enrollment or course enrollment
        const body = await req.json()
        console.log('Enrollment request body:', body)
        console.log('User role:', userRole)
        console.log('User ID:', currentUser.id)
        
        if (body.classroom_id) {
          console.log('Enrolling in classroom:', body.classroom_id)
          return await enrollInClassroom(supabaseClient, body, currentUser.id)
        } else if (body.course_id) {
          console.log('Enrolling in course:', body.course_id)
          return await enrollInCourse(supabaseClient, body, currentUser.id)
        } else {
          console.log('No classroom_id or course_id found in body')
          return new Response(
            JSON.stringify({ error: 'Either classroom_id or course_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'DELETE':
        if (userRole !== 'student') {
          return new Response(
            JSON.stringify({ error: 'Only students can unenroll from classrooms' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await unenrollFromClassroom(supabaseClient, enrollmentId, currentUser.id)

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

async function getCourseEnrollments(supabaseClient: any, courseId: string, teacherId: string) {
  try {
    // Verify the teacher owns this course
    const { data: course, error: courseError } = await supabaseClient
      .from('course')
      .select('course_id')
      .eq('course_id', courseId)
      .eq('teacher_id', teacherId)
      .single()

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Course not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all enrollments for this course
    const { data, error } = await supabaseClient
      .from('enrollment')
      .select(`
        *,
        Student:student_id (
          student_id,
          student_name,
          student_email
        )
      `)
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false })

    if (error) {
      console.error('Error fetching course enrollments:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch enrollments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ enrollments: data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getCourseEnrollments:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getStudentEnrollments(supabaseClient: any, userRole: string, userId: string) {
  try {
    if (userRole !== 'student') {
      return new Response(
        JSON.stringify({ error: 'Only students can view enrollments' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabaseClient
      .from('enrollment')
      .select(`
        *,
        Classroom:classroom_id (
          classroom_id,
          classroom_name,
          start_date,
          duration,
          Teacher:classroom_supervisor (
            teacher_id,
            teacher_name
          ),
          Course:course_id (
            course_id,
            course_name
          )
        )
      `)
      .eq('student_id', userId)
      .order('enrolled_at', { ascending: false })

    if (error) {
      console.error('Error fetching enrollments:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch enrollments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ enrollments: data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getStudentEnrollments:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getSingleEnrollment(supabaseClient: any, enrollmentId: string, userRole: string, userId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('enrollment')
      .select(`
        *,
        Classroom:classroom_id (
          classroom_id,
          classroom_name,
          start_date,
          duration,
          Teacher:classroom_supervisor (
            teacher_id,
            teacher_name
          ),
          Course:course_id (
            course_id,
            course_name
          )
        )
      `)
      .eq('enrollment_id', enrollmentId)
      .single()

    if (error) {
      console.error('Error fetching enrollment:', error)
      return new Response(
        JSON.stringify({ error: 'Enrollment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has access to this enrollment
    if (userRole === 'student' && data.student_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ enrollment: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getSingleEnrollment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function enrollInCourse(supabaseClient: any, body: any, userId: string) {
  try {
    console.log('enrollInCourse called with body:', body, 'userId:', userId)
    const { course_id } = body

    if (!course_id) {
      console.log('No course_id found in body')
      return new Response(
        JSON.stringify({ error: 'Course ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if course exists and is published
    console.log('Checking course:', course_id)
    
    // Use service role key to bypass RLS for course lookup
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )
    
    const { data: course, error: courseError } = await serviceSupabase
      .from('course')
      .select('course_id, course_name, status')
      .eq('course_id', course_id)
      .eq('status', 'published')
      .single()

    console.log('Course query result:', { course, courseError })
    
    if (courseError || !course) {
      console.log('Course not found or not published:', courseError)
      return new Response(
        JSON.stringify({ error: 'Course not found or not available for enrollment' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already enrolled in this course
    const { data: existing } = await serviceSupabase
      .from('enrollment')
      .select('enrollment_id')
      .eq('student_id', userId)
      .eq('course_id', course_id)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Already enrolled in this course' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enroll in the course
    console.log('Creating enrollment for student:', userId, 'course:', course_id)
    const { data: enrollment, error: enrollmentError } = await supabaseClient
      .from('enrollment')
      .insert({
        student_id: userId,
        course_id: course_id,
        enrolled_at: new Date().toISOString()
      })
      .select()
      .single()

    console.log('Enrollment result:', { enrollment, enrollmentError })
    
    if (enrollmentError) {
      console.error('Error enrolling in course:', enrollmentError)
      return new Response(
        JSON.stringify({ error: 'Failed to enroll in course' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        enrollment: enrollment,
        message: 'Successfully enrolled in course'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in enrollInCourse:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function enrollInClassroom(supabaseClient: any, body: any, userId: string) {
  try {
    const { classroom_id } = body

    if (!classroom_id) {
      return new Response(
        JSON.stringify({ error: 'Classroom ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // First, get the course_id for this classroom from classroom_lesson table
    const { data: classroomLessons, error: classroomError } = await supabaseClient
      .from('classroom_lesson')
      .select('course_id')
      .eq('classroom_id', classroom_id)
      .limit(1)

    if (classroomError || !classroomLessons || classroomLessons.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Classroom not found or has no courses assigned' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const course_id = classroomLessons[0].course_id

    // Check if already enrolled in this course
    const { data: existing } = await supabaseClient
      .from('enrollment')
      .select('enrollment_id')
      .eq('student_id', userId)
      .eq('course_id', course_id)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Already enrolled in this course' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enroll in the course
    console.log('Creating enrollment for student:', userId, 'course:', course_id)
    const { data: enrollment, error: enrollmentError } = await supabaseClient
      .from('enrollment')
      .insert({
        student_id: userId,
        course_id: course_id,
        enrolled_at: new Date().toISOString()
      })
      .select()
      .single()

    console.log('Enrollment result:', { enrollment, enrollmentError })
    
    if (enrollmentError) {
      console.error('Error enrolling in course:', enrollmentError)
      return new Response(
        JSON.stringify({ error: 'Failed to enroll in course' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create attendence record linking student to classroom
    const { data: attendence, error: attendenceError } = await supabaseClient
      .from('attendence')
      .insert({
        classroom_id: classroom_id,
        enrollment_id: enrollment.enrollment_id,
        attendence: false
      })
      .select()
      .single()

    if (attendenceError) {
      console.error('Error creating attendence record:', attendenceError)
      // Rollback enrollment if attendence creation fails
      await supabaseClient
        .from('enrollment')
        .delete()
        .eq('enrollment_id', enrollment.enrollment_id)
      
      return new Response(
        JSON.stringify({ error: 'Failed to create attendence record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        enrollment: enrollment,
        attendence: attendence,
        message: 'Successfully enrolled in classroom'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in enrollInClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function unenrollFromClassroom(supabaseClient: any, enrollmentId: string, userId: string) {
  try {
    const { error } = await supabaseClient
      .from('enrollment')
      .delete()
      .eq('enrollment_id', enrollmentId)
      .eq('student_id', userId)

    if (error) {
      console.error('Error unenrolling from classroom:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to unenroll from classroom' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Successfully unenrolled from classroom' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in unenrollFromClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

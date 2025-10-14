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
      "https://ttisvmwrxnfbedrboizq.supabase.co",
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
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
    const studentId = pathSegments[pathSegments.length - 1]

    switch (req.method) {
      case 'GET':
        if (studentId && studentId !== 'students') {
          // Get single student
          return await getSingleStudent(supabaseClient, studentId, userRole, user.id)
        } else {
          // Get students with filters
          return await getStudents(supabaseClient, url, userRole, user.id)
        }

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

async function getStudents(supabaseClient: any, url: URL, userRole: string, userId: string) {
  try {
    const classroomId = url.searchParams.get('classroom_id')
    const courseId = url.searchParams.get('course_id')

    let query = supabaseClient
      .from('student')
      .select(`
        *,
        Enrollments:student_id (
          enrollment_id,
          classroom_id,
          Classroom:classroom_id (
            classroom_id,
            classroom_name,
            Course:course_id (
              course_id,
              course_name
            )
          )
        )
      `)

    if (userRole === 'student') {
      // Students can only see their own data
      query = query.eq('student_id', userId)
    } else if (userRole === 'teacher') {
      // Teachers can see students in their classrooms
      if (classroomId) {
        console.log('Getting students for classroom:', classroomId)
        
        // Get courses assigned to this classroom via classroom_lesson table
        const { data: classroomLessons, error: classroomLessonsError } = await supabaseClient
          .from('classroom_lesson')
          .select('course_id')
          .eq('classroom_id', classroomId)
        
        console.log('Classroom lessons query result:', { classroomLessons, classroomLessonsError })
        
        if (classroomLessonsError) {
          console.error('Error fetching classroom lessons:', classroomLessonsError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch classroom lessons' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (classroomLessons && classroomLessons.length > 0) {
          const courseIds = classroomLessons.map(cl => cl.course_id)
          console.log('Course IDs for classroom:', courseIds)
          
          // Get students enrolled in these courses
          const { data: enrollments, error: enrollmentsError } = await supabaseClient
            .from('enrollment')
            .select('student_id')
            .in('course_id', courseIds)
          
          console.log('Enrollments query result:', { enrollments, enrollmentsError })
          
          if (enrollmentsError) {
            console.error('Error fetching enrollments:', enrollmentsError)
            return new Response(
              JSON.stringify({ error: 'Failed to fetch enrollments' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          if (enrollments && enrollments.length > 0) {
            const studentIds = enrollments.map(e => e.student_id)
            console.log('Student IDs enrolled in classroom courses:', studentIds)
            query = query.in('student_id', studentIds)
          } else {
            console.log('No students enrolled in courses for this classroom')
            // No students enrolled in courses for this classroom
            return new Response(
              JSON.stringify({ students: [] }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else {
          console.log('No courses assigned to this classroom via classroom_lesson')
          // No courses assigned to this classroom via classroom_lesson
          // Return empty list - this classroom has no students
          return new Response(
            JSON.stringify({ students: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    const { data, error } = await query.order('student_name', { ascending: true })

    if (error) {
      console.error('Error fetching students:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch students' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Flatten the data structure for easier frontend consumption
    const students = data?.map(student => ({
      student_id: student.student_id,
      student_name: student.student_name,
      student_email: student.student_email,
      course_id: student.enrollments?.[0]?.classroom?.course?.course_id,
      course_name: student.enrollments?.[0]?.classroom?.course?.course_name,
      classroom_id: student.enrollments?.[0]?.classroom_id,
      classroom_name: student.enrollments?.[0]?.classroom?.classroom_name
    })) || []

    return new Response(
      JSON.stringify({ students }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getStudents:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getSingleStudent(supabaseClient: any, studentId: string, userRole: string, userId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('student')
      .select(`
        *,
        Enrollments:student_id (
          enrollment_id,
          classroom_id,
          Classroom:classroom_id (
            classroom_id,
            classroom_name,
            Course:course_id (
              course_id,
              course_name
            )
          )
        )
      `)
      .eq('student_id', studentId)
      .single()

    if (error) {
      console.error('Error fetching student:', error)
      return new Response(
        JSON.stringify({ error: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has access to this student
    if (userRole === 'student' && data.student_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ student: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getSingleStudent:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}


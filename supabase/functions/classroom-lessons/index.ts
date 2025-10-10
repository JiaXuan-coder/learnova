import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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
        // Teachers can view lessons for classrooms they supervise
        // Students can view lessons for classrooms they're enrolled in
        if (userRole === 'teacher') {
          return await getClassroomLessons(supabaseClient, classroomId)
        } else if (userRole === 'student') {
          return await getClassroomLessonsForStudent(supabaseClient, classroomId, user.id)
        } else {
          return new Response(
            JSON.stringify({ error: 'Invalid user role' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'POST':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can assign lessons to classrooms' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await assignLessonToClassroom(supabaseClient, req)

      case 'DELETE':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can remove lessons from classrooms' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await removeLessonFromClassroom(supabaseClient, classroomId, req)

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

async function getClassroomLessons(supabaseClient: any, classroomId: string) {
  try {
    // Use service role client to bypass RLS
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey)
    
    const { data, error } = await serviceSupabase
      .from('classroom_lesson')
      .select(`
        classroom_id,
        course_id,
        lesson_id,
        lesson:lesson_id (
          lesson_id,
          lesson_title,
          lesson_description,
          lesson_credit,
          estimated_effort,
          teacher_id,
          created_at
        )
      `)
      .eq('classroom_id', classroomId)

    if (error) {
      console.error('Error fetching classroom lessons:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch classroom lessons' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform the data to match expected format
    const lessons = data.map(item => item.lesson).filter(lesson => lesson !== null)

    return new Response(
      JSON.stringify({ lessons }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getClassroomLessons:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function assignLessonToClassroom(supabaseClient: any, req: Request) {
  try {
    const { classroom_id, lesson_id } = await req.json()

    console.log('assignLessonToClassroom called with:', { classroom_id, lesson_id })

    if (!classroom_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: 'Classroom ID and Lesson ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client to bypass RLS
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey)

    // Get the course_id for this lesson from course_lesson table
    const { data: courseLesson, error: courseLessonError } = await serviceSupabase
      .from('course_lesson')
      .select('course_id')
      .eq('lesson_id', lesson_id)
      .single()

    console.log('Course lesson lookup result:', { courseLesson, courseLessonError })

    if (courseLessonError || !courseLesson) {
      console.error('Lesson not found in course_lesson table:', courseLessonError)
      return new Response(
        JSON.stringify({ error: 'Lesson must be assigned to a course first' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if assignment already exists
    const { data: existing, error: existingError } = await serviceSupabase
      .from('classroom_lesson')
      .select('classroom_id')
      .eq('classroom_id', classroom_id)
      .eq('lesson_id', lesson_id)
      .eq('course_id', courseLesson.course_id)
      .single()

    console.log('Existing assignment check:', { existing, existingError })

    if (existing) {
      console.log('Lesson already assigned to this classroom')
      return new Response(
        JSON.stringify({ error: 'Lesson already assigned to this classroom' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Attempting to insert classroom_lesson:', {
      classroom_id,
      course_id: courseLesson.course_id,
      lesson_id
    })

    const { data, error } = await serviceSupabase
      .from('classroom_lesson')
      .insert({
        classroom_id,
        course_id: courseLesson.course_id,
        lesson_id,
      })
      .select()
      .single()

    console.log('Classroom lesson insertion result:', { data, error })

    if (error) {
      console.error('Error assigning lesson to classroom:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to assign lesson to classroom', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully assigned lesson to classroom')
    return new Response(
      JSON.stringify({ classroom_lesson: data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in assignLessonToClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function removeLessonFromClassroom(supabaseClient: any, classroomLessonId: string, req: Request) {
  try {
    const { classroom_id, lesson_id } = await req.json()

    if (!classroom_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: 'Classroom ID and Lesson ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error } = await supabaseClient
      .from('classroom_lesson')
      .delete()
      .eq('classroom_id', classroom_id)
      .eq('lesson_id', lesson_id)

    if (error) {
      console.error('Error removing lesson from classroom:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to remove lesson from classroom' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Lesson removed from classroom successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in removeLessonFromClassroom:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getClassroomLessonsForStudent(supabaseClient: any, classroomId: string, userId: string) {
  try {
    console.log('getClassroomLessonsForStudent called with:', { classroomId, userId });
    
    // First verify that the student is enrolled in this classroom
    const { data: attendenceRecord, error: attendenceError } = await supabaseClient
      .from('attendence')
      .select('enrollment_id')
      .eq('classroom_id', classroomId)
      .in('enrollment_id', 
        supabaseClient
          .from('enrollment')
          .select('enrollment_id')
          .eq('student_id', userId)
      )
      .limit(1)

    if (attendenceError) {
      console.error('Error checking student enrollment:', attendenceError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify enrollment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!attendenceRecord || attendenceRecord.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Student not enrolled in this classroom' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If student is enrolled, get the lessons for this classroom
    return await getClassroomLessons(supabaseClient, classroomId)
  } catch (error) {
    console.error('Error in getClassroomLessonsForStudent:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

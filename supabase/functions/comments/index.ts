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
    const commentId = pathSegments[pathSegments.length - 1]

    switch (req.method) {
      case 'GET':
        if (commentId && commentId !== 'comments') {
          // Get single comment
          return await getSingleComment(supabaseClient, commentId, userRole, user.id)
        } else {
          // Get comments with filters
          return await getComments(supabaseClient, url, userRole, user.id)
        }

      case 'POST':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can create comments' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await createComment(supabaseClient, req, user.id)

      case 'PUT':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can update comments' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await updateComment(supabaseClient, commentId, req)

      case 'DELETE':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can delete comments' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await deleteComment(supabaseClient, commentId)

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

async function getComments(supabaseClient: any, url: URL, userRole: string, userId: string) {
  try {
    const studentId = url.searchParams.get('student_id')
    const lessonId = url.searchParams.get('lesson_id')
    const classroomId = url.searchParams.get('classroom_id')

    let query = supabaseClient
      .from('mark')
      .select(`
        *,
        Enrollment:enrollment_id (
          enrollment_id,
          student_id,
          Student:student_id (
            student_id,
            student_name,
            student_email
          )
        ),
        Lesson:lesson_id (
          lesson_id,
          lesson_title
        ),
        Course:course_id (
          course_id,
          course_name
        )
      `)

    if (userRole === 'student') {
      // Students can only see their own comments
      // First get their enrollment IDs
      const { data: enrollments } = await supabaseClient
        .from('enrollment')
        .select('enrollment_id')
        .eq('student_id', userId)
      
      if (enrollments && enrollments.length > 0) {
        const enrollmentIds = enrollments.map(e => e.enrollment_id)
        query = query.in('enrollment_id', enrollmentIds)
      } else {
        return new Response(
          JSON.stringify({ comments: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (userRole === 'teacher') {
      // Teachers can see comments for their students
      if (studentId) {
        // Get enrollment IDs for this student
        const { data: enrollments } = await supabaseClient
          .from('enrollment')
          .select('enrollment_id')
          .eq('student_id', studentId)
        
        if (enrollments && enrollments.length > 0) {
          const enrollmentIds = enrollments.map(e => e.enrollment_id)
          query = query.in('enrollment_id', enrollmentIds)
        } else {
          return new Response(
            JSON.stringify({ comments: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      if (lessonId) {
        query = query.eq('lesson_id', lessonId)
      }
      if (classroomId) {
        // Get students in the classroom and filter comments
        const { data: enrollments } = await supabaseClient
          .from('enrollment')
          .select('enrollment_id')
          .eq('classroom_id', classroomId)
        
        if (enrollments && enrollments.length > 0) {
          const enrollmentIds = enrollments.map(e => e.enrollment_id)
          query = query.in('enrollment_id', enrollmentIds)
        } else {
          return new Response(
            JSON.stringify({ comments: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching comments:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch comments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform the data to match expected format
    const comments = data?.map(mark => ({
      comment_id: `${mark.enrollment_id}-${mark.course_id}-${mark.lesson_id}`,
      student_id: mark.Enrollment?.student_id,
      student_name: mark.Enrollment?.Student?.student_name,
      student_email: mark.Enrollment?.Student?.student_email,
      lesson_id: mark.lesson_id,
      lesson_title: mark.Lesson?.lesson_title,
      comment_text: mark.feedback || '',
      grade: mark.result || 'Not graded',
      created_at: mark.created_at,
      updated_at: mark.updated_at
    })) || []

    return new Response(
      JSON.stringify({ comments }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getComments:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getSingleComment(supabaseClient: any, commentId: string, userRole: string, userId: string) {
  try {
    // Parse the composite comment ID
    const [enrollmentId, courseId, lessonId] = commentId.split('-')
    
    const { data, error } = await supabaseClient
      .from('mark')
      .select(`
        *,
        Enrollment:enrollment_id (
          enrollment_id,
          student_id,
          Student:student_id (
            student_id,
            student_name,
            student_email
          )
        ),
        Lesson:lesson_id (
          lesson_id,
          lesson_title
        ),
        Course:course_id (
          course_id,
          course_name
        )
      `)
      .eq('enrollment_id', enrollmentId)
      .eq('course_id', courseId)
      .eq('lesson_id', lessonId)
      .single()

    if (error) {
      console.error('Error fetching comment:', error)
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has access to this comment
    if (userRole === 'student' && data.Enrollment?.student_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Transform the data
    const comment = {
      comment_id: commentId,
      student_id: data.Enrollment?.student_id,
      student_name: data.Enrollment?.Student?.student_name,
      student_email: data.Enrollment?.Student?.student_email,
      lesson_id: data.lesson_id,
      lesson_title: data.Lesson?.lesson_title,
      comment_text: data.feedback || '',
      grade: data.result || 'Not graded',
      created_at: data.created_at,
      updated_at: data.updated_at
    }

    return new Response(
      JSON.stringify({ comment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getSingleComment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function createComment(supabaseClient: any, req: Request, userId: string) {
  try {
    const { student_id, lesson_id, comment_text, grade } = await req.json()

    if (!student_id || !lesson_id || !comment_text) {
      return new Response(
        JSON.stringify({ error: 'Student ID, Lesson ID, and comment text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the enrollment for this student
    const { data: enrollment, error: enrollmentError } = await supabaseClient
      .from('Enrollment')
      .select('enrollment_id, classroom_id')
      .eq('student_id', student_id)
      .single()

    if (enrollmentError || !enrollment) {
      return new Response(
        JSON.stringify({ error: 'Student enrollment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the course for this classroom
    const { data: classroom, error: classroomError } = await supabaseClient
      .from('classroom')
      .select('course_id')
      .eq('classroom_id', enrollment.classroom_id)
      .single()

    if (classroomError || !classroom) {
      return new Response(
        JSON.stringify({ error: 'Classroom not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if mark already exists
    const { data: existingMark } = await supabaseClient
      .from('mark')
      .select('enrollment_id')
      .eq('enrollment_id', enrollment.enrollment_id)
      .eq('course_id', classroom.course_id)
      .eq('lesson_id', lesson_id)
      .single()

    if (existingMark) {
      // Update existing mark
      const { data, error } = await supabaseClient
        .from('mark')
        .update({
          feedback: comment_text,
          result: grade || 'Not graded'
        })
        .eq('enrollment_id', enrollment.enrollment_id)
        .eq('course_id', classroom.course_id)
        .eq('lesson_id', lesson_id)
        .select()
        .single()

      if (error) {
        console.error('Error updating comment:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to update comment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ comment: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Create new mark
      const { data, error } = await supabaseClient
        .from('mark')
        .insert({
          enrollment_id: enrollment.enrollment_id,
          course_id: classroom.course_id,
          lesson_id,
          feedback: comment_text,
          result: grade || 'Not graded'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating comment:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to create comment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ comment: data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error in createComment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function updateComment(supabaseClient: any, commentId: string, req: Request) {
  try {
    const updates = await req.json()
    
    // Parse the composite comment ID
    const [enrollmentId, courseId, lessonId] = commentId.split('-')

    const { data, error } = await supabaseClient
      .from('mark')
      .update({
        feedback: updates.comment_text,
        result: updates.grade
      })
      .eq('enrollment_id', enrollmentId)
      .eq('course_id', courseId)
      .eq('lesson_id', lessonId)
      .select()
      .single()

    if (error) {
      console.error('Error updating comment:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to update comment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ comment: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in updateComment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function deleteComment(supabaseClient: any, commentId: string) {
  try {
    // Parse the composite comment ID
    const [enrollmentId, courseId, lessonId] = commentId.split('-')

    const { error } = await supabaseClient
      .from('mark')
      .delete()
      .eq('enrollment_id', enrollmentId)
      .eq('course_id', courseId)
      .eq('lesson_id', lessonId)

    if (error) {
      console.error('Error deleting comment:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to delete comment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Comment deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in deleteComment:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
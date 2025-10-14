import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const supabaseUrl = "https://ttisvmwrxnfbedrboizq.supabase.co"
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
    const attendanceId = pathSegments[pathSegments.length - 1]

    console.log('Attendance function called with method:', req.method)
    console.log('User role:', userRole)
    console.log('User ID:', user.id)

    switch (req.method) {
      case 'POST':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can create attendance records' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await createAttendanceRecord(supabaseClient, req, user.id)
      
      case 'GET':
        return await getAttendanceRecords(supabaseClient, userRole, user.id)
      
      case 'PUT':
        if (userRole !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Only teachers can update attendance records' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return await updateAttendanceRecord(supabaseClient, req, attendanceId, user.id)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error in attendance function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function createAttendanceRecord(supabaseClient: any, req: Request, userId: string) {
  try {
    const { classroom_id, enrollment_id, attendence } = await req.json()
    
    console.log('Creating attendance record:', { classroom_id, enrollment_id, attendence })
    
    // Verify the teacher supervises this classroom
    const { data: classroom, error: classroomError } = await supabaseClient
      .from('classroom')
      .select('classroom_id')
      .eq('classroom_id', classroom_id)
      .eq('classroom_supervisor', userId)
      .single()

    if (classroomError || !classroom) {
      return new Response(
        JSON.stringify({ error: 'Classroom not found or you do not supervise this classroom' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the attendance record
    const { data, error } = await supabaseClient
      .from('attendence')
      .insert({
        classroom_id,
        enrollment_id,
        attendence: attendence || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating attendance record:', error)
      if (error.code === '23505') { // Unique constraint violation
        return new Response(
          JSON.stringify({ error: 'Attendance record already exists for this enrollment in this classroom' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create attendance record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ attendance: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in createAttendanceRecord:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create attendance record' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getAttendanceRecords(supabaseClient: any, userRole: string, userId: string) {
  try {
    let query = supabaseClient
      .from('attendence')
      .select(`
        *,
        enrollment:enrollment_id (
          enrollment_id,
          student_id,
          course_id,
          Student:student_id (
            student_id,
            student_name,
            student_email
          )
        ),
        classroom:classroom_id (
          classroom_id,
          classroom_name
        )
      `)

    if (userRole === 'student') {
      // Students can only see their own attendance records
      query = query.eq('enrollment.student_id', userId)
    } else if (userRole === 'teacher') {
      // Teachers can see attendance records for classrooms they supervise
      query = query.eq('classroom.classroom_supervisor', userId)
    }

    const { data, error } = await query.order('classroom_id', { ascending: true })

    if (error) {
      console.error('Error fetching attendance records:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch attendance records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ attendance_records: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in getAttendanceRecords:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch attendance records' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function updateAttendanceRecord(supabaseClient: any, req: Request, attendanceId: string, userId: string) {
  try {
    const { attendence } = await req.json()
    
    console.log('Updating attendance record:', attendanceId, 'to:', attendence)
    
    // Verify the teacher supervises this classroom
    const { data: attendance, error: attendanceError } = await supabaseClient
      .from('attendence')
      .select(`
        *,
        classroom:classroom_id (
          classroom_id,
          classroom_supervisor
        )
      `)
      .eq('classroom_id', attendanceId.split('-')[0]) // Extract classroom_id from composite key
      .single()

    if (attendanceError || !attendance) {
      return new Response(
        JSON.stringify({ error: 'Attendance record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (attendance.classroom.classroom_supervisor !== userId) {
      return new Response(
        JSON.stringify({ error: 'You do not supervise this classroom' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the attendance record
    const { data, error } = await supabaseClient
      .from('attendence')
      .update({ attendence })
      .eq('classroom_id', attendance.classroom_id)
      .eq('enrollment_id', attendance.enrollment_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating attendance record:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to update attendance record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ attendance: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in updateAttendanceRecord:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to update attendance record' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    )
  }
}


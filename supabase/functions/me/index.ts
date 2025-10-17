// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabaseUrl = "https://ttisvmwrxnfbedrboizq.supabase.co";
const anonKey = Deno.env.get("PUBLIC_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "NO_TOKEN" }, 401);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);

  // Get user role from user metadata
  const userRole = user.user_metadata?.role;
  if (!userRole) {
    return json({ error: "USER_ROLE_NOT_FOUND" }, 403);
  }

  // Get additional user information based on role
  let additionalInfo = {};
  
  if (userRole === 'teacher') {
    // Get teacher information
    const { data: teacherData } = await supabase
      .from('teacher')
      .select('teacher_id, teacher_name, teacher_title')
      .eq('teacher_id', user.id)
      .single();
    
    if (teacherData) {
      additionalInfo = {
        teacher_id: teacherData.teacher_id,
        teacher_name: teacherData.teacher_name,
        teacher_title: teacherData.teacher_title
      };
    }
  } else if (userRole === 'student') {
    // Get student information
    const { data: studentData } = await supabase
      .from('student')
      .select('student_id, student_name')
      .eq('student_id', user.id)
      .single();
    
    if (studentData) {
      additionalInfo = {
        student_id: studentData.student_id,
        student_name: studentData.student_name
      };
    }
  }

  // Return user information from auth metadata
  return json({ 
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.user_metadata?.name || user.email,
      role: userRole,
      ...additionalInfo
    } 
  });
});




// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(supabaseUrl, serviceRoleKey);

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
  console.log("Register function called with method:", req.method);
  console.log("Register function URL:", req.url);
  console.log("Register function headers:", Object.fromEntries(req.headers.entries()));
  
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const { email, password, name, title, role } = await req.json();
    console.log("Register function received data:", { email, name, title, role });
    
    if (!email || !password || !name || !title || !role) return json({ error: "VALIDATION_ERROR" }, 400);
    if (!["student", "teacher"].includes(String(role))) return json({ error: "INVALID_ROLE" }, 400);

    // create user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: String(email).toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name, title, role },
    });
    
    if (createErr) {
      console.log("Create user error:", createErr);
      return json({ error: createErr.message }, /already/i.test(createErr.message) ? 409 : 400);
    }

    const userId = created!.user!.id;
    console.log("Created user with ID:", userId);

    // Create Teacher or Student record based on role
    let recordError;
    if (role === "teacher") {
      const { error } = await admin.from("teacher")
        .insert({ 
          teacher_id: userId, // Use auth user ID as teacher_id
          teacher_email: String(email).toLowerCase(), 
          teacher_name: name, 
          teacher_title: title 
        });
      recordError = error;
    } else {
      const { error } = await admin.from("student")
        .insert({ 
          student_id: userId, // Use auth user ID as student_id
          student_email: String(email).toLowerCase(), 
          student_name: name, 
          student_title: title
        });
      recordError = error;
    }

    if (recordError) {
      console.log("Record creation error:", recordError);
      console.log("Error details:", JSON.stringify(recordError, null, 2));
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json({ error: "RECORD_SEED_FAILED", details: recordError.message }, 500);
    }

    console.log("Registration successful for user:", userId);
    return json({ user: { id: userId, email, name, title, role } }, 201);
  } catch (error) {
    console.log("Register function error:", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

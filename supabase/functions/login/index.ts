// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const supabaseUrl = "https://ttisvmwrxnfbedrboizq.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  console.log("=== LOGIN FUNCTION CALLED ===");
  console.log("Method:", req.method);
  
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  console.log("Parsing request body...");
  const { email, password } = await req.json().catch((error) => {
    console.error("Error parsing request body:", error);
    return ({} as any);
  });
  
  console.log("Email:", email, "Password present:", !!password);
  
  if (!email || !password) {
    console.log("Missing email or password");
    return new Response(JSON.stringify({ error: "VALIDATION_ERROR" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  console.log("Attempting login with Supabase...");
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: supabaseKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: String(email).toLowerCase(), password }),
  });

  const text = await res.text();
  console.log("Supabase response status:", res.status);
  console.log("Supabase response:", text);
  
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json", ...corsHeaders },
  });
});





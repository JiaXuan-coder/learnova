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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  console.log("=== TEST FUNCTION CALLED ===");
  
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  try {
    console.log("Creating Supabase client...");
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log("Testing basic connection...");
    const { data, error } = await supabase
      .from("Course")
      .select("count")
      .limit(1);
    
    console.log("Test query result:", { data, error });
    
    if (error) {
      console.error("Test query failed:", error);
      return json({ 
        error: "TEST_FAILED", 
        details: error.message,
        code: error.code,
        hint: error.hint
      }, 500);
    }
    
    return json({ 
      success: true, 
      message: "Supabase connection working",
      data: data
    });
    
  } catch (error) {
    console.error("Test function error:", error);
    return json({ 
      error: "INTERNAL_ERROR", 
      details: error.message 
    }, 500);
  }
});


// js/utils.js - Utility functions and configuration

// ---- config: using local Supabase for development ----
// Use window variables to avoid redeclaration errors
window.API_BASE = window.API_BASE || "http://127.0.0.1:54321/functions/v1";
window.supabaseUrl = window.supabaseUrl || "https://ttisvmwrxnfbedrboizq.supabase.co";  
window.supabaseKey = window.supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";                     

// Create supabase client only if it doesn't exist
if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(window.supabaseUrl, window.supabaseKey);
}

// Export to global scope for compatibility
if (typeof API_BASE === 'undefined') {
  window.API_BASE = window.API_BASE;
}
if (typeof supabase === 'undefined') {
  window.supabase = window.supabaseClient;
}

// tiny helpers
window.$ = (sel, root = document) => root.querySelector(sel);
window.toast = (msg, type = "info") => {
  let box = $("#toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    Object.assign(box.style, {
      position: "fixed", top: "16px", right: "16px",
      padding: "10px 14px", borderRadius: "8px",
      boxShadow: "0 2px 10px rgba(0,0,0,.15)", background: "#fff", zIndex: 9999
    });
    document.body.appendChild(box);
  }
  box.style.color = type === "error" ? "#b00020" : "#222";
  box.style.border = type === "error" ? "1px solid #b00020" : "1px solid #ddd";
  box.textContent = msg;
  setTimeout(() => box.remove(), 2500);
};

// -------- Example: read /me (call from any page after login) --------
window.fetchMe = async function fetchMe() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    console.log("No access token found, redirecting to login");
    window.location.href = "login.html";
    return null;
  }
  
  try {
    // Use Edge Function to get user data
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.log("Token expired or invalid, redirecting to login");
        sessionStorage.removeItem("access_token");
        window.location.href = "login.html";
        return null;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("fetchMe error:", error);
    return null;
  }
}

// -------- PAGE INITIALIZATION --------
function initializePage() {
  // Check if we're on a specific page and initialize accordingly
  const currentPath = window.location.pathname;
  
  if (currentPath.includes('course_dashboard.html') || window.location.hash === '#course') {
    fetchCourses();
  } else if (currentPath.includes('lesson_dashboard.html') || window.location.hash === '#lesson') {
    fetchLessons();
  } else if (currentPath.includes('create_modify_course.html')) {
    setupCourseForm();
  } else if (currentPath.includes('create_modify_lesson.html')) {
    setupLessonForm();
  }
  
  // Initialize user data (only if function exists and we're not on login/register pages)
  if (typeof initializeUser === 'function' && !currentPath.includes('login.html') && !currentPath.includes('register.html')) {
    initializeUser();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);


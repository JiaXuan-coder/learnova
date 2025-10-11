// js/auth.js - Authentication functionality

// -------- REGISTER --------
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(registerForm);
    const title = (fd.get("title") || "").toString().trim();
    const firstname = (fd.get("firstname") || "").toString().trim();
    const lastname  = (fd.get("lastname")  || "").toString().trim();
    const email     = (fd.get("email")     || "").toString().trim().toLowerCase();
    const password  = (fd.get("password")  || "").toString();
    const role      = (fd.get("role")      || "").toString();

    if (!title || !firstname || !lastname || !email || !password || !role) {
      toast("Please fill in all fields.", "error"); return;
    }

    try {
      // Use Edge Function for registration
      const name = `${firstname} ${lastname}`.trim();
      
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          email,
          password,
          name,
          title,
          role
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("User created:", data.user);
      toast("Registered successfully! Redirecting to login…");

      setTimeout(() => {
        window.location.href = "html/login.html";
      }, 1000);
    } catch (err) {
      console.error(err);
      toast(`Registration failed: ${err.message}`, "error");
    }
  });
}

// -------- LOGIN --------
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const email    = (fd.get("email")    || "").toString().trim().toLowerCase();
    const password = (fd.get("password") || "").toString();

    if (!email || !password) { toast("Email and password required.", "error"); return; }

    try {
      // Use Edge Function for login
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Login successful:", data);

      // Save token for this tab/session
      toast("Logged in!");
      sessionStorage.setItem("access_token", data.access_token);
      console.log("Redirecting now...")

      window.location.href = "html/sidebar_template.html";
    } catch (err) {
      console.error(err);
      toast("Network error while logging in.", "error");
    }
  });
}


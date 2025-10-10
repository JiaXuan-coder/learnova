// js/sidebar.js - Sidebar and navigation functionality

// ----Function for toggling sidebar----
window.toggleSidebar = function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar:not([style*='display: none'])");
    const content = document.getElementById("content");
    const topbar = document.getElementById("topbar");

    if (sidebar) {
      sidebar.classList.toggle("active");
    }
    content.classList.toggle("shrink");
    topbar.classList.toggle("shrink"); 
  }

// ----Function for loading content under sidebar template
window.loadContent = function loadContent(file) {
  const contentDiv = document.getElementById("content");

  if (!contentDiv) {
    console.log("Content div not found. Make sure you're using the sidebar template.");
    return;
  }

  fetch(file)
    .then(response => response.text())
    .then(html => {
      contentDiv.innerHTML = html;
      
      // Execute any scripts in the loaded content
      const scripts = contentDiv.querySelectorAll('script');
      scripts.forEach(script => {
        // Skip if script has already been executed
        if (script.dataset.executed) return;
        
        // Skip utils.js to prevent redeclaration errors
        if (script.src && script.src.includes('utils.js')) {
          console.log('Skipping utils.js to prevent redeclaration');
          return;
        }
        
        const newScript = document.createElement('script');
        if (script.src) {
          newScript.src = script.src;
        } else {
          newScript.textContent = script.textContent;
        }
        newScript.dataset.executed = 'true';
        document.head.appendChild(newScript);
      });
      
      // Apply role-based UI after content is loaded
      setTimeout(() => {
        applyRoleBasedUI();
      }, 50);
      
      // Initialize the loaded content based on the file
      if (file.includes('course_dashboard.html')) {
        setTimeout(() => fetchCourses(), 100); // Small delay to ensure DOM is ready
      } else if (file.includes('lesson_dashboard.html')) {
        setTimeout(() => fetchLessons(), 100);
      } else if (file.includes('create_modify_course.html')) {
        setTimeout(() => setupCourseForm(), 100);
      } else if (file.includes('create_modify_lesson.html')) {
        setTimeout(() => setupLessonForm(), 100);
      } else if (file.includes('course_view.html')) {
        // Course view will initialize itself via its own script
        console.log("Course view loaded via loadContent");
        // Force initialization after a delay to ensure DOM is ready
        setTimeout(() => {
          console.log("Forcing course view initialization");
          initializeCourseViewFromMain();
          setupCourseEditFromMain();
        }, 200);
      } else if (file.includes('lesson_view.html')) {
        // Lesson view will initialize itself via its own script
        console.log("Lesson view loaded via loadContent");
        // Force initialization after a delay to ensure DOM is ready
        setTimeout(() => {
          console.log("Forcing lesson view initialization");
          initializeLessonViewFromMain();
          setupLessonEditFromMain();
        }, 200);
      } else if (file.includes('classroom_dashboard.html')) {
        // Classroom dashboard needs to fetch classrooms
        console.log("Classroom dashboard loaded via loadContent");
        setTimeout(() => {
          console.log("Forcing classroom dashboard initialization");
          fetchClassrooms();
          setupClassroomModals();
        }, 100);
      } else if (file.includes('classroom_view.html')) {
        // Classroom view will initialize itself via its own script
        console.log("Classroom view loaded via loadContent");
        // Only set classroom view mode to 'view' if it's not already set to something else
        const currentMode = sessionStorage.getItem('classroom_view_mode');
        if (!currentMode || currentMode === 'view') {
          sessionStorage.setItem('classroom_view_mode', 'view');
          console.log("Set classroom_view_mode to view (default)");
        } else {
          console.log("Keeping existing classroom_view_mode:", currentMode);
        }
        setTimeout(async () => {
          console.log("Forcing classroom view initialization");
          await initializeClassroomViewFromMain();
          setupClassroomEditFromMain();
        }, 200);
      } else if (file.includes('comment_page.html')) {
        // Comment page initialization
        console.log("Comment page loaded via loadContent");
        setTimeout(() => {
          if (typeof initializeCommentPage === 'function') {
            initializeCommentPage();
            // Call setupRoleBasedVisibility after a longer delay to ensure DOM is ready
            setTimeout(() => {
              if (typeof setupRoleBasedVisibility === 'function') {
                setupRoleBasedVisibility();
              } else {
                console.error("setupRoleBasedVisibility function not found");
              }
            }, 100);
          } else {
            console.error("initializeCommentPage function not found");
          }
        }, 200);
      }
    })
    .catch(err => console.log("Failed to load content: ", err));
}

// Load default page when sidebar loads
window.addEventListener("DOMContentLoaded", () => {
  const hash = window.location.hash;
  
  switch(hash) {
    case "#course":
      loadContent("course_dashboard.html");
      break;
    case "#lesson":
      loadContent("lesson_dashboard.html");
      break;
    case "#classroom":
      // Check if we have a previous classroom context to restore
      const previousClassroom = sessionStorage.getItem("previous_classroom");
      if (previousClassroom) {
        console.log("Restoring previous classroom context:", previousClassroom);
        sessionStorage.setItem("selected_classroom", previousClassroom);
        sessionStorage.removeItem("previous_classroom"); // Clear it after restoring
        loadContent("classroom_view.html");
      } else {
        loadContent("classroom_dashboard.html");
      }
      break;
    case "#student":
      loadContent("student_dashboard.html");
      break;
    case "#report":
      loadContent("report_dashboard.html");
      break;
    default:
      loadContent("course_dashboard.html"); 
  }
});

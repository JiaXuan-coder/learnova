// js/user.js - User management and role-based functionality

// -------- USER AUTHENTICATION AND ROLE MANAGEMENT --------
window.initializeUser = async function initializeUser() {
  const userData = await fetchMe();
  if (userData) {
    // Store user data in session storage for other functions to use
    sessionStorage.setItem("user_data", JSON.stringify(userData));
    console.log("User data stored in session storage:", userData);
    
    // Update sidebar based on user role
    const teacherSidebar = document.querySelector('.teacher.sidebar');
    const studentSidebar = document.querySelector('.student.sidebar');
    
    if (userData.user.role === 'teacher') {
      if (teacherSidebar) teacherSidebar.style.display = 'flex';
      if (studentSidebar) studentSidebar.style.display = 'none';
      
      // Show all teacher-specific elements
      showTeacherElements();
      
      // Update welcome message
      const welcomeSpan = teacherSidebar?.querySelector('span');
      if (welcomeSpan) {
        welcomeSpan.innerHTML = `Welcome Back Teacher<br>${userData.user.name}`;
      }
    } else if (userData.user.role === 'student') {
      if (teacherSidebar) teacherSidebar.style.display = 'none';
      if (studentSidebar) studentSidebar.style.display = 'flex';
      
      // Hide all teacher-specific elements
      hideTeacherElements();
      
      // Update welcome message
      const welcomeSpan = studentSidebar?.querySelector('span');
      if (welcomeSpan) {
        welcomeSpan.innerHTML = `Welcome Back Student<br>${userData.user.name}`;
      }
    }
  }
}

// Function to hide all teacher-specific elements (excluding sidebars)
function hideTeacherElements() {
  const teacherElements = document.querySelectorAll('.teacher:not(.sidebar)');
  teacherElements.forEach(element => {
    element.style.display = 'none';
  });
  
  // Specifically hide teacher buttons
  const teacherButtons = document.querySelectorAll('.btn.teacher');
  teacherButtons.forEach(button => {
    button.style.display = 'none';
    button.style.visibility = 'hidden';
  });
}

// Function to show all teacher-specific elements (excluding sidebars)
function showTeacherElements() {
  console.log('showTeacherElements called');
  const teacherElements = document.querySelectorAll('.teacher:not(.sidebar)');
  console.log('Found teacher elements:', teacherElements.length);
  teacherElements.forEach(element => {
    element.style.display = '';
    element.style.visibility = 'visible';
  });
  
  // Specifically show teacher buttons, but respect classroom view mode
  const teacherButtons = document.querySelectorAll('.btn.teacher');
  console.log('Found teacher buttons:', teacherButtons.length);
  
  // Check if we're in classroom view mode
  const classroomViewMode = sessionStorage.getItem('classroom_view_mode');
  console.log('showTeacherElements - Reading classroom_view_mode from session storage:', classroomViewMode);
  console.log('Current URL:', window.location.href);
  console.log('Is classroom view page:', window.location.href.includes('classroom_view'));
  console.log('Is classroom page (#classroom):', window.location.href.includes('#classroom'));
  console.log('Has selected classroom:', !!sessionStorage.getItem('selected_classroom'));
  
  teacherButtons.forEach(button => {
    console.log('Processing teacher button:', button);
    console.log('Button classes:', button.className);
    console.log('Button current display:', button.style.display);
    console.log('Button current visibility:', button.style.visibility);
    console.log('Button computed style:', window.getComputedStyle(button).display);
    console.log('Button computed visibility:', window.getComputedStyle(button).visibility);
    console.log('Button computed position:', window.getComputedStyle(button).position);
    console.log('Button computed bottom:', window.getComputedStyle(button).bottom);
    console.log('Button computed right:', window.getComputedStyle(button).right);
    console.log('Button computed z-index:', window.getComputedStyle(button).zIndex);
    
    // If we're in classroom view mode, respect the mode settings
    // Check for classroom view mode OR if we're on a classroom-related page
    const isClassroomViewPage = window.location.href.includes('classroom_view') || 
                                window.location.href.includes('#classroom') ||
                                sessionStorage.getItem('selected_classroom');
    
    console.log('showTeacherElements - classroomViewMode:', classroomViewMode, 'isClassroomViewPage:', isClassroomViewPage);
    
    if (classroomViewMode === 'view' && isClassroomViewPage) {
      // In view mode, only show view buttons, hide modify/create buttons
      if (button.classList.contains('view')) {
        button.style.display = 'flex';
        button.style.visibility = 'visible';
        button.style.zIndex = '1000'; // Ensure it's on top
        button.style.backgroundColor = '#ff0000'; // Bright red for debugging
        button.style.border = '3px solid #000000'; // Black border for debugging
        console.log('Showing view button:', button);
        console.log('View button after setting:', button.style.display, button.style.visibility);
        console.log('View button computed after setting:', window.getComputedStyle(button).display, window.getComputedStyle(button).visibility);
      } else if (button.classList.contains('modify') || button.classList.contains('create')) {
        button.style.display = 'none';
        button.style.visibility = 'hidden';
        console.log('Hiding modify/create button:', button);
      } else {
        // For buttons without view/modify/create classes, show them normally
        button.style.display = 'flex';
        button.style.visibility = 'visible';
        console.log('Showing other teacher button:', button);
      }
    } else if (classroomViewMode === 'modify' && isClassroomViewPage) {
      // In modify mode, show modify/create buttons, hide view buttons
      console.log('showTeacherElements - modify mode detected, showing modify/create buttons');
      if (button.classList.contains('modify') || button.classList.contains('create')) {
        button.style.display = 'flex';
        button.style.visibility = 'visible';
        console.log('Showing modify/create button:', button);
      } else if (button.classList.contains('view')) {
        button.style.display = 'none';
        button.style.visibility = 'hidden';
        console.log('Hiding view button:', button);
      } else {
        // For buttons without view/modify/create classes, show them normally
        button.style.display = 'flex';
        button.style.visibility = 'visible';
        console.log('Showing other teacher button:', button);
      }
    } else {
      // Default behavior for non-classroom pages
      button.style.display = 'flex';
      button.style.visibility = 'visible';
      console.log('Showing teacher button:', button);
    }
  });
}

// Function to apply role-based UI restrictions
window.applyRoleBasedUI = async function applyRoleBasedUI() {
  console.log('applyRoleBasedUI called');
  const userData = await fetchMe();
  console.log('User data:', userData);
  
  if (userData) {
    // Store user data in session storage for other functions to use
    sessionStorage.setItem("user_data", JSON.stringify(userData));
    console.log("User data stored in session storage from applyRoleBasedUI:", userData);
    
    if (userData.user.role === 'student') {
      console.log('Setting up student UI');
      // Hide all teacher-specific elements for students
      hideTeacherElements();
    } else if (userData.user.role === 'teacher') {
      console.log('Setting up teacher UI');
      // Show all teacher-specific elements for teachers
      showTeacherElements();
    }
  }
}

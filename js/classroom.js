// js/classroom.js - Classroom management functionality

// -------- TEACHER BUTTON NAVIGATION --------
function navigateToStudentDashboard(mode = 'view') {
  // Store the current classroom context for the student dashboard
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (selectedClassroom) {
    sessionStorage.setItem("student_dashboard_classroom", selectedClassroom);
  }
  
  // Navigate to student dashboard with mode parameter
  if (mode === 'attendance') {
    loadContent('student_dashboard.html?mode=attendance');
  } else {
    loadContent('student_dashboard.html');
  }
}

// -------- COMMENT NAVIGATION --------
function navigateToCommentPage() {
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (!selectedClassroom) {
    toast("No classroom selected", "error");
    return;
  }
  
  const classroom = JSON.parse(selectedClassroom);
  console.log("Navigating to comment page for classroom:", classroom.classroom_name);
  
  // Store classroom context for comment page
  sessionStorage.setItem("selected_classroom", JSON.stringify(classroom));
  
  // Navigate to comment page
  loadContent('comment_page.html');
}

// -------- CLASSROOM MANAGEMENT --------
window.fetchClassrooms = async function fetchClassrooms() {
  console.log("fetchClassrooms called");
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    console.log("No token found");
    toast("Please log in to view classrooms", "error");
    return;
  }

  try {
    console.log("Fetching classrooms from API...");
    const res = await fetch(`${API_BASE}/classrooms`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("Response status:", res.status);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log("Classrooms data:", data);
    await renderClassrooms(data.classrooms);
  } catch (error) {
    console.error("Error fetching classrooms:", error);
    toast("Failed to fetch classrooms", "error");
  }
}

async function renderClassrooms(classrooms) {
  console.log("renderClassrooms called with:", classrooms);
  const container = document.getElementById("classrooms-container");
  if (!container) {
    console.log("Classrooms container not found");
    return;
  }

  container.innerHTML = "";
  console.log("Rendering", classrooms.length, "classrooms");

  for (const classroom of classrooms) {
    const box = document.createElement("div");
    box.className = "classroom-box";
    box.style.cursor = "pointer";

    // Header (classroom name) row
    const header = document.createElement("div");
    header.className = "classroom-header";
    header.innerHTML = `<span>${classroom.classroom_name}</span>`;

    // Supervisor row
    const supervisor = document.createElement("div");
    supervisor.className = "classroom-supervisor";
    supervisor.textContent = `Supervisor: ${classroom.teacher?.teacher_name || 'Unknown'}`;

    // Course row
    const course = document.createElement("div");
    course.className = "classroom-course";
    
    // Get course name from assigned_courses
    let courseName = 'None';
    if (classroom.assigned_courses && classroom.assigned_courses.length > 0) {
      // Get unique courses (in case there are multiple lessons from the same course)
      const uniqueCourses = [...new Map(classroom.assigned_courses.map(item => [item.course.course_id, item.course])).values()];
      if (uniqueCourses.length === 1) {
        courseName = uniqueCourses[0].course_name;
      } else {
        courseName = `${uniqueCourses.length} courses assigned`;
      }
    }
    
    course.textContent = `Course: ${courseName}`;

    // Append to box
    box.appendChild(header);
    box.appendChild(supervisor);
    box.appendChild(course);

    // Add click handler to navigate to classroom detail view
    box.addEventListener("click", () => {
      onClassroomClick(classroom);
    });

    container.appendChild(box);
  }
}

function onClassroomClick(classroom) {
  // Store classroom data for the classroom view
  sessionStorage.setItem("selected_classroom", JSON.stringify(classroom));
  // Clear any previous classroom view mode
  sessionStorage.removeItem('classroom_view_mode');
  loadContent('classroom_view.html');
}

// -------- CLASSROOM CREATION --------
window.createClassroom = async function createClassroom(classroomData) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to create classrooms", "error");
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/classrooms`, {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(classroomData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    toast("Classroom created successfully!");
    return data.classroom;
  } catch (error) {
    console.error("Error creating classroom:", error);
    toast(`Failed to create classroom: ${error.message}`, "error");
    return false;
  }
}

// -------- ROLE-BASED VISIBILITY --------
function setupClassroomRoleBasedVisibility() {
  const userData = sessionStorage.getItem("user_data");
  console.log("setupClassroomRoleBasedVisibility - userData:", userData);
  if (!userData) {
    console.log("No user data found in session storage");
    return;
  }
  
  const user = JSON.parse(userData);
  const isTeacher = user.user?.role === 'teacher';
  const isStudent = user.user?.role === 'student';
  
  console.log("Setting up classroom role-based visibility:", { isTeacher, isStudent, userRole: user.user?.role });
  
  // Show/hide teacher elements
  const teacherElements = document.querySelectorAll('.teacher');
  console.log('Found teacher elements:', teacherElements.length);
  teacherElements.forEach(el => {
    console.log('Setting teacher element display:', el.className, 'to', isTeacher ? 'flex' : 'none');
    el.style.display = isTeacher ? 'flex' : 'none';
    el.style.visibility = isTeacher ? 'visible' : 'hidden';
    console.log('Teacher element after setting:', el.className, 'display:', el.style.display, 'visibility:', el.style.visibility);
  });
  
  // Show/hide student elements
  const studentElements = document.querySelectorAll('.student');
  console.log('Found student elements:', studentElements.length);
  studentElements.forEach(el => {
    console.log('Setting student element display:', el.className, 'to', isStudent ? 'flex' : 'none');
    el.style.display = isStudent ? 'flex' : 'none';
    el.style.visibility = isStudent ? 'visible' : 'hidden';
    console.log('Student element after setting:', el.className, 'display:', el.style.display, 'visibility:', el.style.visibility);
  });
  
  // Special handling for classroom button containers
  const teacherButtonContainer = document.querySelector('.classroom-button-container.teacher');
  const studentButtonContainer = document.querySelector('.classroom-button-container.student');
  
  if (teacherButtonContainer) {
    teacherButtonContainer.style.display = isTeacher ? 'flex' : 'none';
  }
  
  if (studentButtonContainer) {
    studentButtonContainer.style.display = isStudent ? 'flex' : 'none';
  }
  
  // Special debugging for the main buttons
  const teacherCreateBtn = document.getElementById('teacher-create-btn');
  const studentEnrollBtn = document.getElementById('student-enroll-btn');
  
  console.log('Teacher create button:', teacherCreateBtn);
  console.log('Student enroll button:', studentEnrollBtn);
  
  if (teacherCreateBtn) {
    console.log('Teacher button before:', teacherCreateBtn.style.display, teacherCreateBtn.style.visibility);
    teacherCreateBtn.style.display = isTeacher ? 'flex' : 'none';
    teacherCreateBtn.style.visibility = isTeacher ? 'visible' : 'hidden';
    console.log('Teacher button after:', teacherCreateBtn.style.display, teacherCreateBtn.style.visibility);
  }
  
  if (studentEnrollBtn) {
    console.log('Student button before:', studentEnrollBtn.style.display, studentEnrollBtn.style.visibility);
    studentEnrollBtn.style.display = isStudent ? 'flex' : 'none';
    studentEnrollBtn.style.visibility = isStudent ? 'visible' : 'hidden';
    console.log('Student button after:', studentEnrollBtn.style.display, studentEnrollBtn.style.visibility);
  }
  
  // Handle create mode elements - only teachers can create
  const createElements = document.querySelectorAll('.create');
  createElements.forEach(el => {
    el.style.display = isTeacher ? 'block' : 'none';
  });
  
  // Handle modify mode elements - only teachers can modify
  const modifyElements = document.querySelectorAll('.modify');
  modifyElements.forEach(el => {
    el.style.display = isTeacher ? 'block' : 'none';
  });
  
  // Handle view mode elements - both teachers and students can view
  const viewElements = document.querySelectorAll('.view');
  viewElements.forEach(el => {
    el.style.display = (isTeacher || isStudent) ? 'block' : 'none';
  });
  
  // Set initial mode based on role
  if (isTeacher) {
    setClassroomViewMode('view'); // Teachers start in view mode
  } else if (isStudent) {
    setClassroomViewMode('view'); // Students can only view
  }
}

// -------- CLASSROOM MODE MANAGEMENT --------
function setClassroomViewMode(mode) {
  console.log("Setting classroom view mode to:", mode);
  
  const userData = sessionStorage.getItem("user_data");
  
  // If no user data, try to determine role from other sources
  let isTeacher = false;
  let isStudent = false;
  
  if (userData) {
    const user = JSON.parse(userData);
    isTeacher = user.user?.role === 'teacher';
    isStudent = user.user?.role === 'student';
  } else {
    // Fallback: assume teacher if we have access_token (since this is a classroom management function)
    const accessToken = sessionStorage.getItem("access_token");
    if (accessToken) {
      isTeacher = true; // Assume teacher for classroom management
    } else {
      console.log("No user data or access token found, cannot determine role");
      return;
    }
  }
  
  // Store the current mode to prevent override
  sessionStorage.setItem('classroom_view_mode', mode);
  
  // Get all elements with class 'view', 'modify', 'create'
  const viewElements = document.querySelectorAll('.view');
  const modifyElements = document.querySelectorAll('.modify');
  const createElements = document.querySelectorAll('.create');
  
  console.log(`Found ${viewElements.length} view elements, ${modifyElements.length} modify elements, ${createElements.length} create elements`);
  
  if (mode === 'view') {
    // Show view elements, hide edit elements
    viewElements.forEach(el => {
      if (isTeacher || isStudent) {
        el.style.display = 'flex';
        el.style.visibility = 'visible';
        console.log('Showing view element:', el);
      }
    });
    modifyElements.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      console.log('Hiding modify element:', el);
    });
    createElements.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      console.log('Hiding create element:', el);
    });
  } else if ((mode === 'modify' || mode === 'edit') && isTeacher) {
    console.log('Switching to modify mode - hiding view elements, showing edit elements');
    // Hide view elements, show edit elements (only for teachers)
    viewElements.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
    });
    
    // Show modify elements in edit mode
    modifyElements.forEach(el => {
      console.log('Showing modify element:', el.className, 'ID:', el.id);
      // Show all modify elements (save, cancel, course picker, supervisor change, etc.)
      el.style.display = 'flex';
      el.style.visibility = 'visible';
    });
    
    // Hide create elements in edit mode
    createElements.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
    });
    
    // Mode is set correctly, no re-enforcement needed
  } else if (mode === 'create' && isTeacher) {
    // Show create elements (only for teachers)
    viewElements.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      console.log('Hiding view element:', el);
    });
    modifyElements.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      console.log('Hiding modify element:', el);
    });
    createElements.forEach(el => {
      el.style.display = 'flex';
      el.style.visibility = 'visible';
      console.log('Showing create element:', el);
    });
  } else {
    console.log('No matching mode condition found - mode:', mode, 'isTeacher:', isTeacher);
    console.log('Available modes: view, modify, edit, create');
  }
}

// -------- COURSE MANAGEMENT FOR CLASSROOM --------
async function loadAvailableCoursesForClassroom() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    console.log("No access token found");
    return;
  }

  try {
    console.log("Loading available courses for classroom...");
    const res = await fetch(`${API_BASE}/courses`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log("Available courses:", data.courses);

    const courseSelect = document.getElementById('classroom-course-filter');
    if (courseSelect) {
      // Clear existing options except the first one
      courseSelect.innerHTML = '<option value="">Select Course</option>';
      
      // Add courses from the API
      data.courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.course_id;
        option.textContent = `${course.course_id} - ${course.course_name}`;
        courseSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error loading courses for classroom:", error);
    toast("Failed to load available courses", "error");
  }
}

// -------- CLASSROOM VIEW INITIALIZATION --------
async function initializeClassroomViewFromMain() {
  console.log("initializeClassroomViewFromMain called");
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  console.log("Selected classroom from session storage:", selectedClassroom);
  
  // Setup role-based visibility first
  setupClassroomRoleBasedVisibility();
  
  if (selectedClassroom) {
    const classroom = JSON.parse(selectedClassroom);
    console.log("Parsed classroom:", classroom);
    
    // Set view mode first before setting up edit handlers
    setClassroomViewMode('view');
    
    // Refresh classroom data from backend to get latest assigned_courses
    console.log("Refreshing classroom data from backend to get latest assignments");
    await refreshClassroomDataFromBackend(classroom.classroom_id);
    
    setupClassroomEditFromMain();
    loadAvailableCoursesForClassroom();
  } else {
    console.log("No classroom selected in session storage");
    const titleElement = document.getElementById("course_id_and_classroom_id");
    if (titleElement) {
      titleElement.textContent = "No classroom selected";
    }
  }
}

async function refreshClassroomDataFromBackend(classroomId) {
  try {
    console.log("refreshClassroomDataFromBackend called with classroomId:", classroomId);
    
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      console.error("No access token found");
      return;
    }
    
    // Fetch fresh classroom data from backend
    const res = await fetch(`${API_BASE}/classrooms/${classroomId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Error refreshing classroom data:", errorData);
      return;
    }
    
    const refreshedData = await res.json();
    const freshClassroom = refreshedData.classroom;
    
    console.log("Fresh classroom data from backend:", freshClassroom);
    
    // Update session storage with fresh data
    sessionStorage.setItem("selected_classroom", JSON.stringify(freshClassroom));
    
    // Display the fresh classroom data
    displayClassroomDetailsFromMain(freshClassroom);
    
    // Fetch and display lessons
    fetchLessonsForClassroomFromMain(classroomId);
    
  } catch (error) {
    console.error("Error refreshing classroom data from backend:", error);
  }
}

function displayClassroomDetailsFromMain(classroom) {
  console.log("displayClassroomDetailsFromMain called with classroom:", classroom);
  console.log("Classroom name:", classroom?.classroom_name);
  console.log("Classroom teacher:", classroom?.teacher);
  console.log("Classroom assigned_courses:", classroom?.assigned_courses);
  
  // Update classroom title
  const titleElement = document.getElementById("course_id_and_classroom_id");
  if (titleElement) {
    titleElement.textContent = classroom.classroom_name || 'Classroom';
  }
  
  // Update classroom name display and input
  const classroomNameDisplay = document.getElementById("classroom-name-display");
  const classroomNameInput = document.getElementById("classroom-name-input");
  if (classroomNameDisplay) {
    classroomNameDisplay.textContent = classroom.classroom_name || 'Classroom';
  }
  if (classroomNameInput) {
    classroomNameInput.value = classroom.classroom_name || 'Classroom';
  }
  
  // Update assigned course display
  const assignedCourseElement = document.getElementById("assigned-course-name");
  if (assignedCourseElement) {
    if (classroom.assigned_courses && classroom.assigned_courses.length > 0) {
      // Get unique courses (in case there are multiple lessons from the same course)
      const uniqueCourses = [...new Map(classroom.assigned_courses.map(item => [item.course.course_id, item.course])).values()];
      if (uniqueCourses.length === 1) {
        assignedCourseElement.textContent = uniqueCourses[0].course_name;
      } else {
        assignedCourseElement.textContent = `${uniqueCourses.length} courses assigned`;
      }
    } else {
      assignedCourseElement.textContent = 'Not assigned';
    }
  }
  
  // Update supervisor display
  const staffContainer = document.getElementById("classroom-staff-container");
  if (staffContainer) {
    staffContainer.innerHTML = `
      <span class="view" style="display: flex;">${classroom.teacher?.teacher_name || 'Unknown'}</span>
    `;
  }
  
  // Update start date display
  const startDateElement = document.getElementById("start-date");
  if (startDateElement) {
    startDateElement.textContent = classroom.start_date ? new Date(classroom.start_date).toLocaleDateString() : 'Not set';
  }
  
  // Update duration display
  const durationElement = document.getElementById("duration");
  if (durationElement) {
    durationElement.textContent = classroom.duration || 'Not set';
  }

  // Update start date input field for edit mode
  const startDateInput = document.getElementById("start-date-input");
  if (startDateInput) {
    startDateInput.value = classroom.start_date || '';
  }
  
  // Update duration input field for edit mode
  const durationInput = document.getElementById("duration-input");
  if (durationInput) {
    durationInput.value = classroom.duration || '';
  }

  // Update course selection if classroom has a course
  // Update course dropdown to reflect assigned course
  const courseSelect = document.getElementById("classroom-course-filter");
  if (courseSelect && classroom.assigned_courses && classroom.assigned_courses.length > 0) {
    // Get the first assigned course (since we only allow one course per classroom)
    const assignedCourse = classroom.assigned_courses[0].course;
    courseSelect.value = assignedCourse.course_id;
  }
  
  // Fetch and display lessons for the classroom
  fetchLessonsForClassroomFromMain(classroom.classroom_id);
}


function setupClassroomEditFromMain() {
  console.log("setupClassroomEditFromMain called");
  
  // Check user role first
  const userData = sessionStorage.getItem("user_data");
  if (!userData) {
    console.log("No user data found, skipping edit button setup");
    return;
  }
  
  const user = JSON.parse(userData);
  const isTeacher = user.user?.role === 'teacher';
  
  if (!isTeacher) {
    console.log("User is not a teacher, hiding edit button");
    // Hide edit button for non-teachers
    const editButton = document.querySelector('.add.btn.teacher.view');
    if (editButton) {
      editButton.style.display = 'none';
      editButton.style.visibility = 'hidden';
    }
    return;
  }
  
  console.log("User is a teacher, setting up edit button");
  
  // Add click handler to edit button (view mode -> modify mode)
  const editButton = document.querySelector('.add.btn.teacher.view');
  console.log("Found edit button:", editButton);
  if (editButton) {
    // Remove any existing event listeners to prevent duplicates
    editButton.removeEventListener('click', handleEditButtonClick);
    
    // Define the click handler function
    function handleEditButtonClick(event) {
      console.log("Edit button clicked - switching to modify mode");
      event.preventDefault();
      event.stopPropagation();
      
      // Prevent multiple rapid clicks
      if (editButton.disabled) {
        console.log("Edit button already processing, ignoring click");
        return;
      }
      
      editButton.disabled = true;
      
      // Set the mode immediately
      console.log("Setting classroom_view_mode to modify in session storage");
      sessionStorage.setItem('classroom_view_mode', 'modify');
      console.log("Session storage set. Current value:", sessionStorage.getItem('classroom_view_mode'));
      
      // Apply the mode change immediately
      console.log("Immediate setClassroomViewMode call");
      setClassroomViewMode('modify');
      
      // Re-enable button after a delay
      setTimeout(() => {
        editButton.disabled = false;
      }, 500);
    }
    
    // Add the event listener
    editButton.addEventListener('click', handleEditButtonClick);
    console.log("Edit button event listener added");
    
    // Also set onclick as backup
    editButton.onclick = handleEditButtonClick;
    console.log("Edit button onclick handler set:", editButton.onclick);
  } else {
    console.log("Edit button not found!");
  }
  
  // Add click handlers to save/cancel buttons
  const saveButton = document.querySelector('.save.btn.teacher.modify');
  const cancelButton = document.querySelector('.cancel.btn.teacher.modify');
  
  console.log("Save button found:", saveButton);
  console.log("Cancel button found:", cancelButton);
  
  if (saveButton) {
    console.log("Setting up save button click handler");
    saveButton.onclick = function() {
      console.log("Save button clicked");
      saveClassroomChanges().then(() => {
        console.log("Save completed, returning to view mode");
        setClassroomViewMode('view'); // Return to view mode after saving
      }).catch((error) => {
        console.error("Save failed:", error);
      });
    };
    console.log("Save button onclick handler set");
  } else {
    console.log("Save button not found!");
  }
  
  if (cancelButton) {
    console.log("Setting up cancel button click handler");
    cancelButton.onclick = function() {
      console.log("Cancel button clicked");
      // Discard changes and return to view mode
      setClassroomViewMode('view');
    };
    console.log("Cancel button onclick handler set");
  } else {
    console.log("Cancel button not found!");
  }
  
  // Add click handler to delete button
  const deleteButton = document.querySelector('.delete.btn.teacher.modify');
  console.log("Delete button found:", deleteButton);
  
  if (deleteButton) {
    console.log("Setting up delete button click handler");
    deleteButton.onclick = function() {
      console.log("Delete button clicked");
      deleteClassroom();
    };
    console.log("Delete button onclick handler set");
  } else {
    console.log("Delete button not found!");
  }
  
  // Add cancel functionality - look for any element that could act as cancel
  // This could be clicking outside the edit area or a specific cancel button
  document.addEventListener('click', function(event) {
    // If user clicks on a cancel-like element or presses Escape, return to view mode
    if (event.target.classList.contains('cancel') || 
        event.target.textContent.toLowerCase().includes('cancel') ||
        event.key === 'Escape') {
      console.log("Cancel action detected - returning to view mode");
      setClassroomViewMode('view');
    }
  });
  
  // Add create functionality - handle create button clicks
  const createButtons = document.querySelectorAll('.create');
  createButtons.forEach(button => {
    // Only add handlers to buttons that don't already have onclick or have safe onclick
    if (!button.onclick || button.onclick.toString().includes('loadContent')) {
      button.onclick = function(event) {
        console.log("Create button clicked - switching to create mode");
        setClassroomViewMode('create');
        // Prevent default behavior if it's a link
        if (event.preventDefault) {
          event.preventDefault();
        }
        return false;
      };
    } else if (button.onclick) {
      // For buttons with existing onclick, wrap it safely
      const originalOnclick = button.onclick;
      button.onclick = function(event) {
        console.log("Create button clicked - switching to create mode");
        setClassroomViewMode('create');
        if (originalOnclick) {
          try {
            // Check if the original onclick is trying to access DOM elements
            if (typeof originalOnclick === 'function') {
              originalOnclick.call(this, event);
            }
          } catch (error) {
            console.error("Error in create button onclick:", error);
            console.log("Original onclick function:", originalOnclick);
            // Continue execution even if original onclick fails
          }
        }
      };
    }
  });
}

async function saveClassroomChanges() {
  console.log("saveClassroomChanges called");
  
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (!selectedClassroom) {
    toast("No classroom selected", "error");
    return;
  }
  
  const classroom = JSON.parse(selectedClassroom);
  
  // Get updated values from form
  const classroomNameInput = document.getElementById("classroom-name-input");
  const startDateInput = document.getElementById("start-date-input");
  const durationInput = document.getElementById("duration-input");
  const courseSelect = document.getElementById("classroom-course-filter");
  
  const updateData = {};
  
  // Update classroom name (this field exists in the database)
  if (classroomNameInput && classroomNameInput.value) {
    updateData.classroom_name = classroomNameInput.value;
  }
  
  // Update start date (now exists in the database)
  if (startDateInput && startDateInput.value) {
    updateData.start_date = startDateInput.value;
    console.log("Start date selected:", startDateInput.value, "- will be saved to database");
  }
  
  // Update duration (now exists in the database)
  if (durationInput && durationInput.value) {
    updateData.duration = parseInt(durationInput.value);
    console.log("Duration selected:", durationInput.value, "- will be saved to database");
  }
  
  // Note: course_id is not a direct field on classroom table
  // Course assignment is handled through Classroom_Lesson table
  let selectedCourseId = null;
  if (courseSelect && courseSelect.value) {
    selectedCourseId = courseSelect.value;
    console.log("Course selected:", selectedCourseId, "- will be assigned after classroom update");
  }
  
  console.log("Update data:", updateData);
  
  // Check if there are any valid fields to update or course to assign
  if (Object.keys(updateData).length === 0 && !selectedCourseId) {
    console.log("No valid fields to update or course to assign, skipping save");
    toast("No changes to save", "info");
    setClassroomViewMode('view');
    return;
  }
  
  try {
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      toast("Please log in to update classroom", "error");
      return;
    }
    
    const res = await fetch(`${API_BASE}/classrooms/${classroom.classroom_id}`, {
      method: "PUT",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Error response:", errorData);
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }
    
    const updatedClassroom = await res.json();
    toast("Classroom updated successfully!");
    
    // Assign course to classroom if one was selected
    if (selectedCourseId) {
      console.log("Assigning course", selectedCourseId, "to classroom", classroom.classroom_id);
      await assignCourseToClassroom(classroom.classroom_id, selectedCourseId);
    }
    
    // --- IMPORTANT FIX: Re-fetch the complete classroom data after all updates and assignments ---
    console.log("Re-fetching complete classroom data after save/assignment.");
    const fetchRes = await fetch(`${API_BASE}/classrooms/${classroom.classroom_id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!fetchRes.ok) {
      const errorData = await fetchRes.json();
      console.error("Error re-fetching classroom data:", errorData);
      throw new Error(errorData.error || `HTTP error! status: ${fetchRes.status}`);
    }

    const refreshedClassroomData = await fetchRes.json();
    const fullClassroom = refreshedClassroomData.classroom;

    // Update session storage with the new, complete data
    sessionStorage.setItem("selected_classroom", JSON.stringify(fullClassroom));

    // Switch back to view mode
    setClassroomViewMode('view');

    // Refresh the display with the full classroom data
    displayClassroomDetailsFromMain(fullClassroom);
    
  } catch (error) {
    console.error("Error updating classroom:", error);
    toast(`Failed to update classroom: ${error.message}`, "error");
  }
}

async function assignCourseToClassroom(classroomId, courseId) {
  try {
    console.log("assignCourseToClassroom called with:", { classroomId, courseId });
    
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      toast("Please log in to assign course", "error");
      return;
    }
    
    // First, get all lessons for the course
    const lessonsRes = await fetch(`${API_BASE}/lessons?course_id=${courseId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!lessonsRes.ok) {
      console.error("Failed to fetch lessons for course:", courseId);
      return;
    }
    
    const lessonsData = await lessonsRes.json();
    const lessons = lessonsData.lessons || [];
    
    console.log("Found", lessons.length, "lessons for course", courseId);
    
    if (lessons.length === 0) {
      console.log("Course", courseId, "has no lessons - cannot assign to classroom");
      toast(`Course ${courseId} has no lessons and cannot be assigned to classroom`, "warning");
      return;
    }
    
    // Assign each lesson to the classroom
    for (const lesson of lessons) {
      try {
        const assignRes = await fetch(`${API_BASE}/classroom-lessons`, {
          method: "POST",
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            classroom_id: classroomId,
            lesson_id: lesson.lesson_id
          })
        });
        
        if (assignRes.ok) {
          console.log("Successfully assigned lesson", lesson.lesson_id, "to classroom");
        } else {
          const errorData = await assignRes.json();
          if (errorData.error === "Lesson already assigned to this classroom") {
            console.log("Lesson", lesson.lesson_id, "already assigned to classroom - skipping");
          } else {
            console.error("Failed to assign lesson", lesson.lesson_id, "to classroom:", errorData);
          }
        }
      } catch (error) {
        console.error("Error assigning lesson", lesson.lesson_id, ":", error);
      }
    }
    
    // Create attendance records for all students enrolled in this course
    await createAttendanceRecordsForCourse(classroomId, courseId, token);
    
    toast(`Course assigned successfully! ${lessons.length} lessons added to classroom.`);
    
  } catch (error) {
    console.error("Error in assignCourseToClassroom:", error);
    toast(`Failed to assign course: ${error.message}`, "error");
  }
}

async function createAttendanceRecordsForCourse(classroomId, courseId, token) {
  try {
    console.log("Creating attendance records for course", courseId, "in classroom", classroomId);
    
    // Get all students enrolled in this course
    const enrollmentsRes = await fetch(`${API_BASE}/enrollments?course_id=${courseId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!enrollmentsRes.ok) {
      console.error("Failed to fetch enrollments for course:", courseId);
      return;
    }
    
    const enrollmentsData = await enrollmentsRes.json();
    const enrollments = enrollmentsData.enrollments || [];
    
    console.log("Found", enrollments.length, "enrollments for course", courseId);
    
    // Create attendance records for each enrollment
    for (const enrollment of enrollments) {
      try {
        const attendanceRes = await fetch(`${API_BASE}/attendence`, {
          method: "POST",
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            classroom_id: classroomId,
            enrollment_id: enrollment.enrollment_id,
            attendence: false // Default to not attended
          })
        });
        
        if (attendanceRes.ok) {
          console.log("Created attendance record for enrollment", enrollment.enrollment_id);
        } else {
          const errorData = await attendanceRes.json();
          if (errorData.error && errorData.error.includes("already exists")) {
            console.log("Attendance record already exists for enrollment", enrollment.enrollment_id, "- skipping");
          } else {
            console.error("Failed to create attendance record for enrollment", enrollment.enrollment_id, ":", errorData);
          }
        }
      } catch (error) {
        console.error("Error creating attendance record for enrollment", enrollment.enrollment_id, ":", error);
      }
    }
    
    console.log("Finished creating attendance records for course", courseId);
    
  } catch (error) {
    console.error("Error in createAttendanceRecordsForCourse:", error);
  }
}

function updateDateDurationControls(classroom) {
  // Update start date
  const startDateSpan = document.getElementById("start-date");
  const startDateInput = document.getElementById("start-date-input");
  
  if (startDateSpan) {
    startDateSpan.textContent = classroom.start_date ? new Date(classroom.start_date).toLocaleDateString() : 'Not set';
  }
  
  if (startDateInput) {
    startDateInput.value = classroom.start_date ? classroom.start_date.split('T')[0] : '';
  }

  // Update duration
  const durationSpan = document.getElementById("duration");
  const durationInput = document.getElementById("duration-input");
  
  if (durationSpan) {
    durationSpan.textContent = classroom.duration ? `${classroom.duration} weeks` : 'Not set';
  }
  
  if (durationInput) {
    durationInput.value = classroom.duration || '';
  }
}

// -------- LESSON MANAGEMENT FOR CLASSROOM --------
async function fetchLessonsForClassroomFromMain(classroomId) {
  console.log("fetchLessonsForClassroomFromMain called with classroomId:", classroomId);
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to view lessons", "error");
    return;
  }

  try {
    // Get the classroom data to access assigned courses
    const selectedClassroom = sessionStorage.getItem("selected_classroom");
    if (!selectedClassroom) {
      console.log("No classroom data available");
      await renderLessonsForClassroomFromMain([]);
      return;
    }

    const classroom = JSON.parse(selectedClassroom);
    console.log("Classroom data:", classroom);

    if (classroom.assigned_courses && classroom.assigned_courses.length > 0) {
      // Get unique courses
      const uniqueCourses = [...new Map(classroom.assigned_courses.map(item => [item.course.course_id, item.course])).values()];
      console.log("Unique courses:", uniqueCourses);

      // Fetch lessons for each assigned course
      const allLessons = [];
      for (const course of uniqueCourses) {
        try {
          console.log(`Fetching lessons for course: ${course.course_id}`);
          const res = await fetch(`${API_BASE}/lessons?course_id=${course.course_id}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (data.lessons) {
              // Add course information to each lesson
              const lessonsWithCourse = data.lessons.map(lesson => ({
                ...lesson,
                course_name: course.course_name,
                course_id: course.course_id
              }));
              allLessons.push(...lessonsWithCourse);
            }
          }
        } catch (error) {
          console.error(`Error fetching lessons for course ${course.course_id}:`, error);
        }
      }

      console.log("All lessons for classroom:", allLessons);
      await renderLessonsForClassroomFromMain(allLessons);
    } else {
      console.log("No courses assigned to classroom");
      await renderLessonsForClassroomFromMain([]);
    }
  } catch (error) {
    console.error("Error fetching lessons for classroom:", error);
    toast("Failed to fetch lessons for classroom", "error");
  }
}

async function renderLessonsForClassroomFromMain(lessons) {
  console.log("renderLessonsForClassroomFromMain called with lessons:", lessons);
  const container = document.getElementById("lessons-container");
  if (!container) {
    console.log("Lessons container not found");
    return;
  }

  container.innerHTML = "";
  console.log("Rendering", lessons.length, "lessons for classroom");

  if (lessons.length === 0) {
    container.innerHTML = "<p>No lessons assigned to this classroom.</p>";
    return;
  }

  for (const lesson of lessons) {
    const box = document.createElement("div");
    box.className = "lesson-box";
    box.style.cursor = "pointer";

    // Header (lesson title) row
    const header = document.createElement("div");
    header.className = "lesson-header";
    header.innerHTML = `<span>${lesson.lesson_title}</span>`;

    // Course row (if course information is available)
    if (lesson.course_name) {
      const course = document.createElement("div");
      course.className = "lesson-course";
      course.textContent = `Course: ${lesson.course_name}`;
      course.style.fontSize = "0.9em";
      course.style.color = "#666";
      box.appendChild(course);
    }

    // Week row
    const week = document.createElement("div");
    week.className = "lesson-week";
    week.textContent = `Week: ${lesson.week_number || 'N/A'}`;

    // Lesson ID row
    const lessonId = document.createElement("div");
    lessonId.className = "lesson-id";
    lessonId.textContent = `ID: ${lesson.display_id || lesson.lesson_id}`;

    // Append to box
    box.appendChild(header);
    box.appendChild(week);
    box.appendChild(lessonId);

    // Add click handler to navigate to lesson detail view
    box.addEventListener("click", () => {
      sessionStorage.setItem("selected_lesson", JSON.stringify(lesson));
      
      // Preserve classroom context when navigating to lesson
      const selectedClassroom = sessionStorage.getItem("selected_classroom");
      if (selectedClassroom) {
        sessionStorage.setItem("previous_classroom", selectedClassroom);
        console.log("Preserved classroom context from classroom view:", selectedClassroom);
      }
      
      loadContent('lesson_view.html');
    });

    container.appendChild(box);
  }
}

// -------- LESSON ASSIGNMENT TO CLASSROOM --------
function addLessonToClassroom() {
  showLessonAssignmentModal();
}

function showLessonAssignmentModal() {
  const modal = document.getElementById('popuplesson');
  if (modal) {
    modal.style.display = 'flex';
    loadAvailableLessonsForAssignment();
  }
}

function closeLessonAssignmentModal() {
  const modal = document.getElementById('popuplesson');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function loadAvailableLessonsForAssignment() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to view lessons", "error");
    return;
  }

  // Get the selected classroom
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (!selectedClassroom) {
    toast("No classroom selected", "error");
    return;
  }

  const classroom = JSON.parse(selectedClassroom);

  try {
    const res = await fetch(`${API_BASE}/lessons?classroom_id=${classroom.classroom_id}&available=true`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log("Available lessons data:", data);
    console.log("Number of lessons:", data.lessons ? data.lessons.length : 0);
    
    const container = document.getElementById('addable-lesson-container');
    if (container) {
      container.innerHTML = "";
      
      if (!data.lessons || data.lessons.length === 0) {
        container.innerHTML = "<p>No available lessons to assign to this classroom.</p>";
        return;
      }
      
      data.lessons.forEach(lesson => {
        const lessonItem = document.createElement('div');
        lessonItem.className = 'lesson-item';
        lessonItem.innerHTML = `
          <input type="checkbox" id="lesson-${lesson.lesson_id}" value="${lesson.lesson_id}">
          <label for="lesson-${lesson.lesson_id}">${lesson.lesson_title} (${lesson.display_id || lesson.lesson_id})</label>
        `;
        container.appendChild(lessonItem);
      });
    }
  } catch (error) {
    console.error("Error loading lessons for assignment:", error);
    toast("Failed to load lessons", "error");
  }
}

async function assignSelectedLessonsToClassroom() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to assign lessons", "error");
    return;
  }

  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (!selectedClassroom) {
    toast("No classroom selected", "error");
    return;
  }

  const classroom = JSON.parse(selectedClassroom);
  const checkboxes = document.querySelectorAll('#addable-lesson-container input[type="checkbox"]:checked');
  
  if (checkboxes.length === 0) {
    toast("Please select at least one lesson", "error");
    return;
  }

  try {
    const assignments = Array.from(checkboxes).map(checkbox => ({
      classroom_id: classroom.classroom_id,
      lesson_id: checkbox.value
    }));

    for (const assignment of assignments) {
      const res = await fetch(`${API_BASE}/classroom-lessons`, {
        method: "POST",
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignment)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
    }

    toast("Lessons assigned successfully!");
    closeLessonAssignmentModal();
    fetchLessonsForClassroomFromMain(classroom.classroom_id);
  } catch (error) {
    console.error("Error assigning lessons:", error);
    toast(`Failed to assign lessons: ${error.message}`, "error");
  }
}

// -------- CLASSROOM MODAL FUNCTIONS --------
function showCreateClassroomModal() {
  console.log("showCreateClassroomModal called - TEACHER FUNCTION");
  const modal = document.getElementById('popupcreateclassroom');
  console.log("Modal element:", modal);
  if (modal) {
    modal.style.display = 'flex';
    console.log("Modal display set to flex");
    
    // Setup form submission when modal opens
    setupCreateClassroomForm();
    
    loadTeachersForSupervisor();
  } else {
    console.error("Modal element not found");
  }
}

function showEnrollClassroomModal() {
  console.log("showEnrollClassroomModal called - STUDENT FUNCTION");
  document.getElementById('popupenrollclassroom').style.display = 'flex';
  fetchAvailableClassroomsForEnrollment();
}

function setupClassroomModals() {
  console.log("setupClassroomModals called");
  // Setup lesson assignment modal
  const addLessonBtn = document.getElementById('course-add-lesson');
  if (addLessonBtn) {
    addLessonBtn.addEventListener('click', showLessonAssignmentModal);
  }
  
  // Setup role-based visibility
  setupClassroomRoleBasedVisibility();
}

function setupCreateClassroomForm() {
  console.log("setupCreateClassroomForm called");
  // Setup create classroom form
  const createForm = document.getElementById('create-classroom-form');
  console.log("Create form element:", createForm);
  if (createForm) {
    // Remove any existing event listeners to avoid duplicates
    createForm.removeEventListener('submit', handleFormSubmit);
    
    console.log("Adding submit event listener to form");
    createForm.addEventListener('submit', handleFormSubmit);
  } else {
    console.error("Create classroom form not found");
  }
}

async function handleFormSubmit(e) {
  console.log("Form submit event triggered");
  e.preventDefault();
  await handleCreateClassroomSubmit();
}

async function loadTeachersForSupervisor() {
  console.log("loadTeachersForSupervisor called");
  const token = sessionStorage.getItem("access_token");
  console.log("Token:", token);
  if (!token) {
    console.log("No token found");
    toast("Please log in to view teachers", "error");
    return;
  }

  try {
    console.log("Calling fetchMe...");
    // Get current user data to find teachers
    const userData = await fetchMe();
    console.log("User data:", userData);
    if (!userData || userData.user.role !== 'teacher') {
      console.log("User is not a teacher");
      toast("Only teachers can create classrooms", "error");
      return;
    }

    // For now, we'll use the current teacher as the supervisor
    // In a real app, you might want to fetch all teachers
    const supervisorSelect = document.getElementById('classroom-supervisor-input');
    if (supervisorSelect) {
      supervisorSelect.innerHTML = `
        <option value="">Select a supervisor...</option>
        <option value="${userData.user.teacher_id}">${userData.user.teacher_name} (You)</option>
      `;
    }
  } catch (error) {
    console.error("Error loading teachers:", error);
    toast("Failed to load teachers", "error");
  }
}

async function handleCreateClassroomSubmit() {
  console.log("handleCreateClassroomSubmit called");
  const classroomName = document.getElementById('classroom-name-input')?.value?.trim();
  const classroomSupervisor = document.getElementById('classroom-supervisor-input')?.value;
  
  console.log("Classroom name:", classroomName);
  console.log("Classroom supervisor:", classroomSupervisor);

  if (!classroomName) {
    console.log("Classroom name is missing");
    toast("Classroom name is required", "error");
    return;
  }

  if (!classroomSupervisor) {
    console.log("Classroom supervisor is missing");
    toast("Please select a supervisor", "error");
    return;
  }

  const classroomData = {
    classroom_name: classroomName,
    classroom_supervisor: classroomSupervisor
  };

  const result = await createClassroom(classroomData);
  if (result) {
    // Close the modal
    document.getElementById('popupcreateclassroom').style.display = 'none';
    
    // Clear the form
    document.getElementById('classroom-name-input').value = '';
    document.getElementById('classroom-supervisor-input').value = '';
    
    // Refresh the classrooms list
    fetchClassrooms();
  }
}

async function fetchAvailableClassroomsForEnrollment() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to view classrooms", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/classrooms`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    const container = document.querySelector('#popupenrollclassroom .classrooms-container');
    if (container) {
      container.innerHTML = "";
      
      if (!data.classrooms || data.classrooms.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #666;">
            <p>No classrooms available for enrollment.</p>
            <p style="font-size: 12px;">Check back later or contact your teacher.</p>
          </div>
        `;
        return;
      }
      
      data.classrooms.forEach(classroom => {
        const classroomBox = document.createElement('div');
        classroomBox.className = 'classroom-box';
        classroomBox.style.cursor = 'pointer';
        classroomBox.style.margin = '10px 0';
        classroomBox.style.padding = '15px';
        classroomBox.style.border = '1px solid #ddd';
        classroomBox.style.borderRadius = '5px';
        classroomBox.style.backgroundColor = '#f9f9f9';
        classroomBox.innerHTML = `
          <div class="classroom-header" style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${classroom.classroom_name}</div>
          <div class="classroom-supervisor" style="color: #666; margin-bottom: 5px;">Supervisor: ${classroom.teacher?.teacher_name || 'Unknown'}</div>
          <div style="color: #888; font-size: 12px;">Click to enroll in this classroom</div>
        `;
        
        classroomBox.addEventListener('click', async () => {
          await enrollInClassroom(classroom.classroom_id);
        });
        
        container.appendChild(classroomBox);
      });
    }
  } catch (error) {
    console.error("Error fetching classrooms for enrollment:", error);
    toast("Failed to fetch classrooms", "error");
  }
}

async function enrollInClassroom(classroomId) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to enroll in classrooms", "error");
    return;
  }

  try {
    // First, get the classroom details to find assigned courses
    const classroomRes = await fetch(`${API_BASE}/classrooms/${classroomId}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!classroomRes.ok) {
      throw new Error(`Failed to fetch classroom details: ${classroomRes.status}`);
    }

    const classroomData = await classroomRes.json();
    const classroom = classroomData.classroom;
    
    console.log('Classroom data:', classroom);
    console.log('Assigned courses:', classroom.assigned_courses);
    
    if (!classroom.assigned_courses || classroom.assigned_courses.length === 0) {
      throw new Error("This classroom has no courses assigned");
    }

    // Enroll in all courses assigned to this classroom
    let enrolledCount = 0;
    let alreadyEnrolledCount = 0;
    
    for (const assignedCourse of classroom.assigned_courses) {
      const courseId = assignedCourse.course.course_id;
      console.log('Attempting to enroll in course:', courseId);
      
      if (!courseId) {
        console.error('Course ID is undefined or null:', assignedCourse);
        continue;
      }
      
      try {
        const requestBody = { course_id: courseId };
        console.log('Sending enrollment request with body:', requestBody);
        
        const res = await fetch(`${API_BASE}/enrollments`, {
          method: "POST",
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        console.log('Enrollment response status:', res.status);
        
        if (res.ok) {
          enrolledCount++;
          console.log('Successfully enrolled in course:', courseId);
        } else {
          const errorData = await res.json();
          console.log('Enrollment error for course:', courseId, errorData);
          if (errorData.error === "Already enrolled in this course") {
            alreadyEnrolledCount++;
          } else {
            console.error(`Failed to enroll in course ${courseId}:`, errorData.error);
          }
        }
      } catch (error) {
        console.error(`Error enrolling in course ${courseId}:`, error);
      }
    }

    // Show appropriate message
    if (enrolledCount > 0) {
      toast(`Successfully enrolled in ${enrolledCount} course(s)!`);
    }
    if (alreadyEnrolledCount > 0) {
      toast(`Already enrolled in ${alreadyEnrolledCount} course(s)`, "info");
    }
    if (enrolledCount === 0 && alreadyEnrolledCount === 0) {
      toast("No courses available for enrollment", "error");
    }

    document.getElementById('popupenrollclassroom').style.display = 'none';
    fetchClassrooms(); // Refresh the classrooms list
  } catch (error) {
    console.error("Error enrolling in classroom:", error);
    toast(`Failed to enroll: ${error.message}`, "error");
  }
}

// -------- CLASSROOM DELETION --------
async function deleteClassroom() {
  console.log("deleteClassroom called");
  
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (!selectedClassroom) {
    toast("No classroom selected", "error");
    return;
  }
  
  const classroom = JSON.parse(selectedClassroom);
  
  // Show confirmation dialog
  const confirmed = confirm(`Are you sure you want to delete the classroom "${classroom.classroom_name}"?\n\nThis will permanently delete:\n• All assigned lessons\n• All attendance records\n• The classroom itself\n\nThis action cannot be undone.`);
  
  if (!confirmed) {
    console.log("Classroom deletion cancelled by user");
    return;
  }
  
  try {
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      toast("Please log in to delete classroom", "error");
      return;
    }
    
    console.log("Deleting classroom:", classroom.classroom_id);
    
    const res = await fetch(`${API_BASE}/classrooms/${classroom.classroom_id}`, {
      method: "DELETE",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Delete response status:", res.status);
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error("Error response:", errorData);
      
      // Show specific error message for classroom with assigned lessons
      if (errorData.error && errorData.error.includes('assigned lessons')) {
        toast(errorData.error, "warning");
      } else if (errorData.error && errorData.error.includes('attendance records')) {
        toast(errorData.error, "warning");
      } else {
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      return;
    }
    
    const responseData = await res.json();
    console.log("Delete response data:", responseData);
    
    toast("Classroom deleted successfully!");
    
    // Clear session storage
    sessionStorage.removeItem("selected_classroom");
    sessionStorage.removeItem("classroom_view_mode");
    
    // Navigate back to classroom dashboard
    loadContent('classroom_dashboard.html');
    
  } catch (error) {
    console.error("Error deleting classroom:", error);
    toast(`Failed to delete classroom: ${error.message}`, "error");
  }
}

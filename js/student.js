// js/student.js - Student dashboard functionality

// Declare variables only if they don't exist (prevent redeclaration error)
if (typeof students === 'undefined') {
  var students = [];
}
if (typeof courses === 'undefined') {
  var courses = [];
}
if (typeof classrooms === 'undefined') {
  var classrooms = [];
}
if (typeof isAttendanceMode === 'undefined') {
  var isAttendanceMode = false;
}
if (typeof currentClassroomId === 'undefined') {
  var currentClassroomId = null;
}

// -------- STUDENT DASHBOARD INITIALIZATION --------
function initializeStudentDashboard() {
  console.log("initializeStudentDashboard called");
  
  // Check if we're in attendance mode
  const urlParams = new URLSearchParams(window.location.search);
  isAttendanceMode = urlParams.get('mode') === 'attendance';
  
  // Get classroom context if available
  const selectedClassroom = sessionStorage.getItem("student_dashboard_classroom") || sessionStorage.getItem("selected_classroom");
  if (selectedClassroom) {
    const classroom = JSON.parse(selectedClassroom);
    currentClassroomId = classroom.classroom_id;
    console.log("Current classroom:", classroom);
  }
  
  // Load initial data
  loadCourses();
  loadClassrooms();
  loadStudents();
  
  // Setup event listeners
  setupStudentDashboardEventListeners();
  
  // Apply role-based visibility
  setupRoleBasedVisibility();
}

function setupStudentDashboardEventListeners() {
  // Course filter
  const courseDropdown = document.getElementById('course-dropdown');
  if (courseDropdown) {
    courseDropdown.addEventListener('change', applyFilters);
  }
  
  // Classroom filter
  const classroomDropdown = document.getElementById('classroom-dropdown');
  if (classroomDropdown) {
    classroomDropdown.addEventListener('change', applyFilters);
  }
}

// -------- DATA LOADING --------
async function loadCourses() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to view courses", "error");
    return;
  }

  try {
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
    courses = data.courses || [];
    populateCourseDropdown();
  } catch (error) {
    console.error("Error fetching courses:", error);
    toast("Failed to fetch courses", "error");
  }
}

async function loadClassrooms() {
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
    classrooms = data.classrooms || [];
    populateClassroomDropdown();
  } catch (error) {
    console.error("Error fetching classrooms:", error);
    toast("Failed to fetch classrooms", "error");
  }
}

async function loadStudents() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to view students", "error");
    return;
  }

  try {
    let url = `${API_BASE}/students`;
    if (currentClassroomId) {
      url += `?classroom_id=${currentClassroomId}`;
    }

    const res = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    students = data.students || [];
    applyFilters();
  } catch (error) {
    console.error("Error fetching students:", error);
    toast("Failed to fetch students", "error");
  }
}

// -------- DROPDOWN POPULATION --------
function populateCourseDropdown() {
  const courseDropdown = document.getElementById('course-dropdown');
  if (!courseDropdown) return;

  courseDropdown.innerHTML = '<option value="all-courses">All courses</option>';
  
  courses.forEach(course => {
    const option = document.createElement('option');
    option.value = course.course_id;
    option.textContent = course.course_name;
    courseDropdown.appendChild(option);
  });
}

function populateClassroomDropdown() {
  const classroomDropdown = document.getElementById('classroom-dropdown');
  if (!classroomDropdown) return;

  classroomDropdown.innerHTML = '<option value="all-classes">All classes</option>';
  
  classrooms.forEach(classroom => {
    const option = document.createElement('option');
    option.value = classroom.classroom_id;
    option.textContent = classroom.classroom_name;
    classroomDropdown.appendChild(option);
  });
}

// -------- FILTERING AND DISPLAY --------
function applyFilters() {
  const selectedCourse = document.getElementById('course-dropdown')?.value || 'all-courses';
  const selectedClassroom = document.getElementById('classroom-dropdown')?.value || 'all-classes';
  
  console.log("Applying filters:", { selectedCourse, selectedClassroom });
  
  // Apply filters
  const filteredStudents = students.filter(student => {
    const courseMatch = selectedCourse === "all-courses" || student.course_id === selectedCourse;
    const classMatch = selectedClassroom === "all-classes" || student.classroom_id === selectedClassroom;
    return courseMatch && classMatch;
  });
  
  console.log("Filtered students:", filteredStudents);
  
  // Display filtered students
  displayFilteredStudents(filteredStudents);
}

function displayFilteredStudents(filteredStudents) {
  const container = document.getElementById("students-container");
  if (!container) return;
  
  container.innerHTML = ""; // Clear old students
  
  // No students to be displayed
  if (filteredStudents.length === 0) {
    container.innerHTML = "<p>No students found.</p>";
    return;
  }
  
  // Create individual student containers
  filteredStudents.forEach(student => {
    if (isAttendanceMode) {
      createAttendanceStudentBox(student);
    } else {
      createViewStudentBox(student);
    }
  });
}

function createViewStudentBox(student) {
  const container = document.getElementById("students-container");
  if (!container) return;
  
  const box = document.createElement("div");
  box.className = "student-box gender-color-change";
  
  const nameBox = document.createElement("div");
  nameBox.className = "student-name";
  nameBox.textContent = student.student_name || 'Unknown';
  
  const emailBox = document.createElement("div");
  emailBox.className = "student-email";
  emailBox.textContent = student.student_email || 'No email';
  
  box.appendChild(nameBox);
  box.appendChild(emailBox);
  container.appendChild(box);
}

function createAttendanceStudentBox(student) {
  const container = document.getElementById("students-container");
  if (!container) return;
  
  const box = document.createElement("div");
  box.className = "attendance student-box gender-color-change";
  
  const infoBox = document.createElement("div");
  infoBox.className = "student-info";
  
  const nameBox = document.createElement("div");
  nameBox.className = "student-name";
  nameBox.textContent = student.student_name || 'Unknown';
  
  const emailBox = document.createElement("div");
  emailBox.className = "student-email";
  emailBox.textContent = student.student_email || 'No email';
  
  infoBox.appendChild(nameBox);
  infoBox.appendChild(emailBox);
  
  const inputField = document.createElement("input");
  inputField.type = "checkbox";
  inputField.name = "attendance";
  inputField.value = student.student_id;
  inputField.dataset.studentId = student.student_id;
  
  box.appendChild(infoBox);
  box.appendChild(inputField);
  container.appendChild(box);
}

// -------- ATTENDANCE MANAGEMENT --------
function submitAttendance() {
  const checkboxes = document.querySelectorAll('input[name="attendance"]:checked');
  const attendanceData = Array.from(checkboxes).map(checkbox => ({
    student_id: checkbox.dataset.studentId,
    classroom_id: currentClassroomId,
    attendance_date: new Date().toISOString(),
    is_present: true
  }));
  
  if (attendanceData.length === 0) {
    toast("Please select at least one student", "error");
    return;
  }
  
  console.log("Submitting attendance:", attendanceData);
  toast(`Attendance recorded for ${attendanceData.length} students`);
  
  // Here you would typically send the attendance data to the backend
  // For now, we'll just show a success message
}

// -------- ROLE-BASED VISIBILITY --------
function setupRoleBasedVisibility() {
  const userData = sessionStorage.getItem("user_data");
  if (!userData) return;
  
  const user = JSON.parse(userData);
  const isTeacher = user.user?.role === 'teacher';
  const isStudent = user.user?.role === 'student';
  
  // Show/hide teacher elements
  const teacherElements = document.querySelectorAll('.teacher');
  teacherElements.forEach(el => {
    el.style.display = isTeacher ? 'block' : 'none';
  });
  
  // Show/hide student elements
  const studentElements = document.querySelectorAll('.student');
  studentElements.forEach(el => {
    el.style.display = isStudent ? 'block' : 'none';
  });
  
  // Show attendance checkboxes only for teachers in attendance mode
  const attendanceBoxes = document.querySelectorAll('.attendance.student-box');
  attendanceBoxes.forEach(box => {
    box.style.display = (isTeacher && isAttendanceMode) ? 'block' : 'none';
  });
  
  // Show regular student boxes for teachers in view mode or students
  const regularBoxes = document.querySelectorAll('.student-box:not(.attendance)');
  regularBoxes.forEach(box => {
    box.style.display = (isTeacher && !isAttendanceMode) || isStudent ? 'block' : 'none';
  });
}

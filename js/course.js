// js/course.js - Course management functionality

// -------- STUDENT ENROLLMENT --------
async function enrollInCourse(courseId) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to enroll in courses", "error");
    return;
  }

  try {
    console.log("Enrolling in course:", courseId);
    console.log("Token being sent:", token);
    console.log("API_BASE:", API_BASE);
    
    const res = await fetch(`${API_BASE}/enrollments`, {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ course_id: courseId })
    });

    if (!res.ok) {
      const errorData = await res.json();
      if (errorData.error === "Already enrolled in this course") {
        toast("You are already enrolled in this course", "info");
      } else if (errorData.error === "Course not found or not available for enrollment") {
        toast("This course is not available for enrollment", "error");
      } else {
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      return;
    }

    const data = await res.json();
    console.log("Enrollment successful:", data);
    
    toast("Successfully enrolled in course!", "success");
    
    // Refresh the courses list to show updated enrollment status
    await fetchCourses();
    
  } catch (error) {
    console.error("Error enrolling in course:", error);
    toast(`Failed to enroll in course: ${error.message}`, "error");
  }
}

// -------- COURSE MANAGEMENT --------
window.fetchCourses = async function fetchCourses() {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    console.log("No access token found, redirecting to login");
    window.location.href = "login.html";
    return;
  }

  try {
    // Use Edge Function to get courses
    const res = await fetch(`${API_BASE}/courses`, {
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
        return;
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    await renderCourses(data.courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    toast("Failed to fetch courses", "error");
  }
}

async function renderCourses(courses) {
  const container = document.getElementById("courses-container");
  if (!container) return;

  container.innerHTML = "";

  // Check if user is a student
  const userData = await fetchMe();
  const isStudent = userData && userData.user.role === 'student';

  for (const course of courses) {
    const box = document.createElement("div");
    box.className = "course-box course-box-with-status";
    
    // Check if student is enrolled in this course (use is_enrolled field from API)
    const isEnrolled = !isStudent || course.is_enrolled;
    
    if (!isEnrolled) {
      // Style for unenrolled courses
      box.style.cursor = "not-allowed";
      box.style.opacity = "0.6";
      box.style.backgroundColor = "#f5f5f5";
    } else {
      box.style.cursor = "pointer";
    }

    // Header row
    const header = document.createElement("div");
    header.className = "course-header";
    header.innerHTML = `<span>ID: ${course.course_id}</span><span>Title: ${course.course_name}</span>`;

    // Teacher row
    const teacher = document.createElement("div");
    teacher.className = "course-teacher";
    teacher.textContent = `Teacher: ${course.teacher?.teacher_name || 'Unknown'}`;

    // Description row
    const description = document.createElement("div");
    description.className = "course-description";
    description.textContent = `Description: ${course.course_description || 'No description'}`;

    // Credit row - show calculated credits from assigned lessons
    const credit = document.createElement("div");
    credit.className = "course-credit";
    const totalCredits = course.calculated_credits || 0;
    const lessonsCount = course.assigned_lessons_count || 0;
    credit.textContent = `Credits: ${totalCredits} (${lessonsCount} lessons)`;

    // Append to box
    box.appendChild(header);
    box.appendChild(teacher);
    box.appendChild(description);
    box.appendChild(credit);

    // Add enrollment status message and button for students
    if (isStudent && !isEnrolled) {
      const enrollmentContainer = document.createElement("div");
      enrollmentContainer.className = "course-enrollment-container";
      enrollmentContainer.style.cssText = `
        margin-top: 10px;
        padding: 10px;
        background-color: #f5f5f5;
        border-radius: 5px;
        text-align: center;
      `;
      
      const enrollmentMessage = document.createElement("div");
      enrollmentMessage.className = "course-enrollment-status";
      enrollmentMessage.style.cssText = `
        color: #666;
        font-size: 0.9em;
        margin-bottom: 8px;
      `;
      enrollmentMessage.textContent = "You are not enrolled in this course";
      
      const enrollButton = document.createElement("button");
      enrollButton.className = "enroll-button";
      enrollButton.style.cssText = `
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        font-weight: bold;
      `;
      enrollButton.textContent = "Enroll in Course";
      enrollButton.onclick = () => enrollInCourse(course.course_id);
      
      enrollmentContainer.appendChild(enrollmentMessage);
      enrollmentContainer.appendChild(enrollButton);
      box.appendChild(enrollmentContainer);
    } else if (isStudent && isEnrolled) {
      const enrollmentStatus = document.createElement("div");
      enrollmentStatus.className = "course-enrollment-status";
      enrollmentStatus.style.cssText = `
        color: #4CAF50;
        font-weight: bold;
        font-size: 0.9em;
        margin-top: 5px;
        padding: 5px;
        background-color: #e8f5e8;
        border-radius: 3px;
        text-align: center;
      `;
      enrollmentStatus.textContent = "✓ Enrolled";
      box.appendChild(enrollmentStatus);
    }

    // Add status badge for teachers (check if user is teacher)
    await addStatusBadgeToCourse(box, course);

    // Add click handler only for enrolled courses or if user is teacher
    if (isEnrolled || !isStudent) {
      box.addEventListener("click", () => {
        onCourseClick(course);
      });
    } else {
      // For unenrolled courses, clicking the box should not navigate
      // The enroll button will handle enrollment
      box.addEventListener("click", (e) => {
        // Only prevent navigation if clicking on the box itself, not the enroll button
        if (e.target === box || e.target.closest('.course-enrollment-container')) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }

    container.appendChild(box);
  }
}

// Function to add status badge to course for teachers
async function addStatusBadgeToCourse(courseBox, course) {
  console.log("addStatusBadgeToCourse called with course:", course);
  
  // Check if user is a teacher
  const userData = await fetchMe();
  console.log("User data:", userData);
  
  if (!userData || userData.user.role !== 'teacher') {
    console.log("User is not a teacher, not adding badge");
    return; // Don't show status for students
  }

  console.log("User is a teacher, checking course status:", course.status);

  // Only show badge if status is not 'published' (default)
  if (course.status && course.status !== 'published') {
    console.log("Adding status badge for:", course.status);
    
    const statusIndicator = document.createElement("div");
    statusIndicator.className = "course-status-indicator";
    
    const statusBadge = document.createElement("span");
    statusBadge.className = `status-badge status-${course.status}`;
    statusBadge.textContent = course.status;
    
    console.log("Created badge element:", statusBadge);
    console.log("Badge classes:", statusBadge.className);
    
    statusIndicator.appendChild(statusBadge);
    courseBox.appendChild(statusIndicator);
    
    console.log("Badge added to course box");
  } else {
    console.log("Course is published or has no status, no badge needed");
  }
}

function onCourseClick(course) {
  console.log("onCourseClick called with course:", course);
  console.log("Course data being stored:", {
    course_id: course.course_id,
    course_name: course.course_name,
    calculated_credits: course.calculated_credits,
    assigned_lessons_count: course.assigned_lessons_count,
    teacher: course.teacher,
    created_at: course.created_at
  });
  // Store course data for the course view
  sessionStorage.setItem("selected_course", JSON.stringify(course));
  console.log("Course stored in session storage, loading course_view.html");
  loadContent('course_view.html');
}

// -------- COURSE CREATION --------
window.createCourse = async function createCourse(courseData) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to create courses", "error");
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/courses`, {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(courseData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      if (errorData.error === "COURSE_ID_ALREADY_EXISTS") {
        toast("A course with this ID already exists. Please choose a different course ID.", "error");
        return false;
      }
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    const statusMessage = courseData.status === 'draft' ? 'Course saved as draft!' : 
                         courseData.status === 'archived' ? 'Course archived!' : 
                         'Course published successfully!';
    toast(statusMessage);
    return data.course;
  } catch (error) {
    console.error("Error creating course:", error);
    toast(`Failed to create course: ${error.message}`, "error");
    return false;
  }
}

// -------- FORM HANDLERS --------
window.setupCourseForm = function setupCourseForm() {
  const publishBtn = document.querySelector('.publish.btn');
  const saveDraftBtn = document.querySelector('.savedraft.btn');
  const archiveBtn = document.querySelector('.archive.btn');

  if (publishBtn) {
    publishBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleCourseSubmit('published');
    });
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleCourseSubmit('draft');
    });
  }

  if (archiveBtn) {
    archiveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleCourseSubmit('archived');
    });
  }

  // Setup lesson popup functionality
  setupCourseLessonPopup();
}

// Function to open lesson popup and load available lessons
window.openLessonPopup = async function openLessonPopup() {
  // Show the popup
  const popup = document.getElementById('popuplesson');
  if (!popup) {
    console.error("Popup element 'popuplesson' not found");
    return;
  }
  popup.style.display = 'flex';
  
  // Load available lessons immediately
  await loadAvailableLessonsForCourse();
}

// Function to setup lesson popup for course creation
function setupCourseLessonPopup() {
  const addLessonBtn = document.getElementById('course-add-lesson');
  if (addLessonBtn) {
    addLessonBtn.addEventListener('click', async () => {
      await loadAvailableLessonsForCourse();
    });
  }
}

// Function to load available lessons for course creation
async function loadAvailableLessonsForCourse() {
  console.log("loadAvailableLessonsForCourse called");
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    console.error("No access token found");
    toast("Please log in to view lessons", "error");
    return;
  }

  try {
    console.log("Fetching available lessons from:", `${API_BASE}/lessons?available=true`);
    const res = await fetch(`${API_BASE}/lessons?available=true`, {
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
    console.log("Available lessons data:", data);
    const availableLessons = data.lessons || [];
    
    console.log("Calling populateAvailableLessonsForCourse with:", availableLessons);
    populateAvailableLessonsForCourse(availableLessons);
    
  } catch (error) {
    console.error("Error fetching available lessons:", error);
    toast("Failed to fetch available lessons", "error");
  }
}

// Function to populate available lessons in the course creation popup
function populateAvailableLessonsForCourse(availableLessons) {
  const container = document.getElementById('addable-lesson-container');
  if (!container) {
    console.error("Container 'addable-lesson-container' not found");
    return;
  }

  container.innerHTML = '';

  if (availableLessons.length === 0) {
    container.innerHTML = '<p>No available lessons to add. Create new lessons first.</p>';
    return;
  }

  availableLessons.forEach(lesson => {
    const lessonDiv = document.createElement('div');
    lessonDiv.className = 'lesson-item';
    
    lessonDiv.innerHTML = `
      <input type="checkbox" value="${lesson.lesson_id}" id="lesson-${lesson.lesson_id}">
      <div class="lesson-content">
        <div class="lesson-title">${lesson.display_id || lesson.lesson_title}</div>
        <div class="lesson-description">${lesson.lesson_title}</div>
        <div class="lesson-effort">Credits: ${lesson.lesson_credit || 0} | Effort: ${lesson.estimated_effort || 'N/A'} hours/week</div>
      </div>
    `;

    container.appendChild(lessonDiv);
  });
}

// Function to add selected lessons to the course creation form
function addSelectedLessonsToCourse() {
  const checkedBoxes = document.querySelectorAll('#addable-lesson-container input[type="checkbox"]:checked');
  
  if (checkedBoxes.length === 0) {
    toast('Please select at least one lesson to add', 'error');
    return;
  }
  
  // Collect lesson IDs first before modifying DOM
  const lessonIds = Array.from(checkedBoxes).map(checkbox => checkbox.value);
  
  let addedCount = 0;
  lessonIds.forEach(lessonId => {
    addLessonToCourseCreation(lessonId);
    addedCount++;
  });
  
  // Close the popup
  document.getElementById('popuplesson').style.display = 'none';
  
  toast(`Successfully added ${addedCount} lesson${addedCount > 1 ? 's' : ''} to the course!`);
}

// Function to add a lesson to the course creation form
function addLessonToCourseCreation(lessonId) {
  // Find the lesson data from the available lessons
  const lessonDiv = document.querySelector(`input[value="${lessonId}"]`).closest('.lesson-item');
  const lessonTitle = lessonDiv.querySelector('.lesson-title').textContent;
  const lessonCreditText = lessonDiv.querySelector('.lesson-effort').textContent;
  const lessonCredit = lessonCreditText.match(/Credits: (\d+)/)?.[1] || '0';
  
  // Add lesson to the lessons container
  const lessonsContainer = document.getElementById('lessons-container');
  if (!lessonsContainer) return;

  const lessonItem = document.createElement('div');
  lessonItem.className = 'lesson-item';
  lessonItem.style.cssText = `
    border: 1px solid #ccc;
    padding: 10px;
    margin: 5px 0;
    border-radius: 5px;
    background-color: #f9f9f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  lessonItem.innerHTML = `
    <div>
      <strong>${lessonTitle}</strong>
      <div style="color: #666; font-size: 0.9em;">
        Credits: <span class="lesson-credit">${lessonCredit}</span>
      </div>
    </div>
    <button onclick="removeLessonFromCourseCreation(this)" class="btn" style="background-color: #f44336; color: white; padding: 5px 10px;">
      Remove
    </button>
  `;
  
  // Store the lesson ID as a data attribute
  lessonItem.setAttribute('data-lesson-id', lessonId);

  lessonsContainer.appendChild(lessonItem);
  
  // Update credit display
  updateCourseCreditDisplay();
  
  // Remove the lesson from available lessons
  lessonDiv.remove();
}

// Function to remove a lesson from course creation
function removeLessonFromCourseCreation(button) {
  const lessonItem = button.closest('.lesson-item');
  lessonItem.remove();
  
  // Update credit display
  updateCourseCreditDisplay();
}

// Function to calculate course credit points from lessons
function calculateCourseCreditFromLessons(lessons) {
  if (!lessons || lessons.length === 0) {
    return 0;
  }
  
  return lessons.reduce((total, lesson) => {
    return total + (lesson.lesson_credit || 0);
  }, 0);
}

// Function to update course credit display
function updateCourseCreditDisplay() {
  const creditDisplay = document.getElementById('course-credit-display');
  if (!creditDisplay) return;
  
  const lessonsContainer = document.getElementById('lessons-container');
  if (!lessonsContainer) {
    creditDisplay.textContent = '-';
    return;
  }
  
  const lessonElements = lessonsContainer.querySelectorAll('.lesson-item');
  const totalCredits = Array.from(lessonElements).reduce((total, element) => {
    const creditText = element.querySelector('.lesson-credit')?.textContent;
    const credit = parseInt(creditText) || 0;
    return total + credit;
  }, 0);
  
  creditDisplay.textContent = totalCredits > 0 ? totalCredits : '-';
}

async function handleCourseSubmit(status) {
  const courseCode = document.getElementById('course-code-input')?.value?.trim();
  const courseName = document.getElementById('course-name-input')?.value?.trim();
  const courseDesc = document.getElementById('course-desc-input')?.value?.trim();

  if (!courseCode) {
    toast("Course Code is required", "error");
    return;
  }

  if (!courseName) {
    toast("Course Name is required", "error");
    return;
  }

  // Calculate credit points from lessons
  const lessonsContainer = document.getElementById('lessons-container');
  let calculatedCredits = 0;
  const selectedLessonIds = [];
  
  if (lessonsContainer) {
    const lessonElements = lessonsContainer.querySelectorAll('.lesson-item');
    calculatedCredits = Array.from(lessonElements).reduce((total, element) => {
      const creditText = element.querySelector('.lesson-credit')?.textContent;
      const credit = parseInt(creditText) || 0;
      return total + credit;
    }, 0);
    
    // Collect lesson IDs for assignment
    lessonElements.forEach(element => {
      const lessonId = element.getAttribute('data-lesson-id');
      if (lessonId) {
        selectedLessonIds.push(lessonId);
      }
    });
  }

  const courseData = {
    course_id: courseCode,
    course_name: courseName,
    course_description: courseDesc,
    course_credit: calculatedCredits,
    status: status
  };

  const result = await createCourse(courseData);
  if (result) {
    // Assign selected lessons to the course
    if (selectedLessonIds.length > 0) {
      await assignLessonsToNewCourse(courseCode, selectedLessonIds);
    }
    loadContent('course_dashboard.html');
  }
}

// Function to assign lessons to a newly created course
async function assignLessonsToNewCourse(courseId, lessonIds) {
  const token = sessionStorage.getItem("access_token");
  if (!token) return;

  try {
    console.log("Assigning lessons to new course:", courseId, "lessons:", lessonIds);
    
    // Assign each lesson to the course using the correct API endpoint
    const assignmentPromises = lessonIds.map(lessonId => 
      fetch(`${API_BASE}/lessons?action=assign_to_course`, {
        method: "POST",
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          course_id: courseId,
          lesson_id: lessonId 
        })
      })
    );

    const results = await Promise.all(assignmentPromises);
    const failedAssignments = results.filter(res => !res.ok);
    
    if (failedAssignments.length > 0) {
      throw new Error(`Failed to assign ${failedAssignments.length} lessons`);
    }

    toast(`Successfully assigned ${lessonIds.length} lesson(s) to the course!`, "success");
    
  } catch (error) {
    console.error("Error assigning lessons to course:", error);
    toast("Course created but failed to assign some lessons", "warning");
  }
}

// -------- COURSE VIEW INITIALIZATION --------
function initializeCourseViewFromMain() {
  console.log("initializeCourseViewFromMain called");
  const selectedCourse = sessionStorage.getItem("selected_course");
  console.log("Selected course from session storage:", selectedCourse);
  
  // Ensure Add Lesson button is hidden on initial load
  const addLessonBtn = document.getElementById('add-lesson-btn');
  if (addLessonBtn) {
    addLessonBtn.style.display = 'none';
  }
  
  if (selectedCourse) {
    const course = JSON.parse(selectedCourse);
    console.log("Parsed course:", course);
    displayCourseDetailsFromMain(course);
    fetchLessonsForCourseFromMain(course.course_id);
  } else {
    console.log("No course selected in session storage");
    const infoElement = document.getElementById("course-info-content");
    if (infoElement) {
      infoElement.innerHTML = "<p>No course selected. Please go back to the course dashboard.</p>";
    } else {
      console.error("Element #course-info-content not found");
    }
  }
}

function displayCourseDetailsFromMain(course) {
  console.log("displayCourseDetailsFromMain called with course:", course);
  const titleElement = document.getElementById("course-title");
  const infoElement = document.getElementById("course-info-content");
  
  if (titleElement) {
    titleElement.textContent = course.course_name || "Course Details";
  }
  
  if (infoElement) {
    console.log("Course data for display:", {
      course_id: course.course_id,
      course_name: course.course_name,
      calculated_credits: course.calculated_credits,
      assigned_lessons_count: course.assigned_lessons_count,
      teacher: course.teacher,
      created_at: course.created_at
    });
    
    infoElement.innerHTML = `
      <div class="course-detail-item">
        <strong>Course ID:</strong> ${course.course_id || 'N/A'}
      </div>
      <div class="course-detail-item">
        <strong>Course Name:</strong> ${course.course_name || 'N/A'}
      </div>
      <div class="course-detail-item">
        <strong>Credits:</strong> ${course.calculated_credits || 0} (from ${course.assigned_lessons_count || 0} assigned lessons)
      </div>
      <div class="course-detail-item">
        <strong>Created by:</strong> ${course.teacher?.teacher_name || 'Unknown'}
      </div>
      <div class="course-detail-item">
        <strong>Created on:</strong> ${new Date(course.created_at).toLocaleDateString()}
      </div>
      <div class="course-description-section">
        <h3>Course Description</h3>
        <div class="course-description-content">
          ${course.course_description || 'No description available for this course.'}
        </div>
      </div>
    `;
  }
}

async function fetchLessonsForCourseFromMain(courseId) {
  console.log("fetchLessonsForCourseFromMain called with courseId:", courseId);
  const token = sessionStorage.getItem("access_token");
  console.log("Token available:", !!token);
  
  if (!token) {
    console.log("No token available, returning");
    return;
  }

  try {
    const url = `${API_BASE}/lessons?course_id=${courseId}`;
    console.log("Making API call to:", url);
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("API response status:", res.status);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log("API response data:", data);
    const lessons = data.lessons || [];
    console.log("Lessons array:", lessons);
    
    await renderLessonsForCourseFromMain(lessons);
  } catch (error) {
    console.error("Error fetching lessons for course:", error);
    const container = document.getElementById("course-lessons-container");
    if (container) {
      container.innerHTML = "<p>Failed to load lessons for this course.</p>";
    }
  }
}

async function renderLessonsForCourseFromMain(lessons) {
  console.log("renderLessonsForCourseFromMain called with:", lessons);
  const container = document.getElementById("course-lessons-container");
  console.log("Container element:", container);
  
  if (!container) {
    console.error("Container #course-lessons-container not found!");
    return;
  }

  if (lessons.length === 0) {
    console.log("No lessons to render, showing empty message");
    container.innerHTML = "<p>No lessons available for this course.</p>";
    return;
  }

  console.log(`Rendering ${lessons.length} lessons`);
  container.innerHTML = "";

  for (const [index, lesson] of lessons.entries()) {
    console.log(`Creating lesson box ${index + 1}:`, lesson);
    const box = document.createElement("div");
    box.className = "lesson-box lesson-box-with-status";
    box.style.cursor = "pointer";

    const header = document.createElement("div");
    header.className = "lesson-header";
    header.innerHTML = `<span>${lesson.display_id || lesson.lesson_title}</span>`;

    const title = document.createElement("div");
    title.className = "lesson-title";
    title.textContent = `Title: ${lesson.lesson_title}`;

    const week = document.createElement("div");
    week.className = "lesson-week";
    week.textContent = `Week ${lesson.week_number || 'N/A'}`;

    const description = document.createElement("div");
    description.className = "lesson-description";
    description.textContent = `Description: ${lesson.lesson_content ? 
      (lesson.lesson_content.length > 100 ? 
        lesson.lesson_content.substring(0, 100) + '...' : 
        lesson.lesson_content) : 'No description available'}`;

    box.appendChild(header);
    box.appendChild(title);
    box.appendChild(week);
    box.appendChild(description);

    // Add status badge for teachers (check if user is teacher)
    await addStatusBadgeToLesson(box, lesson);

    // Add click handler to navigate to lesson detail view
    box.addEventListener("click", () => {
      sessionStorage.setItem("selected_lesson", JSON.stringify(lesson));
      loadContent('lesson_view.html');
    });

    container.appendChild(box);
  }
  console.log("Finished rendering lessons");
}

// -------- LESSON ASSIGNMENT TO COURSE --------
async function addLessonToCourse() {
  console.log("addLessonToCourse called");
  
  // Get the current course from session storage
  const selectedCourse = sessionStorage.getItem("selected_course");
  if (!selectedCourse) {
    console.error("No course selected");
    toast("No course selected. Please go back to the course dashboard.", "error");
    return;
  }

  const course = JSON.parse(selectedCourse);
  
  try {
    // Use the same approach as course creation - fetch available lessons
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      toast("Please log in to view lessons", "error");
      return;
    }

    console.log("Fetching available lessons from:", `${API_BASE}/lessons?available=true`);
    const res = await fetch(`${API_BASE}/lessons?available=true`, {
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
    console.log("Available lessons data:", data);
    const availableLessons = data.lessons || [];
    
    if (availableLessons.length === 0) {
      console.log("No available lessons found");
      toast("No available lessons to assign. Create new lessons first.", "info");
      return;
    }

    console.log("Showing lesson assignment popup with", availableLessons.length, "lessons");
    // Use the same popup approach as course creation
    showLessonAssignmentPopup(availableLessons, course);
    
  } catch (error) {
    console.error("Error fetching available lessons:", error);
    toast("Failed to fetch available lessons", "error");
  }
}

// Function to show lesson assignment popup (matching course creation design)
function showLessonAssignmentPopup(availableLessons, course) {
  console.log("showLessonAssignmentPopup called with", availableLessons.length, "lessons");
  
  // Create a popup that matches the course creation page design exactly
  const popupHTML = `
    <div id="lesson-assignment-popup" class="popup" style="display: flex;">
      <div class="popup-content">
        <span class="close" onclick="closeLessonAssignmentPopup()">&times;</span>
        <h2>Add Lessons</h2>
        <div id="addable-lesson-container" class="addable-lesson-list"></div>
        <div style="display: flex; justify-content: center;margin: 5px 5px;">
          <button id="course-assignment-add-lesson" class="add-item-btn" onclick="assignSelectedLessonsToCourse()">
            <span class="material-symbols-sharp">add</span>&nbsp;&nbsp;Add Selected Lessons
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add popup to page
  document.body.insertAdjacentHTML('beforeend', popupHTML);
  
  // Populate available lessons using the same function as course creation
  populateAvailableLessonsForCourseAssignment(availableLessons);
}

// Function to populate available lessons for course assignment (matching course creation design)
function populateAvailableLessonsForCourseAssignment(availableLessons) {
  console.log("populateAvailableLessonsForCourseAssignment called with:", availableLessons);
  const container = document.getElementById('addable-lesson-container');
  if (!container) {
    console.error("Container 'addable-lesson-container' not found");
    return;
  }

  container.innerHTML = '';

  if (availableLessons.length === 0) {
    container.innerHTML = '<p>No available lessons to add. Create new lessons first.</p>';
    return;
  }

  availableLessons.forEach(lesson => {
    const lessonDiv = document.createElement('div');
    lessonDiv.className = 'lesson-item';
    
    lessonDiv.innerHTML = `
      <input type="checkbox" value="${lesson.lesson_id}" id="lesson-${lesson.lesson_id}">
      <div class="lesson-content">
        <div class="lesson-title">${lesson.display_id || lesson.lesson_title}</div>
        <div class="lesson-description">${lesson.lesson_title}</div>
        <div class="lesson-effort">Credits: ${lesson.lesson_credit || 0} | Effort: ${lesson.estimated_effort || 'N/A'} hours/week</div>
      </div>
    `;

    container.appendChild(lessonDiv);
  });
}

// Function to assign selected lessons to course
function assignSelectedLessonsToCourse() {
  const checkedBoxes = document.querySelectorAll('#addable-lesson-container input[type="checkbox"]:checked');
  const selectedLessonIds = Array.from(checkedBoxes).map(checkbox => checkbox.value);
  
  if (selectedLessonIds.length === 0) {
    toast("Please select at least one lesson to assign.", "error");
    return;
  }
  
  console.log("Assigning lessons to course:", selectedLessonIds);
  
  // Get course from session storage
  const selectedCourse = sessionStorage.getItem("selected_course");
  if (!selectedCourse) {
    toast("No course selected.", "error");
    return;
  }
  
  const course = JSON.parse(selectedCourse);
  console.log("Course data from session storage:", course);
  
  // Assign each selected lesson to the course
  assignLessonsToCourse(course.course_id, selectedLessonIds);
  
  // Close the popup
  closeLessonAssignmentPopup();
}

// Function to close lesson assignment popup
function closeLessonAssignmentPopup() {
  const popup = document.getElementById('lesson-assignment-popup');
  if (popup) {
    popup.remove();
  }
}

// Function to assign lessons to course via API
async function assignLessonsToCourse(courseId, lessonIds) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to assign lessons", "error");
    return;
  }
  
  console.log("Assigning lessons to course:", courseId, "lessons:", lessonIds);
  
  let successCount = 0;
  
  for (const lessonId of lessonIds) {
    try {
      console.log(`Attempting to assign lesson ${lessonId} to course ${courseId}`);
      const res = await fetch(`${API_BASE}/lessons?action=assign_to_course`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          course_id: courseId,
          lesson_id: lessonId
        })
      });
      
      console.log(`Response for lesson ${lessonId}:`, res.status);
      if (res.ok) {
        successCount++;
        console.log(`Successfully assigned lesson ${lessonId}`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error(`Failed to assign lesson ${lessonId}:`, res.status, errorData);
      }
    } catch (error) {
      console.error(`Error assigning lesson ${lessonId}:`, error);
    }
  }
  
  if (successCount > 0) {
    toast(`Successfully assigned ${successCount} lesson${successCount > 1 ? 's' : ''} to the course!`);
    // Refresh the course view to show the new lessons
    const selectedCourse = sessionStorage.getItem("selected_course");
    if (selectedCourse) {
      const course = JSON.parse(selectedCourse);
      fetchLessonsForCourseFromMain(course.course_id);
    }
  } else {
    toast("Failed to assign lessons to the course.", "error");
  }
}

function showLessonAssignmentModal(availableLessons, course) {
  console.log("showLessonAssignmentModal called with", availableLessons.length, "lessons");
  
  try {
    // Create modal HTML
    const modalHTML = `
      <div id="lesson-assignment-modal" class="popup" style="display: flex;">
        <div class="popup-content" style="max-width: 80%; max-height: 80%; overflow-y: auto;">
          <span class="close" onclick="closeLessonAssignmentModal()">&times;</span>
          <h2>Assign Lessons to ${course.course_name}</h2>
          <p>Select lessons to assign to this course:</p>
          <div id="available-lessons-list" style="margin: 20px 0;">
            <!-- Available lessons will be populated here -->
          </div>
          <div style="display: flex; justify-content: center; margin-top: 20px;">
            <button onclick="assignSelectedLessons()" class="btn gender-color-change-background gender-color-change-background-hover" style="background-color: #4CAF50; color: white;">OK</button>
          </div>
        </div>
      </div>
    `;

    console.log("Adding modal HTML to page");
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    console.log("Modal added, populating lessons list");
    // Populate available lessons
    const lessonsList = document.getElementById('available-lessons-list');
    if (!lessonsList) {
      console.error("Lessons list container not found");
      return;
    }
    lessonsList.innerHTML = '';

    console.log("Populating", availableLessons.length, "lessons");
    availableLessons.forEach((lesson, index) => {
      console.log(`Creating lesson ${index + 1}:`, lesson.lesson_title);
      const lessonDiv = document.createElement('div');
      lessonDiv.className = 'lesson-assignment-item';
      lessonDiv.style.cssText = `
        border: 1px solid #ddd;
        padding: 15px;
        margin: 10px 0;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.2s;
      `;
      
      lessonDiv.innerHTML = `
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" value="${lesson.lesson_id}" style="margin-right: 10px;">
          <div>
            <strong>${lesson.display_id || lesson.lesson_title}</strong>
            <div style="color: #666; font-size: 0.9em; margin-top: 5px;">
              ${lesson.lesson_title}
            </div>
            <div style="color: #888; font-size: 0.8em; margin-top: 3px;">
              Credits: ${lesson.lesson_credit || 'N/A'} | Effort: ${lesson.estimated_effort || 'N/A'} hours/week
            </div>
          </div>
        </label>
      `;

      // Add hover effect
      lessonDiv.addEventListener('mouseenter', () => {
        lessonDiv.style.backgroundColor = '#f5f5f5';
      });
      lessonDiv.addEventListener('mouseleave', () => {
        lessonDiv.style.backgroundColor = '';
      });

      lessonsList.appendChild(lessonDiv);
    });
    
    console.log("Modal setup complete");
  } catch (error) {
    console.error("Error in showLessonAssignmentModal:", error);
  }
}

function closeLessonAssignmentModal() {
  const modal = document.getElementById('lesson-assignment-modal');
  if (modal) {
    modal.remove();
  }
}

async function assignSelectedLessons() {
  const checkboxes = document.querySelectorAll('#available-lessons-list input[type="checkbox"]:checked');
  
  if (checkboxes.length === 0) {
    // If no lessons selected, just close the modal
    closeLessonAssignmentModal();
    return;
  }

  const selectedLessonIds = Array.from(checkboxes).map(cb => cb.value);
  const course = JSON.parse(sessionStorage.getItem("selected_course"));

  try {
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      toast("Please log in to assign lessons", "error");
      return;
    }

    // Assign each selected lesson to the course using the new assignment endpoint
    const assignmentPromises = selectedLessonIds.map(lessonId => 
      fetch(`${API_BASE}/lessons?action=assign_to_course`, {
        method: "POST",
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          course_id: course.course_id,
          lesson_id: lessonId 
        })
      })
    );

    const results = await Promise.all(assignmentPromises);
    
    // Check if all assignments were successful
    const failedAssignments = results.filter(res => !res.ok);
    if (failedAssignments.length > 0) {
      throw new Error(`Failed to assign ${failedAssignments.length} lessons`);
    }

    toast(`Successfully assigned ${selectedLessonIds.length} lesson(s) to ${course.course_name}!`);
    closeLessonAssignmentModal();
    
    // Refresh the course view to show the newly assigned lessons
    loadContent('course_view.html');
    
  } catch (error) {
    console.error("Error assigning lessons:", error);
    toast(`Failed to assign lessons: ${error.message}`, "error");
  }
}

// -------- EDIT FUNCTIONALITY FOR COURSES --------
function makeCourseEditable(box, course) {
  const header = box.querySelector('.course-header');
  const description = box.querySelector('.course-description');
  const credit = box.querySelector('.course-credit');

  // Make course name editable
  const titleSpan = header.querySelector('span:last-child');
  if (titleSpan) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = course.course_name;
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 5px';
    input.style.borderRadius = '3px';
    input.style.width = '200px';
    input.dataset.field = 'course_name';
    titleSpan.innerHTML = '';
    titleSpan.appendChild(input);
  }

  // Make description editable
  const descText = description.textContent.replace('Description: ', '');
  const descInput = document.createElement('textarea');
  descInput.value = descText;
  descInput.style.border = '1px solid #ccc';
  descInput.style.padding = '5px';
  descInput.style.borderRadius = '3px';
  descInput.style.width = '100%';
  descInput.style.height = '60px';
  descInput.style.resize = 'vertical';
  descInput.dataset.field = 'course_description';
  description.innerHTML = '';
  description.appendChild(descInput);

  // Make credit editable
  const creditText = credit.textContent.replace('Credits: ', '');
  const creditInput = document.createElement('input');
  creditInput.type = 'number';
  creditInput.value = creditText;
  creditInput.style.border = '1px solid #ccc';
  creditInput.style.padding = '2px 5px';
  creditInput.style.borderRadius = '3px';
  creditInput.style.width = '80px';
  creditInput.dataset.field = 'course_credit';
  credit.innerHTML = '';
  credit.appendChild(creditInput);
}

function makeCourseReadOnly(box, originalValues) {
  const header = box.querySelector('.course-header');
  const description = box.querySelector('.course-description');
  const credit = box.querySelector('.course-credit');

  // Restore original display
  header.innerHTML = `<span>ID: ${originalValues.course_id}</span><span>Title: ${originalValues.course_name}</span>`;
  description.textContent = `Description: ${originalValues.course_description || 'No description'}`;
  credit.textContent = `Credits: ${originalValues.course_credit || 0}`;
}

async function saveCourseChanges(course, box) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to save changes", "error");
    return;
  }

  // Get updated values from inputs
  const courseNameInput = box.querySelector('input[data-field="course_name"]');
  const courseDescInput = box.querySelector('textarea[data-field="course_description"]');
  const courseCreditInput = box.querySelector('input[data-field="course_credit"]');

  const updatedData = {
    course_name: courseNameInput ? courseNameInput.value.trim() : course.course_name,
    course_description: courseDescInput ? courseDescInput.value.trim() : course.course_description,
    course_credit: courseCreditInput ? parseInt(courseCreditInput.value) || 0 : course.course_credit
  };

  // Check if anything actually changed
  const hasChanges = 
    updatedData.course_name !== course.course_name ||
    updatedData.course_description !== course.course_description ||
    updatedData.course_credit !== course.course_credit;

  if (!hasChanges) {
    toast("No changes to save");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${course.course_id}`, {
      method: "PUT",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    toast("Course updated successfully!");
    // Refresh the courses list
    fetchCourses();
  } catch (error) {
    console.error("Error updating course:", error);
    toast(`Failed to update course: ${error.message}`, "error");
  }
}

async function deleteCourse(course) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to delete courses", "error");
    return;
  }

  // Check if course has lessons
  try {
    const lessonsRes = await fetch(`${API_BASE}/lessons?course_id=${course.course_id}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (lessonsRes.ok) {
      const lessonsData = await lessonsRes.json();
      if (lessonsData.lessons && lessonsData.lessons.length > 0) {
        toast("Cannot delete course. Please delete all lessons first.", "error");
        return;
      }
    }
  } catch (error) {
    console.error("Error checking lessons:", error);
    toast("Error checking course dependencies", "error");
    return;
  }

  // Confirm deletion
  if (!confirm(`Are you sure you want to delete course "${course.course_name}"?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${course.course_id}`, {
      method: "DELETE",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    toast("Course deleted successfully!");
    // Refresh the courses list
    fetchCourses();
  } catch (error) {
    console.error("Error deleting course:", error);
    toast(`Failed to delete course: ${error.message}`, "error");
  }
}

// -------- EDIT SETUP FUNCTIONS FOR MAIN SCRIPT --------
function setupCourseEditFromMain() {
  console.log('Setting up course edit from main script');
  const editToggle = document.getElementById('course-edit-toggle');
  const editControls = document.getElementById('course-edit-controls');
  const saveBtn = document.getElementById('course-save-btn');
  const deleteBtn = document.getElementById('course-delete-btn');
  const cancelBtn = document.getElementById('course-cancel-btn');
  const addLessonBtn = document.getElementById('add-lesson-btn');

  console.log('Course edit elements found:', {
    editToggle: !!editToggle,
    editControls: !!editControls,
    saveBtn: !!saveBtn,
    deleteBtn: !!deleteBtn,
    cancelBtn: !!cancelBtn,
    addLessonBtn: !!addLessonBtn
  });

  if (!editToggle || !editControls || !saveBtn || !deleteBtn || !cancelBtn) {
    console.error('Could not find all required course edit elements');
    return;
  }

  // Ensure Add Lesson button is hidden when edit setup is initialized
  if (addLessonBtn) {
    addLessonBtn.style.display = 'none';
  }

  // Get course data from session storage
  const selectedCourse = sessionStorage.getItem("selected_course");
  if (!selectedCourse) {
    console.error('No course selected in session storage');
    return;
  }

  const course = JSON.parse(selectedCourse);
  let isEditing = false;
  let originalValues = {
    course_id: course.course_id,
    course_name: course.course_name,
    course_description: course.course_description
  };

  editToggle.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Course edit toggle clicked, isEditing:', isEditing);
    if (!isEditing) {
      // Enter edit mode
      isEditing = true;
      editToggle.style.display = 'none';
      editControls.style.display = 'block';
      if (addLessonBtn) {
        addLessonBtn.style.display = 'block';
      }
      makeCourseViewEditableFromMain(course);
    }
  });

  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('Course save button clicked');
    await saveCourseViewChangesFromMain(course);
    isEditing = false;
    editToggle.style.display = 'block';
    editControls.style.display = 'none';
    if (addLessonBtn) {
      addLessonBtn.style.display = 'none';
    }
    makeCourseViewReadOnlyFromMain(originalValues);
  });

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Course cancel button clicked');
    isEditing = false;
    editToggle.style.display = 'block';
    editControls.style.display = 'none';
    if (addLessonBtn) {
      addLessonBtn.style.display = 'none';
    }
    makeCourseViewReadOnlyFromMain(originalValues);
  });

  deleteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('Course delete button clicked');
    await deleteCourseFromViewFromMain(course);
  });
}

// -------- EDIT HELPER FUNCTIONS FOR MAIN SCRIPT --------
function makeCourseViewEditableFromMain(course) {
  console.log('Making course view editable from main script');
  
  const titleElement = document.getElementById('course-title');
  const infoElement = document.getElementById('course-info-content');

  // Make course title editable
  if (titleElement) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = course.course_name;
    input.style.border = '1px solid #ccc';
    input.style.padding = '8px 12px';
    input.style.borderRadius = '5px';
    input.style.width = '300px';
    input.style.fontSize = '24px';
    input.style.fontWeight = 'bold';
    input.id = 'course-title-input';
    titleElement.innerHTML = '';
    titleElement.appendChild(input);
  }

  // Make course info content editable
  if (infoElement) {
    infoElement.innerHTML = `
      <div class="course-detail-item">
        <strong>Course ID:</strong> 
        <input type="text" id="course-id-input" value="${course.course_id || ''}" 
               style="border: 1px solid #ccc; padding: 2px 5px; border-radius: 3px; width: 150px; margin-left: 10px;">
      </div>
      <div class="course-detail-item">
        <strong>Course Name:</strong> 
        <input type="text" id="course-name-input" value="${course.course_name || ''}" 
               style="border: 1px solid #ccc; padding: 2px 5px; border-radius: 3px; width: 200px; margin-left: 10px;">
      </div>
      <div class="course-detail-item">
        <strong>Credits:</strong> ${course.course_credit > 0 ? course.course_credit : '-'}
      </div>
      <div class="course-detail-item">
        <strong>Created by:</strong> ${course.teacher?.teacher_name || 'Unknown'}
      </div>
      <div class="course-detail-item">
        <strong>Created on:</strong> ${new Date(course.created_at).toLocaleDateString()}
      </div>
      <div class="course-description-section">
        <h3>Course Description</h3>
        <textarea id="course-description-input" 
                  style="border: 1px solid #ccc; padding: 5px; border-radius: 3px; width: 100%; height: 100px; resize: vertical; margin-top: 10px;">${course.course_description || ''}</textarea>
      </div>
    `;
  }
}

function makeCourseViewReadOnlyFromMain(originalValues) {
  console.log('Making course view read-only from main script');
  
  const titleElement = document.getElementById('course-title');
  const infoElement = document.getElementById('course-info-content');

  if (titleElement) {
    titleElement.textContent = originalValues.course_name || 'Course Details';
  }
  
  if (infoElement) {
    // Get the course data from session storage to restore the full display
    const selectedCourse = sessionStorage.getItem("selected_course");
    if (selectedCourse) {
      const course = JSON.parse(selectedCourse);
      displayCourseDetailsFromMain(course);
    }
  }
}

// -------- SAVE FUNCTIONS FOR VIEW PAGES --------
async function saveCourseViewChangesFromMain(course) {
  console.log('Saving course view changes');
  
  const titleInput = document.getElementById('course-title-input');
  const courseIdInput = document.getElementById('course-id-input');
  const nameInput = document.getElementById('course-name-input');
  const descriptionInput = document.getElementById('course-description-input');
  
  // Collect updated values from form fields
  const updatedData = {
    course_id: courseIdInput ? courseIdInput.value.trim() : course.course_id,
    course_name: titleInput ? titleInput.value.trim() : course.course_name,
    course_description: descriptionInput ? descriptionInput.value.trim() : course.course_description
  };
  
  // Check if anything actually changed
  const hasChanges = 
    updatedData.course_id !== course.course_id ||
    updatedData.course_name !== course.course_name ||
    updatedData.course_description !== course.course_description;

  if (!hasChanges) {
    toast("No changes to save");
    return;
  }
  
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to update courses", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${course.course_id}`, {
      method: "PUT",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    toast("Course updated successfully!");
    
    // Update the course in session storage with new data
    const updatedCourse = { ...course, ...updatedData };
    sessionStorage.setItem("selected_course", JSON.stringify(updatedCourse));
    
  } catch (error) {
    console.error("Error updating course:", error);
    toast(`Failed to update course: ${error.message}`, "error");
  }
}

// -------- DELETE FUNCTIONS FOR VIEW PAGES --------
async function deleteCourseFromViewFromMain(course) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to delete courses", "error");
    return;
  }

  // Check if course has lessons
  try {
    const lessonsRes = await fetch(`${API_BASE}/lessons?course_id=${course.course_id}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (lessonsRes.ok) {
      const lessonsData = await lessonsRes.json();
      if (lessonsData.lessons && lessonsData.lessons.length > 0) {
        toast("Cannot delete course. Please delete all lessons first.", "error");
        return;
      }
    }
  } catch (error) {
    console.error("Error checking lessons:", error);
    toast("Error checking course dependencies", "error");
    return;
  }

  // Confirm deletion
  if (!confirm(`Are you sure you want to delete course "${course.course_name}"?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${course.course_id}`, {
      method: "DELETE",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    toast("Course deleted successfully!");
    // Redirect to course dashboard after successful deletion
    loadContent('course_dashboard.html');
  } catch (error) {
    console.error("Error deleting course:", error);
    toast(`Failed to delete course: ${error.message}`, "error");
  }
}

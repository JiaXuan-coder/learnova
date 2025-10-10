// js/comment.js - Comment page functionality

// Declare variables only if they don't exist (prevent redeclaration error)
if (typeof currentStudentIndex === 'undefined') {
  var currentStudentIndex = 0;
}
if (typeof students === 'undefined') {
  var students = [];
}
if (typeof currentLessonId === 'undefined') {
  var currentLessonId = null;
}
if (typeof currentClassroomId === 'undefined') {
  var currentClassroomId = null;
}

// -------- COMMENT PAGE INITIALIZATION --------
function initializeCommentPage() {
  console.log("initializeCommentPage called");
  
  // Get classroom context from session storage
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (selectedClassroom) {
    const classroom = JSON.parse(selectedClassroom);
    currentClassroomId = classroom.classroom_id;
    console.log("Current classroom:", classroom);
    console.log("Classroom assigned courses:", classroom.assigned_courses);
    
    // Load lessons for this classroom
    console.log("Loading lessons for classroom:", classroom.classroom_name);
    loadLessonsForComment(classroom.classroom_id);
    
    // Load students for this classroom
    console.log("Loading students for classroom:", classroom.classroom_name);
    loadStudentsForComment(classroom.classroom_id);
  } else {
    console.log("No classroom selected");
    toast("No classroom selected", "error");
  }
  
  // Setup event listeners
  setupCommentPageEventListeners();
  
  // Setup role-based visibility after everything is loaded
  setTimeout(() => {
    setupRoleBasedVisibility();
  }, 50);
}

function setupCommentPageEventListeners() {
  // Student navigation
  const prevBtn = document.getElementById('previous_student');
  const nextBtn = document.getElementById('next_student');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => switchStudent(-1));
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => switchStudent(1));
  }
  
  // Submit button
  const submitBtn = document.querySelector('.submit-button.teacher');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitComment);
  }
  
  // Lesson selection
  const lessonSelect = document.querySelector('select[name="classroom-lesson-filter"]');
  if (lessonSelect) {
    lessonSelect.addEventListener('change', (e) => {
      currentLessonId = e.target.value;
      loadCommentForCurrentStudent();
    });
  }
}

// -------- LESSON MANAGEMENT --------
async function loadLessonsForComment(classroomId) {
  console.log("loadLessonsForComment called with classroomId:", classroomId);
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    console.error("No access token found");
    toast("Please log in to view lessons", "error");
    return;
  }

  try {
    console.log("Loading lessons for classroom:", classroomId);
    // First, get the classroom details to find the assigned course
    const classroomRes = await fetch(`${API_BASE}/classrooms/${classroomId}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!classroomRes.ok) {
      throw new Error(`HTTP error! status: ${classroomRes.status}`);
    }

    const classroomData = await classroomRes.json();
    const classroom = classroomData.classroom;
    
    console.log("Classroom data:", classroom);

    // Get lessons for the assigned course(s)
    if (classroom.assigned_courses && classroom.assigned_courses.length > 0) {
      const allLessons = [];
      
      for (const assignedCourse of classroom.assigned_courses) {
        const courseId = assignedCourse.course.course_id;
        console.log("Fetching lessons for course:", courseId);
        
        const lessonsRes = await fetch(`${API_BASE}/lessons?course_id=${courseId}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (lessonsRes.ok) {
          const lessonsData = await lessonsRes.json();
          console.log("Lessons data for course", courseId, ":", lessonsData);
          if (lessonsData.lessons) {
            allLessons.push(...lessonsData.lessons);
            console.log("Added", lessonsData.lessons.length, "lessons from course", courseId);
          }
        } else {
          console.error("Failed to fetch lessons for course", courseId, "Status:", lessonsRes.status);
        }
      }
      
      console.log("All lessons for classroom:", allLessons);
      populateLessonDropdown(allLessons);
    } else {
      console.log("No courses assigned to classroom");
      populateLessonDropdown([]);
    }
  } catch (error) {
    console.error("Error fetching lessons for comment:", error);
    toast("Failed to fetch lessons", "error");
  }
}

function populateLessonDropdown(lessons) {
  console.log("populateLessonDropdown called with lessons:", lessons);
  const lessonSelect = document.querySelector('select[name="classroom-lesson-filter"]');
  if (!lessonSelect) {
    console.error("Lesson select element not found!");
    return;
  }

  console.log("Found lesson select element:", lessonSelect);
  lessonSelect.innerHTML = '';
  
  if (lessons.length === 0) {
    console.log("No lessons provided, showing 'No lessons available'");
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No lessons available';
    option.disabled = true;
    lessonSelect.appendChild(option);
    return;
  }
  
  console.log("Adding", lessons.length, "lessons to dropdown");
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a lesson...';
  lessonSelect.appendChild(defaultOption);
  
  lessons.forEach(lesson => {
    console.log("Adding lesson:", lesson.lesson_title, "with ID:", lesson.lesson_id);
    const option = document.createElement('option');
    option.value = lesson.lesson_id;
    option.textContent = lesson.lesson_title;
    lessonSelect.appendChild(option);
  });
  
  console.log("Lesson dropdown populated successfully");
}

// -------- STUDENT MANAGEMENT --------
async function loadStudentsForComment(classroomId) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to view students", "error");
    return;
  }

  try {
    // First, get the classroom details to find the assigned course
    const classroomRes = await fetch(`${API_BASE}/classrooms/${classroomId}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!classroomRes.ok) {
      throw new Error(`HTTP error! status: ${classroomRes.status}`);
    }

    const classroomData = await classroomRes.json();
    const classroom = classroomData.classroom;
    
    console.log("Classroom data for students:", classroom);

    // Get students enrolled in the classroom's course(s)
    if (classroom.assigned_courses && classroom.assigned_courses.length > 0) {
      const allStudents = [];
      
      for (const assignedCourse of classroom.assigned_courses) {
        const courseId = assignedCourse.course.course_id;
        console.log("Fetching students for course:", courseId);
        
        // Get enrollments for this course
        const enrollmentsRes = await fetch(`${API_BASE}/enrollments?course_id=${courseId}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (enrollmentsRes.ok) {
          const enrollmentsData = await enrollmentsRes.json();
          if (enrollmentsData.enrollments) {
            // Extract student data from enrollments
            for (const enrollment of enrollmentsData.enrollments) {
              const student = enrollment.Student;
              if (student) {
                // Avoid duplicates
                if (!allStudents.find(s => s.student_id === student.student_id)) {
                  allStudents.push({
                    student_id: student.student_id,
                    student_name: student.student_name,
                    student_email: student.student_email
                  });
                }
              }
            }
          }
        }
      }
      
      students = allStudents;
      console.log("Loaded students for classroom:", students);
      
      if (students.length > 0) {
        currentStudentIndex = 0;
        updateStudentDisplay();
      } else {
        console.log("No students found for this classroom");
        toast("No students enrolled in this classroom's courses", "info");
      }
    } else {
      console.log("No courses assigned to classroom");
      students = [];
      toast("No courses assigned to this classroom", "info");
    }
  } catch (error) {
    console.error("Error fetching students for comment:", error);
    toast("Failed to fetch students", "error");
  }
}

function switchStudent(direction) {
  if (students.length === 0) return;
  
  currentStudentIndex += direction;
  
  // Wrap around
  if (currentStudentIndex < 0) {
    currentStudentIndex = students.length - 1;
  } else if (currentStudentIndex >= students.length) {
    currentStudentIndex = 0;
  }
  
  updateStudentDisplay();
  loadCommentForCurrentStudent();
}

function updateStudentDisplay() {
  const studentNameSpan = document.getElementById('comment_student_name');
  if (!studentNameSpan) return;
  
  if (students.length === 0) {
    studentNameSpan.textContent = 'No students found';
    return;
  }
  
  if (students[currentStudentIndex]) {
    studentNameSpan.textContent = students[currentStudentIndex].student_name;
  } else {
    studentNameSpan.textContent = 'Student not found';
  }
}

// -------- COMMENT MANAGEMENT --------
async function loadCommentForCurrentStudent() {
  if (!currentLessonId || !students[currentStudentIndex]) return;
  
  const token = sessionStorage.getItem("access_token");
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/comments?student_id=${students[currentStudentIndex].student_id}&lesson_id=${currentLessonId}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const comment = data.comment;
      
      // Update comment textarea
      const commentTextarea = document.getElementById('lesson_comment');
      if (commentTextarea) {
        commentTextarea.value = comment?.comment_text || '';
      }
      
      // Update grade
      const gradeSelect = document.querySelector('select[name="lesson_grade_input"]');
      const gradeView = document.getElementById('lesson_grade_view');
      
      if (gradeSelect) {
        gradeSelect.value = comment?.grade || 'pass';
      }
      
      if (gradeView) {
        gradeView.textContent = comment?.grade || 'Not graded';
      }
    }
  } catch (error) {
    console.error("Error loading comment:", error);
  }
}

async function submitComment() {
  if (!currentLessonId || !students[currentStudentIndex]) {
    toast("Please select a lesson and student", "error");
    return;
  }

  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to submit comments", "error");
    return;
  }

  const commentText = document.getElementById('lesson_comment')?.value?.trim();
  const gradeSelect = document.querySelector('select[name="lesson_grade_input"]');
  const grade = gradeSelect ? gradeSelect.value : 'pass';

  if (!commentText) {
    toast("Please enter a comment", "error");
    return;
  }

  try {
    const commentData = {
      student_id: students[currentStudentIndex].student_id,
      lesson_id: currentLessonId,
      comment_text: commentText,
      grade: grade
    };

    const res = await fetch(`${API_BASE}/comments`, {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commentData)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    toast("Comment submitted successfully!");
  } catch (error) {
    console.error("Error submitting comment:", error);
    toast(`Failed to submit comment: ${error.message}`, "error");
  }
}

// -------- ROLE-BASED VISIBILITY --------
function setupRoleBasedVisibility() {
  console.log("setupRoleBasedVisibility called");
  
  // Try multiple times to ensure DOM is ready
  const maxAttempts = 5;
  let attempts = 0;
  
  const trySetup = () => {
    attempts++;
    console.log(`setupRoleBasedVisibility attempt ${attempts}`);
    
    const userData = sessionStorage.getItem("user_data");
    if (!userData) {
      console.log("No user data found, trying alternative methods");
      // Try to get user data from other sources
      const accessToken = sessionStorage.getItem("access_token");
      if (accessToken) {
        console.log("Found access token, assuming teacher role for comment page");
        // For comment page, if we have access token, assume teacher
        const isTeacher = true;
        const isStudent = false;
        
        console.log("Using fallback: isTeacher:", isTeacher, "isStudent:", isStudent);
        
        // Apply role-based visibility with fallback
        applyRoleBasedVisibility(isTeacher, isStudent);
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(trySetup, 100);
      }
      return;
    }
    
    const user = JSON.parse(userData);
    const isTeacher = user.user?.role === 'teacher';
    const isStudent = user.user?.role === 'student';
    
    console.log("User role:", user.user?.role, "isTeacher:", isTeacher, "isStudent:", isStudent);
    
    // Apply role-based visibility
    applyRoleBasedVisibility(isTeacher, isStudent);
    
    console.log("setupRoleBasedVisibility completed successfully");
  };
  
  trySetup();
}

function applyRoleBasedVisibility(isTeacher, isStudent) {
  console.log("applyRoleBasedVisibility called with isTeacher:", isTeacher, "isStudent:", isStudent);
  
  // Show/hide teacher elements
  const teacherElements = document.querySelectorAll('.teacher');
  console.log("Found", teacherElements.length, "teacher elements");
  teacherElements.forEach(el => {
    el.style.display = isTeacher ? 'block' : 'none';
    console.log("Teacher element:", el.className, "display:", el.style.display);
  });
  
  // Show/hide student elements (but exclude grade view which is handled separately)
  const studentElements = document.querySelectorAll('.student:not(#lesson_grade_view)');
  console.log("Found", studentElements.length, "student elements");
  studentElements.forEach(el => {
    el.style.display = isStudent ? 'block' : 'none';
    console.log("Student element:", el.className, "display:", el.style.display);
  });
  
  // Make comment textarea editable for teachers, read-only for students
  const commentTextarea = document.getElementById('lesson_comment');
  if (commentTextarea) {
    commentTextarea.readOnly = isStudent;
    commentTextarea.style.backgroundColor = isStudent ? '#f5f5f5' : 'white';
    console.log("Comment textarea readOnly:", commentTextarea.readOnly);
  } else {
    console.log("Comment textarea not found");
  }
  
  // Show grade input for teachers, grade view for students
  const gradeSelect = document.querySelector('select[name="lesson_grade_input"]');
  const gradeView = document.getElementById('lesson_grade_view');
  
  if (gradeSelect) {
    gradeSelect.style.display = isTeacher ? 'block' : 'none';
    console.log("Grade select display:", gradeSelect.style.display);
  } else {
    console.log("Grade select not found");
  }
  
  if (gradeView) {
    gradeView.style.display = isStudent ? 'block' : 'none';
    console.log("Grade view display:", gradeView.style.display);
  } else {
    console.log("Grade view not found");
  }
  
  // Show/hide submit button
  const submitBtn = document.querySelector('.submit-button.teacher');
  if (submitBtn) {
    submitBtn.style.display = isTeacher ? 'block' : 'none';
    console.log("Submit button display:", submitBtn.style.display);
  } else {
    console.log("Submit button not found");
  }
  
  console.log("applyRoleBasedVisibility completed");
}

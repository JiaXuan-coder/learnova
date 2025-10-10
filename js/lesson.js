// js/lesson.js - Lesson management functionality

// -------- LESSON MANAGEMENT --------
window.fetchLessons = async function fetchLessons(courseId = null) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to view lessons", "error");
    return;
  }

  try {
    // Use Edge Function to get lessons
    let url = `${API_BASE}/lessons`;
    if (courseId) {
      url += `?course_id=${courseId}`;
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
    await renderLessons(data.lessons);
  } catch (error) {
    console.error("Error fetching lessons:", error);
    toast("Failed to fetch lessons", "error");
  }
}

async function renderLessons(lessons) {
  const container = document.getElementById("lesson-container");
  if (!container) return;

  container.innerHTML = "";

  for (const lesson of lessons) {
    const box = document.createElement("div");
    box.className = "lesson-box lesson-box-with-status";
    box.style.cursor = "pointer";

    // Header (lesson title) row
    const header = document.createElement("div");
    header.className = "lesson-header";
    header.innerHTML = `<span>Title: ${lesson.lesson_title}</span>`;

    // Course row
    const course = document.createElement("div");
    course.className = "lesson-course";
    course.textContent = `Course: ${lesson.course?.course_name || 'None'}`;

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
    box.appendChild(course);
    box.appendChild(week);
    box.appendChild(lessonId);

    // Add status badge for teachers (check if user is teacher)
    await addStatusBadgeToLesson(box, lesson);

    // Add click handler to navigate to lesson detail view
    box.addEventListener("click", () => {
      onLessonClick(lesson);
    });

    container.appendChild(box);
  }
}

// Function to add status badge to lesson for teachers
async function addStatusBadgeToLesson(lessonBox, lesson) {
  console.log("addStatusBadgeToLesson called with lesson:", lesson);
  
  // Check if user is a teacher
  const userData = await fetchMe();
  console.log("User data for lesson:", userData);
  
  if (!userData || userData.user.role !== 'teacher') {
    console.log("User is not a teacher, not adding lesson badge");
    return; // Don't show status for students
  }

  console.log("User is a teacher, checking lesson status:", lesson.status);

  // Only show badge if status is not 'published' (default)
  if (lesson.status && lesson.status !== 'published') {
    console.log("Adding lesson status badge for:", lesson.status);
    
    const statusIndicator = document.createElement("div");
    statusIndicator.className = "lesson-status-indicator";
    
    const statusBadge = document.createElement("span");
    statusBadge.className = `status-badge status-${lesson.status}`;
    statusBadge.textContent = lesson.status;
    
    console.log("Created lesson badge element:", statusBadge);
    console.log("Lesson badge classes:", statusBadge.className);
    
    statusIndicator.appendChild(statusBadge);
    lessonBox.appendChild(statusIndicator);
    
    console.log("Lesson badge added to lesson box");
  } else {
    console.log("Lesson is published or has no status, no badge needed");
  }
}

function onLessonClick(lesson) {
  // Store lesson data for the lesson view
  sessionStorage.setItem("selected_lesson", JSON.stringify(lesson));
  
  // Preserve classroom context if we're coming from a classroom
  const selectedClassroom = sessionStorage.getItem("selected_classroom");
  if (selectedClassroom) {
    sessionStorage.setItem("previous_classroom", selectedClassroom);
    console.log("Preserved classroom context:", selectedClassroom);
  }
  
  loadContent('lesson_view.html');
}

// -------- READING LIST FUNCTIONALITY --------
function addReadingListToLesson() {
  const title = document.getElementById('reading-list-title-input')?.value?.trim();
  const content = document.getElementById('reading-list-content-input')?.value?.trim();
  
  if (!title || !content) {
    toast("Please fill in both title and content for the reading list", "error");
    return;
  }
  
  // Create reading list item
  const readingListItem = {
    title: title,
    content: content,
    timestamp: new Date().toISOString()
  };
  
  // Add to display container
  const container = document.getElementById('addable-reading-list-container');
  if (container) {
    const readingListElement = document.createElement('div');
    readingListElement.className = 'reading-list-item';
    readingListElement.innerHTML = `
      <div class="reading-list-title">
        <strong>${title}</strong>
        <button onclick="removeReadingListItem(this)" class="remove-btn" style="float: right; background: #ff4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">×</button>
      </div>
      <div class="reading-list-content">${content}</div>
    `;
    container.appendChild(readingListElement);
  }
  
  // Clear the form
  document.getElementById('reading-list-title-input').value = '';
  document.getElementById('reading-list-content-input').value = '';
  
  // Close the modal
  document.getElementById('popupreadinglist').style.display = 'none';
  
  toast("Reading list item added successfully!");
}

function removeReadingListItem(button) {
  const readingListItem = button.closest('.reading-list-item');
  if (readingListItem) {
    readingListItem.remove();
    toast("Reading list item removed");
  }
}

// -------- ASSIGNMENT FUNCTIONALITY --------
function addAssignmentToLesson() {
  const title = document.getElementById('assignment-title-input')?.value?.trim();
  const content = document.getElementById('assignment-content-input')?.value?.trim();
  
  if (!title || !content) {
    toast("Please fill in both title and content for the assignment", "error");
    return;
  }
  
  // Create assignment item
  const assignmentItem = {
    title: title,
    content: content,
    timestamp: new Date().toISOString()
  };
  
  // Add to display container
  const container = document.getElementById('addable-assignment-container');
  if (container) {
    const assignmentElement = document.createElement('div');
    assignmentElement.className = 'assignment-item';
    assignmentElement.innerHTML = `
      <div class="assignment-title">
        <strong>${title}</strong>
        <button onclick="removeAssignmentItem(this)" class="remove-btn" style="float: right; background: #ff4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">×</button>
      </div>
      <div class="assignment-content">${content}</div>
    `;
    container.appendChild(assignmentElement);
  }
  
  // Clear the form
  document.getElementById('assignment-title-input').value = '';
  document.getElementById('assignment-content-input').value = '';
  
  // Close the modal
  document.getElementById('popupassignment').style.display = 'none';
  
  toast("Assignment added successfully!");
}

function removeAssignmentItem(button) {
  const assignmentItem = button.closest('.assignment-item');
  if (assignmentItem) {
    assignmentItem.remove();
    toast("Assignment removed");
  }
}

// -------- LESSON CREATION --------
window.createLesson = async function createLesson(lessonData) {
  console.log("createLesson called with data:", lessonData);
  
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    console.log("No access token found");
    toast("Please log in to create lessons", "error");
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/lessons`, {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(lessonData)
    });

    console.log("Response status:", res.status);

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Error response:", errorData);
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    console.log("Success response:", data);
    const statusMessage = lessonData.status === 'draft' ? 'Lesson saved as draft!' : 
                         lessonData.status === 'archived' ? 'Lesson archived!' : 
                         'Lesson published successfully!';
    toast(statusMessage);
    return data.lesson;
  } catch (error) {
    console.error("Error creating lesson:", error);
    toast(`Failed to create lesson: ${error.message}`, "error");
    return false;
  }
}

window.setupLessonForm = function setupLessonForm() {
  console.log("setupLessonForm called");
  
  const publishBtn = document.querySelector('.publish.btn');
  const saveDraftBtn = document.querySelector('.savedraft.btn');
  const archiveBtn = document.querySelector('.archive.btn');

  console.log("Found buttons:", {
    publishBtn: !!publishBtn,
    saveDraftBtn: !!saveDraftBtn,
    archiveBtn: !!archiveBtn
  });

  if (publishBtn) {
    publishBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log("Publish button clicked");
      await handleLessonSubmit('published');
    });
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log("Save draft button clicked");
      await handleLessonSubmit('draft');
    });
  }

  if (archiveBtn) {
    archiveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log("Archive button clicked");
      await handleLessonSubmit('archived');
    });
  }

  // Load existing lessons for prerequisite dropdown
  loadLessonsForPrerequisiteForm();
}

async function loadLessonsForPrerequisiteForm() {
  const token = sessionStorage.getItem("access_token");
  if (!token) return;

  try {
    // Fetch all lessons from all courses
    const res = await fetch(`${API_BASE}/lessons`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    const lessons = data.lessons;
    
    const prerequisiteSelect = document.getElementById('prerequisite-lessons');
    if (prerequisiteSelect) {
      // Clear existing options except the first one
      prerequisiteSelect.innerHTML = '<option value="">No prerequisites</option>';
      
      // Add all lessons with their titles
      lessons.forEach(lesson => {
        const option = document.createElement('option');
        option.value = lesson.lesson_title;
        option.textContent = lesson.lesson_title; // Show lesson title only
        prerequisiteSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error loading lessons for prerequisite form:", error);
  }
}

async function handleLessonSubmit(status) {
  console.log("handleLessonSubmit called with status:", status);
  
  const lessonTitle = document.getElementById('lesson-name-input')?.value?.trim();
  const lessonId = document.getElementById('lesson-id-input')?.value?.trim();
  const lessonOutcome = document.getElementById('lesson-outcome-input')?.value?.trim();
  const lessonDescription = document.getElementById('description-input')?.value?.trim();
  const weekNumberSelect = document.getElementById('week-number-select');
  const weekNumber = weekNumberSelect ? parseInt(weekNumberSelect.value) : 1;
  
  // Get course context from session storage
  const courseContext = sessionStorage.getItem('lesson_course_context');
  let courseId = null;
  if (courseContext) {
    const course = JSON.parse(courseContext);
    courseId = course.course_id;
  }
  
  // Get credit and effort values
  const lessonCreditSelect = document.getElementById('lesson-credit');
  const lessonCredit = lessonCreditSelect ? parseInt(lessonCreditSelect.value) : 1;
  const estimatedEffortSelect = document.getElementById('lesson-estimated-effort');
  const estimatedEffort = estimatedEffortSelect ? parseInt(estimatedEffortSelect.value) : 1;
  
  // Get prerequisite lessons
  const prerequisiteSelect = document.getElementById('prerequisite-lessons');
  const prerequisiteLessons = prerequisiteSelect ? prerequisiteSelect.value : '';

  // Get reading list content from container
  const readingListContainer = document.getElementById('addable-reading-list-container');
  let readingList = 'Reading materials will be provided for this lesson.';
  if (readingListContainer && readingListContainer.children.length > 0) {
    const readingListItems = Array.from(readingListContainer.children).map(item => {
      const title = item.querySelector('.reading-list-title strong')?.textContent || '';
      const content = item.querySelector('.reading-list-content')?.textContent || '';
      return `${title}: ${content}`;
    }).join('\n\n');
    readingList = readingListItems;
  }

  // Get assignment content from container
  const assignmentContainer = document.getElementById('addable-assignment-container');
  let assignment = 'Assignment details will be provided for this lesson.';
  if (assignmentContainer && assignmentContainer.children.length > 0) {
    const assignmentItems = Array.from(assignmentContainer.children).map(item => {
      const title = item.querySelector('.assignment-title strong')?.textContent || '';
      const content = item.querySelector('.assignment-content')?.textContent || '';
      return `${title}: ${content}`;
    }).join('\n\n');
    assignment = assignmentItems;
  }

  console.log("Form data:", {
    lessonTitle,
    lessonId,
    lessonOutcome,
    lessonDescription,
    weekNumber,
    courseId,
    readingList,
    assignment
  });

  if (!lessonTitle) {
    toast("Lesson title is required", "error");
    return;
  }

  if (!lessonId) {
    toast("Lesson ID is required", "error");
    return;
  }

  // Course context is optional for lesson creation (lessons can be created standalone)
  // If no course context, create lesson without course assignment

  const lessonData = {
    lesson_title: lessonTitle,
    display_id: lessonId,
    lesson_outcome: lessonOutcome,
    lesson_description: lessonDescription,
    lesson_content: lessonOutcome, // Keep for backward compatibility
    reading_list: readingList,
    assignment: assignment,
    week_number: weekNumber,
    course_id: courseId,
    lesson_credit: lessonCredit,
    estimated_effort: estimatedEffort,
    prerequisite_lessons: prerequisiteLessons || 'No prerequisites required.',
    status: status
  };

  console.log("Submitting lesson data:", lessonData);
  const result = await createLesson(lessonData);
  console.log("Lesson creation result:", result);
  
  if (result) {
    // Clear the course context if it exists
    sessionStorage.removeItem('lesson_course_context');
    
    // Redirect based on context
    if (courseId) {
      // If lesson was created with course context, go back to course view
      loadContent('course_view.html');
    } else {
      // If lesson was created standalone, go to lesson dashboard
      loadContent('lesson_dashboard.html');
    }
  }
}

// -------- LESSON VIEW INITIALIZATION --------
function initializeLessonViewFromMain() {
  console.log("initializeLessonViewFromMain called");
  const selectedLesson = sessionStorage.getItem("selected_lesson");
  console.log("Selected lesson from session storage:", selectedLesson);
  
  if (selectedLesson) {
    const lesson = JSON.parse(selectedLesson);
    console.log("Parsed lesson:", lesson);
    displayLessonDetailsFromMain(lesson);
  } else {
    console.log("No lesson selected in session storage");
    const infoElement = document.getElementById("lesson-info-content");
    if (infoElement) {
      infoElement.innerHTML = "<p>No lesson selected. Please go back to the lesson dashboard.</p>";
    } else {
      console.error("Element #lesson-info-content not found");
    }
  }
}

function displayLessonDetailsFromMain(lesson) {
  console.log("displayLessonDetailsFromMain called with lesson:", lesson);
  
  // Update lesson title
  const titleElement = document.getElementById("lesson-title");
  if (titleElement) {
    titleElement.textContent = lesson.lesson_title || "Lesson Details";
  }
  
  // Update lesson info (ID, name, credit, effort)
  const idElement = document.getElementById("lesson-id");
  const nameElement = document.getElementById("lesson-name");
  const creditElement = document.getElementById("lesson-credit-point");
  const effortElement = document.getElementById("lesson-estimated-effort");
  
  if (idElement) {
    idElement.textContent = lesson.display_id || lesson.lesson_id || 'N/A';
  }
  if (nameElement) {
    nameElement.textContent = lesson.lesson_title || 'N/A';
  }
  if (creditElement) {
    creditElement.textContent = lesson.lesson_credit || 'N/A';
  }
  if (effortElement) {
    effortElement.textContent = lesson.estimated_effort || 'N/A';
  }
  
  // Update lesson outcome
  const outcomeElement = document.getElementById("lesson-outcome");
  if (outcomeElement) {
    outcomeElement.textContent = lesson.lesson_outcome || 'Learning outcomes will be defined for this lesson.';
  }
  
  // Update lesson description
  const descriptionElement = document.getElementById("lesson-description");
  if (descriptionElement) {
    descriptionElement.textContent = lesson.lesson_description || lesson.lesson_content || 'No description available for this lesson.';
  }
  
  // Update prerequisite
  const prerequisiteElement = document.getElementById("lesson-prerequisite");
  if (prerequisiteElement) {
    prerequisiteElement.textContent = lesson.prerequisite_lessons || 'No prerequisites required.';
  }
  
  // Update reading list
  const readingListContainer = document.getElementById("lesson-reading-display");
  if (readingListContainer) {
    if (lesson.reading_list && lesson.reading_list !== 'Reading materials will be provided for this lesson.') {
      // Parse reading list items and display them properly
      const readingListItems = lesson.reading_list.split('\n\n').map(item => {
        const [title, ...contentParts] = item.split(': ');
        const content = contentParts.join(': ');
        return `
          <div class="reading-list-item-display" style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            <div class="reading-list-title-display" style="font-weight: bold; margin-bottom: 5px;">${title}</div>
            <div class="reading-list-content-display">${content}</div>
          </div>
        `;
      }).join('');
      
      readingListContainer.innerHTML = `
        <div class="lesson-content-text">
          ${readingListItems}
        </div>
      `;
    } else {
      readingListContainer.innerHTML = `
        <div class="lesson-content-text">
          Reading materials will be provided for this lesson.
        </div>
      `;
    }
  }
  
  // Update assignment
  const assignmentContainer = document.getElementById("lesson-assignment-display");
  if (assignmentContainer) {
    if (lesson.assignment && lesson.assignment !== 'Assignment details will be provided for this lesson.') {
      // Parse assignment items and display them properly
      const assignmentItems = lesson.assignment.split('\n\n').map(item => {
        const [title, ...contentParts] = item.split(': ');
        const content = contentParts.join(': ');
        return `
          <div class="assignment-item-display" style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            <div class="assignment-title-display" style="font-weight: bold; margin-bottom: 5px;">${title}</div>
            <div class="assignment-content-display">${content}</div>
          </div>
        `;
      }).join('');
      
      assignmentContainer.innerHTML = `
        <div class="lesson-content-text">
          ${assignmentItems}
        </div>
      `;
    } else {
      assignmentContainer.innerHTML = `
        <div class="lesson-content-text">
          Assignment details will be provided for this lesson.
        </div>
      `;
    }
  }
}

// -------- EDIT FUNCTIONALITY FOR LESSONS --------
function makeLessonEditable(box, lesson) {
  const header = box.querySelector('.lesson-header');
  const week = box.querySelector('.lesson-week');

  // Make lesson title editable
  const titleSpan = header.querySelector('span');
  if (titleSpan) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = lesson.lesson_title;
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 5px';
    input.style.borderRadius = '3px';
    input.style.width = '200px';
    input.dataset.field = 'lesson_title';
    titleSpan.innerHTML = '';
    titleSpan.appendChild(input);
  }

  // Make week number editable
  const weekText = week.textContent.replace('Week: ', '');
  const weekInput = document.createElement('input');
  weekInput.type = 'number';
  weekInput.value = weekText;
  weekInput.min = '1';
  weekInput.max = '52';
  weekInput.style.border = '1px solid #ccc';
  weekInput.style.padding = '2px 5px';
  weekInput.style.borderRadius = '3px';
  weekInput.style.width = '60px';
  weekInput.dataset.field = 'week_number';
  week.innerHTML = '';
  week.appendChild(weekInput);
}

function makeLessonReadOnly(box, originalValues) {
  const header = box.querySelector('.lesson-header');
  const week = box.querySelector('.lesson-week');

  // Restore original display
  header.innerHTML = `<span>Title: ${originalValues.lesson_title}</span>`;
  week.textContent = `Week: ${originalValues.week_number || 'N/A'}`;
}

async function saveLessonChanges(lesson, box) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to save changes", "error");
    return;
  }

  // Get updated values from inputs
  const lessonTitleInput = box.querySelector('input[data-field="lesson_title"]');
  const weekNumberInput = box.querySelector('input[data-field="week_number"]');

  const updatedData = {
    lesson_title: lessonTitleInput ? lessonTitleInput.value.trim() : lesson.lesson_title,
    week_number: weekNumberInput ? parseInt(weekNumberInput.value) || 1 : lesson.week_number
  };

  // Check if anything actually changed
  const hasChanges = 
    updatedData.lesson_title !== lesson.lesson_title ||
    updatedData.week_number !== lesson.week_number;

  if (!hasChanges) {
    toast("No changes to save");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/lessons/${lesson.lesson_id}`, {
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

    toast("Lesson updated successfully!");
    // Refresh the lessons list
    fetchLessons();
  } catch (error) {
    console.error("Error updating lesson:", error);
    toast(`Failed to update lesson: ${error.message}`, "error");
  }
}

async function deleteLesson(lesson) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to delete lessons", "error");
    return;
  }

  // Confirm deletion
  if (!confirm(`Are you sure you want to delete lesson "${lesson.lesson_title}"?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/lessons/${lesson.lesson_id}`, {
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

    toast("Lesson deleted successfully!");
    // Refresh the lessons list
    fetchLessons();
  } catch (error) {
    console.error("Error deleting lesson:", error);
    toast(`Failed to delete lesson: ${error.message}`, "error");
  }
}

// -------- EDIT SETUP FUNCTIONS FOR MAIN SCRIPT --------
function setupLessonEditFromMain() {
  console.log('Setting up lesson edit from main script');
  const editToggle = document.getElementById('lesson-edit-toggle');
  const editControls = document.getElementById('lesson-edit-controls');
  const saveBtn = document.getElementById('lesson-save-btn');
  const deleteBtn = document.getElementById('lesson-delete-btn');

  console.log('Lesson edit elements found:', {
    editToggle: !!editToggle,
    editControls: !!editControls,
    saveBtn: !!saveBtn,
    deleteBtn: !!deleteBtn
  });

  if (!editToggle || !editControls || !saveBtn || !deleteBtn) {
    console.error('Could not find all required lesson edit elements');
    return;
  }

  // Get lesson data from session storage
  const selectedLesson = sessionStorage.getItem("selected_lesson");
  if (!selectedLesson) {
    console.error('No lesson selected in session storage');
    return;
  }

  const lesson = JSON.parse(selectedLesson);
  let isEditing = false;
  let originalValues = {
    display_id: lesson.display_id || lesson.lesson_id,
    lesson_title: lesson.lesson_title,
    lesson_credit: lesson.lesson_credit,
    estimated_effort: lesson.estimated_effort,
    lesson_description: lesson.lesson_description || lesson.lesson_content,
    lesson_outcome: lesson.lesson_outcome,
    reading_list: lesson.reading_list,
    assignment: lesson.assignment,
    week_number: lesson.week_number
  };

  editToggle.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Lesson edit toggle clicked, isEditing:', isEditing);
    if (!isEditing) {
      // Enter edit mode
      isEditing = true;
      editToggle.style.display = 'none';
      editControls.style.display = 'block';
      makeLessonViewEditableFromMain(lesson);
    } else {
      // Cancel edit mode
      isEditing = false;
      editToggle.style.display = 'block';
      editControls.style.display = 'none';
      makeLessonViewReadOnlyFromMain(originalValues);
    }
  });

  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('Lesson save button clicked');
    await saveLessonViewChangesFromMain(lesson);
    isEditing = false;
    editToggle.style.display = 'block';
    editControls.style.display = 'none';
    makeLessonViewReadOnlyFromMain(originalValues);
  });

  deleteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('Lesson delete button clicked');
    await deleteLessonFromViewFromMain(lesson);
  });

  // Add cancel button functionality
  const cancelBtn = document.getElementById('lesson-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Lesson cancel button clicked');
      isEditing = false;
      editToggle.style.display = 'block';
      editControls.style.display = 'none';
      makeLessonViewReadOnlyFromMain(originalValues);
    });
  }
}

// -------- LESSON EDIT HELPER FUNCTIONS --------
function makeLessonViewEditableFromMain(lesson) {
  console.log('Making lesson view editable');
  
  // Make lesson ID editable
  const idElement = document.getElementById("lesson-id");
  if (idElement) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = lesson.display_id || lesson.lesson_id || '';
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 5px';
    input.style.borderRadius = '3px';
    input.style.width = '150px';
    input.id = 'lesson-id-input';
    idElement.innerHTML = '';
    idElement.appendChild(input);
  }
  
  // Make lesson name editable
  const nameElement = document.getElementById("lesson-name");
  if (nameElement) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = lesson.lesson_title || '';
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 5px';
    input.style.borderRadius = '3px';
    input.style.width = '200px';
    input.id = 'lesson-name-input';
    nameElement.innerHTML = '';
    nameElement.appendChild(input);
  }
  
  // Make lesson credit points editable
  const creditElement = document.getElementById("lesson-credit-point");
  if (creditElement) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = lesson.lesson_credit || 0;
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 5px';
    input.style.borderRadius = '3px';
    input.style.width = '80px';
    input.id = 'lesson-credit-input';
    creditElement.innerHTML = '';
    creditElement.appendChild(input);
  }
  
  // Make lesson estimated hours editable
  const effortElement = document.getElementById("lesson-estimated-effort");
  if (effortElement) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = lesson.estimated_effort || 0;
    input.style.border = '1px solid #ccc';
    input.style.padding = '2px 5px';
    input.style.borderRadius = '3px';
    input.style.width = '80px';
    input.id = 'lesson-effort-input';
    effortElement.innerHTML = '';
    effortElement.appendChild(input);
  }
  
  // Make lesson outcome editable
  const outcomeElement = document.getElementById("lesson-outcome");
  if (outcomeElement) {
    const textarea = document.createElement('textarea');
    textarea.value = lesson.lesson_outcome || '';
    textarea.style.border = '1px solid #ccc';
    textarea.style.padding = '5px';
    textarea.style.borderRadius = '3px';
    textarea.style.width = '100%';
    textarea.style.height = '80px';
    textarea.style.resize = 'vertical';
    textarea.id = 'lesson-outcome-input';
    outcomeElement.innerHTML = '';
    outcomeElement.appendChild(textarea);
  }
  
  // Make lesson description editable
  const descriptionElement = document.getElementById("lesson-description");
  if (descriptionElement) {
    const textarea = document.createElement('textarea');
    textarea.value = lesson.lesson_description || lesson.lesson_content || '';
    textarea.style.border = '1px solid #ccc';
    textarea.style.padding = '5px';
    textarea.style.borderRadius = '3px';
    textarea.style.width = '100%';
    textarea.style.height = '80px';
    textarea.style.resize = 'vertical';
    textarea.id = 'lesson-description-input';
    descriptionElement.innerHTML = '';
    descriptionElement.appendChild(textarea);
  }
}

function makeLessonViewReadOnlyFromMain(originalValues) {
  console.log('Making lesson view read-only');
  
  // Get the lesson data from session storage to restore the full display
  const selectedLesson = sessionStorage.getItem("selected_lesson");
  if (selectedLesson) {
    const lesson = JSON.parse(selectedLesson);
    displayLessonDetailsFromMain(lesson);
  }
}

async function saveLessonViewChangesFromMain(lesson) {
  console.log('Saving lesson view changes');
  
  const idInput = document.getElementById('lesson-id-input');
  const nameInput = document.getElementById('lesson-name-input');
  const creditInput = document.getElementById('lesson-credit-input');
  const effortInput = document.getElementById('lesson-effort-input');
  const outcomeInput = document.getElementById('lesson-outcome-input');
  const descriptionInput = document.getElementById('lesson-description-input');
  
  // Collect updated values from form fields
  const updatedData = {
    display_id: idInput ? idInput.value.trim() : lesson.display_id,
    lesson_title: nameInput ? nameInput.value.trim() : lesson.lesson_title,
    lesson_credit: creditInput ? parseInt(creditInput.value) || 0 : lesson.lesson_credit,
    estimated_effort: effortInput ? parseInt(effortInput.value) || 0 : lesson.estimated_effort,
    lesson_outcome: outcomeInput ? outcomeInput.value.trim() : lesson.lesson_outcome,
    lesson_description: descriptionInput ? descriptionInput.value.trim() : lesson.lesson_description
  };
  
  // Check if anything actually changed
  const hasChanges = 
    updatedData.display_id !== (lesson.display_id || lesson.lesson_id) ||
    updatedData.lesson_title !== lesson.lesson_title ||
    updatedData.lesson_credit !== lesson.lesson_credit ||
    updatedData.estimated_effort !== lesson.estimated_effort ||
    updatedData.lesson_outcome !== lesson.lesson_outcome ||
    updatedData.lesson_description !== lesson.lesson_description;

  if (!hasChanges) {
    toast("No changes to save");
    return;
  }
  
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to update lessons", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/lessons/${lesson.lesson_id}`, {
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

    toast("Lesson updated successfully!");
    
    // Update the lesson in session storage with new data
    const updatedLesson = { ...lesson, ...updatedData };
    sessionStorage.setItem("selected_lesson", JSON.stringify(updatedLesson));
    
  } catch (error) {
    console.error("Error updating lesson:", error);
    toast(`Failed to update lesson: ${error.message}`, "error");
  }
}

async function deleteLessonFromViewFromMain(lesson) {
  const token = sessionStorage.getItem("access_token");
  if (!token) {
    toast("Please log in to delete lessons", "error");
    return;
  }

  // Confirm deletion
  if (!confirm(`Are you sure you want to delete lesson "${lesson.lesson_title}"?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/lessons/${lesson.lesson_id}`, {
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

    toast("Lesson deleted successfully!");
    // Redirect to lesson dashboard after successful deletion of lesson
    loadContent('lesson_dashboard.html');
  } catch (error) {
    console.error("Error deleting lesson:", error);
    toast(`Failed to delete lesson: ${error.message}`, "error");
  }
}

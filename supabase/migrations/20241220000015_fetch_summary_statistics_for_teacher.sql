-- Get total number of students the teacher teaches
SELECT COUNT(DISTINCT e.student_id) AS total_student_number
FROM Enrollment e
JOIN Course c ON e.course_id = c.course_id
WHERE c.teacher_id = auth.uid();



-- Full retrieval of lesson summary statistics --
SELECT 
    COUNT(DISTINCT lesson_id) AS total_lessons_created,
    COUNT(DISTINCT lesson_id) FILTER (WHERE l.status = 'published'::lesson_status) AS total_lessons_published,
    COUNT(DISTINCT lesson_id) FILTER (WHERE l.status = 'draft'::lesson_status) AS total_lessons_draft,
    COUNT(DISTINCT lesson_id) FILTER (WHERE l.status = 'archived'::lesson_status) AS total_lessons_archived,
    ROUND(AVG(lesson_credit), 2) AS average_lessons_credit
FROM Lesson l
WHERE l.teacher_id = auth.uid();

-- Get total number of lessons created
SELECT COUNT(DISTINCT lesson_id) AS total_lessons_created
FROM Lesson l
WHERE l.teacher_id = auth.uid();

-- Get total number of lessons published
SELECT COUNT(DISTINCT lesson_id) AS total_lessons_published
FROM Lesson l
WHERE l.teacher_id = auth.uid()
      AND l.status = 'published'::lesson_status;

-- Get total number of lessons draft
SELECT COUNT(DISTINCT lesson_id) AS total_lessons_draft
FROM Lesson l
WHERE l.teacher_id = auth.uid()
      AND l.status = 'draft'::lesson_status;

-- Get total number of lessons archive
SELECT COUNT(DISTINCT lesson_id) AS total_lessons_archived
FROM Lesson l
WHERE l.teacher_id = auth.uid()
      AND l.status = 'archived'::lesson_status;

-- Get average credit number of lessons
SELECT ROUND(AVG(lesson_credit), 2) AS average_lessons_credit
FROM Lesson l
WHERE l.teacher_id = auth.uid();



-- Full retrieval of classroom summary statistics --
SELECT
    COUNT(DISTINCT cl.classroom_id) AS total_classrooms_created,
    COUNT(DISTINCT cl.classroom_id) FILTER (WHERE (cl.start_date + (cl.duration || ' weeks')::interval) > NOW()) AS total_active_classrooms,
    COUNT(DISTINCT cl.classroom_id) FILTER (WHERE (cl.start_date + (cl.duration || ' weeks')::interval) < NOW()) AS total_completed_classrooms,
    COALESCE(
        ROUND(
            COUNT(DISTINCT a.enrollment_id)::numeric 
            / NULLIF(COUNT(DISTINCT cl.classroom_id), 0),
            2
        ),
        0
    ) AS average_students_per_classroom
FROM Classroom cl
LEFT JOIN Attendence a ON cl.classroom_id = a.classroom_id
WHERE cl.created_by_teacher = auth.uid();

-- Get total number of classrooms created
SELECT COUNT(DISTINCT classroom_id) AS total_classrooms_created
FROM Classroom cl
WHERE cl.created_by_teacher = auth.uid();

-- Get total number of classrooms active
SELECT COUNT(DISTINCT cl.classroom_id) AS total_active_classrooms
FROM Classroom cl
WHERE cl.created_by_teacher = auth.uid()
  AND (cl.start_date + (cl.duration || ' weeks')::interval) > NOW();

-- Get total number of classrooms completed
SELECT COUNT(DISTINCT cl.classroom_id) AS total_completed_classrooms
FROM Classroom cl
WHERE cl.created_by_teacher = auth.uid()
  AND (cl.start_date + (cl.duration || ' weeks')::interval) < NOW();

-- Get average student per classroom
SELECT 
    COALESCE(
        ROUND(
            COUNT(
                DISTINCT a.enrollment_id)::numeric / 
                NULLIF(COUNT(DISTINCT cl.classroom_id), 
                0), 
            2), 
        0) AS average_students_per_classroom
FROM Classroom cl
LEFT JOIN Attendence a ON cl.classroom_id = a.classroom_id
WHERE cl.created_by_teacher = auth.uid();



-- Get total number of courses created
SELECT COUNT(DISTINCT course_id) AS total_courses_created
FROM Course c
WHERE c.teacher_id = auth.uid();

-- Get total number of courses published
SELECT COUNT(DISTINCT course_id) AS total_courses_published
FROM Course c
WHERE c.teacher_id = auth.uid()
      AND c.status = 'published'::course_status;

-- Get total number of courses draft
SELECT COUNT(DISTINCT course_id) AS total_courses_drafted
FROM Course c
WHERE c.teacher_id = auth.uid()
      AND c.status = 'draft'::course_status;

-- Get total number of courses archived
SELECT COUNT(DISTINCT course_id) AS total_courses_archive
FROM Course c
WHERE c.teacher_id = auth.uid()
      AND c.status = 'archived'::course_status;

-- Get total credits offered
SELECT SUM(course_credit) AS total_credits_offered
FROM Course c
WHERE c.teacher_id = auth.uid();

-- Get average lessons per courses
SELECT 
    COALESCE(
        ROUND(
            COUNT(DISTINCT cle.lesson_id)::numeric 
            / NULLIF(COUNT(DISTINCT cle.course_id), 0),
            2
        ), 
        0
    ) AS average_lessons_per_course
FROM Course_lesson cle
JOIN Course c ON cle.course_id = c.course_id
WHERE c.teacher_id = auth.uid();

-- Get average course completion in percentage
SELECT 
    ROUND(
        AVG(
            COUNT(*) FILTER (WHERE m.result = 'Pass')::numeric 
            / NULLIF(COUNT(*) FILTER (WHERE m.result IN ('Pass','Fail')), 0)
        ) OVER (),
        2
    ) * 100 AS average_course_completion_percentage
FROM Mark m
JOIN Course c ON m.course_id = c.course_id
WHERE c.teacher_id = auth.uid()
GROUP BY m.course_id;
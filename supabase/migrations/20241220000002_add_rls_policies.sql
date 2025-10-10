-- Add RLS policies to allow service role operations
-- Allow service role to insert into teacher table
CREATE POLICY "Service role can insert teachers" ON Teacher
  FOR INSERT TO service_role WITH CHECK (true);

-- Allow service role to insert into student table  
CREATE POLICY "Service role can insert students" ON Student
  FOR INSERT TO service_role WITH CHECK (true);

-- Allow service role to select from teacher table
CREATE POLICY "Service role can select teachers" ON Teacher
  FOR SELECT TO service_role USING (true);

-- Allow service role to select from student table
CREATE POLICY "Service role can select students" ON Student
  FOR SELECT TO service_role USING (true);

-- Allow authenticated users (teacher) to select from teacher table
CREATE POLICY "Teachers can view their own login details" ON Teacher
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());

-- Allow authenticated users (student) to select from student table
CREATE POLICY "Students can view their own login details" ON Student
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- Enrollemnt table
-- Allow authenticated students to delete their own enrollments
CREATE POLICY "Students can unenroll from their own courses" ON Enrollment
FOR DELETE TO authenticated
USING (
  student_id = auth.uid()
);

-- Course table
-- Allow authenticated users to select from course table
CREATE POLICY "Authenticated users can select courses" ON Course
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated teacher users to insert into course table
CREATE POLICY "Authenticated users can insert courses" ON Course
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
    SELECT
    FROM Teacher t
    WHERE t.teacher_id = auth.uid()
  )
  );

-- Allow authenticated teacher users to update course table on courses they created
CREATE POLICY "Authenticated users can update courses" ON Course
  FOR UPDATE TO authenticated USING (
    Course.teacher_id = auth.uid()
  );

-- Allow authenticated teacher users to delete from course table
CREATE POLICY "Authenticated teacher users can delete courses" ON Course
  FOR DELETE TO authenticated USING (
    Course.teacher_id = auth.uid()
  );

-- Lesson table
-- Allow authenticated student users to select only lessons from courses they have enrolled
CREATE POLICY "Authenticated users can select lessons" ON Lesson
  FOR SELECT TO authenticated USING (
    EXISTS (
    SELECT
    FROM Enrollment e
    JOIN Student s ON s.student_id = e.student_id
    JOIN Course_Lesson cl ON cl.course_id = e.course_id
    WHERE cl.lesson_id = Lesson.lesson_id
      AND s.student_id = auth.uid()
  )
  );

-- Allow authenticated teacher users to select only lessons they created
CREATE POLICY "Authenticated teacher users can select lessons they created" ON Lesson
  FOR SELECT TO authenticated USING (
    Lesson.teacher_id = auth.uid()
  );

-- Allow authenticated teacher users to insert into lesson table
CREATE POLICY "Authenticated users can insert lessons" ON Lesson
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
    SELECT
    FROM Teacher t
    WHERE t.teacher_id = auth.uid()
  )
  );

-- Allow authenticated teacher users to update lesson table
CREATE POLICY "Authenticated users can update lessons" ON Lesson
  FOR UPDATE TO authenticated USING (
    Lesson.teacher_id = auth.uid()
  );

-- Allow authenticated users to delete from lesson table
CREATE POLICY "Authenticated teacher users can delete lessons" ON Lesson
  FOR DELETE TO authenticated USING (
    Lesson.teacher_id = auth.uid()
  );

-- Course_Lesson table
-- Allow authenticated teacher users to insert into Course_Lesson table
CREATE POLICY "Authenticated users can assign lessons to a course" ON Course_Lesson
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
    SELECT
    FROM Course c
    WHERE c.course_id = Course_Lesson.course_id
      AND c.teacher_id = auth.uid()
  )
  );

-- Allow authenticated teacher users to update Course_Lesson table
CREATE POLICY "Authenticated users can update lessons of a course" ON Course_Lesson
  FOR UPDATE TO authenticated USING (
    EXISTS (
    SELECT
    FROM Course c
    WHERE c.course_id = Course_Lesson.course_id
      AND c.teacher_id = auth.uid()
  )
  );

-- Allow authenticated users to delete from Course_Lesson table
CREATE POLICY "Authenticated teacher users can delete lessons from a course" ON Course_Lesson
  FOR DELETE TO authenticated USING (
    EXISTS (
    SELECT
    FROM Course c
    WHERE c.course_id = Course_Lesson.course_id
      AND c.teacher_id = auth.uid()
  )
  );

-- Classroom
-- Allow authenticated student users to select only classrooms from courses they have enrolled (undone)
CREATE POLICY "Authenticated student users can select classrooms" ON Classroom
  FOR SELECT TO authenticated USING (
    EXISTS (
    SELECT
    FROM Enrollment e
    JOIN Student s ON s.student_id = e.student_id
    JOIN Course_Lesson cl ON cl.course_id = e.course_id
    JOIN Classroom_Lesson ccl ON ccl.course_id = cl.course_id
    WHERE ccl.classroom_id = Classroom.classroom_id
      AND s.student_id = auth.uid()
  )
  );

-- Allow authenticated teacher users to insert into classroom table
CREATE POLICY "Authenticated users can insert classrooms" ON Classroom
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
    SELECT
    FROM Teacher t
    WHERE t.teacher_id = auth.uid()
  )
  );

-- Allow authenticated teacher users to delete from classroom table
CREATE POLICY "Authenticated teacher users can delete courses" ON Classroom
  FOR DELETE TO authenticated USING (
    Classroom.created_by_teacher = auth.uid()
  );

-- Allow authenticated teacher users to update classroom table
CREATE POLICY "Authenticated teacher users can update courses" ON Classroom
  FOR UPDATE TO authenticated USING (
    Classroom.created_by_teacher = auth.uid()
  );

-- Classroom_Lesson table
-- Allow authenticated teacher users to insert into Course_Lesson table
CREATE POLICY "Authenticated users can assign lessons to a classroom" ON Classroom_Lesson
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
    SELECT
    FROM Course_Lesson cl
    WHERE cl.course_id = Classroom_Lesson.course_id
      AND cl.lesson_id = Classroom_Lesson.lesson_id
  )
  );

-- Allow authenticated teacher users to update Course_Lesson table
CREATE POLICY "Authenticated users can update lessons of a classroom" ON Classroom_Lesson
  FOR UPDATE TO authenticated USING (
    EXISTS (
    SELECT
    FROM Course_Lesson cl
    WHERE cl.course_id = Classroom_Lesson.course_id
      AND cl.lesson_id = Classroom_Lesson.lesson_id
  )
  );

-- Allow authenticated users to delete from Course_Lesson table
CREATE POLICY "Authenticated teacher users can delete lessons from a classroom" ON Classroom_Lesson
  FOR DELETE TO authenticated USING (
    EXISTS (
    SELECT
    FROM Course_Lesson cl
    WHERE cl.course_id = Classroom_Lesson.course_id
      AND cl.lesson_id = Classroom_Lesson.lesson_id
  )
  );


-- Attendence Table
-- Allow authenticated teacher users to update attendence table
CREATE POLICY "Authenticated teacher users can update attendence" ON Attendence
  FOR UPDATE TO authenticated USING (
    EXISTS (
    SELECT
    FROM Classroom cl
    WHERE cl.classroom_id = Attendence.classroom_id
      AND cl.classroom_supervisor = auth.uid()
  )
  );

-- Mark Table
-- Allow authenticated teacher users to update mark table
CREATE POLICY "Authenticated teacher users can update mark" ON Mark
  FOR UPDATE TO authenticated USING (
    EXISTS (
    SELECT
    FROM Lesson l
    WHERE l.lesson_Id = Mark.lesson_id
     AND l.teacher_id = auth.uid()
  )
  );
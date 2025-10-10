-- Add display_id field to Lesson table for user-friendly lesson identification
ALTER TABLE Lesson ADD COLUMN display_id TEXT;

-- Create an index on display_id for better performance
CREATE INDEX idx_lesson_display_id ON Lesson(display_id);

-- Update existing lessons with display_id format
-- This will generate display_id for existing lessons based on their course and creation order
WITH lesson_numbered AS (
  SELECT 
    l.lesson_id,
    course_id,
    ROW_NUMBER() OVER (PARTITION BY cl.course_id ORDER BY l.created_at) as lesson_num
  FROM lesson l
  JOIN course_lesson cl ON l.lesson_id = cl.lesson_id
),
course_names AS (
  SELECT course_id, course_name FROM Course
)
UPDATE Lesson 
SET display_id = CONCAT(cn.course_name, ' - L', LPAD(ln.lesson_num::text, 2, '0'))
FROM lesson_numbered ln
JOIN course_names cn ON ln.course_id = cn.course_id
WHERE Lesson.lesson_id = ln.lesson_id;

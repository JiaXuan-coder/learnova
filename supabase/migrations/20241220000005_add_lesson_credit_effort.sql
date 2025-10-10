-- Add lesson credit and estimated effort fields to Lesson table
ALTER TABLE Lesson ADD COLUMN lesson_credit INTEGER DEFAULT 1;
ALTER TABLE Lesson ADD COLUMN estimated_effort INTEGER DEFAULT 1;
ALTER TABLE Lesson ADD COLUMN prerequisite_lessons TEXT;

-- Update existing lessons with default values for new fields
UPDATE Lesson SET 
  lesson_credit = 1,
  estimated_effort = 1,
  prerequisite_lessons = 'No prerequisites required.'
WHERE lesson_credit IS NULL OR estimated_effort IS NULL OR prerequisite_lessons IS NULL;

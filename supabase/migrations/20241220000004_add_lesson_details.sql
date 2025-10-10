-- Add additional fields to Lesson table for enhanced lesson details
ALTER TABLE Lesson ADD COLUMN lesson_outcome TEXT;
ALTER TABLE Lesson ADD COLUMN reading_list TEXT;
ALTER TABLE Lesson ADD COLUMN assignment TEXT;
ALTER TABLE Lesson ADD COLUMN lesson_description TEXT;

-- Update existing lessons with default values for new fields
UPDATE Lesson SET 
  lesson_outcome = 'Learning outcomes will be defined for this lesson.',
  reading_list = 'Reading materials will be provided for this lesson.',
  assignment = 'Assignment details will be provided for this lesson.',
  lesson_description = COALESCE(lesson_content, 'No description available for this lesson.')
WHERE lesson_outcome IS NULL OR reading_list IS NULL OR assignment IS NULL OR lesson_description IS NULL;

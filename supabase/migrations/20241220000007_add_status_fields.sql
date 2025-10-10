-- Add status field to Course and Lesson tables
-- Status can be: 'published', 'draft', 'archived'

-- Update existing records to have 'published' status
UPDATE Course SET status = 'published' WHERE status IS NULL;
UPDATE Lesson SET status = 'published' WHERE status IS NULL;

-- Make status NOT NULL after setting defaults
ALTER TABLE Course ALTER COLUMN status SET NOT NULL;
ALTER TABLE Lesson ALTER COLUMN status SET NOT NULL;


-- Add status field to Mark tables
-- Status can be: 'Pass', 'Fail', 'Not graded'

-- Update existing records to have 'Not graded' status
UPDATE Mark SET result = 'Not graded' WHERE result IS NULL;

-- Make status NOT NULL after setting defaults
ALTER TABLE Mark ALTER COLUMN result SET NOT NULL;
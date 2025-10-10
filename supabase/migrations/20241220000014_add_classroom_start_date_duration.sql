-- Add start_date and duration fields to Classroom table
-- These fields were missing from the original schema but are used in the UI

ALTER TABLE Classroom 
ADD COLUMN start_date DATE,
ADD COLUMN duration INTEGER;

-- Add comments to document the fields
COMMENT ON COLUMN Classroom.start_date IS 'Start date of the classroom';
COMMENT ON COLUMN Classroom.duration IS 'Duration of the classroom in weeks/months';

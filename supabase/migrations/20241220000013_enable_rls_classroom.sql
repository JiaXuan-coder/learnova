-- Enable RLS on Classroom table to fix security issue
-- The Classroom table has RLS policies but RLS was not enabled
ALTER TABLE Classroom ENABLE ROW LEVEL SECURITY;

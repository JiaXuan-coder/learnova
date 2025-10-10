-- Fix RLS policies to be more permissive for testing
-- Drop existing policies and create simpler ones

-- Drop existing Course policies
DROP POLICY IF EXISTS "Authenticated users can select courses" ON Course;
DROP POLICY IF EXISTS "Authenticated users can insert courses" ON Course;
DROP POLICY IF EXISTS "Authenticated users can update courses" ON Course;
DROP POLICY IF EXISTS "Authenticated teacher users can delete courses" ON Course;

-- Create simple permissive policies for Course
CREATE POLICY "Allow all authenticated users to select courses" ON Course
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to insert courses" ON Course
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update courses" ON Course
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to delete courses" ON Course
  FOR DELETE TO authenticated USING (true);

-- Drop existing Lesson policies
DROP POLICY IF EXISTS "Authenticated users can select lessons" ON Lesson;
DROP POLICY IF EXISTS "Authenticated teacher users can select lessons they created" ON Lesson;
DROP POLICY IF EXISTS "Authenticated users can insert lessons" ON Lesson;
DROP POLICY IF EXISTS "Authenticated users can update lessons" ON Lesson;
DROP POLICY IF EXISTS "Authenticated teacher users can delete lessons" ON Lesson;

-- Create simple permissive policies for Lesson
CREATE POLICY "Allow all authenticated users to select lessons" ON Lesson
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to insert lessons" ON Lesson
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update lessons" ON Lesson
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to delete lessons" ON Lesson
  FOR DELETE TO authenticated USING (true);

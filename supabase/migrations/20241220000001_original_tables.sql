-- Restore original Supabase table structure
-- Drop the current tables first
DROP TABLE IF EXISTS Lesson CASCADE;
DROP TABLE IF EXISTS Course CASCADE;
DROP TABLE IF EXISTS Profile CASCADE;
DROP TABLE IF EXISTS Classroom CASCADE;
DROP TABLE IF EXISTS Enrollment CASCADE;
DROP TABLE IF EXISTS Mark CASCADE;
DROP TABLE IF EXISTS Course_Lesson CASCADE;
DROP TABLE IF EXISTS Classroom_Lesson CASCADE;
DROP TABLE IF EXISTS Attendence CASCADE;

-- Create Teacher table
CREATE TABLE Teacher (
    teacher_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_email TEXT UNIQUE NOT NULL,
    teacher_name TEXT NOT NULL,
    teacher_title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Student table
CREATE TABLE Student (
    student_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_email TEXT UNIQUE NOT NULL,
    student_name TEXT NOT NULL,
    student_title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create an ENUM type for course and lesson status
CREATE TYPE course_status AS ENUM ('published', 'draft', 'archived');
CREATE TYPE lesson_status AS ENUM ('published', 'draft', 'archived');

-- Create Course table
CREATE TABLE Course (
    course_id TEXT PRIMARY KEY,
    course_name TEXT NOT NULL,
    course_description TEXT,
    course_credit INTEGER DEFAULT 0,
    teacher_id UUID REFERENCES Teacher(teacher_id) NOT NULL,
    status course_status,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Lesson table
CREATE TABLE Lesson (
    lesson_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_title TEXT NOT NULL,
    lesson_content TEXT,
    teacher_id UUID REFERENCES Teacher(teacher_id) NOT NULL,
    week_number INTEGER,
    status lesson_status,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Course_Lesson table
CREATE TABLE Course_Lesson (
    course_id TEXT REFERENCES Course(course_id) NOT NULL,
    lesson_id UUID REFERENCES Lesson(lesson_id) NOT NULL,
    UNIQUE(course_id, lesson_id)
);

-- Create Classroom table
CREATE TABLE Classroom (
    classroom_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    classroom_name TEXT NOT NULL,
    created_by_teacher UUID REFERENCES Teacher(teacher_id) NOT NULL,
    classroom_supervisor UUID REFERENCES Teacher(teacher_id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Classroom_Lesson table
CREATE TABLE Classroom_Lesson (
    classroom_id UUID REFERENCES Classroom(classroom_id) NOT NULL,
    course_id TEXT REFERENCES Course(course_id) NOT NULL,
    lesson_id UUID REFERENCES Lesson(lesson_id) NOT NULL,
    UNIQUE(classroom_id, course_id, lesson_id)
);

-- Create Enrollment table
CREATE TABLE Enrollment (
    enrollment_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES Student(student_id) NOT NULL,
    course_id TEXT REFERENCES Course(course_id) NOT NULL,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    final_mark INTEGER NOT NULL DEFAULT 0,
    UNIQUE(student_id, course_id)
);

-- Attendence table
CREATE TABLE Attendence (
    classroom_id UUID REFERENCES Classroom(classroom_id) NOT NULL,
    enrollment_id UUID REFERENCES Enrollment(enrollment_id) NOT NULL,
    attendence BOOLEAN DEFAULT FALSE NOT NULL,
    PRIMARY KEY (classroom_id, enrollment_id)
);

-- Create an ENUM type for results
CREATE TYPE result_status AS ENUM ('Pass', 'Fail', 'Not graded');

-- Mark table (students submition for assignments)
CREATE TABLE Mark (
    enrollment_id UUID REFERENCES Enrollment(enrollment_id) NOT NULL,
    course_id TEXT REFERENCES Course(course_id) NOT NULL,
    lesson_id UUID REFERENCES Lesson(lesson_id) NOT NULL,
    feedback TEXT,
    result result_status DEFAULT 'Not graded',
    PRIMARY KEY (enrollment_id, course_id, lesson_id)
);


-- Enable Row Level Security
ALTER TABLE Teacher ENABLE ROW LEVEL SECURITY;
ALTER TABLE Student ENABLE ROW LEVEL SECURITY;
ALTER TABLE Course ENABLE ROW LEVEL SECURITY;
ALTER TABLE Classroom ENABLE ROW LEVEL SECURITY;
ALTER TABLE Lesson ENABLE ROW LEVEL SECURITY;
ALTER TABLE Enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE mark ENABLE ROW LEVEL SECURITY;
ALTER TABLE Attendence ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lesson ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_lesson ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (allow all for now - will be refined later)
-- CREATE POLICY "Allow all operations on Teacher" ON Teacher FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on Student" ON Student FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on Course" ON Course FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on Course_Lesson" ON Course_Lesson FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on Classroom" ON Classroom FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on Lesson" ON Lesson FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on Enrollment" ON Enrollment FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on Assignment" ON Assignment FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on AssignmentScore" ON AssignmentScore FOR ALL USING (true);

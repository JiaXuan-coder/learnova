-- Fix function search_path security warning
CREATE OR REPLACE FUNCTION update_final_mark()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the enrollment's final_mark with a simple calculation
    UPDATE "Enrollment"
    SET final_mark = (
        SELECT 
            CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(
                    (SUM(CASE WHEN result = 'Pass' THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100
                )
            END
        FROM "Mark"
        WHERE enrollment_id = NEW.enrollment_id -- Points to the exact enrollment row that the mark belongs to
          AND course_id = NEW.course_id
    )
    WHERE enrollment_id = NEW.enrollment_id
      AND course_id = NEW.course_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

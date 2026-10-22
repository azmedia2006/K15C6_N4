package kn72;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CourseRequestValidationTests {

    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsBlankAndOversizedCourseNamesAndInvalidSessionLimits() {
        assertEquals(2, validator.validate(
                new CourseController.CourseRequest(" ", 0)).size());
        assertEquals(1, validator.validate(
                new CourseController.CourseRequest("x".repeat(121), 1)).size());
    }

    @Test
    void rejectsInvalidSessionFieldsAndAcceptsValidRequests() {
        assertEquals(3, validator.validate(
                new CourseController.SessionRequest(0, " ", " ")).size());
        assertEquals(0, validator.validate(
                new CourseController.SessionRequest(1, "Variables", "Identify data types")).size());
    }
}

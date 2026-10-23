package kn72;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CourseControllerTests {

    private CourseRepository courses;
    private CourseSessionRepository sessions;
    private CourseController controller;

    @BeforeEach
    void setUp() {
        courses = mock(CourseRepository.class);
        sessions = mock(CourseSessionRepository.class);
        controller = new CourseController(courses, sessions);
    }

    @Test
    void createsCourseWithTrimmedName() {
        when(courses.save(any(Course.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Course created = controller.createCourse(
                new CourseController.CourseRequest("  Java  ", 8));

        assertEquals("Java", created.getName());
        assertEquals(8, created.getMaxSessions());
        verify(courses).save(any(Course.class));
    }

    @Test
    void rejectsInvalidCourseData() {
        assertBadRequest(() -> controller.createCourse(
                new CourseController.CourseRequest(" ", 5)));
        assertBadRequest(() -> controller.createCourse(
                new CourseController.CourseRequest("Java", 0)));

        verify(courses, never()).save(any(Course.class));
    }

    @Test
    void listsSessionsInRepositoryOrder() {
        Course course = course(1L, "Java", 5);
        CourseSession session = session(course, 1, "Variables", "Declare variables");
        session.setId(10L);
        when(courses.findById(1L)).thenReturn(Optional.of(course));
        when(sessions.findByCourse_IdOrderBySessionNumber(1L))
                .thenReturn(List.of(session));

        List<CourseController.SessionView> result = controller.getSessions(1L);

        assertEquals(List.of(new CourseController.SessionView(
                10L, 1, "Variables", "Declare variables")), result);
    }

    @Test
    void rejectsListingSessionsForUnknownCourse() {
        when(courses.findById(99L)).thenReturn(Optional.empty());

        assertNotFound(() -> controller.getSessions(99L));

        verifyNoInteractions(sessions);
    }

    @Test
    void addsSessionAndTrimsText() {
        Course course = course(1L, "Java", 5);
        when(courses.findById(1L)).thenReturn(Optional.of(course));
        when(sessions.countByCourse_Id(1L)).thenReturn(0L);
        when(sessions.existsByCourse_IdAndSessionNumber(1L, 1))
                .thenReturn(false);
        when(sessions.save(any(CourseSession.class)))
                .thenAnswer(invocation -> {
                    CourseSession saved = invocation.getArgument(0);
                    saved.setId(10L);
                    return saved;
                });

        CourseController.SessionView result = controller.addSession(
                1L, new CourseController.SessionRequest(
                        1, "  Variables  ", "  Declare variables  "));

        assertEquals(new CourseController.SessionView(
                10L, 1, "Variables", "Declare variables"), result);
        verify(sessions).save(any(CourseSession.class));
    }

    @Test
    void rejectsInvalidSessionData() {
        Course course = course(1L, "Java", 5);
        when(courses.findById(1L)).thenReturn(Optional.of(course));

        assertBadRequest(() -> controller.addSession(
                1L, new CourseController.SessionRequest(0, "Topic", "Objective")));
        assertBadRequest(() -> controller.addSession(
                1L, new CourseController.SessionRequest(1, " ", "Objective")));
        assertBadRequest(() -> controller.addSession(
                1L, new CourseController.SessionRequest(1, "Topic", " ")));

        verify(sessions, never()).save(any(CourseSession.class));
    }

    @Test
    void rejectsSessionWhenCourseLimitIsReached() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(1L, "Java", 1)));
        when(sessions.countByCourse_Id(1L)).thenReturn(1L);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.addSession(1L,
                        new CourseController.SessionRequest(2, "Topic", "Objective")));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(sessions, never()).save(any(CourseSession.class));
        verify(sessions, never())
                .existsByCourse_IdAndSessionNumber(anyLong(), anyInt());
    }

    @Test
    void rejectsDuplicateSessionNumber() {
        when(courses.findById(1L)).thenReturn(Optional.of(course(1L, "Java", 5)));
        when(sessions.countByCourse_Id(1L)).thenReturn(1L);
        when(sessions.existsByCourse_IdAndSessionNumber(1L, 1))
                .thenReturn(true);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.addSession(1L,
                        new CourseController.SessionRequest(1, "Topic", "Objective")));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(sessions, never()).save(any(CourseSession.class));
    }

    @Test
    void rejectsAddingSessionToUnknownCourse() {
        when(courses.findById(99L)).thenReturn(Optional.empty());

        assertNotFound(() -> controller.addSession(99L,
                new CourseController.SessionRequest(1, "Topic", "Objective")));

        verifyNoInteractions(sessions);
    }

    @Test
    void copiesSessionsAndAssignsNumbersAfterTargetSessions() {
        Course source = course(1L, "Java", 5);
        Course target = course(2L, "Kotlin", 5);
        CourseSession sourceOne = session(source, 1, "Variables", "Declare variables");
        CourseSession sourceTwo = session(source, 2, "Types", "Use types");
        CourseSession targetExisting = session(target, 3, "Setup", "Set up project");
        CourseSession copiedOne = session(target, 4, "Variables", "Declare variables");
        CourseSession copiedTwo = session(target, 5, "Types", "Use types");

        when(courses.findById(1L)).thenReturn(Optional.of(source));
        when(courses.findById(2L)).thenReturn(Optional.of(target));
        when(sessions.findByCourse_IdOrderBySessionNumber(1L))
                .thenReturn(List.of(sourceOne, sourceTwo));
        int[] targetQueryCount = {0};
        when(sessions.findByCourse_IdOrderBySessionNumber(2L))
                .thenAnswer(invocation -> targetQueryCount[0]++ == 0
                        ? List.of(targetExisting)
                        : List.of(targetExisting, copiedOne, copiedTwo));
        when(sessions.save(any(CourseSession.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        List<CourseController.SessionView> result = controller.copySessions(
                2L, new CourseController.CopyRequest(1L));

        assertEquals(List.of(3, 4, 5),
                result.stream().map(CourseController.SessionView::sessionNumber).toList());
        assertEquals(List.of("Setup", "Variables", "Types"),
                result.stream().map(CourseController.SessionView::topic).toList());

        ArgumentCaptor<CourseSession> savedSessions =
                ArgumentCaptor.forClass(CourseSession.class);
        verify(sessions, times(2)).save(savedSessions.capture());
        assertEquals(List.of(4, 5), savedSessions.getAllValues().stream()
                .map(CourseSession::getSessionNumber).toList());
        assertEquals(List.of("Variables", "Types"), savedSessions.getAllValues().stream()
                .map(CourseSession::getTopic).toList());
        assertEquals(List.of("Declare variables", "Use types"),
                savedSessions.getAllValues().stream()
                        .map(CourseSession::getObjective).toList());
    }

    @Test
    void rejectsCopyThatWouldExceedTargetLimit() {
        Course source = course(1L, "Java", 5);
        Course target = course(2L, "Kotlin", 2);
        when(courses.findById(1L)).thenReturn(Optional.of(source));
        when(courses.findById(2L)).thenReturn(Optional.of(target));
        when(sessions.findByCourse_IdOrderBySessionNumber(1L))
                .thenReturn(List.of(
                        session(source, 1, "One", "Objective"),
                        session(source, 2, "Two", "Objective")));
        when(sessions.findByCourse_IdOrderBySessionNumber(2L))
                .thenReturn(List.of(session(target, 1, "Existing", "Objective")));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.copySessions(
                        2L, new CourseController.CopyRequest(1L)));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(sessions, never()).save(any(CourseSession.class));
    }

    @Test
    void rejectsCopyingSessionsToSameCourse() {
        Course course = course(1L, "Java", 5);
        when(courses.findById(1L)).thenReturn(Optional.of(course));

        assertBadRequest(() -> controller.copySessions(
                1L, new CourseController.CopyRequest(1L)));

        verifyNoInteractions(sessions);
    }

    @Test
    void rejectsCopyWhenEitherCourseDoesNotExist() {
        when(courses.findById(2L)).thenReturn(Optional.empty());

        assertNotFound(() -> controller.copySessions(
                2L, new CourseController.CopyRequest(1L)));

        verifyNoInteractions(sessions);
    }

    private static Course course(Long id, String name, int maxSessions) {
        Course course = new Course(name, maxSessions);
        course.setId(id);
        return course;
    }

    private static CourseSession session(
            Course course, int number, String topic, String objective) {
        return new CourseSession(course, number, topic, objective);
    }

    private static void assertBadRequest(Runnable action) {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class, action::run);
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    private static void assertNotFound(Runnable action) {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class, action::run);
        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }
}

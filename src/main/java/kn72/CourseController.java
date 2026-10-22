package kn72;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class CourseController {

    private final CourseRepository courses;
    private final CourseSessionRepository sessions;

    public CourseController(
            CourseRepository courses,
            CourseSessionRepository sessions) {
        this.courses = courses;
        this.sessions = sessions;
    }

    public record CourseRequest(
            @NotBlank @Size(max = 120) String name,
            @Min(1) int maxSessions) {}

    public record SessionRequest(
            @Min(1)
            int sessionNumber,
            @NotBlank @Size(max = 200)
            String topic,
            @NotBlank @Size(max = 2000)
            String objective) {}

    public record SessionView(
            Long id,
            int sessionNumber,
            String topic,
            String objective) {}

    public record CopyRequest(@NotNull @Min(1) Long sourceCourseId) {}

    @GetMapping("/courses")
    public List<Course> getCourses() {
        return courses.findAll();
    }

    @PostMapping("/courses")
    public Course createCourse(@Valid @RequestBody CourseRequest request) {
        return courses.save(
                new Course(request.name().trim(),
                        request.maxSessions()));
    }

    @GetMapping("/courses/{courseId}/sessions")
    public List<SessionView> getSessions(
            @PathVariable Long courseId) {
        requireCourse(courseId);

        return sessions
                .findByCourse_IdOrderBySessionNumber(courseId)
                .stream()
                .map(s -> new SessionView(
                        s.getId(),
                        s.getSessionNumber(),
                        s.getTopic(),
                        s.getObjective()))
                .toList();
    }

    @PostMapping("/courses/{courseId}/sessions")
    @Transactional
    public SessionView addSession(
            @PathVariable Long courseId,
            @Valid @RequestBody SessionRequest request) {

        Course course = requireCourse(courseId);

        if (request.sessionNumber() > course.getMaxSessions()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số thứ tự buổi học không được vượt giới hạn của môn");
        }

        if (sessions.countByCourse_Id(courseId)
                >= course.getMaxSessions()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đã đạt số buổi tối đa của môn học");
        }

        if (sessions.existsByCourse_IdAndSessionNumber(
                courseId, request.sessionNumber())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Số thứ tự buổi học đã tồn tại");
        }

        CourseSession saved = sessions.save(
                new CourseSession(
                        course,
                        request.sessionNumber(),
                        request.topic().trim(),
                        request.objective().trim()));

        return new SessionView(
                saved.getId(),
                saved.getSessionNumber(),
                saved.getTopic(),
                saved.getObjective());
    }

    @PostMapping("/courses/{targetId}/sessions/copy")
    @Transactional
    public List<SessionView> copySessions(
            @PathVariable Long targetId,
            @Valid @RequestBody CopyRequest request) {

        Course target = requireCourse(targetId);
        Course source = requireCourse(request.sourceCourseId());

        if (target.getId().equals(source.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Môn nguồn và môn đích phải khác nhau");
        }

        List<CourseSession> sourceList =
                sessions.findByCourse_IdOrderBySessionNumber(
                        source.getId());

        List<CourseSession> targetList =
                sessions.findByCourse_IdOrderBySessionNumber(
                        target.getId());

        if (targetList.size() + sourceList.size()
                > target.getMaxSessions()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Nhân bản sẽ vượt số buổi tối đa của môn đích");
        }

        Set<Integer> usedNumbers = new HashSet<>();
        targetList.forEach(session -> usedNumbers.add(session.getSessionNumber()));
        int nextNumber = 1;

        for (CourseSession sourceSession : sourceList) {
            while (usedNumbers.contains(nextNumber)) {
                nextNumber++;
            }
            sessions.save(new CourseSession(
                    target,
                    nextNumber,
                    sourceSession.getTopic(),
                    sourceSession.getObjective()));
            usedNumbers.add(nextNumber++);
        }

        return sessions
                .findByCourse_IdOrderBySessionNumber(targetId)
                .stream()
                .map(s -> new SessionView(
                        s.getId(),
                        s.getSessionNumber(),
                        s.getTopic(),
                        s.getObjective()))
                .toList();
    }

    private Course requireCourse(Long id) {
        return courses.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy môn học"));
    }
}
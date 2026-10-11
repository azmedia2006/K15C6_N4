package kn72;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CourseSessionRepository extends JpaRepository<CourseSession, Long> {

    List<CourseSession> findByCourse_IdOrderBySessionNumber(Long courseId);

    long countByCourse_Id(Long courseId);

    boolean existsByCourse_IdAndSessionNumber(Long courseId, int sessionNumber);
}
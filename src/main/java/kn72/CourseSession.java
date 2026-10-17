package kn72;

import jakarta.persistence.*;

@Entity
@Table(
        name = "course_sessions",
        uniqueConstraints = @UniqueConstraint(
                columnNames = {"course_id", "session_number"}
        )
)
public class CourseSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(name = "session_number", nullable = false)
    private int sessionNumber;

    @Column(nullable = false)
    private String topic;

    @Column(nullable = false)
    private String objective;

    public CourseSession() {}

    public CourseSession(Course course, int sessionNumber, String topic, String objective) {
        this.course = course;
        this.sessionNumber = sessionNumber;
        this.topic = topic;
        this.objective = objective;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Course getCourse() {
        return course;
    }

    public void setCourse(Course course) {
        this.course = course;
    }

    public int getSessionNumber() {
        return sessionNumber;
    }

    public void setSessionNumber(int sessionNumber) {
        this.sessionNumber = sessionNumber;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public String getObjective() {
        return objective;
    }

    public void setObjective(String objective) {
        this.objective = objective;
    }
}
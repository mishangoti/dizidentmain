package com.clinic.hms.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 15, unique = true)
    private String mobile;

    /** Plain or hashed; length allows BCrypt later */
    @Column(nullable = false, length = 100)
    private String password;

    /**
     * SUPERADMIN / ORG / DOCTOR / SERVICE_PROVIDER / PATIENT
     */
    @Column(nullable = false, length = 32)
    private String role;

    @Column(name = "authentik_user_id", length = 64, unique = true)
    private String authentikUserId;

    @Column(length = 255)
    private String email;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

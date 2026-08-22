package com.clinic.hms.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_details")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    private LocalDate dob;

    @Column(name = "age_years")
    private Integer ageYears;

    @Column(length = 20)
    private String gender;

    @Column(length = 100)
    private String city;

    @Column(name = "referred_by", length = 150)
    private String referredBy;

    @Column(columnDefinition = "TEXT")
    private String allergies;

    @Column(name = "medical_history", columnDefinition = "TEXT")
    private String medicalHistory;

    @Column(name = "primary_complaint", columnDefinition = "TEXT")
    private String primaryComplaint;

    @Column(name = "id_insurance_file_path", length = 255)
    private String idInsuranceFilePath;

    @Column(name = "past_reports_file_path", length = 255)
    private String pastReportsFilePath;

    @Column(length = 150)
    private String speciality;

    @Column(name = "license_number", length = 64)
    private String licenseNumber;

    @Column(name = "address_line", length = 255)
    private String addressLine;

    @Column(length = 100)
    private String state;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(length = 100)
    private String country;

    /** SERVICE_PROVIDER type code */
    @Column(name = "provider_type", length = 64)
    private String providerType;

    /** INDEPENDENT / INTERNAL */
    @Column(name = "provider_scope", length = 32)
    private String providerScope;

    @Column(name = "business_name", length = 150)
    private String businessName;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_doctor_id")
    private User assignedDoctor;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

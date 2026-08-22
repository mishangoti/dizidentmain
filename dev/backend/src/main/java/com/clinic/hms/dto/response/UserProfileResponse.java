package com.clinic.hms.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserProfileResponse {
    private Long id;
    private String mobile;
    private String email;
    private String role;
    private String authentikUserId;
    private Boolean isActive;
    private String fullName;
    private String speciality;
    private String licenseNumber;
    private String addressLine;
    private String city;
    private String state;
    private String postalCode;
    private String country;
    private String providerType;
    private String providerScope;
    private String businessName;
    private String contactPhone;
}

package com.clinic.hms.dto.request;

import lombok.Data;

@Data
public class UserProfileUpdateRequest {
    private String email;
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
    private String authentikUserId;
}

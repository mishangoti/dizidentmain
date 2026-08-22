package com.clinic.hms.dto.request;

import lombok.Data;

@Data
public class ServiceProviderCreateRequest {
    private String mobile;
    private String password;
    private String email;
    private String fullName;
    private String businessName;
    private String providerType;
    private String providerScope;
    private String licenseNumber;
    private String contactPhone;
    private String addressLine;
    private String city;
    private String state;
    private String postalCode;
    private String country;
}

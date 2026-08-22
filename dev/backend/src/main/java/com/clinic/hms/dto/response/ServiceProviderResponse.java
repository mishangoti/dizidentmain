package com.clinic.hms.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ServiceProviderResponse {
    private Long id;
    private String mobile;
    private String email;
    private String fullName;
    private String businessName;
    private String providerType;
    private String providerScope;
    private String licenseNumber;
    private String contactPhone;
    private String city;
    private Boolean isActive;
}

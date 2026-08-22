package com.clinic.hms.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {
    /** Email or mobile. Preferred over the legacy {@code mobile} field. */
    private String identifier;
    /** Legacy field: mobile number (still accepted). */
    private String mobile;
    /** Optional email identifier. */
    private String email;
    private String password;
}

package com.clinic.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.auth")
public class AuthProperties {
    /** Legacy mobile/password → hms_token cookie JWT. */
    private boolean legacyEnabled = true;
}

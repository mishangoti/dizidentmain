package com.clinic.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.security")
public class SecurityAppProperties {
    /** HttpOnly auth cookie Secure flag (true behind HTTPS). */
    private boolean cookieSecure = false;
}

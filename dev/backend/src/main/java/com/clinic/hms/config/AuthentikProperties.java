package com.clinic.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.authentik")
public class AuthentikProperties {
    /** When true, validate Authentik JWTs via JWKS (oauth2 resource server). */
    private boolean enabled = false;
    private String issuerUri = "http://localhost:9000/application/o/dizidental-hms/";
    private String jwkSetUri = "http://localhost:9000/application/o/dizidental-hms/jwks/";
    private String clientId = "dizidental-hms-spa";
    /** Empty = skip audience validation (some Authentik tokens omit/vary aud). */
    private String audience = "dizidental-hms-spa";
}

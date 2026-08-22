package com.clinic.hms.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.cors")
public class CorsAppProperties {
    /** Comma-separated origins; empty → allow all patterns (dev only). */
    private List<String> allowedOrigins = new ArrayList<>();
}

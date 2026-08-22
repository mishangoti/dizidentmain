package com.clinic.hms.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthModeStartupLogger {

    private final AuthentikProperties authentikProperties;
    private final AuthProperties authProperties;

    @PostConstruct
    public void logAuthMode() {
        boolean authentik = authentikProperties.isEnabled();
        boolean legacy = authProperties.isLegacyEnabled();
        log.info("Auth mode: authentik.enabled={}, auth.legacy-enabled={}", authentik, legacy);
        if (!authentik && !legacy) {
            log.error("Both Authentik and legacy auth are disabled — API will reject authenticated access");
        }
        if (authentik && !legacy) {
            log.info("Cutover mode: Authentik-only (legacy login disabled)");
        }
        if (authentik && legacy) {
            log.info("Hybrid mode: Authentik Bearer + legacy hms_token cookie");
        }
    }
}

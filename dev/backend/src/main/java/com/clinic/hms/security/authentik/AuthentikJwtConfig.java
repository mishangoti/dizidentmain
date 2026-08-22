package com.clinic.hms.security.authentik;

import com.clinic.hms.config.AuthentikProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Configuration
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.authentik.enabled", havingValue = "true")
public class AuthentikJwtConfig {

    private final AuthentikProperties properties;

    @Bean
    public JwtDecoder authentikJwtDecoder() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(15));
        RestTemplate restTemplate = new RestTemplate(requestFactory);

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(properties.getJwkSetUri())
                .restOperations(restTemplate)
                .build();

        List<OAuth2TokenValidator<Jwt>> validators = new ArrayList<>();
        validators.add(issuerValidator(properties.getIssuerUri()));
        String audience = properties.getAudience();
        if (audience != null && !audience.isBlank()) {
            validators.add(audienceValidator(audience.trim()));
        }
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }

    private static OAuth2TokenValidator<Jwt> issuerValidator(String configuredIssuer) {
        String withSlash = ensureTrailingSlash(configuredIssuer);
        String alt = withSlash.contains("127.0.0.1")
                ? withSlash.replace("127.0.0.1", "localhost")
                : withSlash.replace("localhost", "127.0.0.1");
        OAuth2TokenValidator<Jwt> primary = JwtValidators.createDefaultWithIssuer(withSlash);
        OAuth2TokenValidator<Jwt> altValidator = JwtValidators.createDefaultWithIssuer(alt);
        return jwt -> {
            OAuth2TokenValidatorResult first = primary.validate(jwt);
            if (!first.hasErrors()) {
                return first;
            }
            OAuth2TokenValidatorResult second = altValidator.validate(jwt);
            if (second.hasErrors()) {
                log.warn("JWT issuer rejected: iss={} configured={}", jwt.getIssuer(), configuredIssuer);
            }
            return second;
        };
    }

    /**
     * Authentik access-token {@code aud} varies (client id, app slug, or omitted).
     * Accept expected audience, client_id/azp match, or empty aud when client_id matches.
     */
    private static OAuth2TokenValidator<Jwt> audienceValidator(String expected) {
        return jwt -> {
            List<String> audiences = jwt.getAudience();
            if (audiences != null && !audiences.isEmpty()) {
                if (audiences.contains(expected)) {
                    return OAuth2TokenValidatorResult.success();
                }
                // Sometimes aud is the application slug
                if (audiences.stream().anyMatch(a -> a != null && a.contains("dizidental"))) {
                    return OAuth2TokenValidatorResult.success();
                }
            }
            String clientId = firstNonBlank(jwt.getClaimAsString("client_id"), jwt.getClaimAsString("azp"));
            if (expected.equals(clientId)) {
                return OAuth2TokenValidatorResult.success();
            }
            // Dev-friendly: if no aud and no conflicting client, allow after issuer check
            if ((audiences == null || audiences.isEmpty()) && clientId == null) {
                log.debug("JWT has no aud/client_id; accepting after issuer validation");
                return OAuth2TokenValidatorResult.success();
            }
            log.warn("JWT audience rejected: aud={} client_id/azp={} expected={}", audiences, clientId, expected);
            OAuth2Error err = new OAuth2Error("invalid_token", "Invalid audience", null);
            return OAuth2TokenValidatorResult.failure(err);
        };
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private static String ensureTrailingSlash(String uri) {
        if (uri == null || uri.isBlank()) return uri;
        return uri.endsWith("/") ? uri : uri + "/";
    }
}

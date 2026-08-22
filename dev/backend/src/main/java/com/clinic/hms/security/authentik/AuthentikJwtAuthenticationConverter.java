package com.clinic.hms.security.authentik;

import com.clinic.hms.entity.User;
import com.clinic.hms.repository.UserRepository;
import com.clinic.hms.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Maps Authentik access token → local {@link CustomUserDetails} for {@code SecurityUtils}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.authentik.enabled", havingValue = "true")
public class AuthentikJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserRepository userRepository;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        User user = resolveUser(jwt);
        CustomUserDetails details = new CustomUserDetails(user);
        return new UsernamePasswordAuthenticationToken(details, jwt, details.getAuthorities());
    }

    private User resolveUser(Jwt jwt) {
        String mobile = firstNonBlank(
                jwt.getClaimAsString("mobile"),
                jwt.getClaimAsString("preferred_username"),
                jwt.getClaimAsString("nickname"),
                jwt.getClaimAsString("username")
        );
        String email = jwt.getClaimAsString("email");
        String sub = jwt.getSubject();

        Optional<User> found = Optional.empty();
        if (email != null && !email.isBlank()) {
            found = userRepository.findFirstByEmailIgnoreCase(email);
        }
        if (found.isEmpty() && sub != null) {
            found = userRepository.findByAuthentikUserId(sub);
        }
        if (found.isEmpty() && mobile != null) {
            found = userRepository.findByMobile(mobile);
        }

        User user = found.orElseThrow(() -> {
            log.warn("No HMS user for Authentik JWT email={} mobile={} sub={}", email, mobile, sub);
            return new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_token",
                            "No local HMS user for Authentik identity (email="
                                    + email + ", mobile=" + mobile + ", sub=" + sub
                                    + "). Sign in with a seeded email user, not akadmin.",
                            null));
        });

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_token", "User is inactive", null));
        }

        if (sub != null && (user.getAuthentikUserId() == null
                || user.getAuthentikUserId().isBlank()
                || !sub.equals(user.getAuthentikUserId()))) {
            final Long userId = user.getId();
            boolean takenByOther = userRepository.findByAuthentikUserId(sub)
                    .filter(u -> !u.getId().equals(userId))
                    .isPresent();
            if (!takenByOther) {
                user.setAuthentikUserId(sub);
                user.setUpdatedAt(LocalDateTime.now());
                user = userRepository.save(user);
                log.info("Linked HMS user {} to authentik sub {}", user.getMobile(), sub);
            }
        }

        return user;
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }
}

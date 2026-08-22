package com.clinic.hms.controller;

import com.clinic.hms.config.AuthProperties;
import com.clinic.hms.config.SecurityAppProperties;
import com.clinic.hms.dto.request.LoginRequest;
import com.clinic.hms.dto.response.LoginResponse;
import com.clinic.hms.dto.response.MeResponse;
import com.clinic.hms.entity.User;
import com.clinic.hms.repository.UserRepository;
import com.clinic.hms.security.CustomUserDetails;
import com.clinic.hms.security.JwtUtil;
import com.clinic.hms.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final AuthProperties authProperties;
    private final SecurityUtils securityUtils;
    private final SecurityAppProperties securityAppProperties;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        if (!authProperties.isLegacyEnabled()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Legacy login is disabled; use Authentik OIDC");
        }

        String identifier = firstNonBlank(request.getIdentifier(), request.getEmail(), request.getMobile());
        if (identifier == null || request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email or mobile and password are required");
        }

        User user = findLegacyUser(identifier)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid email, mobile, or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())
                && !user.getPassword().equals(request.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email, mobile, or password");
        }

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User is inactive");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getRole(), user.getMobile());

        ResponseCookie cookie = ResponseCookie.from("hms_token", token)
                .httpOnly(true)
                .secure(securityAppProperties.isCookieSecure())
                .path("/")
                .maxAge(Duration.ofHours(1))
                .sameSite("Lax")
                .build();

        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        LoginResponse body = new LoginResponse(
                user.getId(),
                user.getMobile(),
                user.getRole(),
                "Clinic User"
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(body);
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me() {
        User user = securityUtils.getCurrentUser();
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        String authSource = resolveAuthSource();
        boolean linked = user.getAuthentikUserId() != null && !user.getAuthentikUserId().isBlank();

        return ResponseEntity.ok(MeResponse.builder()
                .userId(user.getId())
                .mobile(user.getMobile())
                .role(user.getRole())
                .email(user.getEmail())
                .authentikUserId(user.getAuthentikUserId())
                .linked(linked)
                .authSource(authSource)
                .build());
    }

    private String resolveAuthSource() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return "none";
        }
        // Prefer Bearer detection: Spring may erase Jwt credentials after auth succeeds.
        var attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes sra) {
            String header = sra.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
            if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
                return "authentik";
            }
        }
        if (auth.getCredentials() instanceof Jwt) {
            return "authentik";
        }
        if (auth.getPrincipal() instanceof CustomUserDetails) {
            return "legacy";
        }
        return "unknown";
    }

    private java.util.Optional<User> findLegacyUser(String identifier) {
        String id = identifier.trim();
        if (id.contains("@")) {
            return userRepository.findFirstByEmailIgnoreCase(id);
        }
        return userRepository.findByMobile(id);
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}

package com.clinic.hms.security;

import com.clinic.hms.config.AuthProperties;
import com.clinic.hms.config.AuthentikProperties;
import com.clinic.hms.config.CorsAppProperties;
import com.clinic.hms.security.authentik.AuthentikJwtAuthenticationConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final ObjectProvider<JwtAuthenticationFilter> jwtAuthenticationFilter;
    private final ObjectProvider<JwtDecoder> jwtDecoder;
    private final ObjectProvider<AuthentikJwtAuthenticationConverter> authentikJwtConverter;
    private final AuthentikProperties authentikProperties;
    private final AuthProperties authProperties;
    private final CorsAppProperties corsAppProperties;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean authentik = authentikProperties.isEnabled();
        boolean legacy = authProperties.isLegacyEnabled();
        boolean requireAuth = authentik || legacy;

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    auth.requestMatchers(
                            "/swagger-ui/**",
                            "/swagger-ui.html",
                            "/v3/api-docs/**",
                            "/api-docs/**",
                            "/actuator/health",
                            "/actuator/health/**"
                    ).permitAll();
                    if (legacy) {
                        auth.requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll();
                    }
                    if (requireAuth) {
                        auth.requestMatchers("/api/**").authenticated();
                        auth.anyRequest().permitAll();
                    } else {
                        auth.anyRequest().permitAll();
                    }
                });

        if (authentik) {
            JwtDecoder decoder = jwtDecoder.getObject();
            AuthentikJwtAuthenticationConverter converter = authentikJwtConverter.getObject();
            http.oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                    .decoder(decoder)
                    .jwtAuthenticationConverter(converter)
            ));
        }

        JwtAuthenticationFilter legacyFilter = jwtAuthenticationFilter.getIfAvailable();
        if (legacyFilter != null) {
            http.addFilterBefore(legacyFilter, UsernamePasswordAuthenticationFilter.class);
        }

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return NoOpPasswordEncoder.getInstance();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = corsAppProperties.getAllowedOrigins();
        if (origins == null || origins.isEmpty()) {
            config.setAllowedOriginPatterns(List.of("*"));
        } else {
            config.setAllowedOrigins(origins);
        }
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        source.registerCorsConfiguration("/ws/**", config);
        return source;
    }
}

package com.clinic.hms.service;

import com.clinic.hms.dto.request.UserProfileUpdateRequest;
import com.clinic.hms.dto.response.UserProfileResponse;
import com.clinic.hms.entity.User;
import com.clinic.hms.entity.UserDetails;
import com.clinic.hms.repository.UserDetailsRepository;
import com.clinic.hms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final UserDetailsRepository userDetailsRepository;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toResponse(user, userDetailsRepository.findByUser(user).orElse(null));
    }

    @Transactional
    public UserProfileResponse updateProfile(Long userId, UserProfileUpdateRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (req.getEmail() != null) {
            user.setEmail(blankToNull(req.getEmail()));
        }
        if (req.getAuthentikUserId() != null) {
            String ak = blankToNull(req.getAuthentikUserId());
            if (ak != null) {
                userRepository.findByAuthentikUserId(ak).ifPresent(other -> {
                    if (!other.getId().equals(userId)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "authentik_user_id already linked");
                    }
                });
            }
            user.setAuthentikUserId(ak);
        }
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        UserDetails details = userDetailsRepository.findByUser(user).orElse(null);
        if (details == null && hasAnyDetail(req)) {
            details = UserDetails.builder()
                    .user(user)
                    .fullName(req.getFullName() != null ? req.getFullName() : user.getMobile())
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
        }
        if (details != null) {
            if (req.getFullName() != null) details.setFullName(req.getFullName());
            if (req.getSpeciality() != null) details.setSpeciality(blankToNull(req.getSpeciality()));
            if (req.getLicenseNumber() != null) details.setLicenseNumber(blankToNull(req.getLicenseNumber()));
            if (req.getAddressLine() != null) details.setAddressLine(blankToNull(req.getAddressLine()));
            if (req.getCity() != null) details.setCity(blankToNull(req.getCity()));
            if (req.getState() != null) details.setState(blankToNull(req.getState()));
            if (req.getPostalCode() != null) details.setPostalCode(blankToNull(req.getPostalCode()));
            if (req.getCountry() != null) details.setCountry(blankToNull(req.getCountry()));
            if (req.getProviderType() != null) details.setProviderType(blankToNull(req.getProviderType()));
            if (req.getProviderScope() != null) details.setProviderScope(blankToNull(req.getProviderScope()));
            if (req.getBusinessName() != null) details.setBusinessName(blankToNull(req.getBusinessName()));
            if (req.getContactPhone() != null) details.setContactPhone(blankToNull(req.getContactPhone()));
            details.setUpdatedAt(LocalDateTime.now());
            userDetailsRepository.save(details);
        }

        return toResponse(user, details);
    }

    public static UserProfileResponse toResponse(User user, UserDetails details) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .mobile(user.getMobile())
                .email(user.getEmail())
                .role(user.getRole())
                .authentikUserId(user.getAuthentikUserId())
                .isActive(user.getIsActive())
                .fullName(details != null ? details.getFullName() : null)
                .speciality(details != null ? details.getSpeciality() : null)
                .licenseNumber(details != null ? details.getLicenseNumber() : null)
                .addressLine(details != null ? details.getAddressLine() : null)
                .city(details != null ? details.getCity() : null)
                .state(details != null ? details.getState() : null)
                .postalCode(details != null ? details.getPostalCode() : null)
                .country(details != null ? details.getCountry() : null)
                .providerType(details != null ? details.getProviderType() : null)
                .providerScope(details != null ? details.getProviderScope() : null)
                .businessName(details != null ? details.getBusinessName() : null)
                .contactPhone(details != null ? details.getContactPhone() : null)
                .build();
    }

    private static boolean hasAnyDetail(UserProfileUpdateRequest req) {
        return req.getFullName() != null
                || req.getSpeciality() != null
                || req.getLicenseNumber() != null
                || req.getBusinessName() != null
                || req.getProviderType() != null
                || req.getAddressLine() != null
                || req.getCity() != null;
    }

    private static String blankToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }
}

package com.clinic.hms.service;

import com.clinic.hms.constants.ServiceProviderTypes;
import com.clinic.hms.constants.UserRoles;
import com.clinic.hms.dto.request.ServiceProviderCreateRequest;
import com.clinic.hms.dto.response.ServiceProviderResponse;
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
import java.util.List;

@Service
@RequiredArgsConstructor
public class ServiceProviderService {

    private final UserRepository userRepository;
    private final UserDetailsRepository userDetailsRepository;

    @Transactional(readOnly = true)
    public List<ServiceProviderResponse> list() {
        return userRepository.findByRole(UserRoles.SERVICE_PROVIDER).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ServiceProviderResponse create(ServiceProviderCreateRequest req) {
        if (req.getMobile() == null || req.getMobile().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mobile required");
        }
        if (req.getPassword() == null || req.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password required");
        }
        if (userRepository.existsByMobile(req.getMobile().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "mobile already registered");
        }

        String providerType = req.getProviderType() != null ? req.getProviderType().trim().toUpperCase() : ServiceProviderTypes.OTHER;
        if (!ServiceProviderTypes.ALL.contains(providerType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid providerType");
        }
        String scope = req.getProviderScope() != null ? req.getProviderScope().trim().toUpperCase() : ServiceProviderTypes.SCOPE_INDEPENDENT;
        if (!ServiceProviderTypes.SCOPE_INDEPENDENT.equals(scope) && !ServiceProviderTypes.SCOPE_INTERNAL.equals(scope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid providerScope");
        }

        LocalDateTime now = LocalDateTime.now();
        User user = User.builder()
                .mobile(req.getMobile().trim())
                .password(req.getPassword())
                .role(UserRoles.SERVICE_PROVIDER)
                .email(req.getEmail() != null ? req.getEmail().trim() : null)
                .isActive(true)
                .createdAt(now)
                .updatedAt(now)
                .build();
        user = userRepository.save(user);

        String fullName = req.getFullName() != null && !req.getFullName().isBlank()
                ? req.getFullName().trim()
                : (req.getBusinessName() != null ? req.getBusinessName().trim() : user.getMobile());

        UserDetails details = UserDetails.builder()
                .user(user)
                .fullName(fullName)
                .businessName(req.getBusinessName())
                .providerType(providerType)
                .providerScope(scope)
                .licenseNumber(req.getLicenseNumber())
                .contactPhone(req.getContactPhone())
                .addressLine(req.getAddressLine())
                .city(req.getCity())
                .state(req.getState())
                .postalCode(req.getPostalCode())
                .country(req.getCountry())
                .createdAt(now)
                .updatedAt(now)
                .build();
        userDetailsRepository.save(details);

        return toResponse(user);
    }

    private ServiceProviderResponse toResponse(User user) {
        UserDetails d = userDetailsRepository.findByUser(user).orElse(null);
        return ServiceProviderResponse.builder()
                .id(user.getId())
                .mobile(user.getMobile())
                .email(user.getEmail())
                .fullName(d != null ? d.getFullName() : null)
                .businessName(d != null ? d.getBusinessName() : null)
                .providerType(d != null ? d.getProviderType() : null)
                .providerScope(d != null ? d.getProviderScope() : null)
                .licenseNumber(d != null ? d.getLicenseNumber() : null)
                .contactPhone(d != null ? d.getContactPhone() : null)
                .city(d != null ? d.getCity() : null)
                .isActive(user.getIsActive())
                .build();
    }
}

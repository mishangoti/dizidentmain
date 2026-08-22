package com.clinic.hms.controller;

import com.clinic.hms.dto.request.UserProfileUpdateRequest;
import com.clinic.hms.dto.response.UserProfileResponse;
import com.clinic.hms.dto.response.UserSummaryResponse;
import com.clinic.hms.entity.User;
import com.clinic.hms.entity.UserDetails;
import com.clinic.hms.repository.UserDetailsRepository;
import com.clinic.hms.repository.UserRepository;
import com.clinic.hms.service.UserProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final UserDetailsRepository userDetailsRepository;
    private final UserProfileService userProfileService;

    @GetMapping
    public List<UserSummaryResponse> list(@RequestParam(value = "role", required = false) String role) {
        List<User> users = role == null || role.isBlank()
                ? userRepository.findAll()
                : userRepository.findByRole(role.toUpperCase());

        return users.stream()
                .map(user -> {
                    String name = userDetailsRepository.findByUser(user)
                            .map(UserDetails::getFullName)
                            .orElse(user.getMobile());

                    return UserSummaryResponse.builder()
                            .id(user.getId())
                            .name(name)
                            .mobile(user.getMobile())
                            .email(user.getEmail())
                            .role(user.getRole())
                            .authentikUserId(user.getAuthentikUserId())
                            .build();
                })
                .toList();
    }

    @GetMapping("/{id}/profile")
    public ResponseEntity<UserProfileResponse> getProfile(@PathVariable("id") Long id) {
        return ResponseEntity.ok(userProfileService.getProfile(id));
    }

    @PutMapping("/{id}/profile")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @PathVariable("id") Long id,
            @RequestBody UserProfileUpdateRequest req
    ) {
        return ResponseEntity.ok(userProfileService.updateProfile(id, req));
    }
}

package com.clinic.hms.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
@AllArgsConstructor
public class MeResponse {
    private Long userId;
    private String mobile;
    private String role;
    private String email;
    private String authentikUserId;
    private boolean linked;
    private String authSource;
}

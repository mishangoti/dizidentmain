package com.clinic.hms.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserSummaryResponse {

    private Long id;
    private String name;
    private String mobile;
    private String email;
    private String role;
    private String authentikUserId;
}

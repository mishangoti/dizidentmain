package com.clinic.hms.controller;

import com.clinic.hms.dto.request.ServiceProviderCreateRequest;
import com.clinic.hms.dto.response.ServiceProviderResponse;
import com.clinic.hms.service.ServiceProviderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/service-providers")
@RequiredArgsConstructor
public class ServiceProviderController {

    private final ServiceProviderService serviceProviderService;

    @GetMapping
    public ResponseEntity<List<ServiceProviderResponse>> list() {
        return ResponseEntity.ok(serviceProviderService.list());
    }

    @PostMapping
    public ResponseEntity<ServiceProviderResponse> create(@RequestBody ServiceProviderCreateRequest req) {
        return ResponseEntity.ok(serviceProviderService.create(req));
    }
}

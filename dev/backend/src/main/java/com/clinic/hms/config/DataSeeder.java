package com.clinic.hms.config;

import com.clinic.hms.constants.ServiceProviderTypes;
import com.clinic.hms.constants.UserRoles;
import com.clinic.hms.entity.*;
import com.clinic.hms.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Dev-only HMS user seed (FR-U3-1). Gated by {@code app.seed.enabled=true}.
 * Authentik provisioning is offline via {@code authentik/scripts/sync-hms-users.ps1}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DataSeeder implements CommandLineRunner {

    public static final String MOBILE_SUPERADMIN = "9999999999";
    public static final String MOBILE_ORG = "8888888888";
    public static final String MOBILE_DOCTOR = "7777777777";
    public static final String MOBILE_SERVICE_PROVIDER = "6666666666";
    public static final String MOBILE_PATIENT = "5555555555";

    private final UserRepository userRepository;
    private final UserDetailsRepository userDetailsRepository;
    private final OrgDoctorMappingRepository orgDoctorMappingRepository;
    private final OrgPatientMappingRepository orgPatientMappingRepository;
    private final AppointmentRepository appointmentRepository;
    private final VisitRepository visitRepository;
    private final BillRepository billRepository;
    private final LabRepository labRepository;
    private final VendorRepository vendorRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final PrescriptionRepository prescriptionRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        User superAdmin = seedSuperAdmin();
        User defaultOrg = seedDefaultOrg();
        seedDoctor(defaultOrg);
        seedServiceProvider();
        seedPatient(defaultOrg);
        linkExistingData(defaultOrg);
        log.info("✅ Auth seed complete (superadmin={}, org={}, doctor={}, sp={}, patient={})",
                superAdmin.getMobile(), defaultOrg.getMobile(),
                MOBILE_DOCTOR, MOBILE_SERVICE_PROVIDER, MOBILE_PATIENT);
    }

    private User seedSuperAdmin() {
        User superAdmin = ensureUser(
                MOBILE_SUPERADMIN, "admin123", UserRoles.SUPERADMIN, "superadmin@dizidental.local");
        ensureDetails(superAdmin, details -> {
            details.setFullName("DiziDental Superadmin");
        });
        return superAdmin;
    }

    private User seedDefaultOrg() {
        User defaultOrg = ensureUser(MOBILE_ORG, "org123", UserRoles.ORG, "org@dizidental.local");
        ensureDetails(defaultOrg, details -> details.setFullName("Default Clinic Org"));
        return defaultOrg;
    }

    private User seedDoctor(User defaultOrg) {
        User doctor = ensureUser(MOBILE_DOCTOR, "doctor123", UserRoles.DOCTOR, "doctor@dizidental.local");
        ensureDetails(doctor, details -> {
            details.setFullName("Seed Doctor");
            details.setSpeciality("General Dentistry");
            details.setLicenseNumber("DEV-DOC-001");
        });

        if (!orgDoctorMappingRepository.existsByOrgAndDoctor(defaultOrg, doctor)) {
            OrgDoctorMapping mapping = OrgDoctorMapping.builder()
                    .org(defaultOrg)
                    .doctor(doctor)
                    .createdAt(LocalDateTime.now())
                    .build();
            orgDoctorMappingRepository.save(mapping);
            log.info("🔗 Linked seed doctor {} to default org", doctor.getMobile());
        }
        return doctor;
    }

    private User seedServiceProvider() {
        User sp = ensureUser(
                MOBILE_SERVICE_PROVIDER, "sp123", UserRoles.SERVICE_PROVIDER, "sp@dizidental.local");
        ensureDetails(sp, details -> {
            details.setFullName("Seed Lab Provider");
            details.setBusinessName("Dev Partner Lab");
            details.setProviderType(ServiceProviderTypes.LAB);
            details.setProviderScope(ServiceProviderTypes.SCOPE_INDEPENDENT);
            details.setContactPhone(MOBILE_SERVICE_PROVIDER);
        });
        return sp;
    }

    private User seedPatient(User defaultOrg) {
        User patient = ensureUser(MOBILE_PATIENT, "patient123", UserRoles.PATIENT, "patient@dizidental.local");
        ensureDetails(patient, details -> details.setFullName("Seed Patient"));

        if (!orgPatientMappingRepository.existsByOrgAndPatient(defaultOrg, patient)) {
            OrgPatientMapping mapping = OrgPatientMapping.builder()
                    .org(defaultOrg)
                    .patient(patient)
                    .createdAt(LocalDateTime.now())
                    .build();
            orgPatientMappingRepository.save(mapping);
            log.info("🔗 Linked seed patient {} to default org", patient.getMobile());
        }
        return patient;
    }

    private User ensureUser(String mobile, String password, String role, String email) {
        User user = userRepository.findByMobile(mobile).orElse(null);
        if (user == null) {
            user = User.builder()
                    .mobile(mobile)
                    .password(password)
                    .role(role)
                    .email(email)
                    .isActive(true)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            user = userRepository.save(user);
            log.info("✅ Seeded HMS user {} ({})", mobile, role);
            return user;
        }

        boolean changed = false;
        if (!role.equalsIgnoreCase(user.getRole())) {
            user.setRole(role);
            changed = true;
        }
        if (user.getEmail() == null || !email.equalsIgnoreCase(user.getEmail())) {
            user.setEmail(email);
            changed = true;
        }
        if (user.getPassword() == null || !password.equals(user.getPassword())) {
            user.setPassword(password);
            changed = true;
        }
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            user.setIsActive(true);
            changed = true;
        }
        if (changed) {
            user.setUpdatedAt(LocalDateTime.now());
            user = userRepository.save(user);
            log.info("✅ Refreshed seed credentials for {} ({})", mobile, role);
        }
        return user;
    }

    private void ensureDetails(User user, java.util.function.Consumer<UserDetails> customizer) {
        UserDetails details = userDetailsRepository.findByUser(user).orElse(null);
        if (details == null) {
            details = UserDetails.builder()
                    .user(user)
                    .fullName(user.getMobile())
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            customizer.accept(details);
            userDetailsRepository.save(details);
            log.info("✅ Seeded profile for {}", user.getMobile());
            return;
        }
        customizer.accept(details);
        details.setUpdatedAt(LocalDateTime.now());
        userDetailsRepository.save(details);
    }

    private void linkExistingData(User defaultOrg) {
        log.info("🔄 Checking and linking legacy data to Default Clinic Org...");

        List<User> doctors = userRepository.findByRole(UserRoles.DOCTOR);
        for (User doc : doctors) {
            if (!orgDoctorMappingRepository.existsByOrgAndDoctor(defaultOrg, doc)) {
                OrgDoctorMapping mapping = OrgDoctorMapping.builder()
                        .org(defaultOrg)
                        .doctor(doc)
                        .createdAt(LocalDateTime.now())
                        .build();
                orgDoctorMappingRepository.save(mapping);
                log.info("🔗 Linked doctor {} to default clinic org", doc.getMobile());
            }
        }

        List<User> patients = userRepository.findByRole(UserRoles.PATIENT);
        for (User pat : patients) {
            if (!orgPatientMappingRepository.existsByOrgAndPatient(defaultOrg, pat)) {
                OrgPatientMapping mapping = OrgPatientMapping.builder()
                        .org(defaultOrg)
                        .patient(pat)
                        .createdAt(LocalDateTime.now())
                        .build();
                orgPatientMappingRepository.save(mapping);
                log.info("🔗 Linked patient {} to default clinic org", pat.getMobile());
            }
        }

        for (Appointment appt : appointmentRepository.findAll()) {
            if (appt.getOrg() == null) {
                appt.setOrg(defaultOrg);
                appointmentRepository.save(appt);
            }
        }

        for (Visit v : visitRepository.findAll()) {
            if (v.getOrg() == null) {
                v.setOrg(defaultOrg);
                visitRepository.save(v);
            }
        }

        for (Bill b : billRepository.findAll()) {
            if (b.getOrg() == null) {
                b.setOrg(defaultOrg);
                billRepository.save(b);
            }
        }

        for (Lab lab : labRepository.findAll()) {
            if (lab.getOrg() == null) {
                lab.setOrg(defaultOrg);
                labRepository.save(lab);
            }
        }

        for (Vendor ven : vendorRepository.findAll()) {
            if (ven.getOrg() == null) {
                ven.setOrg(defaultOrg);
                vendorRepository.save(ven);
            }
        }

        for (InventoryItem item : inventoryItemRepository.findAll()) {
            if (item.getOrg() == null) {
                item.setOrg(defaultOrg);
                inventoryItemRepository.save(item);
            }
        }

        for (Prescription rx : prescriptionRepository.findAll()) {
            if (rx.getOrg() == null) {
                rx.setOrg(defaultOrg);
                prescriptionRepository.save(rx);
            }
        }

        log.info("✅ Legacy data mapping checked successfully");
    }
}

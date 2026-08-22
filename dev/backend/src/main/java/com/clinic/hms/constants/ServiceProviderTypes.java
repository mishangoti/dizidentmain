package com.clinic.hms.constants;

import java.util.Set;

public final class ServiceProviderTypes {
    public static final String PHARMACY = "PHARMACY";
    public static final String LAB = "LAB";
    public static final String RADIOLOGY = "RADIOLOGY";
    public static final String PATHOLOGY = "PATHOLOGY";
    public static final String BLOOD_BANK = "BLOOD_BANK";
    public static final String AMBULANCE = "AMBULANCE";
    public static final String ORTHODONTIC_LAB = "ORTHODONTIC_LAB";
    public static final String BED_MANAGER = "BED_MANAGER";
    public static final String OTHER = "OTHER";

    public static final Set<String> ALL = Set.of(
            PHARMACY, LAB, RADIOLOGY, PATHOLOGY, BLOOD_BANK,
            AMBULANCE, ORTHODONTIC_LAB, BED_MANAGER, OTHER
    );

    public static final String SCOPE_INDEPENDENT = "INDEPENDENT";
    public static final String SCOPE_INTERNAL = "INTERNAL";

    private ServiceProviderTypes() {}
}

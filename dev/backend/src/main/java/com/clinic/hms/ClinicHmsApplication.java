package com.clinic.hms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ClinicHmsApplication {

	public static void main(String[] args) {
		SpringApplication.run(ClinicHmsApplication.class, args);
	}

}

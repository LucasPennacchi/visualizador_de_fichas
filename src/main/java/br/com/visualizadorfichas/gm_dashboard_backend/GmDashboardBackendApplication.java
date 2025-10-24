package br.com.visualizadorfichas.gm_dashboard_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;


@EnableScheduling
@SpringBootApplication
public class GmDashboardBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(GmDashboardBackendApplication.class, args);
	}

}

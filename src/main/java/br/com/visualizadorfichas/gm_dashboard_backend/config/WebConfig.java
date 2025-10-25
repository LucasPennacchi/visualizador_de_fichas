package br.com.visualizadorfichas.gm_dashboard_backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                // CORREÇÃO: Trocámos o padrão wildcard por origens explícitas
                .allowedOrigins(
                        "https://lucaspennacchi.github.io", // A sua página de produção
                        "http://localhost:8080",            // O seu frontend local (quando servido pelo 'docs')
                        "http://127.0.0.1:8080"           // Outra forma de aceder localmente
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowCredentials(true); // Permitir credenciais (necessário para SockJS)
    }
}


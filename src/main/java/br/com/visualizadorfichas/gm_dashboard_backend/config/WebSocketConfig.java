package br.com.visualizadorfichas.gm_dashboard_backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // CORREÇÃO: Trocámos o padrão wildcard por origens explícitas
        registry.addEndpoint("/ws")
                .setAllowedOrigins(
                        "https://lucaspennacchi.github.io", // A sua página de produção
                        "http://localhost:8080",            // O seu frontend local
                        "http://127.0.0.1:8080"           // Outra forma de aceder localmente
                )
                .withSockJS();
    }
}


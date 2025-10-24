package br.com.visualizadorfichas.gm_dashboard_backend.controller;

import br.com.visualizadorfichas.gm_dashboard_backend.service.CharacterDataService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.util.Set;

@Controller
public class WebSocketController {

    private final CharacterDataService characterDataService;

    public WebSocketController(CharacterDataService characterDataService) {
        this.characterDataService = characterDataService;
    }

    // Ouve por mensagens enviadas para "/app/subscribe"
    // (O frontend não envia mais 'SUBSCRIBE_LINKS', ele envia para este canal)
    @MessageMapping("/subscribe")
    public void handleSubscription(Set<String> links) {
        characterDataService.setWatchedLinks(links);
    }
}
package br.com.visualizadorfichas.gm_dashboard_backend.service;

import br.com.visualizadorfichas.gm_dashboard_backend.model.FirestoreResponse;
// import lombok.extern.slf4j.Slf4j; // 1. REMOVIDO O @Slf4j
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

// 2. IMPORTS ADICIONADOS
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// @Slf4j // 1. ANOTAÇÃO REMOVIDA
@Service
public class CharacterDataService {

    // 3. VARIÁVEL 'log' DECLARADA MANUALMENTE
    private static final Logger log = LoggerFactory.getLogger(CharacterDataService.class);

    // 1. O substituto do "axios"
    private final WebClient webClient;

    // 2. O substituto do "wss.clients.forEach(...)"
    private final SimpMessagingTemplate messagingTemplate;

    // 3. O substituto do "characterCache"
    private final Map<String, FirestoreResponse> characterCache = new ConcurrentHashMap<>();

    // 4. O substituto da lógica de "clientSubscriptions"
    private final Set<String> watchedLinks = ConcurrentHashMap.newKeySet();

    // Injeção de dependências (o Spring faz isso)
    public CharacterDataService(WebClient.Builder webClientBuilder, SimpMessagingTemplate messagingTemplate) {
        this.webClient = webClientBuilder.build();
        this.messagingTemplate = messagingTemplate;
    }

    // Método para o WebSocket Controller chamar (Passo 6)
    public void setWatchedLinks(Set<String> links) {
        watchedLinks.clear();
        watchedLinks.addAll(links);
        log.info("Agora assistindo {} links", links.size());
        // Podemos disparar uma busca imediata se quisermos
    }

    // 5. O substituto do "setInterval"
    @Scheduled(fixedRate = 5000) // Roda a cada 5000ms
    public void fetchAndBroadcastUpdates() {
        if (watchedLinks.isEmpty()) {
            return; // Ninguém assistindo
        }

        log.info("Verificando {} fichas ativas...", watchedLinks.size());

        for (String link : watchedLinks) {
            String characterId = getCharacterIdFromUrl(link);
            if (characterId == null) continue;

            // 6. Buscando dados
            fetchFromFirestore(characterId)
                    .subscribe(newData -> { // 'subscribe' é como o '.then()' do 'await'
                        // 7. Comparando com o cache
                        FirestoreResponse oldData = characterCache.get(characterId);

                        if (!newData.equals(oldData)) {
                            log.info("Mudança detectada em: {}", characterId);
                            characterCache.put(characterId, newData);

                            // 8. Enviando via WebSocket (broadcast)
                            // Todos os clientes inscritos em "/topic/updates" receberão
                            // (Também precisamos enviar o link original que o frontend usa como ID)
                            Map<String, Object> payload = Map.of(
                                    "originalUrl", link,
                                    "data", newData
                            );
                            messagingTemplate.convertAndSend("/topic/updates", payload);
                        }
                    }, error -> {
                        log.error("Erro ao buscar ficha {}: {}", characterId, error.getMessage());
                    });
        }
    }

    // O substituto do "fetchFromGoogle"
    private Mono<FirestoreResponse> fetchFromFirestore(String characterId) {
        String firestoreUrl = String.format("https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/%s", characterId);

        return this.webClient.get()
                .uri(firestoreUrl)
                .retrieve()
                .bodyToMono(FirestoreResponse.class); // Magia: Converte JSON para nosso objeto
    }

    // O substituto do "getCharacterIdFromUrl"
    private String getCharacterIdFromUrl(String url) {
        try {
            java.net.URL targetUrl = new java.net.URL(url);
            String[] pathParts = targetUrl.getPath().split("/");
            return pathParts[pathParts.length - 1];
        } catch (Exception e) {
            log.error("URL inválida: {}", url);
            return null;
        }
    }
}

// --- Chaves do LocalStorage ---
export const LINKS_STORAGE_KEY = 'gm_dashboard_links';
export const DATA_STORAGE_KEY = 'gm_dashboard_data_cache';
export const HEADER_STATE_KEY = 'gm_dashboard_header_state';

/**
 * Descobre a URL base da API (para HTTP) e do WebSocket (para STOMP)
 */
function getApiUrl() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocal) {
        // Conectando ao backend Spring Boot local
        return "http://localhost:8080";
    }

    // Lógica para quando o frontend está no GitHub Pages
    const urlParams = new URLSearchParams(window.location.search);
    const wsHost = urlParams.get('ws'); // ex: meu-backend.onrender.com ou link.ngrok-free.dev

    if (wsHost) {
        return `https://${wsHost}`;
    }

    // Fallback de produção (se você tiver um backend fixo)
    // ATENÇÃO: Troque isso se você fizer deploy permanente do backend
    console.warn('Host WebSocket não fornecido via ?ws=, usando fallback perigoso.');
    return "https://SEU-BACKEND-PUBLICO-FIXO.com";
}

export const API_URL = getApiUrl();
export const SOCKET_URL = `${API_URL}/ws`; // Endpoint do Spring Boot WebSocket

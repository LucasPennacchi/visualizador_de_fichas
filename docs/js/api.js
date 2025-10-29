// js/api.js

let socket = null;
let onDataUpdateCallback = null; // Função a ser chamada quando os dados chegam

/**
 * Descobre qual endereço de WebSocket usar (Ngrok ou Localhost).
 */
function getWebSocketUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const wsHost = urlParams.get('ws'); // Pega o valor de "?ws=..."

    if (wsHost) {
        console.log(`[WebSocket] Usando host externo (via URL param): ${wsHost}`);
        return `wss://${wsHost}`;
    } else {
        console.log("[WebSocket] Usando host local (localhost:3000)");
        return 'ws://localhost:3000';
    }
}

/**
 * Inicia a conexão WebSocket e registra os handlers.
 * @param {function} onDataUpdate - Função que será chamada com os dados recebidos.
 * @param {function} onOpen - Função que será chamada quando a conexão abrir.
 */
export function connect(onDataUpdate, onOpen) {
    onDataUpdateCallback = onDataUpdate; // Salva o callback
    const WSS_URL = getWebSocketUrl();
    
    console.log(`[WebSocket] Conectando ao servidor: ${WSS_URL}...`);
    socket = new WebSocket(WSS_URL);

    // 1. O que fazer quando a conexão é aberta
    socket.onopen = () => {
        console.log('[WebSocket] Conectado!');
        onOpen(); // Chama o callback 'onOpen' (definido no main.js)
    };

    // 2. O que fazer quando o SERVIDOR envia uma mensagem
    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'DATA_UPDATE' && message.payload) {
                console.log(`[WebSocket] Recebidos ${message.payload.length} updates.`);
                // Chama o callback principal com os dados
                if (onDataUpdateCallback) {
                    onDataUpdateCallback(message.payload);
                }
            }
        } catch (e) {
            console.error('[WebSocket] Erro ao processar mensagem:', e);
        }
    };

    // 3. O que fazer quando a conexão cai
    socket.onclose = () => {
        console.warn('[WebSocket] Desconectado. Tentando reconectar em 5 segundos...');
        socket = null;
        // Tenta reconectar (passando os mesmos callbacks)
        setTimeout(() => connect(onDataUpdate, onOpen), 5000);
    };

    // 4. Lidar com erros
    socket.onerror = (err) => {
        console.error('[WebSocket] Erro na conexão:', err);
        socket.close(); // Força o 'onclose' a rodar e tentar reconectar
    };
}

/**
 * Envia a lista de links para o servidor "assistir".
 * @param {string[]} links - Array de URLs.
 */
export function subscribeToLinks(links) {
    if (socket && socket.readyState === socket.OPEN) {
        console.log(`[WebSocket] Enviando ${links.length} links para assinatura...`);
        socket.send(JSON.stringify({
            type: 'SUBSCRIBE_LINKS',
            payload: links
        }));
    } else {
        console.warn('[WebSocket] Não conectado. Inscrição falhou.');
    }
}
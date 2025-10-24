import { API_URL } from './config.js';
import { getLinks } from './storage.js';
import { processBatchData } from './cardManager.js'; // Importa o processador de dados

/* global SockJS, Stomp */ // Informa ao linter que são globais (via index.html)

let stompClient = null;
let isConnected = false;
const SOCKET_URL = `${API_URL}/ws`;

function connect() {
    console.log('[STOMP] Conectando ao servidor...');

    // 1. Cria a conexão SockJS
    const socket = new SockJS(SOCKET_URL);
    // 2. "Envolve" com STOMP
    stompClient = Stomp.over(socket);
    stompClient.debug = null; // Desliga os logs de debug do STOMP no console

    // 3. Conecta
    stompClient.connect({},
        (frame) => { // onConnect
            isConnected = true;
            console.log('[STOMP] Conectado: ' + frame);

            // 4. Se inscreve no tópico de "broadcast"
            stompClient.subscribe('/topic/updates', (message) => {
                const payload = JSON.parse(message.body);
                // CORREÇÃO: Apenas passa o payload bruto.
                // O cardManager será responsável por achatar (flatten) e processar.
                // O backend envia 1 por 1, então envolvemos em um array
                processBatchData([payload]);
            });

            // 5. Envia a lista inicial de links
            subscribeToLinks(getLinks());
        },
        (error) => { // onError
            isConnected = false;
            console.error('[STOMP] Erro: ' + error);
            setTimeout(connect, 5000); // Tenta reconectar
        }
    );
}

/**
 * Envia a lista de links para o canal "/app/subscribe"
 */
function subscribeToLinks(links) {
    if (isConnected && stompClient) {
        console.log(`[STOMP] Enviando ${links.length} links para /app/subscribe...`);
        stompClient.send("/app/subscribe", {}, JSON.stringify(links));
    } else {
        console.warn('[STOMP] Não conectado. Inscrição falhou.');
    }
}

export { connect, subscribeToLinks };


/**
 * @module API
 * @description Gerencia a camada de comunicação em tempo real com o Servidor (Gateway).
 * Responsável por estabelecer a conexão WebSocket, negociar o protocolo de comunicação,
 * gerenciar estratégias de reconexão automática e despachar mensagens recebidas para a lógica de negócio.
 */

// --- Variáveis de Estado do Módulo ---

/**
 * Instância ativa da conexão WebSocket.
 * @type {WebSocket|null}
 * @private
 */
let socket = null;

/**
 * Referência à função de callback que processa atualizações de dados.
 * Invocada sempre que o servidor envia uma mensagem do tipo 'DATA_UPDATE'.
 * @type {DataUpdateCallback|null}
 * @private
 */
let onDataUpdateCallback = null;

// --- Definição de Tipos de Callback ---

/**
 * Callback para processar payload de dados.
 * @callback DataUpdateCallback
 * @param {Array<Object>} payload - Lista de objetos contendo dados das fichas atualizadas.
 */

/**
 * Callback executado quando a conexão é estabelecida.
 * @callback OnOpenCallback
 */

// --- Funções Auxiliares ---

/**
 * Determina dinamicamente a URL do endpoint WebSocket baseada nos parâmetros da URL atual.
 * Permite alternar transparentemente entre ambiente de desenvolvimento local e
 * ambiente de produção tunelado (ex: Ngrok) via query param '?ws='.
 * * @returns {string} A URL completa do WebSocket (ws:// ou wss://).
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

// --- Funções Exportadas ---

/**
 * Inicializa a conexão WebSocket e registra os listeners de eventos do ciclo de vida.
 * Implementa lógica de tolerância a falhas com reconexão automática (Exponential Backoff simulado).
 * * @param {DataUpdateCallback} onDataUpdate - Função injetada para lidar com recebimento de dados.
 * @param {OnOpenCallback} onOpen - Função injetada para lidar com o evento de conexão bem-sucedida.
 */
export function connect(onDataUpdate, onOpen) {
  onDataUpdateCallback = onDataUpdate; // Armazena referência para uso posterior
  const WSS_URL = getWebSocketUrl();
  
  console.log(`[WebSocket] Conectando ao servidor: ${WSS_URL}...`);
  socket = new WebSocket(WSS_URL);

  // 1. Handler de Conexão Estabelecida
  socket.onopen = () => {
    console.log('[WebSocket] Conectado!');
    // Notifica a aplicação que a conexão está pronta para uso (ex: para enviar inscrições)
    if (onOpen) onOpen(); 
  };

  // 2. Handler de Mensagens Recebidas (Ingress)
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      // Roteamento de mensagens baseado no 'type'
      if (message.type === 'DATA_UPDATE' && message.payload) {
        console.log(`[WebSocket] Recebidos ${message.payload.length} updates.`);
        
        // Despacha os dados para a camada de lógica (Main/Grid)
        if (onDataUpdateCallback) {
          onDataUpdateCallback(message.payload);
        }
      }
    } catch (e) {
      console.error('[WebSocket] Erro crítico ao processar mensagem recebida:', e);
    }
  };

  // 3. Handler de Fechamento de Conexão (Reconexão)
  socket.onclose = () => {
    console.warn('[WebSocket] Desconectado. Tentando reconectar em 5 segundos...');
    socket = null;
    // Agenda uma nova tentativa de conexão mantendo os mesmos callbacks
    setTimeout(() => connect(onDataUpdate, onOpen), 5000);
  };

  // 4. Handler de Erros de Rede
  socket.onerror = (err) => {
    console.error('[WebSocket] Erro na conexão:', err);
    // Fecha o socket explicitamente para garantir que o evento 'onclose' seja disparado e inicie a reconexão
    if (socket) socket.close(); 
  };
}

/**
 * Envia uma mensagem de protocolo (Egress) solicitando a inscrição em tópicos específicos.
 * Utilizada para informar ao Gateway quais fichas este cliente deseja monitorar.
 * * @param {Array<string>} links - Array de URLs ou IDs das fichas para assinatura.
 */
export function subscribeToLinks(links) {
  if (socket && socket.readyState === socket.OPEN) {
    console.log(`[WebSocket] Enviando ${links.length} links para assinatura...`);
    socket.send(JSON.stringify({
      type: 'SUBSCRIBE_LINKS',
      payload: links
    }));
  } else {
    console.warn('[WebSocket] Tentativa de envio falhou: Conexão não estabelecida.');
  }
}
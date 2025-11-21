/**
 * @module API
 * @description Gerencia a camada de comunicação em tempo real (WebSocket) entre o Cliente e o Gateway.
 * Responsável por estabelecer a conexão, gerenciar reconexões automáticas, rotear mensagens recebidas
 * para os callbacks apropriados e enviar comandos de controle (inscrição, gestão de salas).
 */

// --- Variáveis de Estado do Módulo ---

/** @type {WebSocket|null} Instância ativa do socket */
let socket = null;

/** @type {function(Array<Object>): void|null} Callback para dados de fichas */
let onDataUpdateCallback = null;

/** @type {function(Array<string>): void|null} Callback para sincronização de links */
let onRoomSyncCallback = null;

/** @type {function(string): void|null} Callback para sucesso na entrada de sala */
let onRoomJoinedCallback = null;

/** @type {function(Object): void|null} Callback para erros de sala */
let onRoomErrorCallback = null;

// --- Funções Auxiliares ---

/**
 * Determina a URL do endpoint WebSocket baseada nos parâmetros da URL atual.
 * Permite alternar entre ambiente local e produção (túnel) via query param '?ws='.
 * @returns {string} A URL completa do WebSocket (ws:// ou wss://).
 */
function getWebSocketUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const wsHost = urlParams.get('ws');

  if (wsHost) {
    console.log(`[WebSocket] Usando host externo: ${wsHost}`);
    return `wss://${wsHost}`;
  } else {
    console.log("[WebSocket] Usando host local");
    return 'ws://localhost:3000';
  }
}

// --- Funções Exportadas ---

/**
 * Inicializa a conexão WebSocket e registra os listeners de eventos.
 * Implementa lógica de tolerância a falhas com reconexão automática.
 * * @param {function(Array<Object>)} onDataUpdate - Handler para recebimento de dados de fichas.
 * @param {function()} onOpen - Handler para evento de conexão estabelecida.
 * @param {function(Array<string>)} onRoomSync - Handler para recebimento de lista de links sincronizada.
 * @param {function(string)} onRoomJoined - Handler para confirmação de entrada na sala (recebe o ID).
 * @param {function(Object)} onRoomError - Handler para erros operacionais de sala.
 */
export function connect(onDataUpdate, onOpen, onRoomSync, onRoomJoined, onRoomError) {
  onDataUpdateCallback = onDataUpdate;
  onRoomSyncCallback = onRoomSync;
  onRoomJoinedCallback = onRoomJoined;
  onRoomErrorCallback = onRoomError;
  
  const WSS_URL = getWebSocketUrl();
  
  console.log(`[WebSocket] Conectando ao servidor...`);
  socket = new WebSocket(WSS_URL);

  // 1. Conexão Estabelecida
  socket.onopen = () => {
    console.log('[WebSocket] Conectado!');
    if (onOpen) onOpen();
  };

  // 2. Recebimento de Mensagens
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'DATA_UPDATE':
          if (message.payload && onDataUpdateCallback) {
            onDataUpdateCallback(message.payload);
          }
          break;
          
        case 'ROOM_SYNC':
          if (message.payload && onRoomSyncCallback) {
            console.log('[WebSocket] Sincronização de sala recebida.');
            onRoomSyncCallback(message.payload.links);
          }
          break;

        case 'ROOM_JOINED':
          if (message.payload && onRoomJoinedCallback) {
            console.log(`[WebSocket] Entrou na sala: ${message.payload.roomId}`);
            onRoomJoinedCallback(message.payload.roomId);
          }
          break;

        case 'ROOM_ERROR':
          if (message.payload && onRoomErrorCallback) {
            console.warn(`[WebSocket] Erro de sala:`, message.payload);
            onRoomErrorCallback(message.payload);
          }
          break;
      }

    } catch (e) {
      console.error('[WebSocket] Erro crítico ao processar mensagem:', e);
    }
  };

  // 3. Perda de Conexão
  socket.onclose = () => {
    console.warn('[WebSocket] Desconectado. Tentando reconectar em 5 segundos...');
    socket = null;
    // Agenda reconexão mantendo os mesmos handlers
    setTimeout(() => connect(onDataUpdate, onOpen, onRoomSync, onRoomJoined, onRoomError), 5000);
  };

  // 4. Erro de Rede
  socket.onerror = (err) => {
    console.error('[WebSocket] Erro:', err);
    if (socket) socket.close(); // Força o fechamento para disparar 'onclose' e reconectar
  };
}

/**
 * Envia solicitação de inscrição em uma lista de links.
 * Usado no modo solo para atualizar o servidor sobre os links locais.
 * * @param {Array<string>} links - Lista de URLs a serem monitoradas.
 */
export function subscribeToLinks(links) {
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ 
      type: 'SUBSCRIBE_LINKS', 
      payload: links 
    }));
  }
}

/**
 * Envia comando para entrar em uma sala existente.
 * Envia também os links atuais do usuário para realizar o merge no servidor.
 * * @param {string} roomId - O código identificador da sala.
 * @param {Array<string>} currentLinks - Links locais do usuário.
 */
export function joinRoom(roomId, currentLinks) {
  if (socket && socket.readyState === socket.OPEN) {
    console.log(`[WebSocket] Solicitando entrada na sala ${roomId}...`);
    socket.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { roomId, currentLinks }
    }));
  }
}

/**
 * Envia comando para criar uma nova sala.
 * A sala será inicializada com os links atuais do usuário.
 * * @param {Array<string>} currentLinks - Links iniciais para a nova sala.
 */
export function createRoom(currentLinks) {
  if (socket && socket.readyState === socket.OPEN) {
    console.log(`[WebSocket] Solicitando criação de sala...`);
    socket.send(JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { currentLinks }
    }));
  }
}

/**
 * Envia comando para remover um link específico da sala atual.
 * Necessário pois o comando JOIN_ROOM realiza apenas adições (Merge).
 * * @param {string} roomId - O ID da sala onde a remoção deve ocorrer.
 * @param {string} link - O link completo a ser removido.
 */
export function removeLinkFromRoom(roomId, link) {
  if (socket && socket.readyState === socket.OPEN) {
    console.log(`[WebSocket] Solicitando remoção de link da sala...`);
    socket.send(JSON.stringify({ 
      type: 'REMOVE_LINK_FROM_ROOM', 
      payload: { roomId, link } 
    }));
  }
}

/**
 * Envia comando para sair da sala atual.
 * O servidor removerá este cliente da lista de membros da sala.
 */
export function leaveRoom() {
  if (socket && socket.readyState === socket.OPEN) {
    console.log(`[WebSocket] Saindo da sala...`);
    socket.send(JSON.stringify({ 
      type: 'LEAVE_ROOM' 
    }));
  }
}
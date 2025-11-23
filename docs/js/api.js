/**
 * @module API
 * @description Gerencia a camada de comunicação em tempo real (WebSocket) entre o Cliente e o Gateway.
 * Responsável por estabelecer a conexão, gerenciar reconexões automáticas, rotear mensagens recebidas
 * para os callbacks apropriados e enviar comandos de controle (Inscrição, Salas, Combate).
 * Implementa também lógica de "Loopback" para funcionalidades que devem operar offline (Modo Solo).
 */

// --- Variáveis de Estado do Módulo ---

/** @type {WebSocket|null} Instância ativa do socket */
let socket = null;

// Callbacks registrados
let onDataUpdateCallback = null;
let onRoomSyncCallback = null;
let onRoomJoinedCallback = null;
let onRoomErrorCallback = null;
let onCombatSyncCallback = null;

// --- Funções Auxiliares ---

/**
 * Determina a URL do endpoint WebSocket baseada nos parâmetros da URL atual.
 * @returns {string} A URL completa do WebSocket.
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
 * * @param {function} onDataUpdate - Handler para dados de fichas.
 * @param {function} onOpen - Handler para conexão estabelecida.
 * @param {function} onRoomSync - Handler para sincronização de lista da sala.
 * @param {function} onRoomJoined - Handler para confirmação de entrada na sala.
 * @param {function} onRoomError - Handler para erros operacionais de sala.
 * @param {function} onCombatSync - Handler para atualizações de estado de combate.
 */
export function connect(onDataUpdate, onOpen, onRoomSync, onRoomJoined, onRoomError, onCombatSync) {
  onDataUpdateCallback = onDataUpdate;
  onRoomSyncCallback = onRoomSync;
  onRoomJoinedCallback = onRoomJoined;
  onRoomErrorCallback = onRoomError;
  onCombatSyncCallback = onCombatSync;
  
  const WSS_URL = getWebSocketUrl();
  
  console.log(`[WebSocket] Conectando ao servidor...`);
  socket = new WebSocket(WSS_URL);

  // 1. Conexão Estabelecida
  socket.onopen = () => {
    console.log('[WebSocket] Conectado!');
    if (onOpen) onOpen();
  };

  // 2. Roteamento de Mensagens (Ingress)
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'DATA_UPDATE':
          if (message.payload && onDataUpdateCallback) onDataUpdateCallback(message.payload);
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

        case 'COMBAT_SYNC':
          if (message.payload && onCombatSyncCallback) {
            onCombatSyncCallback(message.payload);
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
    setTimeout(() => connect(onDataUpdate, onOpen, onRoomSync, onRoomJoined, onRoomError, onCombatSync), 5000);
  };

  // 4. Erro de Rede
  socket.onerror = (err) => {
    console.error('[WebSocket] Erro:', err);
    if (socket) socket.close();
  };
}

/**
 * Envia solicitação de inscrição em uma lista de links.
 * @param {Array<string>} links - Lista de URLs a serem monitoradas.
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
 * @param {string} roomId - O código identificador da sala.
 * @param {Array<string>} currentLinks - Links locais do usuário para merge.
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
 * @param {Array<string>} currentLinks - Links iniciais para a nova sala.
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
 * @param {string} roomId - O ID da sala.
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
 */
export function leaveRoom() {
  if (socket && socket.readyState === socket.OPEN) {
    console.log(`[WebSocket] Saindo da sala...`);
    socket.send(JSON.stringify({ 
      type: 'LEAVE_ROOM' 
    }));
  }
}

/**
 * Sincroniza o estado do combate.
 * Implementa lógica de "Loopback Local" (Offline First):
 * Se o usuário não estiver em uma sala (Modo Solo), a função retorna o estado imediatamente
 * para a própria aplicação sem passar pela rede, permitindo uso offline da ferramenta de combate.
 * * @param {Object} combatState - O objeto de estado do combate.
 */
export function updateCombatState(combatState) {
  // Verificação direta do storage para determinar o modo de operação
  const isInRoom = localStorage.getItem('gm_dashboard_room_id'); 
  
  // Verifica se estamos ONLINE E em uma SALA válida
  const isOnlineInRoom = isInRoom && socket && socket.readyState === WebSocket.OPEN;

  if (isOnlineInRoom) {
    // Modo Multiplayer: Envia para o servidor para broadcast
    console.log("[API] Enviando estado de combate para o servidor...");
    socket.send(JSON.stringify({ 
      type: 'COMBAT_UPDATE', 
      payload: combatState 
    }));
  } else {
    // Modo Solo: Simula o evento 'COMBAT_SYNC' localmente
    console.log('[API] Modo Solo: Loopback de combate local.');
    if (onCombatSyncCallback) {
        onCombatSyncCallback(combatState);
    } else {
        console.error("[API] Erro: Callback de combate não registrado.");
    }
  }
}
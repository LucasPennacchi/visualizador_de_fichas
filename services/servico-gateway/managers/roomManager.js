/**
 * @module Managers/Room
 * @description Gerencia a lógica de negócios para o ciclo de vida das salas (campanhas).
 * Responsável pela criação, entrada, saída, persistência e sincronização de estado (Links e Combate).
 */

const crypto = require('crypto');
const config = require('../config');
const state = require('../state');
const { redisClient } = require('../redis');
const subscriptionManager = require('./subscriptionManager');
const { getCharacterIdFromUrl } = require('../utils');

// --- Funções Auxiliares Internas ---

/**
 * Gera um identificador de sala curto e único.
 * @returns {string} ID hexadecimal.
 */
function generateRoomId() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Conta o número de clientes conectados a uma sala.
 * @param {string} roomId - O ID da sala.
 * @returns {number} Quantidade de clientes.
 */
function countClientsInRoom(roomId) {
    let count = 0;
    for (const rId of state.clientRooms.values()) {
        if (rId === roomId) count++;
    }
    return count;
}

/**
 * Envia uma mensagem para todos os membros conectados de uma sala.
 * @param {string} roomId - O ID da sala alvo.
 * @param {Object} messageObj - O objeto da mensagem.
 * @param {WebSocketServer} [wsServer] - Opcional.
 */
function broadcastToRoom(roomId, messageObj, wsServer) {
    const msgString = JSON.stringify(messageObj);
    state.clientRooms.forEach((rId, ws) => {
        if (rId === roomId && ws.readyState === ws.OPEN) {
            ws.send(msgString);
        }
    });
}

// --- Funções Exportadas ---

/**
 * Processa a entrada de um cliente em uma sala existente.
 * Recupera o estado dos links E o estado do combate.
 * * @async
 * @param {WebSocket} ws - Conexão do cliente.
 * @param {string} roomId - ID da sala.
 * @param {Array<string>} userLinks - Links locais para merge.
 * @param {WebSocketServer} wsServer - Servidor WS.
 */
async function joinRoom(ws, roomId, userLinks, wsServer) {
    const roomKey = `sala:${roomId}`;
    
    const exists = await redisClient.exists(roomKey);
    if (!exists) {
        console.warn(`[RoomManager] Sala ${roomId} não encontrada.`);
        ws.send(JSON.stringify({ 
            type: 'ROOM_ERROR', 
            payload: { code: 'NOT_FOUND', message: 'Sala não encontrada.' } 
        }));
        return;
    }

    // Recupera dados completos da sala (Links + Combate)
    const roomJson = await redisClient.get(roomKey);
    let roomData = roomJson ? JSON.parse(roomJson) : {};
    
    // Garante estruturas padrão
    let roomLinks = roomData.links || [];
    let combatState = roomData.combat || { isActive: false, round: 1, turnIndex: -1, combatants: [] };

    // Merge de Links
    const mergedSet = new Set([...roomLinks, ...userLinks]);
    const finalLinks = Array.from(mergedSet);

    // Persistência (preservando o estado de combate existente)
    if (finalLinks.length > roomLinks.length || !roomJson) {
        roomData.links = finalLinks;
        // Garante que o combatState seja salvo se não existia
        if (!roomData.combat) roomData.combat = combatState;
        
        await redisClient.set(roomKey, JSON.stringify(roomData));
    }
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    // Atualiza Estado Local
    state.clientRooms.set(ws, roomId);
    const newIds = new Set(finalLinks.map(getCharacterIdFromUrl).filter(Boolean));
    state.clientSubscriptions.set(ws, newIds);

    // Processamento de Cold Start
    const initialData = await subscriptionManager.processLinksAndSubscribe(finalLinks);

    // Respostas
    ws.send(JSON.stringify({ type: 'ROOM_JOINED', payload: { roomId } }));
    
    broadcastToRoom(roomId, { 
        type: 'ROOM_SYNC', 
        payload: { links: finalLinks } 
    }, wsServer);

    // Sincroniza o combate imediatamente para quem entrou
    // (Se houver combate ativo, o novo usuário já entra vendo)
    ws.send(JSON.stringify({
        type: 'COMBAT_SYNC',
        payload: combatState
    }));

    if (initialData.length > 0) {
        ws.send(JSON.stringify({ type: 'DATA_UPDATE', payload: initialData }));
    }
}

/**
 * Atualiza o estado do combate de uma sala e sincroniza com todos.
 * Chamado quando o mestre inicia, para, avança turno ou reordena.
 * * @async
 * @param {string} roomId - ID da sala.
 * @param {Object} newCombatState - O novo objeto de estado do combate.
 */
async function updateCombatState(roomId, newCombatState) {
    const roomKey = `sala:${roomId}`;
    const roomJson = await redisClient.get(roomKey);
    
    if (!roomJson) return;

    const roomData = JSON.parse(roomJson);
    
    // Atualiza apenas a propriedade de combate, mantendo os links
    roomData.combat = newCombatState;

    await redisClient.set(roomKey, JSON.stringify(roomData));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    // Broadcast apenas do delta de combate
    broadcastToRoom(roomId, {
        type: 'COMBAT_SYNC',
        payload: newCombatState
    });
}

/**
 * Remove um link específico de uma sala.
 */
async function removeLink(roomId, linkToRemove) {
    console.log(`[RoomManager] Removendo link ${linkToRemove} da sala ${roomId}`);
    const roomKey = `sala:${roomId}`;
    
    const roomJson = await redisClient.get(roomKey);
    if (!roomJson) return;

    const roomData = JSON.parse(roomJson);
    const roomLinks = roomData.links || [];
    
    const newLinks = roomLinks.filter(link => link !== linkToRemove);
    roomData.links = newLinks; // Atualiza links, mantém combate

    await redisClient.set(roomKey, JSON.stringify(roomData));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    broadcastToRoom(roomId, { 
        type: 'ROOM_SYNC', 
        payload: { links: newLinks } 
    });
}

/**
 * Lógica para sair de uma sala e deletá-la se vazia.
 */
async function leaveRoom(ws) {
    const roomId = state.clientRooms.get(ws);
    if (roomId) {
        console.log(`[RoomManager] Cliente saindo da sala ${roomId}`);
        state.clientRooms.delete(ws);
        state.clientSubscriptions.set(ws, new Set());

        const remaining = countClientsInRoom(roomId);
        if (remaining === 0) {
            console.log(`[RoomManager] Sala ${roomId} vazia. Deletando.`);
            await redisClient.del(`sala:${roomId}`);
        }
    }
}

/**
 * Cria uma nova sala.
 */
async function createRoom(ws, initialLinks, wsServer) {
    const roomId = generateRoomId();
    const roomKey = `sala:${roomId}`;
    
    console.log(`[RoomManager] Criando sala ${roomId}.`);
    
    // Define estrutura inicial completa
    const initialData = {
        links: initialLinks,
        combat: { isActive: false, round: 1, turnIndex: -1, combatants: [] }
    };

    await redisClient.set(roomKey, JSON.stringify(initialData));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);
    
    await joinRoom(ws, roomId, initialLinks, wsServer);
}

module.exports = { joinRoom, leaveRoom, createRoom, removeLink, updateCombatState };
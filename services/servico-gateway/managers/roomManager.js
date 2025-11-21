/**
 * @module Managers/Room
 * @description Gerencia a lógica de negócios para o ciclo de vida das salas (campanhas).
 * Responsável pela criação, entrada, saída e persistência do estado das salas no Redis,
 * incluindo a validação de existência, fusão de dados (merge) e limpeza automática.
 */

const crypto = require('crypto');
const config = require('../config');
const state = require('../state');
const { redisClient } = require('../redis');
const subscriptionManager = require('./subscriptionManager');
const { getCharacterIdFromUrl } = require('../utils');

// --- Funções Auxiliares Internas ---

/**
 * Gera um identificador de sala curto e único (Hexadecimal).
 * @returns {string} ID da sala.
 */
function generateRoomId() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Conta o número de clientes conectados atualmente a uma sala específica.
 * @param {string} roomId - O ID da sala.
 * @returns {number} Quantidade de clientes ativos.
 */
function countClientsInRoom(roomId) {
    let count = 0;
    for (const rId of state.clientRooms.values()) {
        if (rId === roomId) count++;
    }
    return count;
}

/**
 * Envia uma mensagem serializada para todos os membros conectados de uma sala.
 * @param {string} roomId - O ID da sala alvo.
 * @param {Object} messageObj - O objeto da mensagem a ser enviado.
 */
function broadcastToRoom(roomId, messageObj) {
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
 * Valida a sala, realiza o merge dos links do usuário com os da sala
 * e sincroniza o estado atualizado com todos os participantes.
 * * @async
 * @param {WebSocket} ws - A conexão do cliente.
 * @param {string} roomId - O ID da sala.
 * @param {Array<string>} userLinks - Lista de links locais do usuário para merge.
 * @param {WebSocketServer} wsServer - Instância do servidor para broadcast.
 */
async function joinRoom(ws, roomId, userLinks, wsServer) {
    const roomKey = `sala:${roomId}`;
    
    // 1. Validação de Existência
    const exists = await redisClient.exists(roomKey);
    if (!exists) {
        console.warn(`[RoomManager] Acesso negado: Sala ${roomId} inexistente.`);
        ws.send(JSON.stringify({ 
            type: 'ROOM_ERROR', 
            payload: { code: 'NOT_FOUND', message: 'A sala solicitada não existe ou expirou.' } 
        }));
        return;
    }

    // 2. Recuperação e Fusão de Estado
    const roomJson = await redisClient.get(roomKey);
    let roomLinks = [];
    if (roomJson) {
        roomLinks = JSON.parse(roomJson).links || [];
    }

    // Utiliza Set para garantir unicidade dos links (Merge Aditivo)
    const mergedSet = new Set([...roomLinks, ...userLinks]);
    const finalLinks = Array.from(mergedSet);

    // 3. Persistência
    // Atualiza o Redis apenas se houve alteração na lista
    if (finalLinks.length > roomLinks.length || !roomJson) {
        await redisClient.set(roomKey, JSON.stringify({ links: finalLinks }));
    }
    // Renova o TTL da sala para manter a persistência ativa
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    // 4. Atualização de Estado Local (Gateway)
    state.clientRooms.set(ws, roomId);
    const newIds = new Set(finalLinks.map(getCharacterIdFromUrl).filter(Boolean));
    state.clientSubscriptions.set(ws, newIds);

    // 5. Processamento de Assinaturas (Cold Start)
    // Garante que o Gateway esteja inscrito em todos os links da sala
    const initialData = await subscriptionManager.processLinksAndSubscribe(finalLinks);

    // 6. Notificações
    // Confirma entrada para o solicitante
    ws.send(JSON.stringify({ type: 'ROOM_JOINED', payload: { roomId } }));
    
    // Sincroniza a lista completa para TODOS na sala
    broadcastToRoom(roomId, { 
        type: 'ROOM_SYNC', 
        payload: { links: finalLinks } 
    });

    // Envia dados iniciais (snapshot) para o solicitante renderizar a tela
    if (initialData.length > 0) {
        ws.send(JSON.stringify({ type: 'DATA_UPDATE', payload: initialData }));
    }
}

/**
 * Remove um link específico de uma sala e notifica os participantes.
 * Implementa a lógica de exclusão explícita, necessária devido ao comportamento aditivo do Join.
 * * @async
 * @param {string} roomId - O ID da sala.
 * @param {string} linkToRemove - A URL completa do link a ser removido.
 */
async function removeLink(roomId, linkToRemove) {
    console.log(`[RoomManager] Removendo link ${linkToRemove} da sala ${roomId}`);
    const roomKey = `sala:${roomId}`;
    
    const roomJson = await redisClient.get(roomKey);
    if (!roomJson) return;

    const roomLinks = JSON.parse(roomJson).links || [];

    // Filtra o link da lista
    const newLinks = roomLinks.filter(link => link !== linkToRemove);

    // Persiste o novo estado e renova validade
    await redisClient.set(roomKey, JSON.stringify({ links: newLinks }));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    // Notifica todos os membros para atualizarem suas interfaces localmente
    broadcastToRoom(roomId, { 
        type: 'ROOM_SYNC', 
        payload: { links: newLinks } 
    });
}

/**
 * Processa a saída de um cliente de uma sala.
 * Se a sala ficar vazia após a saída, ela é removida do Redis para liberar recursos.
 * * @async
 * @param {WebSocket} ws - A conexão do cliente.
 */
async function leaveRoom(ws) {
    const roomId = state.clientRooms.get(ws);
    if (roomId) {
        console.log(`[RoomManager] Cliente saindo da sala ${roomId}`);
        
        // Remove a associação do cliente com a sala
        state.clientRooms.delete(ws);
        // Reseta as inscrições do socket (ele volta ao estado "sem sala")
        state.clientSubscriptions.set(ws, new Set());

        // Verifica se a sala deve ser destruída
        const remaining = countClientsInRoom(roomId);
        if (remaining === 0) {
            console.log(`[RoomManager] Sala ${roomId} vazia. Removendo persistência.`);
            await redisClient.del(`sala:${roomId}`);
        }
    }
}

/**
 * Cria uma nova sala e inscreve o cliente criador nela.
 * * @async
 * @param {WebSocket} ws - A conexão do cliente.
 * @param {Array<string>} initialLinks - Links iniciais para popular a sala.
 * @param {WebSocketServer} wsServer - Instância do servidor.
 */
async function createRoom(ws, initialLinks, wsServer) {
    const roomId = generateRoomId();
    const roomKey = `sala:${roomId}`;
    
    console.log(`[RoomManager] Inicializando sala ${roomId}.`);
    
    // Cria o registro da sala no Redis antes do Join para passar na validação
    await redisClient.set(roomKey, JSON.stringify({ links: initialLinks }));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);
    
    await joinRoom(ws, roomId, initialLinks, wsServer);
}

module.exports = { joinRoom, leaveRoom, createRoom, removeLink };
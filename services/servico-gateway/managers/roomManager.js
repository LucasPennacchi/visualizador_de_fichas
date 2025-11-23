/**
 * @module Managers/Room
 * @description Gerencia a lógica de negócios para o ciclo de vida das salas.
 */

const crypto = require('crypto');
const config = require('../config');
const state = require('../state');
const { redisClient } = require('../redis');
const subscriptionManager = require('./subscriptionManager');
const { getCharacterIdFromUrl } = require('../utils');

function generateRoomId() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function broadcastToRoom(roomId, messageObj) {
    const msgString = JSON.stringify(messageObj);
    state.clientRooms.forEach((rId, ws) => {
        if (rId === roomId && ws.readyState === ws.OPEN) {
            ws.send(msgString);
        }
    });
}

function countClientsInRoom(roomId) {
    let count = 0;
    for (const rId of state.clientRooms.values()) {
        if (rId === roomId) count++;
    }
    return count;
}

async function joinRoom(ws, roomId, userLinks, wsServer) {
    const roomKey = `sala:${roomId}`;
    const exists = await redisClient.exists(roomKey);
    
    if (!exists) {
        ws.send(JSON.stringify({ type: 'ROOM_ERROR', payload: { code: 'NOT_FOUND' } }));
        return;
    }

    const roomJson = await redisClient.get(roomKey);
    let roomData = roomJson ? JSON.parse(roomJson) : {};
    
    let roomLinks = roomData.links || [];
    let combatState = roomData.combat || { isActive: false, round: 1, turnIndex: -1, combatants: [] };

    const mergedSet = new Set([...roomLinks, ...userLinks]);
    const finalLinks = Array.from(mergedSet);

    if (finalLinks.length > roomLinks.length || !roomData.links) {
        roomData.links = finalLinks;
        roomData.combat = combatState;
        await redisClient.set(roomKey, JSON.stringify(roomData));
    }
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    state.clientRooms.set(ws, roomId);
    const newIds = new Set(finalLinks.map(getCharacterIdFromUrl).filter(Boolean));
    state.clientSubscriptions.set(ws, newIds);

    const initialData = await subscriptionManager.processLinksAndSubscribe(finalLinks);

    ws.send(JSON.stringify({ type: 'ROOM_JOINED', payload: { roomId } }));
    
    broadcastToRoom(roomId, { type: 'ROOM_SYNC', payload: { links: finalLinks } });

    // Sincroniza estado do combate para quem entrou
    if (combatState.isActive) {
        ws.send(JSON.stringify({ type: 'COMBAT_SYNC', payload: combatState }));
    }

    if (initialData.length > 0) {
        ws.send(JSON.stringify({ type: 'DATA_UPDATE', payload: initialData }));
    }
}

/**
 * Atualiza o estado do combate e notifica a sala.
 */
async function updateCombatState(roomId, newCombatState) {
    const roomKey = `sala:${roomId}`;
    const roomJson = await redisClient.get(roomKey);
    if (!roomJson) return;

    const roomData = JSON.parse(roomJson);
    roomData.combat = newCombatState;

    await redisClient.set(roomKey, JSON.stringify(roomData));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    broadcastToRoom(roomId, { type: 'COMBAT_SYNC', payload: newCombatState });
}

async function removeLink(roomId, linkToRemove) {
    const roomKey = `sala:${roomId}`;
    const roomJson = await redisClient.get(roomKey);
    if (!roomJson) return;

    const roomData = JSON.parse(roomJson);
    const newLinks = (roomData.links || []).filter(l => l !== linkToRemove);
    roomData.links = newLinks;

    await redisClient.set(roomKey, JSON.stringify(roomData));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);

    broadcastToRoom(roomId, { type: 'ROOM_SYNC', payload: { links: newLinks } });
}

async function leaveRoom(ws) {
    const roomId = state.clientRooms.get(ws);
    if (roomId) {
        state.clientRooms.delete(ws);
        state.clientSubscriptions.set(ws, new Set());
        if (countClientsInRoom(roomId) === 0) {
            await redisClient.del(`sala:${roomId}`);
        }
    }
}

async function createRoom(ws, initialLinks, wsServer) {
    const roomId = generateRoomId();
    const roomKey = `sala:${roomId}`;
    
    const initialData = {
        links: initialLinks,
        combat: { isActive: false, round: 1, turnIndex: 0, combatants: [] }
    };

    await redisClient.set(roomKey, JSON.stringify(initialData));
    await redisClient.expire(roomKey, config.ROOM_EXPIRATION_SECONDS);
    
    await joinRoom(ws, roomId, initialLinks, wsServer);
}

module.exports = { joinRoom, leaveRoom, createRoom, removeLink, updateCombatState };
/**
 * @module Gateway/Entrypoint
 * @description Ponto de entrada do microserviço de Gateway.
 */

const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const config = require('./config');
const state = require('./state');
const { subscriberClient } = require('./redis');
const subManager = require('./managers/subscriptionManager');
const roomManager = require('./managers/roomManager');
const { getCharacterIdFromUrl } = require('./utils');

const app = express();
app.use(require('cors')());
app.use(require('compression')());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

subscriberClient.on('message', (channel, message) => {
    const characterId = channel.split(':')[1];
    if (!characterId) return;

    const wsMessage = JSON.stringify({
        type: 'DATA_UPDATE',
        payload: [JSON.parse(message)]
    });

    let hasActiveViewers = false;

    state.clientSubscriptions.forEach((subscribedIds, ws) => {
        if (subscribedIds.has(characterId) && ws.readyState === ws.OPEN) {
            ws.send(wsMessage);
            hasActiveViewers = true;
        }
    });

    if (hasActiveViewers) {
        if (state.orphanUpdatesCount.has(characterId)) state.orphanUpdatesCount.delete(characterId);
    } else {
        const currentCount = (state.orphanUpdatesCount.get(characterId) || 0) + 1;
        if (currentCount >= config.MAX_ORPHAN_UPDATES) {
            subscriberClient.unsubscribe(channel);
            state.activeRedisChannels.delete(channel);
            state.orphanUpdatesCount.delete(characterId);
        } else {
            state.orphanUpdatesCount.set(characterId, currentCount);
        }
    }
});

wss.on('connection', ws => {
    console.log('[Gateway] Cliente conectado.');
    state.clientSubscriptions.set(ws, new Set());

    ws.on('message', async (messageBuffer) => {
        let message;
        try { message = JSON.parse(messageBuffer.toString()); } catch (e) { return; }

        switch (message.type) {
            case 'SUBSCRIBE_LINKS':
                const newLinks = message.payload || [];
                const oldIds = state.clientSubscriptions.get(ws) || new Set();
                const initialData = await subManager.processLinksAndSubscribe(newLinks);
                const newIds = new Set(newLinks.map(getCharacterIdFromUrl).filter(Boolean));
                state.clientSubscriptions.set(ws, newIds);
                const removedIds = new Set([...oldIds].filter(x => !newIds.has(x)));
                subManager.cleanupOrphanSubscriptions(removedIds);
                if (initialData.length > 0) {
                    ws.send(JSON.stringify({ type: 'DATA_UPDATE', payload: initialData }));
                }
                break;

            case 'CREATE_ROOM':
                await roomManager.createRoom(ws, message.payload?.currentLinks || [], wss);
                break;

            case 'JOIN_ROOM':
                await roomManager.joinRoom(ws, message.payload.roomId, message.payload.currentLinks || [], wss);
                break;

            case 'REMOVE_LINK_FROM_ROOM':
                const currentRoom = state.clientRooms.get(ws);
                if (currentRoom && currentRoom === message.payload.roomId) {
                    await roomManager.removeLink(message.payload.roomId, message.payload.link);
                }
                break;

            // --- ROTA DE COMBATE (RESTAURADA) ---
            case 'COMBAT_UPDATE':
                const combatRoomId = state.clientRooms.get(ws);
                if (combatRoomId) {
                    await roomManager.updateCombatState(combatRoomId, message.payload);
                }
                break;

            case 'LEAVE_ROOM':
                await roomManager.leaveRoom(ws);
                break;
        }
    });

    ws.on('close', async () => {
        console.log('[Gateway] Desconectado.');
        const dyingIds = state.clientSubscriptions.get(ws) || new Set();
        await roomManager.leaveRoom(ws);
        state.clientSubscriptions.delete(ws);
        subManager.cleanupOrphanSubscriptions(dyingIds);
    });

    ws.on('error', (err) => console.error('[Gateway] Erro:', err.message));
});

server.listen(config.PORT, () => {
    console.log(`[Gateway] Servidor iniciado na porta ${config.PORT}`);
});
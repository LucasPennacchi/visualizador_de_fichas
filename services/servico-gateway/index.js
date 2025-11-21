/**
 * @module Gateway/Entrypoint
 * @description Ponto de entrada do microserviço de Gateway.
 * Inicializa o servidor HTTP/WebSocket e configura os ouvintes de eventos para
 * comunicação em tempo real via Redis Pub/Sub e WebSockets.
 * Atua como controlador principal, roteando as mensagens recebidas para os
 * gerenciadores de lógica de negócio apropriados.
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

// --- Configuração do Servidor ---

const app = express();
app.use(require('cors')());
app.use(require('compression')());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Listeners de Infraestrutura (Redis) ---

/**
 * Ouve mensagens publicadas no canal de atualizações do Redis.
 * Distribui os dados recebidos para os clientes WebSocket conectados que
 * manifestaram interesse no ID específico da ficha.
 * Gerencia também a limpeza de recursos para fichas sem espectadores ativos.
 */
subscriberClient.on('message', (channel, message) => {
    const characterId = channel.split(':')[1];
    if (!characterId) return;

    const wsMessage = JSON.stringify({
        type: 'DATA_UPDATE',
        payload: [JSON.parse(message)]
    });

    let hasActiveViewers = false;

    // Distribuição da mensagem (Multicast)
    state.clientSubscriptions.forEach((subscribedIds, ws) => {
        if (subscribedIds.has(characterId)) {
            if (ws.readyState === ws.OPEN) {
                ws.send(wsMessage);
                hasActiveViewers = true;
            }
        }
    });

    // Gerenciamento de Recursos (Garbage Collection Lógico)
    if (hasActiveViewers) {
        if (state.orphanUpdatesCount.has(characterId)) {
            state.orphanUpdatesCount.delete(characterId);
        }
    } else {
        const currentCount = (state.orphanUpdatesCount.get(characterId) || 0) + 1;
        
        if (currentCount >= config.MAX_ORPHAN_UPDATES) {
            console.log(`[Gateway] Monitoramento interrompido por inatividade: ${characterId}`);
            subscriberClient.unsubscribe(channel);
            state.activeRedisChannels.delete(channel);
            state.orphanUpdatesCount.delete(characterId);
        } else {
            state.orphanUpdatesCount.set(characterId, currentCount);
        }
    }
});

// --- Listeners de Aplicação (WebSocket) ---

wss.on('connection', ws => {
    console.log('[Gateway] Nova conexão de cliente estabelecida.');
    state.clientSubscriptions.set(ws, new Set());

    ws.on('message', async (messageBuffer) => {
        let message;
        try {
            message = JSON.parse(messageBuffer.toString());
        } catch (e) {
            return; // Ignora payloads malformados
        }

        // Roteamento de Comandos
        switch (message.type) {
            case 'SUBSCRIBE_LINKS':
                {
                    const newLinks = message.payload || [];
                    const oldIds = state.clientSubscriptions.get(ws) || new Set();
                    
                    // Orquestra a busca de dados e inscrição no Redis
                    const initialData = await subManager.processLinksAndSubscribe(newLinks);
                    
                    // Atualiza o estado de subscrição local
                    const newIds = new Set(newLinks.map(getCharacterIdFromUrl).filter(Boolean));
                    state.clientSubscriptions.set(ws, newIds);

                    // Identifica e limpa subscrições que não são mais necessárias
                    const removedIds = new Set([...oldIds].filter(x => !newIds.has(x)));
                    subManager.cleanupOrphanSubscriptions(removedIds);

                    // Envia snapshot inicial dos dados (Cache Hit)
                    // É AQUI que o Site A recebe os dados da ficha D
                    if (initialData.length > 0) {
                        ws.send(JSON.stringify({ type: 'DATA_UPDATE', payload: initialData }));
                    }
                }
                break;

            case 'CREATE_ROOM':
                await roomManager.createRoom(ws, message.payload?.currentLinks || [], wss);
                break;

            case 'JOIN_ROOM':
                await roomManager.joinRoom(ws, message.payload.roomId, message.payload.currentLinks || [], wss);
                break;

            case 'REMOVE_LINK_FROM_ROOM':
                // Validação de segurança: O cliente deve pertencer à sala que está tentando modificar
                const currentRoom = state.clientRooms.get(ws);
                if (currentRoom && currentRoom === message.payload.roomId) {
                    await roomManager.removeLink(message.payload.roomId, message.payload.link);
                }
                break;

            case 'LEAVE_ROOM':
                await roomManager.leaveRoom(ws);
                break;
        }
    });

    ws.on('close', async () => {
        console.log('[Gateway] Conexão de cliente encerrada.');
        
        // Captura estado anterior para limpeza
        const dyingIds = state.clientSubscriptions.get(ws) || new Set();
        
        // Executa lógica de saída de sala (incluindo destruição de sala vazia)
        await roomManager.leaveRoom(ws);
        
        // Limpa referências em memória
        state.clientSubscriptions.delete(ws);
        
        // Verifica se algum canal ficou órfão após a desconexão
        subManager.cleanupOrphanSubscriptions(dyingIds);
    });

    ws.on('error', (err) => {
        console.error('[Gateway] Erro na conexão WebSocket:', err.message);
    });
});

// --- Inicialização ---

server.listen(config.PORT, () => {
    console.log(`[Gateway] Servidor iniciado na porta ${config.PORT}`);
});
// services/servico-gateway/index.js
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const Redis = require('ioredis');
const { getCharacterIdFromUrl } = require('./utils');

const PORT = 3000;

// --- Configuração do Express ---
const app = express();
app.use(require('cors')());
app.use(require('compression')());

// --- Configuração dos Clientes Redis ---
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

// Cliente para comandos GET/SET e PUBLISH
const redisClient = new Redis(redisPort, redisHost);
// Cliente separado *apenas* para SUBSCRIBES (prática recomendada)
const subscriberClient = new Redis(redisPort, redisHost);

// --- Configuração do Servidor WebSocket ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Estado do Gateway ---
const clientSubscriptions = new Map();
const activeRedisChannels = new Set();

// --- Lógica Principal ---

/**
 * Lida com mensagens de atualização recebidas do Redis Pub/Sub
 * (Esta função está correta e não muda)
 */
subscriberClient.on('message', (channel, message) => {
    console.log(`[Redis Pub/Sub] Mensagem recebida no canal: ${channel}`);
    
    const characterId = channel.split(':')[1];
    if (!characterId) return;

    const wsMessage = JSON.stringify({
        type: 'DATA_UPDATE',
        payload: [JSON.parse(message)] 
    });

    clientSubscriptions.forEach((subscribedIds, ws) => {
        if (subscribedIds.has(characterId) && ws.readyState === ws.OPEN) {
            ws.send(wsMessage);
        }
    });
});

/**
 * Lida com novas conexões WebSocket
 */
wss.on('connection', ws => {
    console.log('[Gateway] Cliente conectado.');
    clientSubscriptions.set(ws, new Set());

    // O que fazer quando este cliente envia uma mensagem
    ws.on('message', async (messageBuffer) => {
        let message;
        try {
            message = JSON.parse(messageBuffer.toString());
        } catch (e) {
            console.error('[Gateway] Mensagem inválida (não-JSON) recebida.');
            return;
        }

        if (message.type === 'SUBSCRIBE_LINKS' && message.payload) {
            console.log(`[Gateway] Cliente se inscreveu em ${message.payload.length} links.`);
            
            const newIds = new Set();
            const initialDataPayload = [];

            for (const link of message.payload) {
                const charId = getCharacterIdFromUrl(link);
                if (!charId) continue;
                
                newIds.add(charId);
                
                const cacheKey = `ficha:${charId}`;
                const linkKey = `link:${charId}`;
                
                // 1. Armazena o mapeamento "ID -> Link" (como antes)
                await redisClient.set(linkKey, link);

                // 2. Tenta buscar os dados PUROS do cache
                const cachedDataJson = await redisClient.get(cacheKey);
                
                if (cachedDataJson) {
                    // SUCESSO (Cache Hit): A ficha já está no cache
                    console.log(`[Gateway] Cache hit para ${charId}.`);
                    const data = JSON.parse(cachedDataJson);
                    const payload = {
                        ...data,
                        originalUrl: link
                    };
                    initialDataPayload.push(payload);
                } else {
                    // FALHA (Cache Miss): A ficha não está no cache
                    console.log(`[Gateway] Cache miss para ${charId}. Solicitando busca...`);
                    // Pede ao(s) poller(s) para buscarem esta ficha AGORA.
                    const requestPayload = JSON.stringify({ charId: charId, originalUrl: link });
                    redisClient.publish('request:fetch', requestPayload);
                }

                // 4. Se inscreve no canal de updates (como antes)
                const channel = `updates:${charId}`;
                if (!activeRedisChannels.has(channel)) {
                    console.log(`[Redis Pub/Sub] Inscrevendo no novo canal: ${channel}`);
                    subscriberClient.subscribe(channel);
                    activeRedisChannels.add(channel);
                }
            }

            // Atualiza o que este cliente está assistindo
            clientSubscriptions.set(ws, newIds);
            
            // Envia a carga inicial (o que foi encontrado no cache)
            if (initialDataPayload.length > 0) {
                ws.send(JSON.stringify({
                    type: 'DATA_UPDATE',
                    payload: initialDataPayload
                }));
            }
        }
    });

    ws.on('close', () => {
        console.log('[Gateway] Cliente desconectado.');
        clientSubscriptions.delete(ws);
    });

    ws.on('error', (err) => {
        console.error('[Gateway] Erro no WebSocket:', err);
    });
});

// --- Inicia o Servidor ---
server.listen(PORT, () => {
    console.log(`[Gateway] Servidor (Express + WebSocket) rodando na porta ${PORT}`);
    console.log(`[Gateway] Conectando ao Redis em ${redisHost}:${redisPort}`);
});
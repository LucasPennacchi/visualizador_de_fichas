// services/servico-gateway/index.js

// --- Dependências ---
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const Redis = require('ioredis');
const { getCharacterIdFromUrl } = require('./utils');

// --- Constantes e Configurações ---
const PORT = 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const QUEUE_NAME = 'fila:trabalho:revalidar';

// Limite de atualizações órfãs (fallback de segurança)
const MAX_ORPHAN_UPDATES = 3;

// --- Configuração dos Clientes Redis ---
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);
const subscriberClient = new Redis(REDIS_PORT, REDIS_HOST);

// --- Configuração do Servidor ---
const app = express();
app.use(require('cors')());
app.use(require('compression')());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Gerenciamento de Estado ---
const clientSubscriptions = new Map();
const activeRedisChannels = new Set();
const orphanUpdatesCount = new Map();


// --- Helper: Verifica se alguma conexão ativa está assistindo um ID ---
function isAnyoneWatching(charId) {
    for (const [ws, subscribedIds] of clientSubscriptions) {
        // Verifica se o cliente está assistindo E se a conexão está aberta
        if (subscribedIds.has(charId) && ws.readyState === ws.OPEN) {
            return true;
        }
    }
    return false;
}


// --- Lógica do Redis Pub/Sub ---

subscriberClient.on('message', (channel, message) => {
    const characterId = channel.split(':')[1];
    if (!characterId) return;

    const wsMessage = JSON.stringify({
        type: 'DATA_UPDATE',
        payload: [JSON.parse(message)] 
    });

    let hasActiveViewers = false;

    clientSubscriptions.forEach((subscribedIds, ws) => {
        if (subscribedIds.has(characterId)) {
            if (ws.readyState === ws.OPEN) {
                ws.send(wsMessage);
                hasActiveViewers = true;
            }
        }
    });

    // Lógica de limpeza secundária (caso a limpeza imediata falhe ou conexões caiam silenciosamente)
    if (hasActiveViewers) {
        if (orphanUpdatesCount.has(characterId)) {
            orphanUpdatesCount.delete(characterId);
        }
    } else {
        const currentCount = (orphanUpdatesCount.get(characterId) || 0) + 1;
        console.log(`[Gateway] Ficha ${characterId} sem espectadores (Detectado no Update). Inatividade: ${currentCount}/${MAX_ORPHAN_UPDATES}`);

        if (currentCount >= MAX_ORPHAN_UPDATES) {
            console.log(`[Gateway] 🛑 Parando de monitorar ${characterId} por inatividade.`);
            subscriberClient.unsubscribe(channel);
            activeRedisChannels.delete(channel);
            orphanUpdatesCount.delete(characterId);
        } else {
            orphanUpdatesCount.set(characterId, currentCount);
        }
    }
});


// --- Lógica do WebSocket ---

wss.on('connection', ws => {
    console.log('[Gateway] Cliente conectado.');
    // Inicializa com um Set vazio para evitar erros de leitura antes da primeira msg
    clientSubscriptions.set(ws, new Set());

    ws.on('message', async (messageBuffer) => {
        let message;
        try {
            message = JSON.parse(messageBuffer.toString());
        } catch (e) {
            return;
        }

        if (message.type === 'SUBSCRIBE_LINKS' && Array.isArray(message.payload)) {
            console.log(`[Gateway] Processando inscrição de ${message.payload.length} links.`);
            
            // 1. Captura o estado ANTERIOR de inscrições deste cliente
            const oldIds = clientSubscriptions.get(ws) || new Set();
            
            // 2. Prepara o NOVO estado
            const newIds = new Set();
            const initialDataPayload = [];

            // Processa os novos links (Adição e Inscrição)
            for (const link of message.payload) {
                const charId = getCharacterIdFromUrl(link);
                if (!charId) continue;
                
                newIds.add(charId);
                
                // Se já estava assistindo, não precisa buscar cache nem re-assinar
                if (oldIds.has(charId)) continue;

                // --- Nova Inscrição Detectada ---
                const cacheKey = `ficha:${charId}`;
                const linkKey = `link:${charId}`;
                
                await redisClient.set(linkKey, link);
                const cachedDataJson = await redisClient.get(cacheKey);
                
                if (cachedDataJson) {
                    const data = JSON.parse(cachedDataJson);
                    initialDataPayload.push({ ...data, originalUrl: link });
                } else {
                    console.log(`[Gateway] Cache miss para ${charId}. Agendando busca.`);
                    const jobPayload = JSON.stringify({ charId, originalUrl: link, force: true });
                    await redisClient.lpush(QUEUE_NAME, jobPayload);
                }

                const channel = `updates:${charId}`;
                if (!activeRedisChannels.has(channel)) {
                    console.log(`[Redis Pub/Sub] + Inscrevendo no canal: ${channel}`);
                    subscriberClient.subscribe(channel);
                    activeRedisChannels.add(channel);
                    orphanUpdatesCount.delete(charId);
                }
            }
            
            // 3. ATUALIZA O ESTADO DO CLIENTE AGORA
            // Isso é crucial: atualizamos antes de verificar quem mais assiste
            clientSubscriptions.set(ws, newIds);
            
            // 4. Processa REMOÇÕES (Limpeza Imediata)
            // Verifica quais IDs estavam na lista antiga mas NÃO estão na nova
            for (const oldId of oldIds) {
                if (!newIds.has(oldId)) {
                    // O cliente parou de ver este ID.
                    // Pergunta: "Alguém MAIS está vendo isso?"
                    if (!isAnyoneWatching(oldId)) {
                        const channel = `updates:${oldId}`;
                        console.log(`[Gateway] - Ninguém mais assiste ${oldId}. Cancelando assinatura IMEDIATAMENTE.`);
                        
                        subscriberClient.unsubscribe(channel);
                        activeRedisChannels.delete(channel);
                        orphanUpdatesCount.delete(oldId);
                    }
                }
            }
            
            // Envia dados iniciais dos novos links
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
        
        // Captura o que o cliente estava vendo antes de deletar
        const dyingIds = clientSubscriptions.get(ws) || new Set();
        
        // Remove o cliente
        clientSubscriptions.delete(ws);

        // Limpeza Imediata pós-desconexão
        for (const dyingId of dyingIds) {
            if (!isAnyoneWatching(dyingId)) {
                const channel = `updates:${dyingId}`;
                console.log(`[Gateway] - (Desconexão) Ninguém mais assiste ${dyingId}. Cancelando.`);
                
                subscriberClient.unsubscribe(channel);
                activeRedisChannels.delete(channel);
                orphanUpdatesCount.delete(dyingId);
            }
        }
    });

    ws.on('error', (err) => {
        console.error('[Gateway] Erro no WebSocket:', err.message);
    });
});

server.listen(PORT, () => {
    console.log(`[Gateway] Servidor rodando na porta ${PORT}`);
});
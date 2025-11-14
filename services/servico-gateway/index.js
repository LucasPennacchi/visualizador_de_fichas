// services/servico-gateway/index.js

// --- Dependências ---
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const Redis = require('ioredis');
const { getCharacterIdFromUrl } = require('./utils');

// --- Constantes ---
const PORT = 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const QUEUE_NAME = 'fila:trabalho:revalidar'; // Fila de jobs para o worker

// --- Configuração dos Clientes Redis ---
// Cliente 1: Para comandos normais (GET, SET, LPUSH)
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);
// Cliente 2: Cliente dedicado para Assinaturas (SUBSCRIBE)
const subscriberClient = new Redis(REDIS_PORT, REDIS_HOST);

// --- Configuração do Servidor Web e WebSocket ---
const app = express();
app.use(require('cors')());
app.use(require('compression')());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Estado Interno do Gateway ---
// Map<ws (cliente), Set<string (ID da Ficha)>>
const clientSubscriptions = new Map();
// Set<string (Canal do Redis)> - Para evitar inscrições duplicadas no Redis
const activeRedisChannels = new Set();


// --- Lógica do Redis Pub/Sub (Recebimento de Atualizações) ---

// Escuta por mensagens nos canais que assinamos
subscriberClient.on('message', (channel, message) => {
    console.log(`[Redis Pub/Sub] Mensagem recebida no canal: ${channel}`);
    
    // Extrai o ID do canal (ex: "updates:ID_DA_FICHA")
    const characterId = channel.split(':')[1];
    if (!characterId) return;

    // Prepara a mensagem para o frontend (que espera um array)
    const wsMessage = JSON.stringify({
        type: 'DATA_UPDATE',
        payload: [JSON.parse(message)] 
    });

    // Envia a atualização para todos os clientes que assinaram este ID
    clientSubscriptions.forEach((subscribedIds, ws) => {
        if (subscribedIds.has(characterId) && ws.readyState === ws.OPEN) {
            ws.send(wsMessage);
        }
    });
});

// --- Lógica do WebSocket (Gerenciamento de Clientes) ---

wss.on('connection', ws => {
    console.log('[Gateway] Cliente conectado.');
    clientSubscriptions.set(ws, new Set()); // Registra o novo cliente

    // Lida com mensagens recebidas do cliente
    ws.on('message', async (messageBuffer) => {
        let message;
        try {
            message = JSON.parse(messageBuffer.toString());
        } catch (e) {
            console.error('[Gateway] Mensagem inválida (não-JSON) recebida.');
            return;
        }

        // Processa a inscrição do cliente em uma lista de links
        if (message.type === 'SUBSCRIBE_LINKS' && message.payload) {
            console.log(`[Gateway] Cliente se inscreveu em ${message.payload.length} links.`);
            
            const newIds = new Set();
            const initialDataPayload = []; // Dados para enviar imediatamente (do cache)

            for (const link of message.payload) {
                const charId = getCharacterIdFromUrl(link);
                if (!charId) continue;
                
                newIds.add(charId);
                
                const cacheKey = `ficha:${charId}`;
                const linkKey = `link:${charId}`;
                
                // 1. Salva o mapeamento ID -> URL para o Poller/Worker usar
                await redisClient.set(linkKey, link);

                // 2. Tenta buscar os dados do cache
                const cachedDataJson = await redisClient.get(cacheKey);
                
                if (cachedDataJson) {
                    // SUCESSO (Cache Hit): A ficha já está no cache
                    console.log(`[Gateway] Cache hit para ${charId}.`);
                    const data = JSON.parse(cachedDataJson);
                    const payload = { ...data, originalUrl: link };
                    initialDataPayload.push(payload);
                } else {
                    // FALHA (Cache Miss): Solicita a busca ao worker
                    console.log(`[Gateway] Cache miss para ${charId}. Enviando job para a fila...`);
                    const jobPayload = JSON.stringify({ 
                        charId: charId, 
                        originalUrl: link, 
                        force: true // Força o worker a publicar o resultado
                    });
                    redisClient.lpush(QUEUE_NAME, jobPayload);
                }

                // 3. Se inscreve no canal de updates (para futuras mudanças)
                const channel = `updates:${charId}`;
                if (!activeRedisChannels.has(channel)) {
                    console.log(`[Redis Pub/Sub] Inscrevendo no novo canal: ${channel}`);
                    subscriberClient.subscribe(channel);
                    activeRedisChannels.add(channel);
                }
            }
            
            // Atualiza a lista de IDs deste cliente
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

    // Lida com desconexões
    ws.on('close', () => {
        console.log('[Gateway] Cliente desconectado.');
        clientSubscriptions.delete(ws);
        // Nota: Uma otimização futura seria desinscrever-se de canais do Redis
        // que não estão mais sendo assistidos por nenhum cliente.
    });

    ws.on('error', (err) => {
        console.error('[Gateway] Erro no WebSocket:', err);
    });
});

// --- Inicia o Servidor ---
server.listen(PORT, () => {
    console.log(`[Gateway] Servidor (Express + WebSocket) rodando na porta ${PORT}`);
    console.log(`[Gateway] Conectando ao Redis em ${REDIS_HOST}:${REDIS_PORT}`);
});
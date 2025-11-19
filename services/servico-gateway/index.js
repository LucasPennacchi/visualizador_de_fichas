/**
 * @module Services/Gateway
 * @description Microserviço de Gateway e Gerenciamento de Conexões.
 * Atua como o ponto único de entrada para clientes WebSocket (Frontend).
 * Responsável por manter as conexões persistentes, gerenciar o estado de inscrições (quais clientes assistem quais fichas),
 * orquestrar o fluxo de dados "Cold Start" (via Fila de Trabalho) e distribuir atualizações em tempo real (via Pub/Sub).
 * Implementa estratégias de limpeza agressiva ("Eager Cleanup") para otimizar o uso de recursos do Redis.
 */

// --- Dependências ---
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const Redis = require('ioredis');
const { getCharacterIdFromUrl } = require('./utils');

// --- Configuração e Constantes ---

const PORT = 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

/**
 * Nome da fila de prioridade no Redis para jobs de busca.
 * @constant {string}
 */
const QUEUE_NAME = 'fila:trabalho:revalidar';

/**
 * Limite de atualizações "órfãs" (sem espectadores) permitidas antes do cancelamento forçado.
 * Atua como uma rede de segurança caso a limpeza imediata falhe.
 * @constant {number}
 */
const MAX_ORPHAN_UPDATES = 3;

// --- Inicialização dos Clientes Redis ---

/**
 * Cliente Redis para operações de dados síncronas (GET, SET, LPUSH).
 * @type {Redis}
 */
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);

/**
 * Cliente Redis dedicado exclusivamente para assinaturas (SUBSCRIBE/UNSUBSCRIBE).
 * Necessário pois conexões em modo de subscrição não podem executar outros comandos.
 * @type {Redis}
 */
const subscriberClient = new Redis(REDIS_PORT, REDIS_HOST);

// --- Inicialização do Servidor Web ---

const app = express();
app.use(require('cors')());
app.use(require('compression')());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Gerenciamento de Estado em Memória ---

/**
 * Mapa que relaciona cada conexão WebSocket ativa ao conjunto de IDs que ela monitora.
 * Fonte da verdade para roteamento de mensagens.
 * @type {Map<WebSocket, Set<string>>}
 */
const clientSubscriptions = new Map();

/**
 * Conjunto de canais do Redis que este Gateway está escutando ativamente.
 * Evita chamadas duplicadas de SUBSCRIBE para o mesmo canal.
 * @type {Set<string>}
 */
const activeRedisChannels = new Set();

/**
 * Rastreia o número de atualizações recebidas para fichas que não possuem espectadores ativos.
 * Usado pela estratégia de limpeza secundária ("Lazy Cleanup").
 * @type {Map<string, number>}
 */
const orphanUpdatesCount = new Map();

// --- Funções Auxiliares ---

/**
 * Verifica se existe alguma conexão WebSocket ativa monitorando um determinado ID de personagem.
 * Realiza uma varredura completa no mapa de inscrições.
 * * @param {string} charId - O ID único do personagem.
 * @returns {boolean} Retorna `true` se houver pelo menos um espectador ativo.
 */
function isAnyoneWatching(charId) {
    for (const [ws, subscribedIds] of clientSubscriptions) {
        // Verifica se o ID está na lista E se a conexão socket está aberta (não fechada/fechando)
        if (subscribedIds.has(charId) && ws.readyState === ws.OPEN) {
            return true;
        }
    }
    return false;
}

// --- Lógica de Processamento de Mensagens (Redis Pub/Sub) ---

/**
 * Handler para mensagens recebidas dos canais inscritos no Redis.
 * Este é o fluxo de "Hot Update": dados que mudaram no Worker chegam aqui.
 */
subscriberClient.on('message', (channel, message) => {
    // Extrai o ID do canal (formato: "updates:ID")
    const characterId = channel.split(':')[1];
    if (!characterId) return;

    // Prepara o payload padrão para os clientes
    const wsMessage = JSON.stringify({
        type: 'DATA_UPDATE',
        payload: [JSON.parse(message)] 
    });

    let hasActiveViewers = false;

    // 1. Roteamento: Entrega a mensagem apenas para os clientes interessados
    clientSubscriptions.forEach((subscribedIds, ws) => {
        if (subscribedIds.has(characterId)) {
            if (ws.readyState === ws.OPEN) {
                ws.send(wsMessage);
                hasActiveViewers = true;
            }
        }
    });

    // 2. Otimização de Recursos (Limpeza Secundária)
    if (hasActiveViewers) {
        // Se a ficha tem espectadores, ela é saudável. Zera contadores de risco.
        if (orphanUpdatesCount.has(characterId)) {
            orphanUpdatesCount.delete(characterId);
        }
    } else {
        // Se ninguém viu a atualização, incrementa o contador de orfandade.
        const currentCount = (orphanUpdatesCount.get(characterId) || 0) + 1;
        console.log(`[Gateway] Ficha ${characterId} sem espectadores (Detectado no Update). Inatividade: ${currentCount}/${MAX_ORPHAN_UPDATES}`);

        if (currentCount >= MAX_ORPHAN_UPDATES) {
            // Limite de segurança atingido: Força o cancelamento da assinatura no Redis.
            // Isso fará com que o Scheduler pare de agendar jobs para esta ficha.
            console.log(`[Gateway] Parando de monitorar ${characterId} por inatividade.`);
            subscriberClient.unsubscribe(channel);
            activeRedisChannels.delete(channel);
            orphanUpdatesCount.delete(characterId);
        } else {
            orphanUpdatesCount.set(characterId, currentCount);
        }
    }
});

// --- Lógica do WebSocket (Ciclo de Vida da Conexão) ---

wss.on('connection', ws => {
    console.log('[Gateway] Cliente conectado.');
    // Inicializa o estado do cliente vazio para evitar erros de leitura
    clientSubscriptions.set(ws, new Set());

    ws.on('message', async (messageBuffer) => {
        let message;
        try {
            message = JSON.parse(messageBuffer.toString());
        } catch (e) {
            return; // Ignora mensagens malformadas
        }

        // --- Processamento de Inscrição (SUBSCRIBE_LINKS) ---
        // O cliente envia a lista completa de links que deseja monitorar neste momento.
        if (message.type === 'SUBSCRIBE_LINKS' && Array.isArray(message.payload)) {
            console.log(`[Gateway] Processando inscrição de ${message.payload.length} links.`);
            
            // Snapshot do estado ANTERIOR para cálculo de diferença (Diff)
            const oldIds = clientSubscriptions.get(ws) || new Set();
            
            // Novo estado
            const newIds = new Set();
            const initialDataPayload = [];

            // 1. Processa ADIÇÕES (Links Novos)
            for (const link of message.payload) {
                const charId = getCharacterIdFromUrl(link);
                if (!charId) continue;
                
                newIds.add(charId);
                
                // Otimização: Se já estava assistindo, ignora lógica de inicialização
                if (oldIds.has(charId)) continue;

                // --- Fluxo de "Cold Start" ---
                const cacheKey = `ficha:${charId}`;
                const linkKey = `link:${charId}`;
                
                // Persiste a URL original para uso do Worker
                await redisClient.set(linkKey, link);
                
                // Tenta servir do Cache primeiro (Baixa Latência)
                const cachedDataJson = await redisClient.get(cacheKey);
                
                if (cachedDataJson) {
                    // Cache Hit: Retorna dados imediatamente
                    const data = JSON.parse(cachedDataJson);
                    initialDataPayload.push({ ...data, originalUrl: link });
                } else {
                    // Cache Miss: Agenda um Job Prioritário (Force=true) no Worker
                    console.log(`[Gateway] Cache miss para ${charId}. Agendando busca.`);
                    const jobPayload = JSON.stringify({ charId, originalUrl: link, force: true });
                    await redisClient.lpush(QUEUE_NAME, jobPayload);
                }

                // Garante a inscrição no canal de updates futuros
                const channel = `updates:${charId}`;
                if (!activeRedisChannels.has(channel)) {
                    console.log(`[Redis Pub/Sub] + Inscrevendo no canal: ${channel}`);
                    subscriberClient.subscribe(channel);
                    activeRedisChannels.add(channel);
                    orphanUpdatesCount.delete(charId);
                }
            }
            
            // 2. Atualização de Estado: Define a nova lista de interesses do cliente
            // Crucial: Isso deve ocorrer ANTES da verificação de remoção abaixo.
            clientSubscriptions.set(ws, newIds);
            
            // 3. Processa REMOÇÕES (Links que não estão mais na lista)
            // Estratégia "Eager Cleanup": Limpa recursos imediatamente se não houver mais ninguém vendo.
            for (const oldId of oldIds) {
                if (!newIds.has(oldId)) {
                    // Cliente parou de ver este ID. Verifica se ele era o último espectador.
                    if (!isAnyoneWatching(oldId)) {
                        const channel = `updates:${oldId}`;
                        console.log(`[Gateway] - Ninguém mais assiste ${oldId}. Cancelando assinatura IMEDIATAMENTE.`);
                        
                        subscriberClient.unsubscribe(channel);
                        activeRedisChannels.delete(channel);
                        orphanUpdatesCount.delete(oldId);
                    }
                }
            }
            
            // Envia o payload inicial (snapshot) para o cliente renderizar a tela inicial
            if (initialDataPayload.length > 0) {
                ws.send(JSON.stringify({
                    type: 'DATA_UPDATE',
                    payload: initialDataPayload
                }));
            }
        }
    });

    // --- Handler de Desconexão ---
    ws.on('close', () => {
        console.log('[Gateway] Cliente desconectado.');
        
        // Recupera o que o cliente estava vendo para processar limpeza
        const dyingIds = clientSubscriptions.get(ws) || new Set();
        
        // Remove o cliente do mapa (ele não conta mais como "espectador ativo")
        clientSubscriptions.delete(ws);

        // Executa limpeza imediata para todos os IDs que ficaram órfãos
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

// --- Inicialização ---
server.listen(PORT, () => {
    console.log(`[Gateway] Servidor rodando na porta ${PORT}`);
});
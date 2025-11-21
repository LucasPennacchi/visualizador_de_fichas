/**
 * @module Services/Poller/Worker
 * @description Microserviço Worker Agnóstico.
 * Responsável por processar jobs de atualização de fichas de qualquer sistema de RPG suportado.
 * Utiliza o padrão Registry para delegar a lógica de busca e normalização para o adaptador correto,
 * mantendo a infraestrutura de filas e cache completamente genérica.
 */

const Redis = require('ioredis');
const { getAdapterForUrl } = require('./adapters/registry');

// --- Importação dos Adaptadores (Side-effect: Auto-registro) ---
// Novos sistemas devem ser importados aqui para serem reconhecidos.
require('./adapters/crisAdapter');

// --- Configuração e Constantes ---
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const QUEUE_NAME = 'fila:trabalho:revalidar';

// --- Inicialização dos Clientes Redis ---
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);
const publisherClient = new Redis(REDIS_PORT, REDIS_HOST);
const workerClient = new Redis(REDIS_PORT, REDIS_HOST); // Cliente bloqueante para BRPOP

console.log(`[Worker] Conectado ao Redis em ${REDIS_HOST}:${REDIS_PORT}`);

/**
 * Processa um Job de atualização de personagem.
 * Localiza o adaptador correto, busca os dados normalizados e propaga alterações.
 * * @param {string} charId - ID do personagem (usado para chave de cache).
 * @param {string} originalUrl - URL completa (usada para selecionar o adaptador).
 * @param {boolean} forcePublish - Se true, publica mesmo sem mudanças (Cold Start).
 */
async function processCharacter(charId, originalUrl, forcePublish = false) {
    console.log(`[Worker] Processando: ${charId}`);

    // 1. Seleção de Estratégia: Busca o adaptador correto para a URL
    const adapter = getAdapterForUrl(originalUrl);

    if (!adapter) {
        console.warn(`[Worker] Erro: Nenhum adaptador encontrado para a URL: ${originalUrl}`);
        return; // Descarta o job silenciosamente
    }

    // 2. Execução do Adaptador: Busca e Normalização
    // O retorno aqui já é o JSON Canônico Universal
    const newDataResult = await adapter.fetch(originalUrl);
    
    if (!newDataResult) {
        console.warn(`[Worker] Falha na busca de dados para ${charId} via ${adapter.systemId}.`);
        return;
    }

    // 3. Gerenciamento de Estado (Cache e CDC)
    const cacheKey = `ficha:${charId}`;
    const channel = `updates:${charId}`;

    const oldDataJson = await redisClient.get(cacheKey);
    const newDataJson = JSON.stringify(newDataResult.data); // Dados Canônicos
    
    const hasChanged = newDataJson !== oldDataJson;

    if (hasChanged || forcePublish) {
        if (hasChanged) console.log(`[Worker] Delta detectado (${adapter.systemId}): ${charId}`);
        
        // O payload agora contém o JSON Canônico + URL de referência
        const payload = {
            ...newDataResult.data,
            originalUrl: originalUrl
        };
        const payloadJson = JSON.stringify(payload);

        // Atualiza Cache e Notifica
        await redisClient.set(cacheKey, newDataJson);
        await publisherClient.publish(channel, payloadJson);
        
    } else {
        console.log(`[Worker] Sem alterações: ${charId}`);
    }
}

/**
 * Loop Principal do Worker.
 * Consome a fila de tarefas de forma bloqueante e sequencial.
 */
async function startWorker() {
    console.log(`[Worker] Serviço iniciado. Aguardando jobs na fila '${QUEUE_NAME}'...`);
    
    while (true) {
        try {
            // Bloqueia a conexão até que um job esteja disponível (Timeout 0 = Infinito)
            const result = await workerClient.brpop(QUEUE_NAME, 0);
            const jobPayload = result[1]; 
            
            const { charId, originalUrl, force } = JSON.parse(jobPayload);
            
            if (charId && originalUrl) {
                await processCharacter(charId, originalUrl, force || false);
            } else {
                console.warn("[Worker] Job malformado descartado:", jobPayload);
            }

        } catch (err) {
            console.error("[Worker] Erro crítico no loop:", err);
            // Backoff para evitar loop de erro rápido
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

startWorker();
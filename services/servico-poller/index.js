// services/servico-poller/index.js
const Redis = require('ioredis');
const { fetchFromGoogle } = require('./googleFetcher');

const POLLING_INTERVAL_MS = 5000; // 5 segundos

// --- Configuração dos Clientes Redis ---
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

// Cliente para comandos GET/SET
const redisClient = new Redis(redisPort, redisHost);
// Cliente para PUBLISH
const publisherClient = new Redis(redisPort, redisHost);
// NOVO: Cliente para SUBSCRIBE (requisições de busca)
const subscriberClient = new Redis(redisPort, redisHost);

console.log(`[Poller] Conectando ao Redis em ${redisHost}:${redisPort}`);


/**
 * NOVA FUNÇÃO REUTILIZÁVEL:
 * Busca, compara e publica um ÚNICO ID.
 * Usada tanto pelo loop quanto pelas requisições imediatas.
 * @param {string} charId - O ID da ficha
 * @param {string} originalUrl - O URL completo original
 * @param {boolean} forcePublish - Se deve publicar mesmo se não houver mudança (para o 'cold start')
 */
async function processCharacter(charId, originalUrl, forcePublish = false) {
    console.log(`[Poller] Processando ID: ${charId}`);
    const cacheKey = `ficha:${charId}`;
    const channel = `updates:${charId}`;
    
    const newDataResult = await fetchFromGoogle(charId);
    if (!newDataResult) {
        console.log(`[Poller] Falha ao buscar ${charId}. Pulando.`);
        return;
    }

    const oldDataJson = await redisClient.get(cacheKey);
    const newDataJson = JSON.stringify(newDataResult.data);
    
    const hasChanged = newDataJson !== oldDataJson;

    // Publica se mudou OU se foi forçado (para 'cold start')
    if (hasChanged || forcePublish) {
        if (hasChanged) {
            console.log(`[Poller] Mudança detectada em: ${charId}`);
        } else if (forcePublish) {
            console.log(`[Poller] Busca forçada (cold start) para: ${charId}`);
        }
        
        // Prepara o payload final para o frontend
        const payload = {
            ...newDataResult.data,
            originalUrl: originalUrl // Usa o URL que recebemos
        };
        const payloadJson = JSON.stringify(payload);

        // Atualiza o Cache (SET) com os dados PUROS
        await redisClient.set(cacheKey, newDataJson);
        
        // Publica a mudança (PUBLISH) com o PAYLOAD COMPLETO
        await publisherClient.publish(channel, payloadJson);
        
    } else {
        console.log(`[Poller] Sem mudanças em: ${charId}`);
    }
}

/**
 * A lógica principal do loop de polling (agora usa 'processCharacter')
 */
async function runUpdateLoop() {
    console.log("[Poller] Verificando canais ativos...");
    
    // Pergunta ao Redis: "Quais canais 'updates:*' estão sendo escutados?"
    const channels = await redisClient.pubsub('CHANNELS', 'updates:*');
    
    if (channels.length === 0) {
        console.log("[Poller] Nenhum canal ativo. Pulando o loop.");
        return;
    }
    
    console.log(`[Poller] Monitorando ${channels.length} fichas ativas...`);
    
    for (const channel of channels) {
        const charId = channel.split(':')[1];
        if (!charId) continue;
        
        const linkKey = `link:${charId}`;
        // Busca o URL original (que o gateway salvou)
        const originalUrl = await redisClient.get(linkKey);
        
        if (!originalUrl) {
            console.error(`[Poller] Loop: Não foi possível encontrar o URL original para o ID: ${charId}`);
            continue;
        }
        
        // Chama a função centralizada (sem forçar)
        await processCharacter(charId, originalUrl, false);
    }
}

/**
 * NOVO HANDLER: Lida com requisições de busca imediatas do gateway
 */
subscriberClient.on('message', async (channel, message) => {
    if (channel === 'request:fetch') {
        console.log(`[Poller] Recebida solicitação de busca imediata.`);
        try {
            const { charId, originalUrl } = JSON.parse(message);
            if (charId && originalUrl) {
                // Chama a função centralizada, forçando o 'publish'
                // (Isso preenche o cache e envia os dados ao cliente)
                await processCharacter(charId, originalUrl, true);
            }
        } catch (e) {
            console.error("[Poller] Erro ao processar 'request:fetch'", e.message);
        }
    }
});

// Inicia ambos os serviços do poller
function startServices() {
    // 1. Inicia o loop de polling
    console.log(`[Poller] Iniciando loop de polling a cada ${POLLING_INTERVAL_MS}ms`);
    runUpdateLoop().catch(console.error);
    setInterval(() => {
        runUpdateLoop().catch(console.error);
    }, POLLING_INTERVAL_MS);
    
    // 2. Se inscreve no canal de requisições
    subscriberClient.subscribe('request:fetch');
    console.log("[Poller] Inscrito no canal 'request:fetch'.");
}

startServices();
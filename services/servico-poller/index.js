// services/servico-poller/index.js
const Redis = require('ioredis');
const { fetchFromGoogle } = require('./googleFetcher');

const POLLING_INTERVAL_MS = 5000; // 5 segundos

// --- Configuração dos Clientes Redis ---
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

const redisClient = new Redis(redisPort, redisHost);
const publisherClient = new Redis(redisPort, redisHost);

console.log(`[Poller] Conectando ao Redis em ${redisHost}:${redisPort}`);

/**
 * A lógica principal do loop de polling
 */
async function runUpdateLoop() {
    console.log("[Poller] Verificando canais ativos...");
    
    const channels = await redisClient.pubsub('CHANNELS', 'updates:*');
    
    if (channels.length === 0) {
        console.log("[Poller] Nenhum canal ativo. Pulando o loop.");
        return;
    }
    
    console.log(`[Poller] Monitorando ${channels.length} fichas ativas...`);
    
    for (const channel of channels) {
        const charId = channel.split(':')[1];
        if (!charId) continue;
        
        const cacheKey = `ficha:${charId}`;
        const linkKey = `link:${charId}`;
        
        const newDataResult = await fetchFromGoogle(charId);
        if (!newDataResult) {
            console.log(`[Poller] Falha ao buscar ${charId}. Pulando.`);
            continue;
        }

        // 4. Busca os dados ANTIGOS (JSON string) do cache
        // (No ciclo 1, isso será 'null')
        const oldDataJson = await redisClient.get(cacheKey);
        
        // 5. Prepara os dados NOVOS (JSON string)
        const newDataJson = JSON.stringify(newDataResult.data);

        // 6. Compara as strings de JSON diretamente. É mais rápido e correto.
        // "{"hp":"10"}" !== "{"hp":"10"}" -> false
        // "{"hp":"9"}" !== "{"hp":"10"}"  -> true
        // "{"hp":"9"}" !== null           -> true
        const hasChanged = newDataJson !== oldDataJson;

        if (hasChanged) {
            console.log(`[Poller] Mudança detectada em: ${charId}`);
            
            // 7. Busca o URL original (que o gateway salvou)
            const originalUrl = await redisClient.get(linkKey);
            if (!originalUrl) {
                console.error(`[Poller] Não foi possível encontrar o URL original para o ID: ${charId}`);
                continue;
            }
            
            // 8. Prepara o payload final para o frontend (para o PUBLISH)
            // (O payload contém os dados + o URL original)
            const payload = {
                ...newDataResult.data,
                originalUrl: originalUrl
            };
            const payloadJson = JSON.stringify(payload);
 
            // 9. Atualiza o Cache (SET) com os dados PUROS (newDataJson)
            // Isso garante que a próxima comparação (Passo 6) funcione.
            await redisClient.set(cacheKey, newDataJson);
            
            // 10. Publica a mudança (PUBLISH) com o payload COMPLETO
            await publisherClient.publish(channel, payloadJson);
            
        } else {
            console.log(`[Poller] Sem mudanças em: ${charId}`);
        }
    }
}

// Inicia o loop principal
function startPolling() {
    console.log(`[Poller] Iniciando loop de polling a cada ${POLLING_INTERVAL_MS}ms`);
    runUpdateLoop().catch(console.error);
    setInterval(() => {
        runUpdateLoop().catch(console.error);
    }, POLLING_INTERVAL_MS);
}

startPolling();
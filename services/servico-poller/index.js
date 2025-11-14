// services/servico-poller/index.js
const Redis = require('ioredis');
const { fetchFromGoogle } = require('./googleFetcher');

// --- Constantes ---
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const QUEUE_NAME = 'fila:trabalho:revalidar'; // A fila que vamos escutar

// --- Configuração dos Clientes Redis ---
// Cliente para comandos GET/SET
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);
// Cliente para PUBLISH
const publisherClient = new Redis(REDIS_PORT, REDIS_HOST);
// Cliente de bloqueio (Blocking Client) para 'BRPOP'
const workerClient = new Redis(REDIS_PORT, REDIS_HOST);

console.log(`[Worker] Conectando ao Redis em ${REDIS_HOST}:${REDIS_PORT}`);

/**
 * Função central de processamento.
 * Busca, compara e publica um ÚNICO ID.
 */
async function processCharacter(charId, originalUrl, forcePublish = false) {
    console.log(`[Worker] Processando ID: ${charId}`);
    const cacheKey = `ficha:${charId}`;
    const channel = `updates:${charId}`;
    
    // 1. Busca os dados da API externa
    const newDataResult = await fetchFromGoogle(charId);
    if (!newDataResult) {
        console.log(`[Worker] Falha ao buscar ${charId}. Pulando.`);
        return;
    }

    // 2. Busca os dados antigos do cache
    const oldDataJson = await redisClient.get(cacheKey);
    const newDataJson = JSON.stringify(newDataResult.data);
    
    // 3. Compara
    const hasChanged = newDataJson !== oldDataJson;

    // 4. Publica se mudou OU se foi 'forcePublish' (de um cache miss do gateway)
    if (hasChanged || forcePublish) {
        if (hasChanged) {
            console.log(`[Worker] Mudança detectada em: ${charId}`);
        } else if (forcePublish) {
            console.log(`[Worker] Busca forçada (cold start) para: ${charId}`);
        }
        
        // 5. Prepara o payload final para o frontend (com URL)
        const payload = {
            ...newDataResult.data,
            originalUrl: originalUrl
        };
        const payloadJson = JSON.stringify(payload);

        // 6. Atualiza o Cache (SET) com os dados PUROS
        await redisClient.set(cacheKey, newDataJson);
        
        // 7. Publica a mudança (PUBLISH) com o PAYLOAD COMPLETO
        await publisherClient.publish(channel, payloadJson);
        
    } else {
        console.log(`[Worker] Sem mudanças em: ${charId}`);
    }
}

/**
 * Loop infinito do Worker.
 * Espera por trabalhos na fila e os processa.
 */
async function startWorker() {
    console.log(`[Worker] Pronto. Esperando por trabalhos na fila '${QUEUE_NAME}'...`);
    
    while (true) {
        try {
            // 1. Espera (bloqueia) por um job. '0' = esperar para sempre.
            // BRPOP retorna um array: [nomeDaFila, job]
            const result = await workerClient.brpop(QUEUE_NAME, 0);
            const jobPayload = result[1]; // Pega o job
            
            console.log(`[Worker] Job recebido.`);
            
            // 2. Processa o job
            const { charId, originalUrl, force } = JSON.parse(jobPayload);
            
            if (charId && originalUrl) {
                // 3. Chama a função de processamento
                // 'force' será true para 'cold starts' e false para 'loops'
                await processCharacter(charId, originalUrl, force || false);
            } else {
                console.warn("[Worker] Job inválido recebido:", jobPayload);
            }

        } catch (err) {
            console.error("[Worker] Erro no loop de trabalho:", err);
            // Espera um segundo antes de tentar novamente para evitar spam de erros
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Inicia o worker
startWorker();
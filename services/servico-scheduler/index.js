// services/servico-scheduler/index.js
const Redis = require('ioredis');

// --- Constantes ---
const POLLING_INTERVAL_MS = 5000; // 5 segundos
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const QUEUE_NAME = 'fila:trabalho:revalidar';

// --- Configuração do Cliente Redis ---
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);

console.log(`[Scheduler] Conectando ao Redis em ${REDIS_HOST}:${REDIS_PORT}`);

/**
 * Busca todas as fichas ativas e as agenda na fila de trabalho.
 */
async function scheduleJobs() {
    console.log("[Scheduler] Buscando canais ativos para agendar trabalhos...");
    
    // 1. Pergunta ao Redis: "Quais canais 'updates:*' o gateway está escutando?"
    // Esta é a nossa lista de "fichas ativas".
    const channels = await redisClient.pubsub('CHANNELS', 'updates:*');
    
    if (channels.length === 0) {
        console.log("[Scheduler] Nenhum canal ativo. Nenhum trabalho a agendar.");
        return;
    }

    console.log(`[Scheduler] ${channels.length} fichas ativas encontradas. Criando pipeline de jobs...`);

    // 2. Para eficiência, usamos um 'pipeline' do Redis para enviar
    // todos os comandos de uma vez.
    const pipeline = redisClient.pipeline();
    
    // 3. Monta a lista de IDs de trabalho
    const jobIdsToFetch = [];
    for (const channel of channels) {
        const charId = channel.split(':')[1];
        if (charId) {
            jobIdsToFetch.push(charId);
        }
    }

    // 4. Busca todos os 'originalUrl' de uma só vez (Multi-Get)
    if (jobIdsToFetch.length > 0) {
        const linkKeys = jobIdsToFetch.map(id => `link:${id}`);
        const originalUrls = await redisClient.mget(...linkKeys); 

        // 5. Adiciona os jobs (com ID e URL) à fila
        let jobsAdded = 0;
        for (let i = 0; i < jobIdsToFetch.length; i++) {
            const charId = jobIdsToFetch[i];
            const originalUrl = originalUrls[i];

            if (charId && originalUrl) {
                // O job do loop normal é 'force: false'
                // O worker só publicará se houver uma mudança real.
                const jobPayload = JSON.stringify({ charId, originalUrl, force: false });
                pipeline.lpush(QUEUE_NAME, jobPayload);
                jobsAdded++;
            } else {
                console.warn(`[Scheduler] Job para ${charId} ignorado (URL original faltando).`);
            }
        }

        // 6. Executa todos os 'LPUSH' de uma vez
        await pipeline.exec();
        console.log(`[Scheduler] ${jobsAdded} trabalhos agendados na fila '${QUEUE_NAME}'.`);
    }
}

/**
 * Inicia o loop principal de agendamento.
 * Usa 'setTimeout' recursivo para garantir que um ciclo termine
 * antes que o próximo inicie, mesmo se a busca no Redis demorar.
 */
function startScheduler() {
    console.log(`[Scheduler] Iniciando loop de agendamento a cada ${POLLING_INTERVAL_MS}ms`);
    
    const loop = async () => {
        try {
            await scheduleJobs();
        } catch (err) {
            console.error("[Scheduler] Erro no loop de agendamento:", err);
        } finally {
            // Agenda a próxima execução
            setTimeout(loop, POLLING_INTERVAL_MS);
        }
    };
    
    loop(); // Inicia o loop pela primeira vez
}

startScheduler();
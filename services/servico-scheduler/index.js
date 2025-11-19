/**
 * @module Services/Scheduler
 * @description Microserviço Agendador (Cron/Heartbeat).
 * Responsável por orquestrar o ciclo de atualização periódica do sistema.
 * A cada intervalo definido, ele identifica todas as fichas que possuem espectadores ativos
 * e gera "Jobs" (tarefas de trabalho) na fila do Redis para serem processados assincronamente
 * pelos Workers (Pollers). Implementa otimizações de rede (Pipelining/MGET) para alta performance.
 */

const Redis = require('ioredis');

// --- Configuração e Constantes ---

/**
 * Intervalo de tempo entre os ciclos de agendamento.
 * Define a frequência máxima de atualização das fichas.
 * @constant {number}
 */
const POLLING_INTERVAL_MS = 5000; // 5 segundos

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

/**
 * Nome da fila de trabalho (List) onde os jobs serão inseridos.
 * Deve corresponder à fila consumida pelo serviço Worker/Poller.
 * @constant {string}
 */
const QUEUE_NAME = 'fila:trabalho:revalidar';

// --- Inicialização do Cliente Redis ---

/**
 * Cliente Redis para operações de comando e consulta.
 * @type {Redis}
 */
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);

console.log(`[Scheduler] Inicializando conexão com Redis em ${REDIS_HOST}:${REDIS_PORT}`);

// --- Lógica de Negócio ---

/**
 * Executa um ciclo de agendamento completo ("Fan-out").
 * 1. Descobre quais fichas estão ativas (via canais Pub/Sub).
 * 2. Recupera metadados necessários (URLs originais) em lote.
 * 3. Enfileira tarefas para os Workers processarem.
 * * Utiliza Pipelining e Multi-Get (MGET) para minimizar a latência de rede (Round-Trip Time).
 * @async
 */
async function scheduleJobs() {
    console.log("[Scheduler] Iniciando ciclo de descoberta de tarefas...");
    
    // 1. Discovery: Identifica o universo de fichas monitoradas.
    // O comando 'PUBSUB CHANNELS' lista os canais ativos (aqueles com pelo menos 1 Gateway inscrito).
    const channels = await redisClient.pubsub('CHANNELS', 'updates:*');
    
    if (channels.length === 0) {
        console.log("[Scheduler] Sistema ocioso. Nenhum canal ativo encontrado.");
        return;
    }

    console.log(`[Scheduler] ${channels.length} fichas ativas identificadas. Preparando pipeline...`);

    // 2. Batch Processing: Inicializa pipeline para operações em lote
    const pipeline = redisClient.pipeline();
    
    // 3. Parsing de IDs
    const jobIdsToFetch = [];
    for (const channel of channels) {
        const charId = channel.split(':')[1];
        if (charId) {
            jobIdsToFetch.push(charId);
        }
    }

    // 4. Data Enrichment: Recupera URLs originais necessárias para o payload do job
    if (jobIdsToFetch.length > 0) {
        // Constrói chaves de metadados
        const linkKeys = jobIdsToFetch.map(id => `link:${id}`);
        
        // Executa MGET (O(N) onde N é o número de chaves) em uma única requisição
        const originalUrls = await redisClient.mget(...linkKeys); 

        // 5. Job Dispatch: Cria e enfileira os jobs
        let jobsAdded = 0;
        for (let i = 0; i < jobIdsToFetch.length; i++) {
            const charId = jobIdsToFetch[i];
            const originalUrl = originalUrls[i];

            // Validação de Integridade: Só agenda se tivermos metadados completos
            if (charId && originalUrl) {
                // O Scheduler gera jobs com 'force: false', indicando aos Workers
                // que eles só devem publicar atualizações se houver mudança real nos dados.
                const jobPayload = JSON.stringify({ 
                    charId, 
                    originalUrl, 
                    force: false 
                });
                
                // LPUSH insere na cabeça da lista (fila LIFO/FIFO dependendo do consumidor)
                pipeline.lpush(QUEUE_NAME, jobPayload);
                jobsAdded++;
            } else {
                console.warn(`[Scheduler] Inconsistência de dados: Job para ID ${charId} ignorado (URL ausente).`);
            }
        }

        // 6. Commit: Envia todos os comandos LPUSH para o Redis de uma vez
        await pipeline.exec();
        console.log(`[Scheduler] Sucesso: ${jobsAdded} tarefas enviadas para '${QUEUE_NAME}'.`);
    }
}

// --- Controle de Ciclo de Vida ---

/**
 * Inicializa o loop infinito de agendamento.
 * Utiliza o padrão "Recursive Timeout" em vez de "Interval" para garantir segurança de execução:
 * o próximo ciclo só é agendado após o término completo (sucesso ou falha) do ciclo atual,
 * prevenindo condições de corrida e sobrecarga ("backpressure") caso o Redis esteja lento.
 */
function startScheduler() {
    console.log(`[Scheduler] Serviço iniciado. Intervalo de polling: ${POLLING_INTERVAL_MS}ms`);
    
    const loop = async () => {
        try {
            await scheduleJobs();
        } catch (err) {
            // Captura erros globais do ciclo para evitar crash do container
            console.error("[Scheduler] Erro crítico no ciclo de agendamento:", err);
        } finally {
            // Agenda a próxima execução independente do resultado
            setTimeout(loop, POLLING_INTERVAL_MS);
        }
    };
    
    // Dispara o primeiro ciclo imediatamente
    loop(); 
}

// Ponto de entrada
startScheduler();
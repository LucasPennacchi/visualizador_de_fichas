/**
 * @module Services/Poller/Worker
 * @description Microserviço Worker responsável pelo processamento assíncrono de fichas.
 * Implementa o padrão "Competing Consumers": múltiplas instâncias deste serviço podem
 * rodar em paralelo, consumindo jobs de uma fila compartilhada no Redis.
 * Realiza a busca de dados externos, verificação de integridade (cache hit/miss)
 * e publicação de eventos de mudança (Change Data Capture).
 */

const Redis = require('ioredis');
const { fetchFromGoogle } = require('./googleFetcher');

// --- Configuração e Constantes ---

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

/**
 * Nome da fila de trabalho (List) no Redis.
 * Deve ser o mesmo nome utilizado pelo Gateway e Scheduler.
 * @constant {string}
 */
const QUEUE_NAME = 'fila:trabalho:revalidar';

// --- Inicialização dos Clientes Redis ---

/**
 * Cliente Redis para operações padrão de leitura e escrita (GET/SET).
 * @type {Redis}
 */
const redisClient = new Redis(REDIS_PORT, REDIS_HOST);

/**
 * Cliente Redis dedicado para publicação de mensagens (PUBLISH).
 * @type {Redis}
 */
const publisherClient = new Redis(REDIS_PORT, REDIS_HOST);

/**
 * Cliente Redis dedicado para operações bloqueantes de fila (BRPOP).
 * Necessário um cliente exclusivo pois o comando BRPOP bloqueia a conexão
 * até que um item esteja disponível, impedindo outros comandos na mesma conexão.
 * @type {Redis}
 */
const workerClient = new Redis(REDIS_PORT, REDIS_HOST);

console.log(`[Worker] Inicializando conexão com Redis em ${REDIS_HOST}:${REDIS_PORT}`);

// --- Funções de Lógica de Negócio ---

/**
 * Processa a atualização de um único personagem.
 * Executa o fluxo completo: Busca Externa -> Comparação com Cache -> Atualização de Estado -> Notificação.
 * * @param {string} charId - O ID único do personagem.
 * @param {string} originalUrl - A URL original da ficha (necessária para o payload do frontend).
 * @param {boolean} [forcePublish=false] - Flag para ignorar a verificação de mudança (útil para "Cold Start").
 */
async function processCharacter(charId, originalUrl, forcePublish = false) {
  console.log(`[Worker] Processando Job ID: ${charId}`);
  
  const cacheKey = `ficha:${charId}`;
  const channel = `updates:${charId}`;
  
  // 1. Integração Externa: Busca dados na fonte oficial (Google Firestore)
  const newDataResult = await fetchFromGoogle(charId);
  
  if (!newDataResult) {
    console.warn(`[Worker] Falha crítica ao buscar dados para ${charId}. Abortando job.`);
    return;
  }

  // 2. Verificação de Estado: Busca a última versão conhecida no Cache
  const oldDataJson = await redisClient.get(cacheKey);
  
  // Serializa o novo dado para comparação e armazenamento
  const newDataJson = JSON.stringify(newDataResult.data);
  
  // 3. Detecção de Mudança (Deep Equality via String Comparison)
  // Compara a string JSON atual com a antiga. Se diferirem, houve alteração.
  const hasChanged = newDataJson !== oldDataJson;

  // 4. Tomada de Decisão: Publicar ou Ignorar?
  if (hasChanged || forcePublish) {
    if (hasChanged) {
      console.log(`[Worker] Delta detectado para: ${charId}`);
    } else if (forcePublish) {
      console.log(`[Worker] Publicação forçada (Cold Start) para: ${charId}`);
    }
    
    // Reconstrói o payload enriquecido para o Frontend
    const payload = {
      ...newDataResult.data,
      originalUrl: originalUrl
    };
    const payloadJson = JSON.stringify(payload);

    // 5. Atualização de Estado (Transação Implícita)
    // Primeiro atualiza a "Fonte da Verdade" (Cache)
    await redisClient.set(cacheKey, newDataJson);
    
    // Depois notifica os interessados (Pub/Sub)
    await publisherClient.publish(channel, payloadJson);
    
  } else {
    console.log(`[Worker] Nenhuma alteração detectada para: ${charId}`);
  }
}

/**
 * Loop principal do Worker.
 * Implementa um consumidor de fila bloqueante infinito.
 * Mantém o processo vivo aguardando tarefas distribuídas pelo Scheduler ou Gateway.
 */
async function startWorker() {
  console.log(`[Worker] Serviço iniciado. Aguardando jobs na fila '${QUEUE_NAME}'...`);
  
  // Loop infinito de processamento
  while (true) {
    try {
      // 1. Consumo de Fila (Blocking Pop)
      // Remove e retorna o último elemento da lista. Se vazia, bloqueia a conexão (timeout 0 = infinito).
      // Retorna um array: [nome_da_fila, valor_do_item]
      const result = await workerClient.brpop(QUEUE_NAME, 0);
      const jobPayload = result[1]; 
      
      // 2. Deserialização do Job
      const { charId, originalUrl, force } = JSON.parse(jobPayload);
      
      // 3. Execução Segura
      if (charId && originalUrl) {
        await processCharacter(charId, originalUrl, force || false);
      } else {
        console.warn("[Worker] Job malformado recebido e descartado:", jobPayload);
      }

    } catch (err) {
      // Tratamento de Erro Global do Loop
      // Evita que o container Docker reinicie (crash) por erros transientes (ex: falha de rede momentânea)
      console.error("[Worker] Erro crítico no loop de processamento:", err);
      
      // Backoff simples: Pausa de 1s antes de reiniciar o loop para evitar "busy loop" em caso de erro persistente
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Inicia o ciclo de vida do Worker
startWorker();
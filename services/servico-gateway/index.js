// services/servico-gateway/index.js
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const Redis = require('ioredis');
const { getCharacterIdFromUrl } = require('./utils');

const PORT = 3000;

// --- Configuração do Express (para o HTTP server) ---
const app = express();
app.use(require('cors')());
app.use(require('compression')());

// --- Configuração dos Clientes Redis ---
// (Conecta ao 'redis' no host '6379', como definido no docker-compose.yml)
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

// Cliente 1: Para comandos GET/SET (Cache)
const cacheClient = new Redis(redisPort, redisHost);
// Cliente 2: Para comandos SUBSCRIBE/PUBLISH (Message Broker)
// É uma *boa prática* usar um cliente separado para Pub/Sub
const subscriberClient = new Redis(redisPort, redisHost);

// --- Configuração do Servidor WebSocket ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Estado do Gateway ---
// Guarda quais links (IDs) cada cliente (ws) está assistindo
// Map<ws, Set<string (ID da Ficha)>>
const clientSubscriptions = new Map();

// Guarda quais canais (IDs) o servidor está escutando no Redis
// Set<string (ID da Ficha)>
const activeRedisChannels = new Set();

// --- Lógica Principal ---

/**
 * Lida com mensagens de atualização recebidas do Redis Pub/Sub
 */
subscriberClient.on('message', (channel, message) => {
  console.log(`[Redis Pub/Sub] Mensagem recebida no canal: ${channel}`);
  
  // Extrai o ID do canal (ex: "updates:ID_DA_FICHA")
  const characterId = channel.split(':')[1];
  if (!characterId) return;

  // Prepara a mensagem para o frontend
  const wsMessage = JSON.stringify({
    type: 'DATA_UPDATE',
    payload: [JSON.parse(message)] // O frontend espera um array
  });

  // Itera sobre TODOS os clientes conectados
  clientSubscriptions.forEach((subscribedIds, ws) => {
    // Se este cliente estiver assistindo este ID, envia a mensagem
    if (subscribedIds.has(characterId) && ws.readyState === ws.OPEN) {
      ws.send(wsMessage);
    }
  });
});

/**
 * Lida com novas conexões WebSocket
 */
wss.on('connection', ws => {
  console.log('[Gateway] Cliente conectado.');
  // Inicializa a lista de inscrições para este cliente
  clientSubscriptions.set(ws, new Set());

  // O que fazer quando este cliente envia uma mensagem
  ws.on('message', async (messageBuffer) => {
    let message;
    try {
      message = JSON.parse(messageBuffer.toString());
    } catch (e) {
      console.error('[Gateway] Mensagem inválida (não-JSON) recebida.');
      return;
    }

    // Cliente quer se inscrever em uma lista de links
    if (message.type === 'SUBSCRIBE_LINKS' && message.payload) {
      console.log(`[Gateway] Cliente se inscreveu em ${message.payload.length} links.`);
      
      const newIds = new Set();
      const initialDataPayload = [];

      for (const link of message.payload) {
        const charId = getCharacterIdFromUrl(link);
        if (!charId) continue;
        
        newIds.add(charId);
        
        // 1. (Lógica de Cache) Busca dados atuais no Redis Cache
        const cacheKey = `ficha:${charId}`;

        const linkKey = `link:${charId}`;
        await cacheClient.set(linkKey, link);

        const cachedData = await cacheClient.get(cacheKey);
        
        if (cachedData) {
          // Se achou no cache, adiciona ao payload inicial
          initialDataPayload.push(JSON.parse(cachedData));
        }

        // 2. (Lógica de Pub/Sub) Se inscreve no canal do Redis
        const channel = `updates:${charId}`;
        if (!activeRedisChannels.has(channel)) {
          console.log(`[Redis Pub/Sub] Inscrevendo no novo canal: ${channel}`);
          subscriberClient.subscribe(channel);
          activeRedisChannels.add(channel);
        }
      }

      // Atualiza o que este cliente está assistindo
      clientSubscriptions.set(ws, newIds);
      
      // Envia a carga inicial (o que encontramos no cache)
      if (initialDataPayload.length > 0) {
        ws.send(JSON.stringify({
          type: 'DATA_UPDATE',
          payload: initialDataPayload
        }));
      }
    }
  });

  // O que fazer quando este cliente desconecta
  ws.on('close', () => {
    console.log('[Gateway] Cliente desconectado.');
    // Remove o cliente da lista de inscrições
    clientSubscriptions.delete(ws);
    // (Nota: Para um projeto final, você deveria verificar se 
    // algum canal não está mais sendo assistido por NINGUÉM e
    // dar 'unsubscribe' dele, para economizar recursos)
  });

  ws.on('error', (err) => {
    console.error('[Gateway] Erro no WebSocket:', err);
  });
});

// --- Inicia o Servidor ---
server.listen(PORT, () => {
  console.log(`[Gateway] Servidor (Express + WebSocket) rodando na porta ${PORT}`);
  console.log(`[Gateway] Conectando ao Redis em ${redisHost}:${redisPort}`);
});
const { characterCache, clientSubscriptions, CACHE_COOLDOWN_MS } = require('../state');
const { fetchFromGoogle } = require('./googleFetcher');
const { getCharacterIdFromUrl } = require('../utils/helpers');

// Precisamos da instância do WSS para fazer o broadcast
let wssInstance = null;

/**
 * Envia uma lista de personagens atualizados para todos os clientes.
 */
function broadcastUpdates(updatedCharacters) {
  if (updatedCharacters.length === 0 || !wssInstance) return; // Nada para enviar ou WSS não iniciado

  console.log(`[Broadcast] Enviando ${updatedCharacters.length} atualizações...`);
  const message = JSON.stringify({
    type: 'DATA_UPDATE',
    payload: updatedCharacters
  });
  
  // Envia para CADA cliente conectado
  wssInstance.clients.forEach(client => {
    // Usamos wssInstance.clients.forEach e client.OPEN
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

/**
 * A lógica principal do loop que é executada a cada X segundos.
 */
async function runUpdateLoop() {
  const now = Date.now();
  const allWatchedLinks = new Set();
  
  // 1. Pega todos os links únicos que todos os clientes estão assistindo
  clientSubscriptions.forEach(links => {
    links.forEach(link => allWatchedLinks.add(link));
  });

  if (allWatchedLinks.size === 0) return; // Ninguém assistindo

  console.log(`[Loop] Verificando ${allWatchedLinks.size} fichas ativas...`);
  const updatedCharacters = [];

  // 2. Itera sobre os links ativos
  for (const link of allWatchedLinks) {
    const characterId = getCharacterIdFromUrl(link);
    if (!characterId) continue;

    const oldEntry = characterCache.get(characterId);

    // 3. Busca no Google APENAS se o cache estiver velho
    if (!oldEntry || (now - oldEntry.lastFetchTime > CACHE_COOLDOWN_MS)) {
      const newData = await fetchFromGoogle(characterId); // newData = { data: {...}, lastFetchTime: ... }
      
      if (newData) {
        // 4. COMPARAÇÃO: Os dados mudaram?
        // (JSON.stringify é uma forma razoável de checar deep equality)
        const hasChanged = JSON.stringify(newData.data) !== JSON.stringify(oldEntry?.data);

        if (hasChanged) {
          console.log(`[Loop] Mudança detectada em: ${characterId}`);
          
          const dataToPush = { 
            ...newData.data, // Pega todos os dados (name, hp, etc.)
            originalUrl: link // Adiciona o link
          };
          updatedCharacters.push(dataToPush);
        }
        
        // 5. Atualiza o cache (com o 'lastRequestedTime' antigo, se existir)
        characterCache.set(characterId, { 
          data: newData.data,
          lastFetchTime: newData.lastFetchTime,
          lastRequestedTime: oldEntry?.lastRequestedTime || now
        });
      }
    }
  }

  // 6. Transmite (broadcast) apenas as fichas que mudaram
  broadcastUpdates(updatedCharacters);
}

/**
 * Inicia o loop de fundo da aplicação.
 * @param {WebSocketServer} wss - A instância do servidor WebSocket.
 */
function startBackgroundLoop(wss) {
  if (wssInstance) {
    // Impede que o loop seja iniciado duas vezes
    return;
  }
  
  wssInstance = wss;
  console.log("[Loop] Loop de 5s iniciado.");
  
  // Roda a lógica a cada 5 segundos
  setInterval(runUpdateLoop, CACHE_COOLDOWN_MS);
}

module.exports = { startBackgroundLoop };
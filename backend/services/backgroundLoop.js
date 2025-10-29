// backend/services/backgroundLoop.js

// Importamos 'clientSubscriptions' para saber quem está assistindo o quê
const { characterCache, clientSubscriptions, CACHE_COOLDOWN_MS } = require('../state');

const { fetchFromGoogle } = require('./googleFetcher');
const { getCharacterIdFromUrl } = require('../utils/helpers');

// Precisamos da instância do WSS para fazer o broadcast
let wssInstance = null;

// A função de broadcast foi totalmente substituída por esta versão direcionada.
/**
 * Envia uma lista de personagens atualizados APENAS para os clientes
 * que se inscreveram nesses links específicos.
 */
function broadcastUpdates(updatedCharacters) {
  if (updatedCharacters.length === 0 || !wssInstance) return;

  console.log(`[Broadcast] Enviando ${updatedCharacters.length} atualizações direcionadas...`);

  // 1. Cria um "Mapa de consulta" para encontrar atualizações por URL.
  // Ex: Map<"link_A", { ...dadosDaFichaA } >
  const updatesByUrl = new Map();
  for (const charData of updatedCharacters) {
    updatesByUrl.set(charData.originalUrl, charData);
  }

  // 2. Itera sobre o mapa de inscrições (NÃO sobre a lista geral de clientes)
  // client = o objeto 'ws' da conexão
  // subscribedLinks = o Set<string> de links que ELES se inscreveram
  clientSubscriptions.forEach((subscribedLinks, client) => {
    
    // 3. Verifica se o cliente ainda está conectado
    if (client.readyState !== client.OPEN) {
      return; // Pula para o próximo cliente
    }

    // 4. Coleta apenas as atualizações que ESTE cliente específico se inscreveu
    const clientSpecificUpdates = [];
    subscribedLinks.forEach(link => {
      // O link que o cliente assiste foi atualizado?
      const update = updatesByUrl.get(link);
      if (update) {
        // Sim! Adiciona na lista de envio deste cliente.
        clientSpecificUpdates.push(update);
      }
    });

    // 5. Se encontramos atualizações para este cliente, envia a mensagem
    if (clientSpecificUpdates.length > 0) {
      try {
        const message = JSON.stringify({
          type: 'DATA_UPDATE',
          payload: clientSpecificUpdates // Envia a lista personalizada
        });
        client.send(message);
      } catch (e) {
        console.error("[Broadcast] Erro ao enviar mensagem para cliente:", e);
      }
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
      const newData = await fetchFromGoogle(characterId); 
      
      if (newData) {
        // 4. COMPARAÇÃO: Os dados mudaram?
        const hasChanged = JSON.stringify(newData.data) !== JSON.stringify(oldEntry?.data);

        if (hasChanged) {
          console.log(`[Loop] Mudança detectada em: ${characterId}`);
          
          const dataToPush = { 
            ...newData.data, 
            originalUrl: link 
          };
          updatedCharacters.push(dataToPush);
        }
        
        // 5. Atualiza o cache
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
 */
function startBackgroundLoop(wss) {
  if (wssInstance) {
    return;
  }
  
  wssInstance = wss;
  console.log("[Loop] Loop de 5s iniciado.");
  
  setInterval(runUpdateLoop, CACHE_COOLDOWN_MS);
}

module.exports = { startBackgroundLoop };
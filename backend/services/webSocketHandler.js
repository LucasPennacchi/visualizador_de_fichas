const { characterCache, clientSubscriptions } = require('../state');
const { fetchFromGoogle } = require('./googleFetcher');
const { getCharacterIdFromUrl } = require('../utils/helpers');

function initializeWebSocket(wss) {
  wss.on('connection', ws => {
    console.log('[WebSocket] Cliente conectado.');

    // O que fazer quando um cliente envia uma mensagem
    ws.on('message', messageBuffer => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        
        // Cliente está dizendo quais links ele quer assistir
        if (message.type === 'SUBSCRIBE_LINKS') {
          const links = new Set(message.payload); // Garante que não há duplicatas
          clientSubscriptions.set(ws, links);
          console.log(`[WebSocket] Cliente agora assiste ${links.size} fichas.`);
          
          // Envia os dados atuais IMEDIATAMENTE para este cliente
          (async () => {
            const initialData = [];
            for (const link of links) {
              const charId = getCharacterIdFromUrl(link);
              let entry = characterCache.get(charId);
              // Se não estiver no cache, busca agora
              if (!entry) {
                const newData = await fetchFromGoogle(charId);
                if (newData) {
                  entry = { ...newData, lastRequestedTime: Date.now() };
                  characterCache.set(charId, entry);
                }
              }
              if (entry) {
                initialData.push({ ...entry.data, originalUrl: link });
              }
            }
            // Envia os dados iniciais SÓ PARA ESTE CLIENTE
            ws.send(JSON.stringify({ type: 'DATA_UPDATE', payload: initialData }));
          })();
        }
        
      } catch (e) {
        console.error('[WebSocket] Mensagem inválida recebida:', e);
      }
    });

    // O que fazer quando um cliente desconecta
    ws.on('close', () => {
      console.log('[WebSocket] Cliente desconectado.');
      clientSubscriptions.delete(ws); // Para de assistir os links dele
    });

    ws.on('error', (e) => {
      console.error('[WebSocket] Erro:', e);
    });
  });
}

module.exports = { initializeWebSocket };
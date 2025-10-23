const express = require('express');
const axios = require('axios');
const cors = require('cors');
const compression = require('compression');
const http = require('http'); // 1. Precisamos do HTTP nativo
const { WebSocketServer } = require('ws'); // 2. Importamos o WebSocket

const app = express();
const PORT = 3000;

app.use(cors());
app.use(compression()); 

// --- Configuração do Servidor ---
// O Express app não vai "ouvir" a porta diretamente.
// O servidor HTTP vai "embrulhar" o Express.
const server = http.createServer(app);

// O Servidor WebSocket (wss) vai "grudar" no servidor HTTP.
const wss = new WebSocketServer({ server });

// --- Lógica do Cache ---
const characterCache = new Map();
const CACHE_COOLDOWN_MS = 5000; // 5 segundos

// --- Gerenciamento de Clientes WebSocket ---
// Guarda quais links cada cliente (ws) está "assistindo".
// Ex: Map<ws, Set["link1", "link2"]>
const clientSubscriptions = new Map();

// Função para extrair o ID
function getCharacterIdFromUrl(url) {
    try {
        const targetUrl = new URL(url);
        const pathParts = targetUrl.pathname.split('/');
        return pathParts[pathParts.length - 1];
    } catch (error) {
        console.error('URL inválida:', url);
        return null;
    }
}

// Função de busca no Google
async function fetchFromGoogle(characterId) {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/${characterId}`;
    try {
        const { data } = await axios.get(firestoreUrl);
        const fields = data.fields;
        const characterData = {
            name: fields.name.stringValue,
            hp: `${fields.currentPv.integerValue}/${fields.maxPv.integerValue}`,
            sanity: `${fields.currentSan.integerValue}/${fields.maxSan.integerValue}`,
            effort: `${fields.currentPe.integerValue}/${fields.maxPe.integerValue}`,
            picture: fields.sheetPictureURL.stringValue,
            isDying: fields.deathMode.booleanValue,
            isCrazy: fields.madnessMode.booleanValue,
            evade: fields.evade.integerValue.toString(),
            block: fields.block.integerValue.toString(),
            movement: fields.movement.integerValue.toString(),
            nex: fields.nex.stringValue,
            className: fields.className.stringValue,
            load: `${fields.currentLoad.integerValue}/${fields.maxLoad.integerValue}`
        };
        return { data: characterData, lastFetchTime: Date.now() };
    } catch (error) {
        return null;
    }
}

// --- Transmissão (Broadcast) ---
// Envia uma lista de personagens atualizados para todos os clientes.
function broadcastUpdates(updatedCharacters) {
    if (updatedCharacters.length === 0) return; // Nada para enviar

    console.log(`[Broadcast] Enviando ${updatedCharacters.length} atualizações...`);
    const message = JSON.stringify({
        type: 'DATA_UPDATE',
        payload: updatedCharacters
    });
    
    // Envia para CADA cliente conectado
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(message);
        }
    });
}

// --- Loop de Fundo ---
// --- Loop de Fundo (Modificado) ---
// Agora ele detecta mudanças e faz o broadcast
async function startBackgroundLoop() {
    console.log("[Loop] Loop de 5s iniciado.");
    
    // Roda a cada 5 segundos
    setInterval(async () => {
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
                    const hasChanged = JSON.stringify(newData.data) !== JSON.stringify(oldEntry?.data);

                    if (hasChanged) {
                        console.log(`[Loop] Mudança detectada em: ${characterId}`);
                        
                        // Em vez de enviar 'newData', nós montamos o objeto "plano"
                        // exatamente como o frontend espera.
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

    }, CACHE_COOLDOWN_MS);
}

// --- Gerenciamento das Conexões WebSocket ---
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

// A Rota de Batch (para o caso de querermos usar) ainda pode existir, mas não é mais usada
app.get('/scrape-batch', (req, res) => {
    res.status(404).json({ error: 'Endpoint obsoleto. Use WebSockets.' });
});

// O Servidor HTTP que "liga" tudo
server.listen(PORT, () => {
    console.log(`Servidor (Express + WebSocket) rodando na porta ${PORT}`);
    startBackgroundLoop(); // Inicia o loop de 5s
});
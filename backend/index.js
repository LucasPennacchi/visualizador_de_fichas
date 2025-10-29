const express = require('express');
const cors = require('cors');
const compression = require('compression');
const http = require('http');
const { WebSocketServer } = require('ws');

// Importando os módulos refatorados
const { initializeWebSocket } = require('./services/webSocketHandler');
const { startBackgroundLoop } = require('./services/backgroundLoop');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(compression()); 

// --- Configuração do Servidor ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Inicialização dos Módulos ---

// 1. Inicializa o handler que cuida das conexões dos clientes
initializeWebSocket(wss);

// 2. Rota de API (obsoleta, mantida por segurança)
app.get('/scrape-batch', (req, res) => {
    res.status(404).json({ error: 'Endpoint obsoleto. Use WebSockets.' });
});

// 3. Inicia o servidor HTTP
server.listen(PORT, () => {
    console.log(`Servidor (Express + WebSocket) rodando na porta ${PORT}`);
    
    // 4. Inicia o loop de fundo que busca dados
    // (Passamos a instância do 'wss' para ele poder fazer broadcasts)
    startBackgroundLoop(wss); 
});
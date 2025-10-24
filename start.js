// start.js
const { spawn } = require('child_process');
const axios = require('axios');
// REMOVEMOS o 'require("clipboardy")' daqui de cima

// --- Configure seu link aqui ---
const GITHUB_URL_TEMPLATE = "https://lucaspennacchi.github.io/visualizador_de_fichas/?ws=";

/**
 * Tenta repetidamente se conectar à API do ngrok para obter a URL.
 */
async function getNgrokHost(retries = 10) {
    if (retries === 0) {
        throw new Error("Não foi possível conectar à API do ngrok (localhost:4040) após 10 tentativas.");
    }

    try {
        // Espera 1.5 segundos entre as tentativas para dar tempo ao ngrok
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        
        const response = await axios.get('http://localhost:4040/api/tunnels');
        const tunnels = response.data.tunnels;
        
        // Procura o túnel HTTPS (o que começa com https://)
        const httpsTunnel = tunnels.find(tunnel => tunnel.proto === 'https');
        
        if (httpsTunnel && httpsTunnel.public_url) {
            const publicUrl = httpsTunnel.public_url;
            // Extrai apenas o hostname (ex: "nome.ngrok-free.dev")
            const hostname = new URL(publicUrl).hostname;
            return hostname;
        } else {
            // Se a API está no ar mas o túnel ainda não, tenta de novo
            console.log("API do ngrok no ar, mas túnel https ainda não está pronto. Tentando de novo...");
            return getNgrokHost(retries - 1);
        }
    } catch (error) {
        // Se a API não está no ar (ex: 404, ECONNREFUSED), tenta de novo
        console.log("Aguardando API do ngrok (localhost:4040) ficar online...");
        return getNgrokHost(retries - 1);
    }
}

/**
 * Função principal que inicia tudo
 */
async function start() {
    console.log("Iniciando servidor backend (backend/server.js)...");
    
    const backend = spawn('node', ['backend/server.js'], { shell: true, stdio: 'inherit' });

    console.log("Iniciando ngrok (ngrok http 3000)...");
    const ngrok = spawn('ngrok', ['http', '3000'], { shell: true, stdio: 'inherit' });

    console.log("\nAguardando ngrok gerar o link...");
    
    try {
        const ngrokHost = await getNgrokHost(); // Espera a URL ficar pronta
        const finalUrl = GITHUB_URL_TEMPLATE + ngrokHost;
        
        // CORREÇÃO 2: Importamos o 'clipboardy' dinamicamente aqui dentro
        // Isso resolve o "clipboardy.write is not a function"
        const { default: clipboardy } = await import('clipboardy');
        
        // Copia o link para a área de transferência
        await clipboardy.write(finalUrl);

        console.log("\n===============================================================");
        console.log("✅ SEU LINK DO OBS ESTA PRONTO E FOI COPIADO!");
        console.log("\n" + finalUrl + "\n");
        console.log("===============================================================\n");
        console.log("O backend e o ngrok estão rodando. Pressione Ctrl+C para parar TUDO.");

    } catch (error) {
        console.error("\n[ERRO] Não foi possível obter a URL do ngrok.");
        console.error(error.message);
        // Mata os processos se a automação falhar
        backend.kill();
        ngrok.kill();
        process.exit(1);
    }

    // Garante que se o script principal for fechado (Ctrl+C), os filhos também sejam
    const killProcesses = () => {
        console.log("\nParando servidores...");
        backend.kill();
        ngrok.kill();
        process.exit();
    };
    
    process.on('SIGINT', killProcesses); // Captura Ctrl+C
    process.on('SIGTERM', killProcesses); // Captura 'kill'
}

// Inicia a mágica
start();
const { default: clipboardy } = require('clipboardy');
const axios = require('axios');

// --- Configure seu link aqui ---
const GITHUB_URL_TEMPLATE = "https://lucaspennacchi.github.io/visualizador_de_fichas/?ws=";

/**
 * Tenta repetidamente se conectar à API do ngrok para obter a URL.
 */
async function getNgrokHost(retries = 10) {
    if (retries === 0) {
        throw new Error("Nao foi possivel conectar a API do ngrok (localhost:4040) apos 10 tentativas.");
    }

    try {
        // Nao e preciso esperar, o .bat ja esperou 15s
        const response = await axios.get('http://localhost:4040/api/tunnels');
        const tunnels = response.data.tunnels;
        const httpsTunnel = tunnels.find(tunnel => tunnel.proto === 'https';

        if (httpsTunnel && httpsTunnel.public_url) {
            const hostname = new URL(httpsTunnel.public_url).hostname;
            return hostname;
        } else {
            console.log("API do ngrok no ar, mas tunel https ainda nao esta pronto. Tentando de novo em 2s...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            return getNgrokHost(retries - 1);
        }
    } catch (error) {
        console.log("Aguardando API do ngrok (localhost:4040) ficar online... Tentando de novo em 2s...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        return getNgrokHost(retries - 1);
    }
}

/**
 * Funcao principal
 */
async function fetchAndCopy() {
    try {
        const ngrokHost = await getNgrokHost();
        const finalUrl = GITHUB_URL_TEMPLATE + ngrokHost;

        await clipboardy.write(finalUrl);

        console.log("\n===============================================================");
        console.log("✅ SEU LINK DO OBS ESTA PRONTO E FOI COPIADO!");
        console.log("\n" + finalUrl + "\n");
        console.log("===============================================================\n");

    } catch (error) {
        console.error("\n[ERRO] Nao foi possivel obter a URL do ngrok.");
        console.error(error.message);
        process.exit(1);
    }
}

// Inicia a logica
fetchAndCopy();
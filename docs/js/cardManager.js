import { getLinks } from './storage.js';
import { createOrUpdateCard } from './ui.js'; // CORREÇÃO 1: Importar SÓ o que é exportado.
import { DATA_STORAGE_KEY } from './config.js';

/**
 * Converte a resposta complexa do Firestore para o objeto "achatado" que a UI espera.
 * MOVIDO para cá, pois isto é processamento de dados.
 */
function flattenFirestoreData(originalUrl, data) {
    try {
        const fields = data.fields;
        // Funções helper para extrair valores com segurança
        const s = (val) => val?.stringValue || '';
        const i = (val) => val?.integerValue || '0';
        const b = (val) => val?.booleanValue || false;

        return {
            originalUrl: originalUrl,
            name: s(fields.name),
            hp: `${i(fields.currentPv)}/${i(fields.maxPv)}`,
            sanity: `${i(fields.currentSan)}/${i(fields.maxSan)}`,
            effort: `${i(fields.currentPe)}/${i(fields.maxPe)}`,
            picture: s(fields.sheetPictureURL),
            isDying: b(fields.deathMode),
            isCrazy: b(fields.madnessMode),
            evade: i(fields.evade),
            block: i(fields.blockValue), // Lembre que mudamos para 'blockValue' no POJO
            movement: i(fields.movement),
            nex: s(fields.nex),
            className: s(fields.className),
            load: `${i(fields.currentLoad)}/${i(fields.maxLoad)}`
        };
    } catch (e) {
        console.error("Erro ao achatar dados do Firestore:", e, data);
        return null;
    }
}

/**
 * Processa dados vindos do WebSocket (1 por 1) ou do Cache (vários)
 * @param {Array<Object>} charactersData - Um array de payloads do backend { originalUrl, data }
 */
export function processBatchData(charactersData) {
    if (!charactersData || charactersData.length === 0) return;

    const links = getLinks();

    // O cache atual é lido apenas para ser sobrescrito se houver dados novos
    // Isto é mais simples do que tentar fazer um "merge"
    const currentCache = (JSON.parse(localStorage.getItem(DATA_STORAGE_KEY)) || []).filter(item => links.includes(item.originalUrl));
    const newCacheMap = new Map(currentCache.map(item => [item.originalUrl, item]));

    for (const payload of charactersData) {
        const { originalUrl, data } = payload;

        // Garante que o dado é válido e ainda é assistido
        if (!originalUrl || !data || !links.includes(originalUrl)) {
            continue;
        }

        // 1. Achata os dados para o formato da UI
        const flattenedData = flattenFirestoreData(originalUrl, data);
        if (!flattenedData) continue;

        // 2. CORREÇÃO 2: Chama a função correta da UI para renderizar
        createOrUpdateCard(originalUrl, flattenedData);

        // 3. Atualiza o mapa do novo cache com os dados BRUTOS (vindos do backend)
        newCacheMap.set(originalUrl, payload);
    }

    // Salva o cache atualizado no localStorage
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(Array.from(newCacheMap.values())));
}

/**
 * Carrega os dados do cache local ao iniciar.
 * Esta função pertence ao cardManager.
 */
export function loadCachedData() {
    const cachedData = JSON.parse(localStorage.getItem(DATA_STORAGE_KEY));
    if (cachedData && cachedData.length > 0) {
        console.log(`[Cache Cliente] Carregando ${cachedData.length} cards "velhos"...`);
        // Reutiliza a mesma função de processamento
        processBatchData(cachedData);
    }
}


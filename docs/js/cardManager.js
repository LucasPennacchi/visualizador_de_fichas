import { getLinks } from './storage.js';
import { createOrUpdateCard, togglePlaceholder } in './ui.js';
import { DATA_STORAGE_KEY } from './config.js';

/**
 * Converte a resposta complexa do Firestore para o objeto "achatado" que a UI espera.
 * AGORA É DEFENSIVO: Verifica se 'data' e 'data.fields' existem.
 */
function flattenFirestoreData(originalUrl, data) {
    try {
        // ---- INÍCIO DA CORREÇÃO ----
        // 1. Verifica se 'data' e 'data.fields' existem.
        if (!data || !data.fields) {
            console.error("Dados recebidos do backend estão vazios ou malformados.", originalUrl, data);
            return null; // Retorna nulo para que o processador saiba que falhou
        }
        // ---- FIM DA CORREÇÃO ----

        const fields = data.fields;

        // Funções helper para extrair valores com segurança (agora mais seguras)
        const s = (val) => val?.stringValue || '';
        const i = (val) => val?.integerValue || '0';
        const b = (val) => val?.booleanValue || false;

        return {
            originalUrl: originalUrl,
            name: s(fields.name), // Linha 19 (agora segura)
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
        console.error("Erro ao 'achatar' dados do Firestore:", e, data);
        return null; // Retorna nulo em caso de qualquer erro
    }
}

/**
 * Processa dados vindos do WebSocket (1 por 1) ou do Cache (vários)
 */
export function processBatchData(charactersData) {
    if (!charactersData || charactersData.length === 0) return;

    const links = getLinks();

    // O cache atual é lido apenas para ser sobrescrito se houver dados novos
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

        // ---- CORREÇÃO ----
        // 2. Se o 'flatten' falhou (retornou null), não faz nada.
        if (!flattenedData) {
            console.warn(`Falha ao processar dados para ${originalUrl}. Pulando.`);
            continue;
        }
        // ---- FIM DA CORREÇÃO ----

        // 3. Chama a função da UI para renderizar
        createOrUpdateCard(originalUrl, flattenedData);

        // 4. Atualiza o mapa do novo cache com os dados BRUTOS (vindos do backend)
        newCacheMap.set(originalUrl, payload);
    }

    // 5. Garante que o placeholder não está visível
    if (newCacheMap.size > 0) {
        togglePlaceholder(false);
    }

    // Salva o cache atualizado no localStorage
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(Array.from(newCacheMap.values())));
}

/**
 * Carrega os dados do cache local ao iniciar.
 */
export function loadCachedData() {
    const links = getLinks();
    const cachedData = (JSON.parse(localStorage.getItem(DATA_STORAGE_KEY)) || [])
        .filter(item => links.includes(item.originalUrl)); // Filtra apenas os links que ainda usamos

    if (cachedData && cachedData.length > 0) {
        console.log(`[Cache Cliente] Carregando ${cachedData.length} cards "velhos"...`);
        togglePlaceholder(false);
        // Reutiliza a mesma função de processamento
        processBatchData(cachedData);
    } else if (links.length === 0) {
        togglePlaceholder(true);
    } else {
        // Temos links, mas nenhum cache.
        togglePlaceholder(false);
        console.log("[Cache Cliente] Links encontrados, mas sem cache. Aguardando dados ao vivo.");
    }
}
/**
 * @module Services/Poller/Adapters/CrisAdapter
 * @description Adaptador específico para o sistema "Ordem Paranormal" via plataforma C.R.I.S.
 * Realiza a extração de dados da API do Google Firestore e a transformação para o Modelo Canônico.
 * * Implementa lógica de detecção heurística para o modo "Sobrevivendo ao Horror" (Determinação),
 * verificando múltiplas flags (isPdOn, isSobrevivendoAoHorror) para garantir compatibilidade.
 */

const axios = require('axios');
const { registerAdapter } = require('./registry');

// --- Helpers de Transformação (Mappers) ---

/**
 * Remove tags HTML de strings vindas de editores de texto rico.
 * @param {string} text - Texto sujo.
 * @returns {string} Texto limpo.
 */
const sanitize = (text) => (text || '').replace(/<[^>]*>?/gm, '');

/**
 * Extrai o ID do personagem da URL do C.R.I.S.
 * @param {string} url - URL completa.
 * @returns {string|null} ID do personagem.
 */
const getCharacterId = (url) => {
    try {
        const pathParts = new URL(url).pathname.split('/');
        return pathParts.filter(p => p).pop() || null;
    } catch (e) { return null; }
};

// --- Mappers de Sub-estruturas ---

/**
 * Mapeia as barras de recursos vitais baseando-se no modo de jogo detectado.
 * Utiliza verificação robusta de flags (PD ou Sobrevivendo ao Horror).
 * * @param {Object} fields - Campos brutos do Firestore.
 * @returns {Array<Object>} Lista de objetos vitais canônicos.
 */
const mapVitals = (fields) => {
    const vitals = [];
    
    // 1. Vida (PV) - Sempre presente
    vitals.push({
        id: "hp",
        label: "PV",
        current: parseInt(fields.currentPv?.integerValue || 0),
        max: parseInt(fields.maxPv?.integerValue || 0),
        color: "#dc3545", // Vermelho
        order: 1
    });

    // Detecção do Modo "Sobrevivendo ao Horror" / "Determinação"
    // Verifica a flag explícita OU a flag legado 'isPdOn' OU se existe valor máximo de PD configurado
    const isSurvivalHorror = fields.isSobrevivendoAoHorror?.booleanValue;
    const isPdOn = fields.isPdOn?.booleanValue;
    const hasPdStats = (fields.maxPd?.integerValue && parseInt(fields.maxPd.integerValue) > 0);

    const shouldUseDetermination = isPdOn;

    if (shouldUseDetermination) {
        // Modo Determinação (PD/DT)
        // Tenta ler dos campos 'Pd', com fallback para 'Dt' ou 'San' se necessário
        const currentDt = fields.currentPd?.integerValue || fields.currentDt?.integerValue || 0;
        const maxDt = fields.maxPd?.integerValue || fields.maxDt?.integerValue || 0;

        vitals.push({
            id: "dt",
            label: "DT", // Determinação
            current: parseInt(currentDt),
            max: parseInt(maxDt),
            color: "#6f42c1", // Roxo
            order: 2
        });
    } else {
        // Modo Padrão (Ordem Paranormal Clássico)
        vitals.push({
            id: "san",
            label: "SAN",
            current: parseInt(fields.currentSan?.integerValue || 0),
            max: parseInt(fields.maxSan?.integerValue || 0),
            color: "#007bff", // Azul
            order: 2
        });

        vitals.push({
            id: "pe",
            label: "PE",
            current: parseInt(fields.currentPe?.integerValue || 0),
            max: parseInt(fields.maxPe?.integerValue || 0),
            color: "#ffc107", // Amarelo
            order: 3
        });
    }

    return vitals;
};

const mapAttributes = (attrs) => {
    // Fallback para objeto vazio caso attrs seja undefined
    const safeAttrs = attrs || {};
    return [
        { id: "agi", label: "AGI", value: safeAttrs.dex?.integerValue || 0 },
        { id: "for", label: "FOR", value: safeAttrs.str?.integerValue || 0 },
        { id: "int", label: "INT", value: safeAttrs.int?.integerValue || 0 },
        { id: "pre", label: "PRE", value: safeAttrs.pre?.integerValue || 0 },
        { id: "vig", label: "VIG", value: safeAttrs.con?.integerValue || 0 }
    ];
};

const mapSecondaryStats = (fields) => [
    { label: "Defesa", value: fields.evade?.integerValue || "0" },
    { label: "Bloqueio", value: fields.block?.integerValue || "0" },
    { label: "Desl.", value: `${fields.movement?.integerValue || 0}m` },
    { label: "Carga", value: `${fields.currentLoad?.integerValue || 0}/${fields.maxLoad?.integerValue || 0}` }
];

// --- Implementação do Adaptador ---

/**
 * Verifica se este adaptador é capaz de processar a URL fornecida.
 * @param {string} url - URL da ficha.
 * @returns {boolean} True se for uma URL do C.R.I.S.
 */
function matches(url) {
    return url.includes('crisordemparanormal.com') || url.includes('firestore.googleapis.com');
}

/**
 * Busca os dados e retorna o JSON Canônico.
 * @param {string} url - URL da ficha.
 * @returns {Promise<Object|null>} O objeto canônico normalizado.
 */
async function fetch(url) {
    const charId = getCharacterId(url);
    if (!charId) throw new Error("ID inválido na URL");

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/${charId}`;

    try {
        const { data } = await axios.get(firestoreUrl);
        const fields = data.fields;

        // Lógica de Decisão Visual (Status)
        let borderColor = null; 
        
        if (fields.deathMode?.booleanValue) {
            borderColor = "#dc3545"; // Vermelho
        } else if (fields.madnessMode?.booleanValue) {
            borderColor = "#800080"; // Roxo
        }

        // Construção do JSON Canônico
        const canonicalData = {
            meta: {
                version: "1.0.0",
                systemId: "ordem_paranormal",
                characterId: charId,
                sourceUrl: url
            },
            header: {
                name: fields.name?.stringValue || 'Desconhecido',
                description: `${fields.className?.stringValue || 'Classe'} - NEX ${fields.nex?.stringValue || '0%'}`,
                avatarUrl: fields.sheetPictureURL?.stringValue || '',
                borderColor: borderColor
            },
            // Mapeamento condicional de barras vitais
            vitals: mapVitals(fields),
            attributes: mapAttributes(fields.attributes?.mapValue?.fields),
            properties: mapSecondaryStats(fields),
            sections: [
                {
                    id: "skills",
                    title: "Perícias",
                    type: "simple-list",
                    items: (fields.skills?.arrayValue?.values || []).map(item => ({
                        label: item.mapValue.fields.name.stringValue,
                        value: `+${item.mapValue.fields.trainingDegree.stringValue}`,
                        tags: [item.mapValue.fields.attribute.stringValue]
                    }))
                },
                {
                    id: "inventory",
                    title: "Inventário",
                    type: "detailed-list",
                    items: (fields.inventory?.arrayValue?.values || []).map(item => {
                        const slotsVal = item.mapValue.fields.slots?.stringValue || 
                                       item.mapValue.fields.slots?.integerValue || "0";
                        return {
                            label: item.mapValue.fields.name.stringValue,
                            tags: [`${slotsVal} slot`],
                            description: sanitize(item.mapValue.fields.description?.stringValue)
                        };
                    })
                },
                {
                    id: "rituals",
                    title: "Rituais",
                    type: "detailed-list",
                    items: (fields.rituals?.arrayValue?.values || []).map(item => ({
                        label: item.mapValue.fields.name.stringValue,
                        description: sanitize(item.mapValue.fields.description?.stringValue)
                    }))
                },
                {
                    id: "powers",
                    title: "Habilidades",
                    type: "detailed-list",
                    items: (fields.powers?.arrayValue?.values || []).map(item => ({
                        label: item.mapValue.fields.name.stringValue,
                        description: sanitize(item.mapValue.fields.description?.stringValue)
                    }))
                }
            ]
        };

        return { data: canonicalData, lastFetchTime: Date.now() };

    } catch (error) {
        console.error(`[CrisAdapter] Erro ao buscar ${charId}: ${error.message}`);
        return null;
    }
}

// Auto-registro
const adapter = { systemId: 'ordem_paranormal_cris', matches, fetch };
registerAdapter(adapter);

module.exports = adapter;
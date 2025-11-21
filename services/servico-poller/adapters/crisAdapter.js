/**
 * @module Services/Poller/Adapters/CrisAdapter
 * @description Adaptador específico para o sistema "Ordem Paranormal" via plataforma C.R.I.S.
 * Realiza a extração de dados da API do Google Firestore e a transformação para o Modelo Canônico.
 * * @responsibility
 * 1. Buscar dados brutos.
 * 2. Normalizar estatísticas (Atributos, Perícias).
 * 3. Traduzir estados de jogo (Morrendo, Enlouquecendo) para feedback visual genérico (Cores).
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

const mapVitals = (fields) => [
    {
        id: "hp",
        label: "PV",
        current: parseInt(fields.currentPv.integerValue),
        max: parseInt(fields.maxPv.integerValue),
        color: "#dc3545", // Vermelho
        order: 1
    },
    {
        id: "san",
        label: "SAN",
        current: parseInt(fields.currentSan.integerValue),
        max: parseInt(fields.maxSan.integerValue),
        color: "#007bff", // Azul
        order: 2
    },
    {
        id: "pe",
        label: "PE",
        current: parseInt(fields.currentPe.integerValue),
        max: parseInt(fields.maxPe.integerValue),
        color: "#ffc107", // Amarelo
        order: 3
    }
];

const mapAttributes = (attrs) => [
    { id: "agi", label: "AGI", value: attrs.dex.integerValue },
    { id: "for", label: "FOR", value: attrs.str.integerValue },
    { id: "int", label: "INT", value: attrs.int.integerValue },
    { id: "pre", label: "PRE", value: attrs.pre.integerValue },
    { id: "vig", label: "VIG", value: attrs.con.integerValue }
];

const mapSecondaryStats = (fields) => [
    { label: "Defesa", value: fields.evade?.integerValue || "0" },
    { label: "Bloqueio", value: fields.block?.integerValue || "0" },
    { label: "Desl.", value: `${fields.movement?.integerValue || 0}m` },
    { label: "Carga", value: `${fields.currentLoad?.integerValue}/${fields.maxLoad?.integerValue}` }
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
 * Realiza a tradução de regras de negócio para propriedades visuais.
 * * @param {string} url - URL da ficha.
 * @returns {Promise<Object|null>} O objeto canônico normalizado.
 */
async function fetch(url) {
    const charId = getCharacterId(url);
    if (!charId) throw new Error("ID inválido na URL");

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/${charId}`;

    try {
        const { data } = await axios.get(firestoreUrl);
        const fields = data.fields;

        // --- Lógica de Decisão Visual (Adapter Pattern) ---
        // O Adaptador decide a cor da borda baseado nas regras do sistema específico.
        // Isso remove a lógica de "regras" do frontend.
        let borderColor = null; // Null = cor padrão (cinza/neutro)
        
        if (fields.deathMode.booleanValue) {
            borderColor = "#dc3545"; // Vermelho (Morrendo)
        } else if (fields.madnessMode.booleanValue) {
            borderColor = "#800080"; // Roxo (Enlouquecendo)
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
                name: fields.name.stringValue,
                description: `${fields.className.stringValue} - NEX ${fields.nex.stringValue}`,
                avatarUrl: fields.sheetPictureURL.stringValue,
                // Injeção da propriedade visual calculada
                borderColor: borderColor
            },
            // 'status' removido pois a lógica visual já foi resolvida acima
            vitals: mapVitals(fields),
            attributes: mapAttributes(fields.attributes.mapValue.fields),
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
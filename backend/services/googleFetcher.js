// backend/services/googleFetcher.js

const axios = require('axios');

// --- Helpers de Parse (internos deste módulo) ---

// Helper genérico para extrair arrays do JSON do Firestore
const parseArray = (field, mapper) => {
    if (!field || !field.arrayValue || !field.arrayValue.values) {
        return [];
    }
    return field.arrayValue.values.map(mapper);
};

// Mapper para Habilidades (Powers)
const mapPower = (item) => ({
    name: item.mapValue.fields.name.stringValue,
    description: item.mapValue.fields.description.stringValue.replace(/<[^>]*>?/gm, '') 
});

// Mapper para Itens do Inventário
const mapInventoryItem = (item) => {
    const fields = item.mapValue.fields;
    const slotsField = fields.slots;
    
    // Lógica de fallback para 'slots'
    let slotsValue = '0'; // Padrão
    if (slotsField) {
        if (slotsField.stringValue !== undefined) {
            // Se for stringValue, usa
            slotsValue = slotsField.stringValue;
        } else if (slotsField.integerValue !== undefined) {
            // Se for integerValue, converte para string
            slotsValue = slotsField.integerValue.toString();
        }
    }

    return {
        name: fields.name.stringValue,
        description: fields.description.stringValue.replace(/<[^>]*>?/gm, ''),
        slots: slotsValue // Usa o valor seguro
    };
};

// Mapper para Rituais
const mapRitual = (item) => ({
    name: item.mapValue.fields.name.stringValue,
    description: item.mapValue.fields.description.stringValue.replace(/<[^>]*>?/gm, '')
});

// Mapper para Perícias
const mapSkill = (item) => {
    const fields = item.mapValue.fields;
    return {
        name: fields.name.stringValue,
        attribute: fields.attribute.stringValue, // Ex: "AGI", "VIG", "PRE"
        bonus: parseInt(fields.trainingDegree.stringValue, 10) || 0
    };
};


/**
 * Busca e transforma os dados de um personagem do Firestore.
 * @param {string} characterId - O ID do personagem.
 * @returns {Promise<Object|null>} Objeto com dados do personagem ou null se falhar.
 */
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
            load: `${fields.currentLoad.integerValue}/${fields.maxLoad.integerValue}`,

            attributes: {
                str: fields.attributes.mapValue.fields.str.integerValue,
                dex: fields.attributes.mapValue.fields.dex.integerValue,
                con: fields.attributes.mapValue.fields.con.integerValue,
                int: fields.attributes.mapValue.fields.int.integerValue,
                pre: fields.attributes.mapValue.fields.pre.integerValue,
            },
            powers: parseArray(fields.powers, mapPower),
            inventory: parseArray(fields.inventory, mapInventoryItem),
            rituals: parseArray(fields.rituals, mapRitual),
            skills: parseArray(fields.skills, mapSkill)
        };
        return { data: characterData, lastFetchTime: Date.now() };
    } catch (error) {
        console.error(`[Fetch] Falha ao buscar ${characterId}: ${error.message}`);
        return null;
    }
}

module.exports = { fetchFromGoogle };
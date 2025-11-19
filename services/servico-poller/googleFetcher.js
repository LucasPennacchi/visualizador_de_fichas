/**
 * @module Services/Poller/GoogleFetcher
 * @description Módulo de integração (Adapter) responsável por buscar e normalizar dados da API do Google Firestore.
 * Converte a estrutura de dados proprietária do Firestore (com tipos explícitos como `stringValue`, `integerValue`)
 * em um modelo de domínio limpo e simplificado para uso na aplicação.
 */

const axios = require('axios');

// --- Helpers de Mapeamento (Transformadores de Dados) ---

/**
 * Função auxiliar genérica para extrair e mapear arrays da estrutura do Firestore.
 * Lida com a possibilidade de campos nulos ou arrays vazios na resposta da API.
 * * @param {Object} field - O objeto de campo vindo do Firestore (ex: contendo `arrayValue`).
 * @param {function} mapper - Função transformadora a ser aplicada em cada item do array.
 * @returns {Array} Array mapeado ou array vazio se o campo não existir.
 */
const parseArray = (field, mapper) => {
    if (!field || !field.arrayValue || !field.arrayValue.values) {
        return [];
    }
    return field.arrayValue.values.map(mapper);
};

/**
 * Mapeia um objeto de habilidade (Power) do Firestore para o formato da aplicação.
 * Sanitiza a descrição removendo tags HTML indesejadas.
 * * @param {Object} item - O objeto bruto do Firestore representando uma habilidade.
 * @returns {Object} Objeto normalizado com `name` e `description`.
 */
const mapPower = (item) => ({
    name: item.mapValue.fields.name.stringValue,
    // Regex para remover tags HTML (<p>, <br>, etc) da descrição vinda do editor rico
    description: (item.mapValue.fields.description?.stringValue || '').replace(/<[^>]*>?/gm, '') 
});

/**
 * Mapeia um item de inventário, tratando a inconsistência de tipos no campo 'slots'.
 * O Firestore pode retornar 'slots' como string ou integer dependendo da origem do dado.
 * * @param {Object} item - O objeto bruto do item de inventário.
 * @returns {Object} Objeto normalizado com `name`, `description` e `slots` (como string).
 */
const mapInventoryItem = (item) => {
    const fields = item.mapValue.fields;
    const slotsField = fields.slots;
    
    // Normalização defensiva de tipo para 'slots'
    let slotsValue = '0';
    if (slotsField) {
        if (slotsField.stringValue !== undefined) {
            slotsValue = slotsField.stringValue;
        } else if (slotsField.integerValue !== undefined) {
            slotsValue = slotsField.integerValue.toString();
        }
    }

    return {
        name: fields.name.stringValue,
        description: (fields.description?.stringValue || '').replace(/<[^>]*>?/gm, ''),
        slots: slotsValue
    };
};

/**
 * Mapeia um ritual do Firestore para o formato da aplicação.
 * * @param {Object} item - O objeto bruto do ritual.
 * @returns {Object} Objeto normalizado com `name` e `description`.
 */
const mapRitual = (item) => ({
    name: item.mapValue.fields.name.stringValue,
    description: (item.mapValue.fields.description?.stringValue || '').replace(/<[^>]*>?/gm, '')
});

/**
 * Mapeia uma perícia (Skill), extraindo grau de treinamento e atributo base.
 * * @param {Object} item - O objeto bruto da perícia.
 * @returns {Object} Objeto normalizado com `name`, `attribute` e `bonus` (numérico).
 */
const mapSkill = (item) => {
    const fields = item.mapValue.fields;
    return {
        name: fields.name.stringValue,
        attribute: fields.attribute.stringValue,
        // Converte o grau de treinamento (string) para inteiro com fallback para 0
        bonus: parseInt(fields.trainingDegree.stringValue, 10) || 0
    };
};

// --- Função Principal Exportada ---

/**
 * Busca os dados completos de um personagem na API do Firestore e os normaliza.
 * * @param {string} characterId - O ID único do personagem no sistema externo.
 * @returns {Promise<Object|null>} Um objeto contendo:
 * - `data`: O objeto de personagem normalizado.
 * - `lastFetchTime`: Timestamp da busca.
 * Retorna `null` se a busca falhar (ex: 404 ou erro de rede).
 */
async function fetchFromGoogle(characterId) {
    // URL direta para a API REST do Firestore (Database Default)
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/${characterId}`;
    
    try {
        const { data } = await axios.get(firestoreUrl);
        const fields = data.fields;
        
        // Construção do Objeto de Domínio Normalizado
        const characterData = {
            // Dados Básicos
            name: fields.name.stringValue,
            picture: fields.sheetPictureURL.stringValue,
            nex: fields.nex.stringValue,
            className: fields.className.stringValue,
            
            // Status Vitais (Formatados como "Atual/Máximo")
            hp: `${fields.currentPv.integerValue}/${fields.maxPv.integerValue}`,
            sanity: `${fields.currentSan.integerValue}/${fields.maxSan.integerValue}`,
            effort: `${fields.currentPe.integerValue}/${fields.maxPe.integerValue}`,
            load: `${fields.currentLoad.integerValue}/${fields.maxLoad.integerValue}`,
            
            // Defesas e Movimento
            evade: fields.evade.integerValue.toString(),
            block: fields.block.integerValue.toString(),
            movement: fields.movement.integerValue.toString(),
            
            // Flags de Estado
            isDying: fields.deathMode.booleanValue,
            isCrazy: fields.madnessMode.booleanValue,
            
            // Atributos Base (Convertidos para inteiros)
            attributes: {
                str: fields.attributes.mapValue.fields.str.integerValue,
                dex: fields.attributes.mapValue.fields.dex.integerValue,
                con: fields.attributes.mapValue.fields.con.integerValue,
                int: fields.attributes.mapValue.fields.int.integerValue,
                pre: fields.attributes.mapValue.fields.pre.integerValue,
            },
            
            // Listas Complexas (Processadas pelos mappers auxiliares)
            powers: parseArray(fields.powers, mapPower),
            inventory: parseArray(fields.inventory, mapInventoryItem),
            rituals: parseArray(fields.rituals, mapRitual),
            skills: parseArray(fields.skills, mapSkill)
        };

        return { data: characterData, lastFetchTime: Date.now() };

    } catch (error) {
        // Tratamento de erro robusto para não derrubar o worker
        console.error(`[Poller] Falha ao buscar ${characterId}: ${error.response ? error.response.status : error.message}`);
        return null;
    }
}

module.exports = { fetchFromGoogle };
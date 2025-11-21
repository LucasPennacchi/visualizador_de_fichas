/**
 * @module State
 * @description Gerencia o estado volátil (em memória) da aplicação.
 * Armazena as referências de conexões WebSocket e seus relacionamentos.
 */

/** @type {Map<WebSocket, Set<string>>} Clientes -> IDs de Fichas */
const clientSubscriptions = new Map();

/** @type {Map<WebSocket, string>} Clientes -> ID da Sala */
const clientRooms = new Map();

/** @type {Set<string>} Canais Redis ativos */
const activeRedisChannels = new Set();

/** @type {Map<string, number>} Contador para limpeza */
const orphanUpdatesCount = new Map();

/**
 * Verifica se existe algum espectador ativo para um ID.
 * @param {string} charId 
 * @returns {boolean}
 */
function isAnyoneWatching(charId) {
    for (const [ws, subscribedIds] of clientSubscriptions) {
        if (subscribedIds.has(charId) && ws.readyState === ws.OPEN) {
            return true;
        }
    }
    return false;
}

module.exports = {
    clientSubscriptions,
    clientRooms,
    activeRedisChannels,
    orphanUpdatesCount,
    isAnyoneWatching
};
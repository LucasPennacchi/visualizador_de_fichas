/**
 * @module Managers/Subscription
 * @description Contém a lógica de negócio para gerenciamento de assinaturas de fichas.
 * Lida com Cache, Fila de Trabalho e Ciclo de Vida do Pub/Sub.
 */

const config = require('../config');
const state = require('../state');
const { redisClient, subscriberClient } = require('../redis');
const { getCharacterIdFromUrl } = require('../utils');

/**
 * Processa uma lista de links, verifica cache e agenda jobs se necessário.
 * @param {Array<string>} links 
 * @returns {Promise<Array<Object>>} Payload inicial (Cache Hits).
 */
async function processLinksAndSubscribe(links) {
    const initialPayload = [];

    for (const link of links) {
        const charId = getCharacterIdFromUrl(link);
        if (!charId) continue;

        const cacheKey = `ficha:${charId}`;
        const linkKey = `link:${charId}`;
        const channel = `updates:${charId}`;

        // Persistência de Metadados
        await redisClient.set(linkKey, link);

        // Verificação de Cache
        const cachedDataJson = await redisClient.get(cacheKey);
        if (cachedDataJson) {
            const data = JSON.parse(cachedDataJson);
            initialPayload.push({ ...data, originalUrl: link });
        } else {
            // Cache Miss: Agenda job prioritário
            const jobPayload = JSON.stringify({ charId, originalUrl: link, force: true });
            await redisClient.lpush(config.QUEUE_NAME, jobPayload);
        }

        // Inscrição no Redis Pub/Sub
        if (!state.activeRedisChannels.has(channel)) {
            console.log(`[SubManager] Assinando canal: ${channel}`);
            subscriberClient.subscribe(channel);
            state.activeRedisChannels.add(channel);
            state.orphanUpdatesCount.delete(charId);
        }
    }
    return initialPayload;
}

/**
 * Remove inscrições órfãs após desconexão ou mudança de lista.
 * @param {Set<string>} idsToCheck 
 */
function cleanupOrphanSubscriptions(idsToCheck) {
    for (const charId of idsToCheck) {
        if (!state.isAnyoneWatching(charId)) {
            const channel = `updates:${charId}`;
            console.log(`[SubManager] Ninguém mais assiste ${charId}. Cancelando assinatura.`);
            subscriberClient.unsubscribe(channel);
            state.activeRedisChannels.delete(channel);
            state.orphanUpdatesCount.delete(charId);
        }
    }
}

module.exports = { processLinksAndSubscribe, cleanupOrphanSubscriptions };
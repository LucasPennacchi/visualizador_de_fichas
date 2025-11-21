/**
 * @module Config
 * @description Centraliza as constantes e configurações do ambiente.
 */

module.exports = {
    PORT: process.env.PORT || 3000,
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    QUEUE_NAME: 'fila:trabalho:revalidar',
    MAX_ORPHAN_UPDATES: 3,
    ROOM_EXPIRATION_SECONDS: 60 * 60 * 24 * 7 // 7 dias
};
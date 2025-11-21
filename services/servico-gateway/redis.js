/**
 * @module Infrastructure/Redis
 * @description Inicializa e exporta as instâncias dos clientes Redis.
 */

const Redis = require('ioredis');
const config = require('./config');

const redisClient = new Redis(config.REDIS_PORT, config.REDIS_HOST);
const subscriberClient = new Redis(config.REDIS_PORT, config.REDIS_HOST);

module.exports = { redisClient, subscriberClient };
/**
 * @module Services/Poller/Adapters/Registry
 * @description Gerenciador central de adaptadores de sistemas de RPG (Singleton).
 * Permite o desacoplamento entre o Worker (que processa a fila) e a lógica específica
 * de cada sistema de RPG (CRIS, D&D, Tormenta, etc).
 * Implementa o padrão "Strategy" para selecionar o parser correto em tempo de execução.
 */

/**
 * Lista interna de adaptadores registrados.
 * @type {Array<Object>}
 * @private
 */
const adapters = [];

/**
 * Registra um novo adaptador no sistema.
 * Deve ser invocado pelos arquivos de definição de adaptador no momento da importação (Side-effect).
 * * @param {Object} adapter - A implementação do adaptador.
 * @param {string} adapter.systemId - Identificador único do sistema (ex: 'ordem_paranormal_cris').
 * @param {function(string): boolean} adapter.matches - Predicado que verifica se este adaptador suporta a URL fornecida.
 * @param {function(string): Promise<Object>} adapter.fetch - Função que realiza a busca e normalização dos dados.
 */
function registerAdapter(adapter) {
    console.log(`[Registry] Novo adaptador registrado: ${adapter.systemId}`);
    adapters.push(adapter);
}

/**
 * Seleciona a estratégia (adaptador) correta baseada na URL de origem.
 * Itera sobre os adaptadores registrados e retorna o primeiro que retornar `true` para `matches(url)`.
 * * @param {string} url - A URL completa da ficha de personagem.
 * @returns {Object|null} O adaptador compatível ou `null` se nenhum for encontrado.
 */
function getAdapterForUrl(url) {
    return adapters.find(adapter => adapter.matches(url)) || null;
}

module.exports = { registerAdapter, getAdapterForUrl };
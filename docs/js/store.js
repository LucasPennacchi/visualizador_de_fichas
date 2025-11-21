/**
 * @module Store
 * @description Gerencia a persistência de dados no lado do cliente utilizando a API Web Storage (localStorage).
 * Responsável por manter o estado da aplicação (links monitorados, cache de dados de fichas e preferências de UI)
 * preservado entre sessões do navegador ou recarregamentos de página.
 */

// --- Constantes de Armazenamento (Chaves) ---

/**
 * Chave para armazenar a lista de links/IDs monitorados.
 * @constant {string}
 * @private
 */
const LINKS_STORAGE_KEY = 'gm_dashboard_links';

/**
 * Chave para armazenar o último snapshot dos dados das fichas (Cache).
 * @constant {string}
 * @private
 */
const DATA_STORAGE_KEY = 'gm_dashboard_data_cache';

/**
 * Chave para armazenar o estado visual do cabeçalho (minimizado/maximizado).
 * @constant {string}
 * @private
 */
const HEADER_STATE_KEY = 'gm_dashboard_header_state';

/**
 * Chave para armazenar a sala.
 * @constant {string}
 * @private
 */
const ROOM_ID_KEY = 'gm_dashboard_room_id';

// --- Gerenciamento de Links ---

/**
 * Recupera a lista de links ou códigos de personagens salvos.
 * Realiza o parsing do JSON armazenado.
 * * @returns {Array<string>} Um array de strings contendo os links/IDs. 
 * Retorna um array vazio `[]` se nenhum dado for encontrado ou se houver erro no parsing.
 */
export function getLinks() {
  return JSON.parse(localStorage.getItem(LINKS_STORAGE_KEY)) || [];
}

/**
 * Persiste a lista de links de personagens no armazenamento local.
 * Serializa o array para string JSON antes de salvar.
 * * @param {Array<string>} links - A lista atualizada de links/IDs para salvar.
 */
export function saveLinks(links) {
  localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
}

// --- Gerenciamento de Dados (Cache Offline) ---

/**
 * Recupera os dados cacheados das fichas da última sessão.
 * Útil para renderizar a interface imediatamente (Cold Start) enquanto
 * a conexão WebSocket é estabelecida.
 * * @returns {Array<Object>|null} O array de objetos de dados das fichas ou `null` se o cache estiver vazio.
 */
export function getCachedData() {
  return JSON.parse(localStorage.getItem(DATA_STORAGE_KEY));
}

/**
 * Salva o estado atual dos dados das fichas no cache local.
 * Deve ser chamado sempre que uma atualização relevante chegar via WebSocket.
 * * @param {Array<Object>} data - O payload completo dos dados das fichas a ser cacheado.
 */
export function saveCachedData(data) {
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(data));
}

// --- Gerenciamento de Estado da UI ---

/**
 * Recupera a preferência do usuário sobre o estado do cabeçalho.
 * * @returns {string|null} Uma string representando o estado (ex: 'minimized', 'maximized')
 * ou `null` se nenhuma preferência tiver sido salva ainda.
 */
export function getHeaderState() {
  return localStorage.getItem(HEADER_STATE_KEY);
}

/**
 * Persiste a preferência do usuário sobre o estado do cabeçalho.
 * * @param {string} state - O estado atual a ser salvo (geralmente 'minimized' ou 'maximized').
 */
export function saveHeaderState(state) {
  localStorage.setItem(HEADER_STATE_KEY, state);
}

/**
 * Recupera o ID da sala atual, se houver.
 * @returns {string|null} O código da sala ou null.
 */
export function getRoomId() {
  return localStorage.getItem(ROOM_ID_KEY);
}

/**
 * Salva o ID da sala (quando entra/cria).
 * @param {string} roomId 
 */
export function saveRoomId(roomId) {
  localStorage.setItem(ROOM_ID_KEY, roomId);
}

/**
 * Remove o ID da sala (quando sai).
 */
export function clearRoomId() {
  localStorage.removeItem(ROOM_ID_KEY);
}
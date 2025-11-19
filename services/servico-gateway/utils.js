/**
 * @module Services/Gateway/Utils
 * @description Biblioteca de funções utilitárias para o microserviço de Gateway.
 * Fornece métodos auxiliares "stateless" (sem estado) para manipulação de strings,
 * parsing de URLs e normalização de dados de entrada.
 */

/**
 * Extrai o identificador único (ID) de um personagem a partir de sua URL completa.
 * A função é robusta contra variações na formatação da URL, como barras finais (trailing slashes).
 * * * @example
 * // Retorna "DDWZ7uaMLx56UMKj5VsU"
 * getCharacterIdFromUrl("https://crisordemparanormal.com/agente/DDWZ7uaMLx56UMKj5VsU/");
 * * @param {string} url - A URL completa do portrait ou da ficha.
 * @returns {string|null} O ID extraído se a URL for válida, ou `null` em caso de erro de parsing.
 */
function getCharacterIdFromUrl(url) {
  try {
    const targetUrl = new URL(url);
    const pathParts = targetUrl.pathname.split('/');
    
    // Filtra partes vazias resultantes de split em barras duplas ou trailing slash (ex: /agente/ID//)
    // O método .pop() garante que pegamos o último segmento válido da URL.
    return pathParts.filter(p => p).pop() || null;
  } catch (error) {
    console.error('[Gateway] Erro de Parsing: URL inválida recebida:', url, error.message);
    return null;
  }
}

module.exports = { getCharacterIdFromUrl };
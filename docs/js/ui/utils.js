/**
 * @module UI/Utils
 * @description Biblioteca de funções utilitárias para manipulação do DOM e cálculos de apresentação.
 * Adaptada para o modelo canônico, focando em operações genéricas de UI em vez de regras de negócio específicas.
 */

// --- Cálculos Matemáticos ---

/**
 * Calcula a porcentagem de preenchimento de uma barra, garantindo limites entre 0 e 100.
 * * @param {number} current - Valor atual.
 * @param {number} max - Valor máximo.
 * @returns {number} A porcentagem (0-100).
 */
export function calculatePercentage(current, max) {
  if (!max || max <= 0) return 0;
  const pct = (current / max) * 100;
  return Math.max(0, Math.min(100, pct)); // Clamp entre 0 e 100
}

// --- Manipulação do DOM ---

/**
 * Atualiza o conteúdo de texto de um elemento DOM somente se houver mudança.
 * @param {HTMLElement|null} element - O elemento alvo.
 * @param {string|number} newText - O novo texto.
 */
export function updateText(element, newText) {
  if (element && element.innerText != newText) { // != permite coerção leve entre string/number
    element.innerText = newText;
  }
}

/**
 * Atualiza o atributo `src` de uma imagem.
 * @param {HTMLImageElement|null} element - O elemento de imagem.
 * @param {string} newSrc - A nova URL.
 */
export function updateSrc(element, newSrc) {
  if (element && element.src !== newSrc) {
    element.src = newSrc;
  }
}

/**
 * Atualiza a largura (width) de um elemento de barra de progresso via estilo inline.
 * @param {HTMLElement|null} element - O elemento da barra.
 * @param {number} percentage - A porcentagem (0-100).
 */
export function updateBarStyle(element, percentage) {
  if (element) {
    element.style.width = `${percentage}%`;
  }
}

/**
 * Extrai o ID do personagem da URL (mantido para compatibilidade).
 * @param {string} url - A URL completa.
 * @returns {string|null} O ID extraído.
 */
export function getCharacterIdFromUrl(url) {
  try {
    const targetUrl = new URL(url);
    const pathParts = targetUrl.pathname.split('/');
    return pathParts.filter(p => p).pop() || null;
  } catch (error) {
    return null;
  }
}
/**
 * @module UI/Utils
 * @description Biblioteca de funções utilitárias puras para manipulação do DOM,
 * cálculos de estilo baseados em regras de negócio e parsing de strings.
 * Estas funções são 'stateless' (sem estado) e projetadas para serem reutilizáveis
 * em qualquer componente da interface.
 */

// --- Funções de Lógica de Negócio (Cálculo de Status) ---

/**
 * Determina a classe CSS de status visual baseada na porcentagem restante de um recurso (HP, Sanidade, PE).
 * Aplica regras de coloração progressiva para indicar perigo.
 * * Regras:
 * - 0 ou Morto: 'status-darkred'
 * - <= 5% (Crítico): 'status-red'
 * - <= 25% (Perigo): 'status-orange'
 * - <= 50% (Atenção): 'status-yellow'
 * * @param {string} valueString - A string de valor no formato "atual/máximo" (ex: "10/20").
 * @returns {string} O nome da classe CSS correspondente ou string vazia se saudável.
 */
export function getStatusClass(valueString) {
  const [current, max] = (valueString || '0/0').split('/').map(Number);
  
  if (max === 0) return (current === 0) ? 'status-darkred' : '';
  if (current === 0) return 'status-darkred';
  
  const percentage = (current / max) * 100;
  
  if (percentage <= 5 || current === 1) return 'status-red';
  if (percentage <= 25) return 'status-orange';
  if (percentage <= 50) return 'status-yellow';
  
  return '';
}

/**
 * Determina a classe CSS de status baseada na capacidade de carga do inventário.
 * Difere da lógica de HP pois valores altos são negativos (sobrecarga).
 * * Regras:
 * - > 100% (Sobrecarga Grave): 'status-darkred'
 * - = 100% (Limite Atingido): 'status-red'
 * - >= 75% (Pesado): 'status-orange'
 * - >= 50% (Ocupado): 'status-yellow'
 * * @param {string} valueString - A string de valor no formato "atual/máximo" (ex: "5/10").
 * @returns {string} O nome da classe CSS correspondente.
 */
export function getLoadStatusClass(valueString) {
  const [current, max] = (valueString || '0/0').split('/').map(Number);
  
  if (max === 0 || current === 0) return '';
  
  const percentage = (current / max) * 100;
  
  if (percentage > 100) return 'status-darkred';
  if (percentage == 100) return 'status-red';
  if (percentage >= 75) return 'status-orange';
  if (percentage >= 50) return 'status-yellow';
  
  return '';
}

// --- Funções de Manipulação do DOM (Performance) ---

/**
 * Atualiza o conteúdo de texto (`innerText`) de um elemento DOM de forma condicional.
 * Implementa uma verificação de "Dirty Checking" simples: só altera o DOM se o
 * novo texto for diferente do atual, evitando reflows/repaints desnecessários do navegador.
 * * @param {HTMLElement|null} element - O elemento alvo. Se nulo, a função retorna silenciosamente.
 * @param {string} newText - O novo texto a ser inserido.
 */
export function updateText(element, newText) {
  if (element && element.innerText !== newText) {
    element.innerText = newText;
  }
}

/**
 * Atualiza o atributo `src` de uma imagem de forma condicional.
 * Evita o "flicker" (piscar) da imagem que ocorre quando o navegador tenta recarregar
 * o mesmo recurso de imagem repetidamente.
 * * @param {HTMLImageElement|null} element - O elemento de imagem `<img>`.
 * @param {string} newSrc - A nova URL da imagem.
 */
export function updateSrc(element, newSrc) {
  if (element && element.src !== newSrc) {
    element.src = newSrc;
  }
}

/**
 * Gerencia a aplicação exclusiva de classes de status em um elemento.
 * Remove proativamente quaisquer classes de status anteriores (amarelo, laranja, vermelho, escuro)
 * antes de aplicar a nova classe, garantindo que o elemento nunca tenha estados conflitantes.
 * * @param {HTMLElement|null} element - O elemento DOM a ser estilizado.
 * @param {string} newClass - A nova classe a ser aplicada (ou string vazia para limpar estilos).
 */
export function updateStatusClass(element, newClass) {
  if (!element) return;
  
  const classes = ['status-yellow', 'status-orange', 'status-red', 'status-darkred'];
  
  // 1. Limpeza: Remove classes antigas que não correspondem à nova
  classes.forEach(c => {
    if (c !== newClass && element.classList.contains(c)) {
      element.classList.remove(c);
    }
  });
  
  // 2. Aplicação: Adiciona a nova classe se necessário
  if (newClass && !element.classList.contains(newClass)) {
    element.classList.add(newClass);
  }
}

// --- Funções de Parsing ---

/**
 * Extrai o ID único do personagem a partir de uma URL completa ou parcial.
 * Robusto contra barras finais (trailing slashes) e formatos variados de URL.
 * * @param {string} url - A URL completa do portrait (ex: "https://site.com/agente/ID").
 * @returns {string|null} O ID extraído ou `null` se a URL for inválida.
 */
export function getCharacterIdFromUrl(url) {
  try {
    const targetUrl = new URL(url);
    const pathParts = targetUrl.pathname.split('/');
    // Filtra partes vazias para lidar com barras no final (ex: /agente/123/)
    return pathParts.filter(p => p).pop() || null;
  } catch (error) {
    console.error('URL inválida para extrair ID:', url);
    return null;
  }
}
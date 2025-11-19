/**
 * @module UI/CardRenderers
 * @description Biblioteca de componentes de visualização (Templates).
 * Exporta funções puras que recebem objetos de dados e retornam strings HTML
 * formatadas (Template Strings), prontas para serem injetadas via `innerHTML`.
 * Responsável pela estrutura visual dos itens de lista (Habilidades, Rituais, Inventário).
 */

// --- Constantes Exportadas ---

/**
 * Template HTML padrão para exibir quando uma lista (array) está vazia.
 * @constant {string}
 */
export const placeholder = '<div class="list-placeholder">Nenhum</div>';

// --- Configurações Internas ---

/**
 * Mapa de tradução entre as siglas de atributos da API (Uppercase) 
 * e as chaves internas do objeto de dados (Lowercase).
 * Utilizado para calcular dinamicamente a quantidade de dados de uma perícia.
 * @constant {Object.<string, string>}
 * @private
 */
const attrMap = { AGI: 'dex', FOR: 'str', VIG: 'con', INT: 'int', PRE: 'pre' };

// --- Funções de Renderização ---

/**
 * Gera o HTML para um item da lista de Perícias.
 * Calcula automaticamente a quantidade de dados (dX) baseada no atributo associado.
 * * @param {Object} skill - Objeto contendo dados da perícia.
 * @param {string} skill.name - Nome da perícia.
 * @param {string} skill.attribute - Sigla do atributo base (ex: "AGI").
 * @param {number|string} skill.bonus - Bônus numérico da perícia.
 * @param {Object} allAttributes - Objeto contendo os valores atuais dos atributos do personagem.
 * @returns {string} String HTML estruturada do item de perícia.
 */
export const renderSkillItem = (skill, allAttributes) => {
  const attrKey = attrMap[skill.attribute];
  // Fallback seguro: se o atributo não existir, assume 0 dados
  const diceCount = (allAttributes && allAttributes[attrKey]) || 0; 
  
  return `
    <div class="skill-item">
      <span class="skill-name">${skill.name}</span>
      <span class="skill-value">${diceCount}d20 + ${skill.bonus}</span>
    </div>`;
};

/**
 * Gera o HTML para um item genérico de lista (usado em Habilidades e Rituais).
 * Cria uma estrutura de "Accordion Aninhado" onde a descrição fica oculta inicialmente.
 * * @param {Object} item - Objeto de dados do item.
 * @param {string} item.name - Título do item.
 * @param {string} [item.description] - Descrição detalhada do item (pode conter HTML sanitizado).
 * @returns {string} String HTML estruturada do item expansível.
 */
export const renderListItem = (item) => `
  <div class="inner-accordion-item">
    <div class="inner-accordion-header">${item.name}</div>
    <div class="inner-accordion-content">
      <div class="inner-accordion-inner">
        <p>${item.description || 'Sem descrição.'}</p>
      </div>
    </div>
  </div>`;

/**
 * Gera o HTML para um item de Inventário.
 * Similar ao item genérico, mas inclui visualização de "Espaços" (Slots) no cabeçalho.
 * * @param {Object} item - Objeto de dados do item de inventário.
 * @param {string} item.name - Nome do item.
 * @param {string|number} item.slots - Custo de espaço no inventário.
 * @param {string} [item.description] - Descrição detalhada.
 * @returns {string} String HTML estruturada do item de inventário.
 */
export const renderInventoryItem = (item) => `
  <div class="inner-accordion-item">
    <div class="inner-accordion-header">
      ${item.name}
      <span class="item-slots">(Espaços: ${item.slots})</span>
    </div>
    <div class="inner-accordion-content">
      <div class="inner-accordion-inner">
        <p>${item.description || 'Sem descrição.'}</p>
      </div>
    </div>
  </div>`;
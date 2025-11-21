/**
 * @module UI/CardRenderers
 * @description Biblioteca de Templates HTML para o Modelo Canônico.
 * Transforma estruturas de dados genéricas (Vitals, Attributes, Sections) em HTML.
 * Não contém lógica de negócio, apenas lógica de apresentação.
 */

import { calculatePercentage } from './utils.js';

// --- Constantes ---
export const placeholder = '<div class="list-placeholder">Vazio</div>';

// --- Renderizadores de Componentes Base ---

/**
 * Renderiza uma barra de recurso vital (Vida, Sanidade, Mana).
 * Usa CSS Grid/Flexbox para alinhar rótulo, barra e valores.
 * * @param {Object} vital - Objeto do recurso vital.
 * @param {string} vital.id - ID único (ex: 'hp').
 * @param {string} vital.label - Rótulo (ex: 'PV').
 * @param {number} vital.current - Valor atual.
 * @param {number} vital.max - Valor máximo.
 * @param {string} vital.color - Cor hexadecimal da barra.
 * @returns {string} HTML da barra de status.
 */
export const renderVital = (vital) => {
  const pct = calculatePercentage(vital.current, vital.max);
  
  return `
    <div class="vital-row" data-vital-id="${vital.id}">
      <span class="vital-label" style="color: ${vital.color}">${vital.label}</span>
      <div class="vital-bar-container">
        <div class="vital-bar-fill" style="width: ${pct}%; background-color: ${vital.color}"></div>
      </div>
      <span class="vital-value">${vital.current}/${vital.max}</span>
    </div>
  `;
};

/**
 * Renderiza um atributo principal (ex: FOR, DEX, INT).
 * @param {Object} attr - Objeto de atributo.
 * @param {string} attr.id - ID do atributo.
 * @param {string} attr.label - Sigla do atributo.
 * @param {string|number} attr.value - Valor principal.
 * @returns {string} HTML do bloco de atributo.
 */
export const renderAttribute = (attr) => `
  <div class="attr-item" data-attr-id="${attr.id}">
    <span class="attr-label">${attr.label}</span>
    <span class="attr-value">${attr.value}</span>
  </div>
`;

/**
 * Renderiza uma propriedade secundária (ex: Defesa, Deslocamento).
 * @param {Object} prop - Objeto de propriedade.
 * @param {string} prop.label - Rótulo.
 * @param {string|number} prop.value - Valor.
 * @returns {string} HTML do item de propriedade.
 */
export const renderProperty = (prop) => `
  <span class="stat-item">
    ${prop.label}: <span class="stat-val">${prop.value}</span>
  </span>
`;

// --- Renderizadores de Listas (Sections) ---

/**
 * Renderiza um item genérico dentro de uma lista (Accordion ou Simples).
 * Lida com etiquetas (tags) e descrições opcionais.
 * * @param {Object} item - Item da lista.
 * @param {string} item.label - Nome do item.
 * @param {string} [item.value] - Valor opcional (ex: dano, bônus).
 * @param {Array<string>} [item.tags] - Lista de etiquetas curtas.
 * @param {string} [item.description] - Texto descritivo (pode ser HTML sanitizado).
 * @returns {string} HTML do item da lista (estilo accordion aninhado).
 */
export const renderSectionItem = (item) => {
  const tagsHtml = (item.tags || []).map(t => `<span class="item-tag">${t}</span>`).join('');
  const valueHtml = item.value ? `<span class="item-value">${item.value}</span>` : '';
  const descHtml = item.description ? 
    `<div class="inner-accordion-content">
       <div class="inner-accordion-inner"><p>${item.description}</p></div>
     </div>` : '';
  
  // Adiciona classe para cursor pointer apenas se tiver descrição para expandir
  const headerClass = item.description ? 'inner-accordion-header clickable' : 'inner-accordion-header';

  return `
    <div class="inner-accordion-item">
      <div class="${headerClass}">
        <div class="header-left">
          <span class="item-name">${item.label}</span>
          ${valueHtml}
        </div>
        <div class="header-right">
          ${tagsHtml}
        </div>
      </div>
      ${descHtml}
    </div>
  `;
};

/**
 * Renderiza uma Seção completa (Accordion Pai).
 * @param {Object} section - Objeto da seção (ex: Inventário, Perícias).
 * @returns {string} HTML do accordion principal.
 */
export const renderSection = (section) => {
  const itemsHtml = (section.items && section.items.length > 0) 
    ? section.items.map(renderSectionItem).join('') 
    : placeholder;

  return `
    <div class="accordion-item" data-section-id="${section.id}">
      <div class="accordion-header">${section.title}</div>
      <div class="accordion-content">
        <div class="accordion-inner">
          ${itemsHtml}
        </div>
      </div>
    </div>
  `;
};
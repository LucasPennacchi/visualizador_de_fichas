/**
 * @module UI/Card
 * @description Gerenciador de Cards Genéricos.
 * Responsável por renderizar e atualizar cards baseados no Modelo Canônico Universal.
 * O módulo é agnóstico ao sistema de RPG: aplica estilos visuais baseados puramente
 * nas propriedades de apresentação (cores, labels) fornecidas pelo JSON.
 * * @requires module:UI/Utils
 * @requires module:UI/CardRenderers
 */

import * as utils from './utils.js';
import * as renderers from './card-renderers.js';

// --- Funções Exportadas ---

/**
 * Renderiza o HTML inicial de um card novo.
 * Constrói a estrutura iterando sobre os arrays de dados do modelo canônico.
 * Aplica estilos iniciais (como cor da borda) baseados no header.
 * * @param {HTMLElement} cardElement - Contêiner do card.
 * @param {Object} data - Objeto de dados no formato Canônico.
 */
export function renderNewCardHTML(cardElement, data) {
  // 1. Extração segura de dados (com defaults)
  const header = data.header || { name: 'Desconhecido', description: '' };
  const vitals = data.vitals || [];
  const attributes = data.attributes || [];
  const properties = data.properties || [];
  const sections = data.sections || [];

  // 2. Aplicação de Estilos Visuais Genéricos (definidos pelo Adapter)
  if (header.borderColor) {
      cardElement.style.borderColor = header.borderColor;
      // Adiciona um brilho suave (box-shadow) com a mesma cor da borda
      cardElement.style.boxShadow = `0 0 8px ${header.borderColor}80`; // Hex + 80 (aprox 50% alpha)
  }

  // 3. Renderização dos Blocos
  const pictureHtml = header.avatarUrl 
    ? `<img class="card-portrait-img" src="${header.avatarUrl}" alt="Portrait" data-field="portrait">` 
    : `<div class="card-portrait-placeholder" data-field="portrait">?</div>`;

  const vitalsHtml = vitals.map(renderers.renderVital).join('');
  const attributesHtml = attributes.map(renderers.renderAttribute).join('');
  const propertiesHtml = properties.map(renderers.renderProperty).join('');
  const sectionsHtml = sections.map(renderers.renderSection).join('');

  // 4. Montagem do Template
  cardElement.innerHTML = `
    <div class="card-drag-handle" title="Mover">
       <svg width="18" height="18" viewBox="0 0 24 24" style="fill: #888;"><path d="M9 4C9 4.55228 8.55228 5 8 5C7.44772 5 7 4.55228 7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4ZM9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8C7 7.44772 7.44772 7 8 7C8.55228 7 9 7.44772 9 8ZM9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11C8.55228 11 9 11.4477 9 12ZM9 16C9 16.5523 8.55228 17 8 17C7.44772 17 7 16.5523 7 16C7 15.4477 7.44772 15 8 15C8.55228 15 9 15.4477 9 16ZM9 20C9 20.5523 8.55228 21 8 21C7.44772 21 7 20.5523 7 20C7 19.4477 7.44772 19 8 19C8.55228 19 9 19.4477 9 20ZM17 4C17 4.55228 16.5523 5 16 5C15.4477 5 15 4.55228 15 4C15 3.44772 15.4477 3 16 3C16.5523 3 17 3.44772 17 4ZM17 8C17 8.55228 16.5523 9 16 9C15.4477 9 15 8.55228 15 8C15 7.44772 15.4477 7 16 7C16.5523 7 17 7.44772 17 8ZM17 12C17 12.5523 16.5523 13 16 13C15.4477 13 15 12.5523 15 12C15 11.4477 15.4477 11 16 11C16.5523 11 17 11.4477 17 12ZM17 16C17 16.5523 16.5523 17 16 17C15.4477 17 15 16.5523 15 16C15 15.4477 15.4477 15 16 15C16.5523 15 17 15.4477 17 16ZM17 20C17 20.5523 16.5523 21 16 21C15.4477 21 15 20.5523 15 20C15 19.4477 15.4477 19 16 19C16.5523 19 17 19.4477 17 20Z"></path></svg>
    </div>
    
    <button class="card-delete-btn" data-link="${data.meta?.sourceUrl || '#'}" title="Remover">X</button>
    
    <div class="card-header">
      ${pictureHtml}
      <div class="card-title">
        <h2 data-field="name">${header.name}</h2>
        <span data-field="description">${header.description}</span>
      </div>
    </div>

    <div class="vitals-container">
      ${vitalsHtml}
    </div>

    <div class="extra-stats">
      ${propertiesHtml}
    </div>

    <div class="attr-bar">
      ${attributesHtml}
    </div>

    <div class="card-expand-content">
      <div class="card-expand-inner"> 
        ${sectionsHtml}
      </div>
    </div>
  `;
}

/**
 * Atualiza um card existente.
 * Usa seletores inteligentes [data-id] para encontrar e atualizar apenas
 * os elementos que mudaram, mantendo a performance.
 * * @param {HTMLElement} cardElement - Contêiner do card.
 * @param {Object} data - Novos dados no formato Canônico.
 */
export function updateExistingCard(cardElement, data) {
  const header = data.header || {};
  
  // --- 1. Atualiza Estados Visuais Globais ---
  // Remove classes legadas de estado (se existirem) para garantir limpeza
  cardElement.classList.remove('card-status-dying', 'card-status-crazy');
  
  // Aplica a cor da borda enviada pelo Adapter (se houver)
  if (header.borderColor) {
      cardElement.style.borderColor = header.borderColor;
      cardElement.style.boxShadow = `0 0 8px ${header.borderColor}80`;
  } else {
      // Reseta para o padrão
      cardElement.style.borderColor = '';
      cardElement.style.boxShadow = '';
  }

  // --- 2. Atualiza Header ---
  const portraitEl = cardElement.querySelector('[data-field="portrait"]');
  if (portraitEl && portraitEl.tagName === 'IMG') utils.updateSrc(portraitEl, header.avatarUrl);
  
  utils.updateText(cardElement.querySelector('[data-field="name"]'), header.name);
  utils.updateText(cardElement.querySelector('[data-field="description"]'), header.description);

  // --- 3. Atualiza Barras Vitais (Loop Genérico) ---
  if (data.vitals) {
    data.vitals.forEach(vital => {
      // Encontra a linha da barra específica pelo ID (ex: 'hp', 'san')
      const rowEl = cardElement.querySelector(`[data-vital-id="${vital.id}"]`);
      if (rowEl) {
        const barFill = rowEl.querySelector('.vital-bar-fill');
        const valText = rowEl.querySelector('.vital-value');
        
        // Atualiza a largura visual e o texto
        utils.updateBarStyle(barFill, utils.calculatePercentage(vital.current, vital.max));
        utils.updateText(valText, `${vital.current}/${vital.max}`);
      }
    });
  }

  // --- 4. Atualiza Atributos (Loop Genérico) ---
  if (data.attributes) {
    data.attributes.forEach(attr => {
      const attrEl = cardElement.querySelector(`[data-attr-id="${attr.id}"]`);
      if (attrEl) {
        const valText = attrEl.querySelector('.attr-value');
        utils.updateText(valText, attr.value);
      }
    });
  }

  // --- 5. Atualiza Propriedades Secundárias ---
  if (data.properties) {
    const propsContainer = cardElement.querySelector('.extra-stats');
    if (propsContainer) {
        // Re-renderiza simples para garantir ordem e conteúdo
        propsContainer.innerHTML = data.properties.map(renderers.renderProperty).join('');
    }
  }

  // --- 6. Atualiza Seções (Accordions) ---
  if (data.sections) {
    data.sections.forEach(section => {
      // Encontra o container interno do accordion específico
      const sectionContainer = cardElement.querySelector(`[data-section-id="${section.id}"] .accordion-inner`);
      if (sectionContainer && section.items) {
        // Re-renderiza a lista interna
        const contentHtml = section.items.length > 0 
            ? section.items.map(renderers.renderSectionItem).join('') 
            : renderers.placeholder;
        
        // Só toca no DOM se mudou (Dirty Check simples)
        if (sectionContainer.innerHTML !== contentHtml) {
            sectionContainer.innerHTML = contentHtml;
        }
      }
    });
  }
}
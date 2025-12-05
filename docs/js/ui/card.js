/**
 * @module UI/Card
 * @description Gerencia a renderização visual dos cards e tokens.
 */

import * as utils from './utils.js';
import * as renderers from './card-renderers.js';

export function renderNewCardHTML(cardElement, data) {
  const header = data.header || { name: 'Desconhecido', description: '' };
  const vitals = data.vitals || [];
  const attributes = data.attributes || [];
  const properties = data.properties || [];
  const sections = data.sections || [];
  // Pega o ID puro (sem URL) para passar para o script
  const rawId = data.meta?.characterId || '';

  if (header.borderColor) {
      cardElement.style.borderColor = header.borderColor;
      cardElement.style.boxShadow = `0 0 8px ${header.borderColor}80`;
  }

  const pictureHtml = header.avatarUrl 
    ? `<img class="card-portrait-img" src="${header.avatarUrl}" alt="Portrait" data-field="portrait">` 
    : `<div class="card-portrait-placeholder" data-field="portrait">?</div>`;

  const vitalsHtml = vitals.map(renderers.renderVital).join('');
  const attributesHtml = attributes.map(renderers.renderAttribute).join('');
  const propertiesHtml = properties.map(renderers.renderProperty).join('');
  const sectionsHtml = sections.map(renderers.renderSection).join('');

  cardElement.innerHTML = `
    <div class="card-grab-zone" title="Arraste para mover"></div>

    <div class="card-inner-content">
        <button class="card-delete-btn" data-link="${data.meta?.sourceUrl || '#'}" title="Remover">X</button>
        
        <button class="card-add-token-btn" data-link="${data.meta?.sourceUrl || '#'}" title="Adicionar Ação Extra">+</button>
        
        <button class="card-beta-btn" data-char-id="${rawId}" title="Copiar Script de Importação (CRIS)">⚡</button>

        <div class="card-header">
          ${pictureHtml}
          <div class="card-title">
            <h2 data-field="name">${header.name}</h2>
            <span data-field="description">${header.description}</span>
          </div>
        </div>

        <div class="vitals-container">${vitalsHtml}</div>
        <div class="extra-stats">${propertiesHtml}</div>
        <div class="attr-bar">${attributesHtml}</div>
        <div class="card-expand-content">
          <div class="card-expand-inner">${sectionsHtml}</div>
        </div>
    </div>
  `;
}

export function renderTokenHTML(cardElement, data) {
  const header = data.header || { name: 'Token', description: '' };
  
  cardElement.classList.add('action-token');

  const pictureHtml = header.avatarUrl 
    ? `<img class="token-portrait" src="${header.avatarUrl}" alt="Portrait" data-field="portrait">` 
    : `<div class="token-portrait" style="background:#ddd" data-field="portrait">?</div>`;

  cardElement.innerHTML = `
    <div class="card-grab-zone" title="Arraste para mover"></div>
    
    <div class="card-inner-content">
        <button class="card-delete-btn" data-link="${data.meta?.sourceUrl || '#'}" title="Remover">X</button>

        <div class="token-layout">
          ${pictureHtml}
          <div class="token-info">
            <div class="token-name" data-field="name">${header.name}</div>
            <div class="token-type">Ação Extra</div>
          </div>
        </div>
    </div>
  `;
}

export function updateExistingCard(cardElement, data) {
  const header = data.header || {};
  
  if (cardElement.classList.contains('action-token')) {
      const portraitEl = cardElement.querySelector('[data-field="portrait"]');
      if (portraitEl && portraitEl.tagName === 'IMG') utils.updateSrc(portraitEl, header.avatarUrl);
      utils.updateText(cardElement.querySelector('[data-field="name"]'), header.name);
      return; 
  }

  if (header.borderColor) {
      cardElement.style.borderColor = header.borderColor;
      cardElement.style.boxShadow = `0 0 8px ${header.borderColor}80`;
  } else {
      cardElement.style.borderColor = '';
      cardElement.style.boxShadow = '';
  }

  const portraitEl = cardElement.querySelector('[data-field="portrait"]');
  if (portraitEl && portraitEl.tagName === 'IMG') utils.updateSrc(portraitEl, header.avatarUrl);
  
  utils.updateText(cardElement.querySelector('[data-field="name"]'), header.name);
  utils.updateText(cardElement.querySelector('[data-field="description"]'), header.description);

  if (data.vitals) {
    data.vitals.forEach(vital => {
      const rowEl = cardElement.querySelector(`[data-vital-id="${vital.id}"]`);
      if (rowEl) {
        const barFill = rowEl.querySelector('.vital-bar-fill');
        const valText = rowEl.querySelector('.vital-value');
        utils.updateBarStyle(barFill, utils.calculatePercentage(vital.current, vital.max));
        utils.updateText(valText, `${vital.current}/${vital.max}`);
      }
    });
  }

  if (data.attributes) {
    data.attributes.forEach(attr => {
      const attrEl = cardElement.querySelector(`[data-attr-id="${attr.id}"]`);
      if (attrEl) {
        const valText = attrEl.querySelector('.attr-value');
        utils.updateText(valText, attr.value);
      }
    });
  }

  if (data.properties) {
    const propsContainer = cardElement.querySelector('.extra-stats');
    if (propsContainer) {
        propsContainer.innerHTML = data.properties.map(renderers.renderProperty).join('');
    }
  }

  if (data.sections) {
    data.sections.forEach(section => {
      const sectionContainer = cardElement.querySelector(`[data-section-id="${section.id}"] .accordion-inner`);
      if (sectionContainer && section.items) {
        const contentHtml = section.items.length > 0 
            ? section.items.map(renderers.renderSectionItem).join('') 
            : renderers.placeholder;
        
        if (sectionContainer.innerHTML !== contentHtml) {
            sectionContainer.innerHTML = contentHtml;
        }
      }
    });
  }
}
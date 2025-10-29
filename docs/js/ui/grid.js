// js/ui/grid.js
import * as utils from './utils.js';

// --- Variáveis do Módulo ---
let gridElement = null;
let onDeleteCallback = null;

// --- Funções de Renderização de Lista (Internas) ---

// --- MODIFICADO ---
// Transforma o item da lista em um accordion aninhado
const renderListItem = (item) => `
    <div class="inner-accordion-item">
        <div class="inner-accordion-header">${item.name}</div>
        <div class="inner-accordion-content">
            <div class="inner-accordion-inner">
                <p>${item.description || 'Sem descrição.'}</p>
            </div>
        </div>
    </div>`;

// --- MODIFICADO ---
// Transforma o item de inventário em um accordion aninhado
const renderInventoryItem = (item) => `
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

const placeholder = '<div class="list-placeholder">Nenhum</div>';


/**
 * Cria o HTML de um card totalmente novo.
 * (Esta função não precisa mudar, pois usa os helpers acima)
 */
export function renderNewCardHTML(cardElement, data) {
  const hpClass = utils.getStatusClass(data.hp);
  const sanClass = utils.getStatusClass(data.sanity);
  const peClass = utils.getStatusClass(data.effort);
  const loadClass = utils.getLoadStatusClass(data.load);
  const pictureHtml = data.picture 
    ? `<img class="card-portrait-img" src="${data.picture}" alt="Portrait" data-field="portrait">` 
    : `<div class="card-portrait-placeholder" data-field="portrait">?</div>`;

  cardElement.innerHTML = `
    <div class="card-drag-handle" title="Mover"><svg width="18" height="18" viewBox="0 0 24 24" style="fill: #888;"><path d="M9 4C9 4.55228 8.55228 5 8 5C7.44772 5 7 4.55228 7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4ZM9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8C7 7.44772 7.44772 7 8 7C8.55228 7 9 7.44772 9 8ZM9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11C8.55228 11 9 11.4477 9 12ZM9 16C9 16.5523 8.55228 17 8 17C7.44772 17 7 16.5523 7 16C7 15.4477 7.44772 15 8 15C8.55228 15 9 15.4477 9 16ZM9 20C9 20.5523 8.55228 21 8 21C7.44772 21 7 20.5523 7 20C7 19.4477 7.44772 19 8 19C8.55228 19 9 19.4477 9 20ZM17 4C17 4.55228 16.5523 5 16 5C15.4477 5 15 4.55228 15 4C15 3.44772 15.4477 3 16 3C16.5523 3 17 3.44772 17 4ZM17 8C17 8.55228 16.5523 9 16 9C15.4477 9 15 8.55228 15 8C15 7.44772 15.4477 7 16 7C16.5523 7 17 7.44772 17 8ZM17 12C17 12.5523 16.5523 13 16 13C15.4477 13 15 12.5523 15 12C15 11.4477 15.4477 11 16 11C16.5523 11 17 11.4477 17 12ZM17 16C17 16.5523 16.5523 17 16 17C15.4477 17 15 16.5523 15 16C15 15.4477 15.4477 15 16 15C16.5523 15 17 15.4477 17 16ZM17 20C17 20.5523 16.5523 21 16 21C15.4477 21 15 20.5523 15 20C15 19.4477 15.4477 19 16 19C16.5523 19 17 19.4477 17 20Z"></path></svg></div>
    <button class="card-delete-btn" data-link="${data.originalUrl}" title="Remover Personagem">X</button>
    <div class="card-header">${pictureHtml}<div class="card-title"><h2 data-field="name">${data.name || 'Nome não encontrado'}</h2><span data-field="class-nex">${data.className} - ${data.nex}</span></div></div>
    <div class="stat"><span>Vida (PV):</span><span class="${hpClass}" data-field="hp">${data.hp || 'N/A'}</span></div>
    <div class="stat"><span>Sanidade (SAN):</span><span class="${sanClass}" data-field="san">${data.sanity || 'N/A'}</span></div>
    <div class="stat"><span>Esforço (PE):</span><span class="${peClass}" data-field="pe">${data.effort || 'N/A'}</span></div>
    <div class="extra-stats">
      <span class="stat-item">Esquiva: <span data-field="evade">${data.evade}</span></span>
      <span class="stat-item">Bloqueio: <span data-field="block">${data.block}</span></span>
      <span class="stat-item">Desl.: <span data-field="movement">${data.movement}m</span></span>
      <span class="stat-item">Carga: <span class="${loadClass}" data-field="load">${data.load}</span></span>
    </div>
    <div class="attr-bar" data-field="attributes">
      <div class="attr-item"><span class="attr-label">FOR</span><span class="attr-value" data-attr="str">${data.attributes.str}</span></div>
      <div class="attr-item"><span class="attr-label">AGI</span><span class="attr-value" data-attr="dex">${data.attributes.dex}</span></div>
      <div class="attr-item"><span class="attr-label">VIG</span><span class="attr-value" data-attr="con">${data.attributes.con}</span></div>
      <div class="attr-item"><span class="attr-label">INT</span><span class="attr-value" data-attr="int">${data.attributes.int}</span></div>
      <div class="attr-item"><span class="attr-label">PRE</span><span class="attr-value" data-attr="pre">${data.attributes.pre}</span></div>
    </div>
    <div class="card-expand-content">
      <div class="card-expand-inner"> 
        <div class="accordion-item">
          <div class="accordion-header">Habilidades</div>
          <div class="accordion-content" data-type="habilidades">
            <div class="accordion-inner"> 
              ${data.powers.length > 0 ? data.powers.map(renderListItem).join('') : placeholder}
            </div>
          </div>
        </div>
        <div class="accordion-item">
          <div class="accordion-header">Rituais</div>
          <div class="accordion-content" data-type="rituais">
            <div class="accordion-inner"> 
              ${data.rituals.length > 0 ? data.rituals.map(renderListItem).join('') : placeholder}
            </div>
          </div>
        </div>
        <div class="accordion-item">
          <div class="accordion-header">Inventário</div>
          <div class="accordion-content" data-type="inventario">
            <div class="accordion-inner"> 
              ${data.inventory.length > 0 ? data.inventory.map(renderInventoryItem).join('') : placeholder}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Atualiza um card já existente no DOM com novos dados.
 * (Esta função não precisa mudar, pois usa os helpers acima)
 */
export function updateExistingCard(cardElement, data) {
  // --- Atualizações de Status e Header (Não mudam) ---
  cardElement.classList.remove('card-status-dying', 'card-status-crazy');
  if (data.isDying) cardElement.classList.add('card-status-dying');
  else if (data.isCrazy) cardElement.classList.add('card-status-crazy');
  else cardElement.style.borderColor = ''; 

  const portraitEl = cardElement.querySelector('[data-field="portrait"]');
  if (portraitEl && portraitEl.tagName === 'IMG') utils.updateSrc(portraitEl, data.picture);
  utils.updateText(cardElement.querySelector('[data-field="name"]'), data.name);
  utils.updateText(cardElement.querySelector('[data-field="class-nex"]'), `${data.className} - ${data.nex}`);
  utils.updateText(cardElement.querySelector('[data-field="evade"]'), data.evade);
  utils.updateText(cardElement.querySelector('[data-field="block"]'), data.block);
  utils.updateText(cardElement.querySelector('[data-field="movement"]'), `${data.movement}m`);
  
  const hpEl = cardElement.querySelector('[data-field="hp"]');
  utils.updateText(hpEl, data.hp); utils.updateStatusClass(hpEl, utils.getStatusClass(data.hp));
  const sanEl = cardElement.querySelector('[data-field="san"]');
  utils.updateText(sanEl, data.sanity); utils.updateStatusClass(sanEl, utils.getStatusClass(data.sanity));
  const peEl = cardElement.querySelector('[data-field="pe"]');
  utils.updateText(peEl, data.effort); utils.updateStatusClass(peEl, utils.getStatusClass(data.effort));
  const loadEl = cardElement.querySelector('[data-field="load"]');
  utils.updateText(loadEl, data.load); utils.updateStatusClass(loadEl, utils.getLoadStatusClass(data.load));

  utils.updateText(cardElement.querySelector('[data-attr="str"]'), data.attributes.str);
  utils.updateText(cardElement.querySelector('[data-attr="dex"]'), data.attributes.dex);
  utils.updateText(cardElement.querySelector('[data-attr="con"]'), data.attributes.con);
  utils.updateText(cardElement.querySelector('[data-attr="int"]'), data.attributes.int);
  utils.updateText(cardElement.querySelector('[data-attr="pre"]'), data.attributes.pre);

  // --- Atualizações do Accordion (Não mudam) ---
  // (Atualiza o *inner* do wrapper)
  const powersEl = cardElement.querySelector('[data-type="habilidades"] .accordion-inner');
  if (powersEl) powersEl.innerHTML = data.powers.length > 0 ? data.powers.map(renderListItem).join('') : placeholder;

  const ritualsEl = cardElement.querySelector('[data-type="rituais"] .accordion-inner');
  if (ritualsEl) ritualsEl.innerHTML = data.rituals.length > 0 ? data.rituals.map(renderListItem).join('') : placeholder;

  const inventoryEl = cardElement.querySelector('[data-type="inventario"] .accordion-inner');
  if (inventoryEl) inventoryEl.innerHTML = data.inventory.length > 0 ? data.inventory.map(renderInventoryItem).join('') : placeholder;
}

// ... (O restante das funções createNewCardElement, renderErrorCard, etc. não mudam) ...
export function createNewCardElement(link) {
  const cardElement = document.createElement('div');
  cardElement.className = 'character-card';
  cardElement.dataset.link = link; 
  gridElement.appendChild(cardElement);
  return cardElement;
}
export function renderErrorCard(cardElement, data) {
  cardElement.innerHTML = `<button class="card-delete-btn" data-link="${data.originalUrl}" title="Remover Personagem">X</button><h2>Erro ao carregar</h2><p>${data.error}</p><small>${data.originalUrl}</small>`;
  cardElement.style.borderColor = '#dc3545';
}
export function showPlaceholder() {
  gridElement.innerHTML = '<div class="card-placeholder">Adicione links de portrait para começar...</div>';
}
export function removePlaceholder() {
  const placeholder = gridElement.querySelector('.card-placeholder');
  if (placeholder) placeholder.remove();
}
export function removeCard(link) {
  const cardToRemove = gridElement.querySelector(`[data-link="${link}"]`);
  if (cardToRemove) {
    cardToRemove.remove();
  }
}


/**
 * Inicializa o grid, registrando os listeners de clique internos.
 * @param {function} onDelete - Callback a ser chamado quando o 'X' é clicado.
 */
export function initializeGrid(onDelete) {
  gridElement = document.getElementById('dashboard-grid');
  onDeleteCallback = onDelete;

  // --- MODIFICADO ---
  // Adiciona o listener para o accordion aninhado
  gridElement.addEventListener('click', (e) => {
    // 1. Lógica de Deletar
    const deleteButton = e.target.closest('.card-delete-btn');
    if (deleteButton) {
      e.stopPropagation(); 
      const linkToDelete = deleteButton.dataset.link;
      if (onDeleteCallback) {
        onDeleteCallback(linkToDelete);
      }
      return;
    }

    // 2. NOVA LÓGICA: Accordion ANINHADO (Item individual)
    const innerAccordionHeader = e.target.closest('.inner-accordion-header');
    if (innerAccordionHeader) {
      e.stopPropagation(); // Impede o accordion PAI de fechar
      innerAccordionHeader.classList.toggle('active');
      return;
    }

    // 3. Lógica do Accordion PAI (Habilidades, Rituais, Inventário)
    const accordionHeader = e.target.closest('.accordion-header');
    if (accordionHeader) {
      e.stopPropagation(); // Impede o card de fechar
      accordionHeader.classList.toggle('active');
      return;
    }

    // 4. Lógica de Expandir o Card (Restante do card)
    if (e.target.closest('.card-drag-handle')) {
      return;
    }
    const card = e.target.closest('.character-card');
    if (card) {
      card.classList.toggle('card-expanded');
    }
  });
}
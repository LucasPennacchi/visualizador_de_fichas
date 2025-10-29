// js/ui/grid.js
// As funções de renderização foram movidas para card.js e card-renderers.js
// A única importação de UI que ele precisa agora é o card.js
import * as card from './card.js'; 

// --- Variáveis do Módulo ---
let gridElement = null;
let onDeleteCallback = null;

/**
 * Cria um novo elemento de card (sem preenchê-lo).
 * @param {string} link - O link (URL) do personagem.
 * @returns {HTMLElement} O elemento <div> do card.
 */
export function createNewCardElement(link) {
  const cardElement = document.createElement('div');
  cardElement.className = 'character-card';
  cardElement.dataset.link = link; 
  gridElement.appendChild(cardElement);
  return cardElement;
}

/**
 * Renderiza um card de erro.
 * (Esta função foi movida do card.js para cá, pois ela é sobre o ESTADO do grid)
 * @param {HTMLElement} cardElement - O elemento <div> do card.
 * @param {object} data - O objeto de erro.
 */
export function renderErrorCard(cardElement, data) {
  cardElement.innerHTML = `<button class="card-delete-btn" data-link="${data.originalUrl}" title="Remover Personagem">X</button><h2>Erro ao carregar</h2><p>${data.error}</p><small>${data.originalUrl}</small>`;
  cardElement.style.borderColor = '#dc3545';
}

/**
 * Mostra a mensagem de placeholder (Ex: "Adicione links...").
 */
export function showPlaceholder() {
  gridElement.innerHTML = '<div class="card-placeholder">Adicione links de portrait para começar...</div>';
}

/**
 * Remove a mensagem de placeholder.
 */
export function removePlaceholder() {
  const placeholder = gridElement.querySelector('.card-placeholder');
  if (placeholder) placeholder.remove();
}

/**
 * Remove um card específico do grid.
 * @param {string} link - O link (URL) do card a ser removido.
 */
export function removeCard(link) {
  const cardToRemove = gridElement.querySelector(`[data-link="${link}"]`);
  if (cardToRemove) {
    cardToRemove.remove();
  }
}

/**
 * Inicializa o grid, registrando os listeners de clique internos.
 * (Esta função permanece igual)
 */
export function initializeGrid(onDelete) {
  gridElement = document.getElementById('dashboard-grid');
  onDeleteCallback = onDelete;

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

    // 2. Lógica: Accordion ANINHADO (Item individual)
    const innerAccordionHeader = e.target.closest('.inner-accordion-header');
    if (innerAccordionHeader) {
      e.stopPropagation(); 
      innerAccordionHeader.classList.toggle('active');
      return;
    }

    // 3. Lógica do Accordion PAI (Habilidades, Rituais, Inventário, Perícias)
    const accordionHeader = e.target.closest('.accordion-header');
    if (accordionHeader) {
      e.stopPropagation(); 
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
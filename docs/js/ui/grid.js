/**
 * @module UI/Grid
 * @description Gerencia o contêiner principal do grid (Grid/Masonry).
 * Responsável pela criação e remoção de elementos do DOM, exibição de placeholders
 * e gerenciamento centralizado de eventos de clique (Event Delegation).
 */

import * as card from './card.js'; 
import * as combat from './combat.js';

// --- Variáveis do Módulo ---
let gridElement = null;
let onDeleteCallback = null;

// --- Funções Exportadas ---

export function createNewCardElement(charId, link) {
  const cardElement = document.createElement('div');
  cardElement.className = 'character-card';
  cardElement.dataset.charId = charId; 
  cardElement.dataset.link = link; 
  
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  gridElement.appendChild(cardElement);
  
  return cardElement;
}

export function renderErrorCard(cardElement, data) {
  cardElement.innerHTML = `
    <button class="card-delete-btn" data-link="${data.originalUrl}" title="Remover Personagem">X</button>
    <h2>Erro ao carregar</h2>
    <p>${data.error}</p>
    <small>${data.originalUrl}</small>
  `;
  cardElement.style.borderColor = '#dc3545';
}

export function showPlaceholder() {
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  gridElement.innerHTML = '<div class="card-placeholder">Adicione links ou códigos de portrait para começar...</div>';
}

export function removePlaceholder() {
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  const placeholder = gridElement.querySelector('.card-placeholder');
  if (placeholder) placeholder.remove();
}

export function removeCard(charId) {
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  const cardToRemove = gridElement.querySelector(`[data-char-id="${charId}"]`);
  if (cardToRemove) {
    cardToRemove.remove();
  }
}

/**
 * Inicializa o grid e configura a Delegação de Eventos.
 * * @param {function(string): void} onDelete - Callback para a ação de deletar.
 */
export function initializeGrid(onDelete) {
  gridElement = document.getElementById('dashboard-grid');
  onDeleteCallback = onDelete;

  gridElement.addEventListener('click', (e) => {
    const target = e.target;

    // 1. Deletar
    const deleteButton = target.closest('.card-delete-btn');
    if (deleteButton) {
      e.stopPropagation(); 
      const linkToDelete = deleteButton.dataset.link;
      if (onDeleteCallback) onDeleteCallback(linkToDelete);
      return;
    }

    // 2. Adicionar Token
    const addTokenButton = target.closest('.card-add-token-btn');
    if (addTokenButton) {
      e.stopPropagation();
      const link = addTokenButton.dataset.link;
      combat.addCombatantToken(link);
      return;
    }

    // 3. Accordion Aninhado
    const innerAccordionHeader = target.closest('.inner-accordion-header');
    if (innerAccordionHeader) {
      e.stopPropagation(); 
      innerAccordionHeader.classList.toggle('active');
      return;
    }

    // 4. Accordion Pai
    const accordionHeader = target.closest('.accordion-header');
    if (accordionHeader) {
      e.stopPropagation(); 
      accordionHeader.classList.toggle('active');
      return;
    }

    // 5. Expandir Card
    // Ignora se o clique foi na ZONA DE ARRASTO (permite arrastar sem abrir)
    if (target.closest('input') || target.closest('button') || target.closest('.card-grab-zone')) {
        return;
    }

    const card = target.closest('.character-card');
    if (card) {
      card.classList.toggle('card-expanded');
    }
  });
}
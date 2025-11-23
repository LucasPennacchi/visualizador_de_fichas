/**
 * @module UI/Grid
 * @description Gerencia o contêiner principal do grid.
 */

import * as card from './card.js'; 
import * as combat from './combat.js';

let gridElement = null;
let onDeleteCallback = null;

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

export function removeCard(link) {
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  const cardToRemove = gridElement.querySelector(`.character-card[data-link="${link}"]:not(.action-token)`);
  if (cardToRemove) {
    cardToRemove.remove();
  }
}

/**
 * Inicializa o grid e configura a Delegação de Eventos.
 * Centraliza todos os cliques do grid em um único listener para performance e manutenibilidade.
 * * @param {function(string): void} onDelete - Callback para a ação de deletar (Card Principal).
 */
export function initializeGrid(onDelete) {
  gridElement = document.getElementById('dashboard-grid');
  onDeleteCallback = onDelete;

  gridElement.addEventListener('click', (e) => {
    const target = e.target;

    // 1. Ação: Deletar (Botão X)
    const deleteButton = target.closest('.card-delete-btn');
    if (deleteButton) {
      e.stopPropagation(); 
      
      const cardElement = deleteButton.closest('.character-card');
      
      // --- LÓGICA DE REMOÇÃO DIFERENCIADA ---
      // Verifica se o elemento é um Token de Ação (Mini-card de combate)
      if (cardElement && cardElement.classList.contains('action-token')) {
          // Descobre o índice visual deste token no grid
          const allCards = Array.from(gridElement.children).filter(el => el.classList.contains('character-card'));
          const index = allCards.indexOf(cardElement);
          
          if (index > -1) {
              // Remove apenas o token da lista de combate
              combat.removeCombatantByIndex(index);
          }
          return; // Impede que a deleção "vaze" para o card principal
      }
      // --------------------------------------

      // Se não for token, é um Card Principal: deleta o personagem do sistema
      const linkToDelete = deleteButton.dataset.link;
      if (onDeleteCallback) onDeleteCallback(linkToDelete);
      return;
    }

    // 2. Ação: Adicionar Token de Combate (Botão +)
    const addTokenButton = target.closest('.card-add-token-btn');
    if (addTokenButton) {
      e.stopPropagation();
      const link = addTokenButton.dataset.link;
      combat.addCombatantToken(link);
      return;
    }

    // 3. Ação: Alternar Accordion Aninhado (Item)
    const innerAccordionHeader = target.closest('.inner-accordion-header');
    if (innerAccordionHeader) {
      e.stopPropagation(); 
      innerAccordionHeader.classList.toggle('active');
      gridElement.dispatchEvent(new CustomEvent('layout-change', { bubbles: true }));
      return;
    }

    // 4. Ação: Alternar Accordion Pai (Categoria)
    const accordionHeader = target.closest('.accordion-header');
    if (accordionHeader) {
      e.stopPropagation(); 
      accordionHeader.classList.toggle('active');
      gridElement.dispatchEvent(new CustomEvent('layout-change', { bubbles: true }));
      return;
    }

    // 5. Ação: Expandir Card (Clique no corpo)
    // Ignora cliques em inputs, botões ou na área de arrasto
    if (target.closest('input') || target.closest('button') || target.closest('.card-grab-zone')) {
        return;
    }

    const card = target.closest('.character-card');
    if (card) {
      card.classList.toggle('card-expanded');
      gridElement.dispatchEvent(new CustomEvent('layout-change', { bubbles: true }));
    }
  });
}
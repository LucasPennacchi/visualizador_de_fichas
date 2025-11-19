/**
 * @module UI/Grid
 * @description Gerencia o contêiner principal do grid (Dashboard), manipulando a criação,
 * remoção e estados dos cards no DOM. Implementa o padrão de "Event Delegation" para
 * lidar com interações de clique de forma performática.
 * * @requires module:UI/Card
 */

import * as card from './card.js'; 

// --- Variáveis do Módulo ---

/**
 * Referência ao elemento DOM principal do grid (#dashboard-grid).
 * @type {HTMLElement|null}
 * @private
 */
let gridElement = null;

/**
 * Função de callback a ser executada quando uma ação de exclusão é solicitada.
 * @type {DeleteLinkCallback|null}
 * @private
 */
let onDeleteCallback = null;

/**
 * Definição do callback de deleção.
 * @callback DeleteLinkCallback
 * @param {string} link - O link/ID único do card a ser removido.
 * @returns {void}
 */

// --- Funções Exportadas ---

/**
 * Cria um novo elemento de card vazio e o anexa ao grid.
 * O conteúdo interno deve ser renderizado posteriormente.
 * * @param {string} link - O URL ou ID único que identifica o personagem.
 * @returns {HTMLElement} O elemento <div> do card recém-criado e anexado ao DOM.
 */
export function createNewCardElement(link) {
  const cardElement = document.createElement('div');
  cardElement.className = 'character-card';
  cardElement.dataset.link = link; 
  
  // Garante que o gridElement esteja inicializado antes de usar (fallback de segurança)
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  
  gridElement.appendChild(cardElement);
  return cardElement;
}

/**
 * Renderiza o estado de erro dentro de um card existente.
 * Substitui todo o conteúdo HTML do card por uma mensagem de erro e botão de remoção.
 * * @param {HTMLElement} cardElement - O elemento DOM do card alvo.
 * @param {object} data - O objeto contendo os detalhes do erro.
 * @param {string} data.originalUrl - O link original que falhou.
 * @param {string} data.error - A mensagem de erro retornada pelo backend.
 */
export function renderErrorCard(cardElement, data) {
  cardElement.innerHTML = `
    <button class="card-delete-btn" data-link="${data.originalUrl}" title="Remover Personagem">X</button>
    <h2>Erro ao carregar</h2>
    <p>${data.error}</p>
    <small>${data.originalUrl}</small>
  `;
  cardElement.style.borderColor = '#dc3545';
}

/**
 * Exibe a mensagem de placeholder no grid quando não há cards.
 * Útil para orientar o usuário no estado inicial (vazio).
 */
export function showPlaceholder() {
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  gridElement.innerHTML = '<div class="card-placeholder">Adicione links de portrait para começar...</div>';
}

/**
 * Remove a mensagem de placeholder do grid, se ela existir.
 * Deve ser chamado antes de adicionar o primeiro card.
 */
export function removePlaceholder() {
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  const placeholder = gridElement.querySelector('.card-placeholder');
  if (placeholder) placeholder.remove();
}

/**
 * Localiza e remove um card específico do DOM baseado no seu atributo data-link.
 * * @param {string} link - O link (URL) identificador do card a ser removido.
 */
export function removeCard(link) {
  if (!gridElement) gridElement = document.getElementById('dashboard-grid');
  const cardToRemove = gridElement.querySelector(`[data-link="${link}"]`);
  if (cardToRemove) {
    cardToRemove.remove();
  }
}

/**
 * Inicializa o módulo do grid, capturando a referência do DOM e registrando
 * um único Event Listener centralizado (Event Delegation) para gerenciar
 * todas as interações dos cards (deletar, expandir, accordion).
 * * @param {DeleteLinkCallback} onDelete - Callback invocado quando o botão 'X' é clicado.
 */
export function initializeGrid(onDelete) {
  gridElement = document.getElementById('dashboard-grid');
  onDeleteCallback = onDelete;

  // Usa Event Delegation: Um único listener no pai gerencia todos os filhos
  gridElement.addEventListener('click', (e) => {
    const target = e.target;

    // 1. Lógica de Deletar (Botão X)
    const deleteButton = target.closest('.card-delete-btn');
    if (deleteButton) {
      e.stopPropagation(); 
      const linkToDelete = deleteButton.dataset.link;
      if (onDeleteCallback) {
        onDeleteCallback(linkToDelete);
      }
      return;
    }

    // 2. Lógica: Accordion ANINHADO (Item individual - ex: Habilidade específica)
    const innerAccordionHeader = target.closest('.inner-accordion-header');
    if (innerAccordionHeader) {
      e.stopPropagation(); // Impede propagação para o accordion pai ou card
      innerAccordionHeader.classList.toggle('active');
      return;
    }

    // 3. Lógica do Accordion PAI (Categorias: Habilidades, Rituais, Inventário, Perícias)
    const accordionHeader = target.closest('.accordion-header');
    if (accordionHeader) {
      e.stopPropagation(); // Impede propagação para a expansão do card
      accordionHeader.classList.toggle('active');
      return;
    }

    // 4. Lógica de Expandir o Card (Restante da área clicável)
    // Ignora se o clique foi na alça de arrastar (drag handle)
    if (target.closest('.card-drag-handle')) {
      return;
    }

    const card = target.closest('.character-card');
    if (card) {
      card.classList.toggle('card-expanded');
    }
  });
}
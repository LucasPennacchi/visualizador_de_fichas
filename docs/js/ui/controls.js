// js/ui/controls.js
import { getLinks, saveLinks, getHeaderState, saveHeaderState } from '../store.js';

// --- Variáveis do Módulo ---
let headerElement, toggleBtn, linkInput, addBtn, linkListContainer;
let onAddLinksCallback = null; // Callback para notificar o main.js

/**
 * Renderiza a lista de "tags" de links no header.
 */
export function renderLinkList() {
  linkListContainer.innerHTML = '';
  const links = getLinks();
  links.forEach((link) => {
    const tag = document.createElement('div');
    tag.className = 'link-tag';
    tag.innerHTML = `<span>${link.substring(0, 40)}...</span>`;
    linkListContainer.appendChild(tag);
  });
}

/**
 * Define o estado do header (minimizado ou maximizado).
 * @param {boolean} isMinimized 
 */
function setHeaderState(isMinimized) {
  headerElement.classList.toggle('header-minimized', isMinimized);
  saveHeaderState(isMinimized ? 'minimized' : 'maximized');
}

/**
 * Carrega o estado salvo do header ao iniciar a página.
 */
function loadHeaderState() {
  const savedState = getHeaderState();
  setHeaderState(savedState === 'minimized');
}

/**
 * Lógica do botão "Adicionar Personagem".
 */
function handleAddClick() {
  const input = linkInput.value.trim();
  if (!input) return;
  
  let linksToAdd = [];
  if (input.startsWith('[') && input.endsWith(']')) {
    const linksString = input.slice(1, -1);
    linksToAdd = linksString.split(',').map(link => link.trim()).filter(link => link);
  } else {
    linksToAdd = [input];
  }
  
  if (linksToAdd.length === 0) return;
  
  const existingLinks = getLinks();
  let addedCount = 0;
  linksToAdd.forEach(newLink => {
    if (!existingLinks.includes(newLink)) {
      existingLinks.push(newLink);
      addedCount++;
    }
  });
  
  if (addedCount > 0) {
    saveLinks(existingLinks);
    renderLinkList();
    // Notifica o main.js que a lista mudou, para ele poder
    // chamar o subscribeToLinks
    if (onAddLinksCallback) {
      onAddLinksCallback(existingLinks);
    }
  }
  linkInput.value = '';
}

/**
 * Inicializa todo o módulo de controles do header.
 * @param {function} onAddLinks - Callback a ser chamado quando links são adicionados.
 */
export function initializeControls(onAddLinks) {
  headerElement = document.querySelector('header');
  toggleBtn = document.getElementById('toggle-header-btn');
  linkInput = document.getElementById('link-input');
  addBtn = document.getElementById('add-link-btn');
  linkListContainer = document.getElementById('link-list');
  onAddLinksCallback = onAddLinks;

  // Listeners
  toggleBtn.addEventListener('click', () => {
    const isCurrentlyMinimized = headerElement.classList.contains('header-minimized');
    setHeaderState(!isCurrentlyMinimized);
  });
  
  addBtn.addEventListener('click', handleAddClick);

  // Carga inicial
  loadHeaderState();
  renderLinkList();
}
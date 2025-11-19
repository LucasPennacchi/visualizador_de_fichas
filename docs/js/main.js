// js/main.js
import * as api from './api.js';
import * as store from './store.js';
import * as controls from './ui/controls.js';
import * as grid from './ui/grid.js';
import * as card from './ui/card.js'; 

// --- Elemento Principal ---
const gridElement = document.getElementById('dashboard-grid');

function processBatchData(charactersData) {
  if (!charactersData || charactersData.length === 0) return;
  
  grid.removePlaceholder();
  const links = store.getLinks(); 

  for (const data of charactersData) {
    const link = data.originalUrl;
    if (!link || !links.includes(link)) continue; 

    let cardElement = gridElement.querySelector(`[data-link="${link}"]`);
    
    if (!cardElement) {
      cardElement = grid.createNewCardElement(link);
    }
    
    if (data.error) {
      grid.renderErrorCard(cardElement, data); 
    } else {
      if (!cardElement.hasAttribute('data-rendered')) {
        card.renderNewCardHTML(cardElement, data); 
        cardElement.setAttribute('data-rendered', 'true');
      }
      card.updateExistingCard(cardElement, data); 
    }
  }
  
  links.forEach(link => {
    const card = gridElement.querySelector(`[data-link="${link}"]`);
    if (card) gridElement.appendChild(card); 
  });
}
function loadDataFromCache() {
  const links = store.getLinks();
  if (links.length === 0) {
    grid.showPlaceholder();
    return;
  }
  
  grid.removePlaceholder();
  const cachedData = store.getCachedData();
  if (cachedData && cachedData.length > 0) {
    console.log(`[Cache Cliente] Carregando ${cachedData.length} cards "velhos" do localStorage...`);
    processBatchData(cachedData);
  }
}
function handleDataUpdate(payload) {
  store.saveCachedData(payload); 
  processBatchData(payload); 
}
function handleConnectionOpen() {
  api.subscribeToLinks(store.getLinks());
}
function handleLinksAdded(newLinkList) {
  api.subscribeToLinks(newLinkList);
  if (newLinkList.length > 0) {
    grid.removePlaceholder();
  }
}
function handleDeleteLink(linkToDelete) {
  let links = store.getLinks();
  links = links.filter(l => l !== linkToDelete); 
  store.saveLinks(links); 
  
  controls.renderLinkList(); 
  grid.removeCard(linkToDelete); 
  
  api.subscribeToLinks(links); 
  
  if (links.length === 0) {
    grid.showPlaceholder();
  }
}

/**
 * INICIALIZAÇÃO DA APLICAÇÃO
 */
async function init() {
  controls.initializeControls(handleLinksAdded);
  grid.initializeGrid(handleDeleteLink);
  
  try {
    // (Ajuste o caminho se a sua pasta 'dice-roller' estiver em outro lugar)
    const diceRoller = await import('./ui/dice-roller/dice-roller.js');
    diceRoller.initializeDiceRoller();
   } catch (e) {
    console.error("Falha ao carregar o módulo do rolador de dados:", e);
   }
  
  new Sortable(gridElement, {
    handle: '.card-drag-handle', animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
    onEnd: function (evt) {
      let links = store.getLinks(); 
      const [movedItem] = links.splice(evt.oldIndex, 1);
      links.splice(evt.newIndex, 0, movedItem);
      store.saveLinks(links);
      controls.renderLinkList(); 
    }
  });

  loadDataFromCache();
  api.connect(handleDataUpdate, handleConnectionOpen);
}

// Inicia tudo
window.addEventListener('load', init);
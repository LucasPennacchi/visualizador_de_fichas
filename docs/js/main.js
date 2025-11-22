/**
 * @module Main
 * @description Controlador principal da aplicação (Entry Point).
 * Orquestra o fluxo de dados, integração de módulos (API, Store, UI)
 * e gerencia o ciclo de vida da aplicação.
 */

import * as api from './api.js';
import * as store from './store.js';
import * as controls from './ui/controls.js';
import * as grid from './ui/grid.js';
import * as card from './ui/card.js'; 
import * as combat from './ui/combat.js'; 
import { getCharacterIdFromUrl } from './ui/utils.js';

const gridElement = document.getElementById('dashboard-grid');

function processBatchData(charactersData) {
  if (!charactersData || charactersData.length === 0) return;
  
  grid.removePlaceholder();
  const links = store.getLinks(); 

  for (const data of charactersData) {
    const link = data.originalUrl;
    const charId = data.meta?.characterId || getCharacterIdFromUrl(link);

    if (!link || !links.includes(link) || !charId) continue; 

    // Busca Card Principal Existente
    let cardElement = gridElement.querySelector(`.character-card[data-char-id="${charId}"]:not(.action-token)`);
    
    if (!cardElement) {
        // Fallback para Link caso ID não esteja presente no DOM
        cardElement = gridElement.querySelector(`.character-card[data-link="${link}"]:not(.action-token)`);
    }

    if (!cardElement) {
        cardElement = grid.createNewCardElement(charId, link);
    } else {
        // Sincronização de IDs
        if (cardElement.dataset.charId !== charId) cardElement.dataset.charId = charId;
        if (cardElement.dataset.link !== link) cardElement.dataset.link = link;
    }
    
    // Atualiza todos os elementos (Principal + Tokens)
    const allLinkedCards = gridElement.querySelectorAll(`.character-card[data-link="${link}"]`);
    
    allLinkedCards.forEach(el => {
        if (data.error) {
            grid.renderErrorCard(el, data); 
        } else {
            if (!el.hasAttribute('data-rendered')) {
                if (el.classList.contains('action-token')) {
                    card.renderTokenHTML(el, data);
                } else {
                    card.renderNewCardHTML(el, data);
                }
                el.setAttribute('data-rendered', 'true');
            }
            card.updateExistingCard(el, data); 
        }
    });
  }
  
  // Reordenação (Apenas fora de combate)
  if (!document.body.classList.contains('combat-mode')) {
      links.forEach(link => {
        const mainCard = Array.from(gridElement.children).find(el => 
            el.dataset.link === link && !el.classList.contains('action-token')
        );
        if (mainCard) gridElement.appendChild(mainCard); 
      });
  }
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
    console.log(`[Cache] Carregando ${cachedData.length} cards.`);
    processBatchData(cachedData);
  }
}

function handleDataUpdate(payload) {
  store.saveCachedData(payload); 
  processBatchData(payload);     
}

function handleConnectionOpen() {
  const savedRoomId = store.getRoomId();
  const savedLinks = store.getLinks();
  if (savedRoomId) {
    console.log(`[Main] Reconectando à sala: ${savedRoomId}`);
    api.joinRoom(savedRoomId, savedLinks);
  } else {
    api.subscribeToLinks(savedLinks);
  }
}

function handleLinksAdded(newLinkList) {
  api.subscribeToLinks(newLinkList);
  if (newLinkList.length > 0) grid.removePlaceholder();
  
  const currentRoomId = store.getRoomId();
  if (currentRoomId) api.joinRoom(currentRoomId, newLinkList);
}

function handleDeleteLink(linkToDelete) {
  const currentRoomId = store.getRoomId();
  let links = store.getLinks();
  links = links.filter(l => l !== linkToDelete); 
  store.saveLinks(links); 
  
  controls.renderLinkList(); 
  
  const charId = getCharacterIdFromUrl(linkToDelete);
  if (charId) grid.removeCard(charId);
  
  if (links.length === 0) grid.showPlaceholder();

  if (currentRoomId) {
      api.removeLinkFromRoom(currentRoomId, linkToDelete);
  } else {
      api.subscribeToLinks(links); 
  }
}

function handleRoomSync(roomLinks) {
    console.log('[Main] Sync de sala recebido.');
    store.saveLinks(roomLinks);
    controls.renderLinkList();
    
    const allCards = document.querySelectorAll('.character-card');
    allCards.forEach(card => {
        if (!roomLinks.includes(card.dataset.link) && !card.classList.contains('action-token')) {
            card.remove();
        }
    });

    if (roomLinks.length > 0) {
        grid.removePlaceholder();
        api.subscribeToLinks(roomLinks);
    } else {
        grid.showPlaceholder();
    }
}

function handleRoomJoined(roomId) {
    store.saveRoomId(roomId);
    controls.updateRoomUI(roomId);
}

function handleRoomError(error) {
    if (error.code === 'NOT_FOUND') {
        alert(`Erro: A sala não existe mais.`);
        store.clearRoomId();
        controls.updateRoomUI(null);
        api.subscribeToLinks(store.getLinks());
    }
}

async function init() {
  controls.initializeControls(handleLinksAdded);
  grid.initializeGrid(handleDeleteLink);
  combat.initializeCombat();
  
  try {
    const diceRoller = await import('./ui/dice-roller/dice-roller.js');
    diceRoller.initializeDiceRoller();
   } catch (e) {}
  
  // Configuração do Drag-and-Drop com a nova alça
  new Sortable(gridElement, {
    handle: '.card-grab-zone', // Apenas a área cinza permite arrastar
    animation: 150, 
    ghostClass: 'sortable-ghost', 
    chosenClass: 'sortable-chosen',
    onEnd: function (evt) {
      if (!document.body.classList.contains('combat-mode')) {
          let links = store.getLinks(); 
          const [movedItem] = links.splice(evt.oldIndex, 1);
          links.splice(evt.newIndex, 0, movedItem);
          store.saveLinks(links);
          controls.renderLinkList();
      }
    }
  });

  loadDataFromCache(); 
  
  api.connect(
      handleDataUpdate, 
      handleConnectionOpen, 
      handleRoomSync,
      handleRoomJoined,
      handleRoomError,
      combat.handleCombatSync
  );
}

window.addEventListener('load', init);
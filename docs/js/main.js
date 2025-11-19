/**
 * @module Main
 * @description Controlador principal da aplicação (Entry Point).
 * Responsável por orquestrar a comunicação entre a Camada de Dados (Store/API)
 * e a Camada de Interface (UI modules), inicializar bibliotecas de terceiros
 * e gerenciar o ciclo de vida da aplicação.
 */

import * as api from './api.js';
import * as store from './store.js';
import * as controls from './ui/controls.js';
import * as grid from './ui/grid.js';
import * as card from './ui/card.js'; 

// --- Elementos do DOM ---

/**
 * Referência ao contêiner principal do grid no DOM.
 * @type {HTMLElement}
 */
const gridElement = document.getElementById('dashboard-grid');

// --- Funções de Lógica de Negócio ---

/**
 * Processa um lote de dados de personagens (vindos do Cache ou WebSocket) e atualiza a UI.
 * Gerencia a criação de novos cards, renderização de erros, atualização de dados existentes
 * e reordenação do DOM baseada na preferência do usuário.
 * * @param {Array<Object>} charactersData - Array de objetos contendo os dados das fichas.
 * @param {string} charactersData[].originalUrl - O identificador único (URL) da ficha.
 * @param {string} [charactersData[].error] - Mensagem de erro, se a busca falhou.
 */
function processBatchData(charactersData) {
  if (!charactersData || charactersData.length === 0) return;
  
  // Garante que o placeholder suma se houver dados
  grid.removePlaceholder();
  
  // Obtém a ordem salva dos links para manter a consistência visual
  const links = store.getLinks(); 

  for (const data of charactersData) {
    const link = data.originalUrl;
    // Se o link não estiver mais na lista do usuário, ignora a atualização
    if (!link || !links.includes(link)) continue; 

    // Busca o card existente no DOM
    let cardElement = gridElement.querySelector(`[data-link="${link}"]`);
    
    // Se não existir, cria a estrutura base do card
    if (!cardElement) {
      cardElement = grid.createNewCardElement(link);
    }
    
    // Renderiza o conteúdo (Erro ou Sucesso)
    if (data.error) {
      grid.renderErrorCard(cardElement, data); 
    } else {
      // Se o card ainda não foi "hidratado" com HTML, renderiza a primeira vez
      if (!cardElement.hasAttribute('data-rendered')) {
        card.renderNewCardHTML(cardElement, data); 
        cardElement.setAttribute('data-rendered', 'true');
      }
      // Atualiza os valores dinâmicos (HP, Sanidade, etc.)
      card.updateExistingCard(cardElement, data); 
    }
  }
  
  // Reordena os elementos no DOM para refletir a ordem salva no localStorage
  links.forEach(link => {
    const card = gridElement.querySelector(`[data-link="${link}"]`);
    if (card) gridElement.appendChild(card); 
  });
}

/**
 * Carrega os dados persistidos no Cache Local (localStorage) ao iniciar a aplicação.
 * Proporciona uma experiência de "carregamento instantâneo" antes da conexão WebSocket.
 */
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

// --- Callbacks de Eventos ---

/**
 * Callback executado quando uma atualização de dados chega via WebSocket.
 * @param {Array<Object>} payload - Os novos dados recebidos do servidor.
 */
function handleDataUpdate(payload) {
  store.saveCachedData(payload); // Persiste para o próximo F5
  processBatchData(payload);     // Atualiza a tela
}

/**
 * Callback executado quando a conexão WebSocket é estabelecida com sucesso.
 * Reenvia a lista de inscrições para garantir que o servidor monitore as fichas corretas.
 */
function handleConnectionOpen() {
  api.subscribeToLinks(store.getLinks());
}

/**
 * Callback executado quando o usuário adiciona novos links via UI.
 * @param {Array<string>} newLinkList - A nova lista completa de links.
 */
function handleLinksAdded(newLinkList) {
  api.subscribeToLinks(newLinkList); // Notifica o servidor
  if (newLinkList.length > 0) {
    grid.removePlaceholder();
  }
}

/**
 * Callback executado quando o usuário deleta um card via UI.
 * @param {string} linkToDelete - O link/ID do card a ser removido.
 */
function handleDeleteLink(linkToDelete) {
  // Atualiza o estado local
  let links = store.getLinks();
  links = links.filter(l => l !== linkToDelete); 
  store.saveLinks(links); 
  
  // Atualiza a UI
  controls.renderLinkList(); 
  grid.removeCard(linkToDelete); 
  
  // Atualiza o servidor (para parar de monitorar, se necessário)
  api.subscribeToLinks(links); 
  
  if (links.length === 0) {
    grid.showPlaceholder();
  }
}

// --- Inicialização ---

/**
 * Inicializa a aplicação, configurando os módulos de UI, carregando dependências dinâmicas,
 * configurando bibliotecas de terceiros (SortableJS) e estabelecendo a conexão de rede.
 * Executada no evento 'load' da janela.
 * @async
 */
async function init() {
  // 1. Inicializa módulos de UI estática
  controls.initializeControls(handleLinksAdded);
  grid.initializeGrid(handleDeleteLink);
  
  // 2. Carregamento Dinâmico do Módulo de Dados (Code Splitting)
  // Garante que o módulo só carregue após o DOM estar pronto para evitar race conditions.
  try {
    const diceRoller = await import('./ui/dice-roller/dice-roller.js');
    diceRoller.initializeDiceRoller();
   } catch (e) {
    console.error("Falha ao carregar o módulo do rolador de dados:", e);
   }
  
  // 3. Inicialização do SortableJS (Drag-and-Drop)
  new Sortable(gridElement, {
    handle: '.card-drag-handle', 
    animation: 150, 
    ghostClass: 'sortable-ghost', 
    chosenClass: 'sortable-chosen',
    onEnd: function (evt) {
      // Sincroniza a nova ordem visual com o armazenamento local
      let links = store.getLinks(); 
      const [movedItem] = links.splice(evt.oldIndex, 1);
      links.splice(evt.newIndex, 0, movedItem);
      store.saveLinks(links);
      controls.renderLinkList(); // Atualiza as tags no header
    }
  });

  // 4. Fluxo de Dados e Rede
  loadDataFromCache(); // Renderiza cache primeiro (rápido)
  api.connect(handleDataUpdate, handleConnectionOpen); // Conecta ao servidor (lento/assíncrono)
}

// Garante que o script só execute após todos os recursos (incluindo scripts 'defer') estarem carregados
window.addEventListener('load', init);
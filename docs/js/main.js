/**
 * @module Main
 * @description Controlador principal da aplicação (Entry Point).
 * Responsável por orquestrar a comunicação entre a Camada de Dados (Store/API)
 * e a Camada de Interface (UI modules), inicializar bibliotecas de terceiros
 * e gerenciar o ciclo de vida da aplicação, incluindo lógica de salas e sincronização.
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

// --- Callbacks de Eventos (Dados e Conexão) ---

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
 * Verifica se há uma sessão de sala salva para reconectar ou se inscreve nos links locais.
 */
function handleConnectionOpen() {
  const savedRoomId = store.getRoomId();
  const savedLinks = store.getLinks();

  if (savedRoomId) {
    console.log(`[Main] Tentando reconectar à sala salva: ${savedRoomId}`);
    // Tenta reconectar e fazer merge dos links locais atuais
    api.joinRoom(savedRoomId, savedLinks);
  } else {
    // Modo Solo: Apenas se inscreve nos links locais
    api.subscribeToLinks(savedLinks);
  }
}

/**
 * Callback executado quando o usuário adiciona novos links via UI.
 * @param {Array<string>} newLinkList - A nova lista completa de links.
 */
function handleLinksAdded(newLinkList) {
  // Atualiza a inscrição (funciona para modo solo e sala)
  api.subscribeToLinks(newLinkList);
  
  if (newLinkList.length > 0) {
    grid.removePlaceholder();
  }
  
  // Se estiver em sala, força um comando de JOIN novamente para garantir o merge no servidor
  const currentRoomId = store.getRoomId();
  if (currentRoomId) {
      api.joinRoom(currentRoomId, newLinkList);
  }
}

/**
 * Callback executado quando o usuário deleta um card via UI.
 * Gerencia a diferença lógica entre deletar localmente e deletar da sala.
 * @param {string} linkToDelete - O link/ID do card a ser removido.
 */
function handleDeleteLink(linkToDelete) {
  const currentRoomId = store.getRoomId();

  // 1. Atualização Otimista Local (Remove da tela imediatamente)
  let links = store.getLinks();
  links = links.filter(l => l !== linkToDelete); 
  store.saveLinks(links); 
  
  controls.renderLinkList(); 
  grid.removeCard(linkToDelete); 
  
  if (links.length === 0) {
    grid.showPlaceholder();
  }

  // 2. Sincronização com Servidor
  if (currentRoomId) {
      // Modo Sala: Envia comando de remoção explícito para atualizar todos os membros
      api.removeLinkFromRoom(currentRoomId, linkToDelete);
  } else {
      // Modo Solo: Envia nova lista completa (o servidor substitui as inscrições)
      api.subscribeToLinks(links); 
  }
}

// --- Callbacks de Eventos (Salas) ---

/**
 * Callback executado quando o servidor envia uma lista sincronizada de links da sala.
 * Atualiza o estado local, remove cards obsoletos e solicita dados dos novos cards.
 * @param {Array<string>} roomLinks - Lista unificada de links da sala.
 */
function handleRoomSync(roomLinks) {
    console.log('[Main] Sincronizando estado da sala...');
    
    // 1. Persistência Local
    store.saveLinks(roomLinks);
    controls.renderLinkList();
    
    // 2. Limpeza Visual (Remove cards que não estão mais na lista)
    const allCards = document.querySelectorAll('.character-card');
    allCards.forEach(card => {
        if (!roomLinks.includes(card.dataset.link)) {
            card.remove();
        }
    });

    if (roomLinks.length > 0) {
        grid.removePlaceholder();
        
        // 3. Solicitação de Dados (CRUCIAL)
        // Ao receber novos links da sala, solicitamos a inscrição neles.
        // Isso faz o Gateway buscar o cache (ou agendar worker) e devolver DATA_UPDATE.
        api.subscribeToLinks(roomLinks);
    } else {
        grid.showPlaceholder();
    }
}

/**
 * Callback executado quando a entrada na sala é confirmada pelo servidor.
 * Atualiza a UI para o estado "Conectado em Sala".
 * @param {string} roomId - O ID da sala confirmada.
 */
function handleRoomJoined(roomId) {
    console.log(`[Main] Confirmado na sala: ${roomId}`);
    store.saveRoomId(roomId);
    controls.updateRoomUI(roomId);
}

/**
 * Trata erros operacionais de sala (ex: sala expirada ou não encontrada).
 * Realiza a limpeza do estado local para evitar loops de reconexão e alerta o usuário.
 * @param {Object} error - Objeto de erro retornado pelo servidor.
 * @param {string} error.code - Código do erro (ex: 'NOT_FOUND').
 */
function handleRoomError(error) {
    if (error.code === 'NOT_FOUND') {
        console.warn('[Main] Sala não encontrada. Resetando estado local.');
        alert(`Erro: A sala que você tentou entrar não existe mais.`);
        
        // Limpa o ID da sala do storage para parar de tentar reconectar no F5
        store.clearRoomId();
        // Reseta a UI para o modo "Solo"
        controls.updateRoomUI(null);
        
        // Mantém os links atuais em modo solo para não perder dados do usuário
        api.subscribeToLinks(store.getLinks());
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
      controls.renderLinkList();
      
      // Nota: Em implementações futuras, a reordenação pode ser sincronizada com a sala
    }
  });

  // 4. Fluxo de Dados e Rede
  loadDataFromCache(); 
  
  // Conecta passando TODOS os callbacks necessários
  api.connect(
      handleDataUpdate, 
      handleConnectionOpen, 
      handleRoomSync,
      handleRoomJoined,
      handleRoomError
  );
}

// Garante que o script só execute após todos os recursos estarem carregados
window.addEventListener('load', init);
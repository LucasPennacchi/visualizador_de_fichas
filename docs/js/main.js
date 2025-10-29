// js/main.js
import * as api from './api.js';
import * as store from './store.js';
import * as controls from './ui/controls.js';
import * as grid from './ui/grid.js';

// --- Elemento Principal ---
const gridElement = document.getElementById('dashboard-grid');

/**
 * Lógica principal para processar os dados recebidos (do cache ou do WebSocket).
 * @param {object[]} charactersData - Array de dados de personagens.
 */
function processBatchData(charactersData) {
    if (!charactersData || charactersData.length === 0) return;
    
    grid.removePlaceholder();
    const links = store.getLinks(); 

    for (const data of charactersData) {
        const link = data.originalUrl;
        // Garante que o card ainda está na lista de links
        if (!link || !links.includes(link)) continue; 

        let cardElement = gridElement.querySelector(`[data-link="${link}"]`);
        
        // 1. Cria o card se ele não existir
        if (!cardElement) {
            cardElement = grid.createNewCardElement(link);
        }
        
        // 2. Renderiza o card (seja com erro ou dados)
        if (data.error) {
            grid.renderErrorCard(cardElement, data);
        } else {
            // Se o card ainda não foi renderizado, cria o HTML
            if (!cardElement.hasAttribute('data-rendered')) {
                // (Esta função está no grid.js e preenche o innerHTML)
                grid.updateExistingCard(cardElement, data); 
                cardElement.setAttribute('data-rendered', 'true');
            } else {
                // Apenas atualiza os campos
                grid.updateExistingCard(cardElement, data);
            }
        }
    }
    
    // 3. Reordena os cards para bater com a lista do localStorage
    links.forEach(link => {
        const card = gridElement.querySelector(`[data-link="${link}"]`);
        if (card) gridElement.appendChild(card); 
    });
}

/**
 * Carrega os dados "velhos" do localStorage para um F5 rápido.
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

// --- Definição dos Callbacks ---

/**
 * (Callback para o api.js)
 * O que fazer quando o WebSocket envia novos dados.
 * @param {object[]} payload - Os dados dos personagens.
 */
function handleDataUpdate(payload) {
    store.saveCachedData(payload); // Salva no cache
    processBatchData(payload); // Renderiza na tela
}

/**
 * (Callback para o api.js)
 * O que fazer quando a conexão WebSocket é estabelecida.
 */
function handleConnectionOpen() {
    // Envia a lista de links que queremos "assistir"
    api.subscribeToLinks(store.getLinks());
}

/**
 * (Callback para o controls.js)
 * O que fazer quando o usuário adiciona novos links.
 * @param {string[]} newLinkList - A nova lista completa de links.
 */
function handleLinksAdded(newLinkList) {
    // 1. Re-inscreve no WebSocket com a nova lista
    api.subscribeToLinks(newLinkList);
    // 2. Remove o placeholder se for o primeiro link
    if (newLinkList.length > 0) {
        grid.removePlaceholder();
    }
}

/**
 * (Callback para o grid.js)
 * O que fazer quando o usuário clica no 'X' de um card.
 * @param {string} linkToDelete - O link do card a ser deletado.
 */
function handleDeleteLink(linkToDelete) {
    let links = store.getLinks();
    links = links.filter(l => l !== linkToDelete); 
    store.saveLinks(links); 
    
    controls.renderLinkList(); // Atualiza as "tags" no header
    grid.removeCard(linkToDelete); // Remove o card da tela
    
    // Notifica o servidor que não queremos mais este link
    api.subscribeToLinks(links); 
    
    if (links.length === 0) {
        grid.showPlaceholder();
    }
}


// --- INICIALIZAÇÃO DA APLICAÇÃO ---
function init() {
    // 1. Inicializa o header (toggle, input, botão 'Adicionar')
    // Passa o callback 'handleLinksAdded'
    controls.initializeControls(handleLinksAdded);
    
    // 2. Inicializa o grid (listeners de expandir, accordion, deletar)
    // Passa o callback 'handleDeleteLink'
    grid.initializeGrid(handleDeleteLink);

    // 3. Inicializa o Drag-and-Drop
    new Sortable(gridElement, {
        handle: '.card-drag-handle', animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
        onEnd: function (evt) {
            // Salva a nova ordem no localStorage
            let links = store.getLinks(); 
            const [movedItem] = links.splice(evt.oldIndex, 1);
            links.splice(evt.newIndex, 0, movedItem);
            store.saveLinks(links);
            controls.renderLinkList(); // Re-renderiza as tags na ordem
        }
    });

    // 4. Carrega os dados do cache para a tela
    loadDataFromCache();
    
    // 5. Inicia a conexão WebSocket
    // Passa os callbacks de 'onData' e 'onOpen'
    api.connect(handleDataUpdate, handleConnectionOpen);
}

// Inicia tudo
init();
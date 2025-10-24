import { getLinks, loadHeaderState } from './storage.js';
import { renderLinkList, togglePlaceholder } from './ui.js';
import { connect } from './websocket.js';
import { initializeAllListeners } from './events.js';
import { loadCachedData } from './cardManager.js'; // CORREÇÃO: Importado do cardManager

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega estado salvo (links, header)
    const links = getLinks();
    loadHeaderState();

    // 2. Renderiza a UI inicial
    renderLinkList();
    if (links.length === 0) {
        togglePlaceholder(true);
    } else {
        // 3. Carrega dados "velhos" do cache
        loadCachedData();
    }

    // 4. Inicializa todos os botões e drag-drop
    initializeAllListeners();

    // 5. Conecta ao servidor "ao vivo"
    connect();
});


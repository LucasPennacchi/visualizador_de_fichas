import { linkInput, addBtn, grid, toggleBtn, headerElement } from './domElements.js'; // 1. Corrigido: headerElement adicionado
import { getLinks, saveLinks, setHeaderState } from './storage.js';
import { renderLinkList, togglePlaceholder, removeCard } from './ui.js';
import { subscribeToLinks } from './websocket.js';

/* global Sortable */ // Informa ao linter que Sortable é global

function handleAddLink() {
    const input = linkInput.value.trim();
    if (!input) return;

    let linksToAdd = [];
    if (input.startsWith('[') && input.endsWith(']')) {
        // Modo Batch Add
        const linksString = input.slice(1, -1);
        linksToAdd = linksString.split(',')
            .map(link => link.trim())
            .filter(link => link);
    } else {
        // Modo Link Único
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
        togglePlaceholder(false); // Garante que o placeholder suma
        subscribeToLinks(existingLinks); // Envia a lista ATUALIZADA para o backend

        // 2. Corrigido: Removido o bloco de código redundante e com erro de sintaxe (linhas 41-52)
        // O backend agora é responsável por enviar os dados do novo link,
        // e o 'cardManager.processBatchData' irá criar o card.
    }

    linkInput.value = '';
}

function handleDeleteLink(e) {
    const deleteButton = e.target.closest('.card-delete-btn');
    if (deleteButton) {
        const linkToDelete = deleteButton.dataset.link;

        let links = getLinks();
        links = links.filter(l => l !== linkToDelete);

        saveLinks(links);
        renderLinkList();
        removeCard(linkToDelete);
        subscribeToLinks(links); // Envia a nova lista (menor)

        if (links.length === 0) {
            togglePlaceholder(true);
        }
    }
}

function handleSortEnd(evt) {
    let links = getLinks();
    // Move o item no array de links
    const [movedItem] = links.splice(evt.oldIndex, 1);
    links.splice(evt.newIndex, 0, movedItem);

    saveLinks(links);
    renderLinkList();
    // Não precisa enviar ao backend, só a ordem da UI mudou
}

/**
 * Inicializa todos os event listeners da aplicação
 */
export function initializeAllListeners() {
    addBtn.addEventListener('click', handleAddLink);

    toggleBtn.addEventListener('click', () => {
        // Isto agora funciona graças à importação corrigida na linha 1
        const isMinimized = headerElement.classList.contains('header-minimized');
        setHeaderState(!isMinimized); // Inverte
    });

    grid.addEventListener('click', handleDeleteLink);

    // Inicialização do Drag-and-Drop
    new Sortable(grid, {
        handle: '.card-drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: handleSortEnd
    });
}


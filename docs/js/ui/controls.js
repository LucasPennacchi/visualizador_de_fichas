// js/ui/controls.js
import { getLinks, saveLinks, getHeaderState, saveHeaderState } from '../store.js';
import { getCharacterIdFromUrl } from './utils.js';

// --- Variáveis do Módulo ---
let headerElement, toggleBtn, linkInput, addBtn, linkListContainer;
let onAddLinksCallback = null; 

// --- URL Base para normalização ---
const BASE_PORTRAIT_URL = "https://crisordemparanormal.com/agente/";

/**
 * Renderiza a lista de "tags" de links no header.
 */
export function renderLinkList() {
    linkListContainer.innerHTML = '';
    const links = getLinks();
    links.forEach((link) => {
        const tag = document.createElement('div');
        tag.className = 'link-tag';
        tag.innerHTML = `<span>...${link.slice(-40)}</span>`; 
        linkListContainer.appendChild(tag);
    });
}

/**
 * Define o estado do header (minimizado ou maximizado).
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
 * Recebe um input (link completo ou código) e retorna o link completo.
 * Retorna null se a entrada for inválida.
 */
function normalizeInputToUrl(input) {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
        return null; 
    }

    if (trimmedInput.toLowerCase().startsWith('http')) {
        try {
            new URL(trimmedInput); 
            return trimmedInput;
        } catch (e) {
            console.warn(`Entrada "${trimmedInput}" parece um URL, mas é inválido.`);
            return null; 
        }
    } 
    else if (/^[a-zA-Z0-9]+$/.test(trimmedInput)) { 
        return BASE_PORTRAIT_URL + trimmedInput;
    } 
    else {
        console.warn(`Entrada "${trimmedInput}" não reconhecida como URL ou código.`);
        return null; 
    }
}

/**
 * Lógica do botão "Adicionar Personagem".
 */
function handleAddClick() {
    const rawInput = linkInput.value.trim();
    if (!rawInput) return;
    
    let inputsToAdd = [];
    if (rawInput.startsWith('[') && rawInput.endsWith(']')) {
        const linksString = rawInput.slice(1, -1); 
        inputsToAdd = linksString.split(',') 
                               .map(link => link.trim()) 
                               .filter(link => link); 
    } else {
        inputsToAdd = [rawInput];
    }
    
    if (inputsToAdd.length === 0) return;
    
    const existingLinks = getLinks();
    // Cria um Set (lista de itens únicos) com os IDs dos links já existentes
    const existingIds = new Set(existingLinks.map(getCharacterIdFromUrl).filter(id => id));
    
    let addedCount = 0;

    inputsToAdd.forEach(input => {
        const normalizedUrl = normalizeInputToUrl(input);
        
        if (!normalizedUrl) {
            console.warn(`Item "${input}" ignorado por ser inválido.`);
            return; // Pula este item
        }

        // Pega o ID do novo URL normalizado
        const newId = getCharacterIdFromUrl(normalizedUrl);

        // Verifica se o ID é válido e se já não existe no Set
        if (newId && !existingIds.has(newId)) {
            existingLinks.push(normalizedUrl); // Adiciona o URL completo
            existingIds.add(newId); // Adiciona o novo ID ao Set para checagem futura
            addedCount++;
        } else if (existingIds.has(newId)) {
            console.log(`Personagem com ID "${newId}" já existe, ignorando.`);
        }
    });
    
    if (addedCount > 0) {
        saveLinks(existingLinks); 
        renderLinkList(); 
        
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

    // Listener do botão de minimizar/maximizar
    toggleBtn.addEventListener('click', () => {
        const isCurrentlyMinimized = headerElement.classList.contains('header-minimized');
        setHeaderState(!isCurrentlyMinimized);
    });
    
    // Listener do botão "Adicionar"
    addBtn.addEventListener('click', handleAddClick);

    linkInput.addEventListener('keydown', (event) => {
        // Verifica se a tecla pressionada foi "Enter"
        if (event.key === 'Enter') {
            event.preventDefault(); // Impede o comportamento padrão (como submeter um formulário)
            handleAddClick();     // Chama a mesma função do botão de clique
        }
    });

    // Carga inicial
    loadHeaderState();
    renderLinkList();
}
/**
 * @module UI/Combat
 * @description Gerencia o estado e a lógica do Modo de Combate.
 * Responsável pela interface de controle, gerenciamento da lista de iniciativa,
 * criação/remoção de Tokens e sincronização visual.
 * * @requires module:API
 */

import * as api from '../api.js';

// --- Estado Local (Cache) ---

/**
 * Objeto que armazena o estado atual do combate sincronizado com o servidor.
 * @type {Object}
 * @property {boolean} isActive - Indica se o modo de combate está ativado.
 * @property {number} round - O número da rodada atual.
 * @property {number} turnIndex - O índice do combatente ativo no array.
 * @property {Array<Object>} combatants - Lista ordenada de combatentes (Fichas e Tokens).
 */
let localState = {
    isActive: false,
    round: 1,
    turnIndex: -1,
    combatants: [] 
};

// --- Referências do DOM ---

/** @type {HTMLElement} Painel de controles de combate */
let controlsEl;
/** @type {HTMLElement} Display do número da rodada */
let roundDisplay;
/** @type {HTMLElement} Display do nome do personagem ativo */
let activeNameDisplay;

/** @type {HTMLElement} Botão Próximo Turno */
let nextBtn;
/** @type {HTMLElement} Botão Turno Anterior */
let prevBtn;
/** @type {HTMLElement} Botão Parar Combate */
let stopBtn;
/** @type {HTMLElement} Botão Iniciar Combate (Header) */
let startBtn;

// --- Funções Exportadas ---

/**
 * Inicializa o módulo de combate, capturando referências do DOM e
 * registrando os event listeners para os botões de controle.
 */
export function initializeCombat() {
    controlsEl = document.getElementById('combat-controls');
    roundDisplay = document.getElementById('combat-round');
    activeNameDisplay = document.getElementById('combat-active-name');
    
    nextBtn = document.getElementById('combat-next-btn');
    prevBtn = document.getElementById('combat-prev-btn');
    stopBtn = document.getElementById('combat-stop-btn');
    startBtn = document.getElementById('start-combat-btn');

    if (nextBtn) nextBtn.addEventListener('click', emitNextTurn);
    if (prevBtn) prevBtn.addEventListener('click', emitPrevTurn);
    if (stopBtn) stopBtn.addEventListener('click', emitStopCombat);
    if (startBtn) startBtn.addEventListener('click', emitStartCombat);

    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
        if (!localState.isActive) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowRight') { e.preventDefault(); emitNextTurn(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); emitPrevTurn(); }
    });
}

/**
 * Adiciona um Token de Ação Extra para um personagem específico.
 * Cria uma nova entrada na lista de combatentes e sincroniza com o servidor.
 * * @param {string} link - O identificador (URL) do personagem original.
 */
export function addCombatantToken(link) {
    if (!localState.isActive) return;

    const parentCard = document.querySelector(`.character-card[data-link="${link}"]:not(.action-token)`);
    const name = parentCard ? parentCard.querySelector('[data-field="name"]')?.innerText : "Token";

    const newToken = {
        link: link,
        name: name,
        isToken: true
    };

    const newState = { ...localState };
    newState.combatants.push(newToken);

    api.updateCombatState(newState);
}

/**
 * Remove um combatente específico baseado no seu índice visual na grade.
 * Usado para deletar Tokens individuais sem afetar o personagem principal.
 * * @param {number} index - O índice do card no grid.
 */
export function removeCombatantByIndex(index) {
    if (!localState.isActive) return;

    const newState = { ...localState };
    
    // Remove o item do array
    newState.combatants.splice(index, 1);

    // Ajusta o ponteiro de turno se necessário
    if (index < newState.turnIndex) {
        newState.turnIndex--;
    } else if (index === newState.turnIndex) {
        // Se removeu quem estava agindo, o turno passa para o próximo
        if (newState.turnIndex >= newState.combatants.length) {
            newState.turnIndex = 0;
            newState.round++;
        }
    }

    api.updateCombatState(newState);
}

/**
 * Remove TODOS os combatentes (Principal e Tokens) associados a um link.
 * Usado quando o card principal é excluído do sistema.
 * * @param {string} link - O link do personagem excluído.
 */
export function removeCombatantByLink(link) {
    if (localState.combatants.length === 0) return;

    const newState = { ...localState };
    
    // Filtra removendo tudo que tiver esse link
    const filteredList = newState.combatants.filter(c => c.link !== link);
    
    if (filteredList.length === newState.combatants.length) return;

    newState.combatants = filteredList;
    
    // Reseta turno se ficar inválido
    if (newState.turnIndex >= newState.combatants.length) {
        newState.turnIndex = -1;
    }

    api.updateCombatState(newState);
}

/**
 * Atualiza a ordem dos combatentes baseada na disposição atual do DOM.
 * Deve ser chamada quando o usuário realiza uma ação de Drag-and-Drop no Grid.
 */
export function updateOrderFromDOM() {
    if (!localState.isActive) return;
    
    const newState = { ...localState };
    newState.combatants = getCombatantsFromDOM(); 
    
    api.updateCombatState(newState);
}

/**
 * Recebe o estado atualizado do servidor e sincroniza a interface.
 * É o ponto único de verdade ("Source of Truth") para a renderização do combate.
 * * @param {Object} serverState - O estado do combate vindo do servidor.
 */
export function handleCombatSync(serverState) {
    if (!serverState) return;

    // Atualiza cache local
    localState = serverState;

    if (localState.isActive) {
        document.body.classList.add('combat-mode');
        if (controlsEl) controlsEl.classList.remove('hidden');
        
        // Sincroniza a ordem visual dos cards com o estado do servidor
        if (localState.combatants && localState.combatants.length > 0) {
             reorderDomByState(localState.combatants);
        }

        highlightCurrentTurn();
        updateDisplay();
    } else {
        document.body.classList.remove('combat-mode');
        if (controlsEl) controlsEl.classList.add('hidden');
        clearHighlights();
        
        document.querySelectorAll('.action-token').forEach(el => el.remove());
    }
}

// --- Emissores de Ação (Calculam Próximo Estado -> API) ---

function emitStartCombat() {
    const newState = { ...localState };
    newState.isActive = true;
    newState.round = 1;
    newState.turnIndex = -1;
    newState.combatants = getCombatantsFromDOM();
    api.updateCombatState(newState);
}

function emitStopCombat() {
    const newState = { ...localState };
    newState.isActive = false;
    newState.turnIndex = -1;
    newState.combatants = [];
    api.updateCombatState(newState);
}

function emitNextTurn() {
    if (!localState.isActive) return;
    const newState = { ...localState };
    newState.combatants = getCombatantsFromDOM();

    if (newState.combatants.length === 0) return;

    newState.turnIndex++;

    if (newState.turnIndex >= newState.combatants.length) {
        newState.turnIndex = 0;
        newState.round++;
    }

    api.updateCombatState(newState);
}

function emitPrevTurn() {
    if (!localState.isActive) return;
    const newState = { ...localState };
    newState.combatants = getCombatantsFromDOM();

    newState.turnIndex--;

    if (newState.turnIndex < 0) {
        if (newState.round > 1) {
            newState.round--;
            newState.turnIndex = newState.combatants.length - 1;
        } else {
            newState.turnIndex = 0;
        }
    }

    api.updateCombatState(newState);
}

// --- Helpers Internos ---

function getCombatantsFromDOM() {
    const cards = document.querySelectorAll('.character-card');
    return Array.from(cards).map(card => {
        const isToken = card.classList.contains('action-token');
        return {
            link: card.dataset.link,
            name: card.querySelector(isToken ? '.token-name' : '[data-field="name"]')?.innerText || "Desconhecido",
            isToken: isToken
        };
    });
}

function reorderDomByState(combatantsList) {
    const grid = document.getElementById('dashboard-grid');
    const existingMainCards = Array.from(grid.querySelectorAll('.character-card:not(.action-token)'));
    
    // Estratégia de Limpeza: Remove tokens antigos para evitar duplicação/desincronia
    grid.querySelectorAll('.action-token').forEach(el => el.remove());

    combatantsList.forEach((combatant, index) => {
        let cardNode = null;

        if (combatant.isToken) {
            // Criação de Token
            const mainCard = existingMainCards.find(c => c.dataset.link === combatant.link);
            if (mainCard) {
                const tokenElement = document.createElement('div');
                tokenElement.className = 'character-card action-token';
                tokenElement.dataset.link = combatant.link;
                
                const imgSrc = mainCard.querySelector('.card-portrait-img')?.src || '';
                
                tokenElement.innerHTML = `
                    <div class="card-grab-zone" title="Segure aqui para arrastar"></div>
                    <div class="card-inner-content">
                        <button class="card-delete-btn" data-link="${combatant.link}" title="Remover">X</button>
                        <div class="token-layout">
                            ${imgSrc ? `<img class="token-portrait" src="${imgSrc}">` : `<div class="token-portrait" style="background:#ddd">?</div>`}
                            <div class="token-info">
                                <div class="token-name">${combatant.name}</div>
                                <div class="token-type">Ação Extra</div>
                            </div>
                        </div>
                    </div>
                `;
                cardNode = tokenElement;
            }
        } else {
            // Recuperação de Card Principal
            cardNode = existingMainCards.find(c => c.dataset.link === combatant.link);
        }

        // Lógica de "Dirty Checking" para inserção segura no DOM
        if (cardNode) {
            const currentElementAtPosition = grid.children[index];
            if (currentElementAtPosition !== cardNode) {
                if (currentElementAtPosition) {
                    grid.insertBefore(cardNode, currentElementAtPosition);
                } else {
                    grid.appendChild(cardNode);
                }
            }
        }
    });
}

function highlightCurrentTurn() {
    clearHighlights();
    const current = localState.combatants[localState.turnIndex];
    if (!current) {
        if (activeNameDisplay) activeNameDisplay.innerText = "-";
        return;
    }
    const targets = document.querySelectorAll(`[data-link="${current.link}"]`);
    targets.forEach(el => {
        el.classList.add('active-turn');
        if (el === targets[0]) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (activeNameDisplay) activeNameDisplay.innerText = current.name;
}

function clearHighlights() {
    document.querySelectorAll('.active-turn').forEach(el => el.classList.remove('active-turn'));
}

function updateDisplay() {
    if (roundDisplay) roundDisplay.innerText = localState.round;
}
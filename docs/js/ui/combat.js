/**
 * @module UI/Combat
 * @description Gerencia o estado e a lógica do Modo de Combate.
 * Controla a ordem de iniciativa baseada puramente na posição visual (Drag-and-Drop),
 * contagem de rodadas, gerenciamento de turnos ativos, criação de Tokens de ação extra
 * e a sincronização visual do estado recebido do servidor.
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

    // Registra Listeners que disparam ações de rede
    if (nextBtn) nextBtn.addEventListener('click', emitNextTurn);
    if (prevBtn) prevBtn.addEventListener('click', emitPrevTurn);
    if (stopBtn) stopBtn.addEventListener('click', emitStopCombat);
    if (startBtn) startBtn.addEventListener('click', emitStartCombat);
}

/**
 * Adiciona um Token de Ação Extra para um personagem específico.
 * Cria uma nova entrada na lista de combatentes e sincroniza com o servidor.
 * O Token é inserido ao final da ordem atual.
 * * @param {string} link - O identificador (URL) do personagem original.
 */
export function addCombatantToken(link) {
    if (!localState.isActive) return;

    // Busca o card principal para extrair o nome e usar como referência visual
    const parentCard = document.querySelector(`.character-card[data-link="${link}"]:not(.action-token)`);
    const name = parentCard ? parentCard.querySelector('[data-field="name"]')?.innerText : "Token";

    // Cria objeto do Token
    const newToken = {
        link: link,
        name: name,
        isToken: true
    };

    // Atualiza estado local e propaga
    const newState = { ...localState };
    newState.combatants.push(newToken);

    api.updateCombatState(newState);
}

/**
 * Recebe o estado atualizado do servidor e sincroniza a interface.
 * É o ponto único de verdade ("Source of Truth") para a renderização do combate.
 * Gerencia a visibilidade da UI, a reordenação do Grid e o destaque do turno.
 * * @param {Object} serverState - O estado do combate vindo do servidor.
 */
export function handleCombatSync(serverState) {
    if (!serverState) return;

    // Atualiza cache local
    localState = serverState;

    if (localState.isActive) {
        // 1. Ativa modo visual de combate
        document.body.classList.add('combat-mode');
        if (controlsEl) controlsEl.classList.remove('hidden');
        
        // 2. Sincroniza a ordem visual dos cards com o estado do servidor
        if (localState.combatants && localState.combatants.length > 0) {
             reorderDomByState(localState.combatants);
        }

        // 3. Atualiza feedback de turno e rodada
        highlightCurrentTurn();
        updateDisplay();
    } else {
        // Desativa modo de combate e limpa a UI
        document.body.classList.remove('combat-mode');
        if (controlsEl) controlsEl.classList.add('hidden');
        clearHighlights();
        
        // Remove tokens visuais ao sair do combate
        document.querySelectorAll('.action-token').forEach(el => el.remove());
    }
}

// --- Emissores de Ação (Calculam Próximo Estado -> API) ---

/**
 * Inicia o combate.
 * Captura a ordem atual dos cards no DOM como a ordem inicial de iniciativa.
 */
function emitStartCombat() {
    const newState = { ...localState };
    newState.isActive = true;
    newState.round = 1;
    newState.turnIndex = -1;
    
    // A "verdade" inicial é a ordem visual que o mestre definiu antes de clicar em iniciar
    newState.combatants = getCombatantsFromDOM();
    
    api.updateCombatState(newState);
}

/**
 * Encerra o combate e limpa o estado no servidor.
 */
function emitStopCombat() {
    const newState = { ...localState };
    newState.isActive = false;
    newState.turnIndex = -1;
    newState.combatants = [];
    
    api.updateCombatState(newState);
}

/**
 * Avança para o próximo turno.
 * Recaptura a ordem do DOM antes de calcular, permitindo que o mestre
 * reordene (arraste) cards durante o combate e o "próximo" respeite a nova ordem.
 */
function emitNextTurn() {
    if (!localState.isActive) return;
    
    const newState = { ...localState };
    
    // Atualiza lista baseada no DOM atual (Sync dinâmico)
    newState.combatants = getCombatantsFromDOM();

    if (newState.combatants.length === 0) return;

    newState.turnIndex++;

    // Lógica de virada de rodada
    if (newState.turnIndex >= newState.combatants.length) {
        newState.turnIndex = 0;
        newState.round++;
    }

    api.updateCombatState(newState);
}

/**
 * Retorna ao turno anterior.
 * Também recaptura a ordem do DOM e gerencia o decremento de rodada.
 */
function emitPrevTurn() {
    if (!localState.isActive) return;

    const newState = { ...localState };
    newState.combatants = getCombatantsFromDOM();

    newState.turnIndex--;

    // Lógica de retorno de rodada
    if (newState.turnIndex < 0) {
        if (newState.round > 1) {
            newState.round--;
            newState.turnIndex = newState.combatants.length - 1;
        } else {
            newState.turnIndex = 0; // Trava no início da rodada 1
        }
    }

    api.updateCombatState(newState);
}

// --- Helpers Internos (DOM e Lógica Visual) ---

/**
 * Varre o DOM para reconstruir o array de estado dos combatentes baseado na ordem visual atual.
 * Identifica se um card é Principal ou Token.
 * * @returns {Array<Object>} Lista atual de combatentes na ordem visual.
 */
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

/**
 * Reconstrói a ordem visual do Grid baseada na lista do servidor.
 * Responsável por mover cards existentes e criar elementos HTML para Tokens
 * que ainda não existem no DOM local.
 * * @param {Array<Object>} combatantsList - Lista ordenada de combatentes vinda do servidor.
 */
function reorderDomByState(combatantsList) {
    const grid = document.getElementById('dashboard-grid');
    
    // Mapeia cards principais existentes para reutilização
    const existingMainCards = Array.from(grid.querySelectorAll('.character-card:not(.action-token)'));
    
    // Estratégia de Limpeza: Remove tokens antigos para evitar duplicação/desincronia
    grid.querySelectorAll('.action-token').forEach(el => el.remove());

    combatantsList.forEach(combatant => {
        if (combatant.isToken) {
            // --- Lógica de Renderização de Token ---
            // Busca dados visuais (imagem) do card principal correspondente
            const mainCard = existingMainCards.find(c => c.dataset.link === combatant.link);
            
            if (mainCard) {
                const tokenElement = document.createElement('div');
                tokenElement.className = 'character-card action-token';
                tokenElement.dataset.link = combatant.link;
                
                const imgSrc = mainCard.querySelector('.card-portrait-img')?.src || '';
                
                // HTML do Token (Compatível com design Window-like e Grab Zone)
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
                grid.appendChild(tokenElement);
            }
        } else {
            // --- Lógica de Card Principal ---
            // Apenas move o elemento existente para a nova posição no Grid
            const card = existingMainCards.find(c => c.dataset.link === combatant.link);
            if (card) {
                grid.appendChild(card);
            }
        }
    });
}

/**
 * Aplica o destaque visual (classe CSS) ao(s) personagem(ns) do turno atual.
 * Destaca todos os cards (Main + Tokens) que compartilham o mesmo link do combatente ativo.
 */
function highlightCurrentTurn() {
    clearHighlights();
    
    const currentCombatant = localState.combatants[localState.turnIndex];
    if (!currentCombatant) {
        if (activeNameDisplay) activeNameDisplay.innerText = "-";
        return;
    }

    // Seleciona todos os elementos DOM que correspondem ao ID do personagem ativo
    const targets = document.querySelectorAll(`[data-link="${currentCombatant.link}"]`);
    
    targets.forEach(el => {
        el.classList.add('active-turn');
        // Scroll suave apenas para o primeiro elemento encontrado (evita pulos)
        if (el === targets[0]) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    if (activeNameDisplay) activeNameDisplay.innerText = currentCombatant.name;
}

/**
 * Remove o destaque visual de todos os cards do grid.
 */
function clearHighlights() {
    document.querySelectorAll('.active-turn').forEach(el => el.classList.remove('active-turn'));
}

/**
 * Atualiza os displays de informação (contador de rodadas) na barra de ferramentas.
 */
function updateDisplay() {
    if (roundDisplay) roundDisplay.innerText = localState.round;
}
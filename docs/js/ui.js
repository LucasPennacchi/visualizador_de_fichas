import { grid, linkListContainer } from './domElements.js';

// --- Funções Helper Internas (Não exportadas) ---

function getStatusClass(valueString) {
    const [current, max] = (valueString || '0/0').split('/').map(Number);
    if (max === 0) return (current === 0) ? 'status-darkred' : '';
    if (current === 0) return 'status-darkred';
    const percentage = (current / max) * 100;
    if (percentage <= 5 || current === 1) return 'status-red';
    if (percentage <= 25) return 'status-orange';
    if (percentage <= 50) return 'status-yellow';
    return '';
}

function getLoadStatusClass(valueString) {
    const [current, max] = (valueString || '0/0').split('/').map(Number);
    if (max === 0 || current === 0) return '';
    const percentage = (current / max) * 100;
    if (percentage > 100) return 'status-darkred';
    if (percentage == 100) return 'status-red';
    if (percentage >= 75) return 'status-orange';
    if (percentage >= 50) return 'status-yellow';
    return '';
}

function updateText(element, newText) {
    if (element && element.innerText !== newText) element.innerText = newText;
}
function updateSrc(element, newSrc) {
    if (element && element.src !== newSrc) element.src = newSrc;
}

function updateStatusClass(element, newClass) {
    if (!element) return;
    const classes = ['status-yellow', 'status-orange', 'status-red', 'status-darkred'];
    classes.forEach(c => {
        if (c !== newClass && element.classList.contains(c)) element.classList.remove(c);
    });
    if (newClass && !element.classList.contains(newClass)) element.classList.add(newClass);
}

/**
 * Preenche o HTML de um card que acabou de ser criado.
 * @param {HTMLElement} cardElement - O elemento <div> do card.
 * @param {Object} data - O objeto de dados "achatado".
 */
function renderNewCardHTML(cardElement, data) {
    const hpClass = getStatusClass(data.hp);
    const sanClass = getStatusClass(data.sanity);
    const peClass = getStatusClass(data.effort);
    const loadClass = getLoadStatusClass(data.load);

    const pictureHtml = data.picture
        ? `<img class="card-portrait-img" src="${data.picture}" alt="Portrait" data-field="portrait">`
        : `<div class="card-portrait-placeholder" data-field="portrait">?</div>`;

    cardElement.innerHTML = `
        <div class="card-drag-handle" title="Mover"><svg width="18" height="18" viewBox="0 0 24 24" style="fill: #888;"><path d="M9 4C9 4.55228 8.55228 5 8 5C7.44772 5 7 4.55228 7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4ZM9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8C7 7.44772 7.44772 7 8 7C8.55228 7 9 7.44772 9 8ZM9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11C8.55228 11 9 11.4477 9 12ZM9 16C9 16.5523 8.55228 17 8 17C7.44772 17 7 16.5523 7 16C7 15.4477 7.44772 15 8 15C8.55228 15 9 15.4477 9 16ZM9 20C9 20.5523 8.55228 21 8 21C7.44772 21 7 20.5523 7 20C7 19.4477 7.44772 19 8 19C8.55228 19 9 19.4477 9 20ZM17 4C17 4.55228 16.5523 5 16 5C15.4477 5 15 4.55228 15 4C15 3.44772 15.4477 3 16 3C16.5523 3 17 3.44772 17 4ZM17 8C17 8.55228 16.5523 9 16 9C15.4477 9 15 8.55228 15 8C15 7.44772 15.4477 7 16 7C16.5523 7 17 7.44772 17 8ZM17 12C17 12.5523 16.5523 13 16 13C15.4477 13 15 12.5523 15 12C15 11.4477 15.4477 11 16 11C16.5523 11 17 11.4477 17 12ZM17 16C17 16.5523 16.5523 17 16 17C15.4477 17 15 16.5523 15 16C15 15.4477 15.4477 15 16 15C16.5523 15 17 15.4477 17 16ZM17 20C17 20.5523 16.5523 21 16 21C15.4477 21 15 20.5523 15 20C15 19.4477 15.4477 19 16 19C16.5523 19 17 19.4477 17 20Z"></path></svg></div>
        <button class="card-delete-btn" data-link="${data.originalUrl}" title="Remover Personagem">X</button>
        <div class="card-header">${pictureHtml}<div class="card-title"><h2 data-field="name">${data.name || 'Nome não encontrado'}</h2><span data-field="class-nex">${data.className} - ${data.nex}</span></div></div>
        <div class="stat"><span>Vida (PV):</span><span class="${hpClass}" data-field="hp">${data.hp || 'N/A'}</span></div>
        <div class="stat"><span>Sanidade (SAN):</span><span class="${sanClass}" data-field="san">${data.sanity || 'N/A'}</span></div>
        <div class="stat"><span>Esforço (PE):</span><span class="${peClass}" data-field="pe">${data.effort || 'N/A'}</span></div>
        <div class="extra-stats">
            <span class="stat-item">Esquiva: <span data-field="evade">${data.evade}</span></span>
            <span class="stat-item">Bloqueio: <span data-field="block">${data.block}</span></span>
            <span class="stat-item">Desl.: <span data-field="movement">${data.movement}m</span></span>
            <span class="stat-item">Carga: <span class="${loadClass}" data-field="load">${data.load}</span></span>
        </div>
    `;
    cardElement.setAttribute('data-rendered', 'true');
}

/**
 * Aplica atualizações (diff) a um card que já existe na tela.
 * @param {HTMLElement} cardElement - O elemento <div> do card.
 * @param {Object} data - O objeto de dados "achatado".
 */
function updateExistingCard(cardElement, data) {
    cardElement.classList.remove('card-status-dying', 'card-status-crazy');
    if (data.isDying) cardElement.classList.add('card-status-dying');
    else if (data.isCrazy) cardElement.classList.add('card-status-crazy');
    else cardElement.style.borderColor = '';

    const portraitEl = cardElement.querySelector('[data-field="portrait"]');
    if (portraitEl && portraitEl.tagName === 'IMG') updateSrc(portraitEl, data.picture);

    updateText(cardElement.querySelector('[data-field="name"]'), data.name);
    updateText(cardElement.querySelector('[data-field="class-nex"]'), `${data.className} - ${data.nex}`);
    updateText(cardElement.querySelector('[data-field="evade"]'), data.evade);
    updateText(cardElement.querySelector('[data-field="block"]'), data.block);
    updateText(cardElement.querySelector('[data-field="movement"]'), `${data.movement}m`);

    const hpEl = cardElement.querySelector('[data-field="hp"]');
    updateText(hpEl, data.hp); updateStatusClass(hpEl, getStatusClass(data.hp));

    const sanEl = cardElement.querySelector('[data-field="san"]');
    updateText(sanEl, data.sanity); updateStatusClass(sanEl, getStatusClass(data.sanity));

    const peEl = cardElement.querySelector('[data-field="pe"]');
    updateText(peEl, data.effort); updateStatusClass(peEl, getStatusClass(data.effort));

    const loadEl = cardElement.querySelector('[data-field="load"]');
    updateText(loadEl, data.load); updateStatusClass(loadEl, getLoadStatusClass(data.load));
}


// --- Funções Exportadas ---

/**
 * A função principal de renderização que o cardManager irá chamar.
 * Ela decide se cria um novo card ou atualiza um existente.
 */
export function createOrUpdateCard(originalUrl, data) {
    if (!originalUrl || !data) return;

    let cardElement = grid.querySelector(`[data-link="${originalUrl}"]`);

    if (!cardElement) {
        // 1. Criar
        cardElement = document.createElement('div');
        cardElement.className = 'character-card';
        cardElement.dataset.link = originalUrl;
        grid.appendChild(cardElement);
        renderNewCardHTML(cardElement, data); // Preenche o HTML
    }

    // 2. Atualizar (também roda na primeira vez)
    updateExistingCard(cardElement, data);

    // 3. Garantir que o placeholder está escondido
    togglePlaceholder(false);
}

/**
 * Remove um card da tela pelo seu link.
 * @param {string} link
 */
export function removeCard(link) {
    const cardToRemove = grid.querySelector(`[data-link="${link}"]`);
    if (cardToRemove) {
        cardToRemove.remove();
    }
}

/**
 * Mostra ou esconde o placeholder de "Adicione links..."
 * @param {boolean} show
 */
export function togglePlaceholder(show) {
    let placeholder = grid.querySelector('.card-placeholder');
    if (show) {
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder';
            placeholder.innerText = 'Adicione links de portrait para começar...';
            grid.innerHTML = ''; // Limpa o grid
            grid.appendChild(placeholder);
        }
    } else {
        if (placeholder) {
            placeholder.remove();
        }
    }
}

/**
 * Renderiza a lista de "tags" de links no header.
 * @param {Array<string>} links
 */
export function renderLinkList(links) {
    // CORREÇÃO: Garante que 'links' seja um array vazio se for 'undefined'
    const linksToRender = links || [];

    linkListContainer.innerHTML = '';
    linksToRender.forEach((link) => {
        const tag = document.createElement('div');
        tag.className = 'link-tag';
        // Encurta o link para exibição
        const shortLink = link.length > 50 ? link.substring(0, 50) + '...' : link;
        tag.innerHTML = `<span>${shortLink}</span>`;
        linkListContainer.appendChild(tag);
    });
}


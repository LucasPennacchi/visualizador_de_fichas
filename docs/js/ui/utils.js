// js/ui/utils.js

/**
 * Retorna a classe de CSS correta para os status (HP, SAN, PE).
 * @param {string} valueString - Ex: "10/20"
 * @returns {string} - Ex: "status-yellow"
 */
export function getStatusClass(valueString) {
    const [current, max] = (valueString || '0/0').split('/').map(Number);
    if (max === 0) return (current === 0) ? 'status-darkred' : '';
    if (current === 0) return 'status-darkred';
    const percentage = (current / max) * 100;
    if (percentage <= 5 || current === 1) return 'status-red';
    if (percentage <= 25) return 'status-orange';
    if (percentage <= 50) return 'status-yellow';
    return '';
}

/**
 * Retorna a classe de CSS correta para o status de Carga.
 * @param {string} valueString - Ex: "5/10"
 * @returns {string} - Ex: "status-yellow"
 */
export function getLoadStatusClass(valueString) {
    const [current, max] = (valueString || '0/0').split('/').map(Number);
    if (max === 0 || current === 0) return '';
    const percentage = (current / max) * 100;
    if (percentage > 100) return 'status-darkred';
    if (percentage == 100) return 'status-red';
    if (percentage >= 75) return 'status-orange';
    if (percentage >= 50) return 'status-yellow';
    return '';
}

/**
 * Atualiza o innerText de um elemento de forma eficiente,
 * apenas se o texto realmente mudou.
 * @param {HTMLElement} element - O elemento do DOM.
 * @param {string} newText - O novo texto.
 */
export function updateText(element, newText) {
    if (element && element.innerText !== newText) {
        element.innerText = newText;
    }
}

/**
 * Atualiza o 'src' de uma imagem de forma eficiente,
 * apenas se o 'src' realmente mudou.
 * @param {HTMLImageElement} element - O elemento <img>.
 * @param {string} newSrc - O novo URL da imagem.
 */
export function updateSrc(element, newSrc) {
    if (element && element.src !== newSrc) {
        element.src = newSrc;
    }
}

/**
 * Gerencia as classes de status (amarelo, vermelho, etc.) em um elemento.
 * @param {HTMLElement} element - O elemento do DOM.
 * @param {string} newClass - A nova classe para aplicar (ou '' para remover todas).
 */
export function updateStatusClass(element, newClass) {
    if (!element) return;
    const classes = ['status-yellow', 'status-orange', 'status-red', 'status-darkred'];
    
    // Remove classes antigas
    classes.forEach(c => {
        if (c !== newClass && element.classList.contains(c)) {
            element.classList.remove(c);
        }
    });
    
    // Adiciona a nova classe
    if (newClass && !element.classList.contains(newClass)) {
        element.classList.add(newClass);
    }
}
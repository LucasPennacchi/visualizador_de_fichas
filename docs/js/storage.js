import { LINKS_STORAGE_KEY, DATA_STORAGE_KEY, HEADER_STATE_KEY } from './config.js';
import { headerElement } from './domElements.js';

// --- Links ---
export function getLinks() {
    return JSON.parse(localStorage.getItem(LINKS_STORAGE_KEY)) || [];
}

export function saveLinks(links) {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
}

// --- Cache de Dados ---
export function getCachedData() {
    return JSON.parse(localStorage.getItem(DATA_STORAGE_KEY)) || [];
}

export function saveCachedData(data) {
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(data));
}

// --- Estado do Header ---
export function setHeaderState(isMinimized) {
    headerElement.classList.toggle('header-minimized', isMinimized);
    const state = isMinimized ? 'minimized' : 'maximized';
    localStorage.setItem(HEADER_STATE_KEY, state);
}

export function loadHeaderState() {
    const savedState = localStorage.getItem(HEADER_STATE_KEY);
    setHeaderState(savedState === 'minimized');
}

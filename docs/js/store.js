// js/store.js

const LINKS_STORAGE_KEY = 'gm_dashboard_links';
const DATA_STORAGE_KEY = 'gm_dashboard_data_cache';
const HEADER_STATE_KEY = 'gm_dashboard_header_state';

// --- Links ---
export function getLinks() {
  return JSON.parse(localStorage.getItem(LINKS_STORAGE_KEY)) || [];
}

export function saveLinks(links) {
  localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
}

// --- Dados (Cache) ---
export function getCachedData() {
  return JSON.parse(localStorage.getItem(DATA_STORAGE_KEY));
}

export function saveCachedData(data) {
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(data));
}

// --- Header State ---
export function getHeaderState() {
  return localStorage.getItem(HEADER_STATE_KEY);
}

export function saveHeaderState(state) {
  localStorage.setItem(HEADER_STATE_KEY, state);
}
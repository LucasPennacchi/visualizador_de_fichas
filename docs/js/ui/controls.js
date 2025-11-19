/**
 * @module UI/Controls
 * @description Gerencia a área de controles do usuário no cabeçalho da aplicação.
 * Responsável por capturar a entrada de novos links de personagens, normalizar
 * os dados inseridos, gerenciar a lista visual de links ativos e controlar
 * o estado de exibição (minimizado/maximizado) do painel.
 * * @requires module:Store
 * @requires module:UI/Utils
 */

import { getLinks, saveLinks, getHeaderState, saveHeaderState } from '../store.js';
import { getCharacterIdFromUrl } from './utils.js';

// --- Variáveis do Módulo (Estado Interno e Referências DOM) ---

/** @type {HTMLElement} Referência ao elemento <header> */
let headerElement;
/** @type {HTMLElement} Botão de alternar estado (toggle) */
let toggleBtn;
/** @type {HTMLInputElement} Campo de entrada de texto */
let linkInput;
/** @type {HTMLElement} Botão de adicionar */
let addBtn;
/** @type {HTMLElement} Contêiner da lista visual de links */
let linkListContainer;

/**
 * Callback para notificar o controlador principal sobre novos links.
 * @type {function(Array<string>): void}
 */
let onAddLinksCallback = null; 

// --- Constantes ---

/**
 * URL base padrão para construir links completos a partir de códigos/IDs.
 * @constant {string}
 */
const BASE_PORTRAIT_URL = "https://crisordemparanormal.com/agente/";

// --- Funções Exportadas ---

/**
 * Renderiza visualmente a lista de links monitorados como "tags" no cabeçalho.
 * Trunca links longos para manter a interface limpa.
 * Lê a fonte de verdade do módulo Store.
 */
export function renderLinkList() {
  linkListContainer.innerHTML = '';
  const links = getLinks();
  
  links.forEach((link) => {
    const tag = document.createElement('div');
    tag.className = 'link-tag';
    // Exibe apenas os últimos 40 caracteres para facilitar identificação visual de IDs/Hashs
    tag.innerHTML = `<span>...${link.slice(-40)}</span>`; 
    linkListContainer.appendChild(tag);
  });
}

/**
 * Inicializa o módulo de controles, configurando referências do DOM e Event Listeners.
 * * @param {function(Array<string>): void} onAddLinks - Função de callback executada quando novos links válidos são adicionados.
 */
export function initializeControls(onAddLinks) {
  // Captura referências do DOM
  headerElement = document.querySelector('header');
  toggleBtn = document.getElementById('toggle-header-btn');
  linkInput = document.getElementById('link-input');
  addBtn = document.getElementById('add-link-btn');
  linkListContainer = document.getElementById('link-list');
  
  onAddLinksCallback = onAddLinks;

  // Configura Event Listeners
  
  // 1. Toggle Minimizar/Maximizar
  toggleBtn.addEventListener('click', () => {
    const isCurrentlyMinimized = headerElement.classList.contains('header-minimized');
    setHeaderState(!isCurrentlyMinimized);
  });
  
  // 2. Adicionar via Clique
  addBtn.addEventListener('click', handleAddClick);

  // 3. Adicionar via Teclado (Enter)
  linkInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Previne submit de formulário padrão
      handleAddClick(); 
    }
  });

  // Estado Inicial
  loadHeaderState();
  renderLinkList();
}

// --- Funções Internas (Helpers) ---

/**
 * Altera o estado visual do cabeçalho e persiste a preferência.
 * * @param {boolean} isMinimized - Se true, aplica a classe de minimização.
 */
function setHeaderState(isMinimized) {
  headerElement.classList.toggle('header-minimized', isMinimized);
  saveHeaderState(isMinimized ? 'minimized' : 'maximized');
}

/**
 * Restaura o estado visual do cabeçalho baseado na preferência salva.
 */
function loadHeaderState() {
  const savedState = getHeaderState();
  setHeaderState(savedState === 'minimized');
}

/**
 * Normaliza e valida a entrada do usuário, convertendo códigos parciais em URLs completas.
 * Suporta URLs absolutas (http/https) e IDs alfanuméricos simples.
 * * @param {string} input - O texto bruto inserido pelo usuário.
 * @returns {string|null} A URL normalizada e válida, ou null se a entrada for inválida.
 */
function normalizeInputToUrl(input) {
  const trimmedInput = input.trim();
  
  if (!trimmedInput) return null; 

  // Caso 1: URL Completa
  if (trimmedInput.toLowerCase().startsWith('http')) {
    try {
      new URL(trimmedInput); // Validação básica de formato URL
      return trimmedInput;
    } catch (e) {
      console.warn(`Entrada "${trimmedInput}" parece um URL, mas é inválido.`);
      return null; 
    }
  } 
  // Caso 2: Código/ID (Alfanumérico)
  else if (/^[a-zA-Z0-9]+$/.test(trimmedInput)) { 
    return BASE_PORTRAIT_URL + trimmedInput;
  } 
  // Caso 3: Inválido
  else {
    console.warn(`Entrada "${trimmedInput}" não reconhecida como URL ou código.`);
    return null; 
  }
}

/**
 * Manipulador do evento de adição de links.
 * Processa a entrada (única ou lista), normaliza, remove duplicatas,
 * persiste os novos dados e notifica o callback externo.
 */
function handleAddClick() {
  const rawInput = linkInput.value.trim();
  if (!rawInput) return;
  
  let inputsToAdd = [];
  
  // Suporte a entrada de array estilo JSON: [link1, link2]
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
  
  // Cria um Set de IDs existentes para verificação rápida de duplicatas (O(1))
  const existingIds = new Set(existingLinks.map(getCharacterIdFromUrl).filter(id => id));
  
  let addedCount = 0;

  inputsToAdd.forEach(input => {
    const normalizedUrl = normalizeInputToUrl(input);
    
    if (!normalizedUrl) {
      console.warn(`Item "${input}" ignorado por ser inválido.`);
      return;
    }

    const newId = getCharacterIdFromUrl(normalizedUrl);

    // Adiciona apenas se o ID for válido e ainda não existir na lista
    if (newId && !existingIds.has(newId)) {
      existingLinks.push(normalizedUrl);
      existingIds.add(newId);
      addedCount++;
    } else if (existingIds.has(newId)) {
      console.log(`Personagem com ID "${newId}" já existe, ignorando.`);
    }
  });
  
  if (addedCount > 0) {
    saveLinks(existingLinks); 
    renderLinkList(); 
    
    // Notifica o controlador principal para iniciar o monitoramento
    if (onAddLinksCallback) {
      onAddLinksCallback(existingLinks); 
    }
  }
  
  linkInput.value = ''; // Limpa o campo para nova entrada
}
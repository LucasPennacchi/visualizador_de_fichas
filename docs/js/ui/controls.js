/**
 * @module UI/Controls
 * @description Gerencia a área de controles do usuário no cabeçalho.
 * Responsável pela entrada de links de personagens e gerenciamento de sessões de Sala (Campanha).
 * Controla o estado visual dos inputs (bloqueado/desbloqueado) baseado na conexão com a sala.
 */

import { getLinks, saveLinks, getHeaderState, saveHeaderState, getRoomId, saveRoomId, clearRoomId } from '../store.js';
import { getCharacterIdFromUrl } from './utils.js';
import * as api from '../api.js';

// --- Variáveis do Módulo ---

let headerElement;
let toggleBtn;
let linkInput;
let addBtn;
let linkListContainer;

// Controles de Sala
let roomInput;
let joinRoomBtn;
let createRoomBtn;
let leaveRoomBtn;

/**
 * Callback para notificar o controlador principal.
 * @type {function(Array<string>): void}
 */
let onAddLinksCallback = null; 

const BASE_PORTRAIT_URL = "https://crisordemparanormal.com/agente/";

// --- Funções Exportadas ---

/**
 * Renderiza visualmente a lista de links monitorados.
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
 * Atualiza o estado visual da UI de Sala.
 * Chamado quando o app inicia ou quando uma confirmação de entrada em sala é recebida.
 * @param {string|null} roomId - O ID da sala atual ou null se desconectado.
 */
export function updateRoomUI(roomId) {
  if (roomId) {
    // Estado: Conectado em Sala
    roomInput.value = roomId;
    roomInput.disabled = true; // Bloqueia edição
    joinRoomBtn.classList.add('hidden');
    createRoomBtn.classList.add('hidden');
    leaveRoomBtn.classList.remove('hidden');
  } else {
    // Estado: Desconectado / Modo Solo
    roomInput.value = '';
    roomInput.disabled = false;
    joinRoomBtn.classList.remove('hidden');
    createRoomBtn.classList.remove('hidden');
    leaveRoomBtn.classList.add('hidden');
  }
}

/**
 * Inicializa o módulo de controles.
 * @param {function(Array<string>): void} onAddLinks - Callback para adição de links.
 */
export function initializeControls(onAddLinks) {
  // Referências DOM - Fichas
  headerElement = document.querySelector('header');
  toggleBtn = document.getElementById('toggle-header-btn');
  linkInput = document.getElementById('link-input');
  addBtn = document.getElementById('add-link-btn');
  linkListContainer = document.getElementById('link-list');
  
  // Referências DOM - Sala
  roomInput = document.getElementById('room-input');
  joinRoomBtn = document.getElementById('join-room-btn');
  createRoomBtn = document.getElementById('create-room-btn');
  leaveRoomBtn = document.getElementById('leave-room-btn');

  onAddLinksCallback = onAddLinks;

  // --- Event Listeners ---

  toggleBtn.addEventListener('click', () => {
    const isCurrentlyMinimized = headerElement.classList.contains('header-minimized');
    setHeaderState(!isCurrentlyMinimized);
  });
  
  addBtn.addEventListener('click', handleAddClick);

  linkInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddClick(); 
    }
  });

  // Listeners de Sala
  joinRoomBtn.addEventListener('click', handleJoinRoom);
  createRoomBtn.addEventListener('click', handleCreateRoom);
  leaveRoomBtn.addEventListener('click', handleLeaveRoom);
  
  // Atalho Enter no input da sala
  roomInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleJoinRoom();
    }
  });

  // Estado Inicial
  loadHeaderState();
  renderLinkList();
  
  // Restaura estado da sala (se houver persistência)
  const savedRoomId = getRoomId();
  if (savedRoomId) {
    updateRoomUI(savedRoomId);
  }
}

// --- Funções Internas (Handlers de Eventos) ---

/**
 * Lida com a ação de Criar Sala.
 * Envia os links atuais para o servidor criar a sala e realizar o merge.
 */
function handleCreateRoom() {
  const currentLinks = getLinks();
  api.createRoom(currentLinks);
  // A UI será atualizada apenas quando o callback 'onRoomJoined' vier do servidor (via main.js)
}

/**
 * Lida com a ação de Entrar em Sala.
 */
function handleJoinRoom() {
  const roomId = roomInput.value.trim();
  if (!roomId) return;

  const currentLinks = getLinks();
  api.joinRoom(roomId, currentLinks);
  // A UI será atualizada pelo callback do servidor
}

/**
 * Lida com a ação de Sair da Sala.
 * Limpa o estado local imediatamente.
 */
function handleLeaveRoom() {
  api.leaveRoom();
  clearRoomId();
  updateRoomUI(null);
}

// --- Funções Auxiliares de Ficha (Mantidas) ---

function setHeaderState(isMinimized) {
  headerElement.classList.toggle('header-minimized', isMinimized);
  saveHeaderState(isMinimized ? 'minimized' : 'maximized');
}

function loadHeaderState() {
  const savedState = getHeaderState();
  setHeaderState(savedState === 'minimized');
}

function normalizeInputToUrl(input) {
  const trimmedInput = input.trim();
  if (!trimmedInput) return null; 

  if (trimmedInput.toLowerCase().startsWith('http')) {
    try {
      new URL(trimmedInput); 
      return trimmedInput;
    } catch (e) {
      console.warn(`Entrada "${trimmedInput}" inválida.`);
      return null; 
    }
  } 
  else if (/^[a-zA-Z0-9]+$/.test(trimmedInput)) { 
    return BASE_PORTRAIT_URL + trimmedInput;
  } 
  else {
    console.warn(`Entrada "${trimmedInput}" não reconhecida.`);
    return null; 
  }
}

function handleAddClick() {
  const rawInput = linkInput.value.trim();
  if (!rawInput) return;
  
  let inputsToAdd = [];
  
  if (rawInput.startsWith('[') && rawInput.endsWith(']')) {
    const linksString = rawInput.slice(1, -1); 
    inputsToAdd = linksString.split(',').map(link => link.trim()).filter(link => link); 
  } else {
    inputsToAdd = [rawInput];
  }
  
  if (inputsToAdd.length === 0) return;
  
  const existingLinks = getLinks();
  const existingIds = new Set(existingLinks.map(getCharacterIdFromUrl).filter(id => id));
  
  let addedCount = 0;

  inputsToAdd.forEach(input => {
    const normalizedUrl = normalizeInputToUrl(input);
    if (!normalizedUrl) return;

    const newId = getCharacterIdFromUrl(normalizedUrl);

    if (newId && !existingIds.has(newId)) {
      existingLinks.push(normalizedUrl);
      existingIds.add(newId);
      addedCount++;
    } else if (existingIds.has(newId)) {
      console.log(`Personagem ${newId} já existe.`);
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
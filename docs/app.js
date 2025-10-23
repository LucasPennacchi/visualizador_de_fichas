document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS E CONSTANTES ---
    const headerElement = document.querySelector('header'); // O <header> principal
    const toggleBtn = document.getElementById('toggle-header-btn'); // O botão +/-
    const HEADER_STATE_KEY = 'gm_dashboard_header_state'; // Chave do localStorage
    const linkInput = document.getElementById('link-input');
    const addBtn = document.getElementById('add-link-btn');
    const grid = document.getElementById('dashboard-grid');
    const linkListContainer = document.getElementById('link-list');
    
    const LINKS_STORAGE_KEY = 'gm_dashboard_links';
    const DATA_STORAGE_KEY = 'gm_dashboard_data_cache';

    /**
     * Define o estado do header (minimizado ou maximizado)
     * @param {boolean} isMinimized 
     */
    function setHeaderState(isMinimized) {
        // A função 'toggle' com o segundo argumento faz o if/else para nós
        headerElement.classList.toggle('header-minimized', isMinimized);

        // REMOVEMOS A LINHA QUE ADICIONAVA 'dashboard-compact' AO BODY
        // document.body.classList.toggle('dashboard-compact', isMinimized); // REMOVA/COMENTE ISSO

        if (isMinimized) {
            localStorage.setItem(HEADER_STATE_KEY, 'minimized');
        } else {
            localStorage.setItem(HEADER_STATE_KEY, 'maximized');
        }
    }

    // Event listener para o botão de toggle
    toggleBtn.addEventListener('click', () => {
        const isCurrentlyMinimized = headerElement.classList.contains('header-minimized');
        setHeaderState(!isCurrentlyMinimized); // Inverte o estado
    });

    /**
     * Carrega o estado salvo do header ao iniciar a página
     */
    function loadHeaderState() {
        const savedState = localStorage.getItem(HEADER_STATE_KEY);
        // Por padrão, começa maximizado
        if (savedState === 'minimized') {
            setHeaderState(true);
        } else {
            setHeaderState(false);
        }
    }
    
    // --- LÓGICA DO WEBSOCKET ---
    let socket = null;
    
    /**
     * Descobre qual endereço de WebSocket usar.
     * 1. Procura por um parâmetro '?ws=...' na URL.
     * 2. Se não achar, usa 'localhost:3000' como padrão (para testes locais).
     */
    function getWebSocketUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const wsHost = urlParams.get('ws'); // Pega o valor de "?ws=..."

        if (wsHost) {
            // Se foi passado um ?ws=... (ex: link.ngrok-free.dev)
            // Usamos wss:// (WebSocket Seguro)
            console.log(`[WebSocket] Usando host externo (via URL param): ${wsHost}`);
            return `wss://${wsHost}`;
        } else {
            // Se não foi passado, assume que estamos rodando localmente
            console.log("[WebSocket] Usando host local (localhost:3000)");
            return 'ws://localhost:3000';
        }
    }

    const WSS_URL = getWebSocketUrl();

    function connect() {
        console.log(`[WebSocket] Conectando ao servidor: ${WSS_URL}...`);
        socket = new WebSocket(WSS_URL); // Usa a URL dinâmica

        // 1. O que fazer quando a conexão é aberta
        socket.onopen = () => {
            console.log('[WebSocket] Conectado!');
            // Envia a lista de links que queremos "assistir"
            subscribeToLinks(getLinks());
        };

        // 2. O que fazer quando o SERVIDOR envia uma mensagem
        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                // O servidor enviou uma atualização de dados
                if (message.type === 'DATA_UPDATE' && message.payload) {
                    console.log(`[WebSocket] Recebidos ${message.payload.length} updates.`);
                    // Salva os dados no cache local (para o F5)
                    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(message.payload));
                    // Renderiza as mudanças na tela
                    processBatchData(message.payload);
                }
            } catch (e) {
                console.error('[WebSocket] Erro ao processar mensagem:', e);
            }
        };

        // 3. O que fazer quando a conexão cai
        socket.onclose = () => {
            console.warn('[WebSocket] Desconectado. Tentando reconectar em 5 segundos...');
            socket = null;
            // Tenta reconectar após 5 segundos
            setTimeout(connect, 5000);
        };

        // 4. Lidar com erros
        socket.onerror = (err) => {
            console.error('[WebSocket] Erro na conexão:', err);
            socket.close(); // Força o onclose a rodar e tentar reconectar
        };
    }

    /**
     * Envia a lista de links para o servidor "assistir"
     */
    function subscribeToLinks(links) {
        if (socket && socket.readyState === socket.OPEN) {
            console.log(`[WebSocket] Enviando ${links.length} links para assinatura...`);
            socket.send(JSON.stringify({
                type: 'SUBSCRIBE_LINKS',
                payload: links
            }));
        } else {
            console.warn('[WebSocket] Não conectado. Inscrição falhou.');
        }
    }

    // --- FUNÇÕES DE DADOS (Modificadas) ---
    function getLinks() {
        return JSON.parse(localStorage.getItem(LINKS_STORAGE_KEY)) || [];
    }
    function saveLinks(links) {
        localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
    }

    // ADICIONAR: Agora envia um update para o WebSocket
    addBtn.addEventListener('click', () => {
        const input = linkInput.value.trim();
        if (!input) return;
        let linksToAdd = [];
        if (input.startsWith('[') && input.endsWith(']')) {
            const linksString = input.slice(1, -1);
            linksToAdd = linksString.split(',').map(link => link.trim()).filter(link => link);
        } else {
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
            // AVISA O SERVIDOR sobre a nova lista de links
            subscribeToLinks(existingLinks); 
        }
        linkInput.value = '';
    });

    // DELETAR: Agora envia um update para o WebSocket
    grid.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.card-delete-btn');
        if (deleteButton) {
            const linkToDelete = deleteButton.dataset.link;
            deleteLink(linkToDelete);
        }
    });
    function deleteLink(linkToDelete) {
        let links = getLinks();
        links = links.filter(l => l !== linkToDelete); 
        saveLinks(links); 
        renderLinkList(); 
        
        // Remove o card da tela IMEDIATAMENTE
        const cardToRemove = grid.querySelector(`[data-link="${linkToDelete}"]`);
        if (cardToRemove) {
            cardToRemove.remove();
        }
        // AVISA O SERVIDOR sobre a nova lista de links
        subscribeToLinks(links); 
        // Se a lista de links ficou vazia, mostra o placeholder
        if (links.length === 0) {
            grid.innerHTML = '<div class="card-placeholder">Adicione links de portrait para começar...</div>';
        }
    }
    
    // renderLinkList
    function renderLinkList() {
        linkListContainer.innerHTML = '';
        const links = getLinks();
        links.forEach((link) => {
            const tag = document.createElement('div');
            tag.className = 'link-tag';
            tag.innerHTML = `<span>${link.substring(0, 40)}...</span>`;
            linkListContainer.appendChild(tag);
        });
    }

    // --- FUNÇÕES DE COR (getStatusClass, getLoadStatusClass) ---
    // (Omitidas por brevidade, elas não mudam)
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

    // --- FUNÇÕES DE RENDERIZAÇÃO (updateText, updateSrc, etc.) ---
    // (Omitidas por brevidade, elas não mudam)
    function updateText(element, newText) { if (element && element.innerText !== newText) element.innerText = newText; }
    function updateSrc(element, newSrc) { if (element && element.src !== newSrc) element.src = newSrc; }
    function updateStatusClass(element, newClass) { if (!element) return; const classes = ['status-yellow', 'status-orange', 'status-red', 'status-darkred']; classes.forEach(c => { if (c !== newClass && element.classList.contains(c)) element.classList.remove(c); }); if (newClass && !element.classList.contains(newClass)) element.classList.add(newClass); }
    function renderNewCardHTML(cardElement, data) {
        const hpClass = getStatusClass(data.hp); const sanClass = getStatusClass(data.sanity); const peClass = getStatusClass(data.effort); const loadClass = getLoadStatusClass(data.load);
        const pictureHtml = data.picture ? `<img class="card-portrait-img" src="${data.picture}" alt="Portrait" data-field="portrait">` : `<div class="card-portrait-placeholder" data-field="portrait">?</div>`;
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
    
    // --- FUNÇÕES DE LÓGICA DE DADOS ---
    function processBatchData(charactersData) {
        if (!charactersData || charactersData.length === 0) return;
        const placeholder = grid.querySelector('.card-placeholder');
        if (placeholder) placeholder.remove();
        const links = getLinks(); 
        for (const data of charactersData) {
            const link = data.originalUrl;
            if (!link || !links.includes(link)) continue; 
            let cardElement = grid.querySelector(`[data-link="${link}"]`);
            if (!cardElement) {
                cardElement = document.createElement('div');
                cardElement.className = 'character-card';
                cardElement.dataset.link = link; 
                grid.appendChild(cardElement);
            }
            if (data.error) {
                cardElement.innerHTML = `<button class="card-delete-btn" data-link="${link}" title="Remover Personagem">X</button><h2>Erro ao carregar</h2><p>${data.error}</p><small>${link}</small>`;
                cardElement.style.borderColor = '#dc3545';
            } else {
                if (!cardElement.hasAttribute('data-rendered')) {
                    renderNewCardHTML(cardElement, data);
                }
                updateExistingCard(cardElement, data);
            }
        }
        links.forEach(link => {
            const card = grid.querySelector(`[data-link="${link}"]`);
            if (card) grid.appendChild(card); 
        });
    }
    function loadCachedData() {
        const links = getLinks();
        if (links.length === 0) {
            grid.innerHTML = '<div class="card-placeholder">Adicione links de portrait para começar...</div>';
            return;
        }
        const placeholder = grid.querySelector('.card-placeholder');
        if (placeholder) placeholder.remove();
        const cachedData = JSON.parse(localStorage.getItem(DATA_STORAGE_KEY));
        if (cachedData && cachedData.length > 0) {
            console.log(`[Cache Cliente] Carregando ${cachedData.length} cards "velhos" do localStorage...`);
            processBatchData(cachedData);
        }
    }

    // --- LÓGICA DE CARGA INICIAL ---
    
    // Inicialização do Drag-and-Drop
    new Sortable(grid, {
        handle: '.card-drag-handle', animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
        onEnd: function (evt) {
            let links = getLinks(); 
            const [movedItem] = links.splice(evt.oldIndex, 1);
            links.splice(evt.newIndex, 0, movedItem);
            saveLinks(links);
            renderLinkList();
        }
    });
    
    // 1. Renderiza os "tags"
    renderLinkList();
    // 2. Renderiza os cards "velhos" do cache
    loadCachedData();
    // 3. Inicia a conexão "ao vivo"
    connect(); 
    
    // O setInterval(fetchAllPortraits) foi REMOVIDO.
});
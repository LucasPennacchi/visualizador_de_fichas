/**
 * @module Lib/ImporterTemplate
 * @description Contém o template do script de automação para o CRIS.
 * Retorna o código fonte completo como uma string para ser copiada para a área de transferência.
 * Versão Atualizada: Usa 'statsClass' para seleção no Wizard e 'className' para o Header.
 */

/**
 * Gera o código do script de importação com o ID do personagem injetado.
 * @param {string} targetCharId - O ID da ficha que será clonada.
 * @returns {string} O código JavaScript completo.
 */
export function getImporterScript(targetCharId) {
    return `
(async function() {
    const TARGET_ID = "${targetCharId}"; 
    console.clear();
    console.log("%c🤖 IMPORTADOR VIA DASHBOARD INICIADO", "color: #fff; background: #6f42c1; font-weight: bold; font-size: 14px; padding: 6px;");

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function waitForElement(selector, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await wait(200);
        }
        console.warn(\`⚠️ Timeout esperando: \${selector}\`);
        return null;
    }

    async function setAndVerify(element, targetValue) {
        if (!element) return false;
        let attempts = 0;
        while (String(element.value) != String(targetValue) && attempts < 10) {
            element.value = targetValue;
            const tracker = element._valueTracker;
            if (tracker) tracker.setValue(element.value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            await wait(150);
            attempts++;
        }
        return String(element.value) === String(targetValue);
    }

    async function clickAndVerifyText(buttonElement, targetText, optionsSelector) {
        if (!buttonElement || buttonElement.innerText.trim() === targetText) return true;
        buttonElement.click(); 
        await wait(200);
        const container = buttonElement.parentElement;
        const options = container.querySelectorAll(optionsSelector);
        let clicked = false;
        for (const opt of options) {
            if (opt.innerText.trim() === targetText) {
                opt.click();
                clicked = true;
                break;
            }
        }
        if (!clicked) buttonElement.click();
        await wait(200);
        return true;
    }

    function parseFirestore(fields) {
        const obj = {};
        for (const key in fields) {
            const valueMap = fields[key];
            const type = Object.keys(valueMap)[0];
            let val = valueMap[type];
            if (type === 'integerValue') val = parseInt(val);
            else if (type === 'doubleValue') val = parseFloat(val);
            else if (type === 'booleanValue') val = val;
            else if (type === 'mapValue') val = parseFirestore(val.fields || {});
            else if (type === 'arrayValue') {
                val = (val.values || []).map(v => {
                    const tempKey = Object.keys(v)[0];
                    if(tempKey === 'mapValue') return parseFirestore(v.mapValue.fields);
                    return v[tempKey];
                });
            }
            obj[key] = val;
        }
        return obj;
    }

    async function fetchCharacterData(charId) {
        const url = \`https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/\${charId}\`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("ID inválido.");
            return parseFirestore((await response.json()).fields);
        } catch (e) {
            console.error("Erro ao buscar ID:", e); return null;
        }
    }

    async function runWizard(char, wizardTabs) {
        console.log("⚡ Executando Wizard...");
        
        // Origem
        wizardTabs[1].click(); await wait(1000);
        const origins = document.querySelectorAll('.background .title');
        let originFound = false;
        for (const h3 of origins) {
            if (h3.innerText.trim().toLowerCase() === char.backgroundName?.toLowerCase()) {
                h3.closest('.card-gray')?.querySelector('button')?.click();
                originFound = true; break;
            }
        }
        if (!originFound) {
            const firstBtn = document.querySelector('.background button');
            if(firstBtn) firstBtn.click();
        }
        
        // --- CLASSE (Alterado para usar statsClass) ---
        wizardTabs[2].click(); await wait(1000);
        const classes = document.querySelectorAll('.classes-flex h1');
        let classFound = false;
        
        // Usa statsClass para a lógica mecânica de seleção. 
        // Se não existir, tenta className como fallback antes de desistir.
        const targetClass = char.statsClass || char.className;

        for (const h1 of classes) {
            if (h1.innerText.trim().toLowerCase() === targetClass?.toLowerCase()) {
                h1.closest('.classes-flex > div')?.querySelector('.footer button')?.click();
                classFound = true; break;
            }
        }
        // Fallback: Se não achou (ou statsClass estava vazio), pega a primeira (Combatente)
        if (!classFound) {
            console.warn(\`⚠️ Classe "\${targetClass}" não encontrada. Selecionando padrão.\`);
            const firstClassBtn = document.querySelector('.classes-flex .footer button');
            if(firstClassBtn) firstClassBtn.click();
        }

        // Detalhes
        wizardTabs[3].click(); await wait(800);
        const nameInput = document.querySelector('input[placeholder="Nome do personagem"]');
        const playerInput = document.querySelector('input[placeholder="Nome do jogador"]');
        if (nameInput) await setAndVerify(nameInput, char.name);
        if (playerInput) await setAndVerify(playerInput, char.player || char.uid);

        const finishBtn = document.querySelector('.finish-button');
        if (finishBtn) {
            finishBtn.click();
            await waitForElement('.character-sheet', 25000);
            await wait(2000);
        }
    }

    async function updateHeaderInfo(char) {
        const headerRows = document.querySelectorAll('.header-info-row .info-line');
        for (const row of headerRows) {
            const label = row.querySelector('h3')?.innerText.trim();
            const input = row.querySelector('input');
            if (label === 'ORIGEM' && input) await setAndVerify(input, char.backgroundName);
            // Aqui mantemos char.className para o texto visual da ficha
            else if (label === 'CLASSE' && input) await setAndVerify(input, char.className);
            else if (label === 'PERSONAGEM' && input) await setAndVerify(input, char.name);
        }
    }

    async function updateAttributesAndStats(char) {
        const editBtn = document.querySelector('.sheet-stats .change-button');
        if (editBtn) {
            editBtn.click(); await wait(300);
            const map = { 'str': char.attributes.str, 'dex': char.attributes.dex, 'int': char.attributes.int, 'con': char.attributes.con, 'pre': char.attributes.pre };
            for (const [attr, value] of Object.entries(map)) {
                let input = document.querySelector(\`.sheet-stats-container input.\${attr}\`);
                if (input) await setAndVerify(input, value);
            }
            editBtn.click(); await wait(500);
        }
        
        // NEX
        const nexContainer = document.querySelector('.nex-container');
        if (nexContainer) {
            const currentNexBtn = nexContainer.querySelector('.dropdown-button');
            const targetNex = char.nex || char.nexString;
            if (currentNexBtn && targetNex && currentNexBtn.innerText.trim() !== targetNex) {
                await clickAndVerifyText(currentNexBtn, targetNex, '.dropdown-content-button');
            }
        }

        // Barras
        const bars = document.querySelectorAll('.info-bar-container');
        for (const bar of bars) {
            const label = bar.querySelector('.info-bar-label')?.innerText.trim();
            const inputs = bar.querySelectorAll('input');
            if (inputs.length < 2) continue;
            if (label === 'VIDA') { await setAndVerify(inputs[0], char.currentPv); await setAndVerify(inputs[1], char.maxPv); }
            if (label === 'SANIDADE') { await setAndVerify(inputs[0], char.currentSan); await setAndVerify(inputs[1], char.maxSan); }
            if (label === 'ESFORÇO') { await setAndVerify(inputs[0], char.currentPe); await setAndVerify(inputs[1], char.maxPe); }
        }
    }

    async function updateSkills(char) {
        console.log("🎲 Atualizando Perícias...");
        if (!char.skills) return;
        const rows = document.querySelectorAll('.skills-table tbody tr');
        
        for (const row of rows) {
            const nameBtn = row.querySelector('.naked-button.left');
            if (!nameBtn) continue;
            
            const skillName = nameBtn.innerText.replace(/[*+]/g, '').trim();
            const skillData = char.skills.find(s => s.name === skillName);
            
            if (skillData) {
                const dropBtn = row.querySelector('.dropdown-button.dropdown-underline');
                const targetVal = String(skillData.trainingDegree);
                if (dropBtn && dropBtn.innerText.trim() !== targetVal) {
                    await clickAndVerifyText(dropBtn, targetVal, '.dropdown-content-button');
                }
                const inp = row.querySelector('input.underline-input');
                if (inp && skillData.otherBonus) await setAndVerify(inp, skillData.otherBonus);
            }
        }
    }

    // ORQUESTRADOR
    const charData = await fetchCharacterData(TARGET_ID);
    if (!charData) return;

    console.log(\`Iniciando importação para: \${charData.name}\`);

    const wizardTabs = document.querySelectorAll('.stepper-container .title');
    const isSheet = document.querySelector('.character-sheet');

    if (wizardTabs.length > 0 && !isSheet) {
        await runWizard(charData, wizardTabs);
    }

    if (await waitForElement('.character-sheet')) {
        await updateHeaderInfo(charData);
        await updateAttributesAndStats(charData);
        await updateSkills(charData);
        console.log("✅ SUCESSO TOTAL!");
        alert("Ficha importada! (Verifique Habilidades manualmente)");
    } else {
        alert("Erro: Ficha não encontrada na tela.");
    }
})();
    `;
}
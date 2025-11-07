// js/ui/dice-roller/dice-handler.js

import { elements } from './dice-dom.js';
import { roll } from './dice-api.js';

// (appendToFormula e clearRoller não mudam)
export function appendToFormula(term) {
    const currentFormula = elements.formulaInput.value.trim();
    if (currentFormula === "") {
        elements.formulaInput.value = term;
    } else {
        if (term.startsWith('+') || term.startsWith('-')) {
            elements.formulaInput.value = `${currentFormula} ${term[0]} ${term.substring(1)}`;
        } else {
            elements.formulaInput.value = `${currentFormula} + ${term}`;
        }
    }
}
export function clearRoller() {
    elements.formulaInput.value = "";
    elements.qtyInput.value = "1";
    elements.modInput.value = "0";
    elements.resultDisplay.innerHTML = "";
    elements.resetRollMode();
}

/**
 * Executa a rolagem de dados
 */
export function handleRoll() {
    const baseFormula = elements.formulaInput.value.trim();
    if (baseFormula === "") {
        elements.resultDisplay.innerHTML = `<span>Por favor, adicione dados à fórmula.</span>`;
        return;
    }

    const mode = elements.getRollMode();
    let finalFormula = baseFormula;
    
    // Lógica de Vantagem/Desvantagem
    // O parser do GNOLL não gosta de parênteses ao redor da notação de dado.
    if (mode === 'adv' && baseFormula.includes('d20')) {
        finalFormula = baseFormula.replace(/(\d*)d20/, (match, qtyString) => {
            const qty = parseInt(qtyString) || 1;
            // Removemos os parênteses: (2d20kh1) -> 2d20kh1
            return `${qty + 1}d20kh${qty}`;
        });
    } else if (mode === 'disadv' && baseFormula.includes('d20')) {
        finalFormula = baseFormula.replace(/(\d*)d20/, (match, qtyString) => {
            const qty = parseInt(qtyString) || 1;
            // Removemos os parênteses: (2d20kl1) -> 2d20kl1
            return `${qty + 1}d20kl${qty}`;
        });
    }

    try {
        // Agora 'roll' chama 'rollExpression'
        const result = roll(finalFormula);

        if (result) {
            const rollsFlat = result.rolls.flat().join(', ');
            
            elements.resultDisplay.innerHTML = `
                 <h2>${result.total}</h2>
                 <span><b>Fórmula:</b> ${finalFormula}</span>
                 <span><b>Rolagens:</b> [${rollsFlat}]</span>
             `;
        } else {
            elements.resultDisplay.innerHTML = `<span>Fórmula inválida: "${finalFormula}"</span>`;
        }
    } catch (e) {
        console.error("Erro ao rolar dados:", e);
        elements.resultDisplay.innerHTML = `<span>${e.message}</span>`;
    }
}
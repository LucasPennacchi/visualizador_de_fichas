// js/ui/dice-roller/dice-dom.js

// Exporta um objeto único contendo todos os elementos e getters do DOM
export const elements = {
 	widget: document.getElementById('dice-roller-widget'),
 	toggleBtn: document.getElementById('dice-roller-toggle'),
 	formulaInput: document.getElementById('dice-formula-input'),
 	qtyInput: document.getElementById('dice-pool-qty'),
 	dicePoolButtons: document.querySelectorAll('#dice-pool-buttons button'),
 	modInput: document.getElementById('dice-pool-mod'),
 	addModBtn: document.getElementById('dice-pool-add-mod'),
 	rollBtn: document.getElementById('dice-roll-btn'),
 	clearBtn: document.getElementById('dice-clear-btn'),
 	resultDisplay: document.getElementById('dice-result-display'),
 	
 	// Getter para o modo de rolagem
 	getRollMode: () => document.querySelector('input[name="roll-mode"]:checked').value,
 	
 	// Ação para resetar o modo
 	resetRollMode: () => document.querySelector('input[name="roll-mode"][value="sum"]').checked = true
};
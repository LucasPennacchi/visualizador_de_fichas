// js/ui/dice-roller/dice-roller.js

// Importa os elementos do DOM
import { elements } from './dice-dom.js';
// Importa as funções de lógica (handlers)
import { appendToFormula, clearRoller, handleRoll } from './dice-handler.js';

/**
 * Inicializa a widget do rolador de dados.
 * Esta função anexa todos os event listeners aos elementos do DOM.
 */
export function initializeDiceRoller() {
 
  // 1. Lógica de Abrir/Fechar a widget
  elements.toggleBtn.addEventListener('click', () => {
    elements.widget.classList.toggle('collapsed');
  });

  // 2. Lógica de Limpar
  elements.clearBtn.addEventListener('click', clearRoller);

  // 3. Lógica de Rolar (Clique no botão)
  elements.rollBtn.addEventListener('click', handleRoll);
  
  // 4. Lógica de Rolar (Apertar Enter no input)
  elements.formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleRoll();
  });

  // 5. Lógica de adicionar dados (clique nos botões d4, d6, etc.)
  elements.dicePoolButtons.forEach(button => {
    button.addEventListener('click', () => {
      const qty = elements.qtyInput.value || "1";
      const die = button.dataset.die; // "d4", "d20", etc.
      appendToFormula(`${qty}${die}`);
      elements.qtyInput.value = "1"; // Reseta o input de quantidade
    });
  });

  // 6. Lógica de adicionar modificador
  elements.addModBtn.addEventListener('click', () => {
    const mod = parseInt(elements.modInput.value, 10);
    if (isNaN(mod) || mod === 0) return; // Não adiciona 0
    
    const term = (mod > 0) ? `+${mod}` : `${mod}`; // Já inclui o sinal
    appendToFormula(term);
    elements.modInput.value = "0"; // Reseta o input do modificador
  });
}
/**
 * @module UI/DiceRoller/Controller
 * @description Módulo orquestrador da widget de rolagem de dados.
 * Responsável por vincular os elementos visuais (DOM) às funções de manipulação (Handlers),
 * registrando todos os Event Listeners necessários para a interatividade do componente.
 * * @requires module:UI/DiceRoller/DOM
 * @requires module:UI/DiceRoller/Handler
 */

import { elements } from './dice-dom.js';
import { appendToFormula, clearRoller, handleRoll } from './dice-handler.js';

// --- Função Principal ---

/**
 * Inicializa a widget do rolador de dados.
 * Configura os ouvintes de eventos (Event Listeners) para botões, inputs e atalhos de teclado.
 * Deve ser invocada apenas após o carregamento completo do DOM ou via importação dinâmica.
 */
export function initializeDiceRoller() {
 
  // 1. Gerenciamento de Estado Visual (Abrir/Fechar)
  // Alterna a classe CSS que controla a visibilidade do painel de conteúdo
  elements.toggleBtn.addEventListener('click', () => {
    elements.widget.classList.toggle('collapsed');
  });

  // 2. Ação de Limpeza (Reset)
  // Restaura o estado inicial dos inputs e do display de resultado
  elements.clearBtn.addEventListener('click', clearRoller);

  // 3. Gatilho de Execução (Botão Rolar)
  elements.rollBtn.addEventListener('click', handleRoll);
  
  // 4. Gatilho de Execução (Atalho de Teclado)
  // Permite submeter a fórmula pressionando 'Enter' no campo de texto
  elements.formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Previne comportamentos padrão de formulário
      handleRoll();
    }
  });

  // 5. Construtor de Fórmula (Botões de Dados)
  // Itera sobre os botões predefinidos (d4...d20) para adicionar dados à fórmula
  elements.dicePoolButtons.forEach(button => {
    button.addEventListener('click', () => {
      const qty = elements.qtyInput.value || "1";
      const die = button.dataset.die; // Captura o tipo de dado do atributo data-die
      
      // Constrói a string (ex: "2d20") e anexa
      appendToFormula(`${qty}${die}`);
      
      elements.qtyInput.value = "1"; // Reseta o input de quantidade para o padrão
    });
  });

  // 6. Construtor de Fórmula (Modificadores Numéricos)
  // Valida e adiciona valores fixos (bônus/penalidades) à fórmula
  elements.addModBtn.addEventListener('click', () => {
    const mod = parseInt(elements.modInput.value, 10);
    
    // Validação: Ignora entradas não numéricas ou zero
    if (isNaN(mod) || mod === 0) return; 
    
    // Formatação: Garante a presença do sinal explícito (+ ou -)
    const term = (mod > 0) ? `+${mod}` : `${mod}`; 
    
    appendToFormula(term);
    elements.modInput.value = "0"; // Reseta o input do modificador
  });
}
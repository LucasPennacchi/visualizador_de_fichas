/**
 * @module UI/DiceRoller/Handler
 * @description Contém a lógica de manipulação de eventos e regras de negócio da widget de dados.
 * Responsável por construir strings de fórmulas, aplicar modificadores de jogo (Vantagem/Desvantagem)
 * via manipulação de strings (Regex) e formatar a saída visual dos resultados.
 * * @requires module:UI/DiceRoller/DOM
 * @requires module:UI/DiceRoller/API
 */

import { elements } from './dice-dom.js';
import { roll } from './dice-api.js';

// --- Funções Exportadas ---

/**
 * Adiciona um termo ou operador à fórmula atual no campo de input.
 * Realiza formatação inteligente de strings, garantindo o espaçamento correto
 * entre operandos e operadores para manter a legibilidade e validade da fórmula.
 * * @param {string} term - O termo a ser concatenado (ex: "1d20", "+5", "-").
 */
export function appendToFormula(term) {
  const currentFormula = elements.formulaInput.value.trim();
  
  if (currentFormula === "") {
    elements.formulaInput.value = term;
  } else {
    // Verifica se o termo é um operador (+ ou -) para ajustar o espaçamento
    if (term.startsWith('+') || term.startsWith('-')) {
      // Ex: "1d20 + 5"
      elements.formulaInput.value = `${currentFormula} ${term[0]} ${term.substring(1)}`;
    } else {
      // Ex: "1d20 + 1d6" (Adiciona soma implícita entre dados)
      elements.formulaInput.value = `${currentFormula} + ${term}`;
    }
  }
}

/**
 * Reseta o estado completo da widget de rolagem.
 * Limpa os campos de input, o display de resultados e restaura o seletor
 * de modo de rolagem para o padrão ("Soma").
 */
export function clearRoller() {
  elements.formulaInput.value = "";
  elements.qtyInput.value = "1";
  elements.modInput.value = "0";
  elements.resultDisplay.innerHTML = "";
  elements.resetRollMode();
}

/**
 * Orquestrador principal do fluxo de rolagem.
 * 1. Captura e valida a entrada do usuário.
 * 2. Aplica lógica de Vantagem/Desvantagem transformando a string da fórmula (Regex).
 * 3. Invoca a API de cálculo.
 * 4. Renderiza o resultado formatado ou mensagens de erro no DOM.
 */
export function handleRoll() {
  const baseFormula = elements.formulaInput.value.trim();
  
  // Validação básica de entrada vazia
  if (baseFormula === "") {
    elements.resultDisplay.innerHTML = `<span>Por favor, adicione dados à fórmula.</span>`;
    return;
  }

  const mode = elements.getRollMode();
  let finalFormula = baseFormula;
  
  // --- Processamento de Regras de Negócio (Vantagem/Desvantagem) ---
  // Utiliza Regex para localizar o primeiro dado 'd20' e alterar sua notação
  // para a sintaxe de Keep Highest (kh) ou Keep Lowest (kl).
  
  if (mode === 'adv' && baseFormula.includes('d20')) {
    finalFormula = baseFormula.replace(/(\d*)d20/, (match, qtyString) => {
      const qty = parseInt(qtyString) || 1; // Normaliza "d20" para "1d20"
      // Regra: Rola 1 dado extra, mantém (Keep) a quantidade original mais alta (High)
      return `${qty + 1}d20kh1`;
    });
  } else if (mode === 'disadv' && baseFormula.includes('d20')) {
    finalFormula = baseFormula.replace(/(\d*)d20/, (match, qtyString) => {
      const qty = parseInt(qtyString) || 1;
      // Regra: Rola 1 dado extra, mantém (Keep) a quantidade original mais baixa (Low)
      return `${qty + 1}d20kl1`;
    });
  }

  // --- Execução e Renderização ---
  try {
    // Invoca o interpretador customizado
    const result = roll(finalFormula);

    if (result) {
      // Achata o array de resultados para exibição linear (ex: [[15], [4]] -> [15, 4])
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
    // Exibe a mensagem de erro amigável gerada pela API
    elements.resultDisplay.innerHTML = `<span>${e.message}</span>`;
  }
}
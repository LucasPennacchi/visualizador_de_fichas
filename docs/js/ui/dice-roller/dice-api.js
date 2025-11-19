/**
 * @module UI/DiceRoller/API
 * @description Motor de interpretação e execução de rolagens de dados customizado.
 * Implementa um parser léxico simplificado para processar notações de dados de RPG (ex: "2d20kh1 + 5"),
 * suportando operações aritméticas básicas, rolagens de múltiplos dados e modificadores de vantagem/desvantagem (Keep Highest/Lowest).
 * * @example
 * // Rola 2 dados de 20 lados, mantém o maior e soma 5
 * roll("2d20kh1 + 5"); 
 */

// --- Funções Internas (Helpers de Lógica) ---

/**
 * Gera uma série de números aleatórios simulando rolagens de dados.
 * Utiliza `Math.random()` para gerar valores inteiros entre 1 e o número de lados.
 * * @param {number} qty - Quantidade de dados a serem rolados.
 * @param {number} sides - Número de faces de cada dado.
 * @returns {Array<number>} Array contendo os resultados individuais de cada dado.
 */
function _roll(qty, sides) {
  let rolls = [];
  for (let i = 0; i < qty; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  return rolls;
}

/**
 * Processa um único segmento léxico (token) da fórmula de rolagem.
 * Interpreta se o segmento é uma rolagem de dados (com ou sem regras especiais)
 * ou um modificador numérico fixo, aplicando o sinal matemático correspondente.
 * * @param {string} chunk - O segmento da string a ser processado (ex: "2d20kh1", "+ 5").
 * @returns {Object} Resultado processado contendo:
 * - `total` {number}: O valor final calculado para este segmento (com sinal aplicado).
 * - `rolls` {Array<number>}: Lista dos resultados individuais dos dados (se houver).
 */
function _processChunk(chunk) {
  let sign = 1; // Multiplicador de sinal: 1 (positivo) ou -1 (negativo)

  // 1. Normalização de Sinal: Identifica e remove operadores explícitos
  if (chunk.startsWith('+')) {
    chunk = chunk.substring(1);
  } else if (chunk.startsWith('-')) {
    chunk = chunk.substring(1);
    sign = -1;
  }
  
  // 2. Limpeza: Remove espaços em branco residuais para facilitar o regex
  chunk = chunk.trim();

  // Definição de padrões Regex para identificação de tipos
  // Captura: (Qtd)d(Lados)(Modificador)(ValorModificador)
  const keepRegex = /(\d*)d(\d+)(kh|kl)(\d+)/i;
  // Captura: (Qtd)d(Lados)
  const simpleRegex = /(\d*)d(\d+)/i;
  
  let match;

  // --- Estratégia A: Dado com Mecânica de Seleção (Vantagem/Desvantagem) ---
  if (match = chunk.match(keepRegex)) {
    const qty = parseInt(match[1]) || 1; 
    const sides = parseInt(match[2]);
    const mode = match[3].toLowerCase(); // 'kh' (Keep High) ou 'kl' (Keep Low)
    const keep = parseInt(match[4]);
    
    const rolls = _roll(qty, sides);
    // Ordenação descendente para facilitar a seleção (maiores primeiro)
    rolls.sort((a, b) => b - a);

    let keptRolls;
    if (mode === 'kl') { 
      // Keep Lowest: Seleciona os X últimos elementos (menores valores)
      keptRolls = rolls.slice(-keep); 
    } else { 
      // Keep Highest: Seleciona os X primeiros elementos (maiores valores)
      keptRolls = rolls.slice(0, keep); 
    }
    
    // Soma apenas os dados mantidos
    const total = keptRolls.reduce((a, b) => a + b, 0);
    
    // Retorna o total calculado mas preserva TODOS os dados rolados para histórico
    return { total: total * sign, rolls: rolls };
  }
  
  // --- Estratégia B: Rolagem de Dados Padrão ---
  if (match = chunk.match(simpleRegex)) {
    const qty = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    
    const rolls = _roll(qty, sides);
    const total = rolls.reduce((a, b) => a + b, 0);
    return { total: total * sign, rolls: rolls };
  }
  
  // --- Estratégia C: Modificador Numérico Estático ---
  if (match = chunk.match(/^(\d+)$/)) {
    const total = parseInt(match[1]);
    return { total: total * sign, rolls: [] }; // Sem componente aleatório
  }
  
  // --- Fallback: Segmento Inválido ---
  console.warn(`[DiceAPI] Segmento de fórmula ignorado/inválido: "${chunk}"`);
  return { total: 0, rolls: [] };
}

// --- Funções Exportadas ---

/**
 * Executa o parsing e cálculo completo de uma expressão de rolagem de dados.
 * Divide a string de entrada em componentes lógicos, processa cada um individualmente
 * e agrega os resultados finais.
 * * @param {string} notation - A string da fórmula completa (ex: "1d20 + 2d6 - 3").
 * @returns {Object} Objeto de resultado final contendo:
 * - `total` {number}: A soma aritmética final de todos os componentes.
 * - `rolls` {Array<Array<number>>}: Matriz contendo o histórico de todos os dados rolados, agrupados por segmento.
 * @throws {Error} Se a notação fornecida não puder ser interpretada.
 */
export function roll(notation) {
  // Regex Principal de Tokenização:
  // Divide a string capturando grupos que representam dados (com ou sem modificadores)
  // ou valores numéricos puros, respeitando sinais de adição/subtração.
  const chunkRegex = /([+\-]?\s*\d*[dD]\d+[khkl\d]*)|([+\-]\s*\d+)/g;
  
  // Normalização de Entrada:
  // Garante que a fórmula comece com um delimitador previsível para o regex funcionar
  // corretamente no primeiro termo (ex: transforma "1d20" em " 1d20").
  const safeNotation = notation.trim().startsWith('+') || notation.trim().startsWith('-') 
    ? notation 
    : ` ${notation}`; 

  // Regex Refinado: Captura termos iniciais sem sinal, termos com sinal e modificadores puros
  const betterChunkRegex = /(\s*\d*[dD]\d+[khkl\d]*)|([+\-]\s*\d*[dD]\d+[khkl\d]*)|([+\-]\s*\d+)/g;
  const chunks = safeNotation.match(betterChunkRegex);
  
  if (!chunks) {
    // Fallback de Segurança: Tenta interpretar como um dado único simples caso o regex complexo falhe
    if (notation.match(/(\d*)d(\d+)/i)) {
      const result = _processChunk(notation);
      return { total: result.total, rolls: [result.rolls] };
    }
    throw new Error("Formato de dado inválido ou não reconhecido.");
  }

  let finalTotal = 0;
  let allRolls = []; 

  // Processamento Sequencial: Itera sobre cada token, calcula e agrega
  chunks.forEach(chunk => {
    const result = _processChunk(chunk);
    finalTotal += result.total;
    
    // Preserva apenas rolagens reais (ignora modificadores numéricos no histórico de dados)
    if (result.rolls.length > 0) {
      allRolls.push(result.rolls); 
    }
  });
  
  return { total: finalTotal, rolls: allRolls };
}
// js/ui/dice-roller/dice-api.js

/**
 * -----------------------------------------------------------------
 * Módulo de API de Rolagem de Dados (Interpretador Customizado)
 * -----------------------------------------------------------------
 */

/**
 * Helper 1: Rola X dados de Y lados.
 */
function _roll(qty, sides) {
  let rolls = [];
  for (let i = 0; i < qty; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
   }
  return rolls;
}

/**
 * Helper 2: Processa um único "pedaço" da fórmula.
 * --- CORRIGIDO ---
 */
function _processChunk(chunk) {
  // O trim() foi movido daqui...
  let sign = 1; // 1 para positivo, -1 para negativo

  // 1. Verifica e remove os sinais
  if (chunk.startsWith('+')) {
    chunk = chunk.substring(1);
   } else if (chunk.startsWith('-')) {
    chunk = chunk.substring(1);
    sign = -1;
   }
  
  // 2. AGORA faz o trim()
  // Isso transforma " 5" (com espaço) em "5"
  chunk = chunk.trim();
  // --- FIM DA CORREÇÃO ---

  // Regex para dados com Vantagem/Desvantagem (ex: "2d20kh1", "3d6kl2")
  const keepRegex = /(\d*)d(\d+)(kh|kl)(\d+)/i;
  // Regex para dados simples (ex: "1d20", "d6")
  const simpleRegex = /(\d*)d(\d+)/i;
  
  let match;

  // --- Caso 1: Dado com Vantagem/Desvantagem ---
  if (match = chunk.match(keepRegex)) {
    const qty = parseInt(match[1]) || 1; 
    const sides = parseInt(match[2]);
    const mode = match[3].toLowerCase(); // 'kh' ou 'kl'
    const keep = parseInt(match[4]);
    
    const rolls = _roll(qty, sides);
    rolls.sort((a, b) => b - a); // Ordena do maior para o menor

    let keptRolls;
    if (mode === 'kl') { // Keep Lowest (Manter Menores)
      keptRolls = rolls.slice(-keep); // Pega os X últimos (menores)
     } else { // Keep Highest (Manter Maiores)
      keptRolls = rolls.slice(0, keep); // Pega os X primeiros (maiores)
     }
    
    const total = keptRolls.reduce((a, b) => a + b, 0);
    return { total: total * sign, rolls: rolls };
   }
  
  // --- Caso 2: Rolo de dado simples ---
  if (match = chunk.match(simpleRegex)) {
    const qty = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    
    const rolls = _roll(qty, sides);
    const total = rolls.reduce((a, b) => a + b, 0);
    return { total: total * sign, rolls: rolls };
   }
  
  // --- Caso 3: Modificador numérico ---
  // Agora 'chunk' será "5", e o match funcionará
  if (match = chunk.match(/^(\d+)$/)) {
    const total = parseInt(match[1]);
    return { total: total * sign, rolls: [] }; // Sem rolagens, apenas um número
   }
  
  // --- Caso 4: Inválido ---
  console.warn(`Pedaço de fórmula inválido: "${chunk}"`);
  return { total: 0, rolls: [] };
}


/**
 * Função principal exportada.
 * Rola a notação de dados completa (ex: "2d20kh1 + 1d6 + 5").
 */
export function roll(notation) {
  // Regex para quebrar a string em pedaços (dados ou modificadores)
  // Ex: "2d20kh1 + 5 - 1d4"
  // -> ["2d20kh1", "+ 5", "- 1d4"]
  const chunkRegex = /([+\-]?\s*\d*[dD]\d+[khkl\d]*)|([+\-]\s*\d+)/g;
  
  // Adiciona um espaço no início se não houver sinal,
  // para garantir que o regex pegue o primeiro pedaço.
  // "1d20 + 5" -> " 1d20 + 5"
  const safeNotation = notation.trim().startsWith('+') || notation.trim().startsWith('-') 
    ? notation 
    : ` ${notation}`; // Adiciona um espaço
 
  // Agora o regex é modificado para capturar o primeiro pedaço sem sinal
  // (Ex: "1d20") E os pedaços com sinal (Ex: "+ 5" ou "- 1d6")
  const betterChunkRegex = /(\s*\d*[dD]\d+[khkl\d]*)|([+\-]\s*\d*[dD]\d+[khkl\d]*)|([+\-]\s*\d+)/g;
  const chunks = safeNotation.match(betterChunkRegex);
  
  if (!chunks) {
    // Se o regex não achar nada, tenta tratar a string inteira como um único dado
    if (notation.match(/(\d*)d(\d+)/i)) {
      const result = _processChunk(notation);
      return { total: result.total, rolls: [result.rolls] };
     }
    throw new Error("Formato de dado inválido.");
   }

  let finalTotal = 0;
  let allRolls = []; // Array de arrays, ex: [[15, 3], [4]]

  // Processa cada pedaço e soma os resultados
  chunks.forEach(chunk => {
    const result = _processChunk(chunk);
    finalTotal += result.total;
    if (result.rolls.length > 0) {
      allRolls.push(result.rolls); // Salva o grupo de rolagens
     }
   });
  
  return { total: finalTotal, rolls: allRolls };
}
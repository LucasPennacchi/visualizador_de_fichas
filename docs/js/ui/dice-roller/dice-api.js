// js/ui/dice-roller/dice-api.js

/**
 * Rola a notação de dados usando a biblioteca global 'gnoll'.
 * @param {string} notation - A fórmula (ex: "2d20kh1+5")
 * @returns {object} - O objeto de resultado.
 */
export function roll(notation) {
    try {
        // A função 'roll' simples não lida com matemática.
        // A função 'rollExpression' é a correta para fórmulas.
        const result = window.gnoll.rollExpression(notation);

        return result;
    } catch (e) {
        console.error("Erro na API de Rolagem:", e);
        // Re-lança o erro para o handler tratar
        throw new Error(`Erro na fórmula: ${e.message}`);
    }
}
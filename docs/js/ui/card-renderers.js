// js/ui/card-renderers.js

// O placeholder é um template, então ele vem para cá
export const placeholder = '<div class="list-placeholder">Nenhum</div>';

// Mapeamento de atributos (usado por renderSkillItem)
const attrMap = { AGI: 'dex', FOR: 'str', VIG: 'con', INT: 'int', PRE: 'pre' };

/**
 * Cria o HTML para um item de perícia.
 * @param {object} skill - O objeto da perícia
 * @param {object} allAttributes - O objeto de atributos principal
 */
export const renderSkillItem = (skill, allAttributes) => {
  const attrKey = attrMap[skill.attribute];
  const diceCount = (allAttributes && allAttributes[attrKey]) || 0; 
  
  return `
        <div class="skill-item">
            <span class="skill-name">${skill.name}</span>
            <span class="skill-value">${diceCount}d20 + ${skill.bonus}</span>
        </div>`;
};

/**
 * Cria o HTML para um item de lista (Habilidade, Ritual).
 * @param {object} item - O item com nome e descrição.
 */
export const renderListItem = (item) => `
    <div class="inner-accordion-item">
        <div class="inner-accordion-header">${item.name}</div>
        <div class="inner-accordion-content">
            <div class="inner-accordion-inner">
                <p>${item.description || 'Sem descrição.'}</p>
            </div>
        </div>
    </div>`;

/**
 * Cria o HTML para um item de inventário.
 * @param {object} item - O item com nome, slots e descrição.
 */
export const renderInventoryItem = (item) => `
    <div class="inner-accordion-item">
        <div class="inner-accordion-header">
            ${item.name}
            <span class="item-slots">(Espaços: ${item.slots})</span>
        </div>
        <div class="inner-accordion-content">
            <div class="inner-accordion-inner">
                <p>${item.description || 'Sem descrição.'}</p>
            </div>
        </div>
    </div>`;
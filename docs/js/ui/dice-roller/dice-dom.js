/**
 * @module UI/DiceRoller/DOM
 * @description Camada de abstração do DOM para a widget de dados.
 * Centraliza todas as referências aos elementos HTML e métodos de acesso direto à interface,
 * garantindo que a lógica de negócio (Handler) não dependa diretamente de seletores CSS/IDs.
 * * Nota: Este módulo deve ser carregado apenas após o DOM estar pronto.
 */

/**
 * Objeto Singleton contendo referências cacheadas para os elementos da interface
 * e métodos auxiliares para leitura/escrita de estados de input complexos.
 * @namespace elements
 */
export const elements = {
  /**
   * O contêiner principal da widget flutuante.
   * @type {HTMLElement}
   */
  widget: document.getElementById('dice-roller-widget'),

  /**
   * Botão responsável por expandir ou colapsar a widget.
   * @type {HTMLElement}
   */
  toggleBtn: document.getElementById('dice-roller-toggle'),

  /**
   * Campo de texto onde a fórmula de rolagem é construída ou digitada.
   * @type {HTMLInputElement}
   */
  formulaInput: document.getElementById('dice-formula-input'),

  /**
   * Campo numérico para definir a quantidade de dados a serem adicionados.
   * @type {HTMLInputElement}
   */
  qtyInput: document.getElementById('dice-pool-qty'),

  /**
   * Lista de botões que representam os tipos de dados (d4, d6, etc.).
   * @type {NodeListOf<HTMLButtonElement>}
   */
  dicePoolButtons: document.querySelectorAll('#dice-pool-buttons button'),

  /**
   * Campo numérico para definir valores de modificadores (+/-).
   * @type {HTMLInputElement}
   */
  modInput: document.getElementById('dice-pool-mod'),

  /**
   * Botão para confirmar a adição do modificador à fórmula.
   * @type {HTMLElement}
   */
  addModBtn: document.getElementById('dice-pool-add-mod'),

  /**
   * Botão principal para executar a rolagem.
   * @type {HTMLElement}
   */
  rollBtn: document.getElementById('dice-roll-btn'),

  /**
   * Botão para limpar todos os campos e resultados.
   * @type {HTMLElement}
   */
  clearBtn: document.getElementById('dice-clear-btn'),

  /**
   * Contêiner onde o resultado da rolagem (ou erro) será renderizado.
   * @type {HTMLElement}
   */
  resultDisplay: document.getElementById('dice-result-display'),
  
  // --- Métodos Auxiliares de UI ---

  /**
   * Recupera o modo de rolagem atualmente selecionado pelo usuário.
   * Varre o grupo de inputs de rádio 'roll-mode'.
   * * @returns {string} O valor selecionado: 'sum' (Soma), 'adv' (Vantagem) ou 'disadv' (Desvantagem).
   */
  getRollMode: () => document.querySelector('input[name="roll-mode"]:checked').value,
  
  /**
   * Restaura o seletor de modo de rolagem para o estado padrão ('sum').
   * Define a propriedade `checked` do input correspondente como true.
   */
  resetRollMode: () => document.querySelector('input[name="roll-mode"][value="sum"]').checked = true
};
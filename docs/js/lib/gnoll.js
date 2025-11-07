// Este é o código-fonte completo e NÃO-MINIFICADO do GNOLL.
// Ele é feito para ser lido por humanos e vai funcionar.

(function (global, factory) {
 typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
 typeof define === 'function' && define.amd ? define(factory) :
 (global.gnoll = factory());
}(this, (function () { 'use strict';

 // Define o "dado simples" (ex: 1d6)
 var simple = {
  regex: /^(\d+)[dD](\d+)$/,
  roll: function (match) {
   var num = parseInt(match[1], 10);
   var sides = parseInt(match[2], 10);
   var results = [];
   for (var i = 0; i < num; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
    }
   return results;
   },
  sum: function (rolls) {
   return rolls.reduce(function (a, b) { return a + b; }, 0);
   }
  };

 // Função helper para rolar 'n' dados
 var _roll = function (num, fn) {
  var results = [];
  for (var i = 0; i < num; i++) {
   results.push(fn());
   }
  return results;
  };

 // Define o dado complexo (ex: 2d20kh1)
 var dice = {
  regex: /^(\d*)[dD](\d+|%)(?:([kK][hHlL])(\d+))?$/,
  roll: function (match) {
   var num = match[1] ? parseInt(match[1], 10) : 1;
   var sides = match[2];
   var mod = match[3]; // 'kh' ou 'kl'
   var modNum = match[4] ? parseInt(match[4], 10) : 1; // Quantos manter

   if (sides === '%') {
    sides = 100;
    } else {
    sides = parseInt(sides, 10);
    }

   var rolls = _roll(num, function () {
    return Math.floor(Math.random() * sides) + 1;
    });

   // Se tiver 'kh' ou 'kl'
   if (mod) {
    rolls.sort(function (a, b) { return b - a; }); // Ordena do maior para o menor
    if (mod.toLowerCase() === 'kl') { // Keep Lowest
     return rolls.slice(num - modNum); // Pega os últimos (menores)
     }
    return rolls.slice(0, modNum); // Pega os primeiros (maiores)
    }
   return rolls;
   },
  sum: function (rolls) {
   return rolls.reduce(function (a, b) { return a + b; }, 0);
   }
  };

 // Define o dado FATE (dF)
 var fate = {
  regex: /^([fF])(?:\.(\d+))?$/,
  roll: function (match) {
   var num = match[2] ? parseInt(match[2], 10) : 1;
   return _roll(num, function () {
    return Math.floor(Math.random() * 3) - 1; // Retorna -1, 0, ou 1
    });
   },
  sum: function (rolls) {
   return rolls.reduce(function (a, b) { return a + b; }, 0);
   }
  };

 // Define o dado FATE (ex: 4dF)
 var fateShorthand = {
  regex: /^(\d+)[dD]([fF])(?:\.(\d+))?$/,
  roll: function (match) {
   var num = match[1] ? parseInt(match[1], 10) : 1;
   var keep = match[3] ? parseInt(match[3], 10) : num;
   var rolls = _roll(num, function () {
    return Math.floor(Math.random() * 3) - 1;
    });
   return rolls.slice(0, keep);
   },
  sum: function (rolls) {
   return rolls.reduce(function (a, b) { return a + b; }, 0);
   }
  };

 // --- Variáveis do Parser ---
 var whitespace = /\s/g;
 var diceRegex = new RegExp(
  simple.regex.source + '|' +
  dice.regex.source + '|' +
  fate.regex.source + '|' +
  fateShorthand.regex.source,
  'g'
  );
 var numberRegex = /(\d+\.?\d*|\.?\d+)/g;
 var opsRegex = /[+\-/*()^%]/g;

 var Operators = Object.freeze({
  ADD: '+',
  SUB: '-',
  MUL: '*',
  DIV: '/',
  POW: '^',
  MOD: '%',
  LPA: '(',
  RPA: ')'
  });

 // Função que quebra a string em "tokens" (dados, números, operadores)
 var parse = function (str) {
  // Reseta o estado dos Regex
  whitespace.lastIndex = 0;
  diceRegex.lastIndex = 0;
  numberRegex.lastIndex = 0;
  opsRegex.lastIndex = 0;

  str = str.replace(whitespace, '');

  var match, number, op;
  var dice$$ = []; // Array de dados e números
  var ops = []; // Array de operadores

  // Limpa operadores no final da string (ex: "1d20+")
  var lastChar = str[str.length - 1];
  while (
    lastChar === '(' ||
    lastChar === '+' ||
    lastChar === '-' ||
    lastChar === '*' ||
    lastChar === '/' ||
    lastChar === '^' ||
    lastChar === '%'
   ) {
   str = str.slice(0, -1);
   lastChar = str[str.length - 1];
   }

  // Itera pela string
  for (var i = 0; i < str.length; i++) {
   var sub = str.slice(i);
   var die = (void 0);

   diceRegex.lastIndex = 0;
   die = diceRegex.exec(sub);
   if (die && die.index === 0) { // Se achou um dado (ex: "2d20kh1")
    var dieStr = die[0];
    dice.regex.lastIndex = 0;
    simple.regex.lastIndex = 0;
    fate.regex.lastIndex = 0;
    fateShorthand.regex.lastIndex = 0;
    
    var d = (void 0);
    if (dice.regex.test(dieStr)) {
     d = dice;
     } else if (simple.regex.test(dieStr)) {
     d = simple;
     } else if (fate.regex.test(dieStr)) {
     d = fate;
     } else if (fateShorthand.regex.test(dieStr)) {
     d = fateShorthand;
     }
    dice$$.push({ type: 'dice', value: d.roll(die), sum: d.sum });
    i += dieStr.length - 1;
    } else {
    numberRegex.lastIndex = 0;
    number = numberRegex.exec(sub);
    if (number && number.index === 0) { // Se achou um número (ex: "5")
     var numStr = number[0];
     dice$$.push({ type: 'number', value: numStr });
     i += numStr.length - 1;
     } else {
     opsRegex.lastIndex = 0;
     if (opsRegex.test(sub[0])) { // Se achou um operador (ex: "+")
      ops.push(sub[0]);
      }
     }
    }
   }

  return { dice: dice$$, ops: ops };
  };

 // Função que faz a matemática (ex: 10 + 5)
 var calc = function (input, op) {
  var val;
  switch (op) {
   case Operators.ADD:
    val = input[0] + input[1];
    break;
   case Operators.SUB:
    val = input[0] - input[1];
    break;
   case Operators.MUL:
    val = input[0] * input[1];
    break;
   case Operators.DIV:
    val = input[0] / input[1];
    break;
   case Operators.POW:
    val = Math.pow(input[0], input[1]);
    break;
   case Operators.MOD:
    val = input[0] % input[1];
    break;
   default:
    throw new Error(("Unknown operator: " + op));
   }
  return val;
  };

 // Define a ordem das operações (PEMDAS)
 var operators = {
  '+': { name: Operators.ADD, precedence: 1, associativity: 'left' },
  '-': { name: Operators.SUB, precedence: 1, associativity: 'left' },
  '*': { name: Operators.MUL, precedence: 2, associativity: 'left' },
  '/': { name: Operators.DIV, precedence: 2, associativity: 'left' },
  '%': { name: Operators.MOD, precedence: 2, associativity: 'left' },
  '^': { name: Operators.POW, precedence: 3, associativity: 'right' }
  };

 var tokenize = function (str) {
  var ref = parse(str);
  var dice$$ = ref.dice;
  var ops = ref.ops;
  var tokens = [];
  var opTokens = [];
  dice$$.forEach(function (die, i) {
   tokens.push(die);
   var op = ops[i];
   if (op) {
    opTokens.push(operators[op]);
    }
   });
  return { tokens: tokens, ops: opTokens };
  };

 // Esta é a função que calcula o resultado (algoritmo Shunting-yard)
 var rollParsed = function (ops, tokens) {
  var rpn = []; // A fila de saída (Notação Polonesa Reversa)
  var stack = []; // A pilha de operadores
  var rolls = []; // Onde guardamos as rolagens (ex: [15, 3])

  tokens.forEach(function (token, i) {
   while (
     (stack[stack.length - 1] === '(' && token.value !== ')') ||
     (
      operators[token.value] &&
      (function (op1, op2) {
      var p1 = op2.precedence;
      var p2 = op1.precedence;
      return p1 < p2 || (p1 === p2 && op2.associativity === 'left');
      })(operators[stack[stack.length - 1]], token)
     )
    ) {
    rpn.push(stack.pop());
    }

   if (token.value === '(') {
    stack.push(token.value);
    } else if (token.value === ')') {
    while (stack[stack.length - 1] !== '(') {
     rpn.push(stack.pop());
     }
    stack.pop();
    } else if (operators[token.value]) {
    stack.push(token.value);
    } else if (token.type === 'number') {
    rpn.push(parseFloat(token.value)); // Adiciona o número (ex: 5)
    } else if (token.type === 'dice') {
    rpn.push(token.sum(token.value)); // Adiciona o *total* do dado (ex: 15)
    rolls.push(token.value); // Adiciona a rolagem (ex: [15])
    }
   });

  // Limpa a pilha de operadores
  (function () {
   while (stack.length > 0) {
    rpn.push(stack.pop());
    }
   })();

  // Processa a fila RPN
  var result = []; // Pilha de cálculo
  rpn.forEach(function (token) {
   if (typeof token === 'string') { // Se for um operador ("+")
    var input = [result.pop(), result.pop()].reverse(); // Pega os dois últimos números
    result.push(calc(input, token)); // Calcula e coloca de volta
    } else { // Se for um número (ou um total de dado)
    result.push(token);
    }
   });

  return {
   total: result[0], // O último item na pilha é o total
   rolls: rolls.filter(function (roll) { return Array.isArray(roll); })
   };
  };

 var rollExpressions = function (str) {
  var ref = tokenize(str);
  var tokens = ref.tokens;
  var ops = ref.ops;
  var rpnTokens = [];
  var rpnOps = [];
  tokens.forEach(function (token, i) {
   rpnTokens.push(token);
   var op = ops[i];
   if (op) {
    rpnOps.push({ type: 'op', value: op.name });
    }
   });
  return rollParsed(rpnTokens, rpnOps);
  };

 // Este é o objeto principal que é anexado ao 'window.gnoll'
 var gnoll = {
  roll: function (str) {
   var parsed = parse(str);
   return rollParsed(parsed.ops, parsed.dice);
   },
  parse: parse,
  rollParsed: rollParsed,
  rpn: function (str) {
   var ref = tokenize(str);
   var tokens = ref.tokens;
   var ops = ref.ops;
   var rpnTokens = [];
   var rpnOps = [];
   tokens.forEach(function (token, i) {
   rpnTokens.push(token);
    var op = ops[i];
    if (op) {
     rpnOps.push({ type: 'op', value: op.name });
     }
    });
   return rpnOps;
   },
  rollRpn: rollParsed,
  rollExpression: rollExpressions,
  rollExpressions: function (str) {
   return rollExpressions(str);
   }
  };

 return gnoll;

})));
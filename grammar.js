/**
 * @file revo is a dynamic language made for the joy of programming
 * @author doomy
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const IDENT_SNAKE = /[a-z_][a-zA-Z0-9_]*/;
const IDENT_MACRO = /[a-z_][a-zA-Z0-9_]*\!/;
const IDENT_PASCAL = /[A-Z_][a-zA-Z0-9_]*/;
const IDENT_ANY = /[a-zA-Z_][a-zA-Z0-9_]*/;
const STRING_PATTERN = /(?:[^"\\]|\\.)*/;
export default grammar({
  name: "revo",
  // word: $ => $.ident,
  extras: $ => [
    /\s/,
    $.comment,
    $.doc_comment,
    $.suite,
    $.test,
  ],
  rules: {
    source: $ => repeat($._expression),
    expression: $ => $._expression,
    _not: $ => token('not'),
    _expression: $ => prec.left(3, choice(
      $.type,
      $.ident,
      'self',
      $.type_alias,
      $.struct_definition,
      $.do_block,
      $.atom,
      $.number,
      $.string,
      $.match,
      $.function,
      $.function_call,
      $.macro,
      $.macro_call,
      $.proc_macro,
      $.struct,
      $.table,
      $.for_loop,
      $._operation,
      $.tuple,
      $.return,
      $.union,
      $._table_type,
      $._tuple_type,
      $._indexed,
      $._association,
      $.unary_expression,
      $.spawn,
      seq($._expression, $._method),
      seq($._expression, $.scoped),
      seq($._not, $._expression),
      $.if_expression,
      $.assignment,
      $._while,
    )),
    assignment: $ => prec.right(seq(
      optional(choice(
        'let',
        seq(optional($.visibility), 'const'),
        'global',
      )),
      $.ident, optional(seq(repeat1(seq(',', $.ident)), optional(','))),
      optional(seq(':', $._type_expr)),
    )),
    spawn: $ => seq('spawn', $.function_call),
    if_expression: $ => prec.left(3, seq(
      'if',
      prec(5, $.expression),
      prec(5, $.expression),
      optional(seq('else', $.expression)))),
    operator: $ => $._operator,
    unary_expression: $ => prec(3, seq(
      $.operator,
      $.number,
    )),
    _operator: $ => prec(2, token(choice(
      '=',
      '+',
      '-',
      '*',
      '^',
      '^=',
      '/',
      '%',
      '=',
      '+=',
      '-=',
      '/=',
      '%=',
      '<',
      '>',
      '==',
      '<=',
      '>=',
      '!=',
      '~',
      '|>',
      '//',
      'band',
      'bor',
      'bxor',
      'shl',
      'shr',
      'orelse',
    ))),

    // Identifiers
    ident: $ => IDENT_SNAKE,
    function_ident: $ => prec(1, seq(optional('!'), IDENT_SNAKE, optional('?'))),
    index: $ => seq(
      '[',
      choice($._expression, $.index),
      ']'
    ),
    _while: $ => token('while'),
    _indexed: $ => prec(4, seq($.ident, $.index)),
    _pub: $ => token('pub'),
    visibility: $ => $._pub,
    _do: $ => token('do'),
    _end: $ => token('end'),
    try_operator: $ => '?',
    // Basic types
    number: $ => token(/[0-9][0-9_]*(\.[0-9_]+)?(e[0-9_]+)?/),
    _association: $ => prec(3, seq(
      '(',
      $._expression,
      ')'
    )),
    tuple: $ => seq(
      '(',
      optional(seq(
        $._expression,
        repeat(seq(',', $._expression)),
      )),
      optional(','),
      ')'
    ),
    atom: $ => seq(
      ':',
      IDENT_SNAKE,
    ),
    string: $ => choice(
      $._string_single_line,
      $._string_multi_line,
    ),
    _string_single_line: $ => token(seq('"', token.immediate(STRING_PATTERN), '"')),
    _string_multi_line: $ => seq('"""', repeat(choice(STRING_PATTERN, '"', '""')), '"""'),
    _table_type: $ => seq('table', optional($._generics)),
    _tuple_type: $ => prec.left(seq('tuple', optional($._generics))),
    _generics: $ => seq(
      '<',
      $._type_expr,
      repeat(prec(3, seq(',', $._type_expr))),
      '>'
    ),

    // Functions
    function: $ => prec(4, seq(
      optional($.visibility),
      'fn',
      optional(alias($.function_ident, $.ident)),
      $.parameters,
      optional($.return_type),
      choice($.expression, $.struct, $.table, $.do_block),
    )),
    macro: $ => seq(
      optional($.visibility),
      'macro',
      alias(IDENT_MACRO, $.ident),
      $.capture,
      $.capture,
    ),
    proc_macro: $ => seq(
      optional($.visibility),
      'proc',
      alias(IDENT_MACRO, $.ident),
      $.parameters,
      choice($.expression, $.do_block)
    ),
    capture: $ => /`[^`]*`/,
    return_type: $ => seq(
      '->',
      $._type_expr,
    ),
    function_call: $ => prec(4, seq(
      choice(
        alias($.function_ident, $.ident),
        $._indexed,
        alias($.primitive, $.ident)),
      $.parameters,
      optional($.try_operator),
    )),
    macro_call: $ => seq(
      alias(IDENT_MACRO, $.ident),
      $.macro_parameters,
    ),
    parameters: $ => seq(
      '(',
      optional(prec(4, seq(
        $._parameter,
        repeat(seq(',', $._parameter)),
      ))),
      ')'
    ),
    macro_parameters: $ => seq(
      '(',
      $.expression,
      repeat(seq(',', $.expression)),
      ')',
    ),
    _parameter: $ => seq($._expression,
      optional(seq(alias(':', $._operator),
        $._type_expr))),

    // Comments
    comment: $ => seq('#', /.*/),
    doc_comment: $ => seq('@doc', $.string),
    suite: $ => seq('suite', $.string),
    test: $ => seq('test', $.string),
    primitive: $ => seq(choice(
      'number',
      'int',
      'float',
      'string',
      'atom',
      'function',
      'any',
      $._table_type,
      $._tuple_type,
    )),
    type: $ => IDENT_PASCAL,
    variable: $ => IDENT_SNAKE,
    type_alias: $ => prec.left(seq(
      optional($.visibility),
      'type',
      $.type,
      '=',
      $._type_expr,
    )),
    _type_expr: $ => prec(4,
      seq(
        choice(
          $.type,
          $.primitive,
          $.ident,
          $.atom,
          $.string,
          $.number,
          alias($.union_type, $.union),
          $.result_type,
          $.optional_type,
        ),
      )),
    result_type: $ => prec(4, seq('!', $._type_expr)),
    optional_type: $ => prec(5, seq($._type_expr, '?')),
    union_type: $ => prec(3, seq(
      choice($.type, $.atom, $.primitive),
      repeat1(seq('|', choice($.type, $.atom, $.primitive))),
    )),
    union: $ => prec.left(1, seq($._expression, repeat1(prec.left(1, seq('|', $._expression))))),
    do_block: $ => prec(4, seq(
      $._do,
      repeat($._expression),
      $._end,
    )),
    return: $ => prec.right(seq(
      'return',
      $._expression,
      repeat(prec.right(seq('|', $._expression)))
    )),
    _operation: $ => prec.left(1, seq(
      $._expression,
      $.operator,
      $._expression,
    )),
    field: $ => prec.right(5, choice(seq(
      $.ident,
      ':',
      $._type_expr,
    ), seq($.ident, '=', $._expression))),
    struct_definition: $ => prec(5, seq(
      optional($.visibility),
      'struct',
      $.type,
      $.table,
    )),
    struct: $ => prec(4, seq(
      $.type,
      $.table,
    )),
    table: $ => prec(0, seq(
      '{',
      // TODO: Allow any expression in a table
      optional(seq(
        choice($.field, $.function, $._type_expr),
        repeat(seq(',', choice($.field, $.function, $._type_expr))),
        optional(','),
      )),
      '}',
    )),
    match: $ => prec.right(seq(
      'match',
      $._expression,
      repeat1($.match_arm)
    )),
    match_arm: $ =>
      seq(
        '|',
        $.ident,
        optional(seq(
          choice('if', 'when'),
          $._expression
        )),
        '=>',
        $._expression
      ),
    for_loop: $ => seq(
      'for',
      $.ident,
      'in',
      choice($.range, $.ident),
      $.expression
    ),
    range: $ => prec.left(seq(choice(
      seq('..', choice($.ident, $.number)),
      seq(choice($.ident, $.number), '..'),
      seq(choice($.ident, $.number), '..', choice($.ident, $.number)),
    ))),
    scoped: $ => prec.right(seq(
      repeat1(
        seq(
          '.',
          choice(
            $.function_call,
            $.ident,
          ),
          optional($.index),
        )
      ),
      optional($._method),
    )),
    _method: $ => prec.right(1, seq(
      choice(':', '.'),
      $.function_call,
    )),
  }
});

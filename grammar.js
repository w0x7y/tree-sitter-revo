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
    expression: $ => prec.left($._expression),
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
      $.operation_expression,
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
      $.declaration,
      $._while,
    )),
    declaration: $ => prec.right(seq(
      choice(
        'let',
        seq(optional($.visibility_modifier), 'const'),
        'global',
      ),
      field('pattern', $._ident_pattern),
      optional(seq(
        ':',
        field('type', $._type_expr)
      )),
      '=',
      field('value', $._expression),
    )),
    spawn: $ => seq('spawn', $.function_call),
    if_expression: $ => prec.left(3, seq(
      'if',
      field('condition', prec(5, $.expression)),
      field('consequence', prec(5, $.expression)),
      optional(field('alternative', seq('else', $.expression))))),
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
    _ident_pattern: $ => choice(
      $.ident,
      $.idents,
    ),
    idents: $ => prec.left(seq(
      repeat1(seq($.ident, ',')),
      optional($.ident),
    )),
    function_ident: $ => prec(1, seq(optional('!'), IDENT_SNAKE, optional('?'))),
    index: $ => seq(
      '[',
      choice($._expression, $.index),
      ']'
    ),
    _while: $ => token('while'),
    _indexed: $ => prec(4, seq($.ident, $.index)),
    _pub: $ => token('pub'),
    visibility_modifier: $ => $._pub,
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
        choice($._expression, $._primitive),
        repeat(seq(',', choice($._expression, $._primitive))),
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
      optional($.visibility_modifier),
      'fn',
      optional(field('name', alias($.function_ident, $.ident))),
      field('parameters', $.parameters),
      optional(field('return_type', $.return_type)),
      field('body', choice($.expression, $.struct, $.table, $.do_block)),
    )),
    macro: $ => seq(
      optional($.visibility_modifier),
      'macro',
      alias(IDENT_MACRO, $.ident),
      $.capture,
      $.capture,
    ),
    proc_macro: $ => seq(
      optional($.visibility_modifier),
      'proc',
      field('name', alias(IDENT_MACRO, $.ident)),
      field('parameters', $.parameters),
      choice($.expression, $.do_block)
    ),
    capture: $ => /`[^`]*`/,
    return_type: $ => seq(
      '->',
      $._type_expr,
    ),
    function_call: $ => prec(4, seq(
      field('name', choice(
        alias($.function_ident, $.ident),
        $._indexed,
        alias($.primitive, $.ident))),
      field('parameters', $.parameters),
      optional($.try_operator),
    )),
    macro_call: $ => seq(
      field('name', alias(IDENT_MACRO, $.ident)),
      field('parameters', $.macro_parameters),
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
    _primitive: $ => $.primitive,
    type: $ => IDENT_PASCAL,
    variable: $ => IDENT_SNAKE,
    type_alias: $ => prec.left(seq(
      optional($.visibility_modifier),
      'type',
      field('name', $.type),
      '=',
      field('type', $._type_expr),
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
    union: $ => prec.left(seq($._expression, repeat1(prec.left(seq('|', $._expression))))),
    do_block: $ => prec(4, seq(
      $._do,
      field('body', repeat($._expression)),
      $._end,
    )),
    return: $ => prec.right(seq(
      'return',
      field('body', $._expression),
    )),
    operation_expression: $ => prec.left(2, seq(
      field('left', $._expression),
      $.operator,
      field('right', $._expression),
    )),
    field: $ => prec.right(5, choice(seq(
      optional('const'),
      field('name', $.ident),
      choice(
        seq(':', field('type', $._type_expr)),
        seq(
          optional(seq(':', field('type', $._type_expr))),
          '=',
          field('value', $._expression)),
      )
    ))),
    struct_definition: $ => prec(5, seq(
      optional($.visibility_modifier),
      'struct',
      field('name', $.type),
      field('body', $.table),
    )),
    struct: $ => prec(4, seq(
      field('name', $.type),
      choice(
        field('body', $.table),
        seq('(', field('body', $.table), ')'),
      ),
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
      field('value', $._expression),
      field('body', repeat1($.match_arm)),
    )),
    match_arm: $ =>
      prec(1, seq(
        '|',
        field('pattern', $._expression),
        optional(seq(
          choice('if', 'when'),
          field('condition', $._expression),
        )),
        '=>',
        field('value', $._expression),
      )),
    for_loop: $ => seq(
      'for',
      $.ident,
      'in',
      choice($.range, $.ident),
      $.expression
    ),
    range: $ => prec.left(seq(choice(
      seq('..', field('end', choice($.ident, $.number))),
      seq(field('start', choice($.ident, $.number)), '..'),
      seq(field('start', choice($.ident, $.number)), '..', field('end', choice($.ident, $.number))),
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

/**
 * @file revo is a dynamic language made for the joy of programming
 * @author doomy
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const IDENT_SNAKE = /[a-z_][a-zA-Z0-9_]*[\?\!]?/;
const IDENT_PASCAL = /[A-Z_][a-zA-Z0-9_]*/;
const IDENT_ANY = /[a-zA-Z_][a-zA-Z0-9_]*[\?\!]?/;
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
    _expression: $ => prec.left(10, choice(
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
      $.struct,
      $.table,
      $.for_loop,
      $._operation,
      $.tuple,
      $.return,
      $.union,
      $.union_type,
      $._table_type,
      $._tuple_type,
      $._indexed,
      $._association,
      $.unary_expression,
      seq($._expression, $._method),
      seq($._expression, $.scoped),
      seq($._not, $._expression),
      $.if_expression,
      prec.right(seq(
        optional(choice(
          'let',
          seq(optional($.visibility), 'const'),
          'global',
        )),
        $.ident,
        optional(seq(':', $._expression)),
        '=',
        $._expression,
      )),
    )),
    if_expression: $ => prec.left(3, seq(
      'if',
      prec(3, $.expression),
      prec(3, $.expression),
      optional(seq('else', $.expression)))),
    operator: $ => $._operator,
    unary_expression: $ => prec(1, seq(
      $.operator,
      $.number,
    )),
    _operator: $ => prec(0, token(choice(
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
    ))),

    // Identifiers
    ident: $ => prec.right(1, token(IDENT_SNAKE)),
    index: $ => seq(
      '[',
      choice($._expression, $.index),
      ']'
    ),
    _indexed: $ => prec(2, seq($.ident, $.index)),
    _pub: $ => 'pub',
    visibility: $ => $._pub,
    _do: $ => token('do'),
    _end: $ => token('end'),
    // Basic types
    number: $ => token(/[0-9][0-9_]*(\.[0-9_]+)?(e[0-9_]+)?/),
    _association: $ => prec(1, seq(
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
    atom: $ => prec(2, seq(
      // TODO: Would be nicer if this was immediate to only rep valid atoms
      token(':'),
      IDENT_SNAKE,
    )),
    string: $ => choice(
      $._string_single_line,
      $._string_multi_line,
    ),
    _string_single_line: $ => seq('"', STRING_PATTERN, '"'),
    _string_multi_line: $ => seq('"""', repeat(choice(STRING_PATTERN, '"', '""')), '"""'),
    _table_type: $ => prec.left(20, seq('table', optional($._generics))),
    _tuple_type: $ => prec.left(seq('tuple', optional($._generics))),
    _generics: $ => prec(1, seq(
      '<',
      choice(alias($.union_type, $.union), $.type, $.primitive),
      repeat(prec(1, seq(',', choice(alias($.union_type, $.union), $.type, $.primitive)))),
      '>'
    )),

    // Functions
    function: $ => prec(0, seq(
      optional($.visibility),
      'fn',
      optional($.ident),
      $.parameters,
      optional($.return_type),
      choice($.expression, $.struct, $.table, $.do_block),
    )),
    return_type: $ => prec(15,
      seq(
        '->',
        choice($.type, $.primitive, $.atom, alias($.union_type, $.union))
      )
    ),
    function_call: $ => prec(2, seq(
      choice(
        $.ident,
        $._indexed,
        alias($.primitive, $.ident)),
      $.parameters,
    )),
    parameters: $ => prec(2, seq(
      '(',
      optional(prec(2, seq(
        $._parameter,
        repeat(seq(',', $._parameter)),
      ))),
      ')'
    )),
    _parameter: $ => seq($._expression,
      optional(seq(alias(':', $._operator),
        $._type_expr))),

    // Comments
    comment: $ => seq('#', /.*/),
    doc_comment: $ => seq('@doc', $.string),
    suite: $ => seq('suite', $.string),
    test: $ => seq('test', $.string),
    primitive: $ => choice(
      'number',
      'int',
      'float',
      'string',
      'atom',
      'function',
      'any',
      $._table_type,
      $._tuple_type,
    ),
    type: $ => IDENT_PASCAL,
    variable: $ => IDENT_SNAKE,
    type_alias: $ => prec.left(seq(
      optional($.visibility),
      'type',
      $.type,
      '=',
      $._type_expr,
    )),
    _type_expr: $ => prec(20, choice(
      $.type,
      $.primitive,
      $.ident,
      $.union_type,
    )),
    union_type: $ => prec.left(25, seq(
      choice($.type, $.atom, $.primitive),
      repeat1(seq('|', choice($.type, $.atom, $.primitive))),
    )),
    union: $ => prec.left(100, seq($._expression, repeat1(prec.left(seq('|', $._expression))))),
    do_block: $ => seq(
      $._do,
      repeat($._expression),
      $._end,
    ),
    return: $ => prec.right(1, seq(
      'return',
      $._expression,
      repeat(prec.right(1, seq('|', $._expression)))
    )),
    _operation: $ => prec.left(4, seq(
      $._expression,
      $.operator,
      $._expression,
    )),
    field: $ => seq($.ident, optional(
      choice(
        seq(':', choice(
          $.atom,
          $.ident,
          $.type,
          $.primitive,
          // TODO: anonymous function
        )),
        seq('=', $._expression),
      )
    )),
    struct_definition: $ => prec(13, seq(
      optional($.visibility),
      'struct',
      $.type,
      $.table,
    )),
    struct: $ => prec(12, seq(
      $.type,
      $.table,
    )),
    table: $ => prec(11, seq(
      '{',
      optional(seq(
        seq(choice($.field, $.function),),
        repeat(seq(',', choice($.field, $.function))),
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
      prec(1000, seq(
        '|',
        $.ident,
        optional(seq(
          choice('if', 'when'),
          $._expression
        )),
        '=>',
        $._expression
      )),
    _binding: $ => choice(
      'let',
      seq(optional($.visibility), 'const'),
      'global',
    ),
    for_loop: $ => prec(11, seq(
      'for',
      $.ident,
      'in',
      choice($.range, $.ident),
      $.expression
    )),
    range: $ => prec.left(seq(choice(
      seq('..', choice($.ident, $.number)),
      seq(choice($.ident, $.number), '..'),
      seq(choice($.ident, $.number), '..', choice($.ident, $.number)),
    ))),
    scoped: $ => prec.right(4, seq(
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
    _method: $ => prec.left(2, seq(
      choice(':', '.'),
      $.function_call,
    )),
  }
});

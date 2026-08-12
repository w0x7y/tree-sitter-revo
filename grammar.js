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
export default grammar({
  name: "revo",
  word: $ => $.ident,
  extras: $ => [
    /\s/,
    $.comment,
    $.doc_comment,
  ],
  rules: {
    source: $ => repeat($._expression),
    operator: $ => $._operator,
    _operator: $ => token(choice(
      '+',
      '-',
      '*',
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
    )),
    ident: $ => token(IDENT_SNAKE),
    _pub: $ => 'pub',
    visibility: $ => $._pub,
    number: $ => /[0-9][0-9_]*(\.[0-9_]+)?(e[0-9_]+)?/,
    function: $ => seq(
      optional($.visibility),
      'fn',
      optional($.ident),
      $.parameters,
      optional($.return_type),
      $.expression,
    ),
    return_type: $ => prec(3,
      seq(
        '->',
        choice($.type, $.primitive, alias($.union_type, $.union))
      )
    ),
    function_call: $ => prec(3, seq(
      optional(choice(':', '.')),
      choice($.ident, alias($.primitive, $.ident)),
      $.parameters,
    )),
    parameters: $ => seq(
      '(',
      optional(seq(
        $._parameter,
        repeat(seq(',', $._parameter)),
      )),
      ')'
    ),
    _parameter: $ => seq($._expression,
      optional(seq(alias(':', $._operator),
        $._type_expr))),
    comment: $ => seq('#', /.*/),
    doc_comment: $ => seq('@doc', $.string),
    string: $ => choice(
      $._string_single_line,
      $._string_multi_line,
    ),
    _string_single_line: $ => seq('"', /[^"]*/, '"'),
    _string_multi_line: $ => seq('"""', repeat(choice(/[^"]+/, '"', '""')), '"""'),
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
    tuple: $ => seq('(', $._expression, repeat(seq(',', $._expression)), ')'),
    _table_type: $ => prec.left(10, seq('table', optional($._generics))),
    _tuple_type: $ => prec.left(seq('tuple', optional($._generics))),
    _generics: $ => prec(1, seq(
      '<',
      choice(alias($.union_type, $.union), $.type, $.primitive),
      repeat(prec(1, seq(',', choice(alias($.union_type, $.union), $.type, $.primitive)))),
      '>'
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
    atom: $ => token(seq(
      token.immediate(':'),
      IDENT_SNAKE,
    )),
    _type_expr: $ => prec(20, choice(
      $.type,
      $.primitive,
      $.ident,
      $.union_type,
    )),
    union_type: $ => prec.left(25, seq(
      choice($.type, $.primitive),
      repeat1(seq('|', choice($.type, $.primitive))),
    )),
    union: $ => prec.left(100, seq($._expression, repeat1(prec.left(seq('|', $._expression))))),
    _block: $ => seq(
      'do',
      repeat($._expression),
      'end',
    ),
    return: $ => prec.right(seq(
      'return',
      $._expression,
      repeat(prec.right(2, seq('|', $._expression)))
    )),
    _expression: $ => prec(1, choice(
      $.type,
      $.ident,
      'self',
      $.type_alias,
      $.struct_definition,
      $._block,
      $.atom,
      $.number,
      $.string,
      $.match,
      $.function,
      $.function_call,
      $.struct,
      $._for_loop,
      $._operation,
      $.tuple,
      $.return,
      $.union,
      $.union_type,
      $._table_type,
      $._tuple_type,
      $._if_expression,
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
       seq($._expression, '[', choice($._expression), ']'),
       // Empty struct
       seq('{', '}'), 
    )),
    _if_expression: $ =>  prec.left(seq('if', $._expression, $._expression, optional(seq('else', $._expression)))),
    _operation: $ => prec.left(4, seq(
      $._expression,
      $.operator,
      $._expression,
    )),
    expression: $ => prec(2, $._expression),
    field: $ => seq($.ident, optional(
        choice(
          seq(':', choice(
            $.atom,
            $.ident,
            $.type,
            $.primitive,
            // TODO: anonymous function
          )),
          seq('=', $.expression),
        )
      ),
    ),
    struct_definition: $ => seq(
      optional($.visibility),
      'struct',
      $.type,
      $.struct_body,
    ),
    struct: $ => seq(
      optional($.type),
      $.struct_body,
    ),
    struct_body: $ => seq(
      '{',
      // TODO: the `,` is not actually optional, but this is easier for dealing with commas
      repeat(seq(choice($.field, $.function), optional(','))),
      '}',
    ),
    match: $ => prec.left(seq(
      'match',
      $._expression,
      repeat1($.match_arm)
    )),
    match_arm: $ =>    
      prec(6, seq(
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
    _for_loop: $ => prec(7, seq(
      'for',
      $.ident,
      'in',
      choice($.range, $.ident),
      $._expression,
    )),
    range: $ => seq(
      '[',
      optional(choice($.ident, $.number)),
      '..',
      optional(choice($.ident, $.number)),
      ']'
    ),
  }
});


/**
 * @file revo is a dynamic language made for the joy of programming
 * @author doomy
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const IDENT_SNAKE = /[a-z_][a-zA-Z0-9_]*[\?\!]?/;
const IDENT_PASCAL = /[A-Z_][a-zA-Z0-9_]*/;
export default grammar({
  name: "revo",
  extras: $ => [
    /\s/,
    $.comment,
    $.doc_comment,
  ],
  rules: {
    source_file: $ => repeat($._statement),
    _pub: $ => 'pub',
    _do: $ => 'do',
    _end: $ => 'end',
    _for: $ => 'for',
    _in: $ => 'in',
    _else: $ => 'else',
    _concat_op: $ => '~',
    _pipe_op: $ => '|',
    _eq_op: $ => '=',
    _arrow_op: $ => '->',
    _fat_arrow_op: $ => '=>',
    _assign_type_op: $ => ':',
    _math_op: $ => choice(
      '+',
      '-',
      '*',
      '/',
      '%',
      $._eq_op,
      '+=',
      '-=',
      '/=',
      '%=',
    ), 
    _compare_op: $ =>  choice('<', '>', '==', '<=', '>=', "!="),
    operator: $ => choice(
      $._math_op,
      $._compare_op,
      $._concat_op,
    ),
    ident: $ => prec(5, choice(
      $._ident_var,
      $._ident_type,
    )),
    _ident_var: $ => IDENT_SNAKE,
    _ident_type: $ => IDENT_PASCAL,
    number: $ => /[0-9][0-9_]*(\.[0-9_]+)?(e[0-9_]+)?/,
    function_definition: $ => seq(
      optional($._pub),
      'fn',
      $.ident,
      $.parameters,
      optional(
        seq($._arrow_op, $.type)
      ),
      $._statement,
    ),
    function_call: $ => seq(
      $.ident,
      $.parameters,
    ),
    parameters: $ => seq(
      '(',
      optional($._parameter),
      repeat(seq(',', $._parameter)),
      ')'
    ),
    index: $ => choice(
      seq('[',
        choice(
          alias($._ident_var, $.ident),
          $.atom,
        ),
      ']')
    ),
    _parameter: $ => seq($.ident, optional(seq(alias($._assign_type_op, $.operator), $.type))),
    comment: $ => seq('#', /.*/),
    doc_comment: $ => seq('@doc', $.string),
    string: $ => choice(
      $._string_single_line,
      $._string_multi_line,
    ),
    _string_single_line: $ => seq('"', /[^"]*/, '"'),
    _string_multi_line: $ => seq('"""', repeat(choice(/[^"]+/, '"', '""')), '"""'),
    tuple: $ => seq('(', $.expression, repeat(seq(',', $.expression)), ')'),
    _table_type: $ => prec.left(seq('table', optional($._generics))),
    _tuple_type: $ => prec.left(seq('tuple', optional($._generics))),
    _generics: $ => seq(
      '<',
      $.type,
      repeat(seq(',', $.type)),
      optional(','),
      '>'
    ),
    primitive: $ => choice(
      'number',
      'int',
      'float',
      'string',
      'atom',
      // TODO: table generics
      $._table_type,
      $._tuple_type,
      'function',
      // TODO: tuple generics
      'any',
    ),
    union_type: $ => prec(1, prec.left(seq(
      choice($.primitive, alias($._user_type, $.type), $.atom),
      repeat1(seq($._pipe_op, choice($.primitive, alias($._user_type, $.type), $.atom)))
    ))),
    _user_type: $ => $._ident_type,
    type: $ => prec(2, choice(
      $.primitive,
      $._user_type,
      $.union_type,
    )),
    type_alias: $ => seq(
      optional($._pub),
      'type',
      alias($._user_type, $.type),
      alias($._eq_op, $.operator),
      $.type,
    ),
    atom: $ => token(seq(
      token.immediate(':'),
      IDENT_SNAKE,
    )),
    block: $ => seq(
      $._do,
      repeat($._statement),
      $._end
    ),
    _statement: $ => prec(1, choice(
      $.return_statement,
      $.expression,
      $.function_definition,
      $.type_alias,
      $.assignment,
      $.struct_definition,
      $.block,
      $.struct_definition
      // TODO: other kinds of statements
    )),
    return_statement: $ => seq(
      'return',
      $.expression
    ),
    expression: $ => prec(30, prec.left(choice(
      $.ident,
      $.atom,
      $.number,
      $.string,
      $.match,
      $.function_call,
      $.struct,
      $._for_loop,
      seq($.expression, $.operator, $.expression),
      $._if_expression,
    ))),
    field: $ => seq($.ident, optional(
        choice(
          seq(alias($._assign_type_op, $.operator), choice(
            $.atom,
            $.ident,
            $.type,
            // TODO: anonymous function
          )),
          seq(alias($._eq_op, $.operator), choice(
            $.expression,
          )),
        )
      ),
    ),
    struct_definition: $ => prec(1, seq(
      optional($._pub),
      'struct',
      alias($._user_type, $.type),
      $.struct_body,
    )),
    struct: $ => prec(2, seq(
      alias($._user_type, $.type),
      $.struct_body,
    )),
    struct_body: $ => seq(
      '{',
      // TODO: the `,` is not actually optional, but this is easier for dealing with commas
      repeat(seq(choice($.field, $.function_definition), optional(','))),
      '}',
    ),
    match: $ => prec.left(20, seq(
      'match',
      $.expression,
      repeat1($.match_arm)
    )),
    match_arm: $ =>    
      prec(15, seq(
        alias($._pipe_op, $.operator),
        $.ident,
        optional(seq(
          choice('if', 'when'),
          $.expression
        )),
        alias($._fat_arrow_op, $.operator),
        $.expression
      )),
    _binding: $ => choice(
      'let',
      seq(optional('pub'), 'const'),
      'global',
    ),
    _for_loop: $ => seq(
      'for',
      $.ident,
      'in',
      choice($.range, $.ident),
      $._statement,
    ),
    _if_expression: $ => prec.right(seq(
      'if',
      $.expression,
      $.expression,
      repeat(seq($._else, $.expression)),
    )),
    range: $ => seq(
      '[',
      optional(choice($.ident, $.number)),
      '..',
      optional(choice($.ident, $.number)),
      ']'
    ),
    assignment: $ => seq(
      optional($._binding),
      $.ident,
      optional(seq(':', $.union_type)),
      alias($._eq_op, $.operator),
      $.expression,
    )
  }
});


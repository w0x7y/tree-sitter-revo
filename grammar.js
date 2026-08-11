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
  rules: {
    source_file: $ => repeat(
      choice(
        $._statement,
        $.comment,
        $.doc_comment,
      )
    ),
    _pub: $ => 'pub',
    _do: $ => 'do',
    _end: $ => 'end',
    _for: $ => 'for',
    _in: $ => 'in',
    _if: $ => 'if',
    _else: $ => 'else',
    _pipe_op: $ => '|>',
    operator: $ => choice(
      $._pipe_op,
      $._pipe_op,
      '+',
      '-',
      '*',
      '/',
      '%',
      '~',
      $._comparison,
    ), 
    _comparison: $ =>  choice('<', '>', '==', '<=', '>=', "!="),
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
      $.parameter_list,
      optional(
        seq('->', $.type)
      ),
      $._statement,
    ),
    function_call: $ => seq(
      $.ident,
      '(',
      // TODO: parameters
      ')',
    ),
    parameter_list: $ => seq(
      '(',
      // TODO: parameters
      ')'
    ),
    comment: $ => seq('#', /.*/),
    doc_comment: $ => seq('@doc', $.string),
    string: $ => choice(
      $._string_single_line,
      $._string_multi_line,
    ),
    _string_single_line: $ => seq('"', /[^"]*/, '"'),
    _string_multi_line: $ => seq('"""', repeat(choice(/[^"]+/, '"', '""')), '"""'),
    _table_type: $ => prec.left(seq('table', optional(
      seq(
        '<',
        $.type,
        repeat(seq(',', $.type)),
        optional(','),
        '>'
      )
    ))),
    primitive_type: $ => choice(
      'number',
      'int',
      'float',
      'string',
      'atom',
      // TODO: table generics
      $._table_type,
      'function',
      // TODO: tuple generics
      'tuple',
      'any',
    ),
    union_type: $ => prec(1, prec.left(seq(
      choice($.primitive_type, $.user_type, $.atom),
      repeat1(seq('|', choice($.primitive_type, $.user_type, $.atom)))
    ))),
    user_type: $ => $._ident_type,
    type: $ => prec(2, choice(
      $.primitive_type,
      $.user_type,
      $.union_type,
    )),
    type_alias: $ => seq(
      optional($._pub),
      'type',
      $.user_type,
      '=',
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
    _statement: $ => choice(
      $.return_statement,
      $.expression,
      $.function_definition,
      $.type_alias,
      $.assignment,
      $.struct,
      $.block,
      // TODO: other kinds of statements
    ),
    return_statement: $ => seq(
      'return',
      $.expression
    ),
    expression: $ => prec(10, prec.left(choice(
      $.ident,
      $.atom,
      $.number,
      $.string,
      $.match,
      $.function_call,
      $._for_loop,
      $.comparison_expression,
      $._operator_expression,
      // $._if_expression,
      // TODO: other kinds of expressions
    ))),
    comparison_expression: $ => prec(10, choice(
      seq($.expression, $.operator, $.expression),
    )),
    _operator_expression: $ => choice(
      seq($.expression, $.operator, $.expression),
    ),
    field: $ => seq($.ident, optional(
        seq(':', choice(
          $.atom,
          $.ident,
          $.type,
          // TODO: anonymous function
        ))
      ),
    ),
    struct: $ => prec(2, seq(
      optional($._pub),
      'struct',
      $.user_type,
      '{',
      // TODO: the `,` is not actually optional, but this is easier for dealing with commas
      repeat(seq(choice($.field, $.function_definition, $.comment), optional(','))),
      '}',
    )),
    match: $ => prec.dynamic(1, prec.left(seq(
      'match',
      $._ident_type,
      repeat1($.match_arm)
    ))),
    match_arm: $ =>    
      prec.dynamic(2, seq(
        '|',
        $.ident,
        optional(
          choice(
            seq('if', $.comparison_expression),
            seq('while', $.expression),
          ),
        ),
        '=>',
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
      $._if,
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
      '=',
      $.expression,
    )
  }
});


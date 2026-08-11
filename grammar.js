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
    _pipe_op: $ => '|>',
    ident: $ => prec(5, choice(
      $._ident_var,
      $.ident_type,
    )),
    _ident_var: $ => IDENT_SNAKE,
    ident_type: $ => IDENT_PASCAL,
    number: $ => /[0-9][0-9_]*(\.[0-9_]+)?(e[0-9_]+)?/,
    function_definition: $ => seq(
      optional($._pub),
      'fn',
      $.ident,
      $.parameter_list,
      optional(
        seq('->', $.union_type)
      ),
      choice(
        $.block,
        $._statement
      ),
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
    _table_type: $ => seq('table', optional(
      seq(
        '<',
        choice($.type, $.union_type),
        repeat(seq(',', choice($.type, $.union_type), optional(','))),
        '>'
      )
    )),
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
    ),
    union_type: $ => prec(1, prec.left(seq(
      choice($.type, $.atom),
      repeat(seq('|', choice($.type, $.atom)))
    ))),
    user_type: $ => $.ident_type,
    type: $ => choice(
      $.primitive_type,
      $.user_type,
    ),
    type_alias: $ => seq(
      optional($._pub),
      'type',
      $.ident_type,
      '=',
      $.union_type,
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
      // TODO: other kinds of statements
    ),
    return_statement: $ => seq(
      'return',
      $.expression
    ),
    expression: $ => prec(10, choice(
      $.ident,
      $.atom,
      $.number,
      $.string,
      $.match,
      $.function_call,
      $._for_loop,
      $._pipe,
      // TODO: other kinds of expressions
    )),
    field: $ => seq($.ident, optional(
        seq(':', choice(
          $.atom,
          $.ident,
          $.union_type,
          // TODO: anonymous function
        ))
      ),
    ),
    struct: $ => prec(2, seq(
      optional($._pub),
      'struct',
      $.ident_type,
      '{',
      optional(choice($.field, $.function_definition)),
      repeat(seq(',', choice($.field, $.function_definition))),
      optional(','),
      '}',
    )),
    match: $ => (prec.right(seq(
      'match',
      $.ident,
      repeat1(
        seq(
          '|',
          $.ident,
          optional(seq('when', $.expression)),
          '=>',
          choice(
            $.block,
            $._statement
          )
        )
      )
    ))),
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
      choice($.block, $._statement),
    ),
    _pipe: $ => seq(
      $._pipe_op,
      $.expression,
    ),
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


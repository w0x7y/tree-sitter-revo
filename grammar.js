/**
 * @file revo is a dynamic language made for the joy of programming
 * @author doomy
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const IDENT_SNAKE = /[a-z_][a-zA-Z0-9_]*/;
const IDENT_CONST = /[A-Z_][A-Z0-9_]*/;
const IDENT_MACRO = /[a-z_][a-zA-Z0-9_]*\??\!/;
const IDENT_PASCAL = /[A-Z_][a-zA-Z0-9_]*/;
const IDENT_ANY = /[a-zA-Z_][a-zA-Z0-9_]*/;
export default grammar({
  name: "revo",
  extras: $ => [
    /\s/,
    $.documentation,
    $.comment,
    $.suite,
    $.test,
    $.import,
  ],
  externals: $ => [
    $.documentation,
    $.atom,
    $.string,
    $.range,
  ],
  rules: {
    source: $ => repeat($._expression),
    expression: $ => prec.left($._expression),
    _not: $ => token('not'),
    _expression: $ => prec.left(3, choice(
      $.type,
      $.ident,
      $.self,
      $.directive,
      $.type_alias,
      $.struct_definition,
      $.do_block,
      $.if_expression,
      $.while_expression,
      $.loop_expression,
      $.operation_expression,
      $.unary_expression,
      $.for_loop_expression,
      $.comp_expression,
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
      $.tuple,
      $.return,
      $.union,
      $._table_type,
      $._tuple_type,
      $._indexed,
      $._association,
      $.spawn,
      $.break,
      $.continue,
      $.capture,
      $.yield,
      seq($._expression, $._method),
      seq($._expression, $.scoped),
      seq($._not, $._expression),
      $.declaration,
      $.range,
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
    if_expression: $ => prec.left(seq(
      'if',
      field('condition', $.expression),
      field('consequence', $.expression),
      optional(seq('else', field('alternative', $.expression))))),
    operator: $ => $._operator,
    unary_expression: $ => seq(
      $.operator,
      $.number,
    ),
    yield: $ => token('yield'),
    comp_expression: $ => prec(4, seq(
      'comp',
      field('body', $._expression),
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
    ident: $ => choice(IDENT_SNAKE, IDENT_CONST),
    _ident_pattern: $ => choice(
      $.ident,
      $.idents,
    ),
    idents: $ => prec.left(seq(
      choice(
        seq('(', repeat1(seq($.ident, ',')), optional($.ident), ')',),
        seq(repeat1(seq($.ident, ',')), optional($.ident)),
      ),
    )),
    _field_ident: $ => choice(
      $.ident,
      seq(
        '[',
        $._expression,
        ']',
      )
    ),
    import: $ => seq('import', $.string),
    self: $ => token('self'),
    function_ident: $ => prec(1, seq(
      choice(IDENT_SNAKE, alias($.primitive, 'hidden')),
      optional('?'))),
    index: $ => seq(
      '[',
      choice($._expression, $.index, $.range),
      ']'
    ),
    _indexed: $ => prec(4, seq($.ident, $.index)),
    _pub: $ => token('pub'),
    visibility_modifier: $ => $._pub,
    _do: $ => seq(token('do'), field('label', optional($._label))),
    _loop: $ => seq(token('loop'), field('label', optional($._label))),
    _while: $ => seq(token('while'), field('label', optional($._label))),
    _label: $ => seq('/', $.ident),
    _break_return: $ => field('label', seq($._label, '(', field('condition', $._expression), ')',)),
    _end: $ => token('end'),
    // Basic types
    number: $ => token(/[0-9][0-9_]*(\.[0-9_]+)?(e[0-9_]+)?/),
    _association: $ => prec(3, seq(
      '(',
      $._expression,
      ')',
      optional('?'),
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
        $._indexed,)),
      field('parameters', $.parameters),
      optional('?'),
    )),
    macro_call: $ => seq(
      field('name', alias(IDENT_MACRO, $.ident)),
      field('parameters', $.macro_parameters),
    ),
    parameters: $ => seq(
      '(',
      optional($.self),
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
    _parameter: $ => seq(field('name', $._expression),
      optional(seq(':', field('type', $._type_expr)))),

    // Comments
    comment: $ => seq('#', /.*/),
    directive: $ => seq('@', $.ident),
    suite: $ => seq('suite', $.string),
    test: $ => seq(
      'test',
      optional(seq('/', 'skip')),
      field("name", $.string),
      field("body", $.do_block)),
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
          $.tuple,
        ),
      )),
    result_type: $ => prec(4, seq('!', $._type_expr)),
    optional_type: $ => prec(5, seq($._type_expr, '?')),
    union_type: $ => prec.left(seq(
      choice($.type, $.atom, $.primitive, $.ident),
      repeat1(seq('|', choice($.type, $.atom, $.primitive, $.ident))),
    )),
    union: $ => prec.left(seq($._expression, repeat1(prec.left(seq('|', $._expression))))),
    do_block: $ => prec(4, seq(
      $._do,
      field('body', repeat($._expression)),
      $._end,
    )),
    break: $ => seq('break', optional(field('label', $._break_return))),
    continue: $ => seq('continue', optional(field('label', $._label))),
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
      field('name', $._field_ident),
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
    table: $ => seq(
      '{',
      // TODO: Allow any expression in a table
      optional(
        choice(seq(
          choice($.field, $.function, $._type_expr),
          repeat(seq(',', choice($.field, $.function, $._type_expr))),
          optional(','),
        ),
          $.capture,
        )),
      '}',
    ),
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
    for_loop_expression: $ => prec(1, seq(
      'for',
      $.ident,
      'in',
      choice($.range, $.ident),
      $.expression
    )),
    while_expression: $ => seq(
      $._while,
      field('condition', $._expression),
      field('body', $.expression),
    ),
    loop_expression: $ => seq(
      $._loop,
      field('body', $.expression),
    ),
    // _range_choice: $ => choice($.ident, $.number, $.unary_expression),
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

/**
 * @file revo is a dynamic language made for the joy of programming
 * @author doomy
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// comma separated list with at least one element
function repeat_comma1(rule) {
  return seq(
    rule,
    repeat(seq(',', rule)),
    optional(','),
  );
}

// comma separated list
function repeat_comma(rule) {
  return optional(repeat_comma1(rule));
}

const IDENT_SNAKE = /[a-z_][a-zA-Z0-9_]*/;
const IDENT_MACRO = /[a-z_][a-zA-Z0-9_]*\??\!/;
const IDENT_PASCAL = /[A-Z_][a-zA-Z0-9_]*/;
export default grammar({
  name: "revo",
  extras: $ => [
    /\s/,
    $.documentation,
    $.comment,
    $.multiline_comment,
    $.module_doc,
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
  // conflicts: $ => [
  //   [ $.ident, $.type ]
  // ],
  rules: {
    source: $ => repeat($._expression),
    expression: $ => prec.left($._expression),
    _not: $ => token('not'),
    _expression: $ => prec.left(3, choice(
      $.ident,
      $.self,
      $.directive,
      $.do_block,
      $.type_expression,
      $.conditional_expression,
      $.while_expression,
      $.loop_expression,
      $.operation_expression,
      $.unary_expression,
      $.for_loop_expression,
      $.comp_expression,
      $.union_expression,
      $.atom,
      $.number,
      $.string,
      $.match,
      $.function,
      $.function_call,
      $.macro,
      $.macro_call,
      $.proc_macro,
      $.table,
      $.return,
      $._table_type,
      $._indexed,
      $._association,
      $.spawn,
      $.break,
      $.continue,
      $.capture,
      $.yield,
      $._scoped_expression,
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
      field('pattern',choice(
        $.ident,
        $.table,
      )),
      optional(seq(
        ':',
        field('type', $._revo_type)
      )),
      '=',
      field('value', $._expression),
    )),
    spawn: $ => seq('spawn', $.function_call),
    conditional_expression: $ => prec.left(seq(
      choice('if', 'unless'),
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
    ident: $ => choice(IDENT_SNAKE, IDENT_PASCAL),
    optional_type: $ =>  prec(2, seq($._type_or_primitive_or_optional, '?')),
    type: $ => prec(1, IDENT_PASCAL),
    _type_or_primitive_or_optional: $ => prec.left(choice($.optional_type, $.type, $.primitive)),
    import: $ => seq('import', $.string),
    self: $ => token('self'),
    // function_ident: $ => prec(1, seq(
    //   choice(IDENT_SNAKE, alias($.primitive, 'hidden')),
    //   optional('?'))),
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
    integer: $ => token(/\d+/),
    _association: $ => prec(3, seq(
      '(',
      $._expression,
      ')',
      optional('?'),
    )),
    _table_type: $ => seq('table', optional($._generics)),
    _generics: $ => seq(
      '<',
      $._revo_type,
      repeat(prec(3, seq(',', $._revo_type))),
      '>'
    ),

    // Functions
    function: $ => prec(4, seq(
      optional($.visibility_modifier),
      'fn',
      optional(seq(field('name', seq($.ident, repeat(seq(choice(':', '.'), $.ident)))), optional('?'))),
      $.parameters,
      optional(field('return_type', $.return_type)),
      field('body', choice($.expression, $.table, $.do_block)),
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
      $._revo_type,
    ),
    function_call: $ => prec(4, seq(
      field('name', choice(
        seq($.ident, optional('?')),
        $._indexed,)),
      $.parameters,
      optional('?'),
    )),
    macro_call: $ => seq(
      field('name', alias(IDENT_MACRO, $.ident)),
      $.macro_parameters,
    ),
    parameters: $ => seq(
      '(',
      optional($.self),
      optional(prec(4, seq(
        $.parameter,
        repeat(seq(',', $.parameter)),
      ))),
      ')'
    ),
    macro_parameters: $ => seq(
      '(',
      $.expression,
      repeat(seq(',', $.expression)),
      ')',
    ),
    parameter: $ => seq(
      // Marks paramater as optional
      optional('?'),
      field('name', $._expression),
      // Optional parameter type
      optional(seq(':', field('type', $._revo_type))),
      // Default function
      optional(
        seq(
          '=',
          field('default', $._revo_type),
        ),
      ),
    ),

    // Comments
    comment: $ => seq('#', /.*/),
    multiline_comment: $ => token(seq(
      '##',
      repeat(choice(
        /[^#]/, // any non-#
        /#[^#]/, // lone # not followed by #
      )),
      '##',
    )),

    shebang: $ => token(seq(
      '#!',
      optional(/\s+/),
      '/',
      /[^\r\n]*/,
    )),

    module_doc: $ => seq(
      choice(
        field('shebang', $.shebang),
        '#!',
      ),
      field('content', $.module_doc_content),
      '!#',
    ),

    module_doc_content: $ => repeat1(choice(
      $.doc_tag,
      $._doc_text,
    )),

    doc_tag: $ => token(/@[a-zA-Z_][a-zA-Z0-9_]*/),

    _doc_text: $ => token(repeat1(choice(
      /[^!@]/,        // Any character except ! and @
      /![^#]/,        // ! not followed by #
      /@[^a-zA-Z_]/,  // @ not followed by an identifier start
    ))),

    directive: $ => seq('@', $.ident),
    suite: $ => seq('suite', $.string),
    test: $ => seq(
      'test',
      optional(seq('/', 'skip')),
      field("name", $.string),
      field("body", $.do_block)),
    primitive: $ => seq(choice(
      'num',
      'number',
      'int',
      'string',
      'atom',
      'function',
      'any',
      $._table_type,
    )),
    _primitive: $ => $.primitive,
    variable: $ => IDENT_SNAKE,
    type_expression: $ => seq(
      optional($.visibility_modifier),
      'type',
      field('type', $.type),
      '=',
      field('value', $._revo_type),
    ),
    // any revo type
    _revo_type: $ => prec(4,
      seq(
        choice(
          $._type_or_primitive_or_optional,
          $.ident,
          $.atom,
          $.string,
          $.number,
          $.union_type,
          $.result_type,
          $.table,
        ),
      )),
    result_type: $ => seq('!', $._revo_type),
    union_type: $ => prec.left(seq(
      choice($.atom, $.ident, $._type_or_primitive_or_optional),
      repeat1(seq('|', choice($.atom, $.ident, $._type_or_primitive_or_optional))),
    )),
    union_expression: $ => prec.left(seq($._expression, repeat1(prec.left(seq('|', $._expression))))),
    do_block: $ => seq(
      $._do,
      field('body', repeat($._expression)),
      $._end,
    ),
    break: $ => seq('break', optional(field('label', $._break_return))),
    continue: $ => seq('continue', optional(field('label', $._label))),
    return: $ => prec.right(seq(
      'return',
      field('body', $._expression),
    )),
    operation_expression: $ => prec.left(1, seq(
      field('left', $._expression),
      $.operator,
      field('right', $._expression),
    )),
    _space: $ => token(/\s/),
    table: $ => seq(
      '{',
      optional(repeat_comma(choice($.field, $.ident, $._expression))),
      '}',
    ),
    _type_assignment: $ => seq(':', $._space, field('type', $._revo_type)),
    _assignment: $ => seq('=', field('value', $._expression)),
    field: $ => prec(1, seq(
      optional('const'),
      field('name', choice(
        $._expression,
        seq(
          '[',
          $._expression,
          ']',
        )
      )),
      choice(
        $._type_assignment,
        $._assignment,
        seq($._type_assignment, $._assignment),
      ))),
    match: $ => prec.right(seq(
      'match',
      field('value', $._expression),
      field('body', repeat1($.match_arm)),
    )),
    match_arm: $ =>
      prec.left(1, seq(
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
    _scoped_expression: $ => prec(3, seq($._expression, $.scoped)),
    scoped: $ => prec.right(seq(
      repeat1(
        seq(
          choice(
            seq('.', choice($.function_call, $.ident, $.integer)),
            seq(':', $.function_call),
          ),
          optional($.index),
        )
      ),
    )),
  }
});

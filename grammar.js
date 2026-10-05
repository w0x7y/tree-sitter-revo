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
// The compiler accepts every keyword as a contextual record or signature name.
const TYPE_NAME_KEYWORDS = [
  'const', 'let', 'macro', 'test', 'suite', 'skip', 'type', 'fn', 'if',
  'unless', 'else', 'match', 'when', 'do', 'end', 'loop', 'for', 'while',
  'global', 'in', 'break', 'continue', 'return', 'import', 'spawn', 'yield',
  'and', 'or', 'not', 'band', 'bor', 'bxor', 'shl', 'shr', 'comp', 'proc',
  'orelse', 'pub', 'declare',
];
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
  ],
  externals: $ => [
    $.documentation,
    $.atom,
    $.string,
    $.range,
    $._generic_receiver,
    $._open_range_dots,
    $._closed_range_dots,
    $._generic_path_head,
    $._generic_path_receiver,
  ],

  rules: {
    source: $ => repeat(choice($._expression, ';')),
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
      $._generic_path_call,
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
      $.ambient_declaration,
      $.import,
      $.range,
      $._try_expression,
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
    unary_expression: $ => prec.right(5, seq(
      alias(token('-'), $.operator),
      $._expression,
    )),
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
      '*=',
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
      '~=',
      '|>',
      '//',
      'band',
      'bor',
      'bxor',
      'shl',
      'shr',
      'orelse',
      'and',
      'or',
    ))),

    // Identifiers
    ident: $ => choice(IDENT_SNAKE, IDENT_PASCAL),
    optional_type: $ =>  prec(2, seq(choice($._type_or_primitive_or_optional, $.ident, alias(/[A-Za-z_][A-Za-z0-9_!?]*[A-Za-z0-9_!]/, $.ident)), '?')),
    type: $ => prec(1, IDENT_PASCAL),
    _type_or_primitive_or_optional: $ => prec.left(choice($.optional_type, $.type, $.primitive)),
    import: $ => seq('import', choice($.string, $.import_group)),
    import_group: $ => seq('{', repeat_comma(choice(
      $.string,
      $.import_binding,
    )), '}'),
    import_binding: $ => seq(field('name', $.ident), '=', field('path', $.string)),
    self: $ => token('self'),
    // function_ident: $ => prec(1, seq(
    //   choice(IDENT_SNAKE, alias($.primitive, 'hidden')),
    //   optional('?'))),
    index: $ => seq(
      '[',
      choice($._expression, $.index, $.range),
      ']'
    ),
    _identifier_indexed: $ => prec(4, seq($.ident, $.index)),
    _indexed: $ => choice($._identifier_indexed, prec.left(5, seq($._expression, $.index))),
    _try_expression: $ => prec.left(5, seq($._expression, '?')),
    _pub: $ => token('pub'),
    visibility_modifier: $ => $._pub,
    _do: $ => seq(token('do'), field('label', optional($._label))),
    _loop: $ => seq(token('loop'), field('label', optional($._label))),
    _while: $ => seq(token('while'), field('label', optional($._label))),
    _label: $ => seq('/', $.ident),
    _break_return: $ => field('label', seq($._label, '(', field('condition', $._expression), ')',)),
    _end: $ => token('end'),
    // Basic types
    number: $ => token(choice(
      /0[xX][0-9a-fA-F_]+(\.[0-9a-fA-F_]+)?([pP][+-]?[0-9_]+)?/,
      /0[xX][0-9a-fA-F_]+\.[pP][+-]?[0-9_]+/,
      /0[bB][01_]+/,
      /0[oO][0-7_]+/,
      /[0-9][0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?/,
      /[0-9][0-9_]*\.[eE][+-]?[0-9_]+/,
    )),
    integer: $ => token(/\d+/),
    _association: $ => prec(3, seq(
      '(',
      optional($._expression),
      ')',
    )),
    _table_type: $ => seq('table', optional($._type_arguments)),
    _generics: $ => seq(
      '<',
      $._revo_type,
      repeat(prec(3, seq(',', $._revo_type))),
      optional(','),
      '>'
    ),

    _type_arguments: $ => seq('<', $._revo_type, repeat(seq(',', $._revo_type)), '>'),

    // Functions
    function: $ => prec(4, seq(
      optional($.visibility_modifier),
      'fn',
      optional(seq(field('name', seq($.ident, repeat(seq(choice(':', '.'), $.ident)))), optional('?'))),
      optional($._generics),
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
    return_type: $ => prec.right(5, seq(
      '->',
      $._revo_type,
    )),
    _call_generic_ident: $ => alias(/[A-Za-z_][A-Za-z0-9_!?]*/, $.ident),
    _call_generics: $ => seq(
      '<',
      repeat_comma($._call_generic_ident),
      '>',
    ),
    function_call: $ => choice($._ordinary_function_call, $._generic_function_call, $._postfix_function_call),
    // Statement prefixes consume their own values/bodies; parentheses expose
    // those results as callees without taking arguments away from `break`.
    _postfix_function_call: $ => prec.left(6, seq(
      field('name', choice(
        $._association, $.function_call, $._indexed, $._scoped_expression,
        $._try_expression, $.table, $.number, $.string, $.atom, $.self, $.do_block,
      )),
      alias($._call_parameters, $.parameters),
    )),
    _ordinary_function_call: $ => prec(4, seq(
      choice(
        field('name', seq($.ident, optional('?'))),
        field('name', $._identifier_indexed),
      ),
      alias($._call_parameters, $.parameters),
    )),
    _generic_function_call: $ => prec(4, seq(
      field('name', alias($._generic_receiver, $.ident)),
      $._call_generics,
      alias($._call_parameters, $.parameters),
    )),
    // Generic calls require the whole receiver to be a bare/dotted path.
    // Scoped postfixes on calls, indexes, or other values use ordinary calls only.
    _generic_path_call: $ => seq(
      alias($._generic_path_head, $.ident), alias($._generic_scoped, $.scoped),
    ),
    _path_generic_function_call: $ => prec(4, seq(
      field('name', alias($._generic_path_receiver, $.ident)), $._call_generics, alias($._call_parameters, $.parameters),
    )),
    _generic_scoped: $ => seq(
      repeat(seq('.', $.ident)),
      '.', alias($._path_generic_function_call, $.function_call),
    ),
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
    _call_parameters: $ => seq(
      token.immediate('('),
      optional($.self),
      optional(prec(4, seq($.parameter, repeat(seq(',', $.parameter))))),
      ')'
    ),
    macro_parameters: $ => seq(
      '(',
      repeat_comma($.expression),
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
          field('default', $._expression),
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
      field('type', seq(choice($.type, $.ident), repeat(seq('.', choice($.type, $.ident))))),
      optional($._generics),
      '=',
      field('value', $._revo_type),
    ),
    ambient_declaration: $ => seq(
      optional($.visibility_modifier),
      'declare',
      field('name', seq(choice($.ident, alias(choice('type', 'import'), $.ident)), repeat(seq('.', $.ident)))),
      optional($._generics),
      '=',
      field('value', $._revo_type),
    ),
    function_signature: $ => seq(
      'fn',
      optional($._generics),
      alias($._signature_parameters, $.parameters),
      optional($.return_type),
    ),
    // Function types accept names and variadics, rather than call expressions.
    // Alias their nodes to the established parameter AST used by the queries.
    _signature_parameters: $ => seq('(', repeat_comma(alias($._signature_parameter, $.parameter)), ')'),
    _signature_parameter: $ => seq(
      optional('?'),
      field('name', $._type_ident),
      optional(seq(':', field('type', $._revo_type))),
      optional('...'),
    ),
    _contextual_type_name: $ => prec(4, alias(choice(...TYPE_NAME_KEYWORDS, 'self'), $.ident)),
    _type_ident: $ => choice($._named_type_ident, alias(/[A-Za-z_][A-Za-z0-9_!?]*/, $.ident), alias(choice('num', 'number', 'int', 'string', 'atom', 'function', 'any', 'table'), $.ident), $._contextual_type_name),
    // Keep a final '?' as the existing optional_type suffix, while admitting
    // compiler identifier continuations such as 'number!' and 'a?b'.
    _named_type_ident: $ => choice($.ident, alias(/[A-Za-z_][A-Za-z0-9_!?]*[A-Za-z0-9_!]/, $.ident), alias(choice('import', 'type'), $.ident)),
    parameterized_type: $ => prec(5, seq(field('name', choice($.type, $._named_type_ident)), $._type_arguments)),
    qualified_type: $ => prec.right(5, seq(field('module', $._named_type_ident), '.', field('name', choice($.type, $._named_type_ident)), optional('?'))),
    grouped_type: $ => seq('(', $._revo_type, ')'),
    // Type atoms are shared by ordinary types, union variants and slash tags.
    _plain_type_atom: $ => choice(
      $._type_or_primitive_or_optional,
      $._named_type_ident,
      $.atom,
      $.string,
      $.number,
      $.function_signature,
      $.parameterized_type,
      $.qualified_type,
      $.grouped_type,
      alias($._record_type, $.table),
    ),
    _type_atom: $ => choice($._plain_type_atom, $.result_type),
    _revo_type: $ => prec(4, choice($._type_atom, $.union_type, $.tagged_type)),
    result_type: $ => prec.right(seq(choice('!', 'not'), choice($._type_atom, $.union_type), optional(seq('/', $._revo_type)))),
    tagged_type: $ => prec.right(6, seq(choice($._plain_type_atom, $.union_type), '/', $._revo_type)),
    union_type: $ => prec.left(5, seq(
      $._type_atom,
      repeat1(seq('|', $._type_atom)),
    )),
    union_expression: $ => prec.left(seq($._expression, repeat1(prec.left(seq('|', $._expression))))),
    do_block: $ => seq(
      $._do,
      field('body', repeat(choice($._expression, ';'))),
      $._end,
    ),
    break: $ => prec.right(4, seq('break', optional(field('label', $._label)), optional(field('condition', $._expression)))),
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
    _for_range: $ => prec.left(2, seq(
      optional($._expression),
      choice(
        $._open_range_dots,
        seq($._closed_range_dots, $._expression, optional(choice(
          $._open_range_dots, seq($._closed_range_dots, $._expression),
        ))),
      ),
    )),
    _space: $ => token(/\s/),
    table: $ => seq(
      '{',
      optional(repeat_comma(choice($.field, $.ident, $._expression))),
      '}',
    ),
    _type_assignment: $ => seq(':', field('type', $._revo_type)),
    _assignment: $ => seq('=', field('value', $._expression)),
    field: $ => prec(1, seq(
      optional('const'),
      field('name', choice($._expression, seq('[', $._expression, ']'))),
      choice($._type_assignment, $._assignment, seq($._type_assignment, $._assignment)),
    )),
    // Structural type records have contextual names and type entries. Keeping
    // them separate avoids treating expression keywords as table field names.
    _record_type: $ => seq('{', repeat_comma(choice(
      alias($._record_type_field, $.field),
      $._record_type_entry,
    )), '}'),
    _record_type_field: $ => seq(
      optional('?'),
      field('name', $._type_ident),
      ':',
      field('type', $._revo_type),
    ),
    _record_type_entry: $ => choice(
      // Legacy positional type names have ident nodes, including primitives.
      alias($.primitive, $.ident),
      $._named_type_ident,
      alias(/[A-Za-z_][A-Za-z0-9_!?]*/, $.ident),
      $.atom,
      $.string,
      $.number,
      $.optional_type,
      $.function_signature,
      $.parameterized_type,
      $.qualified_type,
      $.grouped_type,
      $.union_type,
      $.result_type,
      $.tagged_type,
      alias($._record_type, $.table),
    ),
    match: $ => prec.right(seq(
      'match',
      optional(field('value', $._expression)),
      field('body', repeat1($.match_arm)),
    )),
    match_arm: $ =>
      prec.right(1, seq(
        '|',
        $._match_pattern,
        repeat(seq(',', $._match_pattern)),
        optional(seq(
          choice('if', 'when'),
          field('condition', $._expression),
        )),
        '=>',
        field('value', $._match_value_expression),
      )),
    // This reduction boundary keeps operators inside the arm without adding
    // an expression wrapper or swallowing the next arm's bar.
    _match_value_expression: $ => prec.left($._expression),
    _match_pattern: $ => seq(
      field('pattern', $._expression),
      optional($._type_assignment),
    ),
    for_loop_expression: $ => prec(1, seq(
      'for',
      optional(field('label', $._label)),
      repeat_comma1($.ident),
      'in',
      field('iterator', choice($._expression, alias($._for_range, $.range))),
      field('body', $.expression)
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
    _scoped_expression: $ => prec.left(5, seq($._expression, $.scoped)),
    scoped: $ => prec.right(seq(
      repeat1(
        seq(
          choice(
            seq('.', choice(alias($._ordinary_function_call, $.function_call), $.macro_call, $.ident, $.integer)),
            seq(':', alias($._ordinary_function_call, $.function_call)),
          ),
          optional($.index),
        )
      ),
    )),
  }
});

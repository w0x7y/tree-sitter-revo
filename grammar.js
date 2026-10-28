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

function binary($, operand) {
  return seq(field('left', operand), $.operator, field('right', operand));
}

function unary($, operand) {
  return seq(alias(token('-'), $.operator), operand);
}

const IDENT_SNAKE = /[a-z_][a-zA-Z0-9_]*/;
const IDENT_PASCAL = /[A-Z_][a-zA-Z0-9_]*/;
// Compiler names end with at most one `?` or `!`.
const SUFFIXED_NAME = /[A-Za-z_][A-Za-z0-9_]*[?!]?/;
// A final `?` stays the optional_type suffix.
const BANG_NAME = /[A-Za-z_][A-Za-z0-9_]*!?/;
// The compiler accepts every keyword as a contextual record or signature name.
const TYPE_NAME_KEYWORDS = [
  'const', 'let', 'test', 'suite', 'type', 'fn', 'if', 'unless', 'else',
  'match', 'when', 'do', 'end', 'loop', 'for', 'while', 'global', 'in',
  'break', 'continue', 'return', 'import', 'spawn', 'yield', 'and', 'or',
  'not', 'band', 'bor', 'bxor', 'shl', 'shr', 'comp', 'orelse', 'pub',
  'declare',
];
// Upstream binding names, labels and loop variables reject every keyword but
// `type` and `import`, which are baselib globals.
const RESERVED_KEYWORDS = TYPE_NAME_KEYWORDS.filter(word => word !== 'type' && word !== 'import');
export default grammar({
  name: "revo",
  word: $ => $.ident,
  reserved: {
    global: $ => RESERVED_KEYWORDS,
    // Member names after `.` or `:` accept every keyword, as the compiler does.
    member: $ => [],
  },
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
    $._generic_receiver,
    $._open_range_end,
    $._generic_path_head,
    $._generic_path_receiver,
    $._bare_arg,
    $._bare_arg_rejected,
    $._paren_generic,
    // Never valid in a rule; marks error recovery and malformed numbers.
    $._error_sentinel,
  ],
  conflicts: $ => [[$._expression, $._range_bound], [$.range], [$._ident, $._member_name]],
  rules: {
    source: $ => repeat(choice($._expression, ';')),
    expression: $ => prec.left($._expression),
    _not: $ => token('not'),
    _expression: $ => prec.left(3, choice(
      $._primary_expression, $.operation_expression, $.unary_expression, $.range,
    )),
    // Bounds stop at unparenthesized dots. Grouping keeps the ordinary
    // expression interface so explicitly nested ranges remain possible.
    _range_bound: $ => prec.left(3, choice(
      $._primary_expression,
      alias($._range_operation, $.operation_expression),
      alias($._range_unary, $.unary_expression),
    )),
    _primary_expression: $ => prec.left(3, choice(
      $._ident,
      $.self,
      $.directive,
      $.do_block,
      $.type_expression,
      $.conditional_expression,
      $.while_expression,
      $.loop_expression,
      $.for_loop_expression,
      $.comp_expression,
      $.union_expression,
      $.atom,
      $.number,
      $.string,
      $.match,
      $.function,
      $.function_call,
      $.bare_call,
      $._generic_path_call,
      $.table,
      $.return,
      $._table_type,
      $._indexed,
      $._association,
      $.spawn,
      $.break,
      $.continue,
      $.yield,
      $._scoped_expression,
      seq($._not, $._expression),
      $.declaration,
      $.ambient_declaration,
      $.import,
      $._try_expression,
    )),
    declaration: $ => prec.right(seq(
      choice(
        'let',
        seq(optional($.visibility_modifier), 'const'),
        'global',
      ),
      field('pattern',choice(
        $._ident,
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
    unary_expression: $ => prec.right(5, unary($, $._expression)),
    _range_unary: $ => prec.right(5, unary($, $._range_bound)),
    yield: $ => token('yield'),
    comp_expression: $ => prec(4, seq(
      'comp',
      field('body', $._expression),
    )),
    _operator: $ => prec(2, choice('-', token(choice(
      '=',
      '+',
      '*',
      '*=',
      '^',
      '^=',
      '/',
      '%',
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
    )))),

    // Identifiers
    // Keywords are lowercase, so the lowercase spelling is the keyword token.
    // Keeping it visible lets error recovery report a missing name.
    ident: $ => IDENT_SNAKE,
    _ident: $ => choice($.ident, alias(IDENT_PASCAL, $.ident)),
    // Reserved word sets apply to the token step, so member contexts spell out
    // both identifier terminals instead of referring to the _ident rule.
    _member_name: $ => reserved('member', choice($.ident, alias(IDENT_PASCAL, $.ident))),
    _member_call: $ => prec(4, seq(
      field('name', choice(
        seq($._member_name, optional(choice('?', '!'))),
        alias(prec(4, seq($._member_name, $.index)), $._identifier_indexed),
      )),
      alias($._call_parameters, $.parameters),
      optional($._bare_chain),
    )),
    optional_type: $ =>  prec(2, seq(choice($._type_or_primitive_or_optional, $._ident, alias(BANG_NAME, $.ident)), '?')),
    type: $ => prec(1, IDENT_PASCAL),
    _type_or_primitive_or_optional: $ => prec.left(choice($.optional_type, $.type, $.primitive)),
    import: $ => seq('import', choice($.string, $.import_group)),
    import_group: $ => seq('{', repeat_comma(choice(
      $.string,
      $.import_binding,
    )), '}'),
    import_binding: $ => seq(field('name', $._ident), '=', field('path', $.string)),
    self: $ => token('self'),
    // function_ident: $ => prec(1, seq(
    //   choice(IDENT_SNAKE, alias($.primitive, 'hidden')),
    //   optional('?'))),
    index: $ => seq(
      '[',
      choice($._expression, $.index, alias($._slice, $.range)),
      ']'
    ),
    // Slice bounds are independent of loop adjacency and may be omitted.
    _slice: $ => prec(4, seq(
      optional($._range_bound), $._slice_dots, optional(seq(
        $._range_bound, optional(seq($._slice_dots, optional($._range_bound))),
      )),
    )),
    // Both lexer symbols can win at touching dots while expression and slice
    // paths coexist. Slices accept either, including the whitespace form.
    _slice_dots: $ => prec(4, choice('..', token.immediate('..'))),
    _identifier_indexed: $ => prec(4, seq($._ident, $.index)),
    _indexed: $ => choice($._identifier_indexed, prec.left(5, seq($._expression, $.index))),
    _try_expression: $ => prec.left(5, seq($._expression, '?')),
    _pub: $ => token('pub'),
    visibility_modifier: $ => $._pub,
    _do: $ => seq(token('do'), field('label', optional($._label))),
    _loop: $ => seq(token('loop'), field('label', optional($._label))),
    _while: $ => seq(token('while'), field('label', optional($._label))),
    _label: $ => seq('/', $._ident),
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
      optional(seq(field('name', seq($._ident, repeat(seq(choice(':', '.'), $._member_name)))), optional('?'))),
      optional($._generics),
      $.parameters,
      optional(field('return_type', $.return_type)),
      field('body', choice($.expression, $.table, $.do_block)),
    )),
    return_type: $ => prec.right(5, seq(
      '->',
      $._revo_type,
    )),
    _call_generic_ident: $ => alias(SUFFIXED_NAME, $.ident),
    _call_generics: $ => seq(
      '<',
      repeat_comma($._call_generic_ident),
      '>',
    ),
    function_call: $ => seq(
      choice(
        $._ordinary_function_call, $._generic_function_call,
        $._paren_generic_function_call, $._postfix_function_call,
      ),
      optional($._bare_chain),
    ),
    // `(f)<T>(x)`: the compiler unwraps parentheses around a generic receiver.
    // The scanner requires `<` to touch `)` and `>(` to follow the type names.
    _paren_generic_function_call: $ => prec(4, seq(
      field('name', $._association),
      $._paren_generic,
      $._call_generics,
      alias($._call_parameters, $.parameters),
    )),
    // `f "x"` and `f.g {1}` take exactly one same-line string or table.
    bare_call: $ => prec.left(seq(
      field('name', choice($._ident, $._scoped_expression)),
      $._bare_arg,
      field('argument', choice($.string, $.table)),
      optional($._bare_chain),
    )),
    // A second bare argument, or one after a call result, is a syntax error
    // upstream. This marker is never produced; where it is valid, the scanner
    // turns a same-line string or table into an error.
    _bare_chain: $ => $._bare_arg_rejected,
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
        field('name', seq($._ident, optional(choice('?', '!')))),
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
      repeat(seq('.', $._member_name)),
      '.', alias($._path_generic_function_call, $.function_call),
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
      optional(prec(4, seq($.parameter, repeat(seq(',', $.parameter)), optional(',')))),
      ')'
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

    directive: $ => seq('@', $._ident),
    suite: $ => seq('suite', field('name', $.string), field('body', $.do_block)),
    test: $ => seq(
      'test',
      optional(seq('/', 'skip')),
      field("name", $.string),
      field("body", $.do_block)),
    primitive: $ => seq(choice(
      'number',
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
      field('type', seq(choice($.type, $._ident), repeat(seq('.', choice($.type, $._member_name))))),
      optional($._generics),
      '=',
      field('value', $._revo_type),
    ),
    ambient_declaration: $ => seq(
      optional($.visibility_modifier),
      'declare',
      field('name', seq(choice($._ident, alias(choice('type', 'import'), $.ident)), repeat(seq('.', $._member_name)))),
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
    _type_ident: $ => choice($._named_type_ident, alias(SUFFIXED_NAME, $.ident), alias(choice('number', 'string', 'atom', 'function', 'any', 'table'), $.ident), $._contextual_type_name),
    // Keep a final '?' as the existing optional_type suffix, while admitting
    // compiler names such as 'number!'.
    _named_type_ident: $ => choice($._ident, alias(BANG_NAME, $.ident), alias(choice('import', 'type'), $.ident)),
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
    operation_expression: $ => prec.left(1, binary($, $._expression)),
    _range_operation: $ => prec.left(1, binary($, $._range_bound)),
    // Every spelling uses expression bounds. A lexical integer-range shortcut
    // would hide the dots before precedence can keep arithmetic inside bounds.
    range: $ => choice(
      prec.dynamic(3, prec.left(0, seq(
        $._range_bound, token.immediate('..'), $._range_bound,
        token.immediate('..'), $._range_bound,
      ))),
      prec.dynamic(1, prec.left(0, seq(
        $._range_bound, token.immediate('..'), $._range_bound,
      ))),
    ),
    _for_range: $ => prec.left(0, seq(
      choice('..', seq($._range_bound, token.immediate('..'))),
      choice($._open_range_end, seq(
        $._range_bound,
        optional(seq(token.immediate('..'), choice($._open_range_end, $._range_bound))),
      )),
    )),
    _space: $ => token(/\s/),
    table: $ => seq(
      '{',
      optional(repeat_comma(choice($.field, $._ident, $._expression))),
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
      alias(SUFFIXED_NAME, $.ident),
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
      repeat_comma1($._ident),
      'in',
      field('iterator', choice($._range_bound, alias($._for_range, $.range))),
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
            seq('.', choice(alias($._member_call, $.function_call), $._member_name, $.integer)),
            seq(':', alias($._member_call, $.function_call)),
          ),
          optional($.index),
        )
      ),
    )),
  }
});

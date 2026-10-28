# Tree-sitter Revo

A Tree-sitter parser for [Revo](https://github.com/if-not-nil/revo), maintained
for the current language and editor integrations.

This repository preserves the complete history of
[doomy's upstream grammar](https://codeberg.org/doomy/tree-sitter-revo).
The compatibility changes start at upstream commit
`610fa6a4ff0fecd9cc81806e5e85ea61c92091b4`.
The original grammar and query work is credited to doomy and contributors;
subsequent maintenance is by Idan Gilboa. See [LICENSE](LICENSE).

## Build and check

Use Tree-sitter CLI 0.26.9, Node.js, Python 3 and a C compiler:

```sh
tree-sitter generate
tree-sitter test
python3 test/ast/check_generic_calls.py . queries/highlights.scm
python3 test/ast/check_expressions.py .
python3 test/ast/check_upstream.py .
npm ci
npm test
tree-sitter build --output /absolute/path/to/revo.so
tree-sitter build --wasm --output /absolute/path/to/revo.wasm
```

The Wasm build also requires a WASI SDK. Generated parser source is committed
so editor extension installers can build the exact pinned revision.

Optionally check the Node metadata declaration with TypeScript 5.9.3:

```sh
npm exec --yes --package=typescript@5.9.3 -- tsc --noEmit --strict \
  --module nodenext --moduleResolution nodenext test/types/node-metadata.mts
```

This runs the pinned compiler without changing the package dependencies.

## Editor integration

Both `.rv` and `.revo` use the `revo` language name. Pair the parser with this
repository's queries in the `queries` directory.
Revolt runs with `revo lsp` when Revo is built with the `lsp` feature enabled.

[revo-zed-extension](https://github.com/w0x7y/revo-zed-extension) contains the
Zed language extension, installation checks and compiler compatibility notes.
Its extension manifest pins an immutable grammar commit. Pin a reviewed
commit when installing this grammar in other editors as well.

Report parser issues with a minimal source example and an expected tree.
Include a corpus regression with grammar changes. Passing the corpus or
parsing examples without errors does not establish equivalence to every
compiler parse.

## Compiler compatibility

Earlier audits compared Revo
`b571298b6fc95bc863548f118354c8d077792f6f` with
`e94e6d89ddaabb3249b38c1b10df87c700d1e8dc`. Later Revo
`f0034ab75aaf49d65bc1b4769987f99380383fcb` changes only its README and wasm
build defaults, `9c46813e054381b080ea8a3ea418247dd5912596` changes only
its Nix flake, `c9ff2105656803359867a6f13213330ee672d898` changes only a
README link, `1f95869439fe41da49aab0cce7fa94134ec5ddd4` changes only its
Nix package's build features, `d2f16441c1554fec50d0098434223850bc4a1868`
changes only its default build features,
`482ef26f80f7b7b88e3c4b74d20b914a00e6e5f6` adds only the runtime
`dataframe.sort()`, and `1060fcf44a16a185263b3cb244cca886ac017acc` adds the
runtime `dataframe.row()` and `dataframe.filter()` and fixes its `argparse` and
HTTP libraries. None of these changed the grammar.

The grammar now follows Revo `eefa192ea40d918d21630350219789e57fb6e661`,
which rewrote its parser around a concrete syntax tree in
`8680d687a0ea04e1738c5d1e67ce0863134cc677` and removed macros. `macro`,
`proc` and `skip` are ordinary names, so the macro, procedural macro and
quasiquote nodes are gone and a backtick is a syntax error. `skip` keeps its
meaning after `test/`. A name ends with at most one `?` or `!`: `fmt!()` is an
ordinary call, `a?b` is two names and `identity<T!x>(2)` is not a generic
call. Name atoms stop at operators, so `:a-b` is `:a - b` and `:+2` is the
atom `:+` followed by `2`. `num` and `int` are no longer number types and parse
as plain type names; `number` remains a primitive. Call arguments accept a
trailing comma, as the compiler does; the grammar previously allowed one only
in macro calls. Comments are trivia to the compiler's generic-call lookahead,
so `identity<number, ##note## T>(2)` is a generic call, while a doc comment
there still stops it. Upstream also accepts a parenthesized path receiver such
as `(identity)<T>(2)`; the grammar keeps comparison parsing for that form.

Loop ranges require `..` to
touch the start and step, as upstream changed in
`71115dea59391f2fbb1e5e79226157aea3a6ffd5`. Whitespace after `..` opens the
range and starts the loop body.
All range bounds use the expression grammar, including decimal, underscored,
exponent and base-prefixed numbers. Numeric bounds now have children under the
existing `range` node. Arithmetic stays inside its start, step or endpoint;
the removed opaque integer-range token no longer changes the tree based on
number spelling. Unary negation retains its ordinary expression precedence.
Slice bounds can be omitted or computed, and slices allow whitespace around
`..`. The table slicing change adds runtime support to the existing syntax.
The global-constant binding change affects compiler semantics, so declaration
spelling and editor nodes stay the same.

Strings remain opaque `string` nodes. The compiler lexes `#{...}` as code, so
the scanner keeps nested `"` strings, raw strings, braces and comments inside
the interpolation and inside the one token: `"#{f("x")}"` is a single string.
Backslashes, backticks, doc comments and module docs are errors in that code.
`'...'` strings are raw, with no escapes and no triple-quoted form, so
`'C:\path\'` is complete and `'''x'''` is three strings. Upstream accepts
interpolation modes `:v`, `:?`, and `:p`, and the lone atom `"#{:d}"`. It
rejects unknown modes such as `"#{t:d}"`; this grammar retains the complete
string for editor recovery and leaves interpolation diagnostics to Revolt.
Comment extras can also bridge a loop range operator, so `start##gap##..limit`
remains an editor recovery even though the compiler requires literal
adjacency. Complete-program corpus and AST checks cover these limits and
reject spaced starts and steps.

Three newer compiler rejections also stay editor recoveries. The grammar has no
bare-call node: `f "x"` parses as a name followed by a string, so chained
arguments such as `f "x" "y"` parse although the compiler rejects them.
Keywords other than `type` and `import` are no longer binding names, labels or
loop variables upstream (`let do = 1`, `do/end`). The grammar's context-aware
lexer still reads a keyword as a name where no keyword is valid, and keeps
every keyword as a member name after `.` or `:`, as the compiler does.
Malformed numbers such as `1__2`, `1_` and `1.5.5` are compiler errors, but
still parse here.

Editor integrations should select a reviewed grammar revision only after it
is available from this repository. The Zed extension records its immutable
grammar pin in its own manifest and verifies that exact public source.

The AST checks share isolated parser builds and XML recovery checks through
`test/ast/revo_parser.py`. Its raw parse and query methods remain available to
editor checks. CLI exit status accounts for missing syntax because the XML
output leaves missing elements unmarked.

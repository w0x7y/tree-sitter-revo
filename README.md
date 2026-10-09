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

Use Tree-sitter CLI 0.26.9, Node.js and a C compiler:

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
Revo's bundled Revolt language server runs with `revo lsp`.

[zed-revo](https://github.com/w0x7y/zed-revo) contains the Zed extension,
Neovim 0.11 integration, installation checks and compiler compatibility notes.
Its extension manifest pins an immutable grammar commit. Pin a reviewed
commit when installing this grammar in other editors as well.

Report parser issues with a minimal source example and an expected tree.
Include a corpus regression with grammar changes. Passing the corpus or
parsing examples without errors does not establish equivalence to every
compiler parse.

## Compiler compatibility

The current audit compares Revo
`b571298b6fc95bc863548f118354c8d077792f6f` with
`e94e6d89ddaabb3249b38c1b10df87c700d1e8dc`. Loop ranges require `..` to
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

Strings remain opaque `string` nodes. Upstream accepts interpolation modes
`:v`, `:?`, and `:p`, and the lone atom `"#{:d}"`. It rejects unknown modes
such as `"#{t:d}"`; this grammar retains the complete string for editor
recovery and leaves interpolation diagnostics to Revolt. Comment extras can
also bridge a loop range operator, so `start##gap##..limit` remains an editor
recovery even though the compiler requires literal adjacency. Complete-program
corpus and AST checks cover these limits and reject spaced starts and steps.

Editor integrations should select a reviewed grammar revision only after it
is available from this repository. The Zed extension records its immutable
grammar pin in its own manifest and verifies that exact public source.

The AST checks share isolated parser builds and XML recovery checks through
`test/ast/revo_parser.py`. Its raw parse and query methods remain available to
editor checks. CLI exit status accounts for missing syntax because the XML
output leaves missing elements unmarked.

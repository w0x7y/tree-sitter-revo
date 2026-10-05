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
tree-sitter build --output /absolute/path/to/revo.so
tree-sitter build --wasm --output /absolute/path/to/revo.wasm
```

The Wasm build also requires a WASI SDK. Generated parser source is committed
so editor extension installers can build the exact pinned revision.

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

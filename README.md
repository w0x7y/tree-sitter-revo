# tree-sitter-revo

a tree-sitter parser for the [revo](https://gills.pages.dev/revo/) language.

## Installation

### Helix

```toml
# languages.toml
[[language]]
name = "revo"
file-types = ["rv"]
comment-tokens = "#"
indent = { tab-width = 2, unit = "  " }
language-servers = [ "revo" ]
scope = "source.revo"
grammar = "revo"

[[grammar]]
name = "revo"
source = { git = "https://codeberg.org/doomy/tree-sitter-revo", rev = "main" }

[language-server.revo]
command = "revo"
args = ["--lsp"]
```

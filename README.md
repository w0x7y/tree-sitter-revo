# tree-sitter-revo

a tree-sitter parser for the [revo](https://gills.pages.dev/revo/) language.

## Installation

## helix

you have to do it manually for highlighting to work

```bash
DIR=~/git # where you'd like to download it
git clone https://codeberg.org/doomy/tree-sitter-revo $DIR/tree-sitter-revo
mkdir -p ~/.config/helix/runtime/queries
ln -sf "$DIR/tree-sitter-revo/queries" ~/.config/helix/runtime/queries/revo
```

then put this in your `languages.toml`:
```toml
[[language]]
name = "revo"
scope = "source.revo"
file-types = ["rv"]
comment-tokens = "#"
indent = { tab-width = 2, unit = "  " }
language-servers = [ "revo" ]
grammar = "revo"

[[grammar]]
name = "revo"
source = { path = "/absolute/path/to/tree-sitter-revo", rev = "main" }

[language-server.revo]
command = "revo"
args = ["lsp"]
```

then fetch and build the grammar:

```bash
hx --grammar fetch
hx --grammar build
```

make sure `revo` is in your path, then open any `.rv` file
you can verify everything loaded with `:health` while a revo file is open

## neovim

you need revo somewhere in your path
if you don't want to do so, just change the cmd field to wherever it is

just add this to your config

```lua
-- revo language support
-- make sure you got nvim 0.11+; `revo` executable in path; the nvim-treesitter plugin

vim.filetype.add({
	extension = {
		rv = "revo",
		revo = "revo",
	},
})

vim.lsp.config("revo", {
	cmd = { "revo", "lsp" },
	filetypes = { "rv", "revo" },
	root_markers = {
		"lib.json",
		"exe.json",
		".git",
	},
})

vim.lsp.enable("revo")

vim.treesitter.language.register("revo", {
	"rv",
	"revo",
})

require("nvim-treesitter").setup({
	local_parsers = {
		revo = {
			source = {
				type = "git",
				url = "https://codeberg.org/doomy/tree-sitter-revo",
				revision = "main",
			},
			filetype = "revo",
		},
	},
})

require("nvim-treesitter").install({ "revo" })
```

to check the status for all lsps, do `:checkhealth vim.lsp`

if it dies on you, do `lsp restart revo` or `lsp enable revo`

if you encounter a bug, especially if it's a crash, add this to your config:

```lua
vim.lsp.log.set_level 'trace'
```

then open the logs via

```lua
:lua vim.cmd('tabnew ' .. vim.lsp.log.get_filename())
```

## Issues

Something look off? Please create a [new issue](https://codeberg.org/doomy/tree-sitter-revo/issues/new) and include the minimum code that results in parsing errors or other weirdness. If you'd like to contribute a fix yourself, please also include a test case.

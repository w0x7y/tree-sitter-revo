; identifiers
(ident) @variable
(self) @variable.builtin

; basic types
(type) @type
(number) @constant
(string) @string
(atom) @string.special
(primitive) @type.builtin
(optional_type
  ("?") @punctuation)
(result_type
  ("!") @punctuation)

; structs
(struct_definition
  (visibility_modifier)? @keyword
  (type)? @type)

(table
  (field
    (ident) @variable.other.member))

(scoped
  (ident) @variable.other.member)

; functions
(function
  (visibility_modifier)? @keyword
  (ident)? @function
  (parameters
    (parameter
      name: (ident)? @variable.parameter))?)

(function_call
  name: (ident) @function.call
  (parameters
    (parameter
      name: (ident)? @variable.parameter)
      ("?")? @operator))

; macros
(macro
  ("macro") @keyword
  (ident) @function.macro
  (capture) @string.regexp)
(proc_macro
  ("proc") @keyword
  (ident) @function.macro
  (parameters
    (parameter
      name: (ident)? @variable.parameter)))
(macro_call
  (ident) @function.macro)

; control flow
(return ("return" @keyword.control.return)) 

; comments
(comment) @comment
(multiline_comment) @comment
(documentation) @comment.line.documentation

; the inside of the mod doc
; keep this blank because it's supposed to keep markdown text white
; (module_doc) @comment.block.documentation

; module doc delimiters themselves
"#!" @keyword
"!#" @keyword

; @author, @test, etc.
(doc_tag) @attribute

; shebang line
(shebang) @keyword

; tests
(suite) @comment.line.documentation
(test) @comment.line.documentation

; keywords
label: (ident) @label
["fn"] @keyword.function
["="] @keyword.operator
(operator) @keyword.operator
[
  "const"
  "global"
  "let"
  "pub"
  "spawn"
  "struct"
  "type"
  (directive)
] @keyword
[
  "do"
  "else"
  "end"
  "for"
  "if"
  "unless"
  "in"
  "match"
  "not"
  "when"
  "while"
  "loop"
  "continue"
  "break"
] @keyword.control
[
  "?"
  "!"
  "{"
  "}"
  "["
  "]"
  "("
  ")"
  "<"
  ">"
  "|"
  "->"
  "=>"
] @punctuation
[
  "."
  ":"
  ","
] @punctuation.delimiter

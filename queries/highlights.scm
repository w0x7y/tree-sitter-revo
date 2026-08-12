; identifiers
(ident) @variable
["self"] @variable.builtin

; basic types
(type) @type
(number) @constant
(string) @string
(atom) @string.special
(primitive) @type.builtin

; structs
(struct
  (type)? @type)
  (struct_body) @struct
(field
  (ident) @property
  (type)? @type)

; functions
(function
  (visibility)? @keyword
  (ident)? @function 
  (parameters 
    (ident) @variable.parameter))
(function_call
  (ident) @function.call)

; control flow
(return) @keyword.control.return

; comments
(comment) @comment
(doc_comment) @comment.line.documentation

; keywords
["fn"] @keyword.function
[
  ; "pub"
  "let"
  "global"
  "const"
  "type"
  "fn"
  "struct"
] @keyword
[
  "do"
  "end"
  "for"
  "in"
  "match"
  "when"
  "if"
] @keyword.control
[
  ":"
  ","
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

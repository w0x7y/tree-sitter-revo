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
(struct_definition
  (visibility)? @keyword
  (type)? @type
  (table
    (field
      (ident) @variable.other.member)))

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
(operator) @keyword.operator
[
  "pub"
  "let"
  "global"
  "const"
  "type"
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

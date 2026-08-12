; identifiers
(ident) @variable
(self) @variable.builtin

; operators and punctuation
(operator) @operator

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
  (_)*)

; functions
["fn"] @keyword.function
(function
  (ident)? @function 
  (parameters 
    (expression) @variable.parameter ))
(function_call) @function.call

; control flow
(block) @block
(return_statement) @keyword.control.return

; comments
(comment) @comment
(doc_comment) @comment.line.documentation

; keywords
[
  "pub"
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

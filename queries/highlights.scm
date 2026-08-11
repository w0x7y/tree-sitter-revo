(number) @constant
(ident) @variable
(function_definition
  (ident) @function 
  (parameters (
    (_)? @variable.parameter
  )))

(expression (ident)) @variable
(operator) @operator
(expression (ident)) @variable

(block) @block
(return_statement) @keyword.control.return
(atom) @string.special
(comment) @comment
(doc_comment) @comment.line.documentation
(string) @string
(primitive) @type.builtin
(type) @type
(function_call) @function.call
(struct
  (type)? @type)
  (struct_body) @struct
(field
  (ident) @property
  (_)*)
[
  "pub"
  "let"
  "global"
  "const"
  "type"
  "fn"
  "do"
  "end"
  "for"
  "in"
  "match"
  "struct"
  "when"
] @keyword
["fn"] @keyword.function
(operator) @operator
["|" "->"] @operator

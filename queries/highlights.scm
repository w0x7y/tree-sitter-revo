(number) @number
(ident) @variable
(function_definition
  (ident) @function) 
(block) @block
(return_statement) @keyword.control.return
(atom) @string.special
(comment) @comment
(doc_comment) @comment.documentation
(string) @string
(primitive_type) @type.builtin
(user_type) @type
(function_call) @function.call
(struct
  (ident_type) @type
  (_)*)
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
] @keyword
(operator) @operator
["|"] @operator

; [
;   "("
;   ")"
;   "["
;   "]"
;   "{"
;   "}"
; ] @punctuation.bracket

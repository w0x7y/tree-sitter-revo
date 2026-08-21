; identifiers
(ident) @variable
["self"] @variable.builtin

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
  (visibility)? @keyword
  (type)? @type
  (table
    (field
      (ident) @variable.other.member)))

(scoped
  (ident) @variable.other.member)

; functions
(function
  (visibility)? @keyword
  (ident)? @function
  (parameters
    (ident)? @variable.parameter))
(function_call
  (ident) @function.call
    (parameters
      (ident)? @variable.parameter)
      (try_operator)? @operator)

; macros
(macro
  ("macro") @keyword
  (ident) @function.macro
  (capture) @string.regexp)
(proc_macro
  ("proc") @keyword
  (ident) @function.macro
  (parameters
      (ident)? @variable.parameter))
(macro_call
  (ident) @function.macro)

; control flow
(return ("return" @keyword.control.return)) 

; comments
(comment) @comment
(doc_comment) @comment.line.documentation

; tests
(suite) @comment.line.documentation
(test) @comment.line.documentation

; keywords
["fn"] @keyword.function
(operator) @keyword.operator
[
  "const"
  "global"
  "let"
  "pub"
  "spawn"
  "struct"
  "type"
] @keyword
[
  "do"
  "else"
  "end"
  "for"
  "if"
  "in"
  "match"
  "not"
  "when"
  "while"
] @keyword.control
[
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

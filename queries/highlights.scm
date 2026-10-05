; identifiers
(ident) @variable
(self) @variable.special
(yield) @keyword

; basic types
(type) @type
[
  (number)
  (integer)
] @number
(string) @string
(atom) @string.special
(primitive) @type.builtin
(type_expression type: (ident) @type)
(type_expression value: (ident) @type)
(parameter type: (ident) @type)
(field type: (ident) @type)
(return_type (ident) @type)
(union_type (ident) @type)
(optional_type (ident) @type)
(result_type (ident) @type)
(tagged_type (ident) @type)
(parameterized_type (ident) @type)
(qualified_type name: (ident) @type)
(optional_type
  ("?") @punctuation)
(result_type
  ("!") @punctuation)

(table
  (field
    name: (ident) @property))

(scoped
  (ident) @property)

; functions
(function
  (visibility_modifier)? @keyword
  name: (ident) @function)

(function_call
  name: (ident) @function)

(function
  (parameters
    (parameter
      name: (ident) @variable.parameter)))

(parameter "?" @operator)

; macros
(macro
  ("macro") @keyword
  (ident) @function
  (capture) @string.regex)
(proc_macro
  ("proc") @keyword
  (ident) @function
  (parameters
    (parameter
      name: (ident)? @variable.parameter)))
(macro_call
  (ident) @function)

; control flow
(return ("return" @keyword))

; comments
(comment) @comment
(multiline_comment) @comment
(documentation) @comment.documentation

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
"suite" @keyword
"test" @keyword
"skip" @keyword

; keywords
label: (ident) @label
["fn"] @keyword
["="] @operator
(operator) @operator
[
  "const"
  "global"
  "let"
  "pub"
  "spawn"
  "comp"
  "import"
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
] @keyword
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
] @punctuation.bracket
[
  "."
  ":"
  ","
  "..."
] @punctuation.delimiter

; Ambient declarations and function signatures added by the compatibility patch.
"declare" @keyword
(function_signature (parameters (parameter name: (ident) @variable.parameter)))

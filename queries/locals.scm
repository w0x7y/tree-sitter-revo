(function
  name: (ident)? @local.definition.function)
(parameters
  (parameter
    (ident) @local.definition.parameter))
(do_block) @local.scope
(declaration (ident) @local.definition.var)

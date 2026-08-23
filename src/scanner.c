#include "tree_sitter/parser.h"
// #include "tree_sitter/alloc.h"
// #include "tree_sitter/array.h"
#include <stdbool.h>

enum TokenType {
  DOCUMENTATION,
};

void * tree_sitter_revo_external_scanner_create() {
  // Nothing needed here yet
  return NULL;
}

void tree_sitter_revo_external_scanner_destroy(void *payload) {
}

unsigned tree_sitter_revo_external_scanner_serialize(
  void *payload,
  char *buffer
) {
  return 0;
}

void tree_sitter_revo_external_scanner_deserialize(
  void *payload,
  const char *buffer,
  unsigned length
) {
}

bool tree_sitter_revo_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  if (!valid_symbols[DOCUMENTATION])
    return false;

  while (lexer->lookahead == ' '  ||
  lexer->lookahead == '\t' ||
  lexer->lookahead == '\n' ||
  lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
  }
  
  if (lexer->lookahead != '#')
    return false;

  // Advance the lexer forwards to scan the next token
  lexer->advance(lexer, false);
  
  if (lexer->lookahead != '*')
    return false;

  // Advance past this current char
  lexer->advance(lexer, false);

  // Consume until first terminator of *#
  while (!lexer->eof(lexer)) {
    
    // Begin matching for endings
    if (lexer->lookahead == '*') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '#') {
        lexer->advance(lexer, false);
        lexer->result_symbol = DOCUMENTATION;
        lexer->mark_end(lexer);
        return true;
      }
    }
    // Or parse normally and advance
    else {
      lexer->advance(lexer, false);
    }
  }
  return false;
}

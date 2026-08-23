#include "tree_sitter/parser.h"
// #include "tree_sitter/alloc.h"
// #include "tree_sitter/array.h"
// #include <stdbool.h>

enum TokenType {
  DOCUMENTATION,
  ATOM,
  STRING,
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

  // Skip whitespace
  while (lexer->lookahead == ' '  ||
  lexer->lookahead == '\t' ||
  lexer->lookahead == '\n' ||
  lexer->lookahead == '\r') {
    lexer->advance(lexer, true);
  }

  char next = lexer -> lookahead;
  // Documentation
  if (next == '#' && valid_symbols[DOCUMENTATION]) {
    lexer->advance(lexer, false);
    if (lexer->lookahead != '*')
      return false;
    lexer->advance(lexer, false);
    
    while (!lexer->eof(lexer)) {
      // Begin matching for endings
      if (lexer->lookahead == '*') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '#') {
          lexer->advance(lexer, false);
          lexer->result_symbol = DOCUMENTATION;
          return true;
        }
      }
      // Or parse normally and advance
      else {
        lexer->advance(lexer, false);
      }
    }
  // No terminator was found before eof
  return false;
  }
  // Atoms
  else if (next == ':' && valid_symbols[ATOM]) {
    // Loop over all valid chars, and invalidate
    // if a method call follows like `()`
    while (!lexer->eof(lexer)) {
      lexer->advance(lexer, false);
      char next = lexer->lookahead;  
      bool valid = (next >= 'a' && next <= 'z')
                   || (next >= 'A' && next <= 'Z')
                   || (next == '_');
      while (!lexer->eof(lexer)) {
        if (valid) {
          lexer->advance(lexer, false);
          char next = lexer->lookahead;
          bool valid = (next >= 'a' && next <= 'z')
                       || (next >= 'A' && next <= 'Z')
                       || (next >= '0' && next <= '9')
                       || (next == '_');

          if (valid) {
            // Continue matching
            continue;
          } else {
            // Done with this atom. Ensure the next
            // char is not `(` which indicates a
            // method call.
            if (next == '(') {
              return false;
            } else {
              lexer->result_symbol = ATOM;
              return true;
            }
          }
        } else {
          return false;
        }
      }
    }
  } else if ((next == '\"' || next == '\'') && valid_symbols[STRING]) {
    // Strings
    char delimiter = next;
    
    // Advance the lexer
    lexer->advance(lexer, false);

    // First actual char of string (not first ")
    char first_char = lexer->lookahead;
    bool escaped = false;
    bool closing = false;
    if (first_char == delimiter) {
      // So far -> "" 
      // Check for empty string or escaped string
      lexer->advance(lexer, false);
      if (lexer->lookahead == delimiter) {
        // """
        // Escaped string
        escaped = true;
      } else {
        // Empty string
        lexer->result_symbol = STRING;
        return true;
      }
    } 
    while (!lexer->eof(lexer)) {
      // Skip escaped characters
      if (!closing) {
        if (lexer->lookahead == '\\') {
          lexer->advance(lexer, false);
        } else if (lexer->lookahead == delimiter) {
          if (escaped) {
            closing = true;
          } else {
            lexer->advance(lexer, false);
            lexer->result_symbol = STRING;
            return true;
          }
        }
      } else {
        // Check for all closing
        if (lexer->lookahead == delimiter) {
          lexer->advance(lexer, false);
          if (lexer->lookahead == delimiter) {
            lexer->advance(lexer, false);
            lexer->result_symbol = STRING;
            return true;
          } else {
            closing = false;
          }
        } else {
          closing = false;
        }
      }
      lexer->advance(lexer, false);
    }
    
  } else {
    return false;
  } 
  return false;
}

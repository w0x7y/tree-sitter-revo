#include "tree_sitter/parser.h"
#include <stdbool.h>
// #include "tree_sitter/alloc.h"
// #include "tree_sitter/array.h"
// #include <stdbool.h>

static bool is_alpha_lower(char c) {
  return c >= 'a' && c <= 'z';
}

static bool is_alpha_upper(char c) {
  return c >= 'A' && c <= 'Z';
}

static bool is_alpha(char c) {
  return is_alpha_lower(c) || is_alpha_upper(c);
}

static bool is_num(char c) {
  return c >= '0' && c <= '9';
}

static bool is_alpha_num(char c) {
  return is_alpha(c) || is_num(c);
}

static bool is_valid_atom(char c) {
    return is_alpha(c)
        || (c == '_')
        || (c == '-')
        || (c == '+')
        || (c == '*')
        || (c == '/')
        || (c == '=')
        || (c == '<')
        || (c == '>')
        || (c == '.')
        || (c == '@')
        || (c == '$')
        || (c == '~')
        || (c == '^')
        || (c == '?')
        || (c == '!');
}

// Match a number (positive or negative) or return false if no number is matched
static bool match_number(TSLexer *lexer) {
  if (lexer->lookahead == '-' || is_num(lexer->lookahead)) {
    if (lexer->lookahead == '-') {
      lexer->advance(lexer, false);
    }
    if (is_num(lexer->lookahead)) {
      lexer->advance(lexer, false);
      while (!lexer->eof(lexer)) {
        if (is_num(lexer->lookahead)) {
          lexer->advance(lexer, false);
        } else {
          return true;
        }
      }
      return true;
    } else {
      // Invalid number `-`
      return false;
    }
  } else {
    return false;
  }
}

static bool match_range_dots(TSLexer *lexer) {
  if (lexer->lookahead == '.') {
    lexer->advance(lexer, false);
    if (lexer->lookahead == '.') {
      lexer->advance(lexer, false);
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

enum TokenType {
  DOCUMENTATION,
  ATOM,
  STRING,
  RANGE,
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
      bool valid = is_valid_atom(next);
      while (!lexer->eof(lexer)) {
        if (valid) {
          lexer->advance(lexer, false);
          char next = lexer->lookahead;
          bool valid = is_valid_atom(next);
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
  }
  // Ranges
  else if ((next == '-' || next == '.' || is_num(next)) && valid_symbols[RANGE]) {
      if (match_number(lexer)) {
        // Begins with a number
        // `1`
        if (match_range_dots(lexer)) {
          if (match_number(lexer)) {
            // `1..2`
            if (!(lexer->lookahead == '.')) {
              // Can't be another match
              // `1..2`
              lexer->result_symbol = RANGE;
              return true;
            } else if (match_range_dots(lexer)) {
              // `1..2..`
              match_number(lexer);             
              lexer->result_symbol = RANGE;
              return true;
            } else {
              return false;
            }
          } else {
            // `1..`
            lexer->result_symbol = RANGE;
            return true;
          }
        } else {
          return false;
        }
      } else if (match_range_dots(lexer)) {
        // Begins with `..`
        // Expect numbers
        if (match_number(lexer)) {
          // `..1`
          // This could be valid so far.
          if (!(lexer->lookahead == '.')) {
            // Can't be another match
            // `..1`
            lexer->result_symbol = RANGE;
            return true;
          } else if (match_range_dots(lexer)) {
            // `..1..`
            if (match_number(lexer)) {
              // `..1..2`
              lexer->result_symbol = RANGE;
              return true;
            } else {
              return false;
            }
          } else {
            return false;
          }
        } else {
          // `..A`
          return false;
        }
      } else {
        return false;
      }
  }
  // Nothing found for this to parse, return false
  return false;
}


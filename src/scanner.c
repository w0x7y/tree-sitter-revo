#include "tree_sitter/parser.h"
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

static bool is_alpha_lower(int32_t c) { return c >= 'a' && c <= 'z'; }

static bool is_alpha_upper(int32_t c) { return c >= 'A' && c <= 'Z'; }

static bool is_alpha(int32_t c) { return is_alpha_lower(c) || is_alpha_upper(c); }

static bool is_num(int32_t c) { return c >= '0' && c <= '9'; }

static bool is_alpha_num(int32_t c) { return is_alpha(c) || is_num(c); }

static bool is_valid_atom(int32_t c) {
  return is_alpha_num(c) || (c == '_') || (c == '-') || (c == '+') || (c == '*') ||
         (c == '/') || (c == '=') || (c == '<') || (c == '>') || (c == '.') ||
         (c == '@') || (c == '$') || (c == '~') || (c == '^') || (c == '?') ||
         (c == '!');
}

// Match lexer identifiers while excluding reserved words, without limiting name length.
static const char *KEYWORDS[] = {
  "const", "global", "let", "comp", "proc", "macro", "test", "suite",
  "skip", "type", "fn", "if", "unless", "else", "match", "when", "do",
  "end", "loop", "for", "while", "in", "break", "continue", "return",
  "import", "spawn", "yield", "and", "or", "not", "band", "bor", "bxor",
  "shl", "shr", "orelse", "pub", "declare",
};

static bool match_identifier(TSLexer *lexer, bool allow_keyword) {
  if (!(is_alpha(lexer->lookahead) || lexer->lookahead == '_')) return false;
  unsigned count = sizeof(KEYWORDS) / sizeof(KEYWORDS[0]);
  uint64_t candidates = (UINT64_C(1) << count) - 1;
  size_t position = 0;
  do {
    for (unsigned i = 0; i < count; ++i)
      if ((candidates & (UINT64_C(1) << i)) &&
          (strlen(KEYWORDS[i]) <= position || KEYWORDS[i][position] != lexer->lookahead))
        candidates &= ~(UINT64_C(1) << i);
    ++position;
    lexer->advance(lexer, false);
  } while (is_alpha_num(lexer->lookahead) || lexer->lookahead == '_' ||
           lexer->lookahead == '?' || lexer->lookahead == '!');
  for (unsigned i = 0; !allow_keyword && i < count; ++i)
    if ((candidates & (UINT64_C(1) << i)) && strlen(KEYWORDS[i]) == position)
      return false;
  return true;
}

static bool is_whitespace(int32_t c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r' ||
         c == '\f' || c == '\v';
}

static void skip_whitespace(TSLexer *lexer, bool skip) {
  while (is_whitespace(lexer->lookahead)) lexer->advance(lexer, skip);
}

static bool skip_path_extras(TSLexer *lexer) {
  for (;;) {
    skip_whitespace(lexer, false);
    if (lexer->lookahead != '#') return true;
    lexer->advance(lexer, false);
    if (lexer->lookahead == '*') return false; // Doc attributes are not ignored by Parser.peek.
    if (lexer->lookahead == '#' || lexer->lookahead == '!') {
      char delimiter = lexer->lookahead;
      lexer->advance(lexer, false);
      bool ended = false;
      while (!lexer->eof(lexer)) {
        if (lexer->lookahead == delimiter) {
          lexer->advance(lexer, false);
          if (lexer->lookahead == '#') {
            lexer->advance(lexer, false);
            ended = true;
            break;
          }
        } else {
          lexer->advance(lexer, false);
        }
      }
      if (!ended) return false;
    } else {
      while (!lexer->eof(lexer) && lexer->lookahead != '\n' && lexer->lookahead != '\r')
        lexer->advance(lexer, false);
    }
  }
}

static bool generic_arguments_ahead(TSLexer *lexer) {
  if (lexer->lookahead != '<') return false;
  lexer->advance(lexer, false);
  unsigned budget = 32;
  while (budget > 0) {
    skip_whitespace(lexer, false);
    --budget;
    if (lexer->lookahead == '>') {
      lexer->advance(lexer, false);
      return lexer->lookahead == '(';
    }
    if (!match_identifier(lexer, false)) return false;
    skip_whitespace(lexer, false);
    if (lexer->lookahead == ',') {
      if (budget == 0) return false;
      --budget;
      lexer->advance(lexer, false);
    } else if (lexer->lookahead != '>') {
      return false;
    }
  }
  return false;
}

enum TokenType {
  DOCUMENTATION,
  ATOM,
  STRING,
  GENERIC_RECEIVER,
  OPEN_RANGE_END,
  GENERIC_PATH_HEAD,
  GENERIC_PATH_RECEIVER,
};

void *tree_sitter_revo_external_scanner_create() {
  // Nothing needed here yet
  return NULL;
}

void tree_sitter_revo_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_revo_external_scanner_serialize(void *payload,
                                                     char *buffer) {
  return 0;
}

void tree_sitter_revo_external_scanner_deserialize(void *payload,
                                                   const char *buffer,
                                                   unsigned length) {}

bool tree_sitter_revo_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {

  // A gap after loop dots begins the body. Check before skipping extras;
  // the grammar's immediate infix dots enforce adjacency to start and step.
  // This zero-width token leaves all expression text for the normal parser.
  if (valid_symbols[OPEN_RANGE_END] &&
      (lexer->eof(lexer) || is_whitespace(lexer->lookahead) || lexer->lookahead == '#')) {
    lexer->mark_end(lexer);
    lexer->result_symbol = OPEN_RANGE_END;
    return true;
  }

  skip_whitespace(lexer, true);

  // Only a bare/dotted path can introduce a generic call. For dotted paths,
  // emit the first name only after validating the whole path; grammar rules
  // keep its final receiver under the function_call name field.
  if ((valid_symbols[GENERIC_RECEIVER] || valid_symbols[GENERIC_PATH_HEAD] ||
       valid_symbols[GENERIC_PATH_RECEIVER]) &&
      (is_alpha(lexer->lookahead) || lexer->lookahead == '_')) {
    if (!match_identifier(lexer, valid_symbols[GENERIC_PATH_RECEIVER])) return false;
    lexer->mark_end(lexer);
    if (lexer->lookahead == '<') {
      if (!(valid_symbols[GENERIC_RECEIVER] || valid_symbols[GENERIC_PATH_RECEIVER]) ||
          !generic_arguments_ahead(lexer)) return false;
      lexer->result_symbol = valid_symbols[GENERIC_PATH_RECEIVER] ? GENERIC_PATH_RECEIVER : GENERIC_RECEIVER;
      return true;
    }
    if (!valid_symbols[GENERIC_PATH_HEAD]) return false;
    if (!skip_path_extras(lexer)) return false;
    if (lexer->lookahead != '.') return false;
    do {
      lexer->advance(lexer, false);
      if (!skip_path_extras(lexer)) return false;
      if (!match_identifier(lexer, true)) return false;
      if (lexer->lookahead == '<') {
        if (!generic_arguments_ahead(lexer)) return false;
        lexer->result_symbol = GENERIC_PATH_HEAD;
        return true;
      }
      if (!skip_path_extras(lexer)) return false;
    } while (lexer->lookahead == '.');
    return false;
  }

  int32_t next = lexer->lookahead;
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
    lexer->advance(lexer, false);
    // Digits are continuation characters; the compiler requires a name or
    // symbol at the start of an atom.
    if (!is_valid_atom(lexer->lookahead) || is_num(lexer->lookahead)) return false;
    do {
      lexer->advance(lexer, false);
    } while (is_valid_atom(lexer->lookahead));
    // A touching argument list makes this a method call instead.
    if (lexer->lookahead == '(') return false;
    lexer->result_symbol = ATOM;
    return true;
  } else if ((next == '\"' || next == '\'') && valid_symbols[STRING]) {
    // Strings
    char delimiter = next;

    // Advance the lexer
    lexer->advance(lexer, false);

    // First actual char of string (not first ")
    int32_t first_char = lexer->lookahead;
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
  // Nothing found for this to parse, return false
  return false;
}

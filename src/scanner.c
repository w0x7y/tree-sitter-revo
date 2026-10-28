#include "tree_sitter/parser.h"
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

static bool is_alpha_lower(int32_t c) { return c >= 'a' && c <= 'z'; }

static bool is_alpha_upper(int32_t c) { return c >= 'A' && c <= 'Z'; }

static bool is_alpha(int32_t c) { return is_alpha_lower(c) || is_alpha_upper(c); }

static bool is_num(int32_t c) { return c >= '0' && c <= '9'; }

static bool is_alpha_num(int32_t c) { return is_alpha(c) || is_num(c); }

static bool is_symbol_atom(int32_t c) {
  return (c == '-') || (c == '+') || (c == '*') || (c == '/') || (c == '=') ||
         (c == '<') || (c == '>') || (c == '.') || (c == '@') || (c == '$') ||
         (c == '~') || (c == '^') || (c == '?') || (c == '!');
}

// Match lexer identifiers while excluding reserved words, without limiting name length.
static const char *KEYWORDS[] = {
  "const", "global", "let", "comp", "test", "suite", "type", "fn", "if",
  "unless", "else", "match", "when", "do", "end", "loop", "for", "while",
  "in", "break", "continue", "return", "import", "spawn", "yield", "and",
  "or", "not", "band", "bor", "bxor", "shl", "shr", "orelse", "pub",
  "declare",
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
  } while (is_alpha_num(lexer->lookahead) || lexer->lookahead == '_');
  // One `?` or `!` may end the name; it never matches a keyword.
  if (lexer->lookahead == '?' || lexer->lookahead == '!') {
    lexer->advance(lexer, false);
    return true;
  }
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
  // Comments are trivia to the compiler's lookahead, so they don't stop it.
  while (budget > 0) {
    if (!skip_path_extras(lexer)) return false;
    --budget;
    if (lexer->lookahead == '>') {
      lexer->advance(lexer, false);
      return lexer->lookahead == '(';
    }
    if (!match_identifier(lexer, false)) return false;
    if (!skip_path_extras(lexer)) return false;
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

static bool scan_raw_string(TSLexer *lexer) {
  lexer->advance(lexer, false);
  while (!lexer->eof(lexer)) {
    int32_t c = lexer->lookahead;
    lexer->advance(lexer, false);
    if (c == '\'') return true;
  }
  return false;
}

static bool skip_block_comment(TSLexer *lexer) {
  while (!lexer->eof(lexer)) {
    int32_t c = lexer->lookahead;
    lexer->advance(lexer, false);
    if (c == '#' && lexer->lookahead == '#') {
      lexer->advance(lexer, false);
      return true;
    }
  }
  return false;
}

enum StringMode { LINE_STRING, BLOCK_STRING, INTERPOLATION };

typedef struct {
  uint8_t mode;
  uint32_t braces; // unmatched `{` inside an interpolation
} StringFrame;

// The parser stops at 256 nested expressions; each string level inside an
// interpolation takes two frames.
enum { MAX_STRING_FRAMES = 512 };

// Consume `"` or `"""`. Returns false for `""`, which is already complete.
static bool open_string(TSLexer *lexer, StringFrame *frame) {
  *frame = (StringFrame){LINE_STRING, 0};
  lexer->advance(lexer, false);
  if (lexer->lookahead != '"') return true;
  lexer->advance(lexer, false);
  if (lexer->lookahead != '"') return false;
  lexer->advance(lexer, false);
  frame->mode = BLOCK_STRING;
  return true;
}

// `'...'` is raw. `"..."` and `"""..."""` take escapes and `#{...}`
// interpolations, which are code: nested strings, braces and comments stay
// inside the one opaque token until the brace that closes `#{`.
static bool scan_string(TSLexer *lexer) {
  if (lexer->lookahead == '\'') return scan_raw_string(lexer);
  StringFrame frames[MAX_STRING_FRAMES];
  unsigned depth = open_string(lexer, &frames[0]) ? 1 : 0;
  while (depth > 0) {
    if (lexer->eof(lexer)) return false;
    StringFrame *top = &frames[depth - 1];
    int32_t c = lexer->lookahead;
    if (top->mode == INTERPOLATION) {
      if (c == '"') {
        if (depth == MAX_STRING_FRAMES) return false;
        if (open_string(lexer, &frames[depth])) ++depth;
        continue;
      }
      if (c == '\'') {
        if (!scan_raw_string(lexer)) return false;
        continue;
      }
      // Code has no escapes or quasiquotes.
      if (c == '\\' || c == '`') return false;
      lexer->advance(lexer, false);
      if (c == '{') {
        ++top->braces;
      } else if (c == '}') {
        if (top->braces == 0) --depth;
        else --top->braces;
      } else if (c == '#') {
        // Doc comments are not expressions; module docs must start the file.
        if (lexer->lookahead == '*' || lexer->lookahead == '!') return false;
        if (lexer->lookahead == '#') {
          lexer->advance(lexer, false);
          if (!skip_block_comment(lexer)) return false;
        } else {
          while (!lexer->eof(lexer) && lexer->lookahead != '\n') lexer->advance(lexer, false);
        }
      }
      continue;
    }
    lexer->advance(lexer, false);
    if (c == '\\') {
      if (!lexer->eof(lexer)) lexer->advance(lexer, false);
    } else if (c == '#' && lexer->lookahead == '{') {
      if (depth == MAX_STRING_FRAMES) return false;
      lexer->advance(lexer, false);
      frames[depth++] = (StringFrame){INTERPOLATION, 0};
    } else if (c == '"') {
      if (top->mode == LINE_STRING) {
        --depth;
      } else if (lexer->lookahead == '"') {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '"') {
          lexer->advance(lexer, false);
          --depth;
        }
      }
    }
  }
  return true;
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
    if (is_alpha(lexer->lookahead) || lexer->lookahead == '_') {
      // Name atoms stop at operators. Like names, they may end with one `?`
      // or `!`, but `:a!=b` compares `:a`.
      do {
        lexer->advance(lexer, false);
      } while (is_alpha_num(lexer->lookahead) || lexer->lookahead == '_');
      lexer->mark_end(lexer);
      if (lexer->lookahead == '?' || lexer->lookahead == '!') {
        bool bang = lexer->lookahead == '!';
        lexer->advance(lexer, false);
        if (!bang || lexer->lookahead != '=') lexer->mark_end(lexer);
      }
    } else if (is_symbol_atom(lexer->lookahead)) {
      do {
        lexer->advance(lexer, false);
      } while (is_symbol_atom(lexer->lookahead));
      lexer->mark_end(lexer);
    } else {
      return false;
    }
    // A touching argument list makes this a method call instead.
    if (lexer->lookahead == '(') return false;
    lexer->result_symbol = ATOM;
    return true;
  } else if ((next == '"' || next == '\'') && valid_symbols[STRING]) {
    if (!scan_string(lexer)) return false;
    lexer->result_symbol = STRING;
    return true;
  }
  // Nothing found for this to parse, return false
  return false;
}

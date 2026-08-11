/**
 * @file revo is a dynamic language made for the joy of programming
 * @author doomy
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "revo",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});

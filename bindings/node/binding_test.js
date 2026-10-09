import assert from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Parser from "tree-sitter";
import language from "./index.js";

test("can load grammar", () => {
  const parser = new Parser();
  parser.setLanguage(language);
  assert.equal(parser.parse("let x = 1").rootNode.hasError, false);
});

test("editor queries compile against the native binding", () => {
  for (const name of ["highlights", "injections", "locals"]) {
    const source = readFileSync(new URL(`../../queries/${name}.scm`, import.meta.url), "utf8");
    assert.doesNotThrow(() => new Parser.Query(language, source), name);
  }
});

test("complete spaced ranges contain errors", () => {
  const parser = new Parser();
  parser.setLanguage(language);
  for (const source of [
    "for i in 0 ..3 do i end",
    "for i in start ..limit do i end",
    "for i in 0..2 ..3 do i end",
    "for i in start..step ..limit do i end",
  ]) {
    assert.equal(parser.parse(source).rootNode.hasError, true, source);
  }
});

test("numeric range bounds stay inside the iterator", () => {
  const parser = new Parser();
  parser.setLanguage(language);
  for (const bounds of [
    "0..1_0..3", "0..0e0..3", "0..0x0..3", "0..3_0", "0..3e0", "0..0x3",
    "0..2 + 3", "0..5 - 1", "0..1 + 1..5", "0..1..2 + 3", "1 + 1..4",
    "0..-1 + 2", "0..2 * -1 + 4",
  ]) {
    const source = `for i in ${bounds} do break i end`;
    const root = parser.parse(source).rootNode;
    assert.equal(root.hasError, false, source);
    const iterator = root.namedChild(0).childForFieldName("iterator");
    assert.equal(iterator.type, "range");
    assert.equal(iterator.endIndex, source.indexOf(" do "), source);
  }
});

test("structured numeric range bounds use the standard highlight captures", () => {
  const parser = new Parser();
  parser.setLanguage(language);
  const source = "for i in 0..2 + 3 do break i end";
  const root = parser.parse(source).rootNode;
  const query = new Parser.Query(language, readFileSync(new URL("../../queries/highlights.scm", import.meta.url), "utf8"));
  const captures = query.captures(root);
  assert.deepEqual(captures.filter(capture => capture.name === "number").map(capture => capture.node.text), ["0", "2", "3"]);
  assert.deepEqual(captures.filter(capture => capture.name === "punctuation.delimiter").map(capture => capture.node.text), [".."]);
  assert.deepEqual(captures.filter(capture => capture.name === "operator").map(capture => capture.node.text), ["+"]);
});

test("incremental range edits match a fresh parse", () => {
  const parser = new Parser();
  parser.setLanguage(language);
  const source = "for i in start..step..limit do i end";
  for (const index of [source.indexOf(".."), source.lastIndexOf("..")]) {
    const tree = parser.parse(source);
    const spaced = source.slice(0, index) + " " + source.slice(index);
    tree.edit({
      startIndex: index, oldEndIndex: index, newEndIndex: index + 1,
      startPosition: { row: 0, column: index },
      oldEndPosition: { row: 0, column: index },
      newEndPosition: { row: 0, column: index + 1 },
    });
    const edited = parser.parse(spaced, tree);
    assert.equal(edited.rootNode.hasError, true);
    assert.equal(edited.rootNode.toString(), parser.parse(spaced).rootNode.toString());
    edited.edit({
      startIndex: index, oldEndIndex: index + 1, newEndIndex: index,
      startPosition: { row: 0, column: index },
      oldEndPosition: { row: 0, column: index + 1 },
      newEndPosition: { row: 0, column: index },
    });
    const restored = parser.parse(source, edited);
    assert.equal(restored.rootNode.hasError, false);
    assert.equal(restored.rootNode.toString(), parser.parse(source).rootNode.toString());
  }
});

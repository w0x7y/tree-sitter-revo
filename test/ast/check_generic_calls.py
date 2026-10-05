"""AST checks for current Revo generic calls and lexical additions.

Run after tree-sitter generate: python3 test/ast/check_generic_calls.py GRAMMAR [QUERY...]
Also run by the Zed extension repository's check_grammar_patch.py.
"""
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


def verify(grammar, queries=()):
    grammar = Path(grammar).resolve()
    with tempfile.TemporaryDirectory(prefix="revo-ast-") as directory:
        fixture = Path(directory) / "case.rv"

        def parse(source, require_valid=True):
            fixture.write_text(source + "\n")
            result = subprocess.run(
                ["tree-sitter", "parse", "--xml", "--grammar-path", str(grammar), str(fixture)], cwd=grammar,
                capture_output=True, text=True,
            )
            if require_valid:
                assert result.returncode == 0, result.stdout or result.stderr
            if "</sources>" not in result.stdout:
                raise AssertionError(result.stderr or result.stdout)
            return ET.fromstring(result.stdout.split("</sources>", 1)[0] + "</sources>")

        def generic_calls(tree):
            # Type arguments are direct, unnamed ident children of the call.
            return [node for node in tree.iter("function_call")
                    if any(child.tag == "ident" and child.get("field") != "name"
                           for child in node) or "<" in (node.text or "")
                    or any("<" in (child.tail or "") for child in node)]

        positive = {
            "bare": "let explicit = identity<num>(2)",
            "keyword prefix name": "fn_identity<T>(2)",
            "keyword field name": "module.fn<T>(2)",
            "spaced path": "module . inner . identity<num>(2)",
            "commented path": "module##comment##.inner.identity<num>(2)",
            "predicate receiver": "identity?<num>(2)",
            "bang receiver syntax": "identity!<num>(2)",
            "nullable argument name": "identity<T?>(2)",
            "bang argument name": "identity<T!>(2)",
            "bang inside argument name": "identity<T!x>(2)",
            "dotted": "module.identity<num,T>(2)",
            "nested path": "module.inner.identity<num>(2)",
            "empty": "let empty = identity<>(2)",
            "trailing comma": "let trailing = identity<num,>(2)",
            "internal whitespace": "identity< \n num , T \t >(2)",
            "ASCII vertical whitespace": "identity<\fnum,\vT>(2)",
            "32 tokens": "identity<" + ",".join(["T"] * 16) + ">(2)",
            "31 tokens with trailing comma": "identity<" + ",".join(["T"] * 15) + ",>(2)",
        }
        negative = {
            "space before bracket": "identity <num>(2)",
            "newline before bracket": "identity\n<num>(2)",
            "form feed before bracket": "identity\f<num>(2)",
            "vertical tab before arguments": "identity<num>\v(2)",
            "space before arguments": "identity<num> (2)",
            "newline before arguments": "identity<num>\n(2)",
            "numeric argument": "identity<1>(2)",
            "keyword argument": "identity<fn>(2)",
            "non ASCII receiver": "Ł<T>(2)",
            "non ASCII argument": "identity<Ł>(2)",
            "numeric dotted receiver": "identity.0.identity<num>(2)",
            "internal block comment": "identity<num, ##comment## T>(2)",
            "internal line comment": "identity<num, #comment\n T>(2)",
            "comment before bracket": "identity##comment##<num>(2)",
            "comment before arguments": "identity<num>##comment##(2)",
            "33 tokens with trailing comma": "identity<" + ",".join(["T"] * 16) + ",>(2)",
            "34 tokens": "identity<" + ",".join(["T"] * 17) + ">(2)",
            "indexed receiver": "identity[0]<num>(2)",
            "indexed dotted receiver": "identity[0].identity<num>(2)",
            "called dotted receiver": "identity().identity<num>(2)",
            "called nested dotted receiver": "identity().inner.identity<num>(2)",
        }
        for label, source in positive.items():
            tree = parse(source)
            assert not list(tree.iter("ERROR")), (label, ET.tostring(tree).decode())
            calls = generic_calls(tree)
            assert len(calls) == 1, (label, ET.tostring(tree).decode())
            names = [child.text for child in calls[0] if child.get("field") == "name"]
            assert names == [source.split("<", 1)[0].rsplit(".", 1)[-1].split()[-1]], (label, names)
        for label, source in negative.items():
            tree = parse(source, require_valid=False)
            assert not generic_calls(tree), (label, ET.tostring(tree).decode())

        tree = parse("while a < b do a += 1 end")
        condition = next(child for child in next(tree.iter("while_expression"))
                         if child.get("field") == "condition")
        assert condition.tag == "operation_expression"
        assert [n.text for n in condition.iter("operator")] == ["<"]

        tree = parse("1..2")
        assert [node.text for node in tree.iter("range")] == ["1..2"]

        lexical = "let hex = 0x101042FF; let binary = 0b1010; let octal = 0o17; let float = 0x1.8p+1; let short_float = 0x1.p1; let decimal_float = 1.e2; do let x = 2; x *= 3; let s = 'a'; s ~= 'b'; end"
        tree = parse(lexical)
        assert not list(tree.iter("ERROR")), ET.tostring(tree).decode()
        numbers = {node.text for node in tree.iter("number")}
        assert {"0x101042FF", "0b1010", "0o17", "0x1.8p+1", "0x1.p1", "1.e2"} <= numbers, numbers
        operators = {node.text for node in tree.iter("operator")}
        assert {"*=", "~="} <= operators, operators

        # Tree-sitter lookahead is a Unicode codepoint. U+0141 must not narrow
        # to ASCII 'A' and become an atom the Revo lexer would reject.
        tree = parse(":Ł", require_valid=False)
        assert list(tree.iter("ERROR")) and not list(tree.iter("atom")), ET.tostring(tree).decode()

        fixture.write_text("identity<t>(2)\nmodule.identity<t,T>(2)\nidentity?<T?>(2)\nidentity<T!>(2)\n")
        for query in queries:
            result = subprocess.run(
                ["tree-sitter", "query", "--captures", "--grammar-path", str(grammar), str(Path(query).resolve()), str(fixture)],
                cwd=grammar, capture_output=True, text=True, check=True,
            )
            function_columns = re.findall(
                r"capture: \d+ - function, start: \((\d+), (\d+)\)", result.stdout,
            )
            assert function_columns == [("0", "0"), ("1", "7"), ("2", "0"), ("3", "0")], (query, function_columns)
    print(f"PASS: {len(positive)} generic positives, {len(negative)} negatives, comparison AST, lexical nodes and function captures")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    verify(sys.argv[1], sys.argv[2:])

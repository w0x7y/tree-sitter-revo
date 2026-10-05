"""Check current expression trees and complete iterator/declaration spans.

Usage: python3 check_expressions.py GRAMMAR
"""
from pathlib import Path
import argparse
import tempfile
import xml.etree.ElementTree as ET

from revo_parser import Parser

CASES = {
    'spawn parenthesized function': 'let x = spawn (fn() "async result")()',
    'whitespace separates condition from parenthesized consequence': 'let x = (if self.cur == cur ("> ") else "  ")',
    'repeated paren calls': 'let x = make()()',
    'qualified macro call': 'let x = proc_lib.add_one!(m.pi) |> m.double()',
    'iterator call': 'for x in iter.range(5) do print(x) end',
    'table iterator': 'for x in {1, 2} do print(x) end',
    'string iterator': 'for c in "hi" do print(c) end',
    'computed upper range': 'for i in 1..len(items) do print(i) end',
    'open computed range': 'for i in start.. do print(i) end',
    'leading computed range': 'for i in ..(count - 4) print(i)',
    'computed stepped range': 'for i in start..step..limit do print(i) end',
    'multiple iterator bindings': 'for x, i in data do print(i, x) end',
    'unary parenthesized': 'let x = -(3 + 4)',
    'unary identifier': 'let x = -value',
    'table try': 'let x = {:ok, 42}?',
    'index try': 'let x = res[0]?',
    'table index': 'let x = {:ok, 42}[0]',
    'repeated index': 'let x = action[1][1]',
    'method after try': 'let x = client:recv()?:trim():split(" ")',
    'empty parentheses': 'let x = ()',
    'bare labeled break value': 'do/a break/a "value" end',
    'break before match arm': 'match c | :a => break/chars(:nil) | _ => c',
    'predicate call in binary condition': 'while (i + count < s:len() and numeric?(s[i + count])) do 0 end',
    'empty macro call': 'fmt!()',
    'trailing macro comma': 'fmt!(42,)',
}
def verify(grammar, library=None):
    with Parser(grammar, library) as parser, tempfile.TemporaryDirectory(prefix="revo-expression-") as directory:
        fixture = Path(directory) / 'case.rv'
        failures = []
        for label, source in CASES.items():
            fixture.write_text(source + '\n')
            result = parser.parse(fixture, xml=True)
            if '</sources>' not in result.stdout:
                raise RuntimeError(result.stderr or result.stdout or 'Parser returned no syntax tree')
            tree = ET.fromstring(result.stdout.split('</sources>', 1)[0] + '</sources>')
            if result.returncode or list(tree.iter('ERROR')):
                failures.append(label)
            source_tree = list(tree)[0][0]
            if len(source_tree) != 1:
                failures.append(label + ': split expression')
            loop = next(tree.iter('for_loop_expression'), None)
            if loop is not None:
                body_start = source.index(' do ') + 1 if ' do ' in source else source.rindex(' print(') + 1
                iterator_start = source.index(' in ') + 4
                iterator_end = body_start - 1
                iterator = [node for node in loop if node.get('field') == 'iterator']
                body = next(node for node in loop if node.get('field') == 'body')
                if (not iterator or int(iterator[0].get('scol')) != iterator_start
                        or int(iterator[-1].get('ecol')) != iterator_end
                        or int(body.get('scol')) != body_start):
                    failures.append(label + ': iterator/body spans')
            if label == 'break before match arm' and len(list(tree.iter('match_arm'))) != 2:
                failures.append(label + ': swallowed next arm')
            declaration = next(tree.iter('declaration'), None)
            if label == 'whitespace separates condition from parenthesized consequence':
                conditional = next(tree.iter('conditional_expression'))
                condition = next(node for node in conditional if node.get('field') == 'condition')
                if list(condition.iter('function_call')):
                    failures.append(label + ': consequence swallowed as call')
            if label == 'spawn parenthesized function' and not list(tree.iter('spawn')):
                failures.append(label + ': missing spawn node')
            if label == 'qualified macro call':
                macro = next(tree.iter('macro_call'), None)
                if macro is None or not any(node.get('field') == 'name' and node.text == 'add_one!' for node in macro):
                    failures.append(label + ': missing qualified macro name')
            if declaration is not None:
                # The complete expression must belong to the declaration value.
                if int(declaration.get('ecol')) != len(source):
                    failures.append(label + ': split value')
        assert not failures, failures
    print(f'PASS: {len(CASES)} expression forms and full declaration values')


if __name__ == "__main__":
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("grammar", nargs="?", type=Path, default=Path(__file__).resolve().parents[2])
    arguments.add_argument("--lib-path", type=Path)
    options = arguments.parse_args()
    verify(options.grammar, options.lib_path)

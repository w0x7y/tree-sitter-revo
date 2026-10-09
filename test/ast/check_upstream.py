"""Check complete programs at the current upstream syntax boundaries.

Strings stay opaque editor tokens, including compiler-invalid interpolation.
"""

from pathlib import Path
import argparse
import tempfile

from revo_parser import Parser


VALID = {
    'numeric range': 'for i in 0..3 do i end',
    'computed range': 'for i in start..limit do i end',
    'stepped range': 'for i in start..step..limit do i end',
    'leading range': 'for i in ..3 do i end',
    'leading computed range': 'for i in ..limit do i end',
    'fully open range': 'for i in .. do i end',
    'open numeric range': 'for i in 0.. do i end',
    'open computed range': 'for i in start.. do i end',
    'space after dots starts body': 'for i in 0.. 3',
    'open stepped range': 'for i in 0..2.. do i end',
    'negative step': 'for i in 10..-2.. do i end',
    'grouped computed bounds': 'for i in (start + 1)..(limit - 1) do i end',
    'underscored range step': 'for i in 0..1_0..3 do break i end',
    'exponent range step': 'for i in 0..0e0..3 do break i end',
    'hexadecimal range step': 'for i in 0..0x0..3 do break i end',
    'underscored range end': 'for i in 0..3_0 do break i end',
    'exponent range end': 'for i in 0..3e0 do break i end',
    'hexadecimal range end': 'for i in 0..0x3 do break i end',
    'arithmetic range end': 'for i in 0..2 + 3 do break i end',
    'subtracted range end': 'for i in 0..5 - 1 do break i end',
    'multiplied range end': 'for i in 0..2 * 3 do break i end',
    'bitwise range end': 'for i in 0..2 bor 3 do break i end',
    'arithmetic range step': 'for i in 0..1 + 1..5 do break i end',
    'arithmetic stepped range end': 'for i in 0..1..2 + 3 do break i end',
    'fractional stepped range end': 'for i in 0..1..2.5 do break i end',
    'arithmetic range start': 'for i in 1 + 1..4 do break i end',
    'unary range end': 'for i in 0..-1 + 2 do break i end',
    'mixed unary range end': 'for i in 0..2 * -1 + 4 do break i end',
    'unary call range end': 'fn bound() 2; for i in 0..-bound() + 4 do break i end',
    'slice without bounds': 'let xs = {1, 2, 3}; xs[..]',
    'slice without start': 'let xs = {1, 2, 3}; xs[..1]',
    'slice without end': 'let xs = {1, 2, 3}; xs[1..]',
    'slice reverse': 'let xs = {1, 2, 3}; xs[..-1..]',
    'slice computed bounds': 'let xs = {1, 2, 3}; xs[start..step..limit]',
    'slice whitespace': 'let xs = {1, 2, 3}; xs[ start .. step .. limit ]',
    'underscored slice step': 'let xs = {1, 2, 3}; xs[0..1_0..3]',
    'arithmetic slice end': 'let xs = {1, 2, 3}; xs[0..1 + 1]',
    'unary slice end': 'let xs = {1, 2, 3}; xs[0..-1 + 2]',
    'mixed unary slice end': 'let xs = {1, 2, 3}; xs[0..2 * -1 + 4]',
    'unary call slice end': 'fn bound() 2; let xs = {1, 2, 3}; xs[0..-bound() + 4]',
    'plain interpolation': 'let t = 42; let text = "#{t}"; text',
    'display interpolation': 'let t = 42; let text = "#{t:v}"; text',
    'debug interpolation': 'let t = 42; let text = "#{t:?}"; text',
    'pretty interpolation': 'let t = 42; let text = "#{t:p}"; text',
    'atom interpolation': 'let text = "#{:d}"; text',
    'mode trailing whitespace': 'let t = 42; let text = "#{t:v }"; text',
    'multiline interpolation': 'let t = 42; let text = """\n#{t:p}\n"""; text',
    'parenthesized assignment continuation': 'do let x = 1; (x) = 2; x end',
}

EDITOR_RECOVERY = {
    # Upstream rejects these. Editors preserve opaque strings/comment extras.
    'unknown interpolation mode recovery': 'let t = 42; let text = "#{t:d}"; text',
    'comment before dots recovery': 'for i in start##gap##..limit do i end',
}

INVALID = {
    'spaced numeric start': 'for i in 0 ..3 do i end',
    'spaced computed start': 'for i in start ..limit do i end',
    'spaced numeric step': 'for i in 0..2 ..3 do i end',
    'spaced computed step': 'for i in start..step ..limit do i end',
    'newline before dots': 'for i in start\n..limit do i end',
    'tab before dots': 'for i in start\t..limit do i end',
    'missing loop body': 'for i in 0..3',
}


def verify(grammar, library=None):
    with Parser(grammar, library) as parser, tempfile.TemporaryDirectory(prefix='revo-upstream-') as directory:
        fixture = Path(directory) / 'case.rv'
        failures = []
        for valid, cases in ((True, VALID), (True, EDITOR_RECOVERY), (False, INVALID)):
            for label, source in cases.items():
                fixture.write_text(source + '\n')
                try:
                    tree = parser.parse_tree(fixture, expect_errors=not valid)
                except AssertionError:
                    failures.append(label)
                    continue
                if valid and 'for i in ' in source and ' do ' in source:
                    loop = next(tree.iter('for_loop_expression'), None)
                    iterator = [] if loop is None else [node for node in loop if node.get('field') == 'iterator']
                    if (not iterator or iterator[0].tag != 'range'
                            or int(iterator[0].get('scol')) != source.index('for i in ') + len('for i in ')
                            or int(iterator[-1].get('ecol')) != source.index(' do ')):
                        failures.append(label + ': split iterator bounds')
                if 'slice' in label:
                    index = next(tree.iter('index'), None)
                    if index is None or len(index) != 1 or index[0].tag != 'range':
                        failures.append(label + ': split slice bounds')
                if 'unary' in label:
                    for unary in tree.iter('unary_expression'):
                        if list(unary.iter('operation_expression')):
                            failures.append(label + ': arithmetic swallowed by unary bound')
                if 'interpolation' in label:
                    strings = list(tree.iter('string'))
                    if len(strings) != 1 or strings[0].text != source[source.index('"'):source.rindex('"') + 1]:
                        failures.append(label + ': split string token')
        assert not failures, failures
    print(f'PASS: {len(VALID)} valid programs, {len(EDITOR_RECOVERY)} editor recoveries and {len(INVALID)} invalid loop programs')


if __name__ == '__main__':
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument('grammar', nargs='?', type=Path, default=Path(__file__).resolve().parents[2])
    arguments.add_argument('--lib-path', type=Path)
    options = arguments.parse_args()
    verify(options.grammar, options.lib_path)

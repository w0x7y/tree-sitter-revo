"""Private parser ownership for the grammar's AST checks and editor consumers."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile


class Parser:
    """Build once per context; keep CLI caches and library ownership private."""

    def __init__(self, grammar, library=None):
        self.grammar = Path(grammar).resolve()
        self._external_library = Path(library).resolve() if library is not None else None
        self.library = self._external_library
        self.env = None
        self._temporary = None

    def __enter__(self):
        if self._temporary is not None:
            raise RuntimeError("Parser context is already open")
        self._temporary = tempfile.TemporaryDirectory(prefix="revo-parser-")
        directory = Path(self._temporary.name)
        self.env = {**os.environ, "XDG_CACHE_HOME": str(directory / "cache")}
        self.library = self._external_library
        try:
            if self.library is None:
                suffix = ".dll" if sys.platform == "win32" else ".dylib" if sys.platform == "darwin" else ".so"
                self.library = directory / f"revo{suffix}"
                subprocess.run(
                    ["tree-sitter", "build", "--output", str(self.library)],
                    cwd=self.grammar, env=self.env, check=True,
                )
            elif not self.library.is_file():
                raise FileNotFoundError(self.library)
        except BaseException:
            self.__exit__(None, None, None)
            raise
        return self

    def __exit__(self, *_):
        if self._temporary is not None:
            self._temporary.cleanup()
            self._temporary = None
        self.env = None
        self.library = self._external_library

    def _run(self, action, options):
        if self._temporary is None:
            raise RuntimeError("Use Parser in a with statement")
        return subprocess.run(
            ["tree-sitter", action, "--lib-path", str(self.library), "--lang-name", "revo", *options],
            cwd=self.grammar, env=self.env, capture_output=True, text=True,
        )

    def parse(self, fixture, *, xml=False, quiet=False):
        options = (["--xml"] if xml else []) + (["--quiet"] if quiet else [])
        return self._run("parse", [*options, str(Path(fixture).resolve())])

    def query(self, query, fixture):
        return self._run(
            "query", ["--captures", str(Path(query).resolve()), str(Path(fixture).resolve())],
        )

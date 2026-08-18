{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, utils }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShell = with pkgs; mkShell {
          buildInputs = [
            clang
            tree-sitter
            nodejs
            typescript-language-server
            ts_query_ls
          ];
        };

        shellHook = ''
          export npm_config_python=${pkgs.python311}/bin/python3.11
        '';
      }
    );
}

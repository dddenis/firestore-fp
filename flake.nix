{
  inputs = {
    devshell.url = "github:numtide/devshell";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, devshell, flake-utils, nixpkgs }:
    let overlay = _: prev: { nodejs = prev.nodejs-16_x; };

    in flake-utils.lib.simpleFlake {
      inherit self nixpkgs;

      name = "@dddenis/firestore-fp";
      preOverlays = [ devshell.overlay overlay ];
      systems = flake-utils.lib.defaultSystems;

      shell = { pkgs }:
        pkgs.devshell.mkShell {
          motd = "";
          packages = with pkgs; [ nodejs yarn ];
        };
    };
}

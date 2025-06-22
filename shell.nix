# vuetify breaks if in a non FHS compliant environment. This nix-shell creates an FHS compliant environment. Nifty!

{ pkgs ? import <nixpkgs> {} }:

(pkgs.buildFHSEnv {
  name = "node-env";
  targetPkgs = pkgs: (with pkgs; [
    nodejs
  ]);
  runScript = "bash --init-file <(echo \"export PS1='\\n\\[\\033[1;32m\\][FHS-env:\\w]\\$\\[\\033[0m\\] '\")";
}).env

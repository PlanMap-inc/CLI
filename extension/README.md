# PlanMap for VS Code

See what you approved and what your code actually does, as one map.

This build is the read-only checkpoint:
- **Constellation:** your plan's features.
- **Feature Space:** a feature's plan nodes, reached by flying in from the Constellation.
- **Lens switch:** filters nodes by lens.
- **Statuses:** all six are shown.
- **Node detail panel:** intent, rules, approver and history.

Verify, the evolution view, approve/reject/revise and onboarding come next.

## Run it

```bash
cd extension
npm install
npm run compile
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
  --extensionDevelopmentPath="$PWD" /path/to/your/project
```

In the window that opens, run **PlanMap: Open Plan Graph** from the Command Palette.

The project needs a `.planmap/plan.json`. Statuses from a previous `verify` run are shown on the map when `.planmap/evolution.json` has them.

## How it works

- **Reading:** the extension reads `.planmap/plan.json` and `.planmap/evolution.json`, and never writes them.
- **Changing:** every change goes through the PlanMap CLI in this repository (`../src/cli/cli.js`), using VS Code's own Node runtime. Point `planmap.cliPath` / `planmap.nodePath` elsewhere if needed.
- **Refreshing:** changes made from a terminal show up automatically.

## Test

```bash
cd extension
npm test
```

Fonts (Space Grotesk, Inter, JetBrains Mono) are bundled under `webview/fonts/` under the SIL Open Font License; see the `OFL-*.txt` files.

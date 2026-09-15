# PlanMap for VS Code

See what you approved and what your code actually does, side by side.

PlanMap keeps two graphs of a project and checks one against the other:

- **Plan Graph** — authored. The features you planned and the rules each step must keep. A canvas: fly from the Constellation of features into a feature's steps, and switch lenses to see only the nodes that matter to one concern.
- **Project Evolution** — derived from code. Every declaration PlanMap has seen, grouped by feature, with each change nested under the declaration it changed. An outline, and read-only: it mirrors the code, so it can't be edited.

**Verify against code** checks every approved plan node. When code has drifted, the same declaration turns red and pulses in the Plan Graph, shows ⚠ in Project Evolution, and the rail shows how many drifted.

## Getting started

Open a project folder and run **PlanMap: Open Plan Graph** from the Command Palette.

1. **Scan project** reads your code and builds its evolution. It runs offline — nothing leaves your machine.
2. **Write one rule myself** opens `.planmap/plan.json` with an empty plan to fill in (no API key needed). Or **Draft a plan with AI**, which needs `OPENROUTER_API_KEY`.
3. Approve nodes with `planmap approve`, then **Verify against code**.

Changes made from a terminal show up automatically.

## Not available yet

Adding, renaming, deleting and connecting nodes on the canvas, and approving the plan from the toolbar, need CLI commands that don't exist yet. Those buttons are shown but disabled — edit `.planmap/plan.json` directly for now.

## How it works

- **Reading:** the extension reads `.planmap/plan.json`, `evolution.json` and `baseline.json`, and never writes them.
- **Changing:** every change goes through the PlanMap CLI (`init`, `evolution`, `plan draft`, `verify`), run with VS Code's own Node runtime. "Write one rule myself" opens an unsaved editor; the file is created when you save it.
- **Drift:** `verify` records each result in `evolution.json`. Both views read those statuses and join them to plan nodes by the exact identity string (`file::name:kind`).

## Develop

```bash
cd extension
npm install
npm test          # compiles, then runs every test in test/
"/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
  --extensionDevelopmentPath="$PWD" /path/to/your/project
```

By default the extension runs the CLI in this repository (`../src/cli/cli.js`). A packaged build doesn't contain the CLI: set `planmap.cliPath` (and `planmap.nodePath` if needed) to an installed copy.

Fonts (Space Grotesk, Inter, JetBrains Mono) are bundled under `webview/fonts/` under the SIL Open Font License; see the `OFL-*.txt` files.

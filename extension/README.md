# PlanMap for VS Code

See what you approved and what your code actually does, side by side.

PlanMap keeps two graphs of a project and checks one against the other:

- **Plan Graph** — authored. The features you planned and the rules each step must keep. A canvas: fly from the Constellation of features into a feature's steps, and switch lenses to see only the nodes that matter to one concern.
- **Project Evolution** — derived from code. Every declaration PlanMap has seen, grouped by feature, with each change nested under the declaration it changed. An outline, and read-only: it mirrors the code, so it can't be edited.

**Verify against code** checks every approved plan node. When code has drifted, the same declaration turns red and pulses in the Plan Graph, shows ⚠ in Project Evolution, and the rail shows how many drifted. The node's detail panel shows why it drifted and what else it affects.

## Getting started

Open a project folder and run **PlanMap: Open Plan Graph** from the Command Palette.

1. **PlanMap: Set OpenRouter API Key** (optional). The key is kept in your system keychain and is used to group your code into features and to draft plans. Without it, PlanMap still works offline with path-based labels.
2. **Scan project** reads your code and builds Project Evolution.
3. **Draft a plan with AI**, or **Write one rule myself** to open `.planmap/plan.json` and fill it in.
4. Open a node and **Approve** it, or approve every node in a lens with **Approve <lens>**.
5. **Verify against code**.

As the code changes, **Refresh evolution** re-scans it. Refreshing resets verify results, so verify again afterwards. Changes made from a terminal show up automatically.

## Plan decisions

In a node's detail panel:

- **Approve** locks in an intended node. Verify checks the code against it.
- **Revise** reopens an approved node as a new intended version; the old version moves to its history. Edit the new intent or rules in `plan.json`, then approve it.
- **Reject** removes a node from the plan, after a confirmation.

Adding, renaming, deleting and connecting nodes on the canvas need CLI commands that don't exist yet; those buttons are shown but disabled. Edit `.planmap/plan.json` directly for now.

## How it works

- **Reading:** the extension reads `.planmap/plan.json`, `evolution.json` and `baseline.json`, and never writes them.
- **Changing:** every change runs the PlanMap CLI (`init`, `evolution`, `plan draft`, `approve`, `reject`, `plan revise`, `verify`) with VS Code's own Node runtime. "Write one rule myself" opens an unsaved editor; the file is created when you save it.
- **API key:** a key set with the command is passed to the CLI only. Without one, the CLI uses `OPENROUTER_API_KEY` from the environment or the project's `.env`. **PlanMap: Remove OpenRouter API Key** deletes the stored key.
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

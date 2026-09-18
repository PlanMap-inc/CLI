import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.resolve(HERE, "../webview", file), "utf8");

// Evolution is a mirror of the code. Its view is never given the VS Code API,
// so it cannot emit any message - mutating or otherwise.
for (const file of ["evolution-view.js", "evolution.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /postMessage/, `${file} sends a message`);
    assert.doesNotMatch(source, /acquireVsCodeApi|\bvscode\b/, `${file} reaches the VS Code API`);
}

const view = read("evolution-view.js");

// Imports only the pure models.
const imports = [...view.matchAll(/from\s+["']([^"']+)["']/g)].map(m => m[1]).sort();
assert.deepEqual(imports, ["./evolution.js", "./model.js"]);

// No add, drag, context menu or editing of any kind.
const forbidden = [
    [/draggable|dragstart|dragover|addEventListener\(\s*["']drop["']/, "drag and drop"],
    [/contextmenu/, "a context menu"],
    [/contenteditable|<input|<textarea|<select/i, "an editable field"],
    [/\+ Add|>Add\b|addNode|data-act=/, "an add or node action"]
];
for (const [pattern, label] of forbidden) {
    assert.doesNotMatch(view, pattern, `evolution-view.js renders ${label}`);
}

// The markup: only Expand all / Collapse all, and VS Code's default context menu suppressed.
const html = read("index.html");
const start = html.indexOf('id="viewEvolution"');
const section = html.slice(start, html.indexOf("<script", start));
assert.ok(start > 0, "the Evolution view exists");
assert.match(section.slice(0, 200), /data-vscode-context='\{"preventDefaultContextMenuItems": true\}'/);
assert.deepEqual([...section.matchAll(/<button[^>]*id="([^"]+)"/g)].map(m => m[1]), ["evoRefreshBtn", "evoExpandBtn", "evoCollapseBtn"]);

// Refresh re-derives evolution from the code - the only message the view's toolbar sends.
const mainSource = read("main.js");
assert.match(mainSource, /evoRefreshBtn\.addEventListener\("click", \(\) => request\("refresh", \{ type: "evolution" \}\)\);/);
assert.equal((mainSource.match(/evoRefreshBtn\.addEventListener/g) ?? []).length, 1);
for (const [pattern, label] of forbidden) {
    assert.doesNotMatch(section, pattern, `the Evolution markup contains ${label}`);
}

// main.js builds the view from element handles only - no messaging handle passed in.
const main = read("main.js");
const callStart = main.indexOf("createEvolutionView({");
const call = main.slice(callStart, main.indexOf("});", callStart));
assert.ok(callStart > 0);
assert.doesNotMatch(call, /vscode|postMessage|request\(/);

// Project Evolution keeps its controls when the project has no plan: hiding
// Refresh evolution there leaves no way to finish a half-labelled scan.
const css = fs.readFileSync(path.resolve(HERE, "../webview/styles.css"), "utf8");
const notReady = [...css.matchAll(/\.planmap-root\.not-ready ([^{,]+)/g)].map(match => match[1].trim());
assert.ok(notReady.length > 0, "expected the not-ready rules");
for (const selector of notReady) {
    assert.match(selector, /^#viewPlanmap\b/, `"${selector}" hides chrome outside the Plan Graph`);
}
assert.match(section, /id="evoRefreshBtn"/, "the Evolution toolbar has Refresh evolution");

console.log("PASS: evolution-readonly");

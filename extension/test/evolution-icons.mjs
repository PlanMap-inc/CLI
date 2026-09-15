import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EVOLUTION_ICONS, evolutionIcon } from "../webview/evolution.js";
import { STATUSES } from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const expected = {
    intended: "◌",
    approved: "○",
    implemented: "●",
    drifted: "⚠",
    error: "✕",
    superseded: "◐"
};

assert.deepEqual(Object.keys(EVOLUTION_ICONS).sort(), [...STATUSES].sort(), "the same six statuses as the Plan Graph");

for (const status of STATUSES) {
    assert.equal(evolutionIcon(status), expected[status], `${status} has the wrong icon`);
}

assert.equal(new Set(Object.values(EVOLUTION_ICONS)).size, 6, "no two statuses share an icon");

// Anything else the CLI writes ("deleted") gets no icon rather than a made-up one.
assert.equal(evolutionIcon("deleted"), "");
assert.equal(evolutionIcon(undefined), "");
assert.equal(evolutionIcon("toString"), "");

// Every status has a colour rule, and only the two problems are red.
const css = fs.readFileSync(path.resolve(HERE, "../webview/styles.css"), "utf8");
for (const status of STATUSES) {
    assert.match(css, new RegExp(`\\.evo-status-icon\\.status-${status}\\b`), `no style for ${status}`);
}
assert.match(css, /\.evo-status-icon\.status-drifted, \.evo-status-icon\.status-error\{color:var\(--danger\);\}/);

// The Evolution legend shows all six, in order.
const html = fs.readFileSync(path.resolve(HERE, "../webview/index.html"), "utf8");
const legend = [...html.matchAll(/<span class="evo-status-icon status-(\w+)">(.)<\/span>\1<\/div>/gu)].map(m => [m[1], m[2]]);
assert.deepEqual(legend, STATUSES.map(status => [status, expected[status]]));

console.log("PASS: evolution-icons");

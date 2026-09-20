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

// --------------------------------------------------
// ONE MARKER PER LENS, AT THE START OF THE ROW
// --------------------------------------------------
// The shape says what happened; the colour says which perspective it is
// seen through. A declaration read through two lenses shows two markers.
// They used to be one marker taking the FIRST lens's colour, with the lens
// names spelled out at the far end of the row - so "backend and database"
// read as "backend", and the proof of it sat as far from the title as the
// row was wide.

const view = fs.readFileSync(path.resolve(HERE, "../webview/evolution-view.js"), "utf8");

assert.match(view, /const marks = alarm \|\| item\.tags\.length === 0/, "the markers come from the tags");
assert.match(view, /item\.tags\s*\n?\s*\.map\(tag => mark\(/, "one per tag");
assert.match(view, /<span class="evo-marks"/);

// A problem outranks a category: drift and error keep ONE red marker
// rather than a red one per lens.
assert.match(view, /const alarm = status === "drifted" \|\| status === "error";/);
assert.match(view, /alarm \|\| item\.tags\.length === 0\s*\n?\s*\? mark\(""\)/, "an alarm is a single marker");

// The names left the row with the tags, so they have to remain reachable.
assert.match(view, /title="\$\{escapeHtml\(reads\)\}"/, "hovering the markers names the lenses");
assert.match(view, /item\.tags\.join\(" and "\)/, "and the accessible name still carries them");

// The right-hand tag list is gone, markup and styles together.
assert.doesNotMatch(view, /evo-tags|evo-tag-dot/, "the tags no longer sit at the end of the row");
assert.doesNotMatch(css, /\.evo-tags\{|\.evo-tag\{|\.evo-tag-dot\{/, "and their styles went with them");

// The markers take exactly the room their dots need. A column wide enough
// for the most lenses any declaration carries would line every title up,
// but it pads every row carrying fewer - two dots then a third dot's worth
// of nothing before the title. The dots themselves still start at the same
// place, which is the column a reader follows.
assert.doesNotMatch(css, /\.evo-marks\{[^}]*width:/, "no reserved width");
assert.doesNotMatch(view, /--evo-marks|marksWidth/, "and nothing measuring one");

// The numbers here and in the stylesheet have to agree, or the column is
// measured against a dot that is not the size it is drawn at.
assert.match(css, /\.evo-status-icon\{width:8px/);
assert.match(css, /\.evo-marks\{[^}]*gap:2px/);

console.log("PASS: evolution-icons");

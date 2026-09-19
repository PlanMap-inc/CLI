import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { VIEWS, railModel } from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.resolve(HERE, "../webview", file), "utf8");

const activeIds = rail => rail.buttons.filter(button => button.active).map(button => button.id);

// Two views, radio behaviour: exactly one active at a time.
assert.deepEqual(VIEWS.map(view => view.label), ["Plan Graph", "Project Evolution"]);

const planmap = railModel("planmap", {});
assert.equal(planmap.active, "planmap");
assert.deepEqual(activeIds(planmap), ["planmap"]);

const evolution = railModel("evolution", {});
assert.equal(evolution.active, "evolution");
assert.deepEqual(activeIds(evolution), ["evolution"]);

assert.deepEqual(activeIds(railModel("chat", {})), ["planmap"], "an unknown view falls back to the Plan Graph");
assert.deepEqual(activeIds(railModel(undefined, undefined)), ["planmap"]);

// The badge reflects the drift count - drift only, and nothing when there is none.
assert.equal(planmap.badge, null);

const verified = {
    "a.js::a:function": { status: "drifted" },
    "b.js::b:function": { status: "drifted" },
    "c.js::c:function": { status: "error" },
    "d.js::d:function": { status: "implemented" }
};
assert.deepEqual(railModel("planmap", verified).badge, { count: 2, label: "2 drifted" });
assert.deepEqual(railModel("evolution", verified).badge, { count: 2, label: "2 drifted" }, "the badge does not depend on the active view");

// The markup: icon-only radios with tooltips, and a hidden badge until there is drift.
const html = read("index.html");
assert.match(html, /<div class="rail-views" role="radiogroup" aria-label="View">/);
assert.match(html, /data-nav="planmap" role="radio" aria-checked="true" title="Plan Graph"/);
assert.match(html, /data-nav="evolution" role="radio" aria-checked="false" tabindex="-1" title="Project Evolution"/);
assert.match(html, /<span class="rail-badge" id="driftBadge" hidden><\/span>/);
assert.match(html, /<div class="view" id="viewPlanmap">/);
assert.match(html, /<div class="view hidden" id="viewEvolution"/);

// main.js drives both views and the badge from railModel.
const main = read("main.js");
assert.match(main, /const views = \{ planmap: document\.getElementById\("viewPlanmap"\), evolution: document\.getElementById\("viewEvolution"\) \};/);
assert.match(main, /railModel\(activeView, state\?\.verifiedStatus\)/);
assert.match(main, /view\.classList\.toggle\("hidden", id !== rail\.active\)/);
assert.match(main, /button\.addEventListener\("click", \(\) => setMainView\(button\.dataset\.nav\)\)/);
// The badge shows drift first, and unscanned changes only when nothing has
// drifted: a problem must never be displaced by news.
assert.match(main, /const badge = rail\.badge \?\? \(waiting > 0/);
assert.match(main, /driftBadge\.hidden = !badge/);
assert.match(main, /driftBadge\.classList\.toggle\("waiting", !rail\.badge && waiting > 0\)/);

console.log("PASS: nav-rail");

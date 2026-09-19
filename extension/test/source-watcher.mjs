import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isSkipped } from "../out/state.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.resolve(HERE, "..", file), "utf8");

// --------------------------------------------------
// The source watcher is what makes an edit show up at all. Without it the
// graphs only move when the user remembers to press a button, and a change
// they made looks exactly like a refresh that is broken.
// --------------------------------------------------

const watcher = read("src/watcher.ts");

// It watches the extensions the scanner reads, and no others: watching more
// would fire on files a scan cannot see.
const scanner = read("../src/baseline/scanner.js");
for (const ext of ["js", "ts", "tsx", "py"]) {
    assert.match(watcher, new RegExp(`\\{[^}]*\\b${ext}\\b[^}]*\\}`), `the glob is missing .${ext}`);
    assert.match(scanner, new RegExp(`endsWith\\("\\.${ext}"\\)`), `the scanner no longer reads .${ext}`);
}

// And it skips what the scanner skips.
for (const name of ["node_modules", ".git", "dist", "build", "coverage", ".next", "out", ".turbo", ".cache"]) {
    assert.ok(isSkipped(`/work/project/${name}/thing.js`), `${name} should be skipped`);
    assert.match(scanner, new RegExp(`"${name.replace(".", "\\.")}"`), `the scanner no longer skips ${name}`);
}

// .planmap is PlanMap's own output: reacting to it here would loop.
assert.ok(isSkipped("/work/project/.planmap/evolution.json"));

assert.ok(!isSkipped("/work/project/src/app.js"), "ordinary source is watched");
assert.ok(!isSkipped("/work/project/src/outbound/api.js"), "a path merely containing a skipped word is watched");

// Declaration files carry no declarations to record.
assert.match(watcher, /endsWith\(".d.ts"\)/);

// Debounced, because saving is bursty and each run reads every source file.
assert.match(watcher, /delayMs = \d{3,}/);
assert.match(watcher, /clearTimeout\(pending\)/);

// --------------------------------------------------
// Detection is free; classification is not.
// --------------------------------------------------
// The watcher may only run "check", which is local. Turning what it finds
// into the outline calls a model, and that stays on the Refresh button
// where the user can see it coming.

const extension = read("src/extension.ts");
const rescan = extension.slice(extension.indexOf("private async rescan()"), extension.indexOf("private post("));

assert.match(rescan, /runCli\(\s*\["check", this\.projectRoot, "--json"\]/, "a save must run check");
assert.doesNotMatch(rescan, /"evolution"|"plan", "draft"|draftPlan/, "a save must never call a model");
assert.match(rescan, /if \(this\.scanning\) return;/, "one scan at a time");

console.log("PASS: source-watcher");

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCli } from "../helpers/run-cli.mjs";

const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "planmap-prototype-key-")
);

fs.writeFileSync(
    path.join(projectRoot, "format.js"),
    `
function toString(value) {
    return String(value);
}

export function render(value) {
    return toString(value);
}
`,
    "utf8"
);


// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------

const init = runCli(["init", projectRoot], projectRoot);

assert.equal(
    init.code,
    0,
    `init failed:\n${init.stdout}\n${init.stderr}`
);


// ------------------------------------------------------------
// REWRITE FIXTURE WITH A SIGNIFICANT CHANGE
// ------------------------------------------------------------
//
// A new exported declaration is unconditionally treated as a
// significant change (see analyzeSignificance), which is what
// makes check.js actually enter its dependency-graph block and
// call buildCallerIndex. Without this, check would find zero
// significant changes and short-circuit before ever exercising
// the toString/valueOf prototype-collision path this test is
// supposed to guard.
// ------------------------------------------------------------

fs.writeFileSync(
    path.join(projectRoot, "format.js"),
    `
function toString(value) {
    return String(value);
}

export function render(value) {
    return toString(value);
}

export function renderUpper(value) {
    return toString(value).toUpperCase();
}
`,
    "utf8"
);


// ------------------------------------------------------------
// CHECK MUST NOT CRASH
// ------------------------------------------------------------

const check = runCli(["check", projectRoot], projectRoot);

/*
 * check.js intentionally exits 1 whenever a significant change is
 * found (src/cli/commands/check.js, bottom: `process.exitCode =
 * significantChanges.length > 0 ? 1 : 0`) - that is normal, working
 * behavior, not a crash. Since our fixture deliberately introduces a
 * significant change (to force the dependency-graph block, and
 * therefore buildCallerIndex, to run at all), exit code 1 is the
 * EXPECTED outcome here and can't be used to detect a crash: Node's
 * default exit code for an uncaught exception is also 1. So "did it
 * crash" has to be read from stderr/stdout content instead.
 */
assert.equal(
    check.code,
    1,
    `check should exit 1 for a significant change, not crash:\n${check.stdout}\n${check.stderr}`
);

assert.equal(
    check.stderr.includes("TypeError"),
    false,
    `check must not raise a TypeError:\n${check.stderr}`
);

assert.equal(
    check.stdout.includes("Impact analysis"),
    true,
    `check did not reach impact analysis - buildCallerIndex likely threw before completing:\n${check.stdout}\n${check.stderr}`
);

console.log("PASS: prototype key CLI regression");

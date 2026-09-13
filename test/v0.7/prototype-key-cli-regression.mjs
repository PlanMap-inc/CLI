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
// CHECK MUST NOT CRASH
// ------------------------------------------------------------

const check = runCli(["check", projectRoot], projectRoot);

assert.equal(
    check.code,
    0,
    `check crashed:\n${check.stdout}\n${check.stderr}`
);

assert.equal(
    check.stderr.includes("TypeError"),
    false,
    `check must not raise a TypeError:\n${check.stderr}`
);

console.log("PASS: prototype key CLI regression");

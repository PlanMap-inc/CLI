import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
);

const fixtureDir = path.join(repoRoot, "test", "typescript");

const EXPECTED_COUNTS = {
    "callback-collision.ts": 3,
    "collisions.ts": 11,
    "fields.ts": 5,
    "object-collision.ts": 6,
    "string-key-collision.ts": 6,
    "namespace-and-abstract.ts": 3
};

// A namespace block doesn't create its own declaration - it only prefixes
// the names of the declarations inside it. A broken namespace hook can
// leave the declaration COUNT unchanged while the qualified NAMES are
// wrong (missing prefix, or - worse - distinct namespaces collapsing
// onto the same unprefixed name). Assert on names for the fixtures where
// that matters.
const EXPECTED_NAMES = {
    "namespace-and-abstract.ts": ["Format.upper", "Shape", "Shape.describe"],
    "collisions.ts": ["A.boot", "B.boot"]
};

for (const [file, expected] of Object.entries(EXPECTED_COUNTS)) {
    const result = spawnSync(
        process.execPath,
        [path.join(repoRoot, "src", "cli", "cli.js"), path.join(fixtureDir, file)],
        { encoding: "utf8" }
    );

    assert.equal(result.status, 0, `cli.js failed on ${file}:\n${result.stderr}`);

    const count = result.stdout
        .split("\n")
        .filter(line => /^(function|class|method|getter|setter)/.test(line))
        .length;

    assert.equal(
        count,
        expected,
        `${file}: expected ${expected} declarations, got ${count}`
    );

    const expectedNames = EXPECTED_NAMES[file];
    if (expectedNames) {
        for (const name of expectedNames) {
            assert.ok(
                result.stdout.includes(name),
                `${file}: expected qualified name "${name}" in output:\n${result.stdout}`
            );
        }
    }
}

console.log("PASS: typescript fixture regression");

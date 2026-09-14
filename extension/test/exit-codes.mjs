import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { classifyOutcome, runCli } from "../out/cli.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "../../src/cli/cli.js");

const options = cwd => ({ nodePath: process.execPath, cliPath: CLI, cwd, runAsNode: false });

// Unit: the meaning of each exit code.
assert.equal(classifyOutcome(0, false, undefined), "ok");
assert.equal(classifyOutcome(1, false, undefined), "findings");
assert.equal(classifyOutcome(2, false, undefined), "nothing");
assert.equal(classifyOutcome(null, false, undefined), "failed");
assert.equal(classifyOutcome(3, false, undefined), "failed");
assert.equal(classifyOutcome(1, true, undefined), "failed", "exit 1 with no JSON never reached verification");
assert.equal(classifyOutcome(1, true, { results: [] }), "findings");

// End to end against the real CLI.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-exit-"));
const source = path.join(root, "auth.js");
const identity = "auth.js::verifyToken:function";

fs.writeFileSync(source, 'export function verifyToken(token) {\n    if (!token) throw new Error("Invalid token");\n    return token;\n}\n');

const init = await runCli(["init", root], options(root));
assert.equal(init.code, 0, init.stderr);

// Test data, written by the test - the extension itself never writes plan.json.
fs.writeFileSync(path.join(root, ".planmap", "plan.json"), JSON.stringify({
    version: 1,
    lenses: [{ id: "security", label: "Security" }],
    features: [{ id: "auth", name: "Login" }],
    nodes: [{
        id: "plan_0001",
        title: "Token check",
        intent: "Must throw on an invalid token.",
        feature: "auth",
        identity,
        lensTags: ["security"],
        status: "intended",
        origin: "human_authored",
        rules: [{ kind: "behaviour", target: identity, assert: { throws: { op: "==", value: 1 } } }]
    }]
}, null, 2) + "\n");

const approve = await runCli(["approve", root, identity], options(root));
assert.equal(approve.outcome, "ok", approve.stderr);

// 0: nothing drifted.
const clean = await runCli(["verify", root, "--json"], options(root));
assert.equal(clean.code, 0, clean.stderr);
assert.equal(clean.outcome, "ok");
assert.equal(clean.json.summary.drifted, 0);

// 1: drift found - a successful run reporting findings, not an error.
fs.writeFileSync(source, "export function verifyToken(token) {\n    return token;\n}\n");
const drifted = await runCli(["verify", root, "--json"], options(root));
assert.equal(drifted.code, 1);
assert.equal(drifted.outcome, "findings", "verify exit 1 must not be treated as a failure");
assert.equal(drifted.json.results[0].status, "drifted");

// 2: nothing to do - no plan yet.
const empty = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-empty-"));
fs.writeFileSync(path.join(empty, "a.js"), "export function a() { return 1; }\n");
await runCli(["init", empty], options(empty));
const nothing = await runCli(["verify", empty, "--json"], options(empty));
assert.equal(nothing.code, 2);
assert.equal(nothing.outcome, "nothing");
assert.match(nothing.json.message, /No plan found/);

// A missing folder is a real failure: exit 1, but no JSON was ever produced.
const missing = await runCli(["verify", path.join(root, "does-not-exist"), "--json"], options(root));
assert.equal(missing.code, 1);
assert.equal(missing.outcome, "failed");

// A missing executable fails cleanly instead of throwing.
const noNode = await runCli(["verify", root, "--json"], { ...options(root), nodePath: "/nonexistent/node" });
assert.equal(noNode.outcome, "failed");

fs.rmSync(root, { recursive: true, force: true });
fs.rmSync(empty, { recursive: true, force: true });

console.log("PASS: exit-codes");

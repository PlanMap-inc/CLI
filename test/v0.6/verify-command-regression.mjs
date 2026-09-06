import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const CLI = path.join(ROOT, "src", "cli.js");

function runCli(args, cwd) {
    const result = spawnSync(
        process.execPath,
        [CLI, ...args],
        {
            cwd,
            env: { ...process.env },
            encoding: "utf8"
        }
    );

    return {
        code: result.status,
        stdout: result.stdout || "",
        stderr: result.stderr || ""
    };
}

function project() {
    const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "planmap-layer6-")
    );

    const result = runCli(["init", root], ROOT);

    assert.equal(
        result.code,
        0,
        `init failed:\n${result.stdout}\n${result.stderr}`
    );

    return root;
}

function planPath(root) {
    return path.join(root, ".planmap", "plan.json");
}

function baselinePath(root) {
    return path.join(root, ".planmap", "baseline.json");
}

function evolutionPath(root) {
    return path.join(root, ".planmap", "evolution.json");
}

function writePlan(root, nodes, lenses = []) {
    fs.writeFileSync(
        planPath(root),
        JSON.stringify(
            {
                version: 1,
                project: "layer6-test",
                lenses,
                features: [],
                nodes
            },
            null,
            2
        ) + "\n"
    );
}

function writeBaseline(root, declarations) {
    fs.writeFileSync(
        baselinePath(root),
        JSON.stringify(
            {
                version: 2,
                declarations
            },
            null,
            2
        ) + "\n"
    );
}

function writeEvolution(root, nodes) {
    fs.writeFileSync(
        evolutionPath(root),
        JSON.stringify(
            {
                version: 1,
                nodes
            },
            null,
            2
        ) + "\n"
    );
}

function node({
    id,
    identity,
    status = "approved",
    lensTags = ["security"],
    intent = "Ensure the function behaves according to the approved contract.",
    approvedBy = "test-user",
    approvedAt = "2026-09-05T00:00:00.000Z"
}) {
    return {
        id,
        identity,
        kind: "function",
        file: identity.split("::")[0],
        symbol: identity.split("::")[1],
        title: "Layer 6 test node",
        intent,
        status,
        origin: "ai_drafted",
        lensTags,
        approvedBy,
        approvedAt,
        approvedFacts: {
            returns: true
        }
    };
}

function declaration(identity, overrides = {}) {
    return {
        identity,
        file: identity.split("::")[0],
        kind: "function",
        properties: {
            throws: false,
            throwTypes: [],
            returns: true,
            returnsNullish: false,
            calls: [],
            numbers: [],
            awaits: false,
            catches: false,
            emptyCatches: false,
            params: [],
            ...overrides
        },
        ...overrides
    };
}

function writeSource(root, relativePath, source) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
}

function readEvolution(root) {
    return JSON.parse(
        fs.readFileSync(evolutionPath(root), "utf8")
    );
}

/*
 * 1. Passing verification exits 0.
 */
{
    const root = project();
    const identity = "src/pass.js::pass:function";

    writeSource(
        root,
        "src/pass.js",
        "export function pass() { return true; }\n"
    );

    writePlan(root, [
        node({
            id: "pass-node",
            identity
        })
    ]);

    writeBaseline(root, [
        declaration(identity)
    ]);

    const result = runCli(["verify", root], ROOT);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Verified:\s+1/);
}

/*
 * 2. Drift exits 1.
 */
{
    const root = project();
    const identity = "src/drift.js::drift:function";

    writeSource(
        root,
        "src/drift.js",
        "export function drift() { throw new Error('drift'); }\n"
    );

    writePlan(root, [
        {
            ...node({
                id: "drift-node",
                identity,
                intent: "The function must not throw."
            }),
            rules: [
                {
                    kind: "behaviour",
                    target: identity,
                    assert: {
                        throws: {
                            op: "==",
                            value: 0
                        }
                    }
                }
            ]
        }
    ]);

    writeBaseline(root, [
        declaration(identity, {
            throws: false
        })
    ]);

    const result = runCli(["verify", root], ROOT);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /DRIFTED/);
    assert.match(result.stdout, /The function must not throw/);
    assert.match(result.stdout, /test-user/);
    assert.match(result.stdout, /Violation:/);
}

/*
 * 3. Missing declaration is an error and exits 1.
 */
{
    const root = project();
    const identity = "src/missing.js::missing:function";

    writePlan(root, [
        node({
            id: "missing-node",
            identity
        })
    ]);

    writeBaseline(root, []);

    const result = runCli(["verify", root], ROOT);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /Errors/);
    assert.match(result.stdout, /missing.js/);
}

/*
 * 4. No plan exits 2.
 */
{
    const root = project();

    const result = runCli(["verify", root], ROOT);

    assert.equal(result.code, 2);
    assert.match(
        result.stdout,
        /No plan found\. Run 'planmap plan draft' first\./
    );
}

/*
 * 5. No approved nodes exits 2.
 */
{
    const root = project();

    writePlan(root, [
        node({
            id: "intended-node",
            identity: "src/a.js::a:function",
            status: "intended"
        })
    ]);

    const result = runCli(["verify", root], ROOT);

    assert.equal(result.code, 2);
    assert.match(
        result.stdout,
        /No approved nodes\. Run 'planmap approve'\./
    );
}

/*
 * 6. Approved nodes without identity exit 2.
 */
{
    const root = project();

    writePlan(root, [
        {
            ...node({
                id: "greenfield-node",
                identity: "src/a.js::a:function"
            }),
            identity: undefined
        }
    ]);

    const result = runCli(["verify", root], ROOT);

    assert.equal(result.code, 2);
    assert.match(
        result.stdout,
        /No verifiable nodes \(all lack an identity\)\./
    );
}

/*
 * 7. JSON output is valid JSON.
 */
{
    const root = project();
    const identity = "src/json.js::json:function";

    writeSource(
        root,
        "src/json.js",
        "export function json() { return true; }\n"
    );

    writePlan(root, [
        node({
            id: "json-node",
            identity
        })
    ]);

    writeBaseline(root, [
        declaration(identity)
    ]);

    const result = runCli(
        ["verify", root, "--json"],
        ROOT
    );

    assert.equal(result.code, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.approved, 1);
    assert.equal(parsed.verified, 1);
    assert.equal(parsed.drifted, 0);
    assert.equal(parsed.errors, 0);
    assert.equal(parsed.unsupported, 0);
    assert.ok(Array.isArray(parsed.results));
}

/*
 * 8. --lens filters verification.
 */
{
    const root = project();

    const securityIdentity =
        "src/security.js::check:function";
    const backendIdentity =
        "src/backend.js::load:function";

    writeSource(
        root,
        "src/security.js",
        "export function check() { throw new Error('drift'); }\n"
    );

    writeSource(
        root,
        "src/backend.js",
        "export function load() { return true; }\n"
    );

    writePlan(
        root,
        [
            {
                ...node({
                    id: "security-node",
                    identity: securityIdentity,
                    lensTags: ["security"]
                }),
                rules: [
                    {
                        kind: "behaviour",
                        target: securityIdentity,
                        assert: {
                            throws: {
                                op: "==",
                                value: 0
                            }
                        }
                    }
                ]
            },
            {
                ...node({
                    id: "backend-node",
                    identity: backendIdentity,
                    lensTags: ["backend"]
                }),
                rules: []
            }
        ],
        [
            { id: "security", label: "security" },
            { id: "backend", label: "backend" }
        ]
    );

    writeBaseline(root, [
        declaration(securityIdentity),
        declaration(backendIdentity)
    ]);

    const result = runCli(
        ["verify", root, "--lens", "security"],
        ROOT
    );

    assert.equal(result.code, 1);
    assert.match(result.stdout, /src\/security\.js::check:function/);
    assert.doesNotMatch(result.stdout, /src\/backend\.js::load:function/);
}

/*
 * 9. --identity filters verification.
 */
{
    const root = project();

    const target =
        "src/target.js::target:function";
    const other =
        "src/other.js::other:function";

    writeSource(
        root,
        "src/target.js",
        "export function target() { throw new Error('drift'); }\n"
    );

    writeSource(
        root,
        "src/other.js",
        "export function other() { return true; }\n"
    );

    writePlan(root, [
        {
            ...node({
                id: "target-node",
                identity: target
            }),
            rules: [
                {
                    kind: "behaviour",
                    target,
                    assert: {
                        throws: {
                            op: "==",
                            value: 0
                        }
                    }
                }
            ]
        },
        {
            ...node({
                id: "other-node",
                identity: other
            }),
            rules: []
        }
    ]);

    writeBaseline(root, [
        declaration(target),
        declaration(other)
    ]);

    const result = runCli(
        ["verify", root, "--identity", target],
        ROOT
    );

    assert.equal(result.code, 1);
    assert.match(result.stdout, /src\/target\.js::target:function/);
    assert.doesNotMatch(result.stdout, /src\/other\.js::other:function/);
}

/*
 * 10. --only drifted filters display but preserves exit code.
 */
{
    const root = project();

    const drift =
        "src/drift.js::drift:function";
    const pass =
        "src/pass.js::pass:function";

    writeSource(
        root,
        "src/drift.js",
        "export function drift() { throw new Error('drift'); }\n"
    );

    writeSource(
        root,
        "src/pass.js",
        "export function pass() { return true; }\n"
    );

    writePlan(root, [
        {
            ...node({
                id: "drift-node",
                identity: drift
            }),
            rules: [
                {
                    kind: "behaviour",
                    target: drift,
                    assert: {
                        throws: {
                            op: "==",
                            value: 0
                        }
                    }
                }
            ]
        },
        {
            ...node({
                id: "pass-node",
                identity: pass
            }),
            rules: []
        }
    ]);

    writeBaseline(root, [
        declaration(drift),
        declaration(pass)
    ]);

    const result = runCli(
        ["verify", root, "--only", "drifted"],
        ROOT
    );

    assert.equal(result.code, 1);
    assert.match(result.stdout, /src\/drift\.js::drift:function/);
    assert.doesNotMatch(result.stdout, /src\/pass\.js::pass:function/);
}

/*
 * 11. --strict turns unsupported rules into exit 1.
 */
{
    const root = project();
    const identity = "src/strict.js::strict:function";

    writeSource(
        root,
        "src/strict.js",
        "export function strict() { return true; }\n"
    );

    writePlan(root, [
        {
            ...node({
                id: "strict-node",
                identity
            }),
            rules: [
                {
                    kind: "structure",
                    target: identity,
                    assert: {
                        mustImport: "some-package"
                    }
                }
            ]
        }
    ]);

    writeBaseline(root, [
        declaration(identity)
    ]);

    const normal = runCli(
        ["verify", root],
        ROOT
    );

    assert.equal(normal.code, 0);
    assert.match(normal.stdout, /Unsupported:\s+1/);

    const strict = runCli(
        ["verify", root, "--strict"],
        ROOT
    );

    assert.equal(strict.code, 1);
}

/*
 * 12. Non-strict unsupported rules remain exit 0.
 */
{
    const root = project();
    const identity = "src/non-strict.js::run:function";

    writeSource(
        root,
        "src/non-strict.js",
        "export function run() { return true; }\n"
    );

    writePlan(root, [
        {
            ...node({
                id: "non-strict-node",
                identity
            }),
            rules: [
                {
                    kind: "structure",
                    target: identity,
                    assert: {
                        mustNotImport: "some-package"
                    }
                }
            ]
        }
    ]);

    writeBaseline(root, [
        declaration(identity)
    ]);

    const result = runCli(
        ["verify", root],
        ROOT
    );

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Unsupported:\s+1/);
}

/*
 * 13. Verification status is persisted to evolution.
 */
{
    const root = project();
    const identity = "src/status.js::status:function";

    writeSource(
        root,
        "src/status.js",
        "export function status() { throw new Error('drift'); }\n"
    );

    writePlan(root, [
        {
            ...node({
                id: "status-node",
                identity
            }),
            rules: [
                {
                    kind: "behaviour",
                    target: identity,
                    assert: {
                        throws: {
                            op: "==",
                            value: 0
                        }
                    }
                }
            ]
        }
    ]);

    writeBaseline(root, [
        declaration(identity)
    ]);

    writeEvolution(root, [
        {
            id: "evolution-status",
            identity,
            status: "implemented",
            ts: "2026-09-05T00:00:00.000Z"
        }
    ]);

    const result = runCli(
        ["verify", root],
        ROOT
    );

    assert.equal(result.code, 1);

    const evolution = readEvolution(root);
    const saved = evolution.nodes.find(
        item => item.identity === identity
    );

    assert.equal(saved.status, "drifted");
    assert.equal(saved.statusSource, "verified");
    assert.ok(saved.lastVerified);
    assert.equal(
        saved.verifiedAgainst,
        "status-node@1"
    );
}

/*
 * 14. Superseded evolution versions are handled by verification.
 */
{
    const root = project();
    const identity = "src/versioned.js::versioned:function";

    writeSource(
        root,
        "src/versioned.js",
        "export function versioned() { return true; }\n"
    );

    writePlan(root, [
        node({
            id: "versioned-node",
            identity
        })
    ]);

    writeBaseline(root, [
        declaration(identity)
    ]);

    writeEvolution(root, [
        {
            id: "old-version",
            identity,
            status: "implemented",
            ts: "2026-09-04T00:00:00.000Z",
            version: 1
        },
        {
            id: "new-version",
            identity,
            status: "implemented",
            ts: "2026-09-05T00:00:00.000Z",
            version: 2
        }
    ]);

    const result = runCli(
        ["verify", root],
        ROOT
    );

    assert.equal(result.code, 0);

    const evolution = readEvolution(root);
    const versions = evolution.nodes.filter(
        item => item.identity === identity
    );

    assert.equal(versions.length, 2);
    assert.equal(
        versions.find(item => item.id === "old-version").status,
        "superseded"
    );
    assert.equal(
        versions.find(item => item.id === "new-version").status,
        "implemented"
    );
}

/*
 * 15. DRIFTED output contains intent, violation and impact.
 */
{
    const root = project();

    const upstream =
        "src/auth.js::authenticate:function";
    const downstream =
        "src/session.js::createSession:function";

    writeSource(
        root,
        "src/auth.js",
        "export function authenticate() { throw new Error('drift'); }\n"
    );

    writeSource(
        root,
        "src/session.js",
        "export function createSession() { return authenticate(); }\n"
    );

    writePlan(root, [
        {
            ...node({
                id: "auth-node",
                identity: upstream,
                intent: "Authentication must return normally."
            }),
            rules: [
                {
                    kind: "behaviour",
                    target: upstream,
                    assert: {
                        throws: {
                            op: "==",
                            value: 0
                        }
                    }
                }
            ]
        }
    ]);

    writeBaseline(root, [
        declaration(upstream)
    ]);

    const result = runCli(
        ["verify", root],
        ROOT
    );

    assert.equal(result.code, 1);
    assert.match(
        result.stdout,
        /Authentication must return normally/
    );
    assert.match(result.stdout, /Violation:/);
    assert.match(result.stdout, /Impact:/);
    assert.match(result.stdout, /Confidence:/);
}

console.log("PASS: Layer 6 verify command regression suite (15 scenarios)");

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli, ROOT } from "../helpers/run-cli.mjs";




function project() {
    const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "planmap-layer7-")
    );

    const result = runCli(["init", root], ROOT);

    assert.equal(
        result.code,
        0,
        `init failed:\n${result.stdout}\n${result.stderr}`
    );

    return root;
}

function baselinePath(root) {
    return path.join(
        root,
        ".planmap",
        "baseline.json"
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

function declaration(
    identity,
    overrides = {}
) {
    return {
        identity,
        file:
            identity.split("::")[0],
        kind: "function",
        properties: {
            throws: 0,
            throwTypes: [],
            returns: true,
            returnsNullish: 0,
            calls: [],
            numbers: [],
            awaits: 0,
            catches: 0,
            emptyCatches: 0,
            params: [],
            ...overrides
        },
        ...overrides
    };
}


function planPath(root) {
    return path.join(
        root,
        ".planmap",
        "plan.json"
    );
}

function node({
    id,
    identity,
    status = "approved",
    intent = "Ensure the function behaves according to the approved contract.",
    approvedBy = "test-user",
    approvedAt = "2026-09-05T00:00:00.000Z",
    rules = []
}) {
    return {
        id,
        identity,
        kind: "function",
        file: identity.split("::")[0],
        symbol: identity.split("::")[1],
        title: "Layer 7 test node",
        intent,
        status,
        origin: "ai_drafted",
        lensTags: ["security"],
        approvedBy,
        approvedAt,
        approvedFacts: {
            returns: true
        },
        rules
    };
}

function writePlan(root, nodes) {
    fs.writeFileSync(
        planPath(root),
        JSON.stringify(
            {
                version: 1,
                project: "layer7-test",
                lenses: [],
                features: [],
                nodes
            },
            null,
            2
        ) + "\n"
    );
}

function evolutionPath(root) {
    return path.join(
        root,
        ".planmap",
        "evolution.json"
    );
}

function writeEvolution(root, nodes = []) {
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

function writeSource(
    root,
    relativePath,
    source
) {
    const file =
        path.join(
            root,
            relativePath
        );

    fs.mkdirSync(
        path.dirname(file),
        { recursive: true }
    );

    fs.writeFileSync(
        file,
        source
    );
}

/*
 * 8. check --json uses the shared envelope.
 */
{
    const root = project();

    const significantIdentity =
        "src/significant.js::significant:function";

    const insignificantIdentity =
        "src/insignificant.js::insignificant:function";

    writeSource(
        root,
        "src/significant.js",
        "export function significant() { return 222; }\n"
    );

    writeSource(
        root,
        "src/insignificant.js",
        "export function insignificant() { return true; }\n"
    );

    writeBaseline(
        root,
        [
            declaration(
                significantIdentity,
                {
                    numbers: [111]
                }
            ),
            declaration(
                insignificantIdentity,
                {
                    calls: ["logger.debug"],
                    params: 0
                }
            )
        ]
    );

    const result =
        runCli(
            ["check", root, "--json"],
            ROOT
        );

    assert.equal(
        result.code,
        1
    );

    const parsed =
        JSON.parse(
            result.stdout
        );

    assert.equal(
        parsed.schema,
        1
    );

    assert.equal(
        typeof parsed.generatedAt,
        "string"
    );

    assert.ok(
        !Number.isNaN(
            Date.parse(
                parsed.generatedAt
            )
        )
    );

    assert.equal(
        parsed.project,
        root
    );

    assert.deepEqual(
        Object.keys(
            parsed.summary
        ).sort(),
        [
            "added",
            "changes",
            "deleted",
            "insignificant",
            "significant"
        ]
    );

    assert.equal(
        parsed.summary.changes,
        2
    );

    assert.equal(
        parsed.summary.significant,
        1
    );

    assert.equal(
        parsed.summary.insignificant,
        1
    );

    assert.equal(
        parsed.summary.added,
        0
    );

    assert.equal(
        parsed.summary.deleted,
        0
    );

    assert.ok(
        Array.isArray(
            parsed.changes
        )
    );
}

/*
 * 9. check --json preserves insignificant changes.
 */
{
    const root = project();

    const identity =
        "src/insignificant.js::insignificant:function";

    writeSource(
        root,
        "src/insignificant.js",
        "export function insignificant() { console.log('x'); }\n"
    );

    writeBaseline(
        root,
        [
            declaration(
                identity,
                {
                    returns: 0,
                    calls: ["logger.debug"],
                    params: 0
                }
            )
        ]
    );

    const result =
        runCli(
            ["check", root, "--json"],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    const parsed =
        JSON.parse(
            result.stdout
        );

    assert.equal(
        parsed.changes.length,
        1
    );

    assert.equal(
        parsed.changes[0].identity,
        identity
    );

    assert.equal(
        parsed.changes[0].significant,
        false
    );

    assert.deepEqual(
        parsed.changes[0].delta,
        {
            calls: {
                before: ["logger.debug"],
                after: ["console.log"]
            }
        }
    );
}

/*
 * 10. check --json does not change the exit code.
 */
{
    const root = project();

    const identity =
        "src/significant.js::significant:function";

    writeSource(
        root,
        "src/significant.js",
        "export function significant() { return 222; }\n"
    );

    writeBaseline(
        root,
        [
            declaration(
                identity,
                {
                    numbers: [111]
                }
            )
        ]
    );

    const normal =
        runCli(
            ["check", root],
            ROOT
        );

    const json =
        runCli(
            ["check", root, "--json"],
            ROOT
        );

    assert.equal(
        normal.code,
        json.code
    );
}


/*
 * 11. verify --md writes VERIFY.md.
 */
{
    const root = project();
    const identity =
        "src/pass.js::pass:function";

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

    writeEvolution(root);

    const result =
        runCli(
            ["verify", root, "--md"],
            ROOT
        );

    assert.equal(result.code, 0);

    const markdownPath =
        path.join(root, "VERIFY.md");

    assert.ok(
        fs.existsSync(markdownPath)
    );

    const markdown =
        fs.readFileSync(
            markdownPath,
            "utf8"
        );

    assert.match(
        markdown,
        /^# PlanMap Verify/m
    );

    assert.match(
        markdown,
        /## Summary/
    );
}

/*
 * 12. verify --md drift includes intent, violation, and impact.
 */
{
    const root = project();
    const identity =
        "src/drift.js::drift:function";

    const callerIdentity =
        "src/caller.js::caller:function";

    writeSource(
        root,
        "src/drift.js",
        "export function drift() { throw new Error('drift'); }\n"
    );

    writeSource(
        root,
        "src/caller.js",
        "import { drift } from './drift.js';\nexport function caller() { drift(); }\n"
    );

    writePlan(root, [
        node({
            id: "drift-node",
            identity,
            intent: "The function must not throw.",
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
        })
    ]);

    writeBaseline(root, [
        declaration(identity, {
            throws: false
        }),
        declaration(callerIdentity, {
            calls: ["drift"]
        })
    ]);

    writeEvolution(root);

    const result =
        runCli(
            ["verify", root, "--md"],
            ROOT
        );

    assert.equal(result.code, 1);

    const markdown =
        fs.readFileSync(
            path.join(root, "VERIFY.md"),
            "utf8"
        );

    assert.match(
        markdown,
        /## Drifted/
    );

    assert.match(
        markdown,
        /The function must not throw/
    );

    assert.match(
        markdown,
        /Violation/
    );

    assert.match(
        markdown,
        /Impact/
    );

    assert.match(
        markdown,
        /caller/
    );

    assert.match(
        markdown,
        /inferred/
    );
}

/*
 * 13. Clean verify report omits empty Drifted section.
 */
{
    const root = project();
    const identity =
        "src/pass.js::pass:function";

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

    writeEvolution(root);

    const result =
        runCli(
            ["verify", root, "--md"],
            ROOT
        );

    assert.equal(result.code, 0);

    const markdown =
        fs.readFileSync(
            path.join(root, "VERIFY.md"),
            "utf8"
        );

    assert.doesNotMatch(
        markdown,
        /## Drifted/
    );
}

/*
 * 14. Empty report sections are omitted.
 */
{
    const root = project();
    const identity =
        "src/pass.js::pass:function";

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

    writeEvolution(root);

    const result =
        runCli(
            ["verify", root, "--md"],
            ROOT
        );

    assert.equal(result.code, 0);

    const markdown =
        fs.readFileSync(
            path.join(root, "VERIFY.md"),
            "utf8"
        );

    assert.doesNotMatch(
        markdown,
        /## Drifted/
    );

    assert.doesNotMatch(
        markdown,
        /## Errors/
    );

    assert.doesNotMatch(
        markdown,
        /## Unsupported/
    );
}

/*
 * 15. verify --md and --json do not interfere.
 */
{
    const root = project();
    const identity =
        "src/pass.js::pass:function";

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

    writeEvolution(root);

    const result =
        runCli(
            ["verify", root, "--md", "--json"],
            ROOT
        );

    assert.equal(result.code, 0);

    const parsed =
        JSON.parse(result.stdout);

    assert.equal(parsed.schema, 1);
    assert.equal(parsed.project, root);
    assert.ok(
        Array.isArray(parsed.results)
    );

    assert.ok(
        fs.existsSync(
            path.join(root, "VERIFY.md")
        )
    );
}

console.log(
    "PASS: Layer 7 report regression suite (8 scenarios)"
);

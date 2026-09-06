import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { verifyPlan } from "../../src/plan/verify.js";

function makeProject() {
    return fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "planmap-verify-"
        )
    );
}

function writeJson(root, relativePath, value) {
    const file =
        path.join(root, relativePath);

    fs.mkdirSync(
        path.dirname(file),
        { recursive: true }
    );

    fs.writeFileSync(
        file,
        JSON.stringify(value, null, 2)
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
        kind:
            "function",
        name:
            identity.split("::")[1]?.split("#")[0],
        properties: {
            throws: 0,
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
        }
    };
}

function approvedNode(
    identity,
    overrides = {}
) {
    return {
        id:
            overrides.id ||
            "plan-node-001",
        title:
            "Verify declaration",
        intent:
            "Verify declaration behavior",
        identity,
        status:
            "approved",
        approvedBy:
            "reviewer",
        approvedAt:
            "2026-09-06T10:00:00.000Z",
        rules: [],
        ...overrides
    };
}

function writeSource(
    root,
    identity,
    body = "export function verifyToken() { return true; }"
) {
    const file =
        identity.split("::")[0];

    const target =
        path.join(root, file);

    fs.mkdirSync(
        path.dirname(target),
        { recursive: true }
    );

    fs.writeFileSync(
        target,
        body
    );
}

function baseline(
    declarations
) {
    return {
        version: 2,
        declarations
    };
}

/*
 * ------------------------------------------------------------
 * IMPLEMENTED
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/auth.js::verifyToken:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(identity)
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(identity)
        ])
    );

    writeSource(root, identity);

    const result =
        verifyPlan(root);

    assert.equal(
        result.results.length,
        1
    );

    assert.equal(
        result.results[0].status,
        "implemented"
    );
}

/*
 * ------------------------------------------------------------
 * DRIFTED BEHAVIOUR
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/auth.js::verifyToken:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    identity,
                    {
                        rules: [
                            {
                                kind: "behaviour",
                                target: identity,
                                assert: {
                                    throws: {
                                        op: "==",
                                        value: 1
                                    }
                                }
                            }
                        ]
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(
                identity,
                {
                    throws: true
                }
            )
        ])
    );

    writeSource(root, identity);

    const result =
        verifyPlan(root);


    assert.equal(
        result.results[0].status,
        "drifted"
    );

    assert.equal(
        result.summary.drifted,
        1
    );
}

/*
 * ------------------------------------------------------------
 * ERROR: MISSING DECLARATION
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/missing.js::removed:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(identity)
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(identity)
        ])
    );

    writeSource(root, identity);

    const result =
        verifyPlan(root);

    assert.equal(
        result.results[0].status,
        "error"
    );

    assert.equal(
        result.results[0].errors.length,
        1
    );
}

/*
 * ------------------------------------------------------------
 * UNSUPPORTED STRUCTURE
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/auth.js::verifyToken:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    identity,
                    {
                        rules: [
                              {
                                  kind: "structure",
                                  target: identity,
                                    assert: {
                                        mustNotImport:
                                            "src/forbidden.js"
                                    }
                              }
                        ]
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(identity)
        ])
    );

    writeSource(root, identity);

    const result =
        verifyPlan(root);

    assert.equal(
        result.results[0].status,
        "implemented"
    );

    assert.equal(
        result.summary.unsupported,
        1
    );
}

/*
 * ------------------------------------------------------------
 * UNAPPROVED NODES ARE IGNORED
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/auth.js::verifyToken:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    identity,
                    {
                        status: "intended"
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(identity)
        ])
    );

    writeSource(root, identity);

    const result =
        verifyPlan(root);

    assert.equal(
        result.results.length,
        0
    );
}

/*
 * ------------------------------------------------------------
 * IDENTITY REQUIRED
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    "src/auth.js::verifyToken:function",
                    {
                        identity: undefined
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([])
    );

    const result =
        verifyPlan(root);

    assert.equal(
        result.results.length,
        0
    );
}

/*
 * ------------------------------------------------------------
 * BEHAVIOUR ERROR
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/auth.js::verifyToken:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    identity,
                    {
                        rules: [
                            {
                                kind: "behaviour",
                                target: identity,
                                assert: {
                                    throwTypes: {
                                        op: ">=",
                                        value: 1
                                    }
                                }
                            }
                        ]
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(identity)
        ])
    );

    writeSource(root, identity);

    const result =
        verifyPlan(root);

    assert.equal(
        result.results[0].status,
        "error"
    );
}

/*
 * ------------------------------------------------------------
 * APPROVED FACTS
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/auth.js::verifyToken:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    identity,
                    {
                        approvedFacts: {
                            throws: 0
                        },
                        rules: [
                            {
                                kind: "behaviour",
                                target: identity,
                                assert: {
                                    throws: {
                                        op: "unchanged"
                                    }
                                }
                            }
                        ]
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(identity)
        ])
    );

    writeSource(root, identity);

    const result =
        verifyPlan(root);

    assert.equal(
        result.results[0].status,
        "implemented"
    );
}

/*
 * ------------------------------------------------------------
 * RESULT SHAPE
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const identity =
        "src/auth.js::verifyToken:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    identity,
                    {
                        version: 3,
                        lensTags: ["security"]
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(identity)
        ])
    );

    const result =
        verifyPlan(root);

    assert.equal(
        result.results[0].identity,
        identity
    );

    assert.equal(
        result.results[0].planNodeId,
        "plan-node-001"
    );

    assert.equal(
        result.results[0].planVersion,
        3
    );

    assert.deepEqual(
        result.results[0].lensTags,
        ["security"]
    );

    assert.equal(
        result.results[0].approvedBy,
        "reviewer"
    );

    assert.equal(
        result.results[0].approvedAt,
        "2026-09-06T10:00:00.000Z"
    );
}

/*
 * ------------------------------------------------------------
 * SUMMARY
 * ------------------------------------------------------------
 */

{
    const root = makeProject();

    const implemented =
        "src/a.js::one:function";

    const drifted =
        "src/b.js::two:function";

    writeJson(
        root,
        ".planmap/plan.json",
        {
            version: 1,
            lenses: [],
            features: [],
            nodes: [
                approvedNode(
                    implemented,
                    {
                        id: "node-a"
                    }
                ),
                approvedNode(
                    drifted,
                    {
                        id: "node-b",
                        rules: [
                            {
                                kind: "behaviour",
                                target: drifted,
                                assert: {
                                    throws: {
                                        op: "==",
                                        value: 0
                                    }
                                }
                            }
                        ]
                    }
                )
            ]
        }
    );

    writeJson(
        root,
        ".planmap/baseline.json",
        baseline([
            declaration(implemented),
            declaration(
                drifted,
                {
                    throws: 1
                }
            )
        ])
    );

    writeSource(root, implemented, "export function one() { return true; }");
    writeSource(root, drifted, "export function two() { throw new Error(); }");

    const result =
        verifyPlan(root);

    assert.equal(
        result.summary.total,
        2
    );

    assert.equal(
        result.summary.implemented,
        1
    );

    assert.equal(
        result.summary.drifted,
        1
    );
}

console.log(
    "PASS: verification regression"
);

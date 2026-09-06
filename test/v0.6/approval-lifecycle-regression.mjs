import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli, ROOT } from "../helpers/run-cli.mjs";

function project() {
    const root =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "planmap-layer4-"
            )
        );

    const result =
        runCli(
            [
                "init",
                root
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0,
        `init failed:\n${result.stdout}\n${result.stderr}`
    );

    return root;
}

function planPath(
    root
) {
    return path.join(
        root,
        ".planmap",
        "plan.json"
    );
}

function baselinePath(
    root
) {
    return path.join(
        root,
        ".planmap",
        "baseline.json"
    );
}

function writePlan(
    root,
    nodes
) {
    fs.mkdirSync(
        path.join(
            root,
            ".planmap"
        ),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        planPath(root),
        JSON.stringify(
            {
                version: 1,
                project: "layer4-test",
                lenses: [
                    {
                        id: "security",
                        label: "security"
                    },
                    {
                        id: "backend",
                        label: "backend"
                    }
                ],
                features: [
                    {
                        id: "billing",
                        name: "billing"
                    },
                    {
                        id: "auth",
                        name: "auth"
                    }
                ],
                nodes
            },
            null,
            2
        ) + "\n"
    );
}

function node({
    id,
    identity = null,
    status = "intended",
    origin = "ai_drafted",
    feature = "billing",
    lensTags = ["security"]
}) {
    return {
        id,
        ...(identity
            ? {
                identity
            }
            : {}),
        kind:
            "function",
        file:
            identity
                ? identity.split("::")[0]
                : "src/greenfield.js",
        symbol:
            identity
                ? identity.split("::")[1]
                : "newFeature",
        title:
            "Layer 4 test node",
        intent:
            "Test approval lifecycle behaviour.",
        status,
        origin,
        feature,
        lensTags
    };
}

function writeBaseline(
    root,
    declarations
) {
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

function baselineDeclaration(
    identity,
    overrides = {}
) {
    return {
        identity,
        file:
            identity.split("::")[0],
        kind:
            "function",
        properties: {
            throws: false,
            throwTypes: [],
            returns: true,
            returnsNullish: false,
            calls: [
                "console.log"
            ],
            numbers: [],
            awaits: false,
            catches: false,
            emptyCatches: false,
            params: [
                "name"
            ],
            ...overrides
        }
    };
}

function readPlan(
    root
) {
    return JSON.parse(
        fs.readFileSync(
            planPath(root),
            "utf8"
        )
    );
}

/*
 * 1. Approve one node.
 */
{
    const root = project();

    const identity =
        "src/a.js::hello:function";

    writePlan(
        root,
        [
            node({
                id:
                    "node-1",
                identity
            })
        ]
    );

    writeBaseline(
        root,
        [
            baselineDeclaration(
                identity
            )
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    assert.match(
        result.stdout,
        /Approved: 1/
    );

    assert.equal(
        readPlan(root).nodes[0].status,
        "approved"
    );
}

/*
 * 2. Capture all ten approved facts.
 */
{
    const root = project();

    const identity =
        "src/facts.js::calculate:function";

    writePlan(
        root,
        [
            node({
                id:
                    "node-facts",
                identity
            })
        ]
    );

    const facts = {
        throws: true,
        throwTypes: [
            "TypeError"
        ],
        returns: true,
        returnsNullish: true,
        calls: [
            "validate",
            "calculate"
        ],
        numbers: [
            42
        ],
        awaits: true,
        catches: true,
        emptyCatches: true,
        params: [
            "input",
            "options"
        ]
    };

    writeBaseline(
        root,
        [
            baselineDeclaration(
                identity,
                facts
            )
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    const approved =
        readPlan(root).nodes[0].approvedFacts;

    for (
        const key of Object.keys(facts)
    ) {
        assert.deepEqual(
            approved[key],
            facts[key],
            `approvedFacts.${key} mismatch`
        );
    }
}

/*
 * 3. Already-approved is a no-op.
 */
{
    const root = project();

    const identity =
        "src/a.js::hello:function";

    writePlan(
        root,
        [
            {
                ...node({
                    id:
                        "node-1",
                    identity,
                    status:
                        "approved"
                }),
                approvedBy:
                    "original-user",
                approvedAt:
                    "2026-09-05T00:00:00.000Z",
                approvedFacts:
                    {
                        returns: true
                    }
            }
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        2
    );

    assert.match(
        result.stdout,
        /Already approved/
    );

    const saved =
        readPlan(root).nodes[0];

    assert.equal(
        saved.approvedBy,
        "original-user"
    );

    assert.equal(
        saved.approvedAt,
        "2026-09-05T00:00:00.000Z"
    );
}

/*
 * 4. Unknown identity.
 */
{
    const root = project();

    writePlan(
        root,
        [
            node({
                id:
                    "node-1",
                identity:
                    "src/a.js::hello:function"
            })
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                "src/missing.js::missing:function"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        1
    );

    assert.match(
        result.stderr,
        /Plan node not found/
    );
}

/*
 * 5. Identity-backed node with absent baseline.
 */
{
    const root = project();

    const identity =
        "src/a.js::hello:function";

    writePlan(
        root,
        [
            node({
                id:
                    "node-1",
                identity
            })
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        1
    );

    assert.match(
        result.stderr,
        /baseline/
    );
}

/*
 * 6. Greenfield node without identity.
 */
{
    const root = project();

    writePlan(
        root,
        [
            node({
                id:
                    "greenfield-1",
                identity:
                    null
            })
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                "greenfield-1"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    assert.equal(
        readPlan(root).nodes[0].status,
        "approved"
    );
}

/*
 * 7. --all.
 */
{
    const root = project();

    const a =
        "src/a.js::one:function";

    const b =
        "src/b.js::two:function";

    writePlan(
        root,
        [
            node({
                id:
                    "node-a",
                identity:
                    a
            }),
            node({
                id:
                    "node-b",
                identity:
                    b,
                feature:
                    "auth"
            })
        ]
    );

    writeBaseline(
        root,
        [
            baselineDeclaration(a),
            baselineDeclaration(b)
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                "--all"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    assert.deepEqual(
        readPlan(root).nodes.map(
            n => n.status
        ),
        [
            "approved",
            "approved"
        ]
    );
}

/*
 * 8. --lens.
 */
{
    const root = project();

    const identity =
        "src/a.js::securityCheck:function";

    writePlan(
        root,
        [
            node({
                id:
                    "security-node",
                identity,
                lensTags:
                    ["security"]
            }),
            node({
                id:
                    "backend-node",
                identity:
                    "src/b.js::backend:function",
                lensTags:
                    ["backend"]
            })
        ]
    );

    writeBaseline(
        root,
        [
            baselineDeclaration(identity)
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                "--lens",
                "security"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    const statuses =
        readPlan(root).nodes.map(
            n => n.status
        );

    assert.deepEqual(
        statuses,
        [
            "approved",
            "intended"
        ]
    );
}

/*
 * 9. --feature.
 */
{
    const root = project();

    const identity =
        "src/a.js::billing:function";

    writePlan(
        root,
        [
            node({
                id:
                    "billing-node",
                identity,
                feature:
                    "billing"
            }),
            node({
                id:
                    "auth-node",
                identity:
                    "src/b.js::auth:function",
                feature:
                    "auth"
            })
        ]
    );

    writeBaseline(
        root,
        [
            baselineDeclaration(identity)
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                "--feature",
                "billing"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    const statuses =
        readPlan(root).nodes.map(
            n => n.status
        );

    assert.deepEqual(
        statuses,
        [
            "approved",
            "intended"
        ]
    );
}

/*
 * 10. No plan.
 */
{
    const root = project();

    const result =
        runCli(
            [
                "approve",
                root,
                "--all"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        2
    );
}

/*
 * 11. No intended nodes.
 */
{
    const root = project();

    writePlan(
        root,
        [
            node({
                id:
                    "approved-node",
                identity:
                    "src/a.js::approved:function",
                status:
                    "approved"
            })
        ]
    );

    const result =
        runCli(
            [
                "approve",
                root,
                "--all"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        2
    );
}

/*
 * 12. Reject intended.
 */
{
    const root = project();

    const identity =
        "src/a.js::rejectMe:function";

    writePlan(
        root,
        [
            node({
                id:
                    "reject-1",
                identity
            })
        ]
    );

    const result =
        runCli(
            [
                "reject",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    assert.equal(
        readPlan(root).nodes.length,
        0
    );
}

/*
 * 13. Reject approved without --force.
 */
{
    const root = project();

    const identity =
        "src/a.js::approved:function";

    writePlan(
        root,
        [
            node({
                id:
                    "approved-1",
                identity,
                status:
                    "approved"
            })
        ]
    );

    const result =
        runCli(
            [
                "reject",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        1
    );

    assert.match(
        result.stderr,
        /Cannot reject an approved node without --force/
    );

    assert.equal(
        readPlan(root).nodes.length,
        1
    );
}

/*
 * 14. Reject approved with --force.
 */
{
    const root = project();

    const identity =
        "src/a.js::approved:function";

    writePlan(
        root,
        [
            node({
                id:
                    "approved-1",
                identity,
                status:
                    "approved"
            })
        ]
    );

    const result =
        runCli(
            [
                "reject",
                root,
                identity,
                "--force"
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    assert.equal(
        readPlan(root).nodes.length,
        0
    );
}

/*
 * 15. Revise approved.
 */
{
    const root = project();

    const identity =
        "src/a.js::approved:function";

    writePlan(
        root,
        [
            {
                ...node({
                    id:
                        "approved-1",
                    identity,
                    status:
                        "approved"
                }),
                approvedBy:
                    "user",
                approvedAt:
                    "2026-09-05T00:00:00.000Z",
                approvedFacts:
                    {
                        returns: true
                    }
            }
        ]
    );

    const result =
        runCli(
            [
                "plan",
                "revise",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    const saved =
        readPlan(root).nodes[0];

    assert.equal(
        saved.status,
        "intended"
    );

    assert.equal(
        saved.approvedBy,
        undefined
    );

    assert.equal(
        saved.approvedAt,
        undefined
    );

    assert.equal(
        saved.approvedFacts,
        undefined
    );
}

/*
 * 16. Revise intended is a no-op.
 */
{
    const root = project();

    const identity =
        "src/a.js::intended:function";

    writePlan(
        root,
        [
            node({
                id:
                    "intended-1",
                identity
            })
        ]
    );

    const result =
        runCli(
            [
                "plan",
                "revise",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        2
    );

    assert.match(
        result.stdout,
        /Already intended/
    );
}

/*
 * 17. Revise preserves origin.
 */
{
    const root = project();

    const identity =
        "src/a.js::human:function";

    writePlan(
        root,
        [
            {
                ...node({
                    id:
                        "human-1",
                    identity,
                    status:
                        "approved",
                    origin:
                        "human_authored"
                }),
                approvedBy:
                    "user",
                approvedAt:
                    "2026-09-05T00:00:00.000Z",
                approvedFacts:
                    {
                        returns: true
                    }
            }
        ]
    );

    const result =
        runCli(
            [
                "plan",
                "revise",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    const saved =
        readPlan(root).nodes[0];

    assert.equal(
        saved.status,
        "intended"
    );

    assert.equal(
        saved.origin,
        "human_authored"
    );
}

/*
 * 18. Approve -> revise -> approve gives fresh approval metadata.
 */
{
    const root = project();

    const identity =
        "src/a.js::fresh:function";

    writePlan(
        root,
        [
            node({
                id:
                    "fresh-1",
                identity
            })
        ]
    );

    writeBaseline(
        root,
        [
            baselineDeclaration(
                identity,
                {
                    returns:
                        true,
                    numbers:
                        [1]
                }
            )
        ]
    );

    const first =
        runCli(
            [
                "approve",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        first.code,
        0
    );

    const firstPlan =
        readPlan(root);

    const firstAt =
        firstPlan.nodes[0].approvedAt;

    assert.ok(
        firstAt
    );

    const revise =
        runCli(
            [
                "plan",
                "revise",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        revise.code,
        0
    );

    const second =
        runCli(
            [
                "approve",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        second.code,
        0
    );

    const finalPlan =
        readPlan(root);

    const finalNode =
        finalPlan.nodes[0];

    assert.equal(
        finalNode.status,
        "approved"
    );

    assert.ok(
        finalNode.approvedAt
    );

    assert.notEqual(
        finalNode.approvedAt,
        firstAt
    );

    assert.deepEqual(
        finalNode.approvedFacts.numbers,
        [1]
    );
}

/*
 * 19. Plan remains valid after mutations.
 */
{
    const root = project();

    const identity =
        "src/a.js::valid:function";

    writePlan(
        root,
        [
            node({
                id:
                    "valid-1",
                identity
            })
        ]
    );

    writeBaseline(
        root,
        [
            baselineDeclaration(identity)
        ]
    );

    let result =
        runCli(
            [
                "approve",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    let plan =
        readPlan(root);

    assert.equal(
        plan.nodes[0].status,
        "approved"
    );

    result =
        runCli(
            [
                "plan",
                "revise",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    plan =
        readPlan(root);

    assert.equal(
        plan.nodes[0].status,
        "intended"
    );

    result =
        runCli(
            [
                "reject",
                root,
                identity
            ],
            ROOT
        );

    assert.equal(
        result.code,
        0
    );

    plan =
        readPlan(root);

    assert.equal(
        plan.nodes.length,
        0
    );
}

console.log(
    "PASS: Layer 4 approval lifecycle regression suite (19 scenarios)"
);

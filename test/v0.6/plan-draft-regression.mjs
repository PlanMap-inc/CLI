import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(
    fileURLToPath(import.meta.url)
);

const ROOT = path.resolve(
    HERE,
    "../.."
);

const CLI = path.join(
    ROOT,
    "src",
    "cli.js"
);

const MOCK = path.join(
    ROOT,
    "test",
    "helpers",
    "mock-openrouter.mjs"
);

function runCli(
    args,
    cwd,
    {
        apiKey = "",
        response = null,
        mock = false
    } = {}
) {
    const env = {
        ...process.env,
        OPENROUTER_API_KEY: apiKey
    };

    if (response !== null) {
        env.PLANMAP_TEST_RESPONSE =
            response;
    }

    if (mock) {
        env.NODE_OPTIONS = [
            env.NODE_OPTIONS || "",
            `--import=${MOCK}`
        ]
            .filter(Boolean)
            .join(" ");
    }

    const result = spawnSync(
        process.execPath,
        [CLI, ...args],
        {
            cwd,
            env,
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
    const root =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "planmap-layer3-"
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

function writeEvolution(
    root
) {
    const dir =
        path.join(
            root,
            ".planmap"
        );

    fs.mkdirSync(
        dir,
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        path.join(
            dir,
            "evolution.json"
        ),
        JSON.stringify(
            {
                version: 1,

                nodes: [
                    {
                        ts:
                            "2026-09-05T00:00:00.000Z",

                        type:
                            "added",

                        identity:
                            "src/a.js::getName:function",

                        labelSource:
                            "llm",

                        feature:
                            "getName"
                    }
                ]
            },
            null,
            2
        )
    );
}

function validBrownfieldResponse() {
    return JSON.stringify({
        nodes: [
            {
                identity:
                    "src/a.js::getName:function",

                feature:
                    "getName",

                title:
                    "Get name behaviour",

                intent:
                    "Get name must preserve its behaviour.",

                lensTags: [],

                rules: [
                    {
                        kind:
                            "behaviour",

                        target:
                            "src/a.js::getName:function",

                        assert: {
                            throws: {
                                op:
                                    ">=",

                                value:
                                    0
                            }
                        }
                    }
                ]
            }
        ]
    });
}

function assertNoPlan(
    root
) {
    assert.equal(
        fs.existsSync(
            path.join(
                root,
                ".planmap",
                "plan.json"
            )
        ),
        false
    );
}

/*
 * 1. Usage exposes plan draft.
 */
{
    const result =
        runCli([], ROOT);

    assert.match(
        result.stderr,
        /plan draft <project-folder>/
    );
}

/*
 * 2. Brownfield without API key.
 */
{
    const root = project();

    writeEvolution(root);

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey: ""
            }
        );

    assert.equal(
        result.code,
        2,
        result.stderr
    );

    assert.match(
        result.stderr,
        /Cannot draft: OPENROUTER_API_KEY is not configured/
    );

    assertNoPlan(root);
}

/*
 * 3. Brownfield without evolution.
 */
{
    const root = project();

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key"
            }
        );

    assert.equal(
        result.code,
        2,
        result.stderr
    );

    assert.match(
        result.stderr,
        /Cannot draft: no evolution history found/
    );

    assert.match(
        result.stderr,
        /planmap evolution/
    );

    assertNoPlan(root);
}

/*
 * 4. Valid brownfield draft through the real CLI.
 */
{
    const root = project();

    writeEvolution(root);

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response:
                    validBrownfieldResponse(),

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        0,
        `${result.stdout}\n${result.stderr}`
    );

    const plan =
        JSON.parse(
            fs.readFileSync(
                path.join(
                    root,
                    ".planmap",
                    "plan.json"
                ),
                "utf8"
            )
        );

    assert.equal(
        plan.nodes.length,
        1
    );

    assert.equal(
        plan.nodes[0].status,
        "intended"
    );

    assert.equal(
        plan.nodes[0].origin,
        "ai_drafted"
    );
}

/*
 * 5. Invalid lens must fail closed.
 */
{
    const root = project();

    writeEvolution(root);

    const response =
        JSON.stringify({
            nodes: [
                {
                    identity:
                        "src/a.js::getName:function",

                    feature:
                        "getName",

                    title:
                        "Invalid lens",

                    intent:
                        "Invalid lens must be rejected.",

                    lensTags: [
                        "backend"
                    ],

                    rules: [
                        {
                            kind:
                                "behaviour",

                            target:
                                "src/a.js::getName:function",

                            assert: {
                                throws: {
                                    op:
                                        ">=",

                                    value:
                                        0
                                }
                            }
                        }
                    ]
                }
            ]
        });

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response,

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        1
    );

    assert.match(
        result.stderr,
        /unknown lens tag/
    );

    assertNoPlan(root);
}

/*
 * 6. Invalid feature must fail closed.
 */
{
    const root = project();

    writeEvolution(root);

    const response =
        JSON.stringify({
            nodes: [
                {
                    identity:
                        "src/a.js::getName:function",

                    feature:
                        "DoesNotExist",

                    title:
                        "Invalid feature",

                    intent:
                        "Invalid feature must be rejected.",

                    lensTags: [],

                    rules: [
                        {
                            kind:
                                "behaviour",

                            target:
                                "src/a.js::getName:function",

                            assert: {
                                throws: {
                                    op:
                                        ">=",

                                    value:
                                        0
                                }
                            }
                        }
                    ]
                }
            ]
        });

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response,

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        1
    );

    assert.match(
        result.stderr,
        /unknown feature/
    );

    assertNoPlan(root);
}

/*
 * 7. Malformed LLM JSON must fail closed.
 */
{
    const root = project();

    writeEvolution(root);

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response:
                    "{ definitely not json",

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        1
    );

    assertNoPlan(root);
}

/*
 * 8. Greenfield draft must produce lenses, features, and nodes.
 */
{
    const root = project();

    const response =
        JSON.stringify({
            lenses: [
                {
                    id:
                        "lens_1",

                    label:
                        "Backend"
                }
            ],

            features: [
                {
                    id:
                        "feature_1",

                    name:
                        "Authentication"
                }
            ],

            nodes: [
                {
                    id:
                        "node_1",

                    feature:
                        "feature_1",

                    title:
                        "Authentication flow",

                    intent:
                        "Users must be authenticated before protected operations.",

                    lensTags: [
                        "lens_1"
                    ],

                    edgesOut: []
                }
            ]
        });

    const result =
        runCli(
            [
                "plan",
                "draft",
                root,
                "--from",
                "Build an authentication system for protected operations."
            ],
            root,
            {
                apiKey:
                    "test-key",

                response,

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        0,
        `${result.stdout}\n${result.stderr}`
    );

    const plan =
        JSON.parse(
            fs.readFileSync(
                path.join(
                    root,
                    ".planmap",
                    "plan.json"
                ),
                "utf8"
            )
        );

    assert.equal(
        plan.lenses.length,
        1
    );

    assert.equal(
        plan.features.length,
        1
    );

    assert.equal(
        plan.nodes.length,
        1
    );

    assert.equal(
        plan.nodes[0].origin,
        "ai_drafted"
    );

    assert.equal(
        plan.nodes[0].status,
        "intended"
    );

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            plan.nodes[0],
            "identity"
        ),
        false
    );

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            plan.nodes[0],
            "rules"
        ),
        false
    );
}

/*
 * 9. Greenfield draft without lenses must fail closed.
 */
{
    const root = project();

    const response =
        JSON.stringify({
            features: [
                {
                    id:
                        "feature_1",

                    name:
                        "Authentication"
                }
            ],

            nodes: []
        });

    const result =
        runCli(
            [
                "plan",
                "draft",
                root,
                "--from",
                "Build an authentication system."
            ],
            root,
            {
                apiKey:
                    "test-key",

                response,

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        1
    );

    assert.match(
        result.stderr,
        /lens/i
    );

    assertNoPlan(root);
}

/*
 * 10. Brownfield draft with no LLM-labelled evolution
 *     must fail with an actionable vocabulary error.
 */
{
    const root = project();

    const evolutionPath =
        path.join(
            root,
            ".planmap",
            "evolution.json"
        );

    fs.writeFileSync(
        evolutionPath,
        JSON.stringify(
            {
                version:
                    1,

                nodes: [
                    {
                        ts:
                            "2026-09-05T00:00:00.000Z",

                        type:
                            "added",

                        identity:
                            "src/a.js::getName:function",

                        labelSource:
                            "path",

                        feature:
                            "Authentication",

                        tags:
                            []
                    }
                ]
            },
            null,
            2
        )
    );

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response:
                    JSON.stringify({
                        nodes: []
                    }),

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        2,
        `${result.stdout}\n${result.stderr}`
    );

    assert.match(
        result.stderr,
        /Cannot draft: no features found in the evolution graph/
    );

    assert.match(
        result.stderr,
        /planmap evolution <project>/
    );

    assertNoPlan(root);
}

/*
 * 11. Significant declarations only.
 *
 * The candidate comes from evolution history. A trivial declaration
 * that is not represented by evolution must not be drafted.
 */
{
    const root = project();

    const sourceDir =
        path.join(
            root,
            "src"
        );

    fs.mkdirSync(
        sourceDir,
        {
            recursive:
                true
        }
    );

    fs.writeFileSync(
        path.join(
            sourceDir,
            "a.js"
        ),
        `export function getName() {
    return "name";
}

export function trivialGetter() {
    return "trivial";
}
`
    );

    writeEvolution(root);

    const response =
        JSON.stringify({
            nodes: [
                {
                    identity:
                        "src/a.js::getName:function",

                    feature:
                        "getName",

                    title:
                        "Get name behaviour",

                    intent:
                        "Get name must preserve its behaviour.",

                    lensTags: [],

                    rules: [
                        {
                            kind:
                                "behaviour",

                            target:
                                "src/a.js::getName:function",

                            assert: {
                                throws: {
                                    op:
                                        ">=",

                                    value:
                                        0
                                }
                            }
                        }
                    ]
                }
            ]
        });

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response,

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        0,
        `${result.stdout}\n${result.stderr}`
    );

    const plan =
        JSON.parse(
            fs.readFileSync(
                path.join(
                    root,
                    ".planmap",
                    "plan.json"
                ),
                "utf8"
            )
        );

    assert.equal(
        plan.nodes.length,
        1
    );

    assert.equal(
        plan.nodes[0].identity,
        "src/a.js::getName:function"
    );
}

/*
 * 12. Re-drafting preserves human-owned nodes.
 */
{
    const root = project();

    writeEvolution(root);

    const planPath =
        path.join(
            root,
            ".planmap",
            "plan.json"
        );

    const existingPlan = {
        version:
            1,

        lenses: [],

        features: [
            {
                id:
                    "feature_1",

                name:
                    "getName",

                source:
                    "derived"
            }
        ],

        nodes: [
            {
                id:
                    "plan_1",

                feature:
                    "feature_1",

                identity:
                    "src/a.js::getName:function",

                title:
                    "Human title",

                intent:
                    "Human-owned intent.",

                lensTags: [],

                rules: [],

                status:
                    "intended",

                origin:
                    "human_authored"
            },
            {
                id:
                    "plan_2",

                feature:
                    "feature_1",

                identity:
                    "src/a.js::getName:function",

                title:
                    "AI-edited title",

                intent:
                    "Human-edited AI intent.",

                lensTags: [],

                rules: [],

                status:
                    "intended",

                origin:
                    "ai_edited_by_human"
            }
        ]
    };

    fs.writeFileSync(
        planPath,
        JSON.stringify(
            existingPlan,
            null,
            2
        )
    );

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response:
                    validBrownfieldResponse(),

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        0,
        `${result.stdout}\n${result.stderr}`
    );

    const plan =
        JSON.parse(
            fs.readFileSync(
                planPath,
                "utf8"
            )
        );

    const human =
        plan.nodes.find(
            node =>
                node.origin ===
                "human_authored"
        );

    const edited =
        plan.nodes.find(
            node =>
                node.origin ===
                "ai_edited_by_human"
        );

    assert.ok(human);
    assert.ok(edited);

    assert.equal(
        human.title,
        "Human title"
    );

    assert.equal(
        edited.title,
        "AI-edited title"
    );
}

/*
 * 13. Re-drafting may replace an AI-drafted node.
 */
{
    const root = project();

    writeEvolution(root);

    const planPath =
        path.join(
            root,
            ".planmap",
            "plan.json"
        );

    const existingPlan = {
        version:
            1,

        lenses: [],

        features: [
            {
                id:
                    "feature_1",

                name:
                    "getName",

                source:
                    "derived"
            }
        ],

        nodes: [
            {
                id:
                    "plan_1",

                feature:
                    "feature_1",

                identity:
                    "src/a.js::getName:function",

                title:
                    "Old AI draft",

                intent:
                    "Old AI intent.",

                lensTags: [],

                rules: [],

                status:
                    "intended",

                origin:
                    "ai_drafted"
            }
        ]
    };

    fs.writeFileSync(
        planPath,
        JSON.stringify(
            existingPlan,
            null,
            2
        )
    );

    const response =
        JSON.stringify({
            nodes: [
                {
                    identity:
                        "src/a.js::getName:function",

                    feature:
                        "getName",

                    title:
                        "Replacement AI draft",

                    intent:
                        "Replacement AI intent.",

                    lensTags: [],

                    rules: [
                        {
                            kind:
                                "behaviour",

                            target:
                                "src/a.js::getName:function",

                            assert: {
                                throws: {
                                    op:
                                        ">=",

                                    value:
                                        0
                                }
                            }
                        }
                    ]
                }
            ]
        });

    const result =
        runCli(
            [
                "plan",
                "draft",
                root
            ],
            root,
            {
                apiKey:
                    "test-key",

                response,

                mock:
                    true
            }
        );

    assert.equal(
        result.code,
        0,
        `${result.stdout}\n${result.stderr}`
    );

    const plan =
        JSON.parse(
            fs.readFileSync(
                planPath,
                "utf8"
            )
        );

    const aiDrafts =
        plan.nodes.filter(
            node =>
                node.origin ===
                "ai_drafted"
        );

    assert.equal(
        aiDrafts.length,
        1
    );

    assert.equal(
        aiDrafts[0].title,
        "Replacement AI draft"
    );

    assert.equal(
        aiDrafts[0].intent,
        "Replacement AI intent."
    );
}

console.log(
    "PASS: Layer 3 CLI regression suite (13 scenarios)"
);

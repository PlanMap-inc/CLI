import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCli, ROOT } from "../helpers/run-cli.mjs";
import {
    clauseProblem,
    evaluateClause,
    LIST_FACT_FIELDS,
    NUMERIC_FACT_FIELDS
} from "../../src/plan/evaluate.js";

/*
 * 1. clauseProblem agrees with evaluateClause: a clause it accepts
 *    evaluates without error, and a clause it rejects never evaluates.
 */
{
    const facts = {
        throws: 1,
        returns: 1,
        returnsNullish: 0,
        awaits: 0,
        catches: 0,
        emptyCatches: 0,
        params: 2,
        throwTypes: ["Error"],
        calls: ["verifyToken"],
        numbers: [0],
        // A named list's own facts. Present here because this block checks
        // that the two agree for a declaration that HAS every fact - a real
        // function has no entryCount, and both correctly say so.
        entryCount: 12,
        entries: ["first_question"]
    };

    const fields = [
        ...NUMERIC_FACT_FIELDS,
        ...LIST_FACT_FIELDS,
        "bogus"
    ];

    const clauses = [
        { op: ">=", value: 1 },
        { op: "==", value: 0 },
        { op: "!=", value: "1" },
        { op: "contains", value: "Error" },
        { op: "contains", value: 0 },
        { op: "notContains", value: "x" },
        { op: "unchanged" },
        { op: "between", value: 1 },
        null,
        "==",
        []
    ];

    for (const field of fields) {
        for (const clause of clauses) {
            const problem =
                clauseProblem(
                    field,
                    clause
                );

            const result =
                evaluateClause(
                    field,
                    clause,
                    facts,
                    facts
                );

            assert.equal(
                problem === null,
                !result.error,
                `${field} ${JSON.stringify(clause)}: clauseProblem=${problem} evaluateClause=${result.error}`
            );
        }
    }
}

/*
 * 2. A draft keeps verifiable clauses, drops the rest, and says so.
 *    The prompt tells the model which facts are counts and which are lists.
 */
{
    const root =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "planmap-draft-clauses-"
            )
        );

    assert.equal(
        runCli(["init", root], ROOT).code,
        0
    );

    const first = "src/a.js::getName:function";
    const second = "src/a.js::getTag:function";

    fs.writeFileSync(
        path.join(root, ".planmap", "evolution.json"),
        JSON.stringify({
            version: 1,
            nodes: [first, second].map(identity => ({
                ts: "2026-09-05T00:00:00.000Z",
                type: "added",
                identity,
                labelSource: "llm",
                feature: "getName"
            }))
        }, null, 2)
    );

    const response =
        JSON.stringify({
            nodes: [
                {
                    identity: first,
                    feature: "getName",
                    title: "Get name",
                    intent: "Returns the name.",
                    lensTags: [],
                    rules: [
                        {
                            kind: "behaviour",
                            target: first,
                            assert: {
                                throws: { op: ">=", value: 0 },
                                throwTypes: { op: "contains", value: "Error" },
                                params: { op: "unchanged" },
                                calls: { op: "==", value: 0 },
                                numbers: { op: "contains", value: "0" },
                                returns: { op: "contains", value: "x" }
                            }
                        }
                    ]
                },
                {
                    identity: second,
                    feature: "getName",
                    title: "Get tag",
                    intent: "Returns the tag.",
                    lensTags: [],
                    rules: [
                        {
                            kind: "behaviour",
                            target: second,
                            assert: {
                                calls: { op: "==", value: 0 }
                            }
                        }
                    ]
                }
            ]
        });

    const capturePath =
        path.join(root, "prompt.txt");

    const captureMock =
        path.join(root, "capture-openrouter.mjs");

    fs.writeFileSync(
        captureMock,
        `import fs from "node:fs";
globalThis.fetch = async (url, options) => {
    fs.writeFileSync(process.env.PLANMAP_TEST_CAPTURE, JSON.parse(options.body).messages[0].content);
    return { ok: true, json: async () => ({ choices: [{ message: { content: process.env.PLANMAP_TEST_RESPONSE } }] }) };
};
`
    );

    const result =
        runCli(
            ["plan", "draft", root],
            root,
            {
                apiKey: "test-key",
                response,
                env: { PLANMAP_TEST_CAPTURE: capturePath },
                nodeOptions: [`--import=${captureMock}`]
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
                path.join(root, ".planmap", "plan.json"),
                "utf8"
            )
        );

    const nodeFor =
        identity =>
            plan.nodes.find(node => node.identity === identity);

    assert.deepEqual(
        Object.keys(nodeFor(first).rules[0].assert).sort(),
        ["params", "throwTypes", "throws"],
        "only verifiable clauses are written"
    );

    assert.deepEqual(
        nodeFor(second).rules,
        [],
        "a rule left with no verifiable clause is dropped; the node stays"
    );

    assert.match(
        result.stdout,
        /Dropped rule checks verify can't evaluate: 4/
    );

    assert.match(
        result.stdout,
        /src\/a\.js::getName:function: calls is an array; use contains or notContains/
    );

    const prompt =
        fs.readFileSync(
            capturePath,
            "utf8"
        );

    assert.match(prompt, /Count facts hold a number/);
    assert.match(prompt, /List facts hold a list/);
    assert.match(prompt, /NEVER use ">=", "<=", "==" or "!=" on a list fact/);

    for (const field of NUMERIC_FACT_FIELDS) {
        assert.ok(
            prompt.includes(`\n${field}\n`),
            `prompt lists the count fact ${field}`
        );
    }

    /*
     * 3. plan validate reports the errors readPlan hides.
     */
    const validate =
        (...extra) =>
            runCli(["plan", "validate", root, ...extra], root);

    let check = validate("--json");
    assert.equal(check.code, 0, check.stderr);
    assert.deepEqual(JSON.parse(check.stdout), { schema: 1, valid: true, errors: [] });
    assert.match(validate().stdout, /plan\.json is valid\./);

    plan.features[0].status = "in-progress";
    fs.writeFileSync(path.join(root, ".planmap", "plan.json"), JSON.stringify(plan, null, 2));

    check = validate("--json");
    assert.equal(check.code, 1);
    assert.equal(JSON.parse(check.stdout).valid, false);
    assert.ok(JSON.parse(check.stdout).errors.includes("features[0].status is invalid"));

    fs.writeFileSync(path.join(root, ".planmap", "plan.json"), "{ not json");
    check = validate("--json");
    assert.equal(check.code, 1);
    assert.match(JSON.parse(check.stdout).errors[0], /plan\.json is not valid JSON/);

    fs.rmSync(path.join(root, ".planmap", "plan.json"));
    check = validate("--json");
    assert.equal(check.code, 2);
    assert.deepEqual(JSON.parse(check.stdout), { schema: 1, valid: false, errors: [], message: "No plan found." });

    fs.rmSync(root, { recursive: true, force: true });
}

console.log("draft clause regression passed");

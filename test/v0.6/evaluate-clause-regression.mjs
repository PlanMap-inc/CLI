import assert from "node:assert/strict";
import { evaluateClause } from "../../src/plan/evaluate.js";

const numericFields = [
    "throws",
    "returns",
    "returnsNullish",
    "awaits",
    "catches",
    "emptyCatches",
    "params"
];

const arrayFields = [
    "throwTypes",
    "calls",
    "numbers"
];

for (const field of numericFields) {
    const facts = { [field]: 3 };

    assert.equal(
        evaluateClause(
            field,
            { op: ">=", value: 3 },
            facts
        ).pass,
        true
    );

    assert.equal(
        evaluateClause(
            field,
            { op: "<=", value: 3 },
            facts
        ).pass,
        true
    );

    assert.equal(
        evaluateClause(
            field,
            { op: "==", value: 3 },
            facts
        ).pass,
        true
    );

    assert.equal(
        evaluateClause(
            field,
            { op: "!=", value: 4 },
            facts
        ).pass,
        true
    );

    assert.equal(
        evaluateClause(
            field,
            { op: ">=", value: 4 },
            facts
        ).pass,
        false
    );
}

for (const field of arrayFields) {
    const facts = {
        [field]: field === "numbers"
            ? [100, 200]
            : ["A", "B"]
    };

    const containsValue =
        field === "numbers" ? 100 : "A";

    const missingValue =
        field === "numbers" ? 300 : "C";

    assert.equal(
        evaluateClause(
            field,
            { op: "contains", value: containsValue },
            facts
        ).pass,
        true
    );

    assert.equal(
        evaluateClause(
            field,
            { op: "notContains", value: missingValue },
            facts
        ).pass,
        true
    );

    assert.equal(
        evaluateClause(
            field,
            { op: "contains", value: missingValue },
            facts
        ).pass,
        false
    );
}

{
    const facts = { throws: 2 };
    const approvedFacts = { throws: 2 };

    assert.equal(
        evaluateClause(
            "throws",
            { op: "unchanged" },
            facts,
            approvedFacts
        ).pass,
        true
    );

    assert.equal(
        evaluateClause(
            "throws",
            { op: "unchanged" },
            { throws: 3 },
            approvedFacts
        ).pass,
        false
    );

    assert.ok(
        evaluateClause(
            "throws",
            { op: "unchanged" },
            facts
        ).error
    );
}

{
    const result = evaluateClause(
        "throwTypes",
        { op: ">=", value: 1 },
        { throwTypes: ["Error"] }
    );

    assert.ok(result.error);
}

{
    const result = evaluateClause(
        "throws",
        { op: "contains", value: "Error" },
        { throws: 1 }
    );

    assert.ok(result.error);
}

{
    const result = evaluateClause(
        "missingField",
        { op: "==", value: 0 },
        { throws: 0 }
    );

    assert.ok(result.error);
}

console.log("evaluate-clause-regression: PASS");

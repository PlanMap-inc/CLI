const NUMERIC_FIELDS = new Set([
    "throws",
    "returns",
    "returnsNullish",
    "awaits",
    "catches",
    "emptyCatches",
    "params"
]);

const ARRAY_FIELDS = new Set([
    "throwTypes",
    "calls",
    "numbers"
]);

const COMPARISON_OPERATORS = new Set([
    ">=",
    "<=",
    "==",
    "!="
]);

const ARRAY_OPERATORS = new Set([
    "contains",
    "notContains"
]);

const FACT_FIELDS = new Set([
    ...NUMERIC_FIELDS,
    ...ARRAY_FIELDS
]);

export function evaluateClause(
    field,
    clause,
    facts,
    approvedFacts
) {
    if (
        !facts ||
        typeof facts !== "object" ||
        !(field in facts)
    ) {
        return {
            error: `${field} is not present in the current facts`
        };
    }

    const actual = facts[field];

    if (clause?.op === "unchanged") {
        if (
            !approvedFacts ||
            typeof approvedFacts !== "object" ||
            !(field in approvedFacts)
        ) {
            return {
                error: `re-approve to capture facts`
            };
        }

        const expected = approvedFacts[field];
        const pass =
            JSON.stringify(actual) ===
            JSON.stringify(expected);

        return {
            pass,
            actual,
            expected,
            reason: pass
                ? null
                : `${field} changed since approval`
        };
    }

    if (!clause || typeof clause !== "object") {
        return {
            error: `${field} has an invalid clause`
        };
    }

    const operator = clause.op;

    if (
        ARRAY_OPERATORS.has(operator)
    ) {
        if (!ARRAY_FIELDS.has(field)) {
            return {
                error:
                    `${field} is numeric; use >=, <=, ==, or !=`
            };
        }

        if (!Array.isArray(actual)) {
            return {
                error:
                    `${field} is not an array in the current facts`
            };
        }

        const expected = clause.value;

        const expectedValid =
            field === "numbers"
                ? typeof expected === "number" &&
                  !Number.isNaN(expected)
                : typeof expected === "string";

        if (!expectedValid) {
            return {
                error:
                    field === "numbers"
                        ? `${field} contains operators require a numeric value`
                        : `${field} contains operators require a string value`
            };
        }

        const contains =
            actual.includes(expected);

        const pass =
            operator === "contains"
                ? contains
                : !contains;

        return {
            pass,
            actual,
            expected,
            reason: pass
                ? null
                : `${field} does not satisfy ${operator}`
        };
    }

    if (
        COMPARISON_OPERATORS.has(operator)
    ) {
        if (!NUMERIC_FIELDS.has(field)) {
            return {
                error:
                    `${field} is an array; use contains or notContains`
            };
        }

        if (
            typeof actual !== "number" ||
            Number.isNaN(actual)
        ) {
            return {
                error:
                    `${field} is not numeric in the current facts`
            };
        }

        const expected = clause.value;

        if (
            typeof expected !== "number" ||
            Number.isNaN(expected)
        ) {
            return {
                error:
                    `${field} comparison requires a numeric value`
            };
        }

        let pass;

        switch (operator) {
            case ">=":
                pass = actual >= expected;
                break;

            case "<=":
                pass = actual <= expected;
                break;

            case "==":
                pass = actual === expected;
                break;

            case "!=":
                pass = actual !== expected;
                break;

            default:
                return {
                    error:
                        `Unsupported operator: ${operator}`
                };
        }

        return {
            pass,
            actual,
            expected,
            reason: pass
                ? null
                : `${field} does not satisfy ${operator}`
        };
    }

    return {
        error:
            `Unsupported operator: ${operator}`
    };
}

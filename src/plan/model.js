/*
 * --------------------------------------------------
 * PLAN MODEL
 * 1-Defines the v0.6 plan artifact shape.
 * 2-Provides the empty plan used when no plan exists.
 * 3-Validates the persisted plan structure.
 * 4-Keeps validation deterministic and dependency-free.
 * --------------------------------------------------
 */

const VALID_LENS_SOURCES = [
    "derived",
    "human_added"
];

const VALID_NODE_ORIGINS = [
    "ai_drafted",
    "human_authored",
    "ai_edited_by_human"
];

const VALID_NODE_STATUSES = [
    "intended",
    "approved",
    "implemented",
    "drifted",
    "error"
];

const VALID_RULE_KINDS = [
    "behaviour",
    "structure"
];

const VALID_ASSERT_OPERATORS = [
    ">=",
    "<=",
    "==",
    "!=",
    "contains",
    "notContains",
    "unchanged"
];

const VALID_FACT_FIELDS = [
    "throws",
    "throwTypes",
    "returns",
    "returnsNullish",
    "calls",
    "numbers",
    "awaits",
    "catches",
    "emptyCatches",
    "params"
];


// --------------------------------------------------
// CREATE EMPTY PLAN
// --------------------------------------------------

export function createEmptyPlan() {
    return {
        version: 1,
        lenses: [],
        features: [],
        nodes: []
    };
}


// --------------------------------------------------
// VALIDATE PLAN
// --------------------------------------------------

export function validatePlan(
    plan
) {
    const errors = [];

    if (
        !plan ||
        typeof plan !== "object" ||
        Array.isArray(plan)
    ) {
        return [
            "plan must be an object"
        ];
    }

    if (
        plan.version !== 1
    ) {
        errors.push(
            "version must be 1"
        );
    }

    if (
        !Array.isArray(
            plan.lenses
        )
    ) {
        errors.push(
            "lenses must be an array"
        );
    }

    if (
        !Array.isArray(
            plan.features
        )
    ) {
        errors.push(
            "features must be an array"
        );
    }

    if (
        !Array.isArray(
            plan.nodes
        )
    ) {
        errors.push(
            "nodes must be an array"
        );
    }

    if (
        Array.isArray(plan.lenses)
    ) {
        plan.lenses.forEach(
            (lens, index) => {
                validateLens(
                    lens,
                    index,
                    errors
                );
            }
        );
    }

    if (
        Array.isArray(plan.features)
    ) {
        plan.features.forEach(
            (feature, index) => {
                validateFeature(
                    feature,
                    index,
                    errors
                );
            }
        );
    }

    if (
        Array.isArray(plan.nodes)
    ) {
        plan.nodes.forEach(
            (node, index) => {
                validateNode(
                    node,
                    index,
                    errors
                );
            }
        );
    }

    return errors;
}


// --------------------------------------------------
// VALIDATE LENS
// --------------------------------------------------

function validateLens(
    lens,
    index,
    errors
) {
    const prefix =
        `lenses[${index}]`;

    if (
        !lens ||
        typeof lens !== "object" ||
        Array.isArray(lens)
    ) {
        errors.push(
            `${prefix} must be an object`
        );

        return;
    }

    requireString(
        lens.id,
        `${prefix}.id`,
        errors
    );

    requireString(
        lens.label,
        `${prefix}.label`,
        errors
    );

    if (
        lens.source !== undefined &&
        !VALID_LENS_SOURCES.includes(
            lens.source
        )
    ) {
        errors.push(
            `${prefix}.source must be derived or human_added`
        );
    }

    if (
        lens.derivedFrom !== undefined &&
        typeof lens.derivedFrom !== "string"
    ) {
        errors.push(
            `${prefix}.derivedFrom must be a string`
        );
    }

    if (
        lens.color !== undefined &&
        typeof lens.color !== "string"
    ) {
        errors.push(
            `${prefix}.color must be a string`
        );
    }
}


// --------------------------------------------------
// VALIDATE FEATURE
// --------------------------------------------------

function validateFeature(
    feature,
    index,
    errors
) {
    const prefix =
        `features[${index}]`;

    if (
        !feature ||
        typeof feature !== "object" ||
        Array.isArray(feature)
    ) {
        errors.push(
            `${prefix} must be an object`
        );

        return;
    }

    requireString(
        feature.id,
        `${prefix}.id`,
        errors
    );

    requireString(
        feature.name,
        `${prefix}.name`,
        errors
    );

    if (
        feature.status !== undefined &&
        !VALID_NODE_STATUSES.includes(
            feature.status
        )
    ) {
        errors.push(
            `${prefix}.status is invalid`
        );
    }

    if (
        feature.source !== undefined &&
        !VALID_LENS_SOURCES.includes(
            feature.source
        )
    ) {
        errors.push(
            `${prefix}.source must be derived or human_added`
        );
    }

    if (
        feature.derivedFrom !== undefined &&
        typeof feature.derivedFrom !== "string"
    ) {
        errors.push(
            `${prefix}.derivedFrom must be a string`
        );
    }

    if (
        feature.color !== undefined &&
        typeof feature.color !== "string"
    ) {
        errors.push(
            `${prefix}.color must be a string`
        );
    }
}


// --------------------------------------------------
// VALIDATE NODE
// --------------------------------------------------

function validateNode(
    node,
    index,
    errors
) {
    const prefix =
        `nodes[${index}]`;

    if (
        !node ||
        typeof node !== "object" ||
        Array.isArray(node)
    ) {
        errors.push(
            `${prefix} must be an object`
        );

        return;
    }

    requireString(
        node.id,
        `${prefix}.id`,
        errors
    );

    requireString(
        node.title,
        `${prefix}.title`,
        errors
    );

    requireString(
        node.intent,
        `${prefix}.intent`,
        errors
    );

    if (
        node.feature !== undefined &&
        typeof node.feature !== "string"
    ) {
        errors.push(
            `${prefix}.feature must be a string`
        );
    }

    if (
        node.identity !== undefined &&
        typeof node.identity !== "string"
    ) {
        errors.push(
            `${prefix}.identity must be a string`
        );
    }

    if (
        node.lensTags !== undefined &&
        !isStringArray(
            node.lensTags
        )
    ) {
        errors.push(
            `${prefix}.lensTags must be an array of strings`
        );
    }

    if (
        node.edgesOut !== undefined &&
        !isStringArray(
            node.edgesOut
        )
    ) {
        errors.push(
            `${prefix}.edgesOut must be an array of strings`
        );
    }

    if (
        node.rules !== undefined
    ) {
        if (
            !Array.isArray(node.rules)
        ) {
            errors.push(
                `${prefix}.rules must be an array`
            );
        } else {
            node.rules.forEach(
                (rule, ruleIndex) => {
                    validateRule(
                        rule,
                        `${prefix}.rules[${ruleIndex}]`,
                        errors
                    );
                }
            );
        }
    }

    if (
        node.status !== undefined &&
        !VALID_NODE_STATUSES.includes(
            node.status
        )
    ) {
        errors.push(
            `${prefix}.status is invalid`
        );
    }

    if (
        node.origin !== undefined &&
        !VALID_NODE_ORIGINS.includes(
            node.origin
        )
    ) {
        errors.push(
            `${prefix}.origin is invalid`
        );
    }

    if (
        node.approvedBy !== undefined &&
        typeof node.approvedBy !== "string"
    ) {
        errors.push(
            `${prefix}.approvedBy must be a string`
        );
    }

    if (
        node.approvedAt !== undefined &&
        typeof node.approvedAt !== "string"
    ) {
        errors.push(
            `${prefix}.approvedAt must be a string`
        );
    }

    if (
        node.approvedFacts !== undefined &&
        (
            !node.approvedFacts ||
            typeof node.approvedFacts !== "object" ||
            Array.isArray(node.approvedFacts)
        )
    ) {
        errors.push(
            `${prefix}.approvedFacts must be an object`
        );
    }

    if (
        node.annotation !== undefined &&
        typeof node.annotation !== "string"
    ) {
        errors.push(
            `${prefix}.annotation must be a string`
        );
    }

    if (
        node.createdAt !== undefined &&
        typeof node.createdAt !== "string"
    ) {
        errors.push(
            `${prefix}.createdAt must be a string`
        );
    }
}


// --------------------------------------------------
// VALIDATE RULE
// --------------------------------------------------

function validateRule(
    rule,
    prefix,
    errors
) {
    if (
        !rule ||
        typeof rule !== "object" ||
        Array.isArray(rule)
    ) {
        errors.push(
            `${prefix} must be an object`
        );

        return;
    }

    if (
        !VALID_RULE_KINDS.includes(
            rule.kind
        )
    ) {
        errors.push(
            `${prefix}.kind must be behaviour or structure`
        );
    }

    requireString(
        rule.target,
        `${prefix}.target`,
        errors
    );

    if (
        rule.assert !== undefined
    ) {
        if (
            !rule.assert ||
            typeof rule.assert !== "object" ||
            Array.isArray(rule.assert)
        ) {
            errors.push(
                `${prefix}.assert must be an object`
            );
        } else {
            for (
                const [
                    field,
                    clause
                ] of Object.entries(
                    rule.assert
                )
            ) {
                if (
                    !VALID_FACT_FIELDS.includes(
                        field
                    )
                ) {
                    errors.push(
                        `${prefix}.assert.${field} is not a supported fact field`
                    );

                    continue;
                }

                validateClause(
                    clause,
                    `${prefix}.assert.${field}`,
                    errors
                );
            }
        }
    }
}


// --------------------------------------------------
// VALIDATE ASSERT CLAUSE
// --------------------------------------------------

function validateClause(
    clause,
    prefix,
    errors
) {
    if (
        !clause ||
        typeof clause !== "object" ||
        Array.isArray(clause)
    ) {
        errors.push(
            `${prefix} must be an object`
        );

        return;
    }

    if (
        !VALID_ASSERT_OPERATORS.includes(
            clause.op
        )
    ) {
        errors.push(
            `${prefix}.op is not supported`
        );
    }

    if (
        !Object.prototype.hasOwnProperty.call(
            clause,
            "value"
        ) &&
        clause.op !== "unchanged"
    ) {
        errors.push(
            `${prefix}.value is required`
        );
    }
}


// --------------------------------------------------
// STRING HELPERS
// --------------------------------------------------

function requireString(
    value,
    field,
    errors
) {
    if (
        typeof value !== "string" ||
        value.trim() === ""
    ) {
        errors.push(
            `${field} must be a non-empty string`
        );
    }
}


function isStringArray(
    value
) {
    return (
        Array.isArray(value) &&
        value.every(
            item =>
                typeof item === "string"
        )
    );
}


// --------------------------------------------------
// EXPORT VALIDATION CONSTANTS
// --------------------------------------------------

export const PLAN_STATUS_VALUES =
    Object.freeze([
        ...VALID_NODE_STATUSES
    ]);

export const PLAN_ORIGIN_VALUES =
    Object.freeze([
        ...VALID_NODE_ORIGINS
    ]);

export const PLAN_LENS_SOURCE_VALUES =
    Object.freeze([
        ...VALID_LENS_SOURCES
    ]);

export const PLAN_RULE_KINDS =
    Object.freeze([
        ...VALID_RULE_KINDS
    ]);

export const PLAN_FACT_FIELDS =
    Object.freeze([
        ...VALID_FACT_FIELDS
    ]);

export const PLAN_ASSERT_OPERATORS =
    Object.freeze([
        ...VALID_ASSERT_OPERATORS
    ]);

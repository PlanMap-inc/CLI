/*
 * ------------------------------------------------------------
 * EVOLUTION STATUS
 * ------------------------------------------------------------
 *
 * Evolution is derived from code and remains read-only.
 *
 * Status is also derived.
 *
 * Without an approved Plan there is no intent to compare
 * against, so an Evolution node cannot be "drifted".
 *
 * Current Layer 0 behaviour:
 *
 *     no approved rule -> implemented
 *
 * Later layers will extend this to:
 *
 *     intended
 *     approved
 *     implemented
 *     drifted
 *     error
 *
 * This module also provides an identity -> evolution-node
 * reverse index so later verification does not need to scan
 * the complete evolution history repeatedly.
 * ------------------------------------------------------------
 */


/*
 * ------------------------------------------------------------
 * DEFAULT STATUS
 * ------------------------------------------------------------
 */

const DEFAULT_STATUS =
    "implemented";


/*
 * ------------------------------------------------------------
 * DERIVE EVOLUTION STATUS
 * ------------------------------------------------------------
 *
 * Layer 0 intentionally knows nothing about Plan rules.
 *
 * If no approved Plan exists, the code is simply the current
 * implementation. A changed implementation is not automatically
 * drift.
 * ------------------------------------------------------------
 */

export function deriveEvolutionStatus(
    node,
    planRule = null
) {
    /*
     * A deleted declaration is a reality-side fact.
     *
     * It must never be reported as "implemented", even when
     * there is no Plan rule. Drift is a Plan-vs-reality result
     * and belongs to Layer 3; deletion itself is already known
     * from the Evolution event.
     */
    if (
        node?.type === "deleted"
    ) {
        return "deleted";
    }

    if (
        !planRule ||
        planRule.approved !== true
    ) {
        return DEFAULT_STATUS;
    }

    /*
     * Plan-aware verification is implemented in Layer 3.
     *
     * Keep this branch explicit so later code cannot accidentally
     * manufacture "drifted" status before verification exists.
     */

    return DEFAULT_STATUS;
}


/*
 * ------------------------------------------------------------
 * BUILD IDENTITY INDEX
 * ------------------------------------------------------------
 *
 * Multiple Evolution nodes can belong to the same declaration.
 *
 * Example:
 *
 *     identity
 *         |
 *         +-- node 1
 *         +-- node 2
 *         +-- node 3
 *
 * The returned Map is intentionally derived and read-only.
 * ------------------------------------------------------------
 */

export function buildEvolutionIdentityIndex(
    evolution = {}
) {
    const index =
        new Map();

    const nodes =
        Array.isArray(
            evolution.nodes
        )
            ? evolution.nodes
            : [];

    for (
        const node
        of nodes
    ) {
        if (
            typeof node?.identity !== "string" ||
            node.identity.length === 0
        ) {
            continue;
        }

        if (
            !index.has(
                node.identity
            )
        ) {
            index.set(
                node.identity,
                []
            );
        }

        index
            .get(node.identity)
            .push(node);
    }

    return index;
}


/*
 * ------------------------------------------------------------
 * APPLY DERIVED STATUS
 * ------------------------------------------------------------
 *
 * Returns a new Evolution object.
 * The original object is not mutated.
 *
 * This keeps Evolution generation deterministic and prevents
 * status calculation from becoming a second source of truth.
 * ------------------------------------------------------------
 */

export function applyEvolutionStatus(
    evolution = {},
    planRules = []
) {
    const rules =
        Array.isArray(
            planRules
        )
            ? planRules
            : [];

    const rulesByIdentity =
        new Map();

    for (
        const rule
        of rules
    ) {
        if (
            typeof rule?.target !== "string" ||
            rule.target.length === 0
        ) {
            continue;
        }

        if (
            !rulesByIdentity.has(
                rule.target
            )
        ) {
            rulesByIdentity.set(
                rule.target,
                []
            );
        }

        rulesByIdentity
            .get(rule.target)
            .push(rule);
    }

    /*
     * ------------------------------------------------------------
     * APPLY STATUS METADATA
     * ------------------------------------------------------------
     *
     * Layer 0 records the derived status together with
     * its source and the time the status was verified.
     *
     * "derived" means the status came from PlanMap's
     * deterministic reality-side derivation.
     * ------------------------------------------------------------
     */

    const lastVerified =
        new Date().toISOString();

    const nodes =
        Array.isArray(
            evolution.nodes
        )
            ? evolution.nodes
                .map(
                    node => {
                        const status =
                            deriveEvolutionStatus(
                                node,
                                (
                                    rulesByIdentity
                                        .get(
                                            node?.identity
                                        ) || []
                                ).find(
                                    rule =>
                                        rule?.approved === true
                                ) || null
                            );

                        return {
                            ...node,
                            status,
                            statusSource:
                                "derived",
                            lastVerified
                        };
                    }
                )
            : [];

    return {
        ...evolution,
        nodes
    };
}

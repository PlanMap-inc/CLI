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
 * THE STATUS OF ONE DECLARATION
 * ------------------------------------------------------------
 *
 * A plan node may stand for several declarations, and Project
 * Evolution draws a row per declaration. The node's own result
 * is one verdict over all of them, so painting it onto every
 * row marks functions that did not change, and leaves the one
 * that did looking the same as its neighbours.
 *
 * A violation or an error names the declaration it is about.
 * That is what a row gets.
 *
 * Once a failure has been pinned to particular declarations,
 * a declaration nobody pinned it on is not the one that failed,
 * so it reads as implemented rather than inheriting the node's
 * verdict. Anything the node failed for that names no
 * declaration - a rule with no target, a missing approved
 * declaration - is not attributable, and then every row keeps
 * the node's own verdict, which is what an unmerged node has
 * always had.
 * ------------------------------------------------------------
 */

function rowStatus(
    result,
    identity
) {
    const named =
        list =>
            (Array.isArray(list) ? list : []).filter(
                entry => typeof entry?.target === "string"
            );

    const errors =
        named(result?.errors);

    const violations =
        named(result?.violations);

    // Errors before violations, the same order the engine ranks
    // them in when it decides the node's own status.
    if (
        errors.some(
            entry => entry.target === identity
        )
    ) {
        return "error";
    }

    if (
        violations.some(
            entry => entry.target === identity
        )
    ) {
        return "drifted";
    }

    const unattributed =
        [
            ...(Array.isArray(result?.errors) ? result.errors : []),
            ...(Array.isArray(result?.violations) ? result.violations : [])
        ].some(
            entry => typeof entry?.target !== "string"
        );

    if (
        !unattributed &&
        (
            errors.length > 0 ||
            violations.length > 0
        )
    ) {
        return "implemented";
    }

    return result?.status;
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

export function applyVerificationStatus(
    evolution = {},
    results = []
) {
    const resultByIdentity =
        new Map();

    for (const result of Array.isArray(results) ? results : []) {
        // Every declaration the result covers, not only the first.
        const identities =
            Array.isArray(result?.identities) &&
            result.identities.length > 0
                ? result.identities
                : [result?.identity];

        for (const identity of identities) {
            if (
                typeof identity !== "string" ||
                identity.length === 0
            ) {
                continue;
            }

            resultByIdentity.set(
                identity,
                result
            );
        }
    }

    const index =
        buildEvolutionIdentityIndex(
            evolution
        );

    const nodes =
        Array.isArray(evolution.nodes)
            ? evolution.nodes.map(
                node => ({
                    ...node
                })
            )
            : [];

    for (const [, identityNodes] of index) {
        const sorted =
            [...identityNodes]
                .sort(
                    (left, right) =>
                        String(left.ts ?? "")
                            .localeCompare(
                                String(right.ts ?? "")
                            )
                );

        const latest =
            sorted[sorted.length - 1];

        for (const node of sorted.slice(0, -1)) {
            const copy =
                nodes.find(
                    candidate =>
                        candidate?.id === node?.id
                );

            if (copy) {
                copy.status =
                    "superseded";

                copy.statusSource =
                    "verified";
            }
        }

        const result =
            resultByIdentity.get(
                latest?.identity
            );

        if (!result) {
            continue;
        }

        const copy =
            nodes.find(
                candidate =>
                    candidate?.id === latest?.id
            );

        if (!copy) {
            continue;
        }

        copy.status =
            rowStatus(
                result,
                latest.identity
            );

        copy.statusSource =
            "verified";

        copy.lastVerified =
            new Date().toISOString();

        copy.verifiedAgainst =
            `${result.planNodeId}@${result.planVersion ?? 1}`;
    }

    return {
        ...evolution,
        nodes
    };
}


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
                        // A verify result is a measurement, not a
                        // derivation: it says what the code did when it was
                        // checked against an approved rule. Re-deriving over
                        // it threw every drift away on each refresh, and now
                        // that the watcher asks you to refresh, that meant
                        // losing the drift map constantly.
                        //
                        // It stands until a verify replaces it, or until the
                        // plan node it was measured against is gone.
                        if (
                            node?.statusSource === "verified" &&
                            node?.verifiedAgainst
                        ) {
                            return node;
                        }

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

/*
 * Layer 4 approval state transitions.
 *
 * Pure functions only:
 * - no filesystem access
 * - no CLI handling
 * - no timestamps generated here
 * - no baseline reads
 */

const APPROVAL_ERROR =
    "Only intended plan nodes can be approved.";

const REJECT_APPROVED_ERROR =
    "Cannot reject an approved node without --force.";

const REVISE_ERROR =
    "Only intended or approved plan nodes can be revised.";


// --------------------------------------------------
// APPROVE NODE
// --------------------------------------------------

export function approveNode(
    node,
    {
        approvedBy,
        approvedAt,
        facts
    } = {}
) {
    if (
        !node ||
        typeof node !== "object"
    ) {
        return {
            node,
            changed: false,
            error: APPROVAL_ERROR
        };
    }

    if (
        node.status === "approved"
    ) {
        return {
            node: {
                ...node
            },
            changed: false,
            error: null,
            alreadyApproved: true
        };
    }

    if (
        node.status !== "intended"
    ) {
        return {
            node: {
                ...node
            },
            changed: false,
            error: APPROVAL_ERROR
        };
    }

    const nextNode = {
        ...node,
        status: "approved"
    };

    if (
        approvedBy !== undefined
    ) {
        nextNode.approvedBy =
            approvedBy;
    }

    if (
        approvedAt !== undefined
    ) {
        nextNode.approvedAt =
            approvedAt;
    }

    if (
        facts !== undefined
    ) {
        nextNode.approvedFacts =
            facts;
    }

    return {
        node: nextNode,
        changed: true,
        error: null
    };
}


// --------------------------------------------------
// REJECT NODE
// --------------------------------------------------

export function rejectNode(
    node,
    {
        force = false
    } = {}
) {
    if (
        !node ||
        typeof node !== "object"
    ) {
        return {
            remove: false,
            error: REJECT_APPROVED_ERROR
        };
    }

    if (
        node.status === "intended"
    ) {
        return {
            remove: true,
            error: null
        };
    }

    if (
        node.status === "approved"
    ) {
        if (!force) {
            return {
                remove: false,
                error: REJECT_APPROVED_ERROR
            };
        }

        return {
            remove: true,
            error: null
        };
    }

    return {
        remove: false,
        error:
            "Only intended or approved plan nodes can be rejected."
    };
}


// --------------------------------------------------
// REVISE NODE
// --------------------------------------------------

export function reviseNode(
    node
) {
    if (
        !node ||
        typeof node !== "object"
    ) {
        return {
            node,
            changed: false,
            error: REVISE_ERROR
        };
    }

    if (
        node.status === "intended"
    ) {
        return {
            node: {
                ...node
            },
            changed: false,
            error: null
        };
    }

    if (
        node.status !== "approved"
    ) {
        return {
            node: {
                ...node
            },
            changed: false,
            error: REVISE_ERROR
        };
    }

    const nextNode = {
        ...node,
        status: "intended"
    };

    delete nextNode.approvedBy;
    delete nextNode.approvedAt;
    delete nextNode.approvedFacts;

    return {
        node: nextNode,
        changed: true,
        error: null
    };
}


// --------------------------------------------------
// SELECT NODES
// --------------------------------------------------

export function selectNodes(
    plan,
    {
        identity,
        all = false,
        lens,
        feature
    } = {}
) {
    const nodes =
        Array.isArray(plan?.nodes)
            ? plan.nodes
            : [];

    const hasIdentity =
        typeof identity === "string" &&
        identity.length > 0;

    const hasLens =
        typeof lens === "string" &&
        lens.length > 0;

    const hasFeature =
        typeof feature === "string" &&
        feature.length > 0;

    const selectors =
        Number(hasIdentity) +
        Number(all) +
        Number(hasLens) +
        Number(hasFeature);

    if (selectors === 0) {
        return {
            matched: [],
            errors: [
                "A target, --all, --lens, or --feature is required."
            ]
        };
    }

    if (selectors > 1) {
        return {
            matched: [],
            errors: [
                "Use only one target selector."
            ]
        };
    }

    if (hasIdentity) {
        const matched =
            nodes.filter(
                node =>
                    (
                        node?.identity ===
                        identity ||
                        node?.id ===
                        identity
                    )
            );

        if (matched.length === 0) {
            return {
                matched: [],
                errors: [
                    `Plan node not found: ${identity}`
                ]
            };
        }

        return {
            matched,
            errors: []
        };
    }

    if (all) {
        return {
            matched: [
                ...nodes
            ],
            errors: []
        };
    }

    if (hasLens) {
        const matched =
            nodes.filter(
                node =>
                    Array.isArray(
                        node?.lensTags
                    ) &&
                    node.lensTags.includes(
                        lens
                    )
            );

        return {
            matched,
            errors: []
        };
    }

    const matched =
        nodes.filter(
            node =>
                node?.feature ===
                feature
        );

    return {
        matched,
        errors: []
    };
}

/*
 * Layer 4 approval state transitions.
 *
 * Pure functions only:
 * - no filesystem access
 * - no CLI handling
 * - no timestamps generated here
 * - no baseline reads
 */

import {
    nodeIdentities
} from "./nodes.js";


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
        facts,
        factsByIdentity
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

    // One snapshot per declaration, on a node that stands for more than
    // one. approvedFacts alone belongs to the first of them, so an
    // "unchanged" rule on any of the others had nothing to compare
    // against - or worse, compared against the wrong declaration's facts.
    if (
        factsByIdentity !== undefined
    ) {
        nextNode.approvedFactsByIdentity =
            factsByIdentity;
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
    delete nextNode.approvedFactsByIdentity;

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

    // --------------------------------------------------
    // ONE LENS, INSIDE ONE FEATURE
    // --------------------------------------------------
    // The only pair that means anything: "approve this feature's security
    // steps". Everything else is still one selector at a time, because
    // "an identity in this feature" narrows nothing and "--all --lens"
    // is just --lens.
    //
    // Without this the interface could only offer to approve a lens
    // across the WHOLE plan from inside one feature, which is not what
    // the button appears to say.
    // --------------------------------------------------
    if (
        selectors === 2 &&
        hasFeature &&
        hasLens
    ) {
        return {
            matched:
                nodes.filter(
                    node =>
                        node?.feature === feature &&
                        Array.isArray(node?.lensTags) &&
                        node.lensTags.includes(lens)
                ),

            errors: []
        };
    }

    if (selectors > 1) {
        return {
            matched: [],
            errors: [
                "Use only one target selector, or --feature with --lens."
            ]
        };
    }

    if (hasIdentity) {
        // Its id, or ANY declaration it stands for. A merged node was only
        // reachable by its first declaration, so approving or revising by
        // one of the others reported "Plan node not found" for code the
        // plan does hold.
        const matched =
            nodes.filter(
                node =>
                    node?.id === identity ||
                    nodeIdentities(node).includes(
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

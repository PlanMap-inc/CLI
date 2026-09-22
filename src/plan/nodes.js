// --------------------------------------------------
// SMALL HELPERS OVER PLAN NODES
// --------------------------------------------------
// Three things the draft, the summariser and every lookup by declaration
// all need. They lived inside draft.js, which meant a second module could
// only have them by copying them - and a second copy of nodeIdentities in
// particular is how a merged node's other declarations start leaking.
// --------------------------------------------------


export function createId(
    prefix,
    number
) {
    return (
        `${prefix}_${String(
            number
        ).padStart(
            4,
            "0"
        )}`
    );
}


export function getNextNodeNumber(
    plan
) {
    let maximum =
        0;

    for (
        const node of plan?.nodes || []
    ) {
        const match =
            /^plan_(\d+)$/.exec(
                node?.id || ""
            );

        if (
            match
        ) {
            maximum =
                Math.max(
                    maximum,
                    Number(
                        match[1]
                    )
                );
        }
    }

    return maximum + 1;
}


// Every declaration a node stands for. One for an ordinary node, several
// for a merged one - whether it was merged as a family (one behaviour
// written once per thing it applies to) or as a summary (several behaviours
// folded together to keep a feature readable).
//
// EVERY LOOKUP BY DECLARATION GOES THROUGH THIS. A lookup that reads
// node.identity alone sees the first declaration and silently ignores the
// rest: the draft re-drafts them into duplicate nodes, approve refuses to
// find them, and verify measures a claim it never checked.
export function nodeIdentities(
    node
) {
    if (
        Array.isArray(node?.identities) &&
        node.identities.length > 0
    ) {
        return node.identities;
    }

    return typeof node?.identity === "string" &&
        node.identity.length > 0
        ? [node.identity]
        : [];
}

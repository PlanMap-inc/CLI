import {
    readPlan,
    writePlan
} from "./storage.js";

import {
    validatePlan
} from "./model.js";


// --------------------------------------------------
// AUTHORING THE PLAN BY HAND
// --------------------------------------------------
// The canvas can add a step, rename one, move one, and change the order they
// happen in. Every one of those is a change to plan.json, and the extension
// never writes that file - so each is a command here, run the same way from
// the canvas and from a terminal, producing byte-identical results.
//
// What is authored by hand is marked origin "human", and a redraft leaves it
// alone: the model may not overwrite a decision a person made.
// --------------------------------------------------

// The plan model already names this origin; authoring must use it, not
// invent a second word for the same thing.
const HUMAN = "human_authored";


function loadPlan(
    projectRoot
) {
    const plan =
        readPlan(
            projectRoot
        );

    if (
        !Array.isArray(plan?.nodes)
    ) {
        throw new Error(
            "No plan to edit. Run 'planmap plan draft <project>' first."
        );
    }

    return plan;
}


function save(
    projectRoot,
    plan
) {
    const errors =
        validatePlan(
            plan
        );

    if (
        errors.length > 0
    ) {
        throw new Error(
            `That edit would leave plan.json invalid:\n${errors
                .map(error => `- ${error}`)
                .join("\n")}`
        );
    }

    writePlan(
        projectRoot,
        plan
    );

    return plan;
}


// A node by its id, or by the identity it checks. Both are what the canvas
// and a terminal have to hand.
function findNode(
    plan,
    reference
) {
    const node =
        plan.nodes.find(
            candidate =>
                candidate.id === reference ||
                candidate.identity === reference
        );

    if (!node) {
        throw new Error(
            `No plan node matches "${reference}".`
        );
    }

    return node;
}


function findFeature(
    plan,
    reference
) {
    const feature =
        (plan.features || []).find(
            candidate =>
                candidate.id === reference ||
                candidate.name === reference
        );

    if (!feature) {
        throw new Error(
            `No feature matches "${reference}". Features: ${(plan.features || [])
                .map(entry => entry.name)
                .join(", ") || "none"}`
        );
    }

    return feature;
}


function nextNodeId(
    plan
) {
    let highest = 0;

    for (
        const node of plan.nodes
    ) {
        const match =
            /^plan_(\d+)$/.exec(
                node?.id || ""
            );

        if (match) {
            highest =
                Math.max(
                    highest,
                    Number(match[1])
                );
        }
    }

    return `plan_${String(highest + 1).padStart(4, "0")}`;
}


// --------------------------------------------------
// ADD
// --------------------------------------------------
// A step a person wants in the plan before any code exists for it. It has no
// identity and no rules, so verify has nothing to check and leaves it alone
// until someone links it to a declaration.
// --------------------------------------------------

export function addPlanNode(
    projectRoot,
    featureReference,
    title,
    { intent = "", after = null } = {}
) {
    const clean =
        String(title || "").trim();

    if (!clean) {
        throw new Error(
            "A new step needs a title."
        );
    }

    const plan =
        loadPlan(projectRoot);

    const feature =
        findFeature(plan, featureReference);

    const node = {
        id: nextNodeId(plan),
        feature: feature.id,
        title: clean,
        intent:
            String(intent || "").trim() ||
            `${clean}.`,
        lensTags: [],
        edgesOut: [],
        rules: [],
        status: "intended",
        origin: HUMAN
    };

    plan.nodes.push(node);

    // Placed after a named step, or at the end of its feature.
    const order =
        featureOrder(plan, feature.id);

    const at =
        after
            ? order.findIndex(entry => entry.id === after || entry.identity === after) + 1
            : order.length - 1;

    relink(
        plan,
        feature.id,
        moved(order.filter(entry => entry.id !== node.id), node, at)
    );

    save(projectRoot, plan);

    return node;
}


// --------------------------------------------------
// RENAME
// --------------------------------------------------

export function renamePlanNode(
    projectRoot,
    reference,
    title
) {
    const clean =
        String(title || "").trim();

    if (!clean) {
        throw new Error(
            "A step needs a title."
        );
    }

    const plan =
        loadPlan(projectRoot);

    const node =
        findNode(plan, reference);

    node.title = clean;

    // A renamed step is that person's wording now, in every perspective: a
    // stale reading would go on showing the name they just replaced.
    delete node.readings;

    save(projectRoot, plan);

    return node;
}


// --------------------------------------------------
// MOVE
// --------------------------------------------------
// Where a person dragged the step to. The graph lays itself out, so a stored
// position is an override: it is honoured exactly, and clearing it hands the
// step back to the layout.
// --------------------------------------------------

export function movePlanNode(
    projectRoot,
    reference,
    x,
    y
) {
    const plan =
        loadPlan(projectRoot);

    const node =
        findNode(plan, reference);

    if (
        x === null ||
        y === null
    ) {
        delete node.x;
        delete node.y;
    }
    else {
        const atX = Number(x);
        const atY = Number(y);

        if (
            !Number.isFinite(atX) ||
            !Number.isFinite(atY)
        ) {
            throw new Error(
                "A position needs two numbers: --x and --y."
            );
        }

        node.x = Math.round(atX);
        node.y = Math.round(atY);
    }

    save(projectRoot, plan);

    return node;
}


// --------------------------------------------------
// ORDER
// --------------------------------------------------
// The order the steps happen in, which is what edgesOut records. Reordering
// rewrites the chain inside one feature and leaves every other feature alone.
// --------------------------------------------------

function featureOrder(
    plan,
    featureId
) {
    const members =
        plan.nodes.filter(
            node => node.feature === featureId
        );

    const byId =
        new Map(
            members.map(node => [node.id, node])
        );

    // Start at the step nothing leads to, then follow the chain. A feature
    // whose links are broken falls back to the order the plan lists it in.
    const targets =
        new Set(
            members.flatMap(node => node.edgesOut || [])
        );

    const ordered = [];
    const seen = new Set();

    let cursor =
        members.find(node => !targets.has(node.id)) || members[0];

    while (
        cursor &&
        !seen.has(cursor.id)
    ) {
        seen.add(cursor.id);
        ordered.push(cursor);
        cursor = byId.get((cursor.edgesOut || [])[0]);
    }

    for (
        const node of members
    ) {
        if (!seen.has(node.id)) {
            ordered.push(node);
        }
    }

    return ordered;
}


function moved(
    order,
    node,
    to
) {
    const at =
        Math.max(
            0,
            Math.min(
                Number.isFinite(to) ? to : order.length,
                order.length
            )
        );

    const next = [...order];
    next.splice(at, 0, node);

    return next;
}


// Rewrites one feature's chain, keeping every edge that leaves the feature -
// the Constellation's own links between stages run along those.
function relink(
    plan,
    featureId,
    order
) {
    const inside =
        new Set(
            plan.nodes
                .filter(node => node.feature === featureId)
                .map(node => node.id)
        );

    order.forEach(
        (node, index) => {
            const outward =
                (node.edgesOut || []).filter(
                    target => !inside.has(target)
                );

            const next = order[index + 1];

            node.edgesOut =
                next
                    ? [next.id, ...outward]
                    : outward;
        }
    );
}


export function reorderPlanNode(
    projectRoot,
    reference,
    { after = null, toStart = false } = {}
) {
    const plan =
        loadPlan(projectRoot);

    const node =
        findNode(plan, reference);

    const order =
        featureOrder(plan, node.feature);

    const without =
        order.filter(entry => entry.id !== node.id);

    let at;

    if (toStart) {
        at = 0;
    }
    else if (after) {
        const target =
            without.findIndex(
                entry =>
                    entry.id === after ||
                    entry.identity === after
            );

        if (target === -1) {
            throw new Error(
                `No step in ${node.feature} matches "${after}".`
            );
        }

        at = target + 1;
    }
    else {
        at = without.length;
    }

    relink(
        plan,
        node.feature,
        moved(without, node, at)
    );

    save(projectRoot, plan);

    return node;
}

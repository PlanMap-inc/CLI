// --------------------------------------------------
// PLAN GRAPH MODEL
// --------------------------------------------------
// Pure functions: no DOM, no filesystem. main.js renders what these
// return; the tests in extension/test/ import this file directly.
// Nothing here writes or invents data - it selects, orders and positions
// what plan.json and the verify-sourced statuses already contain.
// --------------------------------------------------

export const GRID = 24;
export const NODE_W = 172;
// Every node is this tall - styles.css pins a min-height so the rows sit
// on an even pitch. fitView and the edge anchors both measure from it.
export const NODE_H_EST = 104;

// The demo's feature colours, in the demo's order. Assigned by index.
export const FEATURE_PALETTE = [
    "#6fa8ff", "#ff9f6f", "#7fe0b0", "#ffd873", "#c89bff", "#6fe0e0", "#ff7fb0"
];

// The reference design's own dot colours, in the order LENS_IDS lists the
// lenses, so each perspective keeps the hue that design gave that concept:
// frontend purple, backend blue, database teal, security orange. The order
// here and in LENS_IDS must move together - they came apart once and
// database showed security's orange. The rest are spare, for a lens a
// project adds itself.
export const LENS_PALETTE = [
    "#c89bff", "#6fa8ff", "#5ec9c9", "#ff9f6f", "#ff7fb0", "#ffd873", "#7fe0b0"
];

// The lens vocabulary, in the order src/llm/lenses.js defines it. The Plan
// Graph reads it from plan.json and Project Evolution from each node's tags,
// so both views must agree on the order to agree on the colours.
export const LENS_IDS = [
    "frontend", "backend", "database", "security"
];

// What each perspective asks of a step, from src/llm/lenses.js. A lens is a
// question you put to the whole journey, so the interface can say what the
// question was rather than showing a coloured word and leaving the reader
// to guess. A lens a project adds itself has no question, and shows none.
export const LENS_QUESTIONS = {
    frontend: "What does the person see and do?",
    backend: "What does the server do when the request arrives?",
    database: "What is read or written, and where?",
    security: "What decides whether this is allowed?"
};

// --------------------------------------------------
// WHEEL ZOOM
// --------------------------------------------------
// A wheel event says how far the wheel turned; the old code only read which
// way. Every event applied a flat 10%, and a trackpad fires one every few
// milliseconds, so a single two-finger flick compounded 1.1^30 - about 17x -
// and the canvas shot to a corner.
//
// The factor now follows the distance actually travelled, and no single
// event may change the scale by more than MAX_WHEEL_STEP, so a chunky mouse
// notch and a flung trackpad both stay controllable.
// --------------------------------------------------

// deltaMode: 0 pixels, 1 lines, 2 pages. A mouse often reports lines.
const DELTA_UNIT = { 0: 1, 1: 16, 2: 400 };

const WHEEL_SENSITIVITY = 0.0015;
const MAX_WHEEL_STEP = 1.08;

export function zoomFactorFor({ deltaY = 0, deltaMode = 0, ctrlKey = false, metaKey = false } = {}) {
    const travelled = deltaY * (DELTA_UNIT[deltaMode] ?? 1);

    // Pinching a trackpad arrives as ctrl+wheel. That is a deliberate zoom,
    // so it earns more scale per unit than an incidental scroll.
    const gain = ctrlKey || metaKey ? 3 : 1;

    const factor = Math.exp(-travelled * WHEEL_SENSITIVITY * gain);

    return Math.min(MAX_WHEEL_STEP, Math.max(1 / MAX_WHEEL_STEP, factor));
}


export const STATUSES = [
    "intended", "approved", "implemented", "drifted", "error", "superseded"
];

// Worst first. A problem must never be hidden by aggregation.
const SEVERITY = ["drifted", "error", "intended", "approved", "implemented"];


export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function snap(value) {
    return Math.round(value / GRID) * GRID;
}

export function colorAt(palette, index) {
    return palette[((index % palette.length) + palette.length) % palette.length];
}


// --------------------------------------------------
// STATUS
// --------------------------------------------------

export function effectiveStatus(node, verifiedStatus) {
    const own = STATUSES.includes(node?.status) ? node.status : "intended";

    const verified = node?.identity ? verifiedStatus?.[node.identity] : null;

    // A verify result only speaks for the exact plan node version it checked.
    // After a revise the node has a new id, so an old drift no longer applies.
    if (
        verified &&
        STATUSES.includes(verified.status) &&
        verified.verifiedAgainst === `${node.id}@${node.version ?? 1}`
    ) {
        return verified.status;
    }

    return own;
}

export function featureStatus(nodes, verifiedStatus) {
    const statuses = nodes
        .map(node => effectiveStatus(node, verifiedStatus))
        .filter(status => status !== "superseded");

    if (statuses.length === 0) {
        return "intended";
    }

    return SEVERITY.find(status => statuses.includes(status)) ?? "intended";
}

export function statusClass(status) {
    const known = STATUSES.includes(status) ? status : "intended";
    return known === "drifted" ? "status-drifted pulse" : `status-${known}`;
}

export function statusDotStyle(status, color) {
    if (status === "intended") return "border:1.3px dashed var(--text-low)";
    if (status === "approved") return "border:1.3px solid var(--text-hi);background:transparent";
    if (status === "implemented") return `background:${color}`;
    if (status === "drifted") return "background:var(--danger);box-shadow:0 0 0 3px rgba(255,92,92,.18)";
    if (status === "error") return "background:var(--danger)";
    if (status === "superseded") return "border:1.3px solid var(--text-low);background:var(--text-low)";
    return "";
}


// --------------------------------------------------
// CONSTELLATION
// --------------------------------------------------

// Features stack bottom to top, in the order a person meets them, like the
// steps inside one: the first thing you do sits at the bottom and the
// journey climbs. The pitch is a multiple of the 24px grid and 40px taller
// than a node, which is what leaves a connector long enough to see: at 132
// the rows snapped unevenly and the line between them came out 16px long,
// so the lens colour on it was invisible.
const CX = 300;
const CTOP_Y = 60;
const CSTEP_Y = 144;

export function nodesInFeature(plan, featureId) {
    return (plan?.nodes ?? []).filter(node => node.feature === featureId);
}

export function buildConstellation(plan, verifiedStatus) {
    const features = plan?.features ?? [];
    const order = (plan?.lenses ?? []).map(lens => lens.id);

    return features.map((feature, index) => {
        const members = nodesInFeature(plan, feature.id);
        const count = members.length;

        // Which perspectives this capability is built from, in lens order.
        // Three dots say "this one is interface and server, no data" at a
        // glance, which "7 steps" alone never could.
        const present = new Set(members.flatMap(node => node.lensTags ?? []));

        const shape = buildAreas(plan, feature.id, verifiedStatus);
        const areaCount = shape.mode === "areas" ? shape.areas.length : 0;

        return {
            id: feature.id,
            step: index + 1,
            title: feature.name,
            // Where a feature has a level inside it, the Constellation says
            // so. It is the reader's first signal that this capability is
            // something to explore rather than read straight through.
            count,
            sub: areaCount > 0
                ? `${areaCount} ${areaCount === 1 ? "part" : "parts"} · ${count} steps`
                : `${count} ${count === 1 ? "step" : "steps"}`,
            lenses: order.filter(id => present.has(id)),
            status: featureStatus(members, verifiedStatus),
            // How many, not just that there is one: "2 of 83 drifted" and
            // "40 of 83 drifted" are different situations and the first must
            // not look like the second.
            failing: members
                .map(node => effectiveStatus(node, verifiedStatus))
                .filter(status => status === "drifted" || status === "error").length,
            color: colorAt(FEATURE_PALETTE, index),
            x: snap(CX),
            y: snap(CTOP_Y + (features.length - 1 - index) * CSTEP_Y)
        };
    });
}

// What connects two features: a node in one with an edgesOut into another.
// A plan with no links across features falls back to the order it lists them in.
export function constellationEdges(plan) {
    const featureOf = new Map(
        (plan?.nodes ?? []).map(node => [node.id, node.feature])
    );

    const seen = new Set();
    const edges = [];

    for (const node of plan?.nodes ?? []) {
        for (const target of node.edgesOut ?? []) {
            const to = featureOf.get(target);
            const key = `${node.feature}->${to}`;

            if (!to || !node.feature || to === node.feature || seen.has(key)) continue;

            seen.add(key);
            edges.push({ from: node.feature, to, source: "nodes" });
        }
    }

    if (edges.length > 0) return edges;

    const ids = (plan?.features ?? []).map(feature => feature.id);

    return ids.slice(0, -1).map((id, index) => ({ from: id, to: ids[index + 1], source: "order" }));
}


// --------------------------------------------------
// FEATURE SPACE
// --------------------------------------------------
// Plan nodes carry no positions, so they are ordered by longest path over
// edgesOut and stacked one per row, bottom-to-top: step 1 at the bottom, and
// the feature climbs. A lens shows only the nodes tagged with it.
// --------------------------------------------------

const TOP_Y = 60;
const STEP_Y = 144;
const CENTER_X = 300;

// The grounding line under a title: the code the title is a claim about.
// The title explains the behaviour and has to stand on its own; this says
// where to go and check it, so it names the symbol AND the file it lives in.
// "submitSurvey:function" made the reader carry the kind and guess the file;
// "submitSurvey() · survey.controller.js" answers both.
//
// Identity is "path/to/file.js::name:kind". Only the file's basename is
// shown - the full path is in the detail panel, and a graph node has no room
// for "Backend/src/database/survey.controller.js".
export function nodeSub(node) {
    const identity = node?.identity;
    if (!identity) return "greenfield";

    const [file, symbol] = identity.split("::");
    if (!symbol) return identity;

    const parts = symbol.split(":");
    const kind = parts.length > 1 ? parts[parts.length - 1] : "";
    const name = parts.slice(0, -1).join(":") || symbol;

    // A function reads as a call; anything else keeps its kind as the label,
    // because "sections()" would claim a list is something you can invoke.
    const called = kind === "function" || kind === "method"
        ? `${name}()`
        : `${name}${kind ? ` · ${kind}` : ""}`;

    const where = (file || "").split("/").pop();
    return where ? `${called} · ${where}` : called;
}

// A lens is a way of reading the journey, not a filter over it. Every step
// stays, in the same place, whichever lens is on: the feature keeps one
// shape, and switching perspective shows which parts of that one shape the
// perspective speaks to. Removing the others would leave a different
// journey each time, and a reader could not tell what was being left out.
// The order a set of steps happen in: longest path over their own links,
// falling back to plan order. Shared, so the preview on a Level 2 card runs
// the same way as the workflow that card opens - a preview in a different
// order would be a different story about the same process.
export function orderSteps(members) {
    const ids = new Set(members.map(node => node.id));

    const edges = [];
    for (const node of members) {
        for (const target of node.edgesOut ?? []) {
            if (ids.has(target) && target !== node.id) edges.push({ from: node.id, to: target });
        }
    }

    const layer = layerByLongestPath(members, edges);
    return [...members].sort((a, b) => layer.get(a.id) - layer.get(b.id));
}

// How many steps a Level 2 card shows of the process it stands for. Enough to
// tell the story, never enough to become the workflow: the whole point of the
// level is that the detail is one deliberate click away.
export const PREVIEW_STEPS = 4;

// The story of a process, in four lines. Taken by walking its order from the
// first step to the last and sampling evenly along the way, so the preview
// always opens where the process opens and ends where it ends, with the
// middle sampled rather than truncated. Nothing is invented and nothing is
// merged - these are real steps, and every one of them is still in the
// workflow behind the card.
export function previewOf(members, limit = PREVIEW_STEPS) {
    const ordered = orderSteps(members);
    if (ordered.length === 0) return [];

    // The step's OWN title, never the active lens's retelling of it. A lens
    // tells the whole journey from one perspective, and most of what it says
    // about a process it does not own is a relationship - "the browser waits
    // for valid dates". True, and useless as the story of what Process does.
    // The lens is a dimension here, carried by the dots and the counts; the
    // preview is the process explaining itself.
    const reading = node => node.title;

    if (ordered.length <= limit) {
        return ordered.map(node => ({ id: node.id, title: reading(node) }));
    }

    // First, last, and evenly spaced between: a beginning, a shape, an end.
    const picks = [0];
    for (let i = 1; i < limit - 1; i += 1) {
        picks.push(Math.round((i * (ordered.length - 1)) / (limit - 1)));
    }
    picks.push(ordered.length - 1);

    return [...new Set(picks)].map(index => ({
        id: ordered[index].id,
        title: reading(ordered[index])
    }));
}


// Laying the areas out as a SET. A vertical chain would assert an order the
// data does not have - Risk Detection does not happen "before" Analytics -
// and would make Level 2 look like Level 1 and Level 3 with a different node
// count, which is the thing this redesign most needs to avoid. A reader
// surveys here; they follow above and below.
export const AREA_W = 268;
export const AREA_H = 214;
const AREA_GAP_X = 34;
const AREA_GAP_Y = 30;

export function layoutAreas(areas, canvasWidth = 900) {
    const perRow = Math.max(1, Math.min(3, Math.floor(canvasWidth / (AREA_W + AREA_GAP_X)) || 1));

    return areas.map((area, index) => {
        const row = Math.floor(index / perRow);
        const column = index % perRow;
        const inRow = Math.min(perRow, areas.length - row * perRow);

        // Each row is centred on itself, so a last row holding one card sits
        // under the middle rather than hanging off to the left.
        const rowWidth = inRow * AREA_W + (inRow - 1) * AREA_GAP_X;

        return {
            ...area,
            x: snap(-rowWidth / 2 + column * (AREA_W + AREA_GAP_X) + AREA_W / 2 + 300),
            y: snap(60 + row * (AREA_H + AREA_GAP_Y))
        };
    });
}


// --------------------------------------------------
// LEVEL 2: BEHAVIOURAL AREAS
// --------------------------------------------------
// A feature with a hundred declarations does not become cluttered when it is
// drawn flat - at one node per row it becomes 15,552px tall, which fits the
// canvas at 6% zoom, and a node ten pixels high renders nothing a person can
// read. The middle level exists to make that feature openable.
//
// It invents nothing. Every node carries the headings the outline already
// worked out for it, under the same name Project Evolution uses, so both
// views read one hierarchy rather than two that drift apart. What happens
// here is presentation: which of those headings are worth drawing as a
// level, and when there is no level worth drawing at all.
// --------------------------------------------------

// A feature a reader can take in flat. At the row pitch the canvas uses, ten
// rows fit at 60% zoom and read comfortably; past a dozen the feature starts
// costing zoom, and past that it costs legibility. The same number bounds an
// area, because an area you cannot read when you open it has moved the
// problem rather than solved it.
export const FLAT_LIMIT = 12;

// The area a step belongs to: the first heading between its feature and
// itself. Deeper headings are not a second level here - in the measured data
// they almost always hold exactly one declaration, so drawing them would
// spend a level of navigation to reach a single node. They stay as ordering
// inside the area.
export function areaOf(node) {
    const head = (node?.path ?? []).find(step => typeof step === "string" && step.trim());
    return head ? head.trim() : null;
}

// How a feature should open, and what its parts are.
//
// Returns mode "flat" when the feature is small enough to read whole, or
// when its grouping is not good enough to help - a single heading holding
// everything is not a level, it is a click. The reason is carried so the
// interface can say which it was rather than silently flattening.
export function buildAreas(plan, featureId, verifiedStatus) {
    const members = nodesInFeature(plan, featureId);
    const lensOrder = (plan?.lenses ?? []).map(lens => lens.id);

    const byName = new Map();
    const loose = [];

    for (const node of members) {
        const name = areaOf(node);
        if (!name) { loose.push(node); continue; }
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(node);
    }

    // An area holding one declaration restates that declaration and costs a
    // level to reach it, so it stops being a card of its own and joins the
    // steps the outline never placed.
    for (const [name, nodes] of [...byName]) {
        if (nodes.length === 1) {
            loose.push(nodes[0]);
            byName.delete(name);
        }
    }

    const areas = [...byName].map(([name, nodes], index) => {
        const statuses = nodes.map(node => effectiveStatus(node, verifiedStatus));
        const present = new Set(nodes.flatMap(node => node.lensTags ?? []));

        return {
            id: `area:${name}`,
            name,
            count: nodes.length,
            // Worst-wins, as the Constellation already does for a feature: a
            // problem must never be hidden by aggregation. The count comes
            // with it, because one drifted step of twenty-one and fourteen of
            // twenty-one are different situations.
            status: featureStatus(nodes, verifiedStatus),
            failing: statuses.filter(status => status === "drifted" || status === "error").length,
            lenses: lensOrder.filter(id => present.has(id)),
            // How much of each perspective's own work lands here. Counts, not
            // a filter: a lens must never remove an area, or a reader
            // concludes that part of the feature does not exist from that
            // perspective.
            lensCounts: Object.fromEntries(
                lensOrder.map(id => [id, nodes.filter(node => (node.lensTags ?? []).includes(id)).length])
            ),
            // An area past the limit reproduces the problem the level exists
            // to solve. It is shown at its real size and said to be large,
            // never split on something arbitrary.
            oversized: nodes.length > FLAT_LIMIT,
            // What this process actually does, in four steps. A card that
            // says only "28 steps" tells a reader the process is large and
            // nothing about what it is for.
            preview: previewOf(nodes),
            index,
            nodes
        };
    });

    // A feature too big to read whole is never opened as a chain, whatever
    // its grouping looks like. One named part is a thin structure and it
    // still beats dropping eighty steps on the reader: they descend by
    // choosing rather than by scrolling.
    //
    // The exception is a feature the outline placed nothing in. A single card
    // holding every step is a click that reveals nothing, so there the
    // feature opens flat - inventing parts would be worse than a long chain.
    const large = members.length > FLAT_LIMIT;
    const mode = large && areas.length > 0 ? "areas" : "flat";

    const reason = mode === "areas"
        ? null
        : !large
            ? "small"
            : "ungrouped";

    // Steps the outline never placed are a navigation point like any other,
    // NOT a scattering of declarations beside the cards. Drawing them
    // individually would answer "how is this feature organised?" and "what
    // exactly happens here?" on one screen, which is the crowding this level
    // exists to remove. The card says what it is rather than borrowing a
    // behavioural name it has not earned.
    if (mode === "areas" && loose.length > 0) {
        areas.push({
            id: "area:",
            name: "Not yet grouped",
            ungrouped: true,
            count: loose.length,
            status: featureStatus(loose, verifiedStatus),
            failing: loose
                .map(node => effectiveStatus(node, verifiedStatus))
                .filter(status => status === "drifted" || status === "error").length,
            lenses: lensOrder.filter(id => loose.some(node => (node.lensTags ?? []).includes(id))),
            lensCounts: Object.fromEntries(
                lensOrder.map(id => [id, loose.filter(node => (node.lensTags ?? []).includes(id)).length])
            ),
            oversized: loose.length > FLAT_LIMIT,
            preview: previewOf(loose),
            index: areas.length,
            nodes: loose
        });
    }

    return {
        mode,
        reason,
        total: members.length,
        areas: areas.sort((a, b) => (a.ungrouped ? 1 : b.ungrouped ? -1 : b.count - a.count)),
        loose,
        // Which areas feed which, from the steps' own links. The reader
        // learns the parts of a feature and how they connect, rather than
        // getting a menu.
        edges: areaEdges(members)
    };
}

// Links between areas, derived from the steps' own edgesOut - the rule the
// Constellation already applies between features, one level down. A step
// whose next step lives in another area is what joins them.
function areaEdges(members) {
    const areaById = new Map(members.map(node => [node.id, areaOf(node)]));

    const seen = new Set();
    const edges = [];

    for (const node of members) {
        const from = areaOf(node);
        if (!from) continue;

        for (const target of node.edgesOut ?? []) {
            const to = areaById.get(target);
            const key = `${from}->${to}`;

            if (!to || to === from || seen.has(key)) continue;

            seen.add(key);
            edges.push({ from: `area:${from}`, to: `area:${to}` });
        }
    }

    return edges;
}

// Which card each step of a feature ended up on, by step id. One lookup, so
// every part of the view agrees about where a step lives.
export function cardOf(plan, featureId, verifiedStatus) {
    const byId = new Map();

    for (const area of buildAreas(plan, featureId, verifiedStatus).areas) {
        for (const node of area.nodes) byId.set(node.id, area.name);
    }

    return byId;
}

// Where a step's journey continues when the next step is on another card.
// Hiding this would be the worst thing the hierarchy could do: following one
// request the whole way through is what the Plan Graph is for, so a step
// that leads out of the part says where it leads.
export function exitsFrom(all, insideIds, cards) {
    const titleById = new Map(all.map(node => [node.id, node.title]));

    const exits = new Map();

    for (const node of all) {
        if (!insideIds.has(node.id)) continue;

        for (const target of node.edgesOut ?? []) {
            if (insideIds.has(target)) continue;

            const to = cards.get(target);
            if (!to) continue;

            exits.set(node.id, { area: to, nodeId: target, title: titleById.get(target) });
        }
    }

    return exits;
}


export function buildFeatureGraph(plan, featureId, verifiedStatus, lensId = null, areaName = null) {
    const all = nodesInFeature(plan, featureId);

    // Level 3 is the same view over one area's steps. Nothing about how a
    // step is drawn changes - it is reached one step later, holding ten
    // steps instead of a hundred.
    // Scoped to one card, and to the very steps that card counted. "" is the
    // holding place; anything else is a named part. Membership comes from
    // buildAreas rather than being worked out a second time here, because a
    // heading that held one declaration is folded into the holding place and
    // asking areaOf() again would disagree with the card the reader clicked.
    const members = areaName === null
        ? all
        : (buildAreas(plan, featureId, verifiedStatus).areas
            .find(area => (area.ungrouped ? "" : area.name) === areaName)?.nodes ?? []);

    // Where a step's journey leaves this area, worked out from the whole
    // feature so the link is not lost by scoping the view to part of it.
    const exits = areaName === null
        ? new Map()
        : exitsFrom(all, new Set(members.map(node => node.id)), cardOf(plan, featureId, verifiedStatus));

    const ids = new Set(members.map(node => node.id));

    const edges = [];

    for (const node of members) {
        for (const target of node.edgesOut ?? []) {
            if (ids.has(target) && target !== node.id) {
                edges.push({ from: node.id, to: target });
            }
        }
    }

    // ponytail: one column, so an edge that skips a row is drawn behind the
    // node between; route around it if plans with branches make that confusing.
    const ordered = orderSteps(members);

    // A perspective renames the step in its own words. Same step, same
    // place, same rules - only the wording changes, which is the whole
    // point: a reader who thinks in one of these terms reads the journey in
    // that language. A step the lens has no reading for keeps its own title.
    const reading = node => (lensId && node.readings?.[lensId]) || node.title;

    // A step a person dragged keeps exactly where they put it; the rest are
    // laid out. Mixing the two is the point: you move the one that matters
    // and the others stay tidy.
    const placed = node => Number.isFinite(node.x) && Number.isFinite(node.y);

    const nodes = ordered.map((node, row) => ({
        id: node.id,
        step: row + 1,
        title: reading(node),
        // What it is called when no lens is on, so the panel can show both.
        plainTitle: node.title,
        sub: nodeSub(node),
        status: effectiveStatus(node, verifiedStatus),
        lensTags: node.lensTags ?? [],
        // Whether this perspective had its own words for the step. Not a
        // reason to hide it: every step stands in every lens, and one
        // without a reading simply keeps the name it already had.
        renamed: Boolean(lensId && node.readings?.[lensId]),
        // Whether this perspective does the work here, rather than depending
        // on the step or passing through it. Every step is still told.
        owns: Boolean(lensId && (node.lensTags ?? []).includes(lensId)),
        x: placed(node) ? node.x : snap(CENTER_X),
        y: placed(node) ? node.y : snap(TOP_Y + (ordered.length - 1 - row) * STEP_Y),
        // Where the layout would have put it, so "reset position" can.
        moved: placed(node),
        // Set when this step's next step lives in another area, so the edge
        // that leaves the view is still shown and can still be followed.
        exit: exits.get(node.id) ?? null,
        source: node
    }));

    // A feature whose nodes carry no links of their own is connected in plan
    // order: the order they are drawn in, bottom to top.
    const shown = edges.length > 0
        ? edges
        : ordered.slice(0, -1).map((node, row) => ({ from: node.id, to: ordered[row + 1].id, source: "order" }));

    return { nodes, edges: shown };
}

function layerByLongestPath(members, edges) {
    const outgoing = new Map(members.map(node => [node.id, []]));
    for (const edge of edges) outgoing.get(edge.from).push(edge.to);

    // Depth-first order, skipping back edges, gives a topological order of
    // the graph with cycles broken - each node is visited exactly once.
    const state = new Map();
    const order = [];
    const backEdges = new Set();

    const visit = id => {
        state.set(id, "open");
        for (const next of outgoing.get(id)) {
            if (state.get(next) === "open") {
                backEdges.add(`${id}->${next}`);
            } else if (!state.has(next)) {
                visit(next);
            }
        }
        state.set(id, "done");
        order.push(id);
    };

    for (const node of members) {
        if (!state.has(node.id)) visit(node.id);
    }

    order.reverse();

    const layer = new Map(members.map(node => [node.id, 0]));

    for (const id of order) {
        for (const next of outgoing.get(id)) {
            if (backEdges.has(`${id}->${next}`)) continue;
            layer.set(next, Math.max(layer.get(next), layer.get(id) + 1));
        }
    }

    return layer;
}


// --------------------------------------------------
// LENSES
// --------------------------------------------------

// A lens keeps its colour from its position in the vocabulary, so the same
// perspective is the same colour here and in Project Evolution. A lens a
// project defined for itself takes a colour after the vocabulary's.
export function lensColors(plan) {
    const lenses = plan?.lenses ?? [];
    const colors = {};

    lenses.forEach((lens, position) => {
        const index = LENS_IDS.indexOf(lens.id);
        colors[lens.id] = colorAt(LENS_PALETTE, index === -1 ? position : index);
    });

    return colors;
}

// How much each perspective has to say about this feature: the number of
// steps it has its own words for. Every step is shown under every lens, so
// this is not how many you will see - it is how much of the feature this
// perspective re-describes, and a zero says the feature has nothing to tell
// you from there.
export function lensCoverage(plan, featureId) {
    const members = nodesInFeature(plan, featureId);

    // Every step now carries a reading in every lens, so counting readings
    // would print the step count four times over. The useful number is how
    // many steps this perspective DOES THE WORK for; the rest it depends on
    // or passes through, and still describes in its own words.
    return (plan?.lenses ?? []).map(lens => {
        const count = members.filter(node =>
            (node.lensTags ?? []).includes(lens.id)
        ).length;

        return {
            id: lens.id,
            label: lens.label ?? lens.id,
            count,
            empty: count === 0
        };
    });
}


// --------------------------------------------------
// NODE DETAIL
// --------------------------------------------------

export function describeClause(field, clause) {
    if (!clause || typeof clause !== "object") return `${field}`;
    const value = clause.value === undefined ? "" : ` ${JSON.stringify(clause.value)}`;
    return `${field} ${clause.op}${value}`;
}

export function describeRules(rules) {
    return (rules ?? []).map(rule => ({
        kind: rule.kind,
        target: rule.target,
        clauses: Object.entries(rule.assert ?? {}).map(([field, clause]) =>
            rule.kind === "structure"
                ? `${field} ${Array.isArray(clause) ? clause.join(", ") : clause}`
                : describeClause(field, clause)
        )
    }));
}

export function describeHistory(history) {
    return (history ?? []).map(entry => ({
        version: `v${entry.version ?? 1}`,
        intent: entry.intent ?? "",
        status: entry.status ? `was ${entry.status}` : ""
    }));
}


// --------------------------------------------------
// DRIFT SYNC, NAV RAIL, ONBOARDING
// --------------------------------------------------
// One verify run writes its statuses into evolution.json. The Plan Graph
// (effectiveStatus), the Evolution view (node.status) and the rail badge all
// read those statuses, joined on the exact identity string.
// --------------------------------------------------

export function driftCount(verifiedStatus) {
    return Object.values(verifiedStatus ?? {}).filter(entry => entry?.status === "drifted").length;
}

export const VIEWS = [
    { id: "planmap", label: "Plan Graph" },
    { id: "evolution", label: "Project Evolution" }
];

export function railModel(activeView, verifiedStatus) {
    const active = VIEWS.some(view => view.id === activeView) ? activeView : "planmap";
    const count = driftCount(verifiedStatus);

    return {
        active,
        buttons: VIEWS.map(view => ({ ...view, active: view.id === active })),
        badge: count > 0 ? { count, label: `${count} drifted` } : null
    };
}

// A: no .planmap/.  B: scanned, no plan.json.  C: a plan nothing has verified yet.
export function onboardingState(state) {
    if (!state) return null;
    if (state.setup === "missing") return { kind: "scan" };
    if (state.setup === "no-plan") return { kind: "no-plan", declarations: state.declarationCount ?? null };
    if (state.setup === "invalid-plan") return { kind: "invalid-plan", problem: state.problem };
    if (Object.keys(state.verifiedStatus ?? {}).length === 0) return { kind: "verify" };
    return null;
}


// --------------------------------------------------
// PLAN DECISIONS AND VERIFY DETAIL
// --------------------------------------------------

// Mirrors src/plan/approval.js. Approve takes intended nodes. Reject removes an
// intended node, or an approved one with --force. Revise reopens an approved
// node as a new intended version, and "plan revise" matches on identity only.
export function nodeActions(node) {
    const status = node?.status;
    const target = typeof node?.id === "string" ? node.id : null;
    const identity = typeof node?.identity === "string" && node.identity ? node.identity : null;

    const reviseReason =
        status === "intended" ? "Already intended: edit it in plan.json, then approve it"
            : status !== "approved" ? "Only approved nodes can be revised"
                : "The CLI revises by identity, and this node has no code yet";

    return [
        {
            type: "approve",
            label: "Approve",
            enabled: status === "intended" && Boolean(target),
            hint: "Lock in this intent; Verify checks the code against it",
            reason: status === "approved" ? "Already approved" : "Only intended nodes can be approved",
            message: { type: "approve", target }
        },
        {
            type: "revise",
            label: "Revise",
            enabled: status === "approved" && Boolean(identity),
            hint: "Reopen as a new intended version; this version moves to history",
            reason: reviseReason,
            message: { type: "revise", identity }
        },
        {
            type: "reject",
            label: "Reject",
            tone: "danger",
            enabled: (status === "intended" || status === "approved") && Boolean(target),
            hint: "Remove this node from the plan",
            reason: "Only intended or approved nodes can be rejected",
            message: { type: "reject", target, force: status === "approved" }
        }
    ];
}

// The verify --json result for this exact plan node version, if the last run checked it.
export function verifyResultFor(verify, node) {
    const results = Array.isArray(verify?.results) ? verify.results : [];
    return results.find(result =>
        result?.planNodeId === node?.id &&
        (result.planVersion ?? 1) === (node?.version ?? 1)
    ) ?? null;
}

function showValue(value) {
    if (value === undefined) return "—";
    return typeof value === "string" ? value : JSON.stringify(value);
}

export function describeViolation(violation) {
    return {
        field: violation?.field ?? violation?.target ?? "rule",
        expected: showValue(violation?.expected),
        actual: showValue(violation?.actual),
        reason: violation?.reason ?? violation?.message ?? ""
    };
}

export function describeImpact(entry) {
    return {
        identity: entry?.identity ?? entry?.target ?? "unknown",
        meta: [
            entry?.kind ?? null,
            Number.isFinite(entry?.depth) ? `depth ${entry.depth}` : null,
            entry?.confidence != null ? `${entry.confidence} confidence` : null
        ].filter(Boolean).join(" · ")
    };
}


// --------------------------------------------------
// SCAN PROGRESS
// --------------------------------------------------
// Reads the CLI's own output as it runs. Nothing here invents a step: every
// number comes from a line the CLI printed.
// --------------------------------------------------

const DECLARATIONS = /^Found (\d+) declarations/;
const BATCH_TOTAL = /^Evolution classification: (\d+) events in (\d+) batch\(es\)/;
const BATCH_START = /^Classifying label batch (\d+)\/(\d+)/;
const BATCH_DONE = /^Label batch (\d+) persisted successfully/;
const BATCH_FAILED = /^Label batch (\d+) failed/;

export function parseScanProgress(lines) {
    let total = null;
    let done = 0;
    let failed = 0;
    let declarations = null;
    let finished = false;
    let label = "Starting…";
    let match;

    for (const raw of lines ?? []) {
        const line = String(raw).trim();

        if ((match = DECLARATIONS.exec(line))) {
            declarations = Number(match[1]);
            label = `${declarations} ${declarations === 1 ? "declaration" : "declarations"} found`;
        } else if (/^Baseline written/.test(line)) {
            label = "Reading what the code does now";
        } else if ((match = BATCH_TOTAL.exec(line))) {
            total = Number(match[2]);
            label = `${match[1]} to classify, in ${total} ${total === 1 ? "batch" : "batches"}`;
        } else if ((match = BATCH_START.exec(line))) {
            total = Number(match[2]);
            label = `Classifying batch ${match[1]} of ${match[2]}`;
        } else if ((match = BATCH_DONE.exec(line))) {
            done = Math.max(done, Number(match[1]));
            label = `Batch ${match[1]} classified`;
        } else if ((match = BATCH_FAILED.exec(line))) {
            failed += 1;
            done = Math.max(done, Number(match[1]));
            label = `Batch ${match[1]} kept path labels`;
        } else if (/^Evolution written/.test(line)) {
            finished = true;
            label = failed > 0 ? `Done, ${failed} ${failed === 1 ? "batch" : "batches"} without AI` : "Done";
        } else if (/^Plan drafted/.test(line)) {
            finished = true;
            label = "Plan drafted";
        } else if (/^OPENROUTER_API_KEY not configured/.test(line)) {
            label = "No API key: labelling from file paths";
        }
    }

    return {
        percent: finished ? 100 : total ? Math.round((done / total) * 100) : null,
        label,
        total,
        done,
        failed,
        declarations,
        finished
    };
}

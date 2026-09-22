// --------------------------------------------------
// PLAN GRAPH MODEL
// --------------------------------------------------
// Pure functions: no DOM, no filesystem. main.js renders what these
// return; the tests in extension/test/ import this file directly.
// Nothing here writes or invents data - it selects, orders and positions
// what plan.json and the verify-sourced statuses already contain.
// --------------------------------------------------

export const GRID = 24;

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
// --------------------------------------------------
// ROLES
// --------------------------------------------------
// What a node is FOR, which decides where in a feature it is drawn. The
// vocabulary is defined and explained in src/llm/roles.js; the webview
// cannot import across that boundary, so the four ids are repeated here and
// a test keeps the two lists identical.
//
// Only a behaviour is a step. The other three used to be steps too, which
// is why a feature read as four different kinds of sentence in one column.
// --------------------------------------------------

export const ROLE_IDS = [
    "behaviour",
    "vocabulary",
    "machinery",
    "tool"
];

// A plan drafted before roles existed has no role on any node, and every one
// of those nodes was drawn as a step. They still are.
export function roleOf(node) {
    return ROLE_IDS.includes(node?.role) ? node.role : "behaviour";
}

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


// --------------------------------------------------
// WALKING THE MAP WITH THE ARROW KEYS
// --------------------------------------------------
// A key press used to move the map a fixed distance at once, and holding the
// key handed the job to the operating system's key repeat - which waits,
// then fires at its own rate, so the map lurched, paused and stuttered.
//
// The keys set a direction instead, and speed eases toward it while a key is
// down and glides back to nothing when it is released. The two functions
// that decide how that feels live here, out of the DOM, so the motion can be
// checked without a browser.
// --------------------------------------------------

export const PAN_DIRECTIONS = {
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
    ArrowLeft: [1, 0],
    ArrowRight: [-1, 0]
};

// Pixels per second under a held key, and the multiplier shift adds.
export const PAN_SPEED = 950;
export const PAN_FAST = 2.6;

// The time constant of the approach: speed covers about two thirds of the
// gap to its target in one of these, so a small number starts sharply and a
// large one glides. 85ms is quick enough not to feel laggy and long enough
// that the start and the stop are visibly eased rather than instant.
export const PAN_TAU = 0.085;

// Where the held keys are pointing, as a unit vector. Two keys at once is a
// diagonal rather than a sprint: without normalising, up-and-left travels
// 1.41 times as fast as either key on its own.
export function panDirection(keys) {
    let x = 0;
    let y = 0;

    for (const key of keys ?? []) {
        const move = PAN_DIRECTIONS[key];
        if (!move) continue;
        x += move[0];
        y += move[1];
    }

    const length = Math.hypot(x, y);
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

// One frame of easing, framed in seconds rather than frames, so the motion
// is the same on a 60Hz display and a 120Hz one - and so that a frame the
// browser skipped does not become a jump.
export function panVelocity(current, target, dt, tau = PAN_TAU) {
    if (!(dt > 0)) return current;
    return current + (target - current) * (1 - Math.exp(-dt / tau));
}


// --------------------------------------------------
// HOW FAR THE MAP MAY BE MOVED
// --------------------------------------------------
// One axis of it. The journey runs bottom to top, so up and down is travel
// and sideways is not: an axis whose content fits is centred and held there,
// and one whose content does not fit may be moved, but only as far as its
// own edges.
//
// Panning used to be unbounded on both axes, so the map could be pushed off
// the screen entirely with nothing left to say where it had gone.
// --------------------------------------------------

// padStart is anything drawn BEFORE the content without being part of what
// gets centred - the lane labels down the left of a feature. It counts
// toward whether the picture fits, and toward how far the content may be
// pulled, but never toward the middle: centring a box whose left half is
// margin puts the content well right of the middle, which is exactly what
// it did.
export function panAxis({ from, to, pan, extent, scale = 1, edge = 0, padStart = 0 }) {
    const size = (to - from + padStart) * scale;

    // It fits: centre the content, whatever the caller was asking for.
    if (size <= extent - edge * 2) {
        return extent / 2 - (from + (to - from) / 2) * scale;
    }

    const lowest = extent - edge - to * scale;
    const highest = edge - (from - padStart) * scale;

    return Math.min(highest, Math.max(lowest, pan));
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

    const identities = Array.isArray(node?.identities) && node.identities.length > 0
        ? node.identities
        : node?.identity ? [node.identity] : [];

    // A verify result only speaks for the exact plan node version it checked.
    // After a revise the node has a new id, so an old drift no longer applies.
    const rows = identities
        .map(identity => verifiedStatus?.[identity])
        .filter(row => row
            && STATUSES.includes(row.status)
            && row.verifiedAgainst === `${node.id}@${node.version ?? 1}`);

    if (rows.length === 0) return own;

    // EVERY declaration, worst first. Each one now carries a status of its
    // own, so a summary step whose second covered step drifted would read
    // as implemented if only the first were looked at - green card, red
    // code, which is the one thing this view exists to prevent.
    const worst = ["error", "drifted"].find(status => rows.some(row => row.status === status));

    return worst ?? rows[0].status;
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

// --------------------------------------------------
// A CARD IS A FIXED GRID, AND NO ROW MAY SHRINK
// --------------------------------------------------
// Every card is the same height. That much was already true - but the
// rows inside it were a flex column that was allowed to shrink, so a card
// holding a two-line title, a code line, a detail line and a calls chip
// squeezed all of them and drew their text on top of each other. Measured
// in a browser inside one 118px card: the title box was 11px tall for two
// lines of 17.55px type, the code line 4px and the detail line 5px. The
// title was cut mid-letter and the two lines under it were shredded.
//
// So the rows are fixed here, in pixels, and nothing is left to the
// content. Every height below is also written into styles.css as a custom
// property - see CARD_METRICS - so the layout maths and the stylesheet
// read the same numbers and cannot drift apart.
//
// A card with no detail line and no chip is the same height as one with
// both: the row is empty, never collapsed. That is what keeps the pitch a
// pitch.
// --------------------------------------------------

// 172px could not hold a real title. Measured against the plans this runs
// on, 240 fits two lines of most of them without an ellipsis.
export const CARD_W = 240;

const CARD_PAD_TOP = 12;
const CARD_PAD_BOTTOM = 11;

// The colour bar and the gap under it.
const BAR_ROW_H = 11;

// Two lines of 13.5px type at line-height 1.3, rounded up.
const TITLE_H = 36;

// One line each, with an ellipsis. Never two: a second line would push the
// card past the pitch the whole column is measured on.
const SUB_H = 14;
const DETAIL_H = 15;

// The lens dots, the calls chip and the status pill, side by side.
const FOOT_H = 20;

const ROW_GAP = 4;
const FOOT_GAP = 8;

export const STEP_H =
    CARD_PAD_TOP +
    BAR_ROW_H +
    TITLE_H + ROW_GAP +
    SUB_H + ROW_GAP +
    DETAIL_H + FOOT_GAP +
    FOOT_H +
    CARD_PAD_BOTTOM;

// A part row and a fold row: one line of text, a count and a chevron.
export const ROW_H = 56;

// Between one item and the next. Big enough that the line between them is
// visibly a line rather than a seam.
export const CARD_GAP = 44;

// The Constellation's card, by the same rule: a title, the "N steps · P
// parts" line, three preview lines and a footer, none of which shrink.
const FEATURE_TITLE_H = 21;
const FEATURE_SUB_H = 14;
const PREVIEW_LINE_H = 15;
const PREVIEW_LINES = 3;
const PREVIEW_GAP = 3;

export const FEATURE_H =
    CARD_PAD_TOP +
    BAR_ROW_H +
    FEATURE_TITLE_H + ROW_GAP +
    FEATURE_SUB_H + FOOT_GAP +
    PREVIEW_LINES * PREVIEW_LINE_H + (PREVIEW_LINES - 1) * PREVIEW_GAP + FOOT_GAP +
    FOOT_H +
    CARD_PAD_BOTTOM;

// --------------------------------------------------
// ONE SET OF NUMBERS, TWO READERS
// --------------------------------------------------
// The layout maths above and the stylesheet both need these. Hard-coding
// them twice is how a row ends up 11px tall inside a 118px card, so the
// view writes them onto the document as custom properties and styles.css
// reads them from there. CSP governs markup, not the CSSOM, so setting
// them through style.setProperty is safe.
// --------------------------------------------------

export const CARD_METRICS = {
    "--card-w": CARD_W,
    "--card-pad-top": CARD_PAD_TOP,
    "--card-pad-bottom": CARD_PAD_BOTTOM,
    "--card-bar-h": BAR_ROW_H,
    "--card-title-h": TITLE_H,
    "--card-sub-h": SUB_H,
    "--card-detail-h": DETAIL_H,
    "--card-foot-h": FOOT_H,
    "--card-row-gap": ROW_GAP,
    "--card-foot-gap": FOOT_GAP,
    "--card-step-h": STEP_H,
    "--card-feature-h": FEATURE_H,
    "--card-feature-title-h": FEATURE_TITLE_H,
    "--card-feature-sub-h": FEATURE_SUB_H,
    "--card-preview-line-h": PREVIEW_LINE_H,
    "--card-preview-gap": PREVIEW_GAP,
    "--card-row-h": ROW_H
};

// What a step card is made of, top to bottom. Exported so a test can add
// it up rather than trusting that STEP_H was recomputed by hand.
export const STEP_CARD_ROWS = [
    CARD_PAD_TOP,
    BAR_ROW_H,
    TITLE_H, ROW_GAP,
    SUB_H, ROW_GAP,
    DETAIL_H, FOOT_GAP,
    FOOT_H,
    CARD_PAD_BOTTOM
];

export const FEATURE_CARD_ROWS = [
    CARD_PAD_TOP,
    BAR_ROW_H,
    FEATURE_TITLE_H, ROW_GAP,
    FEATURE_SUB_H, FOOT_GAP,
    ...Array.from({ length: PREVIEW_LINES }, () => PREVIEW_LINE_H),
    ...Array.from({ length: PREVIEW_LINES - 1 }, () => PREVIEW_GAP),
    FOOT_GAP,
    FOOT_H,
    CARD_PAD_BOTTOM
];

export function cardHeight() {
    return STEP_H;
}

// The step toolbar - rename, detail, remove - belongs to a step and to
// nothing else. A part row, a fold row, a register row and the setup row
// only fold and unfold; offering to rename or delete one meant sending
// `reject` with a part id as its target.
export function hasToolbar(item) {
    return item?.kind === "step";
}

// What may be selected at all. A step, and a feature card on the
// Constellation - selecting one is how its cross-feature call arcs are
// drawn. A row is not a node: it only folds and unfolds.
export function isSelectable(item) {
    return item?.kind === "step" || item?.kind === "feature";
}

export function nodesInFeature(plan, featureId) {
    return (plan?.nodes ?? []).filter(node => node.feature === featureId);
}

// --------------------------------------------------
// THE CONSTELLATION READS DOWNWARDS
// --------------------------------------------------
// It used to be stacked from the bottom up, so the journey climbed while
// the feature you opened from it ran down the page. One map, two
// directions, and a reader re-orienting at every click.
//
// Both read top to bottom now: the first thing a person meets is at the
// top of the Constellation, and the first step of a feature is at the top
// of the feature.
// --------------------------------------------------

export function buildConstellation(plan, verifiedStatus) {
    const order = (plan?.lenses ?? []).map(lens => lens.id);

    const cards = [];

    // Everything that is not a step of a feature that has steps. A feature
    // with no behaviour at all is not a stage of the journey - drawing a
    // card for it puts an empty box on the map - so its terms and
    // preconditions go into one row at the bottom instead.
    const setup = [];

    (plan?.features ?? []).forEach((feature, index) => {
        const members = nodesInFeature(plan, feature.id);

        // The steps, which is the behaviours: the terms and preconditions
        // are part of the feature but they are not things it does, and a
        // count that includes them answers a question nobody asked.
        const spine = featureRegisters(plan, feature.id).spine;

        if (spine.length === 0) {
            setup.push(...members);
            return;
        }

        const count = spine.length;
        const parts = spine.length > FLAT_LIMIT ? partsOf(spine) : [];

        // Which perspectives this capability is built from, in lens order.
        // Three dots say "this one is interface and server, no data" at a
        // glance, which "7 steps" alone never could.
        const present = new Set(members.flatMap(node => node.lensTags ?? []));

        cards.push({
            id: feature.id,
            step: cards.length + 1,
            title: feature.name,
            count,
            sub: parts.length > 1
                ? `${count} steps · ${parts.length} parts`
                : `${count} ${count === 1 ? "step" : "steps"}`,
            // The first lines of what this feature opens onto. A card that
            // says only "27 steps" reports the size of a thing it is hiding;
            // these are three of the real steps, in order, so the view a
            // reader lands in starts with lines they have already read.
            preview: previewOf(spine, CONSTELLATION_PREVIEW),
            lenses: order.filter(id => present.has(id)),
            status: featureStatus(members, verifiedStatus),
            // How many, not just that there is one: "2 of 83 drifted" and
            // "40 of 83 drifted" are different situations and the first must
            // not look like the second.
            failing: members
                .map(node => effectiveStatus(node, verifiedStatus))
                .filter(status => status === "drifted" || status === "error").length,
            color: colorAt(FEATURE_PALETTE, index),
            x: snap(CX)
        });
    });

    // The top is snapped to the grid once, and the pitch is fixed. Snapping
    // every card in turn instead made the gaps uneven - 192px, then 216px -
    // which is exactly the ragged rhythm one card height was meant to end.
    const top = snap(CTOP_Y);
    const pitch = FEATURE_H + CARD_GAP;

    const placed = cards.map((card, index) => ({
        ...card,
        h: FEATURE_H,
        y: top + index * pitch
    }));

    return {
        cards: placed,
        // One folded row under the journey, never a card in it.
        setup: setup.length === 0 ? null : {
            id: "setup",
            title: "Project setup",
            count: setup.length,
            y: top + placed.length * pitch,
            h: ROW_H,
            x: snap(CX),
            chips: setup.map(node => ({
                id: node.id,
                title: node.title,
                role: roleOf(node),
                status: effectiveStatus(node, verifiedStatus)
            }))
        }
    };
}

// What connects two features: a node in one with an edgesOut into another.
// A pair of adjacent features with no real link between them falls back to the
// order the plan lists them in.
//
// The fallback is per pair, not per plan. It used to be all-or-nothing, which
// was safe only while every adjacent pair was guaranteed an edge; now that
// genuine partial links are possible, one real edge anywhere would have left
// every other feature a disconnected island. A mixed list is the normal shape.
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

    const ids = (plan?.features ?? []).map(feature => feature.id);

    for (let index = 0; index < ids.length - 1; index += 1) {
        const key = `${ids[index]}->${ids[index + 1]}`;

        if (!seen.has(key)) {
            edges.push({ from: ids[index], to: ids[index + 1], source: "order" });
        }
    }

    return edges;
}


// --------------------------------------------------
// FEATURE SPACE
// --------------------------------------------------
// One straight column, in `step` order, top to bottom. Nothing else moves
// a card: not the call graph, not a stored x/y, not the lens.
//
// It used to be laid out from edgesOut by longest path, which meant two
// steps that did not call each other were drawn side by side and a step
// with two callers fanned out. That drew the call graph and called it the
// plan - and since `plan order` wrote edgesOut as an order chain while the
// draft wrote it as calls, the same field decided the layout under two
// different meanings depending on what had last touched the file.
//
// The two are separated now. `step` is the order a person reads; edgesOut
// is what the code calls, shown as a chip on the card and as an arc when
// the card is selected.
// --------------------------------------------------

const TOP_Y = 60;
const CENTER_X = 300;

// Everything in the column sits at one x, so a card's position is its
// place in the order and nothing else.
export const COLUMN_X = CENTER_X;

// The floor on zoom. Below this the titles stop being readable, and a map
// you cannot read is not a smaller map - it is a picture of one.
export const MIN_SCALE = 0.6;

// The grounding line under a title: the code the title is a claim about.
// The title explains the behaviour and has to stand on its own; this says
// where to go and check it, so it names the symbol AND the file it lives in.
// "submitSurvey:function" made the reader carry the kind and guess the file;
// "submitSurvey() · survey.controller.js" answers both.
//
// Identity is "path/to/file.js::name:kind". Only the file's basename is
// shown - the full path is in the detail panel, and a graph node has no room
// for "Backend/src/database/survey.controller.js".
// Every declaration a node stands for, and what a summary step covers.
// One node can hold several of each: identities are the functions, and
// summaryOf is the steps those functions came from.
export function coveredSteps(node) {
    return Array.isArray(node?.summaryOf) ? node.summaryOf : [];
}

export function isSummary(node) {
    return node?.merge === "summary" && coveredSteps(node).length > 0;
}

// The function name inside a declaration: "api.js::getAgencies:function"
// reads as getAgencies.
export function declarationName(identity) {
    const symbol = String(identity ?? "").split("::")[1];
    if (!symbol) return String(identity ?? "");

    const parts = symbol.split(":");
    return parts.length > 1 ? parts.slice(0, -1).join(":") : symbol;
}

export function nodeSub(node) {
    const identity = node?.identity;
    if (!identity) return "greenfield";

    // A step standing for several declarations says how many rather than
    // naming the first and quietly holding the rest. The panel lists them.
    const backing = Array.isArray(node.identities) ? node.identities.length : 1;

    if (backing > 1) {
        const where = (identity.split("::")[0] || "").split("/").pop();
        return where ? `${backing} declarations · ${where}` : `${backing} declarations`;
    }

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
// --------------------------------------------------
// THE ONE DETAIL LINE A CARD CARRIES
// --------------------------------------------------
// A card used to stack a preview block, a backing line and two evidence
// lines under its title, which made it an inspector standing in a column
// of inspectors. It carries one line now, and the panel carries the rest.
//
// First match wins. A lens reading comes first because a reader who has
// turned a perspective on has asked to be told what it says here; a
// summary step comes next because how much is behind the card changes
// whether you open it; and a fact from the code is the floor.
// --------------------------------------------------

export function detailLine(node, { lensId = null, facts = {} } = {}) {
    const reading = lensId ? node?.readings?.[lensId] : null;

    if (reading) {
        return { kind: "reading", lens: lensId, text: reading };
    }

    if (isSummary(node)) {
        const covers = coveredSteps(node).length;
        return { kind: "covers", text: `covers ${covers} step${covers === 1 ? "" : "s"}` };
    }

    const dimensions = Array.isArray(node?.dimensions) ? node.dimensions : [];

    if (dimensions.length > 0) {
        return { kind: "dimensions", text: `across ${dimensions.join(" · ")}` };
    }

    const evidence = evidenceLines(facts?.[node?.identity])[0];

    return evidence ? { kind: "evidence", text: evidence } : null;
}


// --------------------------------------------------
// THE ORDER A PERSON READS
// --------------------------------------------------
// `step`, and nothing else. Steps the model never numbered come after the
// numbered ones in the order the plan lists them, and two steps with the
// same number are separated by id - so the order is total, and shuffling
// the nodes cannot change it.
//
// It used to break ties by longest path over edgesOut, which put whichever
// step happened to be called by another at the end of the feature.
// --------------------------------------------------

export function orderSteps(members) {
    const numbered = members.filter(node => Number.isFinite(node.step));
    const rest = members.filter(node => !Number.isFinite(node.step));

    numbered.sort((left, right) =>
        left.step - right.step ||
        String(left.id).localeCompare(String(right.id)));

    return [...numbered, ...rest];
}


// The feature's steps, in that order. Terms, preconditions and helpers are
// not steps and are never in the column.
export function orderedSteps(plan, featureId) {
    return orderSteps(featureRegisters(plan, featureId).spine);
}


// How many steps a Level 2 card shows of the process it stands for. Enough to
// tell the story, never enough to become the workflow: the whole point of the
// level is that the detail is one deliberate click away.
export const PREVIEW_STEPS = 4;

// On a Constellation card. Fewer than a Level 2 card showed, because this
// one is a glimpse of the feature rather than a summary of it - and because
// ten of them are on screen at once.
export const CONSTELLATION_PREVIEW = 3;

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

// --------------------------------------------------
// THE THREE REGISTERS OF A FEATURE
// --------------------------------------------------
// A feature used to be one list: every declaration in it, drawn as a step.
// That list mixed four kinds of sentence, and the reader had to sort them
// before any of it meant anything:
//
//   Verify user credentials          a behaviour
//   Define database configuration    a set of terms
//   Connect the database pool        a precondition
//   Convert values to string         a helper
//
// They are sorted here instead. The spine holds what the system DOES; the
// terms it is written in sit above it, what must already be running sits
// below it, and the helpers are named on the steps that call them. Nothing
// is dropped - every node is in exactly one of the four.
// --------------------------------------------------

export function featureRegisters(plan, featureId) {
    const members = nodesInFeature(plan, featureId);

    const of = role =>
        members.filter(node => roleOf(node) === role);

    return {
        spine: of("behaviour"),
        vocabulary: of("vocabulary"),
        machinery: of("machinery"),
        tools: of("tool"),
        total: members.length
    };
}

// --------------------------------------------------
// INLINE EVIDENCE
// --------------------------------------------------
// What a step's title says WHAT happens; this says what the code CONCRETELY
// does, in the reader's own words for the facts PlanMap already extracted -
// never an LLM guess, never an interpretation. Every line is a direct
// transcription of one fact: a call name, a status-shaped number, a count.
// That is what lets this run on every render with no cost and no risk of
// saying something the code does not actually do.
//
// ponytail: calls are surfaced in extraction order, not ranked by apparent
// importance - "calls authHeader.split" can show up before "calls
// jwt.verify" on the same step. Guessing which call name matters more is an
// open-ended problem; showing the real order is not. Add a relevance
// ranking if the first calls in a function turn out to be routinely
// uninformative plumbing.
// --------------------------------------------------

// A call name that sends an HTTP status: res.status(401), ctx.status = 401,
// res.sendStatus(401), response.statusCode = 401.
const SENDS_STATUS = /\.status(\(|$)|sendstatus|statuscode/i;

export function evidenceLines(facts) {
    if (!facts || typeof facts !== "object") return [];

    const lines = [];

    const calls = Array.isArray(facts.calls) ? facts.calls.filter(Boolean) : [];
    if (calls.length > 0) lines.push(`calls ${calls[0]}`);

    // A bare function reference handed to something else, not invoked here -
    // { callback: handleCredentialResponse }. Kept distinct from "calls":
    // the object literal's own line says what actually happens (a reference
    // is handed off), never "calls X", which would claim an invocation the
    // code doesn't make.
    const callbacks = Array.isArray(facts.callbacks) ? facts.callbacks.filter(Boolean) : [];
    if (callbacks.length > 0) lines.push(`registers ${callbacks[0]} as a callback`);

    // A number in [100,599] is only a status code if the step also calls
    // something that sends one. Without that corroboration a setTimeout(fn,
    // 300), a 500ms debounce or a CSS width of 200 all read as "answers N" -
    // an HTTP response the code never sends, which is the one thing this
    // function promises never to invent.
    const numbers = Array.isArray(facts.numbers) ? facts.numbers : [];
    const statusLike = numbers.filter(value => Number.isInteger(value) && value >= 100 && value <= 599);
    if (statusLike.length > 0 && calls.some(call => SENDS_STATUS.test(String(call)))) {
        lines.push(`answers ${statusLike.join(" or ")}`);
    }

    if (facts.throws > 0) {
        lines.push(
            Array.isArray(facts.throwTypes) && facts.throwTypes.length > 0
                ? `throws ${facts.throwTypes.join(", ")}`
                : `throws ${facts.throws === 1 ? "an error" : `${facts.throws} errors`}`
        );
    }

    if (facts.catches > 0) lines.push(`catches ${facts.catches === 1 ? "an error" : `${facts.catches} errors`}`);

    if (facts.awaits > 0) lines.push(`awaits ${facts.awaits === 1 ? "one call" : `${facts.awaits} calls`}`);

    if (Number.isInteger(facts.entryCount) && facts.entryCount > 0) lines.push(`holds ${facts.entryCount} entries`);

    // The least informative fact alone - a shape, not a behaviour - so it
    // only appears when nothing more concrete was available.
    if (lines.length === 0 && Number.isInteger(facts.params) && facts.params > 0) {
        lines.push(`takes ${facts.params === 1 ? "one parameter" : `${facts.params} parameters`}`);
    }

    // Every remaining call, and every remaining callback reference, in
    // order, after the one of each already shown above. The card only ever
    // shows the first couple of lines; the detail panel shows this whole
    // list.
    for (const call of calls.slice(1)) lines.push(`calls ${call}`);
    for (const callback of callbacks.slice(1)) lines.push(`registers ${callback} as a callback`);

    return lines;
}


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
    // The feature's STEPS. It used to count every node, so a feature whose
    // terms and preconditions carried a lens showed "5" on the pill while
    // the line under it said "4 of 7 steps" - two numbers for one thing,
    // neither of them wrong on its own.
    const members = featureRegisters(plan, featureId).spine;

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
// PARTS
// --------------------------------------------------
// A long feature opens folded, one row per part, rather than dropping
// eighty cards on the reader. A part is the first heading the outline
// already gave each step, so the fold follows a grouping somebody made
// rather than one the view invented.
//
// This replaces the lanes, which labelled a banded column off to one side
// and left every card on screen at once: a label on something you cannot
// read is not a way through it.
// --------------------------------------------------

// How many steps a feature can show flat before it folds.
export const RANGE_SIZE = 10;

export function partsOf(steps) {
    const order = [];
    const byName = new Map();

    for (const node of steps) {
        const name = areaOf(node) ?? "";

        if (!byName.has(name)) {
            byName.set(name, []);
            order.push(name);
        }

        byName.get(name).push(node);
    }

    // Insertion order is step order, so the parts already read in the
    // order a person meets them. Steps the outline never placed come last
    // whenever they came up, because "Other steps" is not a stage of
    // anything - it is what is left.
    const parts = order
        .filter(name => name !== "")
        .map(name => ({ id: `part:${name}`, name, nodes: byName.get(name) }));

    if (byName.has("")) {
        parts.push({ id: "part:", name: "Other steps", other: true, nodes: byName.get("") });
    }

    // One part is not a grouping - it is the feature. A feature the
    // outline put under one heading folds into ranges instead, which at
    // least tells the reader where they are.
    if (parts.length === 1) {
        return rangesOf(parts[0].nodes);
    }

    return parts;
}


function rangesOf(steps) {
    const ranges = [];

    for (let at = 0; at < steps.length; at += RANGE_SIZE) {
        const slice = steps.slice(at, at + RANGE_SIZE);

        ranges.push({
            id: `part:range:${at}`,
            name: `Steps ${at + 1}–${at + slice.length}`,
            range: true,
            nodes: slice
        });
    }

    return ranges;
}


// --------------------------------------------------
// LENSES FOLD; THEY NEVER RENAME
// --------------------------------------------------
// A lens used to replace each card's title with that perspective's own
// reading of it, so the same step appeared under four different names
// depending on which pill was lit, and entering a feature switched the
// first lens on - so the titles a reader saw first were never the plan's.
//
// A perspective is a way of reading one journey, not a second journey. So
// the titles, the numbers and the positions hold still, the steps the
// lens speaks to are outlined in its colour, and the runs in between fold
// into a row that says how many are there.
//
// Folding rather than hiding, because a reader has to be able to see that
// something was left out, and open it.
// --------------------------------------------------

function inLens(node, lensId) {
    return !lensId || (node?.lensTags ?? []).includes(lensId);
}


// One row per run of consecutive entries the lens has nothing to say
// about. An open row keeps its members, drawn muted.
function foldRuns(entries, speaks, label, openFolds, hiddenIn) {
    const out = [];

    let run = [];

    const flush = () => {
        if (run.length === 0) return;

        const id = `fold:${run[0].id}`;
        const open = openFolds.includes(id);
        const count = run.length;

        out.push({
            kind: "fold",
            id,
            open,
            count,
            label: open ? `Fold ${label(count)}` : label(count)
        });

        for (const entry of run) {
            if (open) {
                out.push({ ...entry, muted: true });
            } else {
                for (const node of entry.nodes ?? []) {
                    hiddenIn.set(node.id, id);
                }
            }
        }

        run = [];
    };

    for (const entry of entries) {
        if (speaks(entry)) {
            flush();
            out.push(entry);
        } else {
            run.push(entry);
        }
    }

    flush();

    return out;
}


// --------------------------------------------------
// THE SPINE
// --------------------------------------------------
// Everything the feature view draws, as one ordered list of items at one
// x. Step cards, part rows and fold rows are the same kind of thing to
// the layout: something with a fixed height that sits on the line.
//
// Terms, preconditions and helpers are not on the line. They sit above
// and below it as folded rows, because they are what the steps are
// written in rather than things the system does.
// --------------------------------------------------

const REGISTERS = [
    { key: "vocabulary", title: "Terms", where: "above" },
    { key: "machinery", title: "Runs on", where: "below" },
    { key: "tools", title: "Helpers", where: "below" }
];

export function buildSpine(plan, featureId, {
    verifiedStatus = {},
    lensId = null,
    facts = {},
    openPart = null,
    openFolds = [],
    openRegisters = []
} = {}) {
    const registers = featureRegisters(plan, featureId);
    const steps = orderSteps(registers.spine);

    const folded = steps.length > FLAT_LIMIT;
    const parts = folded ? partsOf(steps) : [];

    // --------------------------------------------------
    // NUMBERS
    // --------------------------------------------------
    // What the reader is looking at, not what the plan calls it. `step` is
    // the sort key; these are positions in the column, so they never skip
    // and never repeat.
    const numberById = new Map();
    const partIdByNode = new Map();

    if (folded) {
        parts.forEach((part, index) => {
            for (const node of part.nodes) partIdByNode.set(node.id, part.id);

            if (part.nodes.length === 1) {
                // A part holding one step is that step's card, so it takes
                // the part's own number rather than inventing a "3.1".
                numberById.set(part.nodes[0].id, String(index + 1));
                return;
            }

            part.nodes.forEach((node, at) => {
                numberById.set(node.id, `${index + 1}.${at + 1}`);
            });
        });
    } else {
        steps.forEach((node, index) => numberById.set(node.id, String(index + 1)));
    }

    const stepItem = node => ({
        kind: "step",
        id: node.id,
        nodes: [node],
        number: numberById.get(node.id) ?? "",
        node,
        status: effectiveStatus(node, verifiedStatus),
        detail: detailLine(node, { lensId, facts }),
        owns: Boolean(lensId && (node.lensTags ?? []).includes(lensId))
    });

    const hiddenIn = new Map();

    const label = (what, count) =>
        `${count} ${count === 1 ? what : `${what}s`} outside ${lensName(plan, lensId)}`;

    let body;

    if (!folded) {
        body = foldRuns(
            steps.map(stepItem),
            entry => inLens(entry.node, lensId),
            count => label("step", count),
            openFolds,
            hiddenIn
        );
    } else {
        const rows = parts.map((part, index) => {
            if (part.nodes.length === 1) {
                return { ...stepItem(part.nodes[0]), partId: part.id };
            }

            const lensCount = part.nodes.filter(node => inLens(node, lensId)).length;
            const statuses = part.nodes.map(node => effectiveStatus(node, verifiedStatus));

            return {
                kind: "part",
                id: part.id,
                nodes: part.nodes,
                number: String(index + 1),
                name: part.name,
                count: part.nodes.length,
                open: openPart === part.id,
                status: featureStatus(part.nodes, verifiedStatus),
                // Drift is never hidden behind a fold. A part row that
                // holds a problem says so, and says how many.
                failing: statuses.filter(status => status === "drifted" || status === "error").length,
                lenses: (plan?.lenses ?? [])
                    .map(lens => lens.id)
                    .filter(id => part.nodes.some(node => (node.lensTags ?? []).includes(id))),
                lensCount: lensId ? lensCount : null,
                lensLabel: lensId ? `${lensCount} of ${part.nodes.length} ${lensName(plan, lensId)}` : null
            };
        });

        // At the top level of a folded feature every row is a part, even
        // the ones drawn as a single step's card. So a run the lens has
        // nothing to say about folds as parts, and the reader is told how
        // many parts they are not being shown - not how many steps, which
        // would be a number about something they cannot see yet.
        const top = lensId
            ? foldRuns(
                rows,
                entry => entry.nodes.some(node => inLens(node, lensId)),
                count => `${count} ${count === 1 ? "part" : "parts"} outside ${lensName(plan, lensId)}`,
                openFolds,
                hiddenIn
            )
            : rows;

        body = [];

        for (const entry of top) {
            body.push(entry);

            if (entry.kind !== "part" || !entry.open) continue;

            // Inside an open part, the same step-folding rule applies.
            const inside = entry.nodes.map(node => ({ ...stepItem(node), partId: entry.id }));

            body.push(...(lensId
                ? foldRuns(
                    inside,
                    item => inLens(item.node, lensId),
                    count => label("step", count),
                    openFolds,
                    hiddenIn
                )
                : inside));
        }
    }

    // --------------------------------------------------
    // BESIDE THE LINE
    // --------------------------------------------------
    const registerRow = ({ key, title }) => {
        const nodes = registers[key];

        if (nodes.length === 0) return null;

        const id = `register:${key}`;

        return {
            kind: "register",
            id,
            title,
            count: nodes.length,
            open: openRegisters.includes(id),
            offLine: true,
            chips: nodes.map(node => ({
                id: node.id,
                title: node.title,
                status: effectiveStatus(node, verifiedStatus)
            }))
        };
    };

    const above = REGISTERS.filter(entry => entry.where === "above").map(registerRow).filter(Boolean);
    const below = REGISTERS.filter(entry => entry.where === "below").map(registerRow).filter(Boolean);

    const items = [...above, ...body, ...below];

    // --------------------------------------------------
    // ONE COLUMN
    // --------------------------------------------------
    let y = snap(TOP_Y);

    for (const item of items) {
        item.x = snap(COLUMN_X);
        item.h = item.kind === "step" ? STEP_H : ROW_H;
        item.y = y;

        y += item.h + CARD_GAP;
    }

    // The line joins neighbouring items on it, and means one thing: next
    // in this feature. Never an arrowhead, because it is not a claim about
    // cause - that is what a call arc is for.
    const onLine = items.filter(item => !item.offLine);

    const links = onLine
        .slice(0, -1)
        .map((item, index) => ({ from: item.id, to: onLine[index + 1].id }));

    return {
        items,
        links,
        folded,
        parts,
        numberById,
        partIdByNode,
        hiddenIn,
        // Every drifted step in the feature, in order, whether it is on
        // screen or folded away. Next drift walks this.
        drifts: steps
            .filter(node => {
                const status = effectiveStatus(node, verifiedStatus);
                return status === "drifted" || status === "error";
            })
            .map(node => node.id),
        flowLabel: folded ? "in step order · folded by part" : "in step order"
    };
}


export function lensName(plan, lensId) {
    if (!lensId) return "";

    const lens = (plan?.lenses ?? []).find(entry => entry.id === lensId);

    return lens?.label ?? lensId;
}


// The next drifted step after the one in hand, wrapping round. Returns null
// when the feature has none.
export function nextDrift(drifts, currentId) {
    if (!Array.isArray(drifts) || drifts.length === 0) return null;

    const at = drifts.indexOf(currentId);

    return drifts[(at + 1) % drifts.length];
}


// --------------------------------------------------
// CALLS
// --------------------------------------------------
// edgesOut means one thing now: this step's code calls that step's code.
// It is never the layout, because a call is not an order - four risk
// lookups that all call the same helper are siblings, not a sequence.
//
// It shows as a chip that names where the call goes, and as an arc in the
// gutter when the card is selected. A step folded away still gets named on
// the chip; it just has no arc to draw to.
// --------------------------------------------------

export const CHIP_TARGETS = 2;

export function callsChips(node, { numberById = new Map(), featureOfNode = new Map(), featureNames = new Map() } = {}) {
    const inside = [];
    const outside = [];

    for (const target of node?.edgesOut ?? []) {
        if (target === node.id) continue;

        if (numberById.has(target)) {
            inside.push(target);
            continue;
        }

        const feature = featureOfNode.get(target);

        if (feature) outside.push(feature);
    }

    const chips = [];

    if (inside.length > 0) {
        const shown = inside.slice(0, CHIP_TARGETS).map(id => numberById.get(id));
        const rest = inside.length - shown.length;

        chips.push({
            kind: "calls",
            targets: inside,
            text: `→ calls ${shown.join(", ")}${rest > 0 ? ` +${rest}` : ""}`
        });
    }

    for (const feature of [...new Set(outside)]) {
        chips.push({
            kind: "exit",
            feature,
            text: `↗ ${featureNames.get(feature) ?? feature}`
        });
    }

    return chips;
}


// Arcs for the selected card only: out to each visible step it calls, and
// in from each visible step that calls it.
export function callArcs(selectedId, items, plan) {
    if (!selectedId) return [];

    const visible = new Set(items.filter(item => item.kind === "step").map(item => item.id));

    if (!visible.has(selectedId)) return [];

    const byId = new Map((plan?.nodes ?? []).map(node => [node.id, node]));
    const selected = byId.get(selectedId);

    const arcs = [];

    for (const target of selected?.edgesOut ?? []) {
        if (target !== selectedId && visible.has(target)) {
            arcs.push({ from: selectedId, to: target, direction: "out" });
        }
    }

    for (const node of plan?.nodes ?? []) {
        if (node.id === selectedId || !visible.has(node.id)) continue;

        if ((node.edgesOut ?? []).includes(selectedId)) {
            arcs.push({ from: node.id, to: selectedId, direction: "in" });
        }
    }

    return arcs;
}


// --------------------------------------------------
// FIND A STEP
// --------------------------------------------------
// Across the whole plan, and into what a summary step covers - otherwise
// folding a feature would make the steps inside it unfindable, which is
// the one thing the cap must never cost.
// --------------------------------------------------

export const FIND_RESULTS = 8;

function fileOf(identity) {
    const file = String(identity ?? "").split("::")[0];
    return file.split("/").pop() ?? "";
}

export function findSteps(plan, query, limit = FIND_RESULTS) {
    const text = String(query ?? "").trim().toLowerCase();

    if (!text) return [];

    const results = [];

    for (const feature of plan?.features ?? []) {
        const steps = orderedSteps(plan, feature.id);
        const parts = steps.length > FLAT_LIMIT ? partsOf(steps) : [];

        const partOf = new Map();

        for (const part of parts) {
            for (const node of part.nodes) partOf.set(node.id, part.id);
        }

        for (const node of steps) {
            const identities = Array.isArray(node.identities) && node.identities.length > 0
                ? node.identities
                : node.identity ? [node.identity] : [];

            const haystack = [
                node.title,
                ...identities.map(declarationName),
                ...identities.map(fileOf),
                ...coveredSteps(node).map(entry => entry.title)
            ];

            if (!haystack.some(value => String(value ?? "").toLowerCase().includes(text))) continue;

            results.push({
                id: node.id,
                title: node.title,
                feature: feature.id,
                featureName: feature.name,
                part: partOf.get(node.id) ?? null,
                label: `${node.title} · ${feature.name}`
            });

            if (results.length === limit) return results;
        }
    }

    return results;
}


// --------------------------------------------------
// WHAT A WHEEL MEANS
// --------------------------------------------------
// Plain wheel and two-finger trackpad scrolling pan. A pinch arrives as
// ctrl+wheel, and Ctrl/Cmd+wheel is the deliberate zoom - so zooming is
// something you ask for, and scrolling is what a wheel does everywhere
// else on the machine.
// --------------------------------------------------

export function wheelAction({
    deltaX = 0,
    deltaY = 0,
    deltaMode = 0,
    ctrlKey = false,
    metaKey = false,
    shiftKey = false
} = {}) {
    if (ctrlKey || metaKey) {
        return {
            kind: "zoom",
            factor: zoomFactorFor({ deltaY, deltaMode, ctrlKey, metaKey })
        };
    }

    const unit = DELTA_UNIT[deltaMode] ?? 1;

    // Shift turns a vertical wheel sideways, which is what a mouse with one
    // wheel has. A trackpad already sends deltaX and needs no help.
    const sideways = shiftKey && deltaX === 0;

    return {
        kind: "pan",
        dx: (sideways ? deltaY : deltaX) * unit,
        dy: (sideways ? 0 : deltaY) * unit
    };
}


export function clampScale(scale, max = 2.2) {
    return Math.max(MIN_SCALE, Math.min(max, scale));
}


// --------------------------------------------------
// WHAT THE APPROVE BUTTON APPROVES
// --------------------------------------------------
// The label has to be exactly what the click does. Inside a feature with a
// lens on it said "Approve Security" and ran a plan-wide --lens, so it
// approved security steps in every other feature too - steps the reader
// had never opened, under a label that said they had.
//
// The count is intended NODES, every role, because that is what the CLI
// call will approve. A button that counts steps and approves terms as well
// is the same lie one size smaller.
// --------------------------------------------------

export function approveScope(plan, { featureId = null, lensId = null } = {}) {
    const nodes = (plan?.nodes ?? []).filter(node => node.status === "intended");

    const feature = (plan?.features ?? []).find(entry => entry.id === featureId);

    const count = matched => matched.length;

    const breakdown = matched => {
        const roles = [
            ["behaviour", "step", "steps"],
            ["vocabulary", "term", "terms"],
            ["machinery", "precondition", "preconditions"],
            ["tool", "helper", "helpers"]
        ];

        return roles
            .map(([role, one, many]) => {
                const total = matched.filter(node => roleOf(node) === role).length;
                return total === 0 ? null : `${total} ${total === 1 ? one : many}`;
            })
            .filter(Boolean);
    };

    if (!featureId) {
        return {
            scope: "plan",
            label: `Approve plan (${count(nodes)})`,
            count: count(nodes),
            breakdown: breakdown(nodes),
            message: { type: "approveAll" }
        };
    }

    const inFeature = nodes.filter(node => node.feature === featureId);

    if (!lensId) {
        return {
            scope: "feature",
            label: `Approve ${feature?.name ?? featureId} (${count(inFeature)})`,
            count: count(inFeature),
            breakdown: breakdown(inFeature),
            message: { type: "approveFeature", featureId }
        };
    }

    const scoped = inFeature.filter(node => (node.lensTags ?? []).includes(lensId));

    return {
        scope: "feature-lens",
        label: `Approve ${lensName(plan, lensId)} (${count(scoped)})`,
        count: count(scoped),
        breakdown: breakdown(scoped),
        message: { type: "approveLens", lensId, featureId }
    };
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

// --------------------------------------------------
// WHAT A SUMMARY STEP COVERS
// --------------------------------------------------
// The panel's replacement for "What implements this". A summary step's
// declarations are not a list of things that implement ONE claim - they
// are several steps that were folded together - so listing the identities
// flat would lose which rule and which evidence belongs to which step.
//
// One block per covered step, in the order they were folded, each holding
// its own functions, its own rules and its own evidence. Nothing here is
// derived from anything but the node and the facts already loaded: a
// covered step the plan does not name cannot appear.
// --------------------------------------------------

export function coversBlocks(node, facts = {}) {
    const rules = Array.isArray(node?.rules) ? node.rules : [];

    return coveredSteps(node).map(entry => {
        const identities = Array.isArray(entry.identities) ? entry.identities : [];

        return {
            title: entry.title ?? "",
            identities,
            names: identities.map(declarationName),
            rules: describeRules(rules.filter(rule => identities.includes(rule.target))),
            evidence: identities.flatMap(identity => evidenceLines(facts?.[identity]))
        };
    });
}

// Which covered step a verify violation belongs to. Without this a drifted
// summary step says a field changed and leaves the reader to work out
// which of the seven steps behind the card it happened in.
export function coveredStepTitle(node, target) {
    const entry = coveredSteps(node).find(
        step => (Array.isArray(step.identities) ? step.identities : []).includes(target));

    return entry ? entry.title : null;
}

// --------------------------------------------------
// FOLLOWING THE OPEN PANEL THROUGH A REFRESH
// --------------------------------------------------
// An approve, a verify or a rescan re-reads the plan while the detail
// panel may still be open. The panel follows its node - a revise gives it
// a new id that supersedes the old one - or closes if it is gone.
//
// The view used to do this inline over every item on the canvas, and a
// part row or a fold row has no `source`, so any refresh in a folded
// feature threw on `item.source.supersedes` and took the rest of the
// refresh with it: breadcrumb, lens bar, hint and approve button all
// stopped updating.
//
// Only a step has a source, and only a step can be in the panel.
// --------------------------------------------------

export function followDetail(items, detailNodeId) {
    if (!detailNodeId) return null;

    return (Array.isArray(items) ? items : []).find(item =>
        item?.source &&
        (item.id === detailNodeId || item.source.supersedes === detailNodeId)) ?? null;
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

export function describeViolation(violation, node = null) {
    // The covered step this violation happened in, on a summary step.
    // Absent everywhere else: every other node stands for one step and has
    // nothing to disambiguate, and its shape is unchanged.
    const covers = node ? coveredStepTitle(node, violation?.target) : null;

    return {
        field: violation?.field ?? violation?.target ?? "rule",
        expected: showValue(violation?.expected),
        actual: showValue(violation?.actual),
        reason: violation?.reason ?? violation?.message ?? "",
        ...(covers ? { covers } : {})
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

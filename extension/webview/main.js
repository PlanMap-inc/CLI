import {
    AREA_W,
    AREA_H,
    buildAreas,
    layoutAreas,
    NODE_W,
    NODE_H_EST,
    bandsOf,
    buildConstellation,
    buildFeatureGraph,
    featureRegisters,
    flowEdgePath,
    colorAt,
    constellationEdges,
    coversBlocks,
    describeHistory,
    describeImpact,
    describeRules,
    describeViolation,
    escapeHtml,
    evidenceLines,
    isSummary,
    lensColors,
    lensCoverage,
    LENS_QUESTIONS,
    FEATURE_PALETTE,
    nodeActions,
    onboardingState,
    panAxis,
    panDirection,
    panVelocity,
    PAN_DIRECTIONS,
    PAN_FAST,
    PAN_SPEED,
    parseScanProgress,
    railModel,
    statusClass,
    statusDotStyle,
    zoomFactorFor,
    verifyResultFor
} from "./model.js";
import { createEvolutionView } from "./evolution-view.js";
import { paint } from "./paint.js";

// The webview has no filesystem access. It renders the state the host
// posts, and asks the host for anything that has to touch .planmap/.
const vscode = acquireVsCodeApi();

const MIN_SCALE = 0.3;
// Fitting stops here even when the content is taller than the canvas. A map
// is opened to be read, and a whole journey shrunk to fit is a picture of a
// journey rather than something you can read - so the map opens at full size
// and runs off the bottom of the screen, which is what panning is for.
const FIT_MIN_SCALE = 1;
// How far from the edge the first step sits when the map is taller than the
// canvas: above the bottom on the Constellation, whose journey climbs, and
// below the top in a feature, whose flow runs down.
const FIT_BOTTOM_PAD = 72;
const FIT_TOP_PAD = 72;
const MAX_SCALE = 2.2;
const FLY_MS = 450;
// Add, rename, delete, connect and compile need CLI commands that don't exist yet.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// The same view, scaled by `factor` about the centre of a w×h viewport.
function scaledAboutCenter(view, factor, w, h) {
    return {
        scale: view.scale * factor,
        panX: view.panX * factor + (1 - factor) * w / 2,
        panY: view.panY * factor + (1 - factor) * h / 2
    };
}


// ================= GRAPH (the demo's createGraph, fed real data) =================
// --------------------------------------------------
// A BEHAVIOURAL AREA, AS A CARD
// --------------------------------------------------
// Deliberately not a step. It carries no code identity, because an area is
// not a code entity and giving it a file name would be a lie about what it
// is - the identity line is what tells a reader they have reached Level 3.
// It carries the one thing a reader needs before deciding to open it: how
// much is inside.
// --------------------------------------------------

function areaCard(n) {
    const colors = lensColors(plan());

    // Aggregation loses the count, and the count is the actionable part: one
    // drifted step of twenty-one and fourteen of twenty-one are different
    // situations and the first must not look like the second.
    const state = n.failing > 0
        ? `${n.failing} of ${n.count} ${n.status}`
        : n.status;

    // The card's subject is what this process DOES. A name and a number say
    // the process is large and nothing about what it is for, so the four
    // steps are the body of the card and the count is a footnote to them.
    const hidden = n.count - (n.preview?.length ?? 0);

    const flow = (n.preview ?? []).map((step, index) => `
        ${index > 0 ? '<span class="pv-arrow" aria-hidden="true">↓</span>' : ""}
        <span class="pv-step">${escapeHtml(step.title)}</span>`).join("");

    return `
        <div class="area-head">
            <div class="title"${opts.onRename ? ' title="Double-click to rename"' : ""}>${escapeHtml(n.title)}</div>
            ${n.oversized ? '<span class="area-large" title="Large enough to be hard to read when opened">large</span>' : ""}
        </div>
        <div class="area-flow">${flow}</div>
        <div class="area-foot">
            <span class="area-count">${n.count} steps${hidden > 0 ? `<em> · ${hidden} more inside</em>` : ""}</span>
            ${n.lenses?.length ? `<span class="node-lenses">${n.lenses.map(id => `<span class="node-lens" data-style="background:${colors[id] ?? "var(--text-low)"}"></span>`).join("")}</span>` : ""}
        </div>
        <div class="status-pill"><span class="dot" data-style="${statusDotStyle(n.status, n.color)}"></span>${escapeHtml(state)}</div>`;
}


function createGraph(canvasEl, gridEl, contentEl, opts) {
    // The box this graph's cards occupy. Fitting, edge anchors and fly-to all
    // measure from it, so a graph drawing a different card must say so.
    const CARD_W = opts.variant === "area" ? AREA_W : NODE_W;
    const CARD_H = opts.variant === "area" ? AREA_H : NODE_H_EST;

    // Cards no longer share a height: a Constellation card carries a preview
    // of what it opens onto, a merged step carries the nouns it reads
    // across. The layout measures each one, so everything that reasons about
    // where a card ENDS has to ask the card rather than the constant.
    const heightOf = node => node?.h ?? CARD_H;

    let nodes = [], edges = [];
    // What the view draws to the left of the steps - lane labels, the
    // feature's own terms - so centring centres the picture rather than just
    // the column of cards.
    let insetLeft = 0;
    // The terms above the spine and the preconditions below it. Unlike the
    // lane labels, these are content on this axis, not margin: they have to
    // be centred with the steps and reachable by panning. They were neither
    // - vertical panning locks when the steps fit, so a terms band sitting
    // above the top row was simply cut off with no way to reach it.
    let insetTop = 0;
    let insetBottom = 0;
    let selectedId = null, onSelect = null, onOpen = null, dotColor = "var(--accent-a)", edgeColor = "var(--edge)";
    let panX = 0, panY = 0, scale = 1, panning = false, panStart = null, panOrigin = null;
    let dragging = null, suppressClick = false;

    if (opts.horizontal || opts.hideHandles) contentEl.dataset.h = "1";

    function applyTransform() {
        contentEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        gridEl.style.backgroundPosition = `${panX}px ${panY}px`;
        gridEl.style.backgroundSize = `${24 * scale}px ${24 * scale}px`;
    }

    function render() {
        contentEl.querySelectorAll(".gnode, .node-toolbar").forEach(n => n.remove());
        nodes.forEach(renderNode);
        drawEdges();
        if (selectedId) renderToolbar();
    }

    function renderNode(n) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `gnode ${statusClass(n.status)}`
            + (opts.variant === "area" ? " area" : "")
            + (n.ungrouped ? " ungrouped" : "")
            + (n.id === selectedId ? " selected" : "");
        el.dataset.id = n.id;
        el.style.left = n.x + "px";
        el.style.top = n.y + "px";
        el.setAttribute("aria-label", `${n.title}, ${n.status}`);
        el.innerHTML = opts.variant === "area"
            ? areaCard(n)
            : `
            <div class="handle top"></div>
            <div class="bar" data-style="background:${n.color || dotColor}"></div>
            ${n.step ? `<div class="step">${n.step}</div>` : ""}
            <div class="title">${escapeHtml(n.title)}</div>
            ${n.sub ? `<div class="sub" title="${escapeHtml(n.source?.identity ?? n.sub)}">${escapeHtml(n.sub)}</div>` : ""}
            ${n.preview?.length ? `<div class="node-preview">${n.preview.map(step => `<div class="preview-step">${escapeHtml(step.title)}</div>`).join("")}</div>` : ""}
            ${n.backing > 1 ? `<div class="node-backing" title="${escapeHtml(n.dimensions.join(", "))}">${n.dimensions.length ? escapeHtml(n.dimensions.join(" · ")) : `${n.backing} declarations`}</div>` : ""}
            ${n.evidence?.length ? `<div class="node-evidence">${n.evidence.map(line => `<div class="evidence-line">${escapeHtml(line)}</div>`).join("")}</div>` : ""}
            ${n.lenses?.length ? `<div class="node-lenses">${n.lenses.map(id => `<span class="node-lens" data-style="background:${lensColors(plan())[id] ?? "var(--text-low)"}"></span>`).join("")}</div>` : ""}
            <div class="status-pill"><span class="dot" data-style="${statusDotStyle(n.status, n.color || dotColor)}"></span>${n.failing > 0 ? `${n.failing} of ${n.count ?? ""} ${n.status}`.replace("  ", " ") : n.status}</div>
            ${n.exit ? `<div class="exit" title="Continues in ${escapeHtml(n.exit.area)}: ${escapeHtml(n.exit.title ?? "")}">↗ ${escapeHtml(n.exit.area)}</div>` : ""}
            <div class="handle bottom"></div>`;
        paint(el);
        // Dragging moves the step; a click that never moved opens it. The
        // 4px threshold is what separates the two - without it every drag
        // ends by opening the panel you were dragging out from under.
        el.addEventListener("mousedown", e => {
            e.stopPropagation();
            if (!opts.onMove) return;
            e.preventDefault();
            dragging = { node: n, fromX: e.clientX, fromY: e.clientY, startX: n.x, startY: n.y, moved: false };
        });

        el.addEventListener("click", e => {
            e.stopPropagation();
            if (suppressClick) { suppressClick = false; return; }
            select(n.id);
            if (onOpen) onOpen(n);
        });

        el.addEventListener("dblclick", e => {
            e.stopPropagation();
            if (opts.onRename) opts.onRename(n);
        });
        contentEl.appendChild(el);
    }

    function select(id) {
        selectedId = id;
        contentEl.querySelectorAll(".gnode").forEach(el => el.classList.toggle("selected", el.dataset.id === id));
        renderToolbar();
        if (onSelect) onSelect(id);
    }

    function deselect() {
        selectedId = null;
        contentEl.querySelectorAll(".gnode").forEach(el => el.classList.remove("selected"));
        contentEl.querySelector(".node-toolbar")?.remove();
    }

    // Rename and delete stay visible but inert: the CLI has no authoring commands yet.
    function renderToolbar() {
        contentEl.querySelector(".node-toolbar")?.remove();
        if (!opts.showToolbar) return;
        const n = nodes.find(x => x.id === selectedId);
        if (!n) return;
        const tb = document.createElement("div");
        tb.className = "node-toolbar";
        tb.style.left = (n.x + CARD_W - 70) + "px";
        tb.style.top = (n.y - 34) + "px";
        tb.innerHTML = '<button data-act="rename" title="Rename this step">✎</button>'
            + '<button data-act="detail" title="Show intent, rules and history">ⓘ</button>'
            + '<button data-act="danger" class="danger" title="Remove this step from the plan">🗑</button>';
        tb.addEventListener("mousedown", e => e.stopPropagation());
        tb.addEventListener("click", e => {
            e.stopPropagation();
            const act = e.target.closest("button")?.dataset.act;
            if (act === "detail" && onOpen) onOpen(n);
            if (act === "rename" && opts.onRename) opts.onRename(n);
            if (act === "danger" && opts.onRemove) opts.onRemove(n);
        });
        contentEl.appendChild(tb);
    }

    function elbowPath(x1, y1, x2, y2) { const midY = (y1 + y2) / 2; return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`; }
    function elbowPathH(x1, y1, x2, y2) { const midX = (x1 + x2) / 2; return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`; }
    // Areas are a set, not a column: a link between two of them says only
    // "this part feeds that one", so it runs straight between their centres
    // and sits behind the cards rather than routing around them.
    function straightPath(x1, y1, x2, y2) { return `M ${x1} ${y1} L ${x2} ${y2}`; }

    function drawEdges() {
        const svgEl = contentEl.querySelector("svg.edges");
        let markup = `<defs><marker id="arrow-${opts.id}" markerWidth="6" markerHeight="6" refX="3" refY="3"><circle cx="3" cy="3" r="2.1" fill="${edgeColor}"/></marker></defs>`;
        edges.forEach(e => {
            const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to);
            if (!a || !b) return;
            const d = opts.variant === "area"
                ? straightPath(a.x + CARD_W / 2, a.y + heightOf(a) / 2, b.x + CARD_W / 2, b.y + heightOf(b) / 2)
                : opts.topDown
                    ? flowEdgePath(a, b, nodes, CARD_W)
                    : opts.horizontal
                        ? elbowPathH(a.x + CARD_W, a.y + heightOf(a) / 2, b.x, b.y + heightOf(b) / 2)
                        : elbowPath(a.x + CARD_W / 2, a.y, b.x + CARD_W / 2, b.y + heightOf(b));
            markup += `<path class="edge-path" d="${d}" data-style="stroke:${edgeColor}" marker-end="url(#arrow-${opts.id})"/>`;
        });
        svgEl.innerHTML = markup;
        paint(svgEl);
    }

    canvasEl.addEventListener("mousedown", e => {
        if (e.target.closest(".gnode") || e.target.closest(".node-toolbar")) return;
        deselect();
        panning = true; panStart = { x: e.clientX, y: e.clientY }; panOrigin = { x: panX, y: panY };
        canvasEl.classList.add("panning");
    });
    canvasEl.addEventListener("wheel", e => {
        e.preventDefault();
        const rect = canvasEl.getBoundingClientRect();
        zoomAround(e.clientX - rect.left, e.clientY - rect.top, zoomFactorFor(e));
    }, { passive: false });
    document.addEventListener("mousemove", e => {
        if (panning) {
            panX = panOrigin.x + (e.clientX - panStart.x);
            panY = panOrigin.y + (e.clientY - panStart.y);
            clampPan();
            applyTransform();
        }

        if (dragging) {
            const dx = (e.clientX - dragging.fromX) / scale;
            const dy = (e.clientY - dragging.fromY) / scale;

            if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 4) return;

            dragging.moved = true;
            dragging.node.x = dragging.startX + dx;
            dragging.node.y = dragging.startY + dy;

            const el = contentEl.querySelector(`.gnode[data-id="${dragging.node.id}"]`);
            if (el) { el.style.left = dragging.node.x + "px"; el.style.top = dragging.node.y + "px"; el.classList.add("dragging"); }
            drawEdges();
            contentEl.querySelector(".node-toolbar")?.remove();
        }
    });

    document.addEventListener("mouseup", () => {
        if (panning) { panning = false; canvasEl.classList.remove("panning"); }

        if (dragging) {
            const { node, moved } = dragging;
            dragging = null;
            contentEl.querySelector(`.gnode[data-id="${node.id}"]`)?.classList.remove("dragging");

            if (moved) {
                // Snapped, so hand-placed steps still line up with the grid
                // and with the ones the layout placed.
                node.x = Math.round(node.x / 24) * 24;
                node.y = Math.round(node.y / 24) * 24;
                render();
                suppressClick = true;
                opts.onMove(node);
            }
        }
    });

    function zoomAround(mx, my, factor) {
        const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
        const lx = (mx - panX) / scale, ly = (my - panY) / scale;
        panX = mx - lx * newScale; panY = my - ly * newScale; scale = newScale;
        clampPan();
        applyTransform(); syncZoomLabel();
    }

    // --------------------------------------------------
    // THE MAP STAYS WHERE IT CAN BE READ
    // --------------------------------------------------
    // The journey runs up or down the canvas, so vertical is travel and
    // sideways is not. Horizontally the content is centred and held there
    // while it fits; only a row too wide for the canvas can be moved
    // sideways, and only as far as its own edges. Vertically you may travel, but not past
    // the ends - panning used to be unbounded in both directions, so the
    // map could be pushed off-screen entirely with nothing to say where it
    // had gone.
    // --------------------------------------------------

    // The steps themselves. Lane labels and the terms beside them are NOT in
    // here: they are margin furniture, and centring the box that contains
    // them centres a mostly-empty left half - which pushed the steps a long
    // way right of the middle on a feature whose labels were far from them.
    // The furniture is carried as insetLeft, and only decides whether the
    // picture fits and how far it may be panned.
    function contentBox() {
        if (!nodes.length) return null;

        const xs = nodes.map(n => n.x);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs) + CARD_W,
            minY: Math.min(...nodes.map(n => n.y)) - insetTop,
            maxY: Math.max(...nodes.map(n => n.y + heightOf(n))) + insetBottom
        };
    }

    // How close the content may come to the edge before panning stops. Less
    // than the fit leaves at the bottom, so the opening view is inside it.
    const PAN_EDGE = 40;

    function clampPan() {
        const box = contentBox();
        if (!box) return;

        const rect = canvasEl.getBoundingClientRect();

        // Horizontally the steps are what gets centred, but what has to FIT
        // is the steps plus whatever is drawn beside them - otherwise a
        // label could be centred off the edge with no way to pan to it.
        panX = panAxis({
            from: box.minX,
            to: box.maxX,
            pan: panX,
            extent: rect.width,
            scale,
            edge: PAN_EDGE,
            padStart: insetLeft
        });

        panY = panAxis({ from: box.minY, to: box.maxY, pan: panY, extent: rect.height, scale, edge: PAN_EDGE });
    }

    function fitView() {
        const rect = canvasEl.getBoundingClientRect();
        const box = contentBox();
        if (!box) return { panX: rect.width / 2, panY: rect.height / 2, scale: 1 };

        // The same box the clamp measures, lane labels and all. They used to
        // measure differently - the fit centred the column of cards, the
        // clamp centred the whole picture - so the first time anything
        // recomputed the pan, the map stepped sideways by half the width of
        // the furniture beside it.
        const { minX, maxX, minY, maxY } = box;
        // Scale so the whole picture fits - the steps and the lane labels
        // beside them - then centre on the steps alone.
        const w = Math.max(1, maxX - minX + insetLeft), h = Math.max(1, maxY - minY);
        const pad = 48;
        // Never fit so small that the titles stop being readable. A long
        // journey scrolls instead - a graph you cannot read explains nothing,
        // and fitting used to land at 45%.
        const s = clamp(Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h, 1.15), FIT_MIN_SCALE, MAX_SCALE);

        const panX = rect.width / 2 - (minX + (maxX - minX) / 2) * s;

        // Taller than the canvas, which is now the normal case: open where
        // the journey starts - the top of a flow that runs down, the bottom
        // of one that climbs. Centring a map that does not fit opens it in
        // the middle of itself, with the beginning off-screen and no sign
        // that it is there.
        const overflows = h * s > rect.height - pad * 2;
        const atStart = opts.topDown
            ? FIT_TOP_PAD - minY * s
            : rect.height - FIT_BOTTOM_PAD - maxY * s;

        return {
            panX,
            panY: overflows
                ? atStart
                : rect.height / 2 - (minY + h / 2) * s,
            scale: s
        };
    }

    function setView(view) { panX = view.panX; panY = view.panY; scale = view.scale; applyTransform(); syncZoomLabel(); }

    // Animate the content transform. A forced reflow commits the start state,
    // so the flight never depends on animation frames firing - a hidden or
    // throttled webview still completes it and never stays locked mid-flight.
    async function flyTo(view) {
        if (reducedMotion.matches) { setView(view); return; }
        contentEl.classList.add("flying");
        void contentEl.offsetWidth;
        setView(view);
        await wait(FLY_MS);
        contentEl.classList.remove("flying");
    }

    // The view that puts node `id` at the viewport centre, magnified.
    function zoomedOnto(id, factor) {
        const n = nodes.find(x => x.id === id);
        const rect = canvasEl.getBoundingClientRect();
        if (!n) return { panX, panY, scale };
        const s = scale * factor;
        const cx = n.x + CARD_W / 2, cy = n.y + heightOf(n) / 2;
        return { panX: rect.width / 2 - cx * s, panY: rect.height / 2 - cy * s, scale: s };
    }

    // --------------------------------------------------
    // THE MAP FOLLOWS THE CANVAS
    // --------------------------------------------------
    // The detail panel is a flex sibling of the canvas, so opening it makes
    // the canvas narrower over the 280ms its width animates. The map used to
    // ignore that: it stayed where it was while the panel slid over it, and
    // then jumped sideways the next time anything touched the pan - because
    // that was the first moment the centring was recomputed.
    //
    // A resize observer fires throughout the panel's animation, so
    // re-centring on each one walks the map across in step with it. No
    // transition of its own: one would restart on every notification and
    // lag behind the thing it is supposed to be following.
    // --------------------------------------------------

    const canvasResize = new ResizeObserver(() => {
        // A flight owns the transform while it runs, and sets its own
        // destination from the size the canvas will have settled at.
        if (contentEl.classList.contains("flying") || !nodes.length) return;

        const wasX = panX;
        const wasY = panY;

        clampPan();

        if (panX !== wasX || panY !== wasY) applyTransform();
    });

    canvasResize.observe(canvasEl);

    applyTransform();

    return {
        setData(next) {
            nodes = next.nodes; edges = next.edges;
            insetLeft = next.insetLeft ?? 0;
            insetTop = next.insetTop ?? 0;
            insetBottom = next.insetBottom ?? 0;
            dotColor = next.dotColor ?? dotColor;
            edgeColor = next.edgeColor ?? edgeColor;
            onOpen = next.onOpen ?? onOpen;
            if (selectedId && !nodes.some(n => n.id === selectedId)) selectedId = null;
            render();
        },
        clearSelection: deselect,
        panBy(dx, dy) { panX += dx; panY += dy; clampPan(); applyTransform(); },
        zoomIn: () => { const r = canvasEl.getBoundingClientRect(); zoomAround(r.width / 2, r.height / 2, 1.25); },
        zoomOut: () => { const r = canvasEl.getBoundingClientRect(); zoomAround(r.width / 2, r.height / 2, 0.8); },
        fitToContent: () => setView(fitView()),
        fitView, setView, flyTo, zoomedOnto,
        get view() { return { panX, panY, scale }; },
        get scale() { return scale; },
        get nodes() { return nodes; }
    };
}


// ================= STATE =================
let state = null;
// Where the reader is. The journey is System -> Feature -> Behaviour ->
// Code, and the middle level appears only where a feature is large enough
// to need it - a feature a reader can take in at once must not cost an
// extra click to open.
let level = "constellation";   // "constellation" | "areas" | "steps"
let currentAreaName = null;
let currentFeatureId = null;
let currentLensId = null;
let flying = false;
let constellationHome = null;

const constellationCanvas = document.getElementById("constellationCanvas");
const featureCanvas = document.getElementById("featureCanvas");
const areasCanvas = document.getElementById("areasCanvas");
const areasTag = document.getElementById("areasTag");
const areasTagText = document.getElementById("areasTagText");
const breadcrumb = document.getElementById("breadcrumb");
const lensSwitch = document.getElementById("lensSwitch");
const statusHint = document.getElementById("statusHint");
const zoomLabel = document.getElementById("zoomLabel");
const impactPanel = document.getElementById("impactPanel");
const impactInner = document.getElementById("impactInner");
const emptyState = document.getElementById("emptyState");
const emptyCard = document.getElementById("emptyCard");
const constellationFlowTag = document.getElementById("constellationFlowTag");
const constellationFlowLabel = document.getElementById("constellationFlowLabel");
const featureFlowLabel = document.getElementById("featureFlowLabel");

// Level 2. Read-only and no handles: an area is not something you drag,
// rename or delete - it is a view onto steps that are. Authoring stays where
// the declarations are.
const areasGraph = createGraph(areasCanvas, document.getElementById("areasGrid"), document.getElementById("areasContent"), {
    id: "areas", showToolbar: false, hideHandles: true, variant: "area"
});
const constellationGraph = createGraph(constellationCanvas, document.getElementById("constellationGrid"), document.getElementById("constellationContent"), {
    id: "const",
    showToolbar: false,
    hideHandles: true,
    // Double-click to rename, the same gesture as a step inside a feature.
    // Nothing else here is authorable: a feature is not added or deleted on
    // the map, it appears because declarations belong to it.
    onRename: node => renameFeature(node)
});
// Authoring lives in Feature Space, where the steps are. Each callback is
// one CLI command: the canvas never writes plan.json itself, so a step moved
// here and a step moved from a terminal end up byte-identical.
const featureGraph = createGraph(featureCanvas, document.getElementById("featureGrid"), document.getElementById("featureContent"), {
    id: "feat",
    showToolbar: true,
    // The flow reads top to bottom, and its connectors are drawn to match.
    topDown: true,
    onMove: node => request("action", { type: "moveNode", target: node.id, x: node.x, y: node.y }),
    onRename: node => renameStep(node),
    onRemove: node => {
        const source = node.source ?? {};
        request("action", { type: "reject", target: node.id, force: source.status === "approved" });
    }
});

// Renaming happens in the node, not in a dialog: you are looking at the thing
// while you retitle it. Escape abandons, Enter and blur commit, and an empty
// name is a cancel rather than a thing with no name.
//
// One function for both canvases. A feature's name on the Constellation and a
// step's title inside it are the same gesture on the same kind of card, and
// having two of these drifted the moment one of them gained a guard.
function renameInPlace(canvas, node, commitWith) {
    const el = canvas.querySelector(`.gnode[data-id="${node.id}"] .title`);
    if (!el || el.isContentEditable) return;

    const before = el.textContent;
    el.contentEditable = "plaintext-only";
    el.classList.add("editing");
    el.focus();
    document.getSelection()?.selectAllChildren(el);

    let done = false;

    const finish = commit => {
        if (done) return;
        done = true;

        const title = el.textContent.trim();
        el.contentEditable = "false";
        el.classList.remove("editing");

        if (!commit || !title || title === before) { el.textContent = before; return; }
        commitWith(title);
    };

    el.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); finish(true); }
        if (event.key === "Escape") { event.preventDefault(); finish(false); }
    });
    el.addEventListener("blur", () => finish(true), { once: true });
}

const renameStep = node =>
    renameInPlace(featureCanvas, node, title =>
        request("action", { type: "renameNode", target: node.id, title }));

// The Constellation's names come from a model reading the code. Where it has
// called a capability something the team does not, this is where that gets
// corrected - and like every other change on the canvas, it is a CLI command,
// so the same rename from a terminal lands byte-identical.
const renameFeature = node =>
    renameInPlace(constellationCanvas, node, name =>
        request("action", { type: "renameFeature", target: node.id, name }));

const inFeature = () => level !== "constellation";

function activeGraph() {
    if (level === "steps") return featureGraph;
    if (level === "areas") return areasGraph;
    return constellationGraph;
}
function syncZoomLabel() { zoomLabel.textContent = Math.round(activeGraph().scale * 100) + "%"; }

function plan() { return state?.plan; }
function featureById(id) { return plan()?.features.find(f => f.id === id); }
function lensById(id) { return plan()?.lenses.find(l => l.id === id); }


// ================= RENDER FROM STATE =================
function mountConstellation() {
    const nodes = buildConstellation(plan(), state.verifiedStatus);
    const edges = constellationEdges(plan());

    constellationFlowTag.hidden = edges.length === 0;
    constellationFlowLabel.textContent = edges[0]?.source === "nodes" ? "how one leads to the next" : "the order a person meets them";

    constellationGraph.setData({ nodes, edges, edgeColor: "var(--text-low)", onOpen: n => enterFeature(n.id) });
}

function remountLevel() {
    if (level === "areas") mountAreas();
    else if (level === "steps") mountFeature();
}

function mountAreas() {
    const p = plan();
    const shape = buildAreas(p, currentFeatureId, state.verifiedStatus);
    const colors = lensColors(p);
    const featureIndex = p.features.findIndex(f => f.id === currentFeatureId);
    const color = currentLensId ? colors[currentLensId] : colorAt(FEATURE_PALETTE, featureIndex);

    // Every card here is a way in, never a declaration. This screen answers
    // one question - how is this feature organised - and a step drawn beside
    // the cards would start answering the next one too.
    const placed = layoutAreas(
        shape.areas.map(area => ({ ...area, title: area.name })),
        areasCanvas.clientWidth || 900
    );

    areasTag.hidden = placed.length === 0;
    areasTagText.textContent = `${shape.total} steps in ${placed.length} ${placed.length === 1 ? "part" : "parts"}`;

    areasGraph.setData({
        nodes: placed.map(n => ({ ...n, color })),
        edges: shape.edges,
        dotColor: color,
        edgeColor: currentLensId ? color : "var(--edge)",
        onOpen: n => enterArea(n.id)
    });
}

function mountFeature() {
    const p = plan();
    const graph = buildFeatureGraph(p, currentFeatureId, state.verifiedStatus, currentLensId, currentAreaName, state.facts);
    const colors = lensColors(p);
    const featureIndex = p.features.findIndex(f => f.id === currentFeatureId);
    const color = currentLensId ? colors[currentLensId] : colorAt(FEATURE_PALETTE, featureIndex);

    const registers = featureRegisters(p, currentFeatureId);

    featureGraph.setData({
        nodes: graph.nodes.map(n => ({ ...n, color })),
        edges: graph.edges,
        dotColor: color,
        edgeColor: currentLensId ? color : "var(--edge)",
        insetLeft: asideInset(graph),
        insetTop: registers.vocabulary.length ? ASIDE_REACH : 0,
        insetBottom: (registers.machinery.length || registers.tools.length)
            ? ASIDE_REACH + (registers.machinery.length && registers.tools.length ? ASIDE_STACK : 0)
            : 0,
        onOpen: n => openDetail(n)
    });

    // Grouping a spine by heading costs the plan's step order - the
    // headings recur rather than running in sequence - so a banded feature
    // must not go on claiming the steps are in the order they happen.
    featureFlowLabel.textContent = graph.bands.length > 0
        ? "grouped by what each part does"
        : "the order the steps happen";

    renderFeatureAsides(graph, registers, color);
}


// A lane label is 150px wide and sits just left of the steps it labels. It
// used to be pinned to a fixed left edge of the canvas, which on a narrow
// feature left it stranded hundreds of pixels away from the column it was
// describing - and made the gap between them count as content to be centred.
const BAND_GUTTER = 170;

// How far a band of chips reaches beyond the steps: the offset it is drawn
// at, plus its own height. One more ASIDE_STACK when preconditions and
// helpers are both below the spine, because the second sits under the first.
const ASIDE_REACH = 104;
const ASIDE_STACK = 84;

// How far the picture reaches left of the steps. A constant, because the
// furniture now hugs the column rather than sitting wherever the canvas
// happens to start.
function asideInset(graph) {
    return graph.bands.length > 0 ? BAND_GUTTER : 0;
}


// --------------------------------------------------
// WHAT SITS BESIDE THE SPINE
// --------------------------------------------------
// The lane labels, the feature's own terms, and what has to be running
// before any of its steps do. These are in the canvas content rather than
// around it, so they pan and zoom with the steps - they are part of the
// feature's space, not chrome describing it from outside.
//
// Everything here is drawn from nodes that are in the plan already. Nothing
// is invented, and every node the feature holds is in exactly one of the
// spine, the terms, or the preconditions.
// --------------------------------------------------

function renderFeatureAsides(graph, registers, color) {
    const content = document.getElementById("featureContent");

    content.querySelectorAll(".feature-aside, .band-label").forEach(el => el.remove());

    // Each label against ITS OWN cards. Taking the leftmost card in the
    // whole feature put every label at the mercy of the widest row: a
    // measured feature had one lane 20px from its steps and two others 236px
    // away, because a single row of three siblings reached further left.
    for (const band of graph.bands) {
        const label = document.createElement("div");
        label.className = "band-label";
        label.setAttribute("aria-hidden", "true");
        label.dataset.style = `left:${band.minX - BAND_GUTTER}px;top:${band.top - 12}px;height:${band.height + 24}px;--band:${color}`;
        label.innerHTML = `<span class="band-name">${escapeHtml(band.name || "Other")}</span><span class="band-count">${band.count}</span>`;
        paint(label);
        content.appendChild(label);
    }

    const topY = graph.nodes.length ? Math.min(...graph.nodes.map(n => n.y)) : 60;
    const bottomY = graph.nodes.length
        ? Math.max(...graph.nodes.map(n => n.y + (n.h ?? NODE_H_EST)))
        : 60;

    const aside = (title, nodes, y, x, hint) => {
        if (nodes.length === 0) return;

        const el = document.createElement("div");
        el.className = "feature-aside";
        el.dataset.style = `left:${x}px;top:${y}px`;
        el.innerHTML = `<div class="aside-head" title="${escapeHtml(hint)}">${escapeHtml(title)}</div>`
            + `<div class="aside-chips">${nodes.map(node =>
                `<button type="button" class="aside-chip" data-node="${escapeHtml(node.id)}" title="${escapeHtml(node.intent ?? node.title)}">${escapeHtml(node.title)}</button>`
            ).join("")}</div>`;
        paint(el);

        el.querySelectorAll(".aside-chip").forEach(chip => {
            chip.addEventListener("click", event => {
                event.stopPropagation();
                const node = nodes.find(n => n.id === chip.dataset.node);
                if (node) openDetail({ id: node.id, title: node.title, source: node, status: node.status ?? "intended", color });
            });
        });

        content.appendChild(el);
    };

    // Above the spine: the nouns the steps are written in. Aligned with the
    // top row, which is the row it sits next to.
    aside(
        "This feature is about",
        registers.vocabulary,
        topY - 92,
        graph.topRowX,
        "Named lists, tables and constants this feature's steps are written in"
    );

    // Below it: what has to be true before any step runs, then the helpers
    // the steps lean on. Both are preconditions in the reader's mind, which
    // is why they sit under the thing they hold up.
    aside(
        "Runs on",
        registers.machinery,
        bottomY + 44,
        graph.bottomRowX,
        "Start-up, configuration and connections these steps need in place"
    );

    aside(
        "Helpers",
        registers.tools,
        bottomY + 44 + (registers.machinery.length ? 84 : 0),
        graph.bottomRowX,
        "Small shared utilities the steps call"
    );
}

// The perspectives this feature actually has work of its own in. A lens with
// nothing here is not a choice worth offering - it is an empty room with a
// door on the switch - so it is left off entirely rather than shown at zero.
function coveredLenses() {
    return lensCoverage(plan(), currentFeatureId).filter(lens => !lens.empty);
}

function renderLensSwitch() {
    const lenses = coveredLenses();
    const colors = lensColors(plan());

    lensSwitch.innerHTML = lenses.map(lens => `
        <button class="lens-btn${lens.id === currentLensId ? " active" : ""}" data-lens="${escapeHtml(lens.id)}" role="radio" aria-checked="${lens.id === currentLensId}" data-style="--swatch:${colors[lens.id]}" title="${escapeHtml(String(lens.count))} of this feature's steps">
            <span class="swatch"></span>${escapeHtml(lens.label)}<span class="lens-count">${lens.count}</span>
        </button>`).join("");
    paint(lensSwitch);
    lensSwitch.classList.toggle("show", inFeature() && lenses.length > 0);
    renderApprove();
    lensSwitch.querySelectorAll(".lens-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentLensId = btn.dataset.lens;
            renderLensSwitch();
            // Remount whichever level the reader is on. A lens is a way of
            // reading what is in front of you, so it must not quietly
            // rebuild a level they are not looking at.
            remountLevel();
            activeGraph().fitToContent();
            updateHint();
        });
    });
}

// Where the reader is, and every way back. The number of segments IS the
// depth, so the trail states the level without the interface having to
// label it.
function renderBreadcrumb() {
    if (!inFeature()) {
        breadcrumb.innerHTML = '<span class="crumb current">Constellation</span>';
        return;
    }

    const feature = escapeHtml(featureById(currentFeatureId)?.name ?? "");
    const sep = '<span class="crumb-sep">›</span>';

    // The feature segment is a link only when there is an areas level to go
    // back to; in a small feature the steps ARE the feature.
    const hasAreas = level === "steps" && currentAreaName;

    breadcrumb.innerHTML = [
        '<button class="crumb" data-up="top">Constellation</button>',
        sep,
        hasAreas
            ? `<button class="crumb" data-up="areas">${feature}</button>`
            : `<span class="crumb current">${feature}</span>`,
        ...(hasAreas ? [sep, `<span class="crumb current">${escapeHtml(currentAreaName)}</span>`] : [])
    ].join("");

    breadcrumb.querySelectorAll("[data-up]").forEach(crumb => {
        crumb.addEventListener("click", () => crumb.dataset.up === "top" ? exitFeature() : goUp());
    });
}

function updateHint() {
    if (!state || state.setup !== "ready") { statusHint.textContent = ""; return; }

    // Each level answers a different question, and the hint names the one
    // the reader is on: what exists, how this feature is organised, what
    // implements this part.
    if (level === "areas") {
        const shape = buildAreas(plan(), currentFeatureId, state.verifiedStatus);
        const lens = lensById(currentLensId);
        const owned = lens
            ? shape.areas.reduce((total, area) => total + (area.lensCounts?.[lens.id] ?? 0), 0)
            : 0;

        const parts = `${shape.areas.length} ${shape.areas.length === 1 ? "part" : "parts"}, ${shape.total} steps`;

        statusHint.textContent = lens
            ? `${featureById(currentFeatureId)?.name} · ${parts} · ${owned} of them ${lens.label.toLowerCase()} work`
            : `${featureById(currentFeatureId)?.name} · ${parts} · pick one to see what implements it`;
        return;
    }

    if (inFeature()) {
        const lens = lensById(currentLensId);
        const steps = featureGraph.nodes.length;

        const owned = featureGraph.nodes.filter(node => node.owns).length;
        const where = currentAreaName ?? "Feature Space";

        // What the feature holds beside its steps, named rather than
        // counted into them: a reader who sees "14 steps" and finds nine
        // has been told the wrong number, and one who sees nothing about
        // the terms does not know they are there to click.
        const registers = featureRegisters(plan(), currentFeatureId);

        const beside = [
            registers.vocabulary.length && `${registers.vocabulary.length} terms`,
            registers.machinery.length && `${registers.machinery.length} preconditions`,
            registers.tools.length && `${registers.tools.length} helpers`
        ].filter(Boolean).join(", ");

        statusHint.textContent = lens
            ? `${lens.label} · ${LENS_QUESTIONS[lens.id] ?? ""} · all ${steps} steps, ${owned} of them ${lens.label.toLowerCase()} work`
            : `${where} · ${steps} ${steps === 1 ? "step" : "steps"}${beside ? ` · ${beside}` : ""} · scroll to zoom, drag empty space to pan`;
        return;
    }

    {
        const count = plan().features.length;
        statusHint.textContent = `Constellation · ${count} ${count === 1 ? "feature" : "features"} · scroll to zoom, drag empty space to pan`;
    }
}

// ================= ZOOM LEVELS =================
// System -> Feature -> Behaviour -> Code. Each descent is the same move: the
// level you are leaving zooms toward the thing you picked and fades, the
// level you are entering arrives slightly small and settles. That is what
// makes the hierarchy feel like zooming into a map rather than like turning
// pages, and it is why the third level uses the same motion as the second.

const canvasOf = name =>
    name === "steps" ? featureCanvas : name === "areas" ? areasCanvas : constellationCanvas;

const graphOf = name =>
    name === "steps" ? featureGraph : name === "areas" ? areasGraph : constellationGraph;

// The view each level was left at, so coming back up lands where the reader
// was rather than resetting to the top.
const home = {};

function afterMove() {
    renderBreadcrumb(); renderLensSwitch(); updateHint(); renderApprove(); renderAddNode();
}

async function descend(to, focusId) {
    // A key still held while the view changes would go on moving whichever
    // graph is in front when the flight lands.
    stopPanning();
    heldPanKeys.clear();

    const from = level;
    const leaving = graphOf(from);

    home[from] = leaving.view;

    canvasOf(from).classList.add("hidden");
    await leaving.flyTo(leaving.zoomedOnto(focusId, 2.4));

    level = to;
    const entering = graphOf(to);
    const canvas = canvasOf(to);

    canvas.classList.remove("hidden");
    if (to === "areas") mountAreas(); else mountFeature();

    const target = entering.fitView();
    entering.setView(scaledAboutCenter(target, 0.6, canvas.clientWidth, canvas.clientHeight));
    afterMove();
    await entering.flyTo(target);

    leaving.setView(home[from]);
}

async function ascend(to, focusId) {
    stopPanning();
    heldPanKeys.clear();

    const from = level;
    const leaving = graphOf(from);
    const canvas = canvasOf(from);

    canvas.classList.add("hidden");
    await leaving.flyTo(scaledAboutCenter(leaving.view, 0.6, canvas.clientWidth, canvas.clientHeight));

    level = to;
    leaving.clearSelection();

    const entering = graphOf(to);
    if (to === "areas") mountAreas();

    const back = home[to] ?? entering.fitView();
    entering.setView(entering.zoomedOnto(focusId, 2.4));
    canvasOf(to).classList.remove("hidden");
    afterMove();
    await entering.flyTo(back);
}

async function enterFeature(featureId) {
    if (flying || !featureById(featureId)) return;
    flying = true;
    closeDetail();

    currentFeatureId = featureId;
    currentAreaName = null;
    currentLensId = coveredLenses()[0]?.id ?? null;

    // Two levels: the Constellation, and a feature's steps. A middle level
    // of "areas" was tried here and read as a third thing to understand
    // before you could read the first - so a feature opens on its steps.
    await descend("steps", featureId);
    flying = false;
}

async function enterArea(areaId) {
    if (flying || level !== "areas") return;
    flying = true;
    closeDetail();

    // "area:" with nothing after it is the ungrouped card; its steps are the
    // ones the outline never placed, and "" is how they are selected.
    currentAreaName = areaId.slice("area:".length);
    await descend("steps", areaId);
    flying = false;
}

// One step back up, wherever the reader is. Leaving the steps of an area
// returns to the areas; leaving a feature that had no areas returns to the
// Constellation.
async function goUp() {
    if (flying || !inFeature()) return;
    flying = true;
    closeDetail();

    if (level === "steps" && currentAreaName) {
        const area = `area:${currentAreaName}`;
        currentAreaName = null;
        await ascend("areas", area);
    } else {
        const origin = currentFeatureId;
        currentAreaName = null;
        await ascend("constellation", origin);
    }

    flying = false;
}

// All the way out, from wherever: the Constellation crumb is always a way
// back to the top, not only a way back one level.
async function exitFeature() {
    if (flying || !inFeature()) return;

    if (level === "steps" && currentAreaName) {
        await goUp();
    }

    await goUp();
}


// ================= NODE DETAIL =================
// verify --json is not saved to disk, so violations and impact come from the
// last Verify run in this panel.
let lastVerify = null;
let detailNodeId = null;

function section(title, body) {
    return `<div class="impact-section"><div class="h">${title}</div>${body}</div>`;
}

function openDetail(viewNode) {
    const node = viewNode.source;
    const colors = lensColors(plan());
    const lensName = id => lensById(id)?.label ?? id;

    const rules = describeRules(node.rules);
    const history = describeHistory(node.history);

    const statusBody = `<div class="badge-row"><div class="badge"><span class="dot" data-style="${statusDotStyle(viewNode.status, viewNode.color)}"></span>${viewNode.status}</div></div>`;

    const rulesBody = rules.length
        ? rules.map(rule => `<div class="rule-block"><div class="target">${escapeHtml(rule.kind)} · ${escapeHtml(rule.target)}</div>${rule.clauses.map(c => `<div class="clause">${escapeHtml(c)}</div>`).join("") || '<div class="clause">no assertions</div>'}</div>`).join("")
        : "<p>No rules on this node.</p>";

    const approval = node.approvedBy || node.approvedAt
        ? section("Approved", `<p>${escapeHtml(node.approvedBy ?? "unknown")}${node.approvedAt ? ` · ${escapeHtml(node.approvedAt.slice(0, 10))}` : ""}</p>`)
        : "";

    // Every perspective's name for this one step, together, so the reader
    // can see it is the same step said four ways rather than four things.
    const readings = Object.entries(node.readings ?? {});

    const lenses = readings.length
        ? section("Read from other perspectives", readings.map(([id, text]) => `
            <div class="lens-read">
                <div class="badge" data-style="color:${colors[id] ?? "var(--text-mid)"}"><span class="dot" data-style="background:${colors[id] ?? "var(--text-low)"}"></span>${escapeHtml(lensName(id))}</div>
                <p class="lens-says">${escapeHtml(text)}</p>
                ${LENS_QUESTIONS[id] ? `<p class="lens-asks">${escapeHtml(LENS_QUESTIONS[id])}</p>` : ""}
            </div>`).join(""))
        : (node.lensTags ?? []).length
        ? section("Seen through", node.lensTags.map(id => `
            <div class="lens-read">
                <div class="badge" data-style="color:${colors[id] ?? "var(--text-mid)"}"><span class="dot" data-style="background:${colors[id] ?? "var(--text-low)"}"></span>${escapeHtml(lensName(id))}</div>
                ${LENS_QUESTIONS[id] ? `<p class="lens-asks">${escapeHtml(LENS_QUESTIONS[id])}</p>` : ""}
            </div>`).join(""))
        : "";

    // Where a step stands for several declarations, the panel lists every
    // one of them. The merge is only allowed because one assert holds for
    // all of them, so all of them are what the claim is about - showing the
    // first and holding the rest is how an abstraction starts lying.
    const backing = Array.isArray(node.identities) ? node.identities : [];

    // A summary step stands for other STEPS, so the panel lists those
    // rather than a flat run of declarations: each one with its own
    // functions, its own rules and its own evidence, in the order they
    // were folded. Flattening them would leave the reader unable to tell
    // which rule belongs to which of the steps behind the card.
    const covers = coversBlocks(node, state?.facts ?? {});

    const coversBlock = isSummary(node)
        ? section(
            `This step covers · ${covers.length} steps`,
            covers.map(step => `
                <div class="rule-block">
                    <div class="target">${escapeHtml(step.title)}</div>
                    ${step.names.map(name => `<div class="clause">${escapeHtml(name)}</div>`).join("")}
                    ${step.rules.flatMap(rule => rule.clauses).map(clause => `<div class="clause">${escapeHtml(clause)}</div>`).join("")}
                    ${step.evidence.map(line => `<div class="clause reason">${escapeHtml(line)}</div>`).join("")}
                </div>`).join("")
        )
        : "";

    const backingBlock = !isSummary(node) && backing.length > 1
        ? section(
            `What implements this · ${backing.length} declarations`,
            `${node.dimensions?.length ? `<p class="aside-dims">One behaviour, across ${escapeHtml(node.dimensions.join(", "))}.</p>` : ""}`
            + backing.map(identity => `<div class="clause">${escapeHtml(identity)}</div>`).join("")
        )
        : "";

    // The full evidence list, not just the card's first couple of lines -
    // one identity when the node is ordinary, every identity it stands for
    // when it is merged. What the title says WHAT; this says what the code
    // concretely does. A summary step already shows its evidence per
    // covered step above, so it does not repeat the whole list here.
    const evidenceIdentities = isSummary(node)
        ? []
        : backing.length > 1 ? backing : node.identity ? [node.identity] : [];

    const evidenceBlock = evidenceIdentities.length
        ? (() => {
            const allLines = evidenceIdentities.flatMap(identity => evidenceLines(state?.facts?.[identity]));
            return allLines.length
                ? section("Evidence", allLines.map(line => `<div class="clause">${escapeHtml(line)}</div>`).join(""))
                : "";
        })()
        : "";

    // A node that is not a step says so, because it is reached from beside
    // the spine and a reader who clicked a term should not be told it is
    // one of the feature's steps.
    const ROLE_SAYS = {
        vocabulary: "A term this feature's steps are written in, not a step itself.",
        machinery: "A precondition: this has to be running before the steps do.",
        tool: "A shared helper the steps call."
    };

    const roleBlock = ROLE_SAYS[node.role]
        ? section("What this is", `<p>${escapeHtml(ROLE_SAYS[node.role])}</p>`)
        : "";

    const historyBlock = history.length
        ? section("History", history.map(h => `<div class="history-row"><span class="version">${escapeHtml(h.version)}</span><span class="intent">“${escapeHtml(h.intent)}”</span>${h.status ? `<span class="meta">${escapeHtml(h.status)}</span>` : ""}</div>`).join(""))
        : "";

    impactInner.innerHTML = `
        <div class="impact-head"><h3>${escapeHtml(node.title)}</h3><button class="impact-close" id="impactCloseBtn" aria-label="Close detail">✕</button></div>
        <div class="impact-sub">${escapeHtml(node.identity ?? "greenfield · no code yet")}</div>
        ${section("Status", statusBody)}
        ${verifyBlock(node, viewNode.status)}
        ${roleBlock}
        ${section("Intent", `<p>${escapeHtml(node.intent)}</p>`)}
        ${coversBlock}
        ${backingBlock}
        ${evidenceBlock}
        ${section("Rules", rulesBody)}
        ${approval}
        ${lenses}
        ${historyBlock}
        ${section("Decision", actionsBody(node))}`;

    paint(impactInner);
    detailNodeId = node.id;
    impactPanel.classList.add("open");
    document.getElementById("impactCloseBtn").addEventListener("click", closeDetail);
    impactInner.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", () => {
            const action = nodeActions(node).find(candidate => candidate.type === button.dataset.action);
            if (action?.enabled) request("action", action.message);
        });
    });
}

function closeDetail() { detailNodeId = null; impactPanel.classList.remove("open"); }

// Why a node drifted or errored, and what else it touches.
function verifyBlock(node, status) {
    const result = verifyResultFor(lastVerify, node);

    if (!result) {
        return status === "drifted" || status === "error"
            ? section("Why", "<p>Run Verify against code to see what changed.</p>")
            : "";
    }

    const violations = (result.violations ?? []).map(
        violation => describeViolation(violation, node));
    const errors = (result.errors ?? []).map(error => error?.message ?? String(error));
    const unsupported = (result.unsupported ?? []).map(item => item?.reason ?? JSON.stringify(item));
    const impact = (result.impact ?? []).map(describeImpact);

    return [
        violations.length ? section("Why it drifted", violations.map(v => `<div class="rule-block"><div class="target">${escapeHtml(v.covers ? `${v.covers} · ${v.field}` : v.field)}</div><div class="clause">expected ${escapeHtml(v.expected)}</div><div class="clause">actual ${escapeHtml(v.actual)}</div>${v.reason ? `<div class="clause reason">${escapeHtml(v.reason)}</div>` : ""}</div>`).join("")) : "",
        errors.length ? section("Errors", errors.map(message => `<div class="drift-callout">${escapeHtml(message)}</div>`).join("")) : "",
        unsupported.length ? section("Not checked", unsupported.map(message => `<p>${escapeHtml(message)}</p>`).join("")) : "",
        impact.length ? section("Impact", impact.map(entry => `<div class="file-chip">${escapeHtml(entry.identity)}<span class="range">${escapeHtml(entry.meta)}</span></div>`).join("")) : "",
        result.status === "implemented" && !violations.length && !errors.length ? section("Verify", "<p>Matches the code as of the last Verify run.</p>") : ""
    ].join("");
}

// Approve, revise and reject run the CLI. Unavailable actions stay visible
// with the reason in their tooltip.
function actionsBody(node) {
    const buttons = nodeActions(node).map(action =>
        `<button class="icon-btn${action.tone === "danger" ? " danger" : ""}${action.enabled ? "" : " inert"}" data-action="${action.type}"${action.enabled ? "" : ' aria-disabled="true"'} title="${escapeHtml(action.enabled ? action.hint : action.reason)}">${escapeHtml(action.label)}</button>`
    ).join("");
    return `<div class="detail-actions">${buttons}</div><p class="detail-note">Revise opens a new intended version. Edit its intent or rules in <code>.planmap/plan.json</code>, then approve it.</p>`;
}


// ================= NOTICES =================
// One banner over the Plan Graph canvas: the verify prompt (onboarding C) or
// the outcome of the last verify run.
const compileBanner = document.getElementById("compileBanner");
const verifyBtn = document.getElementById("verifyBtn");
let noticeKind = null;
let verifyPromptDismissed = false;

function renderBanner(el, { tone = "", title, body = "", action = null, progress = null }, onClose) {
    el.className = `compile-banner show${tone ? ` ${tone}` : ""}`;
    el.innerHTML = `
        <div class="cb-head">${escapeHtml(title)}<button class="cb-close" aria-label="Dismiss">✕</button></div>
        ${body ? `<div class="cb-sub">${escapeHtml(body)}</div>` : ""}
        ${progress ? progressBlock(progress) : ""}
        ${action ? `<div class="cb-actions"><button class="icon-btn cb-action">${escapeHtml(action.label)}</button></div>` : ""}`;
    paint(el);
    el.querySelector(".cb-close").addEventListener("click", onClose);
    if (action) el.querySelector(".cb-action").addEventListener("click", action.run);
}

function hideBanner(el) {
    el.className = "compile-banner";
    el.innerHTML = "";
}

function showNotice(kind, options) {
    noticeKind = kind;
    renderBanner(compileBanner, options, () => {
        if (noticeKind === "verify-prompt") verifyPromptDismissed = true;
        hideNotice();
    });
}

function hideNotice() {
    noticeKind = null;
    hideBanner(compileBanner);
}

function renderVerifyPrompt(show) {
    if (show && !verifyPromptDismissed && noticeKind === null) {
        showNotice("verify-prompt", {
            title: "This plan hasn't been checked against your code yet",
            body: "Verify compares each approved node with what the code does now.",
            action: { label: "Verify against code", run: runVerify }
        });
    } else if (!show && noticeKind === "verify-prompt") {
        hideNotice();
    }
}


// ================= CLI REQUESTS =================
// The webview only asks. The host runs the CLI, and the watcher re-reads
// .planmap/. "scan" is init followed by an offline evolution run.
const busy = new Set();
const problems = {};
// What the CLI has printed for each running request, newest last.
const logs = {};
const MAX_LOG_LINES = 400;

function progressKey(requestType) {
    if (requestType === "verify") return "verify";
    if (requestType === "draftPlan") return "draftPlan";
    if (requestType === "init" || requestType === "evolution") return busy.has("refresh") ? "refresh" : "scan";
    return "action";
}

function onProgress(message) {
    const key = progressKey(message.requestType);
    const lines = logs[key] ?? (logs[key] = []);

    lines.push(message.line);
    if (lines.length > MAX_LOG_LINES) lines.splice(0, lines.length - MAX_LOG_LINES);

    if (key === "scan" || key === "draftPlan") renderEmpty();
    else if (key === "refresh") renderBanner(evoNotice, { title: "Refreshing Project Evolution", progress: key }, () => hideBanner(evoNotice));
    else if (key === "verify") showNotice("verify-running", { title: "Verifying against code", progress: key });
}

// A bar the CLI's own output drives, with the last lines of it underneath.
function progressBlock(key) {
    const lines = logs[key] ?? [];
    const progress = parseScanProgress(lines);
    const indeterminate = progress.percent === null;

    return `
        <div class="progress">
          <div class="progress-bar${indeterminate ? " indeterminate" : ""}"><span${indeterminate ? "" : ` data-style="width:${progress.percent}%"`}></span></div>
          <div class="progress-label">${escapeHtml(progress.label)}${indeterminate || progress.finished ? "" : ` · ${progress.percent}%`}</div>
          <pre class="progress-log">${escapeHtml(lines.slice(-8).join("\n"))}</pre>
        </div>`;
}

function cliMessage(result) {
    const text = String(result.json?.message ?? "").trim() || String(result.stderr ?? "").trim() || String(result.stdout ?? "").trim();
    return text || `The command stopped with exit code ${result.code}.`;
}

function request(key, message) {
    if (busy.has(key)) return;
    busy.add(key);
    delete problems[key];
    logs[key] = [];
    vscode.postMessage(message);
    refreshRequests();
}

function finish(key, problem) {
    busy.delete(key);
    if (problem) problems[key] = problem; else delete problems[key];
    refreshRequests();
}

function refreshRequests() {
    if (state) renderEmpty();
    const verifying = busy.has("verify");
    verifyBtn.disabled = verifying;
    verifyBtn.classList.toggle("loading", verifying);
    verifyBtn.textContent = verifying ? "Verifying…" : "Verify against code";

    const refreshing = busy.has("refresh");
    evoRefreshBtn.disabled = refreshing || busy.has("scan");
    evoRefreshBtn.textContent = refreshing ? "Refreshing…" : "Refresh evolution";

    impactInner.querySelectorAll("[data-action]").forEach(button => button.classList.toggle("loading", busy.has("action")));
    renderApprove();
}

// One button, two jobs, decided by where you are: the whole plan on the
// Constellation, the perspective you are reading inside a feature. The label
// comes from the lens object, never a hard-coded name, so a project that
// renames its lenses renames the button too.
function approveTarget() {
    if (state?.setup !== "ready") return null;

    const nodes = plan()?.nodes ?? [];
    const lens = inFeature() ? lensById(currentLensId) : null;

    if (lens) {
        const pending = nodes.filter(node =>
            node.status === "intended" && (node.lensTags ?? []).includes(lens.id)
        ).length;

        return {
            label: `Approve ${lens.label}`,
            pending,
            message: { type: "approveLens", lensId: lens.id },
            reason: `Every ${lens.label.toLowerCase()} step is already approved`,
            hint: `Approve all ${pending} intended ${lens.label} ${pending === 1 ? "step" : "steps"}, in every feature`
        };
    }

    const pending = nodes.filter(node => node.status === "intended").length;

    return {
        label: "Approve plan",
        pending,
        message: { type: "approveAll" },
        reason: "Every step in the plan is already approved",
        hint: `Approve all ${pending} intended ${pending === 1 ? "step" : "steps"} in the plan`
    };
}

function renderApprove() {
    const target = approveTarget();

    approveBtn.hidden = !target;
    if (!target) return;

    approveBtn.textContent = busy.has("action") ? "Approving…" : target.label;
    approveBtn.classList.toggle("inert", target.pending === 0);
    approveBtn.title = target.pending === 0 ? target.reason : target.hint;
}

function runVerify() {
    request("verify", { type: "verify" });
}

function onCliResult(result) {
    switch (result.requestType) {
        case "init":
            if (result.outcome === "ok") vscode.postMessage({ type: "evolution" });
            else finish("scan", { tone: "problem", text: cliMessage(result) });
            break;
        case "evolution":
            if (busy.has("refresh")) {
                finish("refresh", null);
                showEvolutionResult(result);
            } else {
                // Exit 1 means some AI batches fell back to path labels; the scan still finished.
                finish("scan", result.outcome === "ok" ? null : { tone: result.outcome === "findings" ? "note" : "problem", text: cliMessage(result) });
            }
            break;
        case "approve":
        case "approveAll":
        case "approveLens":
        case "addNode":
        case "renameNode":
        case "moveNode":
        case "reorderNode":
        case "reject":
        case "revise":
            finish("action", null);
            showActionResult(result);
            break;
        case "draftPlan":
            // Exit 2 (no key, no evolution history) is a message to read, not a crash.
            finish("draftPlan", result.outcome === "ok" ? null : { tone: result.outcome === "nothing" ? "note" : "problem", text: cliMessage(result) });
            break;
        case "verify":
            if (Array.isArray(result.json?.results)) lastVerify = result.json;
            finish("verify", null);
            showVerifyResult(result);
            break;
    }
}

function onCancelled(message) {
    if (["approve", "approveAll", "approveLens", "reject", "revise", "addNode", "renameNode", "moveNode", "reorderNode"].includes(message.requestType)) finish("action", null);
}

const ACTION_DONE = { approve: "Approved", approveAll: "Approved", approveLens: "Approved", reject: "Rejected", revise: "Revised", addNode: "Step added", renameNode: "Renamed", moveNode: "Moved", reorderNode: "Reordered" };
const ACTION_FAILED = { approve: "Couldn't approve", approveAll: "Some steps couldn't be approved", approveLens: "Some steps couldn't be approved", reject: "Couldn't reject", revise: "Couldn't revise", addNode: "Couldn't add the step", renameNode: "Couldn't rename", moveNode: "Couldn't save the position", reorderNode: "Couldn't reorder" };

// Authoring shows itself: the step moves, the title changes, the new step
// appears. A banner saying "Moved" is a second telling of something you just
// watched happen, so these report only when they fail.
const QUIET_ACTIONS = ["moveNode", "renameNode", "reorderNode", "addNode"];

function showActionResult(result) {
    if (result.outcome === "ok" && QUIET_ACTIONS.includes(result.requestType)) return;

    const output = [String(result.stdout ?? "").trim(), String(result.stderr ?? "").trim()].filter(Boolean).join("\n");

    if (result.outcome === "ok") {
        showNotice("action-result", {
            title: ACTION_DONE[result.requestType],
            body: result.requestType === "revise"
                ? "It is now a new intended version. Edit its intent or rules in .planmap/plan.json, then approve it."
                : output
        });
    } else if (result.outcome === "nothing") {
        showNotice("action-result", { title: result.requestType === "revise" ? "Nothing to revise" : "Nothing to approve", body: output });
    } else {
        showNotice("action-result", { tone: "danger", title: ACTION_FAILED[result.requestType], body: output || cliMessage(result) });
    }
}

// Refresh re-derives evolution from the code. The CLI resets verify statuses
// when it does, so drift returns after the next Verify.
// What the scan found in the code, in a sentence. A refresh that changes
// nothing has to say so out loud - silence is indistinguishable from a
// refresh that is broken, which is exactly how this looked before.
function describeScan(scan) {
    if (!scan) return "";
    if (scan.changes === 0) return "No code changes since the last scan.";

    const parts = [
        scan.added ? `${scan.added} new` : "",
        scan.changed ? `${scan.changed} changed` : "",
        scan.deleted ? `${scan.deleted} removed` : ""
    ].filter(Boolean);

    const what = scan.changes === 1 ? "1 declaration" : `${scan.changes} declarations`;

    return parts.length ? `${what}: ${parts.join(", ")}.` : `${what}.`;
}

function showEvolutionResult(result) {
    const summary = String(result.stdout ?? "").split("\n").filter(line => /classification|LLM classifications/.test(line)).join("\n");
    const reverify = state?.plan ? "Verify again to bring drift back onto the map." : "";
    const found = describeScan(state?.scan);

    // Nothing moved, so nothing in the outline could move either. Said
    // plainly, with the reason, because "PlanMap tracks functions" is the
    // part that is never obvious from an unchanged screen.
    const quiet = state?.scan && state.scan.changes === 0;

    const options = result.outcome === "ok"
        ? quiet
            ? {
                title: "No changes found",
                body: [
                    "The code has not moved since the last scan, so the outline is unchanged.",
                    "PlanMap follows functions and methods. Edits to anything else - route wiring, config, markup, comments - leave no declaration to record."
                ].join("\n")
            }
            : { title: "Evolution refreshed", body: [found, summary, reverify].filter(Boolean).join("\n") }
        : result.outcome === "findings"
            ? { title: "Evolution refreshed, partly without AI", body: [found, summary, "Some batches kept path labels.", cliMessage(result), reverify].filter(Boolean).join("\n") }
            : { tone: "danger", title: "Evolution didn't refresh", body: cliMessage(result) };

    renderBanner(evoNotice, options, () => hideBanner(evoNotice));
}

// Exit 1 is a successful run that found drift, never an error.
function showVerifyResult(result) {
    const summary = result.json?.summary ?? {};
    const unrecorded = state?.evolution ? "" : "\nThere is no evolution history, so the result isn't shown on the map. Scan the project first.";

    if (result.outcome === "ok") {
        const checked = result.json?.results?.length ?? 0;
        showNotice("verify-result", { title: "Nothing drifted", body: `${checked} approved ${checked === 1 ? "node" : "nodes"} checked against the code.${unrecorded}` });
    } else if (result.outcome === "findings") {
        const drifted = summary.drifted ?? 0;
        const errors = summary.errors ?? 0;
        const found = [drifted ? `${drifted} drifted` : "", errors ? `${errors} ${errors === 1 ? "error" : "errors"}` : ""].filter(Boolean).join(", ");
        showNotice("verify-result", { tone: "danger", title: `Verify found ${found || "problems"}`, body: `Drifted nodes pulse red here and show ⚠ in Project Evolution.${unrecorded}` });
    } else if (result.outcome === "nothing") {
        showNotice("verify-result", { title: "Nothing to verify yet", body: cliMessage(result) });
    } else {
        showNotice("verify-result", { tone: "danger", title: "Verify didn't run", body: cliMessage(result) });
    }
}


// ================= ONBOARDING =================
// A: no .planmap/.  B: scanned, no plan.json.  C: a plan nothing has verified yet.
function problemBlock(key) {
    const problem = problems[key];
    return problem ? `<div class="${problem.tone === "note" ? "note" : "problem"}">${escapeHtml(problem.text)}</div>` : "";
}

function renderEmpty() {
    const onboarding = busy.has("scan") ? { kind: "scan" } : onboardingState(state);
    const blocking = Boolean(onboarding) && onboarding.kind !== "verify";

    emptyState.hidden = !blocking;
    // Zoom, compile and legend only mean something once there is a plan to show.
    document.querySelector(".planmap-root").classList.toggle("not-ready", blocking);
    renderVerifyPrompt(onboarding?.kind === "verify");
    if (!blocking) return;

    const withAi = Boolean(state?.aiKey);
    const local = state?.aiKey === "local";
    const aiSource = local ? "your local model" : "your OpenRouter key";
    const addKey = withAi ? "" : '<button class="link-btn" id="addKeyBtn">Add an OpenRouter key</button>';

    if (onboarding.kind === "scan") {
        const scanning = busy.has("scan");
        emptyCard.innerHTML = `
            <h2>PlanMap isn't set up yet</h2>
            <p>Scan this project to learn what your code currently does.</p>
            <button class="primary-btn" id="scanBtn"${scanning ? " disabled" : ""}>${scanning ? "Scanning…" : "Scan project"}</button>
            ${scanning ? progressBlock("scan") : `<p class="fine">${!withAi ? "Takes ~10s · nothing leaves your machine" : local ? "Groups your code into features with your local model · nothing leaves your machine" : "Groups your code into features with your OpenRouter key · can take a minute"}</p>`}
            ${scanning ? "" : addKey}
            ${scanning ? "" : '<button class="link-btn" id="otherFolderBtn">Open a different folder</button>'}
            ${problemBlock("scan")}`;
        document.getElementById("scanBtn").addEventListener("click", () => request("scan", { type: "init" }));
    } else if (onboarding.kind === "no-plan") {
        const count = onboarding.declarations;
        const found = count === null ? "This project has been scanned" : `${count} ${count === 1 ? "declaration" : "declarations"} found`;
        const drafting = busy.has("draftPlan");
        emptyCard.innerHTML = `
            <h2>${escapeHtml(found)}, no plan yet.</h2>
            <div class="choices">
              <button class="choice" id="draftPlanBtn"${drafting ? " disabled" : ""}><span class="choice-label">${drafting ? "Drafting a plan…" : "Draft a plan with AI"}</span><span class="choice-note">${withAi ? `uses ${aiSource}` : "needs OPENROUTER_API_KEY"}</span></button>
              <button class="choice recommended" id="writeRuleBtn"><span class="choice-label">Write one rule myself</span><span class="choice-note">no key needed</span></button>
            </div>
            ${drafting ? progressBlock("draftPlan") : addKey}
            ${problemBlock("scan")}
            ${problemBlock("draftPlan")}`;
        document.getElementById("draftPlanBtn").addEventListener("click", () => request("draftPlan", { type: "draftPlan" }));
        document.getElementById("writeRuleBtn").addEventListener("click", () => vscode.postMessage({ type: "openPlan" }));
    }
    document.getElementById("addKeyBtn")?.addEventListener("click", () => vscode.postMessage({ type: "setApiKey" }));
    document.getElementById("otherFolderBtn")?.addEventListener("click", () => vscode.postMessage({ type: "openFolder" }));

    if (onboarding.kind === "invalid-plan") {
        emptyCard.innerHTML = `<h2>This plan can't be shown</h2><p>Fix <code>.planmap/plan.json</code> and the map will reload.</p><div class="problem">${escapeHtml(onboarding.problem)}</div>`;
    }
}


// ================= NAV RAIL =================
// Plan Graph and Project Evolution, one active at a time. The badge counts
// drifted identities from the last verify run.
let activeView = "planmap";
let pendingFit = false;
const views = { planmap: document.getElementById("viewPlanmap"), evolution: document.getElementById("viewEvolution") };
const railButtons = [...document.querySelectorAll(".nav-icon-btn[data-nav]")];
const driftBadge = document.getElementById("driftBadge");

function renderRail() {
    const rail = railModel(activeView, state?.verifiedStatus);
    activeView = rail.active;

    for (const button of railButtons) {
        const on = button.dataset.nav === rail.active;
        button.classList.toggle("active", on);
        button.setAttribute("aria-checked", String(on));
        button.tabIndex = on ? 0 : -1;
    }

    for (const [id, view] of Object.entries(views)) view.classList.toggle("hidden", id !== rail.active);

    const folderLabel = state?.projectName ? `Project: ${state.projectName}. Open another folder` : "Open another project folder";
    openFolderBtn.title = folderLabel;
    openFolderBtn.setAttribute("aria-label", folderLabel);

    // Drift is the alarm and keeps the badge. Changes waiting to be folded
    // in are news, not a problem, so they only show when nothing has drifted.
    const waiting = state?.pendingScan ? state.scan?.changes ?? 0 : 0;
    const badge = rail.badge ?? (waiting > 0 ? { count: waiting, label: `${waiting} unscanned` } : null);

    driftBadge.hidden = !badge;
    driftBadge.textContent = badge ? String(badge.count) : "";
    driftBadge.classList.toggle("waiting", !rail.badge && waiting > 0);
    if (badge) driftBadge.title = badge.label;
    const evolutionButton = railButtons.find(button => button.dataset.nav === "evolution");
    evolutionButton.setAttribute("aria-label", rail.badge ? `Project Evolution, ${rail.badge.label}` : "Project Evolution");
    evolutionButton.title = rail.badge ? `Project Evolution · ${rail.badge.label}` : "Project Evolution";

    // A canvas measured while hidden has no size; fit it once it is visible.
    if (rail.active === "planmap" && pendingFit) {
        pendingFit = false;
        activeGraph().fitToContent();
    }
}

function setMainView(id) {
    activeView = id;
    renderRail();
    // The change notice lives in whichever view is on screen, so it moves
    // with you rather than waiting in the one you just left.
    renderPendingScan();
}

railButtons.forEach(button => {
    button.addEventListener("click", () => setMainView(button.dataset.nav));
    button.addEventListener("keydown", event => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = railButtons[(railButtons.indexOf(button) + step + railButtons.length) % railButtons.length];
        setMainView(next.dataset.nav);
        next.focus();
    });
});

// Like File > Open Folder: VS Code reopens on the chosen folder and PlanMap starts there.
const openFolderBtn = document.getElementById("openFolderBtn");
openFolderBtn.addEventListener("click", () => vscode.postMessage({ type: "openFolder" }));

const approveBtn = document.getElementById("approveBtn");
const scanChip = document.getElementById("scanChip");
const scanChipText = document.getElementById("scanChipText");
const evoScanChip = document.getElementById("evoScanChip");
const evoScanChipText = document.getElementById("evoScanChipText");

// Clicking the chip does the thing it is telling you about.
for (const chip of [scanChip, evoScanChip]) {
    chip.addEventListener("click", () => request("refresh", { type: "evolution" }));
}
const evoRefreshBtn = document.getElementById("evoRefreshBtn");
const evoNotice = document.getElementById("evoNotice");

// Adding a step belongs to the feature you are inside: on the Constellation
// there is no journey to add it to.
const addNodeBtn = document.getElementById("addNodeBtn");

addNodeBtn.addEventListener("click", () => {
    if (addNodeBtn.classList.contains("inert")) return;

    const feature = featureById(currentFeatureId);
    if (!feature) return;

    // The step is created named, then opened for renaming: a blank step on
    // the canvas is harder to correct than a placeholder you retitle.
    request("action", { type: "addNode", feature: feature.id, title: "New step" });
});

function renderAddNode() {
    const can = inFeature() && state?.setup === "ready";
    addNodeBtn.classList.toggle("inert", !can);
    addNodeBtn.title = can
        ? `Add a step to ${featureById(currentFeatureId)?.name ?? "this feature"}`
        : "Open a feature to add a step to it";
}

approveBtn.addEventListener("click", () => {
    const target = approveTarget();
    if (target && target.pending > 0) request("action", target.message);
});
// The only message the Evolution view's toolbar sends: re-derive it from the code.
evoRefreshBtn.addEventListener("click", () => request("refresh", { type: "evolution" }));

const evolutionView = createEvolutionView({
    title: document.getElementById("evoTitle"),
    tagSwitch: document.getElementById("tagSwitch"),
    tree: document.getElementById("evoTreePanel"),
    emptyState: document.getElementById("evoEmptyState"),
    emptyCard: document.getElementById("evoEmptyCard"),
    detailPanel: document.getElementById("evoDetailPanel"),
    detailInner: document.getElementById("evoDetailInner"),
    hint: document.getElementById("evoHint")
});


// ================= WIRING =================
// The code has moved and the outline has not. Said where the outline is,
// with the button that fixes it, and it stays on screen until it is acted
// on: a change you have to go looking for is a change you will miss.
// What the scan found, as a chip beside the title in whichever view you are
// looking at. It used to be a banner across the graph, which is a lot of
// furniture for "one declaration changed" - and it rendered only into
// Project Evolution, so a change made while reading the Plan Graph announced
// itself into a hidden view and looked like detection being broken.
function renderPendingScan() {
    const chips = [
        [scanChip, scanChipText],
        [evoScanChip, evoScanChipText]
    ];

    const scan = state?.pendingScan ? state.scan : null;

    if (!scan || scan.changes === 0) {
        for (const [chip] of chips) chip.hidden = true;
        return;
    }

    // Only significant changes reach here - the CLI has already decided what
    // counts - so the wording says so rather than implying every keystroke.
    const count = scan.significant || scan.changes;
    const text = `${count} significant ${count === 1 ? "change" : "changes"}`;

    for (const [chip, label] of chips) {
        chip.hidden = false;
        label.textContent = text;
    }
}

function applyState(next) {
    state = next;
    renderEmpty();
    evolutionView.setData(state.evolution, state.projectName, state.arrivals);
    renderRail();
    renderPendingScan();
    if (state.setup !== "ready") { updateHint(); return; }

    // A redraft can take the feature the reader is standing in, or the area
    // - the outline regroups as the code moves. Either way they are put back
    // at the deepest level that still exists rather than left looking at a
    // view of nothing.
    if (inFeature() && !featureById(currentFeatureId)) {
        level = "constellation";
        currentAreaName = null;
        featureCanvas.classList.add("hidden");
        areasCanvas.classList.add("hidden");
        constellationCanvas.classList.remove("hidden");
        closeDetail();
    }

    if (level === "steps" && currentAreaName) {
        const shape = buildAreas(plan(), currentFeatureId, state.verifiedStatus);
        const stillThere = shape.mode === "areas"
            && shape.areas.some(area => area.name === currentAreaName);

        if (!stillThere) {
            currentAreaName = null;
            if (shape.mode === "areas") {
                level = "areas";
                featureCanvas.classList.add("hidden");
                areasCanvas.classList.remove("hidden");
                closeDetail();
            }
        }
    }
    if (currentLensId && !lensById(currentLensId)) currentLensId = plan().lenses[0]?.id ?? null;
    if (inFeature() && currentLensId && !coveredLenses().some(lens => lens.id === currentLensId)) {
        currentLensId = coveredLenses()[0]?.id ?? null;
    }

    const firstMount = constellationGraph.nodes.length === 0;
    mountConstellation();
    if (firstMount) {
        if (activeView === "planmap") constellationGraph.fitToContent(); else pendingFit = true;
    }
    remountLevel();

    // An approve, revise or reject re-reads the plan: follow the node (a revise
    // gives it a new id that supersedes the old one), or close if it is gone.
    if (detailNodeId && impactPanel.classList.contains("open")) {
        const same = inFeature() && featureGraph.nodes.find(n => n.id === detailNodeId || n.source.supersedes === detailNodeId);
        if (same) openDetail(same); else closeDetail();
    }

    renderBreadcrumb(); renderLensSwitch(); updateHint(); renderApprove(); renderAddNode(); syncZoomLabel();
}

document.getElementById("zoomInBtn").addEventListener("click", () => activeGraph().zoomIn());
document.getElementById("zoomOutBtn").addEventListener("click", () => activeGraph().zoomOut());
document.getElementById("zoomResetBtn").addEventListener("click", () => activeGraph().fitToContent());
verifyBtn.addEventListener("click", runVerify);
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (activeView === "evolution") { evolutionView.closeDetail(); return; }
    if (impactPanel.classList.contains("open")) closeDetail(); else if (inFeature()) goUp();
});


// --------------------------------------------------
// WALKING THE MAP WITH THE ARROW KEYS
// --------------------------------------------------
// The map opens at full size and is usually taller than the canvas, so
// reaching the rest of it had to mean finding empty space and dragging.
// Arrow keys move the map itself; shift moves it a screenful at a time.
//
// Anything already handling the key keeps it - a row being retitled, a rail
// radio, the evolution tree - so this only ever fires on the canvas.
// --------------------------------------------------

// Below this the glide has effectively stopped, and continuing to schedule
// frames for it would keep a repaint alive for motion nobody can see.
const PAN_REST = 2;

// One discrete nudge, for a reader who has asked for reduced motion. They
// still get to walk the map; they just get there without the easing.
const PAN_STEP = 140;

const heldPanKeys = new Set();
let panVX = 0;
let panVY = 0;
let panFrameId = null;
let panLastTime = 0;
let panFast = false;

// The frame loop. The easing itself is panVelocity, in model.js; this runs
// it against real elapsed time and stops once the glide has settled.
function panFrame(now) {
    const dt = panLastTime ? Math.min(0.05, (now - panLastTime) / 1000) : 1 / 60;
    panLastTime = now;

    const direction = panDirection(heldPanKeys);
    const speed = PAN_SPEED * (panFast ? PAN_FAST : 1);

    panVX = panVelocity(panVX, direction.x * speed, dt);
    panVY = panVelocity(panVY, direction.y * speed, dt);

    if (heldPanKeys.size === 0 && Math.hypot(panVX, panVY) < PAN_REST) {
        stopPanning();
        return;
    }

    activeGraph().panBy(panVX * dt, panVY * dt);
    panFrameId = requestAnimationFrame(panFrame);
}

function startPanning() {
    if (panFrameId !== null) return;
    panLastTime = 0;
    panFrameId = requestAnimationFrame(panFrame);
}

function stopPanning() {
    if (panFrameId !== null) cancelAnimationFrame(panFrameId);
    panFrameId = null;
    panVX = 0;
    panVY = 0;
    panLastTime = 0;
}

function panKeyAllowed(event) {
    if (!PAN_DIRECTIONS[event.key] || event.defaultPrevented) return false;
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    if (activeView !== "planmap") return false;

    // A fly-in is animating the same transform. Two things moving one
    // property is a fight, and the flight is the one the reader asked for.
    if (flying) return false;

    // Typing beats panning: a step being renamed owns its arrow keys, and so
    // does any field the interface grows later.
    const target = event.target;
    return !(target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? ""));
}

document.addEventListener("keydown", event => {
    if (!panKeyAllowed(event)) return;

    event.preventDefault();

    if (reducedMotion.matches) {
        const [x, y] = PAN_DIRECTIONS[event.key];
        const distance = PAN_STEP * (event.shiftKey ? 3 : 1);
        activeGraph().panBy(x * distance, y * distance);
        return;
    }

    panFast = event.shiftKey;

    // The operating system's own key repeat is ignored: holding a key is one
    // continuous press here, and the frame loop supplies the movement.
    if (event.repeat) return;

    heldPanKeys.add(event.key);
    startPanning();
});

document.addEventListener("keyup", event => {
    if (!PAN_DIRECTIONS[event.key]) return;
    heldPanKeys.delete(event.key);
    if (heldPanKeys.size === 0) panFast = false;
});

// A key held while the webview loses focus never sends its keyup, and the map
// would drift on forever.
window.addEventListener("blur", () => {
    heldPanKeys.clear();
    panFast = false;
});

window.addEventListener("message", event => {
    const message = event.data;
    if (message?.type === "state") applyState(message.state);
    if (message?.type === "cliResult") onCliResult(message);
    if (message?.type === "progress") onProgress(message);
    if (message?.type === "cancelled") onCancelled(message);
});

vscode.postMessage({ type: "ready" });

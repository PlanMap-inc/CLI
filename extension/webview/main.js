import {
    areaOf,
    approveScope,
    buildConstellation,
    buildSpine,
    callArcs,
    callsChips,
    CARD_METRICS,
    CARD_W,
    clampScale,
    colorAt,
    constellationEdges,
    coversBlocks,
    describeHistory,
    describeImpact,
    describeRules,
    describeViolation,
    escapeHtml,
    evidenceLines,
    featureRegisters,
    findSteps,
    followDetail,
    hasToolbar,
    isSelectable,
    isSummary,
    lensColors,
    lensCoverage,
    lensName,
    LENS_QUESTIONS,
    FEATURE_PALETTE,
    MIN_SCALE,
    nextDrift,
    nodeSub,
    nodeActions,
    onboardingState,
    orderedSteps,
    panAxis,
    panDirection,
    panVelocity,
    PAN_DIRECTIONS,
    PAN_FAST,
    PAN_SPEED,
    parseScanProgress,
    railModel,
    rowHeight,
    toolbarLayout,
    ROW_H,
    STEP_H,
    statusClass,
    statusDotStyle,
    STATUSES,
    verifyResultFor,
    wheelAction
} from "./model.js";
import { createEvolutionView } from "./evolution-view.js";
import { paint } from "./paint.js";

// The webview has no filesystem access. It renders the state the host
// posts, and asks the host for anything that has to touch .planmap/.
const vscode = acquireVsCodeApi();

// --------------------------------------------------
// THE CARD'S OWN NUMBERS, HANDED TO THE STYLESHEET
// --------------------------------------------------
// They used to be written twice - once here for the layout and once in
// styles.css for the rendering - and the two disagreed, so the rows
// inside a 118px card were squeezed to 11px and 4px and their text was
// drawn on top of each other.
//
// model.js owns them now. They are set on the document as custom
// properties, and styles.css reads them from there, so there is one set
// of numbers and nothing to keep in step by hand. CSP governs markup, not
// the CSSOM, so this lands where a style attribute would not.
// --------------------------------------------------

for (const [name, value] of Object.entries(CARD_METRICS)) {
    document.documentElement.style.setProperty(name, `${value}px`);
}

// How far right of the column a call arc bows. Far enough that it reads as
// a detour rather than a line through the cards.
const ARC_GUTTER = 92;
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

function createGraph(canvasEl, gridEl, contentEl, opts) {
    // Every card is the same width; a step card and a fold row differ only
    // in height, and each item carries its own.
    const heightOf = node => node?.h ?? STEP_H;

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

    // --------------------------------------------------
    // ONE CARD, ONE SHAPE
    // --------------------------------------------------
    // A number, a title, the code it is a claim about, one detail line,
    // its lenses and its status. The preview, the backing line and the
    // evidence block are gone: they turned a column of steps into a column
    // of inspectors, and the panel is where the detail belongs.
    // --------------------------------------------------

    function stepCard(n) {
        const colors = lensColors(plan());

        const detail = n.detail
            ? (n.detail.kind === "reading"
                ? `<span class="node-lens" data-style="background:${colors[n.detail.lens] ?? "var(--text-low)"}"></span>`
                : "") + escapeHtml(n.detail.text)
            : "";

        // The lens dots, the calls chip and the status pill share one row.
        // Stacking them is what pushed the rows above into each other.
        const chips = (n.chips ?? [])
            .map(chip => `<span class="calls-chip ${chip.kind}">${escapeHtml(chip.text)}</span>`)
            .join("");

        return `
            <div class="handle top"></div>
            <div class="bar" data-style="background:${n.color || dotColor}"></div>
            ${n.number ? `<div class="step">${escapeHtml(n.number)}</div>` : ""}
            <div class="title" title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</div>
            <div class="sub" title="${escapeHtml(n.identity ?? n.sub ?? "")}">${escapeHtml(n.sub ?? "")}</div>
            <div class="node-detail${n.detail?.kind === "reading" ? " reading" : ""}" title="${escapeHtml(n.detail?.text ?? "")}">${detail}</div>
            <div class="node-foot">
                ${n.lenses?.length ? `<span class="node-lenses">${n.lenses.map(id => `<span class="node-lens" data-style="background:${colors[id] ?? "var(--text-low)"}"></span>`).join("")}</span>` : ""}
                ${chips}
                <span class="status-pill"><span class="dot" data-style="${statusDotStyle(n.status, n.color || dotColor)}"></span>${escapeHtml(n.status ?? "")}</span>
            </div>
            <div class="handle bottom"></div>`;
    }

    function featureCard(n) {
        const colors = lensColors(plan());

        const state = n.failing > 0
            ? `${n.failing} of ${n.count} ${n.status}`
            : n.status;

        // Always three preview rows: a feature with fewer steps keeps the
        // same card, with the spare rows empty rather than collapsed.
        const preview = Array.from({ length: 3 }, (_, at) => n.preview?.[at])
            .map(entry => `<div class="preview-step">${entry ? escapeHtml(entry.title) : ""}</div>`)
            .join("");

        return `
            <div class="bar" data-style="background:${n.color || dotColor}"></div>
            ${n.step ? `<div class="step">${n.step}</div>` : ""}
            <div class="title" title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</div>
            <div class="sub">${escapeHtml(n.sub)}</div>
            <div class="node-preview">${preview}</div>
            <div class="node-foot">
                ${n.lenses?.length ? `<span class="node-lenses">${n.lenses.map(id => `<span class="node-lens" data-style="background:${colors[id] ?? "var(--text-low)"}"></span>`).join("")}</span>` : ""}
                <span class="status-pill"><span class="dot" data-style="${statusDotStyle(n.status, n.color || dotColor)}"></span>${escapeHtml(state ?? "")}</span>
            </div>`;
    }
    // A part row, a lens fold row, a register row and the Constellation's
    // setup row are the same object on the canvas: a head that opens, and
    // - for the rows that hold chips - one line per chip beneath it.
    function rowHead(inner) {
        return `<div class="row-head">${inner}</div>`;
    }

    // One chip to a line, as wide as the row, with its status and an
    // ellipsis. They used to be laid out below the row in a wrapping
    // block, which the card's own overflow then clipped away entirely -
    // so opening Terms flipped its chevron and showed nothing.
    function rowChips(n) {
        if (!n.open) return "";

        return `<div class="row-chips">${(n.chips ?? []).map(chip => `
            <button type="button" class="row-chip ${statusClass(chip.status)}" data-chip="${escapeHtml(chip.id)}" title="${escapeHtml(chip.title)}">
                <span class="dot" data-style="${statusDotStyle(chip.status, n.color || dotColor)}"></span>
                <span class="row-chip-label">${escapeHtml(chip.title)}</span>
            </button>`).join("")}</div>`;
    }

    function rowCard(n) {
        const colors = lensColors(plan());

        // The name wins. A part row with a failing count used to cut even
        // a short name - "app.request" became "app.reque…" beside
        // "7 steps 1 drifted" - so what stands beside it gets shorter
        // rather than the name.
        const count = n.kind === "part" && n.count != null
            ? n.failing > 0
                ? `<span class="row-count">${n.count} ·</span><span class="row-failing">${n.failing} ${escapeHtml(n.status ?? "")}</span>`
                : `<span class="row-count">${n.count} ${n.count === 1 ? "step" : "steps"}</span>`
            : "";

        const right = (n.lenses ?? []).length
            ? `<span class="node-lenses">${n.lenses.map(id => `<span class="node-lens" data-style="background:${colors[id] ?? "var(--text-low)"}"></span>`).join("")}</span>`
            : "";

        return rowHead(`
            ${n.number ? `<div class="step">${escapeHtml(n.number)}</div>` : ""}
            <div class="row-title" title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</div>
            ${count}
            ${n.lensLabel ? `<span class="row-lens">${escapeHtml(n.lensLabel)}</span>` : ""}
            ${right}
            <span class="row-chevron" aria-hidden="true">${n.open ? "\u2303" : "\u2304"}</span>`);
    }

    function chipRow(n) {
        return rowHead(`
            <div class="row-title" title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</div>
            <span class="row-count">${n.count}</span>
            <span class="row-chevron" aria-hidden="true">${n.open ? "\u2303" : "\u2304"}</span>`)
            + rowChips(n);
    }


    function renderNode(n) {
        const kind = n.kind ?? "step";

        const el = document.createElement("button");
        el.type = "button";
        el.className = `gnode ${kind === "step" || kind === "feature" ? statusClass(n.status) : "row"} ${kind}`
            + (n.muted ? " muted" : "")
            + (n.owns ? " owns" : "")
            + (n.open ? " open" : "")
            + (n.id === selectedId ? " selected" : "");
        el.dataset.id = n.id;
        el.dataset.kind = kind;
        el.style.left = n.x + "px";
        el.style.top = n.y + "px";
        el.style.height = heightOf(n) + "px";

        if (n.owns && n.lensColor) el.style.borderColor = n.lensColor;

        el.setAttribute("aria-label", `${n.title}${n.status ? `, ${n.status}` : ""}`);

        el.innerHTML = kind === "feature"
            ? featureCard(n)
            : kind === "step"
                ? stepCard(n)
                : kind === "register" || kind === "setup"
                    ? chipRow(n)
                    : rowCard(n);

        paint(el);

        // Dragging reorders the feature; a click that never moved opens the
        // card. 4px is what separates the two - without it every drag ends
        // by opening the panel you were dragging out from under.
        el.addEventListener("mousedown", e => {
            e.stopPropagation();
            if (!opts.onReorder || kind !== "step") return;
            e.preventDefault();
            dragging = { node: n, fromY: e.clientY, startY: n.y, moved: false };
        });

        el.addEventListener("click", e => {
            e.stopPropagation();
            if (suppressClick) { suppressClick = false; return; }

            const chip = e.target.closest("[data-chip]");

            if (chip && opts.onChip) { opts.onChip(chip.dataset.chip); return; }

            // A part row, a fold row, a register row and the setup row
            // only fold and unfold. Selecting one gave it the step
            // toolbar, and pressing its bin sent `reject` with a part id.
            if (isSelectable(n)) select(n.id); else deselect();

            if (onOpen) onOpen(n);
        });

        el.addEventListener("dblclick", e => {
            e.stopPropagation();
            if (opts.onRename && kind === "step") opts.onRename(n);
        });

        contentEl.appendChild(el);
    }

    function select(id) {
        if (!isSelectable(nodes.find(entry => entry.id === id))) { deselect(); return; }

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
        if (!hasToolbar(n)) return;
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

    // --------------------------------------------------
    // TWO KINDS OF LINE, AND THEY MEAN DIFFERENT THINGS
    // --------------------------------------------------
    // The order line is straight, from the bottom of one card to the top
    // of the next, with no arrowhead: it means "next in this feature" and
    // nothing more. Reading an arrowhead into it is how a plain sequence
    // starts looking like a claim about cause.
    //
    // A call arc bows out into the gutter, dashed, with an arrowhead at
    // the called end. It is only ever drawn for the selected card, because
    // drawing every call at once is the call graph again.
    // --------------------------------------------------

    function orderPath(a, b) {
        const x = a.x + CARD_W / 2;
        return `M ${x} ${a.y + heightOf(a)} L ${b.x + CARD_W / 2} ${b.y}`;
    }

    function arcPath(a, b) {
        const right = Math.max(a.x + CARD_W, b.x + CARD_W);
        const y1 = a.y + heightOf(a) / 2;
        const y2 = b.y + heightOf(b) / 2;
        const bow = right + ARC_GUTTER;

        return `M ${a.x + CARD_W} ${y1} C ${bow} ${y1}, ${bow} ${y2}, ${b.x + CARD_W} ${y2}`;
    }

    function drawEdges() {
        const svgEl = contentEl.querySelector("svg.edges");

        let markup = `<defs><marker id="arrow-${opts.id}" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">`
            + `<path d="M 0 0 L 6 3.5 L 0 7 z" fill="${edgeColor}"/></marker></defs>`;

        edges.forEach(e => {
            const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to);
            if (!a || !b) return;

            if (e.kind === "call") {
                markup += `<path class="edge-path call" d="${arcPath(a, b)}" data-style="stroke:${edgeColor}" marker-end="url(#arrow-${opts.id})"/>`;
                return;
            }

            const d = opts.topDown
                ? orderPath(a, b)
                : opts.horizontal
                    ? elbowPathH(a.x + CARD_W, a.y + heightOf(a) / 2, b.x, b.y + heightOf(b) / 2)
                    : elbowPath(a.x + CARD_W / 2, a.y, b.x + CARD_W / 2, b.y + heightOf(b));

            markup += `<path class="edge-path order" d="${d}" data-style="stroke:${edgeColor}"/>`;
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
    // A wheel scrolls, the way it does everywhere else on the machine. A
    // pinch arrives as ctrl+wheel, and Ctrl/Cmd+wheel is the deliberate
    // zoom - so zooming is something you ask for.
    canvasEl.addEventListener("wheel", e => {
        e.preventDefault();

        const action = wheelAction(e);

        if (action.kind === "zoom") {
            const rect = canvasEl.getBoundingClientRect();
            zoomAround(e.clientX - rect.left, e.clientY - rect.top, action.factor);
            return;
        }

        panX -= action.dx;
        panY -= action.dy;
        clampPan();
        applyTransform();
    }, { passive: false });
    document.addEventListener("mousemove", e => {
        if (panning) {
            panX = panOrigin.x + (e.clientX - panStart.x);
            panY = panOrigin.y + (e.clientY - panStart.y);
            clampPan();
            applyTransform();
        }

        // --------------------------------------------------
        // DRAGGING A CARD REORDERS THE FEATURE
        // --------------------------------------------------
        // It used to move the card, and the position was saved on the node
        // - so a step could sit anywhere, the column stopped being an
        // order, and `step` and the picture disagreed. A card only ever
        // moves up or down the one column now, and dropping it is a
        // reorder that the CLI carries out.
        // --------------------------------------------------
        if (dragging) {
            const dy = (e.clientY - dragging.fromY) / scale;

            if (!dragging.moved && Math.abs(dy) < 4) return;

            dragging.moved = true;

            const el = contentEl.querySelector(`.gnode[data-id="${dragging.node.id}"]`);

            if (el) {
                el.style.top = (dragging.startY + dy) + "px";
                el.classList.add("dragging");
            }

            dragging.at = dropTarget(dragging.node, dragging.startY + dy);
            showInsertion(dragging.node, dragging.at);
            contentEl.querySelector(".node-toolbar")?.remove();
        }
    });

    // Where a card dropped at `y` would land: the item it goes after, or
    // null for the top. Only the cards it may move between are considered,
    // which in a folded feature is its own part.
    function dropTarget(node, y) {
        const siblings = nodes.filter(other =>
            other.kind === "step" &&
            other.id !== node.id &&
            (other.partId ?? null) === (node.partId ?? null));

        let after = null;

        for (const other of siblings) {
            if (other.y + heightOf(other) / 2 < y) after = other;
        }

        return after;
    }

    function showInsertion(node, after) {
        contentEl.querySelector(".insertion")?.remove();

        const line = document.createElement("div");
        line.className = "insertion";
        line.style.left = (node.x - 12) + "px";
        line.style.width = (CARD_W + 24) + "px";
        line.style.top = (after
            ? after.y + heightOf(after) + 22
            : (nodes[0]?.y ?? node.y) - 22) + "px";

        contentEl.appendChild(line);
    }

    document.addEventListener("mouseup", () => {
        if (panning) { panning = false; canvasEl.classList.remove("panning"); }

        if (dragging) {
            const { node, moved, at } = dragging;
            dragging = null;

            contentEl.querySelector(".insertion")?.remove();
            contentEl.querySelector(`.gnode[data-id="${node.id}"]`)?.classList.remove("dragging");

            if (moved) {
                suppressClick = true;
                render();
                opts.onReorder?.(node, at?.id ?? null);
            }
        }
    });

    function zoomAround(mx, my, factor) {
        const newScale = clampScale(scale * factor, MAX_SCALE);
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

    // --------------------------------------------------
    // THE BROWSER MAY NOT SCROLL THE CANVAS
    // --------------------------------------------------
    // overflow:hidden still makes a scroll container, and the browser
    // scrolls one whenever something inside it takes focus. Tabbing
    // through the steps did exactly that - scrollTop went 0, 39, 554,
    // 1091 - so the cards moved without the pan state knowing, and the
    // flow label went with them. styles.css uses overflow:clip now, and
    // this pans to a focused card instead, the way the view moves for
    // everything else.
    //
    // No selection: focus is where the keyboard is, not what the reader
    // has chosen.
    // --------------------------------------------------

    function bringIntoView(node) {
        if (!node) return;

        const rect = canvasEl.getBoundingClientRect();
        const top = node.y * scale + panY;
        const bottom = (node.y + heightOf(node)) * scale + panY;
        const margin = 24;

        if (top >= margin && bottom <= rect.height - margin) return;

        panY = rect.height / 2 - (node.y + heightOf(node) / 2) * scale;
        clampPan();
        applyTransform();
    }

    contentEl.addEventListener("focusin", event => {
        const card = event.target.closest(".gnode");
        if (!card) return;

        // Keyboard focus only. A mouse press focuses too, and panning
        // between the press and the release moves the card out from under
        // the pointer - the release then lands somewhere else, and a
        // click on a chip near the edge of the canvas did nothing at all.
        if (!event.target.matches(":focus-visible")) return;

        bringIntoView(nodes.find(entry => entry.id === card.dataset.id));
    });

    // A canvas that is only hidden by opacity still takes the Tab key and
    // still answers a click, so the reader could land on a Constellation
    // card while standing inside a feature. Mirrored from the class, so
    // no call site can forget it.
    const mirrorInert = () => { canvasEl.inert = canvasEl.classList.contains("hidden"); };

    new MutationObserver(mirrorInert).observe(canvasEl, { attributes: true, attributeFilter: ["class"] });
    mirrorInert();

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
            if (!isSelectable(nodes.find(n => n.id === selectedId))) selectedId = null;
            render();
        },
        clearSelection: deselect,
        panBy(dx, dy) { panX += dx; panY += dy; clampPan(); applyTransform(); },
        zoomIn: () => { const r = canvasEl.getBoundingClientRect(); zoomAround(r.width / 2, r.height / 2, 1.25); },
        zoomOut: () => { const r = canvasEl.getBoundingClientRect(); zoomAround(r.width / 2, r.height / 2, 0.8); },
        fitToContent: () => setView(fitView()),
        fitView, setView, flyTo, zoomedOnto,

        // Where an item sits on the screen right now, and how to put it
        // back there after a re-layout. Opening a part inserts rows above
        // the ones below it, and without this the row you clicked jumps
        // out from under the pointer.
        screenYOf(id) {
            const node = nodes.find(entry => entry.id === id);
            return node ? node.y * scale + panY : null;
        },

        holdAt(id, screenY) {
            const node = nodes.find(entry => entry.id === id);
            if (!node || screenY == null) return;

            panY = screenY - node.y * scale;
            clampPan();
            applyTransform();
        },

        // Bring an item into view without touching the selection.
        reveal(id) { bringIntoView(nodes.find(entry => entry.id === id)); },

        // Bring an item into view and select it.
        focus(id) {
            const node = nodes.find(entry => entry.id === id);
            if (!node) return;

            const rect = canvasEl.getBoundingClientRect();

            panY = rect.height / 2 - (node.y + heightOf(node) / 2) * scale;
            clampPan();
            applyTransform();
            select(id);
        },

        get view() { return { panX, panY, scale }; },
        get scale() { return scale; },
        get selectedId() { return selectedId; },
        get nodes() { return nodes; }
    };
}


// ================= STATE =================
let state = null;
// Where the reader is. Two levels: the Constellation, and one feature.
// The middle "areas" level is gone - a feature folds by part in place
// instead, so there is no door in front of the steps.
let level = "constellation";   // "constellation" | "steps"
let currentFeatureId = null;
// No lens is the default. Entering a feature used to switch the first one
// on, so the first titles a reader ever saw were a perspective's rewording
// of the plan rather than the plan.
let currentLensId = null;
let flying = false;
let constellationHome = null;

// Which part of a folded feature is open, which lens folds the reader has
// opened, and which registers. All per-feature and per-lens: they reset
// when either changes, because a fold row only means anything next to the
// lens that created it.
let openPartId = null;
let openFolds = [];
let openRegisters = [];
let findQuery = "";

const constellationCanvas = document.getElementById("constellationCanvas");
const featureCanvas = document.getElementById("featureCanvas");
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

const constellationGraph = createGraph(constellationCanvas, document.getElementById("constellationGrid"), document.getElementById("constellationContent"), {
    id: "const",
    showToolbar: false,
    hideHandles: true,
    // The journey reads downwards, the same way a feature does.
    topDown: true,
    onChip: id => openDetailById(id),
    // Double-click to rename, the same gesture as a step inside a feature.
    // Nothing else here is authorable: a feature is not added or deleted on
    // the map, it appears because declarations belong to it.
    onRename: node => renameFeature(node)
});

// Authoring lives in Feature Space, where the steps are. Each callback is
// one CLI command: the canvas never writes plan.json itself, so a step
// reordered here and a step reordered from a terminal end up identical.
const featureGraph = createGraph(featureCanvas, document.getElementById("featureGrid"), document.getElementById("featureContent"), {
    id: "feat",
    showToolbar: true,
    // The flow reads top to bottom, and its connectors are drawn to match.
    topDown: true,
    onReorder: (node, afterId) =>
        request("action", { type: "reorderNode", target: node.id, after: afterId }),
    onChip: id => openDetailById(id),
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
    return level === "steps" ? featureGraph : constellationGraph;
}
function syncZoomLabel() { zoomLabel.textContent = Math.round(activeGraph().scale * 100) + "%"; }

function plan() { return state?.plan; }
function featureById(id) { return plan()?.features.find(f => f.id === id); }
function lensById(id) { return plan()?.lenses.find(l => l.id === id); }


// ================= RENDER FROM STATE =================
function mountConstellation() {
    const built = buildConstellation(plan(), state.verifiedStatus, { openRegisters });

    const cards = built.cards.map(card => ({ ...card, kind: "feature" }));

    const setup = built.setup
        ? [{ ...built.setup, kind: "setup", offLine: true }]
        : [];

    // Only the order line by default. A real link between two features -
    // a step in one whose code calls a step in another - is drawn as an
    // arc, and only while a card is selected: drawing them all at once
    // turns the journey back into a call graph.
    const links = cards
        .slice(0, -1)
        .map((card, index) => ({ from: card.id, to: cards[index + 1].id, kind: "order" }));

    const selected = constellationGraph.selectedId;

    const arcs = selected
        ? constellationEdges(plan())
            .filter(edge =>
                edge.source === "nodes" &&
                (edge.from === selected || edge.to === selected) &&
                cards.some(card => card.id === edge.from) &&
                cards.some(card => card.id === edge.to))
            .map(edge => ({ ...edge, kind: "call" }))
        : [];

    constellationFlowTag.hidden = cards.length < 2;
    constellationFlowLabel.textContent = "in the order a person meets them";

    constellationGraph.setData({
        nodes: [...cards, ...setup],
        edges: [...links, ...arcs],
        edgeColor: "var(--text-low)",
        onOpen: n => {
            if (n.kind === "setup") { toggleRegister(n.id); return; }
            enterFeature(n.id);
        }
    });
}

function remountLevel() {
    if (level === "steps") mountFeature();
}

// --------------------------------------------------
// ONE FEATURE, ONE COLUMN
// --------------------------------------------------
// buildSpine decides everything: the order, the folding, the numbers and
// the positions. This turns its items into view nodes and hands them to
// the canvas, and does no layout of its own.
// --------------------------------------------------

let spine = null;

function mountFeature() {
    const p = plan();
    const colors = lensColors(p);
    const featureIndex = p.features.findIndex(f => f.id === currentFeatureId);
    const color = currentLensId ? colors[currentLensId] : colorAt(FEATURE_PALETTE, featureIndex);

    spine = buildSpine(p, currentFeatureId, {
        verifiedStatus: state.verifiedStatus,
        lensId: currentLensId,
        facts: state.facts ?? {},
        openPart: openPartId,
        openFolds,
        openRegisters
    });

    const featureOfNode = new Map((p.nodes ?? []).map(node => [node.id, node.feature]));
    const featureNames = new Map((p.features ?? []).map(feature => [feature.id, feature.name]));

    const nodes = spine.items.map(item => {
        if (item.kind !== "step") {
            return { ...item, title: item.title ?? item.name ?? item.label, color };
        }

        return {
            ...item,
            title: item.node.title,
            identity: item.node.identity,
            sub: nodeSub(item.node),
            lenses: item.node.lensTags ?? [],
            lensColor: currentLensId ? colors[currentLensId] : null,
            chips: callsChips(item.node, {
                numberById: spine.numberById,
                featureOfNode,
                featureNames
            }),
            color,
            source: item.node
        };
    });

    const selected = featureGraph.selectedId;

    const arcs = callArcs(selected, spine.items, p).map(arc => ({ ...arc, kind: "call" }));

    featureGraph.setData({
        nodes,
        edges: [...spine.links.map(link => ({ ...link, kind: "order" })), ...arcs],
        dotColor: color,
        edgeColor: currentLensId ? color : "var(--edge)",
        onOpen: n => {
            if (n.kind === "part") { openPart(n.id); return; }
            if (n.kind === "fold") { toggleFold(n.id); return; }
            if (n.kind === "register") { toggleRegister(n.id); return; }
            openDetail(n);
        }
    });

    featureFlowLabel.textContent = spine.flowLabel;

    renderDriftButton();
}

// Opening a part closes the one before it, and the row keeps its place on
// screen: a fold that jumps the canvas makes the reader find their place
// again every time they open something.
function openPart(id) {
    const before = featureGraph.screenYOf(id);

    openPartId = openPartId === id ? null : id;
    openFolds = [];
    mountFeature();

    featureGraph.holdAt(id, before);
}

function toggleFold(id) {
    openFolds = openFolds.includes(id)
        ? openFolds.filter(entry => entry !== id)
        : [...openFolds, id];

    mountFeature();
}

function toggleRegister(id) {
    openRegisters = openRegisters.includes(id)
        ? openRegisters.filter(entry => entry !== id)
        : [...openRegisters, id];

    if (level === "steps") mountFeature();
    else mountConstellation();
}

function openDetailById(nodeId) {
    const node = (plan()?.nodes ?? []).find(candidate => candidate.id === nodeId);
    if (node) openDetail({ id: node.id, source: node, status: node.status });
}

// --------------------------------------------------
// NEXT DRIFT
// --------------------------------------------------
// A fold must never hide a problem. Part rows carry their failing counts,
// and this walks the drifted steps in order - opening the part that holds
// the next one, and unfolding any lens fold in front of it.
// --------------------------------------------------

const driftBtn = document.getElementById("nextDriftBtn");

function renderDriftButton() {
    if (!driftBtn) return;

    const count = spine?.drifts.length ?? 0;

    driftBtn.hidden = level !== "steps" || count === 0;
    driftBtn.textContent = `Next drift (${count})`;
}

function goToStep(nodeId) {
    const partId = spine?.partIdByNode.get(nodeId) ?? null;

    if (partId && openPartId !== partId) {
        openPartId = partId;
        openFolds = [];
        mountFeature();
    }

    const hiding = spine?.hiddenIn.get(nodeId);

    if (hiding) {
        openFolds = [...openFolds, hiding];
        mountFeature();
    }

    featureGraph.focus(nodeId);
}

driftBtn?.addEventListener("click", () => {
    const next = nextDrift(spine?.drifts ?? [], featureGraph.selectedId);
    if (next) goToStep(next);
});


// --------------------------------------------------
// FIND A STEP
// --------------------------------------------------

const findInput = document.getElementById("findInput");
const findResults = document.getElementById("findResults");

function renderFind() {
    if (!findInput || !findResults) return;

    const results = findSteps(plan(), findQuery);

    findResults.hidden = results.length === 0;
    findResults.innerHTML = results
        .map(result => `<button type="button" class="find-hit" data-id="${escapeHtml(result.id)}" data-feature="${escapeHtml(result.feature)}">${escapeHtml(result.label)}</button>`)
        .join("");
}

findInput?.addEventListener("input", () => {
    findQuery = findInput.value;
    renderFind();
});

findInput?.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    findInput.value = "";
    findQuery = "";
    renderFind();
});

findResults?.addEventListener("click", async e => {
    const hit = e.target.closest(".find-hit");
    if (!hit) return;

    findResults.hidden = true;

    if (hit.dataset.feature !== currentFeatureId || level !== "steps") {
        await enterFeature(hit.dataset.feature);
    }

    goToStep(hit.dataset.id);
});

window.addEventListener("keydown", e => {
    if (!(e.key === "f" && (e.ctrlKey || e.metaKey))) return;
    if (!findInput) return;

    e.preventDefault();
    findInput.focus();
    findInput.select();
});



// --------------------------------------------------
// THE TOP BAR LAYS ITSELF OUT BY MEASURING
// --------------------------------------------------
// Never by a fixed width: the three zones move with the feature name, the
// number of lenses and the approve label, and a media query that guessed
// at 820px made a narrow window work better than a normal one.
//
// The widths measured are the NATURAL ones - the lens bar is the sum of
// its pills, not whatever width the current layout gave it - so choosing
// a layout can never change the measurement that chose it.
// --------------------------------------------------

const toolbarEl = document.querySelector("#viewPlanmap .toolbar");
const LAYOUTS = ["one-row", "lens-row", "stacked"];

function naturalWidths() {
    const style = getComputedStyle(lensSwitch);

    const pills = [...lensSwitch.querySelectorAll(".lens-btn")];

    const lens = pills.length === 0 || !lensSwitch.classList.contains("show")
        ? 0
        : pills.reduce((total, pill) => total + pill.offsetWidth, 0)
            + Math.max(0, pills.length - 1) * (parseFloat(style.gap) || 0)
            + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
            + 2;

    return {
        available: toolbarEl.clientWidth
            - (parseFloat(getComputedStyle(toolbarEl).paddingLeft) || 0)
            - (parseFloat(getComputedStyle(toolbarEl).paddingRight) || 0),
        crumb: breadcrumb.scrollWidth + (document.getElementById("scanChip").hidden ? 0 : document.getElementById("scanChip").offsetWidth + 14),
        lens,
        actions: [...document.querySelectorAll(".view-controls > *")]
            .reduce((total, el) => total + el.offsetWidth, 0) + 20
    };
}

function layOutToolbar() {
    if (!toolbarEl) return;

    const want = toolbarLayout(naturalWidths());

    for (const name of LAYOUTS) toolbarEl.classList.toggle(`layout-${name}`, name === want);
}

new ResizeObserver(() => layOutToolbar()).observe(toolbarEl);


function coveredLenses() {
    return lensCoverage(plan(), currentFeatureId).filter(lens => !lens.empty);
}

function renderLensSwitch() {
    const lenses = coveredLenses();
    const colors = lensColors(plan());

    // "All" comes first, and it is what a feature opens on. Switching a
    // lens on used to be automatic, so the first titles a reader ever saw
    // were a perspective's rewording of the plan rather than the plan.
    const all = `
        <button class="lens-btn all${currentLensId === null ? " active" : ""}" data-lens="" role="radio" aria-checked="${currentLensId === null}" title="Every step, in the plan's own words">
            All
        </button>`;

    lensSwitch.innerHTML = all + lenses.map(lens => `
        <button class="lens-btn${lens.id === currentLensId ? " active" : ""}" data-lens="${escapeHtml(lens.id)}" role="radio" aria-checked="${lens.id === currentLensId}" data-style="--swatch:${colors[lens.id]}" title="${escapeHtml(String(lens.count))} of this feature's steps">
            <span class="swatch"></span>${escapeHtml(lens.label)}<span class="lens-count">${lens.count}</span>
        </button>`).join("");

    paint(lensSwitch);
    lensSwitch.classList.toggle("show", inFeature() && lenses.length > 0);
    renderApprove();
    layOutToolbar();

    lensSwitch.querySelectorAll(".lens-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const next = btn.dataset.lens || null;

            // Clicking the lens that is already on goes back to All, so
            // the way out is the same gesture as the way in.
            currentLensId = next === currentLensId ? null : next;

            // A fold row only means anything beside the lens that made it.
            openFolds = [];

            renderLensSwitch();
            remountLevel();
            activeGraph().fitToContent();
            updateHint();
        });
    });
}

// Where the reader is, and the way back. Two levels, so two segments.
function renderBreadcrumb() {
    if (!inFeature()) {
        breadcrumb.innerHTML = '<span class="crumb current">Constellation</span>';
        return;
    }

    const feature = escapeHtml(featureById(currentFeatureId)?.name ?? "");

    breadcrumb.innerHTML = [
        '<button class="crumb" data-up="top">Constellation</button>',
        '<span class="crumb-sep">\u203a</span>',
        `<span class="crumb current">${feature}</span>`
    ].join("");

    breadcrumb.querySelectorAll("[data-up]").forEach(crumb => {
        crumb.addEventListener("click", () => exitFeature());
    });
}

function updateHint() {
    if (!state || state.setup !== "ready") { statusHint.textContent = ""; return; }

    if (inFeature()) {
        const lens = lensById(currentLensId);

        // The feature's own steps, not the rows on the canvas: a folded
        // feature draws six part rows and holds fifty-nine steps, and the
        // number a reader wants is the second one.
        const coverage = lensCoverage(plan(), currentFeatureId);
        const steps = orderedSteps(plan(), currentFeatureId).length;
        const owned = coverage.find(entry => entry.id === currentLensId)?.count ?? 0;

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
            ? `${lens.label} \u00b7 ${LENS_QUESTIONS[lens.id] ?? ""} \u00b7 ${owned} of ${steps} ${steps === 1 ? "step" : "steps"}`
            : `${featureById(currentFeatureId)?.name} \u00b7 ${steps} ${steps === 1 ? "step" : "steps"}${beside ? ` \u00b7 ${beside}` : ""} \u00b7 scroll to pan, Ctrl+scroll to zoom`;
        return;
    }

    {
        const count = plan().features.length;
        statusHint.textContent = `Constellation \u00b7 ${count} ${count === 1 ? "feature" : "features"} \u00b7 scroll to pan, Ctrl+scroll to zoom`;
    }
}

// ================= ZOOM LEVELS =================
// System -> Feature -> Behaviour -> Code. Each descent is the same move: the
// level you are leaving zooms toward the thing you picked and fades, the
// level you are entering arrives slightly small and settles. That is what
// makes the hierarchy feel like zooming into a map rather than like turning
// pages, and it is why the third level uses the same motion as the second.

const canvasOf = name =>
    name === "steps" ? featureCanvas : constellationCanvas;

const graphOf = name =>
    name === "steps" ? featureGraph : constellationGraph;

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
    mountFeature();

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

    // No lens. It used to switch the first one on, so a reader arrived at
    // a feature whose titles were a perspective's rewording of the plan
    // before they had read the plan.
    currentLensId = null;
    openPartId = null;
    openFolds = [];
    openRegisters = [];

    await descend("steps", featureId);
    flying = false;
}

// Two levels, so there is one way out and it is always the same one.
async function exitFeature() {
    if (flying || !inFeature()) return;
    flying = true;
    closeDetail();

    const origin = currentFeatureId;

    await ascend("constellation", origin);

    flying = false;
}

const goUp = exitFeature;


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
// --------------------------------------------------
// THE BUTTON SAYS WHAT THE CLICK DOES
// --------------------------------------------------
// Inside a feature with a lens on it read "Approve Security" and ran a
// plan-wide --lens, so it approved security steps in every other feature
// too - steps the reader had never opened, under a label that said they
// had. The scope is worked out in one place now, and it is the same scope
// the CLI is given.
// --------------------------------------------------

function approveTarget() {
    if (state?.setup !== "ready") return null;

    const scope = approveScope(plan(), {
        featureId: inFeature() ? currentFeatureId : null,
        lensId: inFeature() ? currentLensId : null
    });

    const what = scope.breakdown.join(", ");

    return {
        ...scope,
        pending: scope.count,
        reason: scope.scope === "plan"
            ? "Every step in the plan is already approved"
            : "Everything in scope is already approved",
        hint: `Approve ${what || "nothing"}`
    };
}

function renderApprove() {
    const target = approveTarget();

    approveBtn.hidden = !target;
    if (!target) return;

    // The name ellipsises; the count never does. On a feature called
    // "Results and the admin export for every agency, state and MP" the
    // button took the whole bar and left the lens pills 0px.
    approveBtn.innerHTML = busy.has("action")
        ? "Approving…"
        : `<span class="approve-name">${escapeHtml(target.name ?? target.label)}</span>`
            + `<span class="approve-count">(${target.count})</span>`;

    approveBtn.classList.toggle("inert", target.pending === 0);
    approveBtn.title = `${target.label} — ${target.pending === 0 ? target.reason : target.hint}`;
    layOutToolbar();
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
        case "approveFeature":
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
    if (["approve", "approveAll", "approveFeature", "approveLens", "reject", "revise", "addNode", "renameNode", "moveNode", "reorderNode"].includes(message.requestType)) finish("action", null);
}

const ACTION_DONE = { approve: "Approved", approveAll: "Approved", approveFeature: "Approved", approveLens: "Approved", reject: "Rejected", revise: "Revised", addNode: "Step added", renameNode: "Renamed", moveNode: "Moved", reorderNode: "Reordered" };
const ACTION_FAILED = { approve: "Couldn't approve", approveAll: "Some steps couldn't be approved", approveFeature: "Some steps couldn't be approved", approveLens: "Some steps couldn't be approved", reject: "Couldn't reject", revise: "Couldn't revise", addNode: "Couldn't add the step", renameNode: "Couldn't rename", moveNode: "Couldn't save the position", reorderNode: "Couldn't reorder" };

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

    // A redraft can take the feature the reader is standing in - the
    // outline regroups as the code moves. They are put back on the
    // Constellation rather than left looking at a view of nothing.
    if (inFeature() && !featureById(currentFeatureId)) {
        level = "constellation";
        featureCanvas.classList.add("hidden");
        constellationCanvas.classList.remove("hidden");
        closeDetail();
    }

    // A part or a fold that the redraft dissolved. Falling back to All is
    // safe: it shows every step, which is never a lie about the feature.
    if (currentLensId && !lensById(currentLensId)) currentLensId = null;

    if (inFeature() && currentLensId && !coveredLenses().some(lens => lens.id === currentLensId)) {
        currentLensId = null;
    }

    if (inFeature()) {
        const parts = buildSpine(plan(), currentFeatureId, { verifiedStatus: state.verifiedStatus }).parts;

        if (openPartId && !parts.some(part => part.id === openPartId)) openPartId = null;

        openFolds = [];
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
        // The steps on the canvas, and the chips in the rows beside them:
        // a term opened from a chip is not a card, and looking only at
        // cards closed its panel on every approve, verify or rescan.
        const same = followDetail(activeGraph().nodes, detailNodeId);

        if (same?.chip) openDetailById(same.id);
        else if (same) openDetail(same);
        else closeDetail();
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

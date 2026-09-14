import {
    NODE_W,
    NODE_H_EST,
    buildConstellation,
    buildFeatureGraph,
    colorAt,
    describeHistory,
    describeRules,
    fadedIds,
    lensColors,
    FEATURE_PALETTE,
    statusClass,
    statusDotStyle
} from "./model.js";

// The webview has no filesystem access. It renders the state the host
// posts, and asks the host for anything that has to touch .planmap/.
const vscode = acquireVsCodeApi();

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.2;
const FLY_MS = 450;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

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
    let nodes = [], edges = [], faded = new Set();
    let selectedId = null, onSelect = null, onOpen = null, dotColor = "var(--accent-a)", edgeColor = "var(--edge)";
    let panX = 0, panY = 0, scale = 1, panning = false, panStart = null, panOrigin = null;

    if (opts.horizontal) contentEl.dataset.h = "1";

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
        el.className = `gnode ${statusClass(n.status)}` + (n.id === selectedId ? " selected" : "") + (faded.has(n.id) ? " faded" : "");
        el.dataset.id = n.id;
        el.style.left = n.x + "px";
        el.style.top = n.y + "px";
        el.setAttribute("aria-label", `${n.title}, ${n.status}`);
        el.innerHTML = `
            <div class="handle top"></div>
            <div class="bar" style="background:${n.color || dotColor}"></div>
            <div class="title">${escapeHtml(n.title)}</div>
            ${n.sub ? `<div class="sub">${escapeHtml(n.sub)}</div>` : ""}
            <div class="status-pill"><span class="dot" style="${statusDotStyle(n.status, n.color || dotColor)}"></span>${n.status}</div>
            <div class="handle bottom"></div>`;
        el.addEventListener("mousedown", e => e.stopPropagation());
        el.addEventListener("click", e => {
            e.stopPropagation();
            select(n.id);
            if (onOpen) onOpen(n);
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
        tb.style.left = (n.x + NODE_W - 70) + "px";
        tb.style.top = (n.y - 34) + "px";
        tb.innerHTML = '<button class="inert" title="Renaming needs plan editing, which isn\'t available yet" aria-disabled="true">✎</button>'
            + '<button data-act="detail" title="Show intent, rules and history">ⓘ</button>'
            + '<button class="inert danger" title="Deleting needs plan editing, which isn\'t available yet" aria-disabled="true">🗑</button>';
        tb.addEventListener("mousedown", e => e.stopPropagation());
        tb.addEventListener("click", e => {
            e.stopPropagation();
            const btn = e.target.closest("button");
            if (btn?.dataset.act === "detail" && onOpen) onOpen(n);
        });
        contentEl.appendChild(tb);
    }

    function elbowPath(x1, y1, x2, y2) { const midY = (y1 + y2) / 2; return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`; }
    function elbowPathH(x1, y1, x2, y2) { const midX = (x1 + x2) / 2; return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`; }

    function drawEdges() {
        const svgEl = contentEl.querySelector("svg.edges");
        let markup = `<defs><marker id="arrow-${opts.id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${edgeColor}"/></marker></defs>`;
        edges.forEach(e => {
            const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to);
            if (!a || !b) return;
            const d = opts.horizontal
                ? elbowPathH(a.x + NODE_W, a.y + NODE_H_EST / 2, b.x, b.y + NODE_H_EST / 2)
                : elbowPath(a.x + NODE_W / 2, a.y, b.x + NODE_W / 2, b.y + NODE_H_EST);
            const dim = faded.has(a.id) || faded.has(b.id) ? " faded" : "";
            markup += `<path class="edge-path${dim}" d="${d}" style="stroke:${edgeColor}" marker-end="url(#arrow-${opts.id})"/>`;
        });
        svgEl.innerHTML = markup;
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
        zoomAround(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });
    document.addEventListener("mousemove", e => {
        if (panning) { panX = panOrigin.x + (e.clientX - panStart.x); panY = panOrigin.y + (e.clientY - panStart.y); applyTransform(); }
    });
    document.addEventListener("mouseup", () => {
        if (panning) { panning = false; canvasEl.classList.remove("panning"); }
    });

    function zoomAround(mx, my, factor) {
        const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
        const lx = (mx - panX) / scale, ly = (my - panY) / scale;
        panX = mx - lx * newScale; panY = my - ly * newScale; scale = newScale;
        applyTransform(); syncZoomLabel();
    }

    function fitView() {
        const rect = canvasEl.getBoundingClientRect();
        if (!nodes.length) return { panX: rect.width / 2, panY: rect.height / 2, scale: 1 };
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs) + NODE_W;
        const minY = Math.min(...ys), maxY = Math.max(...ys) + NODE_H_EST;
        const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
        const pad = 70;
        const s = clamp(Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h, 1.15), MIN_SCALE, MAX_SCALE);
        return { panX: rect.width / 2 - (minX + w / 2) * s, panY: rect.height / 2 - (minY + h / 2) * s, scale: s };
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
        const cx = n.x + NODE_W / 2, cy = n.y + NODE_H_EST / 2;
        return { panX: rect.width / 2 - cx * s, panY: rect.height / 2 - cy * s, scale: s };
    }

    applyTransform();

    return {
        setData(next) {
            nodes = next.nodes; edges = next.edges;
            faded = next.faded ?? new Set();
            dotColor = next.dotColor ?? dotColor;
            edgeColor = next.edgeColor ?? edgeColor;
            onOpen = next.onOpen ?? onOpen;
            if (selectedId && !nodes.some(n => n.id === selectedId)) selectedId = null;
            render();
        },
        setFaded(next) { faded = next; render(); },
        clearSelection: deselect,
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
let inFeature = false;
let currentFeatureId = null;
let currentLensId = null;
let flying = false;
let constellationHome = null;

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
const implementBtn = document.getElementById("implementBtn");

const constellationGraph = createGraph(constellationCanvas, document.getElementById("constellationGrid"), document.getElementById("constellationContent"), { id: "const", horizontal: true, showToolbar: false });
const featureGraph = createGraph(featureCanvas, document.getElementById("featureGrid"), document.getElementById("featureContent"), { id: "feat", showToolbar: true });

function activeGraph() { return inFeature ? featureGraph : constellationGraph; }
function syncZoomLabel() { zoomLabel.textContent = Math.round(activeGraph().scale * 100) + "%"; }

function plan() { return state?.plan; }
function featureById(id) { return plan()?.features.find(f => f.id === id); }
function lensById(id) { return plan()?.lenses.find(l => l.id === id); }


// ================= RENDER FROM STATE =================
function mountConstellation() {
    const nodes = buildConstellation(plan(), state.verifiedStatus);
    constellationGraph.setData({ nodes, edges: [], edgeColor: "var(--text-low)", onOpen: n => enterFeature(n.id) });
}

function mountFeature() {
    const p = plan();
    const graph = buildFeatureGraph(p, currentFeatureId, state.verifiedStatus);
    const colors = lensColors(p);
    const featureIndex = p.features.findIndex(f => f.id === currentFeatureId);
    const color = currentLensId ? colors[currentLensId] : colorAt(FEATURE_PALETTE, featureIndex);

    featureGraph.setData({
        nodes: graph.nodes.map(n => ({ ...n, color })),
        edges: graph.edges,
        faded: fadedIds(graph.nodes, currentLensId),
        dotColor: color,
        edgeColor: currentLensId ? color : "var(--edge)",
        onOpen: n => openDetail(n)
    });
}

function renderLensSwitch() {
    const lenses = plan()?.lenses ?? [];
    const colors = lensColors(plan());
    lensSwitch.innerHTML = lenses.map(lens => `
        <button class="lens-btn${lens.id === currentLensId ? " active" : ""}" data-lens="${escapeHtml(lens.id)}" role="radio" aria-checked="${lens.id === currentLensId}" style="--swatch:${colors[lens.id]}">
            <span class="swatch"></span>${escapeHtml(lens.label)}
        </button>`).join("");
    lensSwitch.classList.toggle("show", inFeature && lenses.length > 0);
    lensSwitch.querySelectorAll(".lens-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentLensId = btn.dataset.lens;
            renderLensSwitch();
            mountFeature();
            updateHint();
        });
    });
}

function renderBreadcrumb() {
    if (!inFeature) {
        breadcrumb.innerHTML = '<span class="crumb current">Constellation</span>';
        return;
    }
    breadcrumb.innerHTML = `<button class="crumb" id="crumbConstellation">Constellation</button><span class="crumb-sep">›</span><span class="crumb current">${escapeHtml(featureById(currentFeatureId)?.name)}</span>`;
    document.getElementById("crumbConstellation").addEventListener("click", exitFeature);
}

function updateHint() {
    if (!state || state.setup !== "ready") { statusHint.textContent = ""; return; }
    if (inFeature) {
        const lens = lensById(currentLensId);
        statusHint.textContent = lens
            ? `Feature Space · ${lens.label} lens · scroll to zoom, drag empty space to pan`
            : "Feature Space · scroll to zoom, drag empty space to pan";
    } else {
        const count = plan().features.length;
        statusHint.textContent = `Constellation · ${count} ${count === 1 ? "feature" : "features"} · scroll to zoom, drag empty space to pan`;
    }
}

// Implement stays disabled until the plan is compiled, and compiling needs
// plan editing, which is not available yet. The gate is kept, unwired.
function refreshCompileUI() {
    implementBtn.disabled = true;
    implementBtn.classList.remove("ready");
}


// ================= ZOOM LEVELS =================
async function enterFeature(featureId) {
    if (flying || !featureById(featureId)) return;
    flying = true;
    closeDetail();

    constellationHome = constellationGraph.view;
    currentFeatureId = featureId;
    currentLensId = plan().lenses[0]?.id ?? null;

    // Fly into the feature node while the constellation fades.
    constellationCanvas.classList.add("hidden");
    await constellationGraph.flyTo(constellationGraph.zoomedOnto(featureId, 2.4));

    inFeature = true;
    featureCanvas.classList.remove("hidden");
    mountFeature();
    const target = featureGraph.fitView();
    featureGraph.setView(scaledAboutCenter(target, 0.6, featureCanvas.clientWidth, featureCanvas.clientHeight));
    renderBreadcrumb(); renderLensSwitch(); updateHint(); refreshCompileUI();
    await featureGraph.flyTo(target);

    constellationGraph.setView(constellationHome);
    flying = false;
}

async function exitFeature() {
    if (flying || !inFeature) return;
    flying = true;
    closeDetail();

    const origin = currentFeatureId;
    const outward = featureGraph.view;

    featureCanvas.classList.add("hidden");
    await featureGraph.flyTo(scaledAboutCenter(outward, 0.6, featureCanvas.clientWidth, featureCanvas.clientHeight));

    inFeature = false;
    featureGraph.clearSelection();
    const home = constellationHome ?? constellationGraph.fitView();
    constellationGraph.setView(constellationGraph.zoomedOnto(origin, 2.4));
    constellationCanvas.classList.remove("hidden");
    renderBreadcrumb(); renderLensSwitch(); updateHint(); refreshCompileUI();
    await constellationGraph.flyTo(home);

    flying = false;
}


// ================= NODE DETAIL =================
function section(title, body) {
    return `<div class="impact-section"><div class="h">${title}</div>${body}</div>`;
}

function openDetail(viewNode) {
    const node = viewNode.source;
    const colors = lensColors(plan());
    const lensName = id => lensById(id)?.label ?? id;

    const rules = describeRules(node.rules);
    const history = describeHistory(node.history);

    const statusBody = `<div class="badge-row"><div class="badge"><span class="dot" style="${statusDotStyle(viewNode.status, viewNode.color)}"></span>${viewNode.status}</div></div>`;

    const rulesBody = rules.length
        ? rules.map(rule => `<div class="rule-block"><div class="target">${escapeHtml(rule.kind)} · ${escapeHtml(rule.target)}</div>${rule.clauses.map(c => `<div class="clause">${escapeHtml(c)}</div>`).join("") || '<div class="clause">no assertions</div>'}</div>`).join("")
        : "<p>No rules on this node.</p>";

    const approval = node.approvedBy || node.approvedAt
        ? section("Approved", `<p>${escapeHtml(node.approvedBy ?? "unknown")}${node.approvedAt ? ` · ${escapeHtml(node.approvedAt.slice(0, 10))}` : ""}</p>`)
        : "";

    const lenses = (node.lensTags ?? []).length
        ? section("Lenses", `<div class="badge-row">${node.lensTags.map(id => `<div class="badge" style="color:${colors[id] ?? "var(--text-mid)"}"><span class="dot" style="background:${colors[id] ?? "var(--text-low)"}"></span>${escapeHtml(lensName(id))}</div>`).join("")}</div>`)
        : "";

    const historyBlock = history.length
        ? section("History", history.map(h => `<div class="history-row"><span class="version">${escapeHtml(h.version)}</span><span class="intent">“${escapeHtml(h.intent)}”</span>${h.status ? `<span class="meta">${escapeHtml(h.status)}</span>` : ""}</div>`).join(""))
        : "";

    impactInner.innerHTML = `
        <div class="impact-head"><h3>${escapeHtml(node.title)}</h3><button class="impact-close" id="impactCloseBtn" aria-label="Close detail">✕</button></div>
        <div class="impact-sub">${escapeHtml(node.identity ?? "greenfield · no code yet")}</div>
        ${section("Status", statusBody)}
        ${section("Intent", `<p>${escapeHtml(node.intent)}</p>`)}
        ${section("Rules", rulesBody)}
        ${approval}
        ${lenses}
        ${historyBlock}`;

    impactPanel.classList.add("open");
    document.getElementById("impactCloseBtn").addEventListener("click", closeDetail);
}

function closeDetail() { impactPanel.classList.remove("open"); }


// ================= EMPTY STATES (checkpoint) =================
function renderEmpty() {
    const setup = state.setup;
    emptyState.hidden = setup === "ready";
    // Zoom, compile and legend only mean something once there is a plan to show.
    document.querySelector(".planmap-root").classList.toggle("not-ready", setup !== "ready");
    if (setup === "ready") return;

    if (setup === "missing") {
        emptyCard.innerHTML = `<h2>PlanMap isn't set up yet</h2><p>Scan this project to learn what your code currently does. To scan it, run <code>init</code> on this folder.</p>`;
    } else if (setup === "no-plan") {
        emptyCard.innerHTML = `<h2>No plan yet</h2><p>This project has been scanned. Draft a plan with <code>plan draft</code>, or write <code>.planmap/plan.json</code> by hand.</p>`;
    } else {
        emptyCard.innerHTML = `<h2>This plan can't be shown</h2><p>Fix <code>.planmap/plan.json</code> and the map will reload.</p><div class="problem">${escapeHtml(state.problem)}</div>`;
    }
}


// ================= WIRING =================
function applyState(next) {
    state = next;
    renderEmpty();
    if (state.setup !== "ready") { updateHint(); return; }

    if (inFeature && !featureById(currentFeatureId)) {
        inFeature = false;
        featureCanvas.classList.add("hidden");
        constellationCanvas.classList.remove("hidden");
        closeDetail();
    }
    if (currentLensId && !lensById(currentLensId)) currentLensId = plan().lenses[0]?.id ?? null;

    const firstMount = constellationGraph.nodes.length === 0;
    mountConstellation();
    if (firstMount) constellationGraph.fitToContent();
    if (inFeature) mountFeature();

    renderBreadcrumb(); renderLensSwitch(); updateHint(); refreshCompileUI(); syncZoomLabel();
}

document.getElementById("zoomInBtn").addEventListener("click", () => activeGraph().zoomIn());
document.getElementById("zoomOutBtn").addEventListener("click", () => activeGraph().zoomOut());
document.getElementById("zoomResetBtn").addEventListener("click", () => activeGraph().fitToContent());
document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (impactPanel.classList.contains("open")) closeDetail(); else if (inFeature) exitFeature(); }
});

window.addEventListener("message", event => {
    const message = event.data;
    if (message?.type === "state") applyState(message.state);
});

vscode.postMessage({ type: "ready" });

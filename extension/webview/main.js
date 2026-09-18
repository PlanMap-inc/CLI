import {
    NODE_W,
    NODE_H_EST,
    buildConstellation,
    buildFeatureGraph,
    colorAt,
    constellationEdges,
    describeHistory,
    describeImpact,
    describeRules,
    describeViolation,
    escapeHtml,
    lensColors,
    lensCoverage,
    FEATURE_PALETTE,
    nodeActions,
    onboardingState,
    parseScanProgress,
    railModel,
    statusClass,
    statusDotStyle,
    verifyResultFor
} from "./model.js";
import { createEvolutionView } from "./evolution-view.js";

// The webview has no filesystem access. It renders the state the host
// posts, and asks the host for anything that has to touch .planmap/.
const vscode = acquireVsCodeApi();

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.2;
const FLY_MS = 450;
// Add, rename, delete, connect and compile need CLI commands that don't exist yet.
const NODE_EDITING_UNAVAILABLE = "Node editing is not available yet — edit .planmap/plan.json directly";
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
    let nodes = [], edges = [];
    let selectedId = null, onSelect = null, onOpen = null, dotColor = "var(--accent-a)", edgeColor = "var(--edge)";
    let panX = 0, panY = 0, scale = 1, panning = false, panStart = null, panOrigin = null;

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
        el.className = `gnode ${statusClass(n.status)}` + (n.id === selectedId ? " selected" : "");
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
        tb.innerHTML = `<button class="inert" title="${NODE_EDITING_UNAVAILABLE}" aria-disabled="true">✎</button>`
            + '<button data-act="detail" title="Show intent, rules and history">ⓘ</button>'
            + `<button class="inert danger" title="${NODE_EDITING_UNAVAILABLE}" aria-disabled="true">🗑</button>`;
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
            markup += `<path class="edge-path" d="${d}" style="stroke:${edgeColor}" marker-end="url(#arrow-${opts.id})"/>`;
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
            dotColor = next.dotColor ?? dotColor;
            edgeColor = next.edgeColor ?? edgeColor;
            onOpen = next.onOpen ?? onOpen;
            if (selectedId && !nodes.some(n => n.id === selectedId)) selectedId = null;
            render();
        },
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
const constellationFlowTag = document.getElementById("constellationFlowTag");
const constellationFlowLabel = document.getElementById("constellationFlowLabel");

const constellationGraph = createGraph(constellationCanvas, document.getElementById("constellationGrid"), document.getElementById("constellationContent"), { id: "const", showToolbar: false, hideHandles: true });
const featureGraph = createGraph(featureCanvas, document.getElementById("featureGrid"), document.getElementById("featureContent"), { id: "feat", showToolbar: true });

function activeGraph() { return inFeature ? featureGraph : constellationGraph; }
function syncZoomLabel() { zoomLabel.textContent = Math.round(activeGraph().scale * 100) + "%"; }

function plan() { return state?.plan; }
function featureById(id) { return plan()?.features.find(f => f.id === id); }
function lensById(id) { return plan()?.lenses.find(l => l.id === id); }


// ================= RENDER FROM STATE =================
function mountConstellation() {
    const nodes = buildConstellation(plan(), state.verifiedStatus);
    const edges = constellationEdges(plan());

    constellationFlowTag.hidden = edges.length === 0;
    constellationFlowLabel.textContent = edges[0]?.source === "nodes" ? "links between features" : "plan order";

    constellationGraph.setData({ nodes, edges, edgeColor: "var(--text-low)", onOpen: n => enterFeature(n.id) });
}

function mountFeature() {
    const p = plan();
    const graph = buildFeatureGraph(p, currentFeatureId, state.verifiedStatus, currentLensId);
    const colors = lensColors(p);
    const featureIndex = p.features.findIndex(f => f.id === currentFeatureId);
    const color = currentLensId ? colors[currentLensId] : colorAt(FEATURE_PALETTE, featureIndex);

    featureGraph.setData({
        nodes: graph.nodes.map(n => ({ ...n, color })),
        edges: graph.edges,
        dotColor: color,
        edgeColor: currentLensId ? color : "var(--edge)",
        onOpen: n => openDetail(n)
    });
}

function renderLensSwitch() {
    const lenses = lensCoverage(plan(), currentFeatureId);
    const colors = lensColors(plan());

    // An empty lens stays on the switch, dimmed and counted: "nothing here
    // from this perspective" is a fact about the code worth reading.
    lensSwitch.innerHTML = lenses.map(lens => `
        <button class="lens-btn${lens.id === currentLensId ? " active" : ""}${lens.empty ? " empty" : ""}" data-lens="${escapeHtml(lens.id)}" role="radio" aria-checked="${lens.id === currentLensId}" style="--swatch:${colors[lens.id]}" title="${lens.empty ? "Nothing in this feature is tagged " + escapeHtml(lens.id) : escapeHtml(String(lens.count)) + " of this feature's steps"}">
            <span class="swatch"></span>${escapeHtml(lens.label)}<span class="lens-count">${lens.count}</span>
        </button>`).join("");
    lensSwitch.classList.toggle("show", inFeature && lenses.length > 0);
    renderApproveLens();
    lensSwitch.querySelectorAll(".lens-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentLensId = btn.dataset.lens;
            renderLensSwitch();
            mountFeature();
            featureGraph.fitToContent();
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
        const shown = featureGraph.nodes.length;
        statusHint.textContent = lens && shown === 0
            ? `Feature Space · no nodes in this feature have the ${lens.label} lens`
            : lens
            ? `Feature Space · ${lens.label} lens · ${shown} ${shown === 1 ? "node" : "nodes"} · scroll to zoom, drag empty space to pan`
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
        ${verifyBlock(node, viewNode.status)}
        ${section("Intent", `<p>${escapeHtml(node.intent)}</p>`)}
        ${section("Rules", rulesBody)}
        ${approval}
        ${lenses}
        ${historyBlock}
        ${section("Decision", actionsBody(node))}`;

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

    const violations = (result.violations ?? []).map(describeViolation);
    const errors = (result.errors ?? []).map(error => error?.message ?? String(error));
    const unsupported = (result.unsupported ?? []).map(item => item?.reason ?? JSON.stringify(item));
    const impact = (result.impact ?? []).map(describeImpact);

    return [
        violations.length ? section("Why it drifted", violations.map(v => `<div class="rule-block"><div class="target">${escapeHtml(v.field)}</div><div class="clause">expected ${escapeHtml(v.expected)}</div><div class="clause">actual ${escapeHtml(v.actual)}</div>${v.reason ? `<div class="clause reason">${escapeHtml(v.reason)}</div>` : ""}</div>`).join("")) : "",
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
          <div class="progress-bar${indeterminate ? " indeterminate" : ""}"><span${indeterminate ? "" : ` style="width:${progress.percent}%"`}></span></div>
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
    renderApproveLens();
}

// Approves every intended node with the active lens - in all features, which the confirmation says.
function renderApproveLens() {
    const lens = inFeature && state?.setup === "ready" ? lensById(currentLensId) : null;
    approveLensBtn.hidden = !lens;
    if (!lens) return;

    const pending = (plan()?.nodes ?? []).filter(node => node.status === "intended" && (node.lensTags ?? []).includes(lens.id)).length;
    approveLensBtn.textContent = busy.has("action") ? "Approving…" : `Approve ${lens.label}`;
    approveLensBtn.classList.toggle("inert", pending === 0);
    approveLensBtn.title = pending === 0
        ? `No intended nodes are tagged ${lens.label}`
        : `Approve all ${pending} intended ${lens.label} ${pending === 1 ? "node" : "nodes"}, in every feature`;
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
        case "approveLens":
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
    if (["approve", "approveLens", "reject", "revise"].includes(message.requestType)) finish("action", null);
}

const ACTION_DONE = { approve: "Approved", approveLens: "Approved", reject: "Rejected", revise: "Revised" };
const ACTION_FAILED = { approve: "Couldn't approve", approveLens: "Some nodes couldn't be approved", reject: "Couldn't reject", revise: "Couldn't revise" };

function showActionResult(result) {
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
function showEvolutionResult(result) {
    const summary = String(result.stdout ?? "").split("\n").filter(line => /classification|LLM classifications/.test(line)).join("\n");
    const reverify = state?.plan ? "Verify again to bring drift back onto the map." : "";

    const options = result.outcome === "ok"
        ? { title: "Evolution refreshed", body: [summary, reverify].filter(Boolean).join("\n") }
        : result.outcome === "findings"
            ? { title: "Evolution refreshed, partly without AI", body: [summary, "Some batches kept path labels.", cliMessage(result), reverify].filter(Boolean).join("\n") }
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

    driftBadge.hidden = !rail.badge;
    driftBadge.textContent = rail.badge ? String(rail.badge.count) : "";
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

const approveLensBtn = document.getElementById("approveLensBtn");
const evoRefreshBtn = document.getElementById("evoRefreshBtn");
const evoNotice = document.getElementById("evoNotice");

approveLensBtn.addEventListener("click", () => {
    if (!approveLensBtn.classList.contains("inert") && currentLensId) request("action", { type: "approveLens", lensId: currentLensId });
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
    hint: document.getElementById("evoHint"),
    expandBtn: document.getElementById("evoExpandBtn"),
    collapseBtn: document.getElementById("evoCollapseBtn")
});


// ================= WIRING =================
function applyState(next) {
    state = next;
    renderEmpty();
    evolutionView.setData(state.evolution, state.projectName);
    renderRail();
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
    if (firstMount) {
        if (activeView === "planmap") constellationGraph.fitToContent(); else pendingFit = true;
    }
    if (inFeature) mountFeature();

    // An approve, revise or reject re-reads the plan: follow the node (a revise
    // gives it a new id that supersedes the old one), or close if it is gone.
    if (detailNodeId && impactPanel.classList.contains("open")) {
        const same = inFeature && featureGraph.nodes.find(n => n.id === detailNodeId || n.source.supersedes === detailNodeId);
        if (same) openDetail(same); else closeDetail();
    }

    renderBreadcrumb(); renderLensSwitch(); updateHint(); refreshCompileUI(); syncZoomLabel();
}

document.getElementById("zoomInBtn").addEventListener("click", () => activeGraph().zoomIn());
document.getElementById("zoomOutBtn").addEventListener("click", () => activeGraph().zoomOut());
document.getElementById("zoomResetBtn").addEventListener("click", () => activeGraph().fitToContent());
verifyBtn.addEventListener("click", runVerify);
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (activeView === "evolution") { evolutionView.closeDetail(); return; }
    if (impactPanel.classList.contains("open")) closeDetail(); else if (inFeature) exitFeature();
});

window.addEventListener("message", event => {
    const message = event.data;
    if (message?.type === "state") applyState(message.state);
    if (message?.type === "cliResult") onCliResult(message);
    if (message?.type === "progress") onProgress(message);
    if (message?.type === "cancelled") onCancelled(message);
});

vscode.postMessage({ type: "ready" });

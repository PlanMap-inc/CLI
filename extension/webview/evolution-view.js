// --------------------------------------------------
// PROJECT EVOLUTION VIEW
// --------------------------------------------------
// An indented outline, not a canvas: the Plan Graph is authored by a person,
// this is derived from code, and the two must never be mistaken for each other.
// Read-only by construction - this module is never handed the VS Code API, so
// it cannot send a message, and it renders nothing that adds, moves or edits.
// --------------------------------------------------

import { escapeHtml } from "./model.js";
import {
    buildEvolutionTree,
    countNodes,
    describeDelta,
    evolutionIcon,
    evolutionTags,
    isCollapsed,
    pruneByTag,
    tagColors
} from "./evolution.js";

function formatTime(value) {
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) ? `${text.slice(0, 16).replace("T", " ")} UTC` : text;
}

function findItem(items, id) {
    for (const item of items) {
        if (!item.feature && !item.group && item.id === id) return item;
        const found = findItem(item.children, id);
        if (found) return found;
    }
    return null;
}

function forEachItem(items, visit, depth = 0) {
    for (const item of items) {
        visit(item, depth);
        forEachItem(item.children, visit, depth + 1);
    }
}

export function createEvolutionView(el) {
    let evolution = null;
    let projectName = "";
    let activeTag = null;
    let selectedId = null;
    const toggled = new Map();

    function setData(nextEvolution, nextProjectName) {
        evolution = nextEvolution;
        projectName = nextProjectName ?? "";
        if (activeTag && !evolutionTags(evolution).includes(activeTag)) activeTag = null;
        render();

        // An open detail follows a fresh verify run.
        if (selectedId) {
            const item = findItem(buildEvolutionTree(evolution), selectedId);
            if (item) openDetail(item); else closeDetail();
        }
    }

    function render() {
        el.title.textContent = projectName || "Project Evolution";

        const tree = buildEvolutionTree(evolution);
        const total = countNodes(tree);

        el.emptyState.hidden = total > 0;

        if (total === 0) {
            el.emptyCard.innerHTML = evolution
                ? "<h2>No declarations recorded yet</h2><p>Project Evolution is derived from your code, and fills in as the project is scanned.</p>"
                : "<h2>No project evolution yet</h2><p>Project Evolution is derived from your code, so it can't be written by hand. Scan the project from the Plan Graph, or run <code>planmap evolution</code> in a terminal.</p>";
            el.tagSwitch.innerHTML = "";
            el.tagSwitch.hidden = true;
            el.tree.innerHTML = "";
            el.hint.textContent = "";
            return;
        }

        renderTags();

        const shown = pruneByTag(tree, activeTag);
        const colors = tagColors(evolutionTags(evolution));

        el.tree.innerHTML = "";
        const label = document.createElement("div");
        label.className = "evo-root-label";
        label.textContent = projectName;
        el.tree.appendChild(label);
        for (const item of shown) el.tree.appendChild(buildRow(item, 0, colors));

        const visible = countNodes(shown);
        el.hint.textContent = activeTag
            ? `Project Evolution · ${visible} of ${total} entries tagged ${activeTag} · read-only`
            : `Project Evolution · ${total} ${total === 1 ? "entry" : "entries"} · derived from code, read-only`;
    }

    function renderTags() {
        const tags = evolutionTags(evolution);
        const colors = tagColors(tags);
        const button = (tag, label) =>
            `<button class="lens-btn${tag === activeTag ? " active" : ""}" data-tag="${escapeHtml(tag ?? "")}" role="radio" aria-checked="${tag === activeTag}" style="--swatch:${tag ? colors[tag] : "var(--text-low)"}"><span class="swatch"></span>${escapeHtml(label)}</button>`;

        // Sentence case, so a lens is named the same here as in the Plan Graph.
        const name = tag => tag.charAt(0).toUpperCase() + tag.slice(1);

        el.tagSwitch.innerHTML = button(null, "All") + tags.map(tag => button(tag, name(tag))).join("");
        el.tagSwitch.hidden = tags.length === 0;

        el.tagSwitch.querySelectorAll(".lens-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                activeTag = btn.dataset.tag || null;
                closeDetail();
                render();
            });
        });
    }

    function buildRow(item, depth, colors) {
        const hasKids = item.children.length > 0;
        const collapsed = isCollapsed(item, depth, { filtered: Boolean(activeTag), toggled });

        const wrap = document.createElement("div");
        wrap.className = "evo-node";
        wrap.setAttribute("role", "none");

        const row = document.createElement("div");
        row.tabIndex = 0;
        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-level", String(depth + 1));
        if (hasKids) row.setAttribute("aria-expanded", String(!collapsed));

        const toggleMark = `<span class="evo-toggle${hasKids ? "" : " leaf"}" aria-hidden="true">${hasKids ? (collapsed ? "▸" : "▾") : ""}</span>`;

        if (item.feature || item.group) {
            row.className = item.feature ? "evo-row evo-feature" : "evo-row evo-group";
            row.innerHTML = `${toggleMark}<span class="evo-title">${escapeHtml(item.title)}</span><span class="evo-count">${countNodes(item.children)}</span>`;
        } else {
            const status = item.status ?? "";
            row.className = `evo-row status-${escapeHtml(status || "none")}${item.id === selectedId ? " selected" : ""}`;
            row.setAttribute("aria-label", `${item.title}, ${status || "no status"}`);
            row.innerHTML = `${toggleMark}
                <span class="evo-status-icon status-${escapeHtml(status || "none")}" title="${escapeHtml(status)}" aria-hidden="true">${evolutionIcon(status)}</span>
                <span class="evo-title">${escapeHtml(item.title)}</span>
                <span class="evo-tags">${item.tags.map(tag => `<span class="evo-tag"><span class="evo-tag-dot" style="background:${colors[tag]}"></span>${escapeHtml(tag)}</span>`).join("")}</span>`;
        }

        wrap.appendChild(row);

        let childrenEl = null;

        if (hasKids) {
            childrenEl = document.createElement("div");
            childrenEl.className = "evo-children";
            childrenEl.setAttribute("role", "group");
            childrenEl.hidden = collapsed;
            item.children.forEach(child => childrenEl.appendChild(buildRow(child, depth + 1, colors)));
            wrap.appendChild(childrenEl);
        }

        const setCollapsed = next => {
            if (!childrenEl) return;
            toggled.set(item.id, next);
            childrenEl.hidden = next;
            row.querySelector(".evo-toggle").textContent = next ? "▸" : "▾";
            row.setAttribute("aria-expanded", String(!next));
        };

        row.querySelector(".evo-toggle").addEventListener("click", event => {
            event.stopPropagation();
            if (childrenEl) setCollapsed(!childrenEl.hidden);
        });

        row.addEventListener("click", () => {
            if (item.feature || item.group) {
                if (childrenEl) setCollapsed(!childrenEl.hidden);
                return;
            }
            selectedId = item.id;
            el.tree.querySelectorAll(".evo-row.selected").forEach(other => other.classList.remove("selected"));
            row.classList.add("selected");
            openDetail(item);
        });

        row.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); row.click(); }
            else if (event.key === "ArrowRight") { event.preventDefault(); setCollapsed(false); }
            else if (event.key === "ArrowLeft") { event.preventDefault(); setCollapsed(true); }
        });

        return wrap;
    }

    function openDetail(item) {
        const node = item.source;
        const status = item.status ?? "unknown";
        const colors = tagColors(evolutionTags(evolution));
        const delta = describeDelta(node.delta);

        const tags = item.tags.length
            ? item.tags.map(tag => `<div class="badge"><span class="dot" style="background:${colors[tag]}"></span>${escapeHtml(tag)}</div>`).join("")
            : '<div class="badge">untagged</div>';

        const against = node.verifiedAgainst ? `plan node <code>${escapeHtml(node.verifiedAgainst)}</code>` : "its approved plan node";
        const callout = status === "drifted"
            ? `<div class="drift-callout"><div class="h">Drifted</div>The code no longer matches ${against}.</div>`
            : status === "error"
                ? `<div class="drift-callout"><div class="h">Error</div>Verify hit an error checking this declaration against ${against}.</div>`
                : "";

        el.detailInner.innerHTML = `
            <div class="impact-head"><h3>${escapeHtml(item.title)}</h3><button class="impact-close" id="evoDetailClose" aria-label="Close detail">✕</button></div>
            <div class="impact-sub">${escapeHtml(item.identity ?? "no identity recorded")}</div>
            <div class="impact-section"><div class="h">Status</div><div class="badge-row"><div class="badge"><span class="evo-status-icon status-${escapeHtml(status)}" aria-hidden="true">${evolutionIcon(status)}</span>${escapeHtml(status)}${node.statusSource ? ` · ${escapeHtml(node.statusSource)}` : ""}</div></div>${callout}</div>
            <div class="impact-section"><div class="h">Tags</div><div class="badge-row">${tags}</div></div>
            <div class="impact-section"><div class="h">Delta</div>${delta.length ? `<div class="rule-block">${delta.map(entry => `<div class="clause">${escapeHtml(entry.key)}: ${escapeHtml(entry.value)}</div>`).join("")}</div>` : "<p>No change recorded.</p>"}</div>
            <div class="impact-section"><div class="h">Last verified</div><p>${node.lastVerified ? escapeHtml(formatTime(node.lastVerified)) : "Never"}</p></div>`;

        el.detailPanel.classList.add("open");
        document.getElementById("evoDetailClose").addEventListener("click", closeDetail);
    }

    function closeDetail() {
        selectedId = null;
        el.detailPanel.classList.remove("open");
        el.tree.querySelectorAll(".evo-row.selected").forEach(row => row.classList.remove("selected"));
    }

    el.expandBtn.addEventListener("click", () => {
        forEachItem(buildEvolutionTree(evolution), item => { if (item.children.length) toggled.set(item.id, false); });
        render();
    });

    // Back to the default: branches deeper than level 2 collapsed.
    el.collapseBtn.addEventListener("click", () => {
        toggled.clear();
        render();
    });

    return { setData, closeDetail };
}

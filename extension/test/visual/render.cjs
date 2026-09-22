#!/usr/bin/env node
// --------------------------------------------------
// LOOK AT IT
// --------------------------------------------------
// Two rounds of card bugs passed every unit test. A card whose rows are
// squeezed to 4px, a chip drawn outside the row that holds it, a lens
// pill scrolled off its own bar - none of it is visible to a function
// that asserts on numbers, because the numbers were right. Only the
// rendering was wrong.
//
// So this renders extension/webview/index.html in a real browser, posts a
// fixture state, drives it with the mouse and the keyboard, and measures
// what came out. It is run by hand:
//
//     node extension/test/visual/render.cjs
//
// It is not part of `npm test`: it needs a browser, and `npm test` must
// run anywhere. It installs nothing - Playwright is found wherever it
// already is, and the run exits 2 with instructions if it is nowhere.
//
// Exit codes: 0 clean, 1 problems found, 2 no browser.
// --------------------------------------------------

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const WEB = path.resolve(__dirname, "..", "..", "webview");
const OUT = path.join(__dirname, "shots");

const SIZES = [
    { width: 1440, height: 900 },
    { width: 1100, height: 800 },
    { width: 800, height: 700 }
];

// --------------------------------------------------
// FINDING PLAYWRIGHT WITHOUT INSTALLING IT
// --------------------------------------------------

function findPlaywright() {
    const tried = [];

    const attempt = where => {
        tried.push(where);
        try {
            return require(where);
        } catch {
            return null;
        }
    };

    const direct = attempt("playwright") || attempt("playwright-core");
    if (direct) return direct;

    // A global install.
    try {
        const root = execFileSync("npm", ["root", "-g"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        const global = attempt(path.join(root, "playwright"));
        if (global) return global;
    } catch { /* npm is not on the path; keep looking */ }

    // Wherever `npx playwright` last unpacked it.
    const cache = path.join(os.homedir(), ".npm", "_npx");

    if (fs.existsSync(cache)) {
        for (const entry of fs.readdirSync(cache)) {
            const candidate = path.join(cache, entry, "node_modules", "playwright");
            if (!fs.existsSync(candidate)) continue;
            const found = attempt(candidate);
            if (found) return found;
        }
    }

    console.error("This check needs Playwright, and there is none on this machine.");
    console.error("");
    console.error("  npx --yes playwright install chromium");
    console.error("  node extension/test/visual/render.cjs");
    console.error("");
    console.error("Nothing is added to package.json either way.");
    console.error(`Looked in: ${tried.join(", ")}`);
    process.exit(2);
}

// --------------------------------------------------
// THE WEBVIEW, SERVED AS THE HOST SERVES IT
// --------------------------------------------------
// Over HTTP rather than from a file, so main.js's own relative module
// imports resolve exactly as they do in VS Code.

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };

function harness() {
    return fs.readFileSync(path.join(WEB, "index.html"), "utf8")
        .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "")
        .replace(/\{\{stylesUri\}\}/g, "styles.css")
        .replace(/\{\{mainUri\}\}/g, "main.js")
        .replace(/\{\{nonce\}\}/g, "n")
        .replace(/\{\{cspSource\}\}/g, "")
        // The host's bridge, stubbed: every message the view sends is kept
        // so a check can assert on what a click asked for.
        .replace("</head>", `<script>
            window.__sent = [];
            window.acquireVsCodeApi = () => ({
                postMessage: m => window.__sent.push(m),
                getState: () => undefined,
                setState: () => {}
            });
        </script></head>`);
}

function serve() {
    const server = http.createServer((req, res) => {
        const name = decodeURIComponent(req.url.split("?")[0]);

        if (name === "/harness.html") {
            res.writeHead(200, { "content-type": "text/html" });
            res.end(harness());
            return;
        }

        const file = path.join(WEB, name);

        if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404).end("not here");
            return;
        }

        res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
        res.end(fs.readFileSync(file));
    });

    return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// --------------------------------------------------
// WHAT IS MEASURED
// --------------------------------------------------
// All of it in the page, in one pass, so every number comes from the same
// layout. The model's own metrics are read back off the document, which
// is where main.js wrote them - so the expected row offsets are the
// model's numbers, not a copy of them.

const MEASURE = `(() => {
    const px = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };

    const canvas = document.querySelector(".graph-canvas:not(.hidden)");

    const text = [];
    const clipped = [];
    const outside = [];

    const cards = [...document.querySelectorAll(".graph-canvas:not(.hidden) .gnode")];

    for (const card of cards) {
        const box = card.getBoundingClientRect();

        for (const el of card.querySelectorAll("*")) {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;

            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none") continue;

            // A drag handle is a decoration drawn half outside the card on
            // purpose, and it is invisible until you hover.
            if (el.classList.contains("handle") || style.opacity === "0") continue;

            const leaf = el.children.length === 0 && (el.textContent || "").trim().length > 0;
            const line = parseFloat(style.lineHeight) || 0;

            if (leaf) {
                text.push({
                    card: card.dataset.id, cls: el.className, label: el.textContent.trim().slice(0, 44),
                    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
                    // Layout pixels, so the zoom cannot make a row look
                    // crushed or make a crushed one look fine.
                    boxH: el.offsetHeight,
                    line: Math.round(line * 10) / 10
                });
            }

            // Cut text has to be cut cleanly, and only a block container
            // can do that: text-overflow does nothing on flex or grid.
            const over = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;

            if (over && leaf) {
                const clamp = style.webkitLineClamp !== "none";
                const ok = clamp || (style.textOverflow === "ellipsis"
                    && style.whiteSpace.includes("nowrap")
                    && !style.display.includes("flex")
                    && !style.display.includes("grid"));
                if (!ok) clipped.push({ card: card.dataset.id, cls: el.className, label: el.textContent.trim().slice(0, 44), display: style.display, whiteSpace: style.whiteSpace, textOverflow: style.textOverflow });
            }

            // Nothing a card draws may sit outside it.
            if (r.right > box.right + 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.top < box.top - 1) {
                outside.push({ card: card.dataset.id, cls: el.className, label: el.textContent.trim().slice(0, 36),
                    by: Math.round(Math.max(r.right - box.right, r.bottom - box.bottom, box.left - r.left, box.top - r.top)) });
            }
        }
    }

    // The rows of a step card and of a Constellation card, against the
    // model's own offsets.
    // In LAYOUT pixels, never client rectangles: the canvas carries a
    // scale transform, so a 36px row reads as 41px at 115% zoom and every
    // comparison against a CSS number would be wrong by the zoom.
    const rowsOf = (card, spec) => {
        if (!card) return null;

        // offsetTop is measured from the parent's INNER border edge, so
        // the card's own border is already out of it - but the card's
        // height includes both, which is checked separately below.
        let top = px("--card-pad-top");
        const out = [];

        for (const [selector, height, gap] of spec) {
            const el = card.querySelector(selector);
            if (!el) { out.push({ selector, missing: true }); continue; }
            out.push({
                selector,
                wantTop: Math.round(top), gotTop: Math.round(el.offsetTop),
                wantH: Math.round(height), gotH: Math.round(el.offsetHeight)
            });
            top += height + gap;
        }

        return { height: card.offsetHeight, out };
    };

    const stepCard = document.querySelector(".graph-canvas:not(.hidden) .gnode.step");
    const featureCard = document.querySelector(".graph-canvas:not(.hidden) .gnode.feature");

    const stepRows = rowsOf(stepCard, [
        [".bar", 3, px("--card-bar-h") - 3],
        [".title", px("--card-title-h"), px("--card-row-gap")],
        [".sub", px("--card-sub-h"), px("--card-row-gap")],
        [".node-detail", px("--card-detail-h"), px("--card-foot-gap")],
        [".node-foot", px("--card-foot-h"), 0]
    ]);

    const featureRows = rowsOf(featureCard, [
        [".bar", 3, px("--card-bar-h") - 3],
        [".title", px("--card-feature-title-h"), px("--card-row-gap")],
        [".sub", px("--card-feature-sub-h"), px("--card-foot-gap")],
        [".node-preview", 3 * px("--card-preview-line-h") + 2 * px("--card-preview-gap"), px("--card-foot-gap")],
        [".node-foot", px("--card-foot-h"), 0]
    ]);

    // Every chip of an open row, and whether it is inside the row's box.
    const chips = [];

    for (const row of document.querySelectorAll(".graph-canvas:not(.hidden) .gnode.open")) {
        const box = row.getBoundingClientRect();
        for (const chip of row.querySelectorAll("[data-chip]")) {
            const r = chip.getBoundingClientRect();
            chips.push({ row: row.dataset.id, id: chip.dataset.chip, label: chip.textContent.trim().slice(0, 36),
                inside: r.top >= box.top - 1 && r.bottom <= box.bottom + 1,
                x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
                topInRow: Math.round(r.top - box.top), rowH: Math.round(box.height) });
        }
    }

    // The top bar: three zones, and every lens pill in full.
    const zone = sel => { const el = document.querySelector(sel); return el ? rect(el) : null; };
    // Only while the bar is actually shown: on the Constellation it is
    // display:none, and a zero box is not a hidden lens.
    const barEl = document.getElementById("lensSwitch");
    const bar = barEl.getBoundingClientRect();

    const pills = bar.width < 1 ? [] : [...barEl.querySelectorAll(".lens-btn")].map(el => {
        const r = el.getBoundingClientRect();
        return {
            label: el.textContent.trim().slice(0, 20),
            visible: r.width > 0 && r.left >= bar.left - 1 && r.right <= bar.right + 1
                && r.top >= bar.top - 1 && r.bottom <= bar.bottom + 1
        };
    });

    const crumbs = [...document.querySelectorAll(".breadcrumb .crumb")].map(el => ({
        label: el.textContent.trim(), cut: el.scrollWidth > el.clientWidth + 1
    }));

    const approve = document.getElementById("approveBtn");

    return {
        text, clipped, outside, stepRows, featureRows, chips, pills, crumbs,
        stepH: px("--card-step-h"), featureH: px("--card-feature-h"),
        zones: { crumb: zone(".breadcrumb"), lens: zone("#lensSwitch"), actions: zone(".view-controls"), toolbar: zone(".toolbar") },
        approveW: approve && !approve.hidden ? Math.round(approve.getBoundingClientRect().width) : null,
        flow: (() => {
            const el = document.querySelector(".graph-canvas:not(.hidden) .flow-tag");
            if (!el || !canvas) return null;
            const r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect();
            return { left: Math.round(r.left - c.left), bottom: Math.round(c.bottom - r.bottom) };
        })(),
        scroll: canvas ? { top: Math.round(canvas.scrollTop), left: Math.round(canvas.scrollLeft) } : null,
        selection: [...document.querySelectorAll(".graph-canvas:not(.hidden) .gnode.selected")].map(el => el.dataset.kind),
        toolbarOn: (() => {
            if (!document.querySelector(".graph-canvas:not(.hidden) .node-toolbar")) return null;
            const sel = document.querySelector(".graph-canvas:not(.hidden) .gnode.selected");
            return sel ? sel.dataset.kind : "none";
        })()
    };
})()`;

// Two leaf texts whose rectangles overlap are drawn over each other.
function overlaps(text) {
    const hits = [];

    for (let i = 0; i < text.length; i += 1) {
        for (let j = i + 1; j < text.length; j += 1) {
            const a = text[i], b = text[j];
            if (Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) <= 1) continue;
            if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) <= 1) continue;
            hits.push(`"${a.label}" over "${b.label}"`);
        }
    }

    return [...new Set(hits)];
}

const crushed = text => text.filter(t => t.line && t.boxH && t.boxH < t.line - 1);

async function run() {
    const { chromium } = findPlaywright();
    const server = await serve();
    const port = server.address().port;
    const browser = await chromium.launch();
    const { state } = await import(`file://${path.join(__dirname, "fixture.mjs")}`);

    fs.mkdirSync(OUT, { recursive: true });

    const problems = [];
    const lines = [];

    for (const size of SIZES) {
        const tag = `${size.width}x${size.height}`;
        const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
        const errors = [];

        page.on("pageerror", e => errors.push(String(e.message)));
        page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

        await page.goto(`http://127.0.0.1:${port}/harness.html`, { waitUntil: "load" });
        await page.waitForTimeout(500);
        await page.evaluate(s => window.dispatchEvent(new MessageEvent("message", { data: { type: "state", state: s } })), state);
        await page.waitForTimeout(800);

        // Where an element is on screen, and how far off the canvas it
        // sits. Never locator.click(): that scrolls the element into
        // view, which scrolls the canvas - it hides real bugs and invents
        // others, and the canvas is exactly what must not scroll.
        const where = (selector, text) => page.evaluate(([s, t]) => {
            const all = [...document.querySelectorAll(s)];
            const el = t ? all.find(e => e.textContent.trim().includes(t)) : all[0];
            if (!el) return null;

            const r = el.getBoundingClientRect();
            const canvas = el.closest(".graph-canvas");
            const c = canvas ? canvas.getBoundingClientRect() : null;

            // A row's head is what opens it, so aim near its top rather
            // than at the middle of a tall open row.
            const y = r.y + Math.min(r.height / 2, 20);

            return {
                x: r.x + r.width / 2,
                y,
                off: !c ? 0 : y < c.top + 30 ? y - (c.top + 60) : y > c.bottom - 30 ? y - (c.bottom - 60) : 0
            };
        }, [selector, text ?? null]);

        // Pan with the wheel until it is on screen - the same gesture a
        // reader has, and the only thing allowed to move the view.
        const reach = async (selector, text) => {
            let box = await where(selector, text);
            if (!box) return null;

            for (let tries = 0; tries < 6 && Math.abs(box.off) > 1; tries += 1) {
                await page.mouse.move(size.width / 2, size.height / 2);
                await page.mouse.wheel(0, box.off);
                await page.waitForTimeout(250);
                box = await where(selector, text);
                if (!box) return null;
            }

            return box;
        };

        const click = async (selector, settle = 1400, optional = false) => {
            const box = await reach(selector);

            if (!box) {
                if (!optional) problems.push(`${tag}: nothing matched ${selector}`);
                return false;
            }

            await page.mouse.click(box.x, box.y);
            await page.waitForTimeout(settle);
            return true;
        };

        const clickText = async (selector, text, settle = 800) => {
            const box = await reach(selector, text);

            if (!box) { problems.push(`${tag}: no ${selector} reading "${text}"`); return false; }

            await page.mouse.click(box.x, box.y);
            await page.waitForTimeout(settle);
            return true;
        };

        const check = async (name, note) => {
            await page.waitForTimeout(300);
            await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });

            const m = await page.evaluate(MEASURE);
            const found = [];

            for (const t of crushed(m.text)) found.push(`row ${t.boxH}px under a ${t.line}px line: "${t.label}"`);
            for (const o of overlaps(m.text)) found.push(`overlap ${o}`);
            for (const o of m.outside) found.push(`${o.cls} "${o.label}" is ${o.by}px outside its card`);
            for (const c of m.clipped) found.push(`cut with no ellipsis (${c.display}/${c.whiteSpace}/${c.textOverflow}): "${c.label}"`);

            for (const [rows, want, what] of [[m.stepRows, m.stepH, "a step card"], [m.featureRows, m.featureH, "a Constellation card"]]) {
                if (rows && rows.height !== want) found.push(`${what} is ${rows.height}px, the model says ${want}`);

                for (const r of rows?.out ?? []) {
                    if (r.missing) { found.push(`no ${r.selector} on the card`); continue; }
                    if (r.wantTop !== r.gotTop) found.push(`${r.selector} starts at ${r.gotTop}, the model says ${r.wantTop}`);
                    if (r.wantH !== r.gotH) found.push(`${r.selector} is ${r.gotH}px, the model says ${r.wantH}`);
                }
            }

            for (const chip of m.chips) {
                if (!chip.inside) found.push(`chip "${chip.label}" sits at ${chip.topInRow}px inside a ${chip.rowH}px row`);
            }

            for (const pill of m.pills) {
                if (!pill.visible) found.push(`lens pill "${pill.label}" is not fully visible`);
            }

            for (const crumb of m.crumbs) {
                if (crumb.label === "Constellation" && crumb.cut) found.push(`the Constellation crumb is cut`);
            }

            const z = m.zones;
            if (z.crumb && z.lens?.w && z.actions) {
                const rows = [z.crumb, z.lens, z.actions].map(b => Math.round(b.y));
                const sameRow = (a, b) => Math.abs(a - b) < 6;
                if (sameRow(rows[0], rows[1]) && z.crumb.right > z.lens.x + 1) found.push(`the lens bar overlaps the breadcrumb`);
                if (sameRow(rows[1], rows[2]) && z.lens.right > z.actions.x + 1) found.push(`the lens bar overlaps the actions`);
                if (sameRow(rows[0], rows[2]) && !z.lens?.w && z.crumb.right > z.actions.x + 1) found.push(`the breadcrumb overlaps the actions`);
            }

            if (m.flow && (m.flow.left !== 22 || m.flow.bottom !== 18)) {
                found.push(`the flow label is at left ${m.flow.left} / bottom ${m.flow.bottom}`);
            }

            if (m.scroll && (m.scroll.top !== 0 || m.scroll.left !== 0)) {
                found.push(`the canvas scrolled to ${m.scroll.top}/${m.scroll.left}`);
            }

            for (const kind of m.selection) {
                if (kind !== "step" && kind !== "feature") found.push(`a ${kind} row is selected`);
            }

            if (m.toolbarOn && m.toolbarOn !== "step") found.push(`the step toolbar is on a ${m.toolbarOn}`);

            for (const e of [...new Set(errors)]) found.push(`page error: ${e}`);
            errors.length = 0;

            lines.push(`  ${tag} ${name} — ${note}${found.length ? "" : "   clean"}`);
            for (const f of found) { lines.push(`      ${f}`); problems.push(`${tag} ${name}: ${f}`); }

            return m;
        };

        // ---- the Constellation, with Project setup open
        await check("01-constellation", "the Constellation");
        await click('.gnode[data-id="setup"]', 700);
        const setup = await check("02-setup-open", "Project setup open");

        if (setup.chips.length === 0) problems.push(`${tag}: Project setup opened onto nothing`);
        else {
            await click(`[data-chip="${setup.chips[0].id}"]`, 700);
            const opened = await page.evaluate(() => document.getElementById("impactPanel").classList.contains("open"));
            if (!opened) problems.push(`${tag}: clicking a Project setup chip opened no panel`);
            await page.evaluate(() => document.getElementById("impactCloseBtn")?.click());
            await page.waitForTimeout(300);
        }

        // ---- a small feature, All
        await click('.gnode[data-id="survey"]');
        await check("03-feature-all", "a small feature under All");

        // ---- Terms open, and a chip's panel
        await click('.gnode[data-id="register:vocabulary"]', 700);
        const terms = await check("04-terms-open", "Terms open");

        if (terms.chips.length < 3) problems.push(`${tag}: Terms opened onto ${terms.chips.length} chips, expected 3`);
        else {
            await click(`[data-chip="${terms.chips[2].id}"]`, 700);
            const opened = await page.evaluate(() => document.getElementById("impactPanel").classList.contains("open"));
            if (!opened) problems.push(`${tag}: clicking a Terms chip opened no panel`);
            await check("05-term-panel", "a term's detail panel");

            // ---- a refresh with that panel open
            await page.evaluate(s => window.dispatchEvent(new MessageEvent("message", { data: { type: "state", state: s } })), state);
            await page.waitForTimeout(800);
            const still = await page.evaluate(() => document.getElementById("impactPanel").classList.contains("open"));
            if (!still) problems.push(`${tag}: a refresh closed the term's panel`);
            await check("06-refresh-term-panel", "a refresh with the term's panel open");
            await page.evaluate(() => document.getElementById("impactCloseBtn")?.click());
            await page.waitForTimeout(300);
        }

        // ---- each lens, with a fold opened
        for (const lens of ["Frontend", "Backend", "Database", "Security"]) {
            if (!await clickText(".lens-btn", lens)) continue;
            await check(`07-lens-${lens.toLowerCase()}`, `under ${lens}`);
            if (await click(".gnode.fold", 700, true)) await check(`08-lens-${lens.toLowerCase()}-open`, `under ${lens}, a fold opened`);
        }

        await clickText(".lens-btn", "All");

        // ---- a summary step's panel
        await click('.gnode[data-id="createApp"]');
        await check("09-summary-panel", "a summary step's panel");
        await page.evaluate(() => document.getElementById("impactCloseBtn")?.click());
        await page.waitForTimeout(300);

        // ---- 40 tabs inside a feature
        for (let at = 0; at < 40; at += 1) await page.keyboard.press("Tab");
        await page.waitForTimeout(500);
        await check("10-after-tabs", "40 presses of Tab");

        const focused = await page.evaluate(() => {
            const el = document.activeElement;
            return { hidden: Boolean(el?.closest(".graph-canvas.hidden")), tag: el?.tagName };
        });
        if (focused.hidden) problems.push(`${tag}: Tab reached a card on a hidden canvas`);

        // ---- a folded feature with a part open
        await click('.crumb[data-up="top"]');
        await click('.gnode[data-id="express"]');
        await check("11-folded", "a feature over 12 steps");
        await click(".gnode.part", 900);
        await check("12-part-open", "with one part open");

        // ---- Find, and the list closing behind it
        await page.evaluate(() => { const i = document.getElementById("findInput"); i.value = "thank"; i.dispatchEvent(new Event("input")); });
        await page.waitForTimeout(500);
        await check("13-find-open", "the Find list open");
        await click(".find-hit", 1600);
        const findShut = await page.evaluate(() => {
            const el = document.getElementById("findResults");
            return el.hasAttribute("hidden") && getComputedStyle(el).display === "none";
        });
        if (!findShut) problems.push(`${tag}: the Find list stayed on screen after a result was chosen`);
        await check("14-after-find", "after choosing a Find result");

        await page.close();
    }

    await browser.close();
    server.close();

    console.log(lines.join("\n"));
    console.log("");

    if (problems.length === 0) {
        console.log(`Clean: ${SIZES.length} sizes, nothing to report. Screenshots in ${path.relative(process.cwd(), OUT)}/`);
        return 0;
    }

    console.log(`${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
    for (const p of problems) console.log(`  ${p}`);
    return 1;
}

run().then(code => process.exit(code)).catch(error => { console.error(error); process.exit(1); });

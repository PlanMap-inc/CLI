import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// --------------------------------------------------
// COLOUR SURVIVES THE CONTENT SECURITY POLICY
// --------------------------------------------------
// The policy has no 'unsafe-inline' for styles, so a style="" attribute that
// arrives inside an innerHTML string is parsed and silently dropped - no
// console error, no exception, just a grey interface. Every lens swatch,
// step bar and edge stroke went that way once. The rule that keeps it fixed:
// markup carries data-style, and paint() assigns it through the CSSOM.
// --------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const webview = path.join(here, "..", "webview");
const read = file => readFileSync(path.join(webview, file), "utf8");

const html = read("index.html");

// The policy stays strict. Relaxing it is the other way to make the colours
// appear, and it is the wrong one.
assert.match(html, /style-src \{\{cspSource\}\};/, "index.html no longer states the style policy this test guards");
assert.doesNotMatch(html, /unsafe-inline/, "style-src gained 'unsafe-inline'");

// Nothing writes a style attribute into markup. Code comments are allowed to
// name the trap, so only real attributes count: a quote, then a declaration.
for (const file of readdirSync(webview).filter(name => name.endsWith(".js") || name.endsWith(".html"))) {
    const source = read(file);
    const offenders = [...source.matchAll(/[\s"'`]style="[^"]*[:$]/g)].map(m => m[0]);
    assert.deepEqual(offenders, [], `${file} sets a style attribute in markup; use data-style + paint()`);
}

// Whoever emits data-style has to import paint, or the colour never lands.
for (const file of readdirSync(webview).filter(name => name.endsWith(".js"))) {
    const source = read(file);
    if (!source.includes('data-style="')) continue;
    assert.match(source, /from "\.\/paint\.js"/, `${file} emits data-style but never imports paint()`);
    assert.match(source, /\bpaint\(/, `${file} imports paint() but never calls it`);
}

console.log("PASS: csp-styles");

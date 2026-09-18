import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../out/cli.js";
import { parseScanProgress } from "../webview/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Real lines from a scan of a 284-declaration project.
const scan = [
    "Found 284 declarations",
    "Baseline written: /work/project/.planmap/baseline.json",
    "",
    "Evolution classification: 284 events in 10 batch(es).",
    "",
    "Classifying label batch 1/10",
    "Label batch 1 persisted successfully."
];

assert.deepEqual(parseScanProgress([]), {
    percent: null, label: "Starting…", total: null, done: 0, failed: 0, declarations: null, finished: false
});

assert.equal(parseScanProgress(["Found 284 declarations"]).declarations, 284);
assert.equal(parseScanProgress(["Found 1 declarations"]).label, "1 declaration found");

const started = parseScanProgress(scan.slice(0, 6));
assert.equal(started.total, 10);
assert.equal(started.percent, 0, "no batch is finished yet");
assert.equal(started.label, "Classifying batch 1 of 10");

const oneDone = parseScanProgress(scan);
assert.equal(oneDone.done, 1);
assert.equal(oneDone.percent, 10);

// A batch that fell back still counts as finished, and is reported at the end.
const halfway = parseScanProgress([
    ...scan,
    "Classifying label batch 2/10",
    "Label batch 2 failed.",
    "Falling back to path-based labels for this batch: OpenRouter request failed (429)",
    "Classifying label batch 3/10",
    "Label batch 3 persisted successfully."
]);
assert.equal(halfway.done, 3);
assert.equal(halfway.failed, 1);
assert.equal(halfway.percent, 30);

const finished = parseScanProgress([...scan, "Evolution written: /work/project/.planmap/evolution.json"]);
assert.equal(finished.percent, 100);
assert.equal(finished.finished, true);
assert.equal(finished.label, "Done");

assert.equal(parseScanProgress(["Label batch 1 failed.", "Evolution written: x"]).label, "Done, 1 batch without AI");
assert.equal(parseScanProgress(["OPENROUTER_API_KEY not configured."]).label, "No API key: labelling from file paths");
assert.equal(parseScanProgress(["Plan drafted: /work/project"]).percent, 100);

// The host streams whole lines while the command is still running.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-progress-"));
const script = path.join(root, "chatty.js");

fs.writeFileSync(script, `
process.stdout.write("Found 3 decl");
process.stdout.write("arations\\nEvolution classification: 3 events in 1 batch(es).\\n");
process.stderr.write("OPENROUTER_API_KEY not configured.\\n");
process.stdout.write("no trailing newline");
`);

const seen = [];
const result = await runCli([], {
    nodePath: process.execPath,
    cliPath: script,
    cwd: root,
    runAsNode: false,
    onLine: line => seen.push(line)
});

assert.equal(result.outcome, "ok");
assert.deepEqual(seen, [
    "Found 3 declarations",
    "Evolution classification: 3 events in 1 batch(es).",
    "OPENROUTER_API_KEY not configured.",
    "no trailing newline"
], "split writes are joined, and the last line without a newline still arrives");

assert.equal(parseScanProgress(seen).declarations, 3);

fs.rmSync(root, { recursive: true, force: true });

// The webview renders the bar from those lines, and asks for nothing else.
const main = fs.readFileSync(path.resolve(HERE, "../webview/main.js"), "utf8");
assert.match(main, /if \(message\?\.type === "progress"\) onProgress\(message\)/);
assert.match(main, /class="progress-bar\$\{indeterminate \? " indeterminate" : ""\}/);
assert.match(main, /logs\[key\] = \[\]/, "each run starts with an empty log");

console.log("PASS: progress");

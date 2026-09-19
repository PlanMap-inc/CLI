import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// --------------------------------------------------
// CONFIGURATION FOLLOWS THE TOOL, NOT THE SHELL
// --------------------------------------------------
// .env was read from process.cwd() and nowhere else. Run PlanMap against a
// repo somewhere else - which is the normal way to use it - and no .env was
// found, so the endpoint, the model and the key all fell back at once. The
// fallback is a local Ollama, so every batch failed against a server that
// was never running, and the message said only "the model did not answer".
// --------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const configUrl = new URL("file://" + path.join(root, "src", "llm", "config.js")).href;

const probe = `
const m = await import(${JSON.stringify(configUrl)});
process.stdout.write(JSON.stringify({
    endpoint: m.LLM_ENDPOINT,
    model: m.LLM_MODEL,
    local: m.isLocalLlm(),
    key: Boolean(m.loadLlmApiKey())
}));
`;

const readFrom = (cwd, env = {}) => JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
        cwd,
        env: { ...process.env, ...env },
        encoding: "utf8"
    })
);

const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-cwd-"));

try {
    const hasOwnEnv = fs.existsSync(path.join(root, ".env"));

    const fromRoot = readFrom(root);
    const fromElsewhere = readFrom(elsewhere);

    // Standing somewhere else must not change what PlanMap is pointed at.
    assert.equal(
        fromElsewhere.endpoint, fromRoot.endpoint,
        "the endpoint changed with the working directory"
    );
    assert.equal(
        fromElsewhere.model, fromRoot.model,
        "the model changed with the working directory"
    );
    assert.equal(
        fromElsewhere.key, fromRoot.key,
        "the API key was not found from another directory"
    );

    if (hasOwnEnv) {
        assert.equal(
            fromElsewhere.local, false,
            "fell back to a local model although PlanMap's own .env configures one"
        );
    }

    // The environment still wins over both .env files.
    const overridden = readFrom(elsewhere, {
        PLANMAP_LLM_ENDPOINT: "https://example.invalid/v1/chat/completions",
        PLANMAP_LLM_MODEL: "test/model"
    });
    assert.equal(overridden.endpoint, "https://example.invalid/v1/chat/completions");
    assert.equal(overridden.model, "test/model");
} finally {
    fs.rmSync(elsewhere, { recursive: true, force: true });
}

// The failure must name the endpoint it could not reach: a local URL there
// is the whole diagnosis, and it was being thrown away before printing.
const evolution = fs.readFileSync(path.join(root, "src", "cli", "commands", "evolution.js"), "utf8");
assert.ok(
    !evolution.includes('"the model did not answer; waiting 5s and trying again."'),
    "the retry message still discards the endpoint from the error"
);
assert.ok(
    evolution.includes("Model: ${LLM_MODEL} at ${LLM_ENDPOINT}"),
    "the run no longer says which model it is about to ask"
);

console.log("PASS: llm-config-cwd-regression");

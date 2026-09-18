import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../out/cli.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.resolve(HERE, "..", file), "utf8");

// The settings a user needs to point PlanMap at a local model.
const pkg = JSON.parse(read("package.json"));
const properties = pkg.contributes.configuration.properties;

for (const name of ["planmap.llmEndpoint", "planmap.llmModel", "planmap.llmBatchSize"]) {
    assert.ok(properties[name], `${name} is missing`);
}
assert.match(properties["planmap.llmEndpoint"].markdownDescription, /localhost:11434/, "the local endpoint is spelled out");
assert.equal(properties["planmap.llmEndpoint"].default, "", "empty means the CLI's own default, which is local");

// An unset endpoint is treated as the local default, so the setup card says so.
const host = read("src/extension.ts");
assert.match(host, /get<string>\("llmEndpoint"\)\?\.trim\(\) \|\|\s*\n\s*"http:\/\/localhost:11434\/v1\/chat\/completions"/);
assert.match(host, /\? "local"/);

// The host turns those settings into the CLI's environment.
assert.match(host, /PLANMAP_LLM_ENDPOINT: config\.get<string>\("llmEndpoint"\)/);
assert.match(host, /PLANMAP_LLM_MODEL: config\.get<string>\("llmModel"\)/);
assert.match(host, /PLANMAP_LLM_BATCH_SIZE: String\(config\.get<number>\("llmBatchSize"\)/);

// runCli passes that environment to the CLI, and skips empty values.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "planmap-ext-llm-"));
const script = path.join(root, "print-env.js");

fs.writeFileSync(script, `
for (const name of ["PLANMAP_LLM_ENDPOINT", "PLANMAP_LLM_MODEL", "PLANMAP_LLM_BATCH_SIZE", "OPENROUTER_API_KEY"]) {
    console.log(name + "=" + (process.env[name] ?? "<unset>"));
}
`);

const options = {
    nodePath: process.execPath,
    cliPath: script,
    cwd: root,
    runAsNode: false
};

const configured = await runCli([], {
    ...options,
    apiKey: "",
    env: {
        PLANMAP_LLM_ENDPOINT: "http://localhost:11434/v1/chat/completions",
        PLANMAP_LLM_MODEL: "qwen2.5-coder:7b",
        PLANMAP_LLM_BATCH_SIZE: ""
    }
});

assert.match(configured.stdout, /PLANMAP_LLM_ENDPOINT=http:\/\/localhost:11434\/v1\/chat\/completions/);
assert.match(configured.stdout, /PLANMAP_LLM_MODEL=qwen2\.5-coder:7b/);
assert.match(configured.stdout, /PLANMAP_LLM_BATCH_SIZE=<unset>/, "an empty setting is left to the CLI's own default");
assert.match(configured.stdout, /OPENROUTER_API_KEY=$/m, "no key is needed for a local model");

// With nothing configured, the CLI's own defaults apply.
const bare = await runCli([], options);
assert.match(bare.stdout, /PLANMAP_LLM_ENDPOINT=<unset>/);
assert.match(bare.stdout, /PLANMAP_LLM_MODEL=<unset>/);

fs.rmSync(root, { recursive: true, force: true });

console.log("PASS: llm-settings");

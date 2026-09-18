import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCli, ROOT } from "../helpers/run-cli.mjs";
import { parseOpenRouterJson } from "../../src/llm/response.js";

/*
 * 1. The provider is configurable, and a local model needs no API key.
 *    config.js reads the environment when it is first imported, so each
 *    case imports it with its own query string.
 */
{
    // Each case runs from a directory with no .env, with its own environment,
    // so only the environment decides. config.js reads it when first imported.
    const withConfig = async (env, tag, check) => {
        const previous = { ...process.env };
        const cwd = process.cwd();

        Object.assign(process.env, env);
        process.chdir(os.tmpdir());

        try {
            check(await import(`../../src/llm/config.js?case=${tag}`));
        } finally {
            process.chdir(cwd);
            process.env = previous;
        }
    };

    // The default is a local model: free, unlimited, and no key.
    await withConfig(
        { PLANMAP_LLM_ENDPOINT: "", PLANMAP_LLM_MODEL: "", OPENROUTER_API_KEY: "" },
        "default",
        config => {
            assert.equal(config.LLM_ENDPOINT, "http://localhost:11434/v1/chat/completions");
            assert.equal(config.LLM_MODEL, "qwen2.5-coder:7b");
            assert.equal(config.isLocalLlm(), true);
            assert.equal(config.llmAvailable(), true, "a local model needs no API key");

            for (const endpoint of ["http://127.0.0.1:11434/v1/chat/completions", "http://localhost:8080/v1", "https://[::1]:1234/v1"]) {
                assert.equal(config.isLocalLlm(endpoint), true, endpoint);
            }
        }
    );

    // OpenRouter is still reachable through the environment, and still needs a key.
    await withConfig(
        {
            PLANMAP_LLM_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",
            PLANMAP_LLM_MODEL: "nvidia/nemotron-3-ultra-550b-a55b:free",
            OPENROUTER_API_KEY: ""
        },
        "openrouter",
        config => {
            assert.equal(config.LLM_ENDPOINT, "https://openrouter.ai/api/v1/chat/completions");
            assert.equal(config.isLocalLlm(), false);
            assert.equal(config.llmAvailable(), false, "a hosted provider with no key cannot classify");

            for (const endpoint of ["https://openrouter.ai/api/v1/chat/completions", "https://localhost.evil.com/v1", "https://api.example.com/v1"]) {
                assert.equal(config.isLocalLlm(endpoint), false, endpoint);
            }
        }
    );

    await withConfig(
        {
            PLANMAP_LLM_ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",
            OPENROUTER_API_KEY: "sk-test",
            PLANMAP_LLM_MODEL: ""
        },
        "openrouter-key",
        config => {
            assert.equal(config.llmAvailable(), true, "a key makes the hosted provider usable");
        }
    );
}

/*
 * 2. Smaller models wrap their JSON in a sentence. Take the JSON.
 */
{
    const expected = [{ ts: "t", identity: "a.js::a:function", feature: "Login" }];

    assert.deepEqual(parseOpenRouterJson(JSON.stringify(expected)), expected);
    assert.deepEqual(parseOpenRouterJson("```json\n" + JSON.stringify(expected) + "\n```"), expected);
    assert.deepEqual(parseOpenRouterJson("Here is the JSON array:\n\n" + JSON.stringify(expected)), expected);
    assert.deepEqual(parseOpenRouterJson(JSON.stringify(expected) + "\n\nLet me know if you need anything else."), expected);
    assert.deepEqual(parseOpenRouterJson('Sure!\n{"classifications": []}\nDone.'), { classifications: [] });

    assert.throws(
        () => parseOpenRouterJson("I cannot classify these declarations."),
        /OpenRouter returned invalid JSON/
    );

    assert.throws(
        () => parseOpenRouterJson('[{"ts": "t", "identity"'),
        /OpenRouter returned invalid JSON/,
        "a truncated reply is still an error"
    );
}

/*
 * 3. PLANMAP_LLM_BATCH_SIZE decides how many declarations go in one request.
 */
{
    const root =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "planmap-llm-batch-"
            )
        );

    fs.writeFileSync(
        path.join(root, "a.js"),
        ["one", "two", "three", "four", "five"]
            .map(name => `export function ${name}() { return "${name}"; }`)
            .join("\n") + "\n"
    );

    assert.equal(runCli(["init", root], ROOT).code, 0);

    const response =
        JSON.stringify({ classifications: [] });

    const batched =
        runCli(
            ["evolution", root],
            root,
            {
                apiKey: "test-key",
                response,
                mock: true,
                env: { PLANMAP_LLM_BATCH_SIZE: "2" }
            }
        );

    assert.match(
        batched.stdout,
        /Evolution classification: 5 events in 3 batch\(es\)\./,
        `five declarations in batches of two is three batches:\n${batched.stdout}`
    );

    fs.rmSync(root, { recursive: true, force: true });
}

console.log("llm provider regression passed");

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../helpers/run-cli.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.join(HERE, "helpers", "scripted-openrouter-mock.mjs");

const EPOCH = "1970-01-01T00:00:00.000Z";
const DIRECTORIES = ["feature-a", "feature-b", "feature-c", "feature-d", "feature-e"];
const NAMES = ["featureA", "featureB", "featureC", "featureD", "featureE"];

function makeProject() {
    const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "planmap-evolution-failure-")
    );

    for (let i = 0; i < DIRECTORIES.length; i++) {
        const dir = path.join(projectRoot, DIRECTORIES[i]);
        fs.mkdirSync(dir);

        fs.writeFileSync(
            path.join(dir, "index.js"),
            `export function ${NAMES[i]}() {\n    return "${NAMES[i]}";\n}\n`,
            "utf8"
        );
    }

    return projectRoot;
}

function identityFor(index) {
    return `${DIRECTORIES[index]}/index.js::${NAMES[index]}:function`;
}

function successEntry(index) {
    return {
        classifications: [
            {
                ts: EPOCH,
                identity: identityFor(index),
                feature: "batch test feature",
                label: "handles a batch test event",
                tags: []
            }
        ]
    };
}

function readEvolution(projectRoot) {
    return JSON.parse(
        fs.readFileSync(
            path.join(projectRoot, ".planmap", "evolution.json"),
            "utf8"
        )
    );
}

function runEvolution(projectRoot, script) {
    return runCli(
        ["evolution", projectRoot],
        projectRoot,
        {
            apiKey: "test-key",
            nodeOptions: [`--import=${MOCK}`],
            env: {
                PLANMAP_MOCK_SCRIPT: JSON.stringify(script)
            }
        }
    );
}


// ------------------------------------------------------------
// SCENARIO 1: batch 3 of 5 returns truncated JSON — 4 and 5 still run
// ------------------------------------------------------------
{
    const projectRoot = makeProject();

    assert.equal(runCli(["init", projectRoot], projectRoot).code, 0);

    const script = [
        successEntry(0),
        successEntry(1),
        { truncated: true },
        successEntry(3),
        successEntry(4)
    ];

    const result = runEvolution(projectRoot, script);

    const evolution = readEvolution(projectRoot);
    const byIdentity = new Map(
        evolution.nodes.map(node => [node.identity, node])
    );

    assert.equal(
        byIdentity.get(identityFor(3)).labelSource,
        "llm",
        "batch 4 must still be classified after batch 3 fails"
    );

    assert.equal(
        byIdentity.get(identityFor(4)).labelSource,
        "llm",
        "batch 5 must still be classified after batch 3 fails"
    );

    assert.notEqual(
        result.code,
        0,
        "a truncated batch must also set a non-zero exit code"
    );

    console.log("PASS: scenario 1 - later batches survive a truncated batch");
}


// ------------------------------------------------------------
// SCENARIO 2: a failed batch's events get labelSource "path"
// ------------------------------------------------------------
{
    const projectRoot = makeProject();

    assert.equal(runCli(["init", projectRoot], projectRoot).code, 0);

    const script = [
        successEntry(0),
        successEntry(1),
        { fail: true },
        successEntry(3),
        successEntry(4)
    ];

    runEvolution(projectRoot, script);

    const evolution = readEvolution(projectRoot);
    const byIdentity = new Map(
        evolution.nodes.map(node => [node.identity, node])
    );

    assert.equal(
        byIdentity.get(identityFor(2)).labelSource,
        "path",
        "the failed batch's event must fall back to a path label, not be left unclassified"
    );

    console.log("PASS: scenario 2 - failed batch falls back to path labels");
}


// ------------------------------------------------------------
// SCENARIO 3: any failed batch means a non-zero exit code
// ------------------------------------------------------------
{
    const projectRoot = makeProject();

    assert.equal(runCli(["init", projectRoot], projectRoot).code, 0);

    const script = [
        successEntry(0),
        successEntry(1),
        { fail: true },
        successEntry(3),
        successEntry(4)
    ];

    const result = runEvolution(projectRoot, script);

    assert.notEqual(
        result.code,
        0,
        `expected a non-zero exit code when a batch fails:\n${result.stdout}\n${result.stderr}`
    );

    console.log("PASS: scenario 3 - one failed batch sets a non-zero exit code");
}


// ------------------------------------------------------------
// SCENARIO 4: all batches succeed - exit 0
// ------------------------------------------------------------
{
    const projectRoot = makeProject();

    assert.equal(runCli(["init", projectRoot], projectRoot).code, 0);

    const script = [0, 1, 2, 3, 4].map(successEntry);

    const result = runEvolution(projectRoot, script);

    assert.equal(
        result.code,
        0,
        `expected exit 0 when every batch succeeds:\n${result.stdout}\n${result.stderr}`
    );

    const evolution = readEvolution(projectRoot);

    for (const node of evolution.nodes) {
        assert.equal(node.labelSource, "llm");
    }

    console.log("PASS: scenario 4 - all batches succeeding exits 0");
}


// ------------------------------------------------------------
// SCENARIO 5: all batches fail - non-zero exit, but evolution.json
// is still written with path labels for every event
// ------------------------------------------------------------
{
    const projectRoot = makeProject();

    assert.equal(runCli(["init", projectRoot], projectRoot).code, 0);

    const script = [0, 1, 2, 3, 4].map(() => ({ fail: true }));

    const result = runEvolution(projectRoot, script);

    assert.notEqual(result.code, 0);

    const evolution = readEvolution(projectRoot);

    assert.equal(evolution.nodes.length, DIRECTORIES.length);

    for (const node of evolution.nodes) {
        assert.equal(
            node.labelSource,
            "path",
            `${node.identity} must have a path fallback label even though every batch failed`
        );
    }

    console.log("PASS: scenario 5 - total failure still persists fallback labels");
}


// ------------------------------------------------------------
// SCENARIO 6: no API key - unchanged deterministic offline path, exit 0
// ------------------------------------------------------------
{
    const projectRoot = makeProject();

    assert.equal(runCli(["init", projectRoot], projectRoot).code, 0);

    const result = runCli(
        ["evolution", projectRoot],
        projectRoot,
        { apiKey: "" }
    );

    assert.equal(
        result.code,
        0,
        `expected exit 0 with no API key configured:\n${result.stdout}\n${result.stderr}`
    );

    const evolution = readEvolution(projectRoot);

    assert.equal(evolution.nodes.length, DIRECTORIES.length);

    for (const node of evolution.nodes) {
        assert.equal(node.labelSource, "path");
    }

    console.log("PASS: scenario 6 - offline fallback is unchanged");
}


console.log("PASS: evolution failure regression");

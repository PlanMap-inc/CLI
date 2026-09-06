import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runCli, ROOT } from "../helpers/run-cli.mjs";

const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "planmap-real-repo-")
);

const repo = path.join(root, "repo");

execFileSync(
    "git",
    [
        "clone",
        "--depth",
        "1",
        "https://github.com/pmndrs/zustand.git",
        repo
    ],
    {
        encoding: "utf8",
        stdio: "ignore"
    }
);

const init = runCli(
    ["init", repo],
    ROOT
);

assert.equal(
    init.code,
    0,
    `init failed:\n${init.stdout}\n${init.stderr}`
);

const baselinePath = path.join(
    repo,
    ".planmap",
    "baseline.json"
);

const planPath = path.join(
    repo,
    ".planmap",
    "plan.json"
);

assert.ok(
    fs.existsSync(baselinePath),
    "baseline.json was not created"
);

const baseline = JSON.parse(
    fs.readFileSync(
        baselinePath,
        "utf8"
    )
);

assert.ok(
    Array.isArray(baseline.declarations)
);

assert.ok(
    baseline.declarations.length >= 400,
    `expected at least 400 declarations, got ${baseline.declarations.length}`
);

const checkClean = runCli(
    ["check", repo],
    ROOT
);

assert.equal(
    checkClean.code,
    0,
    `clean check failed:\n${checkClean.stdout}\n${checkClean.stderr}`
);

const target = baseline.declarations.find(
    declaration =>
        declaration.identity.includes(
            "ssrSafe.ssrSet"
        )
);

assert.ok(
    target,
    "ssrSafe.ssrSet was not found"
);

const identity = target.identity;

const plan = {
    version: 1,
    project: "zustand-real-repo",
    lenses: [
        {
            id: "safety",
            label: "safety"
        }
    ],
    features: [
        {
            id: "ssr",
            name: "ssr"
        }
    ],
    nodes: [
        {
            id: "plan_0001",
            identity,
            kind: "function",
            file: identity.split("::")[0],
            symbol: identity.split("::")[1],
            title: "SSR guard must throw",
            intent: "The SSR setter must throw when state is set during SSR.",
            status: "intended",
            origin: "ai_drafted",
            feature: "ssr",
            lensTags: ["safety"],
            rules: [
                {
                    kind: "behaviour",
                    target: identity,
                    assert: {
                        throws: {
                            op: "==",
                            value: 1
                        }
                    }
                }
            ]
        }
    ]
};

fs.writeFileSync(
    planPath,
    JSON.stringify(plan, null, 2) + "\n"
);

const approve = runCli(
    ["approve", repo, identity],
    ROOT
);

assert.equal(
    approve.code,
    0,
    `approve failed:\n${approve.stdout}\n${approve.stderr}`
);

const approvedPlan = JSON.parse(
    fs.readFileSync(
        planPath,
        "utf8"
    )
);

assert.equal(
    approvedPlan.nodes[0].status,
    "approved"
);

assert.equal(
    approvedPlan.nodes[0].approvedFacts.throws,
    1
);

const verify = runCli(
    ["verify", repo],
    ROOT
);

assert.equal(
    verify.code,
    0,
    `verify failed:\n${verify.stdout}\n${verify.stderr}`
);

assert.match(
    verify.stdout,
    /Approved: 1/
);

assert.match(
    verify.stdout,
    /Verified: 1/
);

console.log(
    "PASS: Layer 8 real-repo regression suite"
);

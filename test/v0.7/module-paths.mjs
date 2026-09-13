import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isSourceFile, scanProject } from "../../src/baseline/scanner.js";
import { parseFile } from "../../src/baseline/parser.js";
import { diffDeclarations, formatDiff } from "../../src/changes/diff.js";
import { analyzeSignificance } from "../../src/changes/significance.js";
import { buildCallerIndex, findCallers } from "../../src/dependencies/callers.js";
import { resolveFileImports, resolveProjectImports } from "../../src/dependencies/resolver.js";
import { buildGraph } from "../../src/dependencies/graph.js";
import { joinDependencies, buildDeclarationFileIndex } from "../../src/dependencies/join.js";
import { findImpact } from "../../src/impact/analysis.js";
import { verifyPlan } from "../../src/verification/engine.js";
import { createEmptyPlan, validatePlan } from "../../src/plan/model.js";
import { getPlanPath, readPlan, writePlan } from "../../src/plan/storage.js";
import { evaluateClause } from "../../src/plan/evaluate.js";
import { approveNode, rejectNode, reviseNode, selectNodes } from "../../src/plan/approval.js";
import {
    deriveEvolutionStatus,
    buildEvolutionIdentityIndex,
    applyVerificationStatus,
    applyEvolutionStatus
} from "../../src/evolution/status.js";

const modules = [
    ["src/baseline/scanner.js", { isSourceFile, scanProject }],
    ["src/baseline/parser.js", { parseFile }],
    ["src/changes/diff.js", { diffDeclarations, formatDiff }],
    ["src/changes/significance.js", { analyzeSignificance }],
    ["src/dependencies/callers.js", { buildCallerIndex, findCallers }],
    ["src/dependencies/resolver.js", { resolveFileImports, resolveProjectImports }],
    ["src/dependencies/graph.js", { buildGraph }],
    ["src/dependencies/join.js", { joinDependencies, buildDeclarationFileIndex }],
    ["src/impact/analysis.js", { findImpact }],
    ["src/verification/engine.js", { verifyPlan }],
    ["src/plan/model.js", { createEmptyPlan, validatePlan }],
    ["src/plan/storage.js", { getPlanPath, readPlan, writePlan }],
    ["src/plan/evaluate.js", { evaluateClause }],
    ["src/plan/approval.js", { approveNode, rejectNode, reviseNode, selectNodes }],
    [
        "src/evolution/status.js",
        { deriveEvolutionStatus, buildEvolutionIdentityIndex, applyVerificationStatus, applyEvolutionStatus }
    ]
];

for (const [modulePath, symbols] of modules) {
    for (const [name, value] of Object.entries(symbols)) {
        assert.equal(
            typeof value,
            "function",
            `${modulePath} should export ${name} as a function`
        );
    }
}

const repoRoot =
    path.resolve(
        path.dirname(
            new URL(import.meta.url).pathname
        ),
        "../.."
    );

const cliPath = path.join(repoRoot, "src", "cli", "cli.js");

assert.equal(
    fs.existsSync(cliPath),
    true,
    "src/cli/cli.js should exist"
);

console.log("PASS: module paths");

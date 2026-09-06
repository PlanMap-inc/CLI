import fs from "node:fs";
import path from "node:path";

import {
    readPlan,
    getPlanPath
} from "../plan/storage.js";
import { verifyPlan } from "../plan/verify.js";
import {
    readEvolution,
    writeEvolution
} from "../evolution/storage.js";
import {
    applyVerificationStatus
} from "../evolution/status.js";

function relativeDate(iso) {
    if (!iso) {
        return "unknown date";
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return "unknown date";
    }

    const days =
        Math.floor(
            (Date.now() - date.getTime()) /
            86400000
        );

    if (days <= 0) {
        return "today";
    }

    if (days === 1) {
        return "1 day ago";
    }

    return `${days} days ago`;
}

function summarize(results) {
    const summary = {
        approved: results.length,
        verified: 0,
        drifted: 0,
        errors: 0,
        unsupported: 0
    };

    for (const result of results) {
        if (
            result.status === "implemented" ||
            result.status === "verified"
        ) {
            summary.verified += 1;
        }

        if (result.status === "drifted") {
            summary.drifted += 1;
        }

        if (result.status === "error") {
            summary.errors += 1;
        }

        if (
            Array.isArray(result.unsupported) &&
            result.unsupported.length > 0
        ) {
            summary.unsupported +=
                result.unsupported.length;
        }
    }

    return summary;
}

function printSummary(summary) {
    console.log(
        `Approved: ${summary.approved}`
    );

    console.log(
        `Verified: ${summary.verified}`
    );

    console.log(
        `Drifted: ${summary.drifted}`
    );

    console.log(
        `Errors: ${summary.errors}`
    );

    console.log(
        `Unsupported: ${summary.unsupported}`
    );
}

function printDrifted(results) {
    const drifted =
        results.filter(
            result =>
                result.status === "drifted"
        );

    if (drifted.length === 0) {
        return;
    }

    console.log("\nDRIFTED");

    for (const result of drifted) {
        console.log(
            `\n${result.identity}`
        );

        console.log(
            `  Intent: ${result.intent ?? "unknown"}`
        );

        console.log(
            `  Approver: ${result.approvedBy ?? "unknown"}`
        );

        console.log(
            `  Approved: ${relativeDate(result.approvedAt)}`
        );

        for (const violation of result.violations ?? []) {
            console.log(
                `  Violation: ${violation.reason ?? violation.message ?? "constraint failed"}`
            );
        }

        for (const impact of result.impact ?? []) {
            console.log(
                `  Impact: ${impact.identity ?? impact.target ?? "unknown"}`
            );

            console.log(
                `    Confidence: ${impact.confidence ?? "unknown"}`
            );
        }
    }
}

function printErrors(results) {
    const errors =
        results.filter(
            result =>
                result.status === "error"
        );

    if (errors.length === 0) {
        return;
    }

    console.log("\nERROR");

    for (const result of errors) {
        console.log(
            `\n${result.identity}`
        );

        for (const error of result.errors ?? []) {
            console.log(
                `  ${error.message ?? error}`
            );
        }
    }
}

function printUnsupported(results) {
    const items = [];

    for (const result of results) {
        for (const unsupported of result.unsupported ?? []) {
            items.push({
                identity: result.identity,
                unsupported
            });
        }
    }

    if (items.length === 0) {
        return;
    }

    console.log("\nUNSUPPORTED");

    for (const item of items) {
        console.log(
            `  ${item.identity}: ${typeof item.unsupported === "string"
                ? item.unsupported
                : JSON.stringify(item.unsupported)}`
        );
    }
}

export async function runVerify(
    projectPath,
    options = {}
) {
    if (!projectPath) {
        console.error(
            "Usage: node src/cli.js verify <project-folder> [--json] [--lens <id>] [--identity <id>] [--only drifted] [--strict]"
        );

        process.exitCode = 1;
        return;
    }

    const projectRoot =
        path.resolve(projectPath);

    if (!fs.existsSync(projectRoot)) {
        console.error(
            `Project folder not found: ${projectPath}`
        );

        process.exitCode = 1;
        return;
    }

    const planPath =
        getPlanPath(
            projectRoot
        );

    if (!fs.existsSync(planPath)) {
        const message =
            "No plan found. Run 'planmap plan draft' first.";

        if (options.json) {
            console.log(
                JSON.stringify({
                    approved: 0,
                    verified: 0,
                    drifted: 0,
                    errors: 0,
                    unsupported: 0,
                    timestamp: new Date().toISOString(),
                    project: projectRoot,
                    message
                })
            );
        } else {
            console.log(message);
        }

        process.exitCode = 2;
        return;
    }

    const plan =
        readPlan(projectRoot);

    const approvedNodes =
        (plan.nodes ?? []).filter(
            node =>
                node?.status === "approved"
        );

    if (approvedNodes.length === 0) {
        const message =
            "No approved nodes. Run 'planmap approve'.";

        if (options.json) {
            console.log(
                JSON.stringify({
                    approved: 0,
                    verified: 0,
                    drifted: 0,
                    errors: 0,
                    unsupported: 0,
                    timestamp: new Date().toISOString(),
                    project: projectRoot,
                    message
                })
            );
        } else {
            console.log(message);
        }

        process.exitCode = 2;
        return;
    }

    const verifiableApprovedNodes =
        approvedNodes.filter(
            node =>
                typeof node?.identity === "string" &&
                node.identity.length > 0
        );

    if (verifiableApprovedNodes.length === 0) {
        const message =
            "No verifiable nodes (all lack an identity).";

        if (options.json) {
            console.log(
                JSON.stringify({
                    approved: approvedNodes.length,
                    verified: 0,
                    drifted: 0,
                    errors: 0,
                    unsupported: 0,
                    message
                })
            );
        } else {
            console.log(message);
        }

        process.exitCode = 2;
        return;
    }

    const verification =
        await verifyPlan(
            projectRoot,
            {
                lens: options.lens,
                identity: options.identity
            }
        );

    const results =
        verification.results ?? [];

    if (results.length === 0) {
        if (options.identity) {
            console.log(
                `No approved plan node matches identity '${options.identity}'.`
            );
        } else if (options.lens) {
            console.log(
                `No approved plan nodes carry lens '${options.lens}'.`
            );
        }
        process.exitCode = 2;
        return;
    }

    const summary =
        summarize(results);

    const evolution =
        readEvolution(
            projectRoot
        );

    const updatedEvolution =
        applyVerificationStatus(
            evolution,
            results
        );

    writeEvolution(
        projectRoot,
        updatedEvolution
    );

    if (options.json) {
        console.log(
            JSON.stringify(
                {
                    ...summary,
                    timestamp: new Date().toISOString(),
                    project: projectRoot,
                    results
                },
                null,
                2
            )
        );
    } else {
        console.log("\nPlanMap Verify\n");

        printSummary(summary);

        let displayed =
            results;

        if (options.only === "drifted") {
            displayed =
                results.filter(
                    result =>
                        result.status === "drifted"
                );
        }

        printDrifted(displayed);
        printErrors(displayed);
        printUnsupported(displayed);
    }

    if (
        summary.drifted > 0 ||
        summary.errors > 0 ||
        (
            options.strict &&
            summary.unsupported > 0
        )
    ) {
        process.exitCode = 1;
        return;
    }

    process.exitCode = 0;
}

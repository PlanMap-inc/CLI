import fs from "node:fs";
import path from "node:path";

import {
    runCheck
} from "../check.js";

import {
    scanProject
} from "../scanner.js";

import {
    parseFile
} from "../parser.js";

import {
    diffDeclarations,
    formatDiff
} from "../diff.js";

import {
    calculateNetDelta
} from "../sessions.js";

import {
    analyzeSignificance
} from "../evolution/significance.js";

import {
    loadConfig
} from "../config.js";


// --------------------------------------------------
// BUILD SIGNIFICANCE SESSION
// --------------------------------------------------

function buildSignificanceSession(
    changes,
    config
) {
    const events = [];

    for (
        const change
        of changes
    ) {
        if (
            change.type === "unchanged"
        ) {
            continue;
        }

        const delta = {};

        for (
            const propertyChange
            of change.changes || []
        ) {
            delta[propertyChange.property] = [
                propertyChange.before,
                propertyChange.after
            ];
        }

        events.push({
            identity:
                change.identity,

            type:
                change.type,

            delta
        });
    }

    const netDelta =
        calculateNetDelta(
            events
        );

    return {
        events,
        netDelta,
        config
    };
}


// --------------------------------------------------
// RUN PROJECT CHECK
// --------------------------------------------------

export function runProjectCheck(
    projectPath,
    options = {}
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js check <project-folder> [--all]"
        );

        process.exitCode = 1;
        return;
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
        console.error(
            `Project folder not found: ${projectPath}`
        );

        process.exitCode = 1;
        return;
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );

        process.exitCode = 1;
        return;
    }

    console.log(
        `\nChecking project: ${projectRoot}\n`
    );

    const changes =
        runCheck(
            projectRoot,
            scanProject,
            parseFile,
            diffDeclarations
        );

    const realChanges =
        changes.filter(
            change =>
                change.type !== "unchanged"
        );

    if (
        realChanges.length === 0
    ) {
        console.log(
            "No changes detected."
        );

        process.exitCode = 0;
        return;
    }

    const config =
        loadConfig(
            projectRoot
        );

    const session =
        buildSignificanceSession(
            changes,
            config
        );

    const significance =
        analyzeSignificance(
            session
        );

    const significantIds =
        new Set(
            significance.declarations.map(
                declaration =>
                    declaration.identity
            )
        );

    const significantChanges =
        realChanges.filter(
            change =>
                significantIds.has(
                    change.identity
                )
        );

    const insignificantChanges =
        realChanges.filter(
            change =>
                !significantIds.has(
                    change.identity
                )
        );

    console.log(
        "\nPlanMap Check\n"
    );

    console.log(
        `Changes: ${realChanges.length}`
    );

    console.log(
        `Significant: ${significantChanges.length}`
    );

    console.log(
        `Insignificant: ${insignificantChanges.length}`
    );

    if (
        significantChanges.length > 0
    ) {
        console.log(
            "\nSignificant changes:\n"
        );

        formatDiff(
            significantChanges,
            "baseline",
            "current"
        );
    }

    if (
        options.all &&
        insignificantChanges.length > 0
    ) {
        console.log(
            "\nInsignificant changes:\n"
        );

        formatDiff(
            insignificantChanges,
            "baseline",
            "current"
        );
    }

    /*
     * Normal check fails only when a meaningful
     * semantic change exists.
     *
     * --all changes display only.
     */
    process.exitCode =
        significantChanges.length > 0
            ? 1
            : 0;
}

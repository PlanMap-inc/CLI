import fs from "node:fs";
import path from "node:path";

import { parseFile } from "../parser.js";
import { scanProject } from "../scanner.js";
import {
    runCheck
} from "../check.js";

import {
    diffDeclarations,
    formatDiff
} from "../diff.js";

// --------------------------------------------------
// RUN PROJECT CHECK
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Reads the stored baseline.
// 6-Scans the current project.
// 7-Compares current state with baseline.
// 8-Prints detected changes.
// 9-Only real changes affect the exit code.
// 10-Does not update baseline.
// --------------------------------------------------

export function runProjectCheck(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js check <project-folder>"
        );

        process.exit(1);
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

        process.exit(1);
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );

        process.exit(1);
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

    formatDiff(
        changes,
        "baseline",
        "current"
    );

    process.exitCode = 1;
}

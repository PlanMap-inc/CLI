import fs from "node:fs";
import path from "node:path";

import { parseFile } from "../parser.js";
import { scanProject } from "../scanner.js";
import { writeBaseline } from "../baseline.js";
import { appendInitialEvents } from "../events.js";
import { checkDuplicates } from "../declarations/utils.js";


// --------------------------------------------------
// RUN INIT
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Scans the entire project.
// 6-Collects all declarations.
// 7-Checks declaration identities.
// 8-Appends initial "added" events.
// 9-Writes baseline.json.
// 10-Prints the result.
// --------------------------------------------------

export function runInit(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js init <project-folder>"
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
        `\nScanning project: ${projectRoot}\n`
    );

    const declarations =
        scanProject(
            projectRoot,
            parseFile
        );

    checkDuplicates(
        declarations
    );

    appendInitialEvents(
        projectRoot,
        declarations
    );

    const baselinePath =
        writeBaseline(
            projectRoot,
            declarations
        );

    console.log(
        `\nFound ${declarations.length} declarations`
    );

    console.log(
        `Baseline written: ${baselinePath}`
    );
}


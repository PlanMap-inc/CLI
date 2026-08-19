import fs from "node:fs";
import path from "node:path";

import { parseFile } from "../parser.js";
import { scanProject } from "../scanner.js";
import { writeBaseline } from "../baseline.js";
import { checkDuplicates } from "../declarations/utils.js";


// --------------------------------------------------
// RUN ACCEPT
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Scans the current project.
// 6-Checks declaration identities.
// 7-Writes the current state to baseline.json.
// 8-Prints the updated baseline location.
// --------------------------------------------------

export function runAccept(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js accept <project-folder>"
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
        `\nAccepting current project state: ${projectRoot}\n`
    );

    const declarations =
        scanProject(
            projectRoot,
            parseFile
        );

    checkDuplicates(
        declarations
    );

    const baselinePath =
        writeBaseline(
            projectRoot,
            declarations
        );

    console.log(
        `\nBaseline updated: ${baselinePath}`
    );
}

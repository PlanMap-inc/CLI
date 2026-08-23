import fs from "node:fs";
import path from "node:path";

import { parseFile } from "../parser.js";
import { watchProject } from "../watcher.js";


// --------------------------------------------------
// RUN WATCH
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Checks whether baseline.json exists.
// 6-Starts the watcher.
// 7-Watches JavaScript files.
// --------------------------------------------------

export async function runWatch(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js watch <project-folder>"
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

    const baselinePath =
        path.join(
            projectRoot,
            ".planmap",
            "baseline.json"
        );

    if (
        !fs.existsSync(
            baselinePath
        )
    ) {
        console.error(
            "Baseline not found. Run init first."
        );

        process.exit(1);
    }

    console.log(
        `\nStarting watch: ${projectRoot}\n`
    );

    await watchProject(
        projectRoot,
        parseFile
    );
}

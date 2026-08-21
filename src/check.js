import fs from "node:fs";
import path from "node:path";
import { appendEvent } from "./events.js";


// --------------------------------------------------
// READ BASELINE
// 1-Receives the project root.
// 2-Builds the path to .planmap/baseline.json.
// 3-Checks whether the baseline exists.
// 4-If the baseline does not exist:
//    * Prints an error.
//    * Exits the program.
// 5-Reads the baseline file.
// 6-Parses the JSON content.
// 7-Returns the baseline.
// --------------------------------------------------

export function readBaseline(
    projectRoot
) {
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

    const baselineCode =
        fs.readFileSync(
            baselinePath,
            "utf8"
        );

    return JSON.parse(
        baselineCode
    );
}


// --------------------------------------------------
// CHECK BASELINE VERSION
// 1-Receives the baseline.
// 2-Checks whether the baseline has a version.
// 3-If the version is missing:
//    * Prints an error.
//    * Exits the program.
// 4-Checks whether the baseline version is supported.
// 5-If the version is unsupported:
//    * Prints an error.
//    * Exits the program.
// --------------------------------------------------

function checkBaselineVersion(
    baseline
) {
    if (
        baseline.version !== 2
    ) {
        console.error(
            `Unsupported baseline version: ${baseline.version}`
        );
        console.error(
            "Baseline was written by an older version of PlanMap."
        );
        console.error(
            "Identity generation has changed. Run 'planmap init' to regenerate the baseline."
        );

        process.exit(1);
    }
}


// --------------------------------------------------
// RUN CHECK
// 1-Receives the project root.
// 2-Reads the stored baseline.
// 3-Checks the baseline version.
// 4-Scans the current project.
// 5-Compares the current declarations with the baseline.
// 6-Appends every real change to events.jsonl.
// 7-Returns the detected changes.
// --------------------------------------------------

export function runCheck(
    projectRoot,
    scanProject,
    parseFile,
    diffDeclarations
) {
    const baseline =
        readBaseline(
            projectRoot
        );

    checkBaselineVersion(
        baseline
    );

    const currentDeclarations =
        scanProject(
            projectRoot,
            parseFile
        );

    const changes =
        diffDeclarations(
            baseline.declarations,
            currentDeclarations
        );

    // --------------------------------------------------
    // RECORD REAL CHANGES
    // --------------------------------------------------
    // appendEvent() already ignores "unchanged"
    // results and records:
    //   - changed
    //   - added
    //   - deleted
    //
    // The baseline is NOT modified here.
    // --------------------------------------------------

    for (
        const change
        of changes
    ) {
        appendEvent(
            projectRoot,
            change
        );
    }

    return changes;
}
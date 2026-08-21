import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// BASELINE VERSION
// 1-Defines the version of the baseline format.
// 2-Allows PlanMap to detect incompatible baseline
//   formats when the baseline structure changes.
// --------------------------------------------------

const BASELINE_VERSION = 2;


// --------------------------------------------------
// CREATE BASELINE
// 1-Receives all declarations from the project scan.
// 2-Creates an empty array for baseline declarations.
// 3-Loops through every declaration.
// 4-Stores only the identity, file, kind, and properties.
// 5-Leaves out source locations and byte offsets.
// 6-Sorts declarations by identity.
// 7-Returns the baseline object.
// --------------------------------------------------

export function createBaseline(declarations) {
    const baselineDeclarations = [];

    for (const declaration of declarations) {
        baselineDeclarations.push({
            identity: declaration.identity,
            file: declaration.file,
            kind: declaration.kind,
            properties: declaration.properties
        });
    }

    baselineDeclarations.sort(
        (a, b) =>
            a.identity.localeCompare(b.identity)
    );

    return {
        version: BASELINE_VERSION,
        declarations: baselineDeclarations
    };
}


// --------------------------------------------------
// WRITE BASELINE
// 1-Receives the project root and declarations.
// 2-Creates the .planmap directory inside the project.
// 3-Creates the baseline from the declarations.
// 4-Writes the baseline to baseline.json.
// 5-Uses stable JSON formatting.
// 6-Adds a newline at the end of the file.
// --------------------------------------------------

export function writeBaseline(
    projectRoot,
    declarations
) {
    const planmapDirectory = path.join(
        projectRoot,
        ".planmap"
    );

    const baselinePath = path.join(
        planmapDirectory,
        "baseline.json"
    );

    fs.mkdirSync(
        planmapDirectory,
        { recursive: true }
    );

    const baseline =
        createBaseline(declarations);

    fs.writeFileSync(
        baselinePath,
        JSON.stringify(
            baseline,
            null,
            2
        ) + "\n",
        "utf8"
    );

    return baselinePath;
}
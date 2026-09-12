import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// GET FILE DECLARATIONS
// --------------------------------------------------
// 1-Receives a file path.
// 2-Reads the file.
// 3-Parses the file using the supplied parser.
// 4-Returns the declarations.
// --------------------------------------------------

export function getFileDeclarations(
    filePath,
    parseFile
) {
    if (
        !fs.existsSync(
            filePath
        )
    ) {
        return [];
    }

    const result =
        parseFile(
            filePath,
            {
                throwOnError:
                    true
            }
        );

    return result.declarations || [];
}


// --------------------------------------------------
// GET BASELINE DECLARATIONS
// --------------------------------------------------
// 1-Receives the project baseline.
// 2-Receives a project-relative file path.
// 3-Filters declarations belonging to that file.
// 4-Returns the declarations.
// --------------------------------------------------

export function getBaselineDeclarations(
    baseline,
    relativeFile
) {
    if (
        !baseline ||
        !Array.isArray(
            baseline.declarations
        )
    ) {
        return [];
    }

    return baseline.declarations.filter(
        declaration =>
            declaration.file ===
            relativeFile
    );
}


// --------------------------------------------------
// CREATE DECLARATION SIGNATURE
// --------------------------------------------------
// 1-Receives declarations.
// 2-Keeps only information relevant to
//   determining whether a declaration changed.
// 3-Sorts declarations by identity.
// 4-Returns a stable JSON string.
// --------------------------------------------------

export function createDeclarationSignature(
    declarations
) {
    return JSON.stringify(
        declarations
            .map(
                declaration => ({
                    identity:
                        declaration.identity,

                    file:
                        declaration.file,

                    kind:
                        declaration.kind,

                    name:
                        declaration.name,

                    properties:
                        declaration.properties
                })
            )
            .sort(
                (
                    left,
                    right
                ) =>
                    left.identity.localeCompare(
                        right.identity
                    )
            )
    );
}


// --------------------------------------------------
// NORMALIZE DECLARATIONS
// --------------------------------------------------
// 1-Receives declarations.
// 2-Adds the project-relative file path.
// 3-Builds the declaration identity.
// 4-Returns normalized declarations.
// --------------------------------------------------

export function normalizeDeclarations(
    declarations,
    relativeFile
) {
    return declarations.map(
        declaration => ({
            ...declaration,

            file:
                relativeFile,

            identity:
                `${relativeFile}::${declaration.identity}`
        })
    );
}


// --------------------------------------------------
// GET RELATIVE FILE PATH
// --------------------------------------------------
// Converts an absolute file path into the
// project-relative path used by PlanMap.
// --------------------------------------------------

export function getRelativeFilePath(
    projectRoot,
    filePath
) {
    return path
        .relative(
            projectRoot,
            filePath
        )
        .split(
            path.sep
        )
        .join("/");
}
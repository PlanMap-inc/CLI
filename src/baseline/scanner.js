import fs from "node:fs";
import path from "node:path";

import {
    parseFile
} from "./parser.js";



// --------------------------------------------------
// DIRECTORIES TO SKIP
// --------------------------------------------------

const SKIP_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".next",
    "out",
    ".turbo",
    ".cache"
]);



// --------------------------------------------------
// SOURCE FILE CHECK
// --------------------------------------------------
// Supported:
//   .js   JavaScript
//   .ts   TypeScript
//   .tsx  TypeScript + JSX
//
// Type declaration files (.d.ts) are excluded.
// --------------------------------------------------

export function isSourceFile(
    filePath
) {

    const normalizedPath =
        String(filePath)
            .split("\\")
            .join("/");

    const fileName =
        normalizedPath
            .split("/")
            .pop()
            ?.toLowerCase();

    if (
        fileName?.endsWith(".d.ts")
    ) {
        return false;
    }

    return (
        fileName?.endsWith(".js") ||
        fileName?.endsWith(".ts") ||
        fileName?.endsWith(".tsx")
    );
}


// --------------------------------------------------
// FIND SUPPORTED SOURCE FILES
// --------------------------------------------------
// Supports:
//   .js  JavaScript
//   .ts  TypeScript
//   .tsx TypeScript + JSX
// --------------------------------------------------

function findSourceFiles(projectRoot) {

    const files = [];


    function walkDirectory(
        currentDirectory
    ) {

        const entries =
            fs.readdirSync(
                currentDirectory,
                {
                    withFileTypes: true
                }
            );


        for (
            const entry
            of entries
        ) {

            const fullPath =
                path.join(
                    currentDirectory,
                    entry.name
                );


            if (
                entry.isDirectory()
            ) {

                if (
                    SKIP_DIRECTORIES.has(
                        entry.name
                    )
                ) {
                    continue;
                }


                walkDirectory(
                    fullPath
                );

                continue;
            }


            if (
                !entry.isFile()
            ) {
                continue;
            }


            if (
                isSourceFile(
                    entry.name
                )
            ) {

                files.push(
                    fullPath
                );
            }
        }
    }


    walkDirectory(
        projectRoot
    );


    return files.sort();
}




function emitScanWarnings(warningState, projectRoot, options = {}) {
    if (warningState.skipped.length > 0) {
        console.warn(
            `⚠ ${warningState.skipped.length} files skipped (parse errors)`
        );

        if (options.verbose) {
            for (const skipped of warningState.skipped) {
                console.warn(
                    `  skipped: ${skipped.file}`
                );
            }
        }
    }

    if (warningState.disambiguated > 0) {
        console.warn(
            `⚠ ${warningState.disambiguated} duplicate identities disambiguated with #N suffixes`
        );
        console.warn(
            "  See DECISIONS.md §10.1."
        );
    }
}

// --------------------------------------------------
// SCAN PROJECT
// --------------------------------------------------

export function scanProject(
    projectRoot,
    options = {}
) {

    const quiet =
        options.quiet === true;

    const verbose =
        options.verbose === true;

    const warningState =
        options.warningState ?? {
            skipped: [],
            disambiguated: 0
        };

    const absoluteRoot =
        path.resolve(
            projectRoot
        );


    const files =
        findSourceFiles(
            absoluteRoot
        );


    const fileQueue =
        [...files];


    const declarations =
        [];


    let totalDisambiguated =
        0;


    while (
        fileQueue.length > 0
    ) {

        const filePath =
            fileQueue.shift();


        const relativeFile =
            path
                .relative(
                    absoluteRoot,
                    filePath
                )
                .split(
                    path.sep
                )
                .join("/");


        if (!quiet) {
            console.log(
                `Scanning: ${relativeFile}`
            );
        }


        let result;

        try {
            result =
                parseFile(
                    filePath
                );

            totalDisambiguated +=
                result.disambiguatedCount ?? 0;
        } catch (error) {
            warningState.skipped.push({
                file: relativeFile,
                message: error.message
            });

            continue;
        }


        for (
            const declaration
            of result.declarations
        ) {

            declaration.file =
                relativeFile;


            declaration.identity =
                `${relativeFile}::${declaration.identity}`;


            declarations.push(
                declaration
            );
        }
    }


    warningState.disambiguated += totalDisambiguated;

    if (!quiet && options.emitWarnings !== false && options.warningState === undefined) {
        emitScanWarnings(
            warningState,
            absoluteRoot,
            { verbose }
        );
    }

    return declarations;
}

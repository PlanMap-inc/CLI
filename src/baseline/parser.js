import fs from "node:fs";
import path from "node:path";

import { getWorkerForFile } from "./registry/language-registry.js";
import { javascriptWorker } from "./workers/javascript-worker.js";



// --------------------------------------------------
// WORKER SELECTION
// --------------------------------------------------
// The pre-registry parser defaulted any unrecognized extension
// to the JavaScript grammar (see getLanguageForFile's fallback
// branch). Preserve that behavior here: the registry itself
// stays strict, but parseFile() falls back to the JavaScript
// worker when a file's extension isn't registered.
// --------------------------------------------------

function resolveWorker(filePath) {

    try {
        return getWorkerForFile(filePath);
    } catch {
        return javascriptWorker;
    }
}



// --------------------------------------------------
// PARSE FILE
// --------------------------------------------------
// 1-Receives the file path.
// 2-Converts the path into an absolute path.
// 3-Checks whether the file exists.
// 4-Reads the entire file.
// 5-Selects the worker from the file extension.
// 6-Parses the source code via the worker's grammar.
// 7-Throws an error when throwOnError is enabled.
// 8-Sends the syntax tree to the worker's extractDeclarations().
// 9-Disambiguates duplicate declaration identities.
// 10-Returns the parsed file information.
// --------------------------------------------------

export function parseFile(
    filePath,
    options = {}
) {

    const absolutePath =
        path.resolve(
            filePath
        );


    if (
        !fs.existsSync(
            absolutePath
        )
    ) {

        const error =
            new Error(
                `Cannot read file: ${filePath}`
            );


        if (
            options.throwOnError
        ) {

            throw error;
        }


        console.error(
            error.message
        );


        process.exit(1);
    }


    const fileCode =
        fs.readFileSync(
            absolutePath,
            "utf8"
        );


    const worker =
        resolveWorker(
            absolutePath
        );


    const tree =
        worker.parse(
            fileCode,
            absolutePath
        );


    if (
        tree.rootNode.hasError
    ) {

        throw new Error(
            `Parse errors detected in ${filePath}`
        );
    }


    const declarations =
        worker.extractDeclarations(
            tree
        );


    // Disambiguate genuine identity collisions.
    // Unique identities remain unchanged.
    const identityCounts = new Map();

    for (const declaration of declarations) {
        const baseIdentity =
            declaration.identity;

        const count =
            identityCounts.get(baseIdentity) ?? 0;

        identityCounts.set(
            baseIdentity,
            count + 1
        );

        if (count > 0) {
            declaration.identity =
                `${baseIdentity}#${count + 1}`;
        }
    }


    const disambiguatedCount =
        declarations.filter(
            declaration =>
                /#\d+$/.test(
                    declaration.identity
                )
        ).length;


    return {
        filePath,
        code: fileCode,
        tree,
        declarations,
        disambiguatedCount
    };
}

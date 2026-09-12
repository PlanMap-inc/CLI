import fs from "node:fs";
import path from "node:path";

import { getWorkerForFile } from "./registry/language-registry.js";



// --------------------------------------------------
// PARSE FILE
// --------------------------------------------------
// 1-Receives the file path.
// 2-Converts the path into an absolute path.
// 3-Checks whether the file exists.
// 4-Reads the entire file.
// 5-Resolves the worker via the Language Registry (throws for
//   an unsupported extension).
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
        getWorkerForFile(
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

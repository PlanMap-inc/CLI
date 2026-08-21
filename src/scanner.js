import fs from "node:fs";
import path from "node:path";



// --------------------------------------------------
// DIRECTORIES TO SKIP
// --------------------------------------------------

const SKIP_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage"
]);



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


            const extension =
                path.extname(
                    entry.name
                ).toLowerCase();


            if (
                extension === ".js" ||
                extension === ".ts" ||
                extension === ".tsx"
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



// --------------------------------------------------
// SCAN PROJECT
// --------------------------------------------------

export function scanProject(
    projectRoot,
    parseFile
) {

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


        console.log(
            `Scanning: ${relativeFile}`
        );


        const result =
            parseFile(
                filePath
            );


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


    return declarations;
}

import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// DIRECTORIES TO SKIP
// 1-Defines the directories that should not be scanned.
// 2-Stores all ignored directory names inside a Set.
// 3-Skips directories that contain generated, external,
//   or version-control files.
// --------------------------------------------------

const SKIP_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage"
]);


// --------------------------------------------------
// FIND JAVASCRIPT FILES
// 1-Receives the project directory.
// 2-Creates an empty array to store JavaScript files.
// 3-Recursively walks through the directory tree.
// 4-Skips directories listed in SKIP_DIRECTORIES.
// 5-Finds files that end with ".js".
// 6-Adds each JavaScript file to the file list.
// 7-Sorts the files before returning them.
// --------------------------------------------------

function findJavaScriptFiles(projectRoot) {
    const files = [];

    function walkDirectory(currentDirectory) {
        const entries = fs.readdirSync(
            currentDirectory,
            { withFileTypes: true }
        );

        for (const entry of entries) {
            const fullPath = path.join(
                currentDirectory,
                entry.name
            );

            if (entry.isDirectory()) {
                if (SKIP_DIRECTORIES.has(entry.name)) {
                    continue;
                }

                walkDirectory(fullPath);
                continue;
            }

            if (
                entry.isFile() &&
                entry.name.endsWith(".js")
            ) {
                files.push(fullPath);
            }
        }
    }

    walkDirectory(projectRoot);

    return files.sort();
}


// --------------------------------------------------
// SCAN PROJECT
// 1-Receives the project root and parseFile() function.
// 2-Converts the project root into an absolute path.
// 3-Finds every JavaScript file in the project.
// 4-Creates a queue containing all discovered files.
// 5-Processes one file at a time from the queue.
// 6-Parses the current file using parseFile().
// 7-Gets the declarations from the parsed file.
// 8-Converts the file path into a project-relative path.
// 9-Uses forward slashes for the relative path.
// 10-Stores the relative file path on every declaration.
// 11-Adds the relative file path to the declaration identity.
// 12-Adds every declaration to the project declaration list.
// 13-Continues until the queue is empty.
// 14-Returns all declarations found across the project.
// --------------------------------------------------

export function scanProject(projectRoot, parseFile) {
    const absoluteRoot = path.resolve(projectRoot);

    const files = findJavaScriptFiles(
        absoluteRoot
    );

    const fileQueue = [...files];

    const declarations = [];

    while (fileQueue.length > 0) {
        const filePath = fileQueue.shift();

        const relativeFile = path
            .relative(
                absoluteRoot,
                filePath
            )
            .split(path.sep)
            .join("/");

        console.log(
            `Scanning: ${relativeFile}`
        );

        const result = parseFile(filePath);

        for (const declaration of result.declarations) {
            declaration.file = relativeFile;

            declaration.identity =
                `${relativeFile}::${declaration.identity}`;

            declarations.push(declaration);
        }
    }

    return declarations;
}
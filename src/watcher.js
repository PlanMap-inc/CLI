import chokidar from "chokidar";
import path from "node:path";
import { readBaseline } from "./check.js";
import { formatDiff, diffDeclarations } from "./diff.js";
import { appendEvent } from "./events.js";


// --------------------------------------------------
// SKIP DIRECTORIES
// 1-Defines directories that should not be watched.
// 2-Skips external, generated, and PlanMap files.
// --------------------------------------------------

const SKIP_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".planmap"
]);


// --------------------------------------------------
// SHOULD IGNORE
// 1-Receives a file or directory path.
// 2-Checks whether the path contains a skipped directory.
// 3-Keeps directories so Chokidar can continue watching them.
// 4-Ignores files that are not JavaScript files.
// 5-Returns whether Chokidar should ignore the path.
// --------------------------------------------------

function shouldIgnore(
    projectRoot,
    filePath,
    stats
) {
    const relativePath =
        path.relative(
            projectRoot,
            filePath
        );

    const parts =
        relativePath.split(
            path.sep
        );

    for (const part of parts) {
        if (
            SKIP_DIRECTORIES.has(part)
        ) {
            return true;
        }
    }

    if (
        stats &&
        stats.isDirectory()
    ) {
        return false;
    }

    if (
        !path.extname(filePath)
    ) {
        return false;
    }

    return path.extname(filePath) !== ".js";
}


// --------------------------------------------------
// DEBOUNCE FILE
// 1-Receives a file path and callback function.
// 2-Waits approximately 300 milliseconds.
// 3-Clears the previous timer for the same file.
// 4-Processes the latest save event.
// --------------------------------------------------

function debounceFile(
    filePath,
    callback,
    timers
) {
    if (
        timers.has(filePath)
    ) {
        clearTimeout(
            timers.get(filePath)
        );
    }

    const timer =
        setTimeout(
            () => {
                timers.delete(
                    filePath
                );

                callback(
                    filePath
                );
            },
            300
        );

    timers.set(
        filePath,
        timer
    );
}


// --------------------------------------------------
// GET FILE DECLARATIONS
// 1-Parses only the changed JavaScript file.
// 2-Converts the file path into a relative path.
// 3-Uses forward slashes in the relative path.
// 4-Adds the file path to each declaration.
// 5-Adds the file path to each declaration identity.
// 6-Returns the declarations.
// --------------------------------------------------

function getFileDeclarations(
    projectRoot,
    filePath,
    parseFile
) {
    const result =
        parseFile(
            filePath,
            {
                throwOnError: true
            }
        );

    const relativeFile =
        path.relative(
            projectRoot,
            filePath
        )
        .split(path.sep)
        .join("/");

    for (
        const declaration
        of result.declarations
    ) {
        declaration.file =
            relativeFile;

        declaration.identity =
            `${relativeFile}::${declaration.identity}`;
    }

    return result.declarations;
}


// --------------------------------------------------
// GET BASELINE DECLARATIONS
// 1-Receives the baseline declarations.
// 2-Filters declarations belonging to the changed file.
// 3-Returns only declarations from that file.
// --------------------------------------------------

function getBaselineDeclarations(
    baselineDeclarations,
    relativeFile
) {
    return baselineDeclarations.filter(
        declaration =>
            declaration.file === relativeFile
    );
}


// --------------------------------------------------
// CREATE SIGNATURE
// 1-Receives declarations.
// 2-Keeps only stable declaration information.
// 3-Leaves line numbers and byte offsets out.
// 4-Sorts declarations by identity.
// 5-Returns a stable JSON signature.
// --------------------------------------------------

function createSignature(
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
                    properties:
                        declaration.properties
                })
            )
            .sort(
                (left, right) =>
                    left.identity.localeCompare(
                        right.identity
                    )
            )
    );
}


// --------------------------------------------------
// RECORD CHANGES
// 1-Receives the project root and detected changes.
// 2-Ignores unchanged results.
// 3-Appends one event for every real change.
// --------------------------------------------------

function recordChanges(
    projectRoot,
    changes
) {
    const realChanges =
        changes.filter(
            change =>
                change.type === "changed" ||
                change.type === "added" ||
                change.type === "deleted"
        );

    for (
        const change
        of realChanges
    ) {
        appendEvent(
            projectRoot,
            change
        );
    }
}


// --------------------------------------------------
// CHECK CHANGED FILE
// 1-Reads the stored baseline.
// 2-Parses only the changed file.
// 3-Gets the current declarations.
// 4-Compares the current facts with the last seen facts.
// 5-Ignores repeated identical saves.
// 6-Compares new facts with the baseline.
// 7-Records real changes.
// 8-Prints only a new drift.
// 9-Does not update the baseline.
// --------------------------------------------------

function checkChangedFile(
    projectRoot,
    filePath,
    parseFile,
    lastSeen
) {
    const baseline =
        readBaseline(
            projectRoot
        );

    const relativeFile =
        path.relative(
            projectRoot,
            filePath
        )
        .split(path.sep)
        .join("/");

    const baselineDeclarations =
        getBaselineDeclarations(
            baseline.declarations,
            relativeFile
        );

    const currentDeclarations =
        getFileDeclarations(
            projectRoot,
            filePath,
            parseFile
        );

    const currentSignature =
        createSignature(
            currentDeclarations
        );

    const previousSignature =
        lastSeen.get(
            relativeFile
        );

    if (
        previousSignature ===
        currentSignature
    ) {
        return;
    }

    lastSeen.set(
        relativeFile,
        currentSignature
    );

    const changes =
        diffDeclarations(
            baselineDeclarations,
            currentDeclarations
        );

    const realChanges =
        changes.filter(
            change =>
                change.type === "changed" ||
                change.type === "added" ||
                change.type === "deleted"
        );

    if (
        realChanges.length === 0
    ) {
        return;
    }

    recordChanges(
        projectRoot,
        realChanges
    );

    console.log(
        `\nChange detected: ${relativeFile}\n`
    );

    formatDiff(
        realChanges,
        "baseline",
        "current"
    );
}


// --------------------------------------------------
// CHECK REMOVED FILE
// 1-Reads the stored baseline.
// 2-Gets declarations belonging to the removed file.
// 3-Compares them with an empty declaration list.
// 4-Reports real deletions.
// 5-Records the deletion in events.jsonl.
// 6-Does not update the baseline.
// --------------------------------------------------

function checkRemovedFile(
    projectRoot,
    filePath,
    lastSeen
) {
    const baseline =
        readBaseline(
            projectRoot
        );

    const relativeFile =
        path.relative(
            projectRoot,
            filePath
        )
        .split(path.sep)
        .join("/");

    const baselineDeclarations =
        getBaselineDeclarations(
            baseline.declarations,
            relativeFile
        );

    if (
        baselineDeclarations.length === 0
    ) {
        return;
    }

    const currentSignature =
        createSignature(
            []
        );

    const previousSignature =
        lastSeen.get(
            relativeFile
        );

    if (
        previousSignature ===
        currentSignature
    ) {
        return;
    }

    lastSeen.set(
        relativeFile,
        currentSignature
    );

    const changes =
        diffDeclarations(
            baselineDeclarations,
            []
        );

    const realChanges =
        changes.filter(
            change =>
                change.type === "changed" ||
                change.type === "added" ||
                change.type === "deleted"
        );

    if (
        realChanges.length === 0
    ) {
        return;
    }

    recordChanges(
        projectRoot,
        realChanges
    );

    console.log(
        `\nChange detected: ${relativeFile}\n`
    );

    formatDiff(
        realChanges,
        "baseline",
        "current"
    );
}


// --------------------------------------------------
// WATCH PROJECT
// 1-Creates a Chokidar watcher for the project directory.
// 2-Ignores unwanted directories and non-JavaScript files.
// 3-Ignores the initial scan.
// 4-Watches JavaScript file changes.
// 5-Debounces save events by approximately 300 milliseconds.
// 6-Checks only the changed file.
// 7-Handles newly added JavaScript files.
// 8-Handles removed JavaScript files.
// 9-Remembers the last seen facts in memory.
// 10-Appends real changes to events.jsonl.
// 11-Does not update baseline.json.
// 12-Keeps the watcher running until Ctrl+C.
// --------------------------------------------------

export function watchProject(
    projectRoot,
    parseFile
) {
    const timers =
        new Map();

    const removedTimers =
        new Map();

    const lastSeen =
        new Map();

    const watcher =
        chokidar.watch(
            projectRoot,
            {
                ignored: (
                    filePath,
                    stats
                ) =>
                    shouldIgnore(
                        projectRoot,
                        filePath,
                        stats
                    ),
                ignoreInitial: true,
                persistent: true,
                atomic: true
            }
        );

    watcher.on(
        "ready",
        () => {
            console.log(
                `\nWatching project: ${projectRoot}`
            );

            console.log(
                "Waiting for JavaScript file changes...\n"
            );
        }
    );


    // --------------------------------------------------
    // HANDLE ADDED FILE
    // 1-Receives a newly created JavaScript file.
// 2-Cancels a pending deletion.
// 3-Debounces the file.
// 4-Checks the new file.
// --------------------------------------------------

    watcher.on(
        "add",
        filePath => {
            if (
                removedTimers.has(
                    filePath
                )
            ) {
                clearTimeout(
                    removedTimers.get(
                        filePath
                    )
                );

                removedTimers.delete(
                    filePath
                );
            }

            debounceFile(
                filePath,
                addedFile => {
                    try {
                        checkChangedFile(
                            projectRoot,
                            addedFile,
                            parseFile,
                            lastSeen
                        );
                    } catch (error) {
                        console.error(
                            `Unable to check ${addedFile}: ${error.message}`
                        );
                    }
                },
                timers
            );
        }
    );


    // --------------------------------------------------
    // HANDLE CHANGED FILE
    // 1-Receives a changed JavaScript file.
// 2-Debounces the save event.
// 3-Parses only that file.
// 4-Compares its facts with the last seen state.
// --------------------------------------------------

    watcher.on(
        "change",
        filePath => {
            debounceFile(
                filePath,
                changedFile => {
                    try {
                        checkChangedFile(
                            projectRoot,
                            changedFile,
                            parseFile,
                            lastSeen
                        );
                    } catch (error) {
                        console.error(
                            `Unable to check ${changedFile}: ${error.message}`
                        );
                    }
                },
                timers
            );
        }
    );


    // --------------------------------------------------
    // HANDLE REMOVED FILE
    // 1-Receives a removed JavaScript file.
// 2-Waits approximately 400 milliseconds.
// 3-Allows an editor to recreate the file.
// 4-Reports deletion only if the file stays removed.
// --------------------------------------------------

    watcher.on(
        "unlink",
        filePath => {
            if (
                removedTimers.has(
                    filePath
                )
            ) {
                clearTimeout(
                    removedTimers.get(
                        filePath
                    )
                );
            }

            const timer =
                setTimeout(
                    () => {
                        removedTimers.delete(
                            filePath
                        );

                        try {
                            checkRemovedFile(
                                projectRoot,
                                filePath,
                                lastSeen
                            );
                        } catch (error) {
                            console.error(
                                `Unable to check ${filePath}: ${error.message}`
                            );
                        }
                    },
                    400
                );

            removedTimers.set(
                filePath,
                timer
            );
        }
    );


    // --------------------------------------------------
    // HANDLE WATCHER ERROR
    // 1-Receives a Chokidar error.
// 2-Prints the error message.
// --------------------------------------------------

    watcher.on(
        "error",
        error => {
            console.error(
                `Watcher error: ${error.message}`
            );
        }
    );


    // Keep the CLI process alive while the watcher is running.
    process.stdin.resume();


    // Stop the watcher when Ctrl+C is pressed.
    process.once(
        "SIGINT",
        async () => {
            console.log(
                "\nStopping watcher..."
            );

            for (
                const timer
                of timers.values()
            ) {
                clearTimeout(
                    timer
                );
            }

            for (
                const timer
                of removedTimers.values()
            ) {
                clearTimeout(
                    timer
                );
            }

            await watcher.close();

            process.exit(0);
        }
    );
}
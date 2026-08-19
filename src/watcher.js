import chokidar from "chokidar";

import {
    createWatcherHandlers
} from "./watcher/handlers.js";

import {
    shouldIgnore
} from "./watcher/filters.js";


// --------------------------------------------------
// WATCH PROJECT
// --------------------------------------------------
// 1-Creates a Chokidar watcher for the project.
// 2-Uses the watcher filter for ignored paths.
// 3-Ignores the initial scan.
// 4-Creates in-memory watcher state.
// 5-Delegates add/change/unlink handling.
// 6-Keeps the watcher alive through Chokidar.
// 7-Closes the watcher cleanly on shutdown.
// --------------------------------------------------

export function watchProject(
    projectRoot,
    parseFile
) {

    // --------------------------------------------------
    // IN-MEMORY WATCHER STATE
    // --------------------------------------------------

    const lastSeen =
        new Map();

    const lastSeenDeclarations =
        new Map();


    // --------------------------------------------------
    // WATCHER CONTEXT
    // --------------------------------------------------

    const context = {
        projectRoot,

        parseFile,

        lastSeen,

        lastSeenDeclarations,

        debounceDelay:
            300
    };


    // --------------------------------------------------
    // CREATE HANDLERS
    // --------------------------------------------------

    const handlers =
        createWatcherHandlers(
            context
        );


    // --------------------------------------------------
    // CREATE CHOKIDAR WATCHER
    // --------------------------------------------------

    const watcher =
        chokidar.watch(
            projectRoot,
            {
                ignored: (
                    filePath,
                    stats
                ) =>
                    shouldIgnore(
                        filePath,
                        stats
                    ),

                ignoreInitial:
                    true,

                persistent:
                    true,

                awaitWriteFinish: {
                    stabilityThreshold:
                        200,

                    pollInterval:
                        100
                }
            }
        );


    // --------------------------------------------------
    // WATCHER READY
    // --------------------------------------------------

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
    // --------------------------------------------------

    watcher.on(
        "add",
        filePath => {

            handlers.add(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // HANDLE CHANGED FILE
    // --------------------------------------------------

    watcher.on(
        "change",
        filePath => {

            handlers.change(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // HANDLE REMOVED FILE
    // --------------------------------------------------

    watcher.on(
        "unlink",
        filePath => {

            handlers.unlink(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // HANDLE WATCHER ERROR
    // --------------------------------------------------

    watcher.on(
        "error",
        error => {

            console.error(
                `Watcher error: ${error.message}`
            );
        }
    );


    // --------------------------------------------------
    // HANDLE CTRL+C
    // --------------------------------------------------

    process.once(
        "SIGINT",
        async () => {

            console.log(
                "\nStopping watcher..."
            );

            await watcher.close();

            process.exit(
                0
            );
        }
    );
}
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
// 2-Watches the project directory recursively.
// 3-Uses the filter to ignore unwanted files.
// 4-Delegates add/change/unlink events.
// 5-Keeps the watcher alive until Ctrl+C.
// 6-Closes the watcher cleanly on shutdown.
// --------------------------------------------------

export function watchProject(
    projectRoot,
    parseFile
) {

    // --------------------------------------------------
    // IN-MEMORY STATE
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
    // IMPORTANT:
    //
    // Watch the project directory itself.
    //
    // Do NOT use:
    //
    //     `${projectRoot}/**/*.js`
    //
    // because Chokidar v4 does not support glob patterns.
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
    // READY
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
    // ADD
    // --------------------------------------------------

    watcher.on(
        "add",
        filePath => {

            console.log(
                "\n🔥 CHOKIDAR ADD:",
                filePath
            );

            handlers.add(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // CHANGE
    // --------------------------------------------------

    watcher.on(
        "change",
        filePath => {

            console.log(
                "\n🔥 CHOKIDAR CHANGE:",
                filePath
            );

            handlers.change(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // UNLINK
    // --------------------------------------------------

    watcher.on(
        "unlink",
        filePath => {

            console.log(
                "\n🔥 CHOKIDAR UNLINK:",
                filePath
            );

            handlers.unlink(
                filePath
            );
        }
    );


    // --------------------------------------------------
    // ERROR
    // --------------------------------------------------

    watcher.on(
        "error",
        error => {

            console.error(
                "\nWatcher error:",
                error
            );
        }
    );


    // --------------------------------------------------
    // RAW DEBUG EVENT
    // --------------------------------------------------

    watcher.on(
        "all",
        (
            event,
            filePath
        ) => {

            console.log(
                `RAW WATCHER EVENT: ${event} ${filePath}`
            );
        }
    );


    // --------------------------------------------------
    // KEEP PROCESS ALIVE
    // --------------------------------------------------

    process.stdin.resume();


    // --------------------------------------------------
    // CTRL+C
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
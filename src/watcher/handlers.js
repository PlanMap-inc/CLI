import {
    debounceFile,
    clearDebounce
} from "./debounce.js";

import {
    shouldIgnore
} from "./filters.js";

import {
    checkChangedFile,
    checkRemovedFile
} from "./changes.js";


// --------------------------------------------------
// HANDLE FILE ADD
// --------------------------------------------------
// A newly added JavaScript file is processed through
// the same change-detection path used for changes.
// --------------------------------------------------

export function handleAdd(
    filePath,
    context
) {

    console.log(
        "\n🟢 HANDLER ADD:",
        filePath
    );


    // --------------------------------------------------
    // CHECK FILTER
    // --------------------------------------------------

    if (
        shouldIgnore(
            filePath
        )
    ) {

        console.log(
            "🔴 HANDLER ADD IGNORED:",
            filePath
        );

        return;
    }


    // --------------------------------------------------
    // DEBOUNCE
    // --------------------------------------------------

    debounceFile(
        filePath,
        async () => {

            console.log(
                "\n🟡 RUNNING ADD CHECK:",
                filePath
            );

            try {

                await checkChangedFile(
                    context.projectRoot,
                    filePath,
                    context.parseFile,
                    context.lastSeen,
                    context.lastSeenDeclarations
                );

            } catch (error) {

                console.error(
                    `Unable to check added file ${filePath}: ${error.message}`
                );
            }
        },
        context.debounceDelay
    );
}


// --------------------------------------------------
// HANDLE FILE CHANGE
// --------------------------------------------------
// 1-Checks whether the file should be ignored.
// 2-Debounces rapid filesystem events.
// 3-Processes the file after the debounce delay.
// --------------------------------------------------

export function handleChange(
    filePath,
    context
) {

    console.log(
        "\n🟢 HANDLER CHANGE:",
        filePath
    );


    // --------------------------------------------------
    // CHECK FILTER
    // --------------------------------------------------

    if (
        shouldIgnore(
            filePath
        )
    ) {

        console.log(
            "🔴 HANDLER CHANGE IGNORED:",
            filePath
        );

        return;
    }


    // --------------------------------------------------
    // DEBOUNCE
    // --------------------------------------------------

    debounceFile(
        filePath,
        async () => {

            console.log(
                "\n🟡 RUNNING CHANGE CHECK:",
                filePath
            );

            try {

                await checkChangedFile(
                    context.projectRoot,
                    filePath,
                    context.parseFile,
                    context.lastSeen,
                    context.lastSeenDeclarations
                );

                console.log(
                    "✅ CHANGE CHECK FINISHED:",
                    filePath
                );

            } catch (error) {

                console.error(
                    `Unable to check changed file ${filePath}: ${error.message}`
                );
            }
        },
        context.debounceDelay
    );
}


// --------------------------------------------------
// HANDLE FILE UNLINK
// --------------------------------------------------
// 1-Cancels any pending debounce.
// 2-Ignores files outside the watcher scope.
// 3-Processes the removed file.
// --------------------------------------------------

export function handleUnlink(
    filePath,
    context
) {

    console.log(
        "\n🟢 HANDLER UNLINK:",
        filePath
    );


    // --------------------------------------------------
    // CHECK FILTER
    // --------------------------------------------------

    if (
        shouldIgnore(
            filePath
        )
    ) {

        console.log(
            "🔴 HANDLER UNLINK IGNORED:",
            filePath
        );

        return;
    }


    // --------------------------------------------------
    // CLEAR PENDING DEBOUNCE
    // --------------------------------------------------

    clearDebounce(
        filePath
    );


    // --------------------------------------------------
    // CHECK REMOVED FILE
    // --------------------------------------------------

    try {

        checkRemovedFile(
            context.projectRoot,
            filePath,
            context.lastSeen
        );

    } catch (error) {

        console.error(
            `Unable to check removed file ${filePath}: ${error.message}`
        );
    }
}


// --------------------------------------------------
// CREATE WATCHER HANDLERS
// --------------------------------------------------
// Returns the callbacks used by the filesystem
// watcher.
//
// Keeping these callbacks here prevents watcher.js
// from containing all event-handling logic.
// --------------------------------------------------

export function createWatcherHandlers(
    context
) {

    return {

        add(
            filePath
        ) {

            handleAdd(
                filePath,
                context
            );
        },


        change(
            filePath
        ) {

            handleChange(
                filePath,
                context
            );
        },


        unlink(
            filePath
        ) {

            handleUnlink(
                filePath,
                context
            );
        }

    };
}
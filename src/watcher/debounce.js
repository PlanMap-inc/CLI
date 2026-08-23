// --------------------------------------------------
// DEBOUNCE FILE
// --------------------------------------------------

const timers =
    new Map();

const running =
    new Set();


// --------------------------------------------------
// DEBOUNCE FILE
// --------------------------------------------------

export function debounceFile(
    filePath,
    callback,
    delay = 150
) {
    const existingEntry =
        timers.get(
            filePath
        );

    if (
        existingEntry
    ) {
        clearTimeout(
            existingEntry.timer
        );
    }

    let run;

    run =
        async () => {

            console.log(
                "DEBOUNCE FIRED:",
                filePath
            );

            timers.delete(
                filePath
            );

            const execution =
                Promise.resolve().then(
                    () => callback()
                );

            running.add(
                execution
            );

            try {
                await execution;

                console.log(
                    "DEBOUNCE CALLBACK FINISHED:",
                    filePath
                );
            }

            catch (error) {
                console.error(
                    "DEBOUNCE CALLBACK ERROR:",
                    error
                );
            }

            finally {
                running.delete(
                    execution
                );
            }
        };

    const timer =
        setTimeout(
            run,
            delay
        );

    timers.set(
        filePath,
        {
            timer,
            run
        }
    );
}


// --------------------------------------------------
// CLEAR DEBOUNCE
// --------------------------------------------------

export function clearDebounce(
    filePath
) {
    const pending =
        timers.get(
            filePath
        );

    if (
        !pending
    ) {
        return;
    }

    clearTimeout(
        pending.timer
    );

    timers.delete(
        filePath
    );
}


// --------------------------------------------------
// CLEAR ALL DEBOUNCES
// --------------------------------------------------

export function clearAllDebounces() {

    for (
        const pending
        of timers.values()
    ) {
        clearTimeout(
            pending.timer
        );
    }

    timers.clear();
}


// --------------------------------------------------
// FLUSH ALL PENDING DEBOUNCES
// --------------------------------------------------
// Immediately executes every pending callback.
// Used before sealing a session at a Git boundary.
// --------------------------------------------------

export async function flushDebounces() {

    while (
        timers.size > 0 ||
        running.size > 0
    ) {

        const pending =
            Array.from(
                timers.values()
            );

        for (
            const entry
            of pending
        ) {
            clearTimeout(
                entry.timer
            );
        }

        timers.clear();

        await Promise.all(
            pending.map(
                entry =>
                    entry.run()
            )
        );

        if (
            running.size > 0
        ) {
            await Promise.all(
                Array.from(
                    running
                )
            );
        }
    }
}

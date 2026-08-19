// --------------------------------------------------
// DEBOUNCE FILE
// --------------------------------------------------
// 1-Receives a file path.
// 2-Receives a callback.
// 3-Clears any existing timer for the same file.
// 4-Creates a new timer.
// 5-Runs the callback after the delay.
// 6-Prevents multiple rapid filesystem events
//   from triggering repeated processing.
// --------------------------------------------------

const timers =
    new Map();


// --------------------------------------------------
// DEBOUNCE FILE
// --------------------------------------------------

export function debounceFile(
    filePath,
    callback,
    delay = 150
) {
    const existingTimer =
        timers.get(
            filePath
        );

    if (
        existingTimer
    ) {
        clearTimeout(
            existingTimer
        );
    }

    const timer =
        setTimeout(
            async () => {
                timers.delete(
                    filePath
                );

                await callback();
            },
            delay
        );

    timers.set(
        filePath,
        timer
    );
}


// --------------------------------------------------
// CLEAR DEBOUNCE
// --------------------------------------------------
// Removes a pending timer for one file.
// Useful when a file is deleted or when the
// watcher is shutting down.
// --------------------------------------------------

export function clearDebounce(
    filePath
) {
    const timer =
        timers.get(
            filePath
        );

    if (
        !timer
    ) {
        return;
    }

    clearTimeout(
        timer
    );

    timers.delete(
        filePath
    );
}


// --------------------------------------------------
// CLEAR ALL DEBOUNCES
// --------------------------------------------------
// Removes every pending timer.
// Useful when the watcher stops.
// --------------------------------------------------

export function clearAllDebounces() {
    for (
        const timer
        of timers.values()
    ) {
        clearTimeout(
            timer
        );
    }

    timers.clear();
}
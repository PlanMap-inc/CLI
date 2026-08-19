import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// GET EVENTS PATH
// --------------------------------------------------

function getEventsPath(
    projectRoot
) {
    return path.join(
        projectRoot,
        ".planmap",
        "events.jsonl"
    );
}


// --------------------------------------------------
// READ EVENTS
// --------------------------------------------------

export function readEvents(
    projectRoot
) {
    const eventsPath =
        getEventsPath(
            projectRoot
        );

    if (
        !fs.existsSync(
            eventsPath
        )
    ) {
        return [];
    }

    const content =
        fs.readFileSync(
            eventsPath,
            "utf8"
        );

    const events = [];

    for (
        const line
        of content.split("\n")
    ) {
        const trimmed =
            line.trim();

        if (
            !trimmed
        ) {
            continue;
        }

        events.push(
            JSON.parse(
                trimmed
            )
        );
    }

    return events;
}


// --------------------------------------------------
// GROUP EVENTS INTO SESSIONS
// --------------------------------------------------

export function groupSessions(
    events,
    gapMinutes = 5
) {
    if (
        events.length === 0
    ) {
        return [];
    }

    const sortedEvents =
        [...events].sort(
            (
                left,
                right
            ) => {
                const leftTime =
                    new Date(
                        left.ts
                    ).getTime();

                const rightTime =
                    new Date(
                        right.ts
                    ).getTime();

                return (
                    leftTime -
                    rightTime
                );
            }
        );

    const gapMilliseconds =
        gapMinutes *
        60 *
        1000;

    const sessions = [];

    let currentSession = [];

    for (
        let index = 0;
        index < sortedEvents.length;
        index++
    ) {
        const event =
            sortedEvents[index];

        if (
            currentSession.length === 0
        ) {
            currentSession.push(
                event
            );

            continue;
        }

        const previousEvent =
            sortedEvents[
                index - 1
            ];

        const previousTime =
            new Date(
                previousEvent.ts
            ).getTime();

        const currentTime =
            new Date(
                event.ts
            ).getTime();

        const gap =
            currentTime -
            previousTime;

        if (
            gap < gapMilliseconds
        ) {
            currentSession.push(
                event
            );
        } else {
            sessions.push(
                currentSession
            );

            currentSession = [
                event
            ];
        }
    }

    if (
        currentSession.length > 0
    ) {
        sessions.push(
            currentSession
        );
    }

    return sessions;
}


// --------------------------------------------------
// BUILD LINEAGE
// --------------------------------------------------

export function buildLineage(
    events
) {
    const latestEvents =
        new Map();

    const lineage = [];

    for (
        const event
        of events
    ) {
        if (
            event.type === "added"
        ) {
            lineage.push({
                event,
                parent: null
            });

            latestEvents.set(
                event.identity,
                event
            );

            continue;
        }

        if (
            event.type === "changed" ||
            event.type === "deleted"
        ) {
            const parentEvent =
                latestEvents.get(
                    event.identity
                );

            lineage.push({
                event,
                parent:
                    parentEvent || null
            });

            /*
             * Keep the original "added" event
             * as the lineage anchor.
             *
             * Do NOT replace latestEvents
             * with the changed/deleted event.
             *
             * This keeps subsequent changes
             * as siblings instead of creating
             * a staircase of nested changes.
             */
        }
    }

    return lineage;
}
import {
    createSession,
    addEventToSession,
    getDistinctIdentities,
    sealSession,
    loadSessions,
    saveSessions
} from "./sessions.js";
import {
    createCompactDelta,
    appendSessionMarker
} from "./events.js";
import { analyzeSignificance } from "./evolution/significance.js";
import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// SESSION LIMITS
// --------------------------------------------------

const MAX_DISTINCT_IDENTITIES = 20;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;


// --------------------------------------------------
// RECOVER ACTIVE SESSION
// --------------------------------------------------
// Rebuilds the currently open session from events.jsonl
// when sessions.json is missing/corrupt or has lost the
// active session.
//
// events.jsonl is the durable event history.
// sessions.json remains the compact session summary.
// --------------------------------------------------

// --------------------------------------------------
// CALCULATE RECOVERED NET DELTA
// --------------------------------------------------
// Reconstructs the compact first-before → last-after
// delta from durable changed events in events.jsonl.
//
// Example:
//
//   33333 → 44444
//   44444 → 55555
//
// becomes:
//
//   before: 33333
//   after:  55555
//   eventCount: 2
//
// Net-zero changes are removed.
// --------------------------------------------------

function calculateRecoveredNetDelta(
    events
) {
    const netDelta = {};

    for (
        const event
        of events || []
    ) {
        if (
            event.type !== "changed" ||
            !event.identity
        ) {
            continue;
        }

        const identity =
            event.identity;

        if (
            !netDelta[identity]
        ) {
            netDelta[identity] = {};
        }

        const delta =
            event.delta || {};

        for (
            const [
                property,
                values
            ]
            of Object.entries(
                delta
            )
        ) {
            if (
                !Array.isArray(values) ||
                values.length < 2
            ) {
                continue;
            }

            const before =
                values[0];

            const after =
                values[1];

            if (
                !Object.prototype.hasOwnProperty.call(
                    netDelta[identity],
                    property
                )
            ) {
                netDelta[identity][property] = {
                    before,
                    after,
                    eventCount: 1
                };
            }
            else {
                netDelta[identity][property].after =
                    after;

                netDelta[identity][property].eventCount++;
            }
        }
    }

    /*
     * Remove properties whose first value and final
     * value are identical.
     */
    for (
        const identity
        of Object.keys(
            netDelta
        )
    ) {
        for (
            const property
            of Object.keys(
                netDelta[identity]
            )
        ) {
            const change =
                netDelta[identity][property];

            if (
                JSON.stringify(
                    change.before
                ) ===
                JSON.stringify(
                    change.after
                )
            ) {
                delete netDelta[identity][property];
            }
        }

        if (
            Object.keys(
                netDelta[identity]
            ).length === 0
        ) {
            delete netDelta[identity];
        }
    }

    return netDelta;
}


function recoverSessionsFromEvents(
    projectRoot
) {
    const eventsPath =
        path.join(
            projectRoot,
            ".planmap",
            "events.jsonl"
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

    const lines =
        content
            .split("\n")
            .filter(
                line =>
                    line.trim()
            );

    if (
        lines.length === 0
    ) {
        return [];
    }

    const parsedEvents = [];

    for (
        const line
        of lines
    ) {
        try {
            parsedEvents.push(
                JSON.parse(line)
            );
        }
        catch {
            // Ignore malformed historical lines.
        }
    }

    const recoveredSessions = [];

    let currentSession =
        null;

    for (
        const event
        of parsedEvents
    ) {
        /*
         * Session start.
         */
        if (
            event.type === "session_started"
        ) {
            /*
             * If a previous session was still open,
             * preserve it before starting the next one.
             */
            if (
                currentSession
            ) {
                recoveredSessions.push(
                    currentSession
                );
            }

            currentSession = {
                id:
                    event.sessionId ||
                    `session-${Date.now()}`,

                openedAt:
                    event.ts ||
                    new Date().toISOString(),

                sealedAt:
                    null,

                sealed:
                    false,

                events:
                    []
            };

            continue;
        }

        /*
         * Session seal.
         */
        if (
            event.type === "session_sealed"
        ) {
            if (
                !currentSession
            ) {
                continue;
            }

            currentSession.sealed =
                true;

            currentSession.sealedAt =
                event.ts ||
                new Date().toISOString();

            currentSession.sealedBy =
                event.reason ||
                "unknown";

            if (
                event.commit
            ) {
                currentSession.commit =
                    event.commit;
            }

            /*
             * Build the same compact derived data
             * normally produced by sealSession().
             */
            const netDelta =
                calculateRecoveredNetDelta(
                    currentSession.events
                );

            currentSession.netDelta =
                netDelta;

            currentSession.significance =
                analyzeSignificance({
                    ...currentSession,
                    netDelta
                });

            currentSession.entries =
                buildRecoveredEntries(
                    currentSession
                );

            delete currentSession.events;

            recoveredSessions.push(
                currentSession
            );

            currentSession =
                null;

            continue;
        }

        /*
         * Ignore declaration events before the first
         * explicit session marker. These are baseline
         * events created by `planmap init`.
         */
        if (
            !currentSession
        ) {
            continue;
        }

        if (
            event.type !== "added" &&
            event.type !== "changed" &&
            event.type !== "deleted"
        ) {
            continue;
        }

        currentSession.events.push({
            identity:
                event.identity,

            type:
                event.type,

            delta:
                event.delta || {}
        });
    }

    /*
     * Preserve an unfinished session.
     */
    if (
        currentSession
    ) {
        recoveredSessions.push(
            currentSession
        );
    }

    return recoveredSessions;
}


function buildRecoveredEntries(
    session
) {
    const entries = [];

    const netDelta =
        session.netDelta || {};

    const events =
        session.events || [];

    const eventCounts =
        new Map();

    const eventTypes =
        new Map();

    for (
        const event
        of events
    ) {
        const identity =
            event.identity;

        eventCounts.set(
            identity,
            (
                eventCounts.get(
                    identity
                ) || 0
            ) + 1
        );

        if (
            !eventTypes.has(
                identity
            )
        ) {
            eventTypes.set(
                identity,
                event.type
            );
        }
    }

    const identities =
        new Set([
            ...eventTypes.keys(),
            ...Object.keys(
                netDelta
            )
        ]);

    for (
        const identity
        of identities
    ) {
        const type =
            eventTypes.get(
                identity
            ) || "changed";

        const significant =
            Boolean(
                session.significance &&
                session.significance.declarations &&
                session.significance.declarations.some(
                    declaration =>
                        declaration.identity ===
                        identity
                )
            );

        const identityNetDelta =
            netDelta[
                identity
            ] || {};

        if (
            type === "changed" &&
            Object.keys(
                identityNetDelta
            ).length === 0
        ) {
            continue;
        }

        entries.push({
            identity,

            type,

            netDelta:
                identityNetDelta,

            significant,

            eventCount:
                eventCounts.get(
                    identity
                ) || 0
        });
    }

    return entries;
}


function recoverActiveSession(
    projectRoot,
    sessions
) {
    /*
     * Normal path.
     */
    const activeSession =
        sessions.find(
            session =>
                !session.sealed
        );

    if (
        activeSession
    ) {
        return activeSession;
    }

    /*
     * Recovery path.
     *
     * sessions.json may be missing or incomplete.
     * Reconstruct the complete session history from
     * events.jsonl.
     */
    const recoveredSessions =
        recoverSessionsFromEvents(
            projectRoot
        );

    if (
        recoveredSessions.length === 0
    ) {
        return null;
    }

    /*
     * Replace the caller's session list with the
     * reconstructed history.
     */
    sessions.splice(
        0,
        sessions.length,
        ...recoveredSessions
    );

    return recoveredSessions.find(
        session =>
            !session.sealed
    ) || null;
}

// --------------------------------------------------
// CREATE SESSION MANAGER
// --------------------------------------------------

export function createSessionManager(
    projectRoot
) {
    const sessions =
        loadSessions(
            projectRoot
        );

    let activeSession =
        recoverActiveSession(
            projectRoot,
            sessions
        );


    /*
     * Existing sessions created before durable session
     * markers existed need a marker written before any
     * new declaration events are recorded.
     *
     * This is safe because the marker is written at
     * session-manager startup, immediately after init.
     */
    function hasSessionStartMarker(
        sessionId
    ) {
        const eventsPath =
            path.join(
                projectRoot,
                ".planmap",
                "events.jsonl"
            );

        if (
            !fs.existsSync(
                eventsPath
            )
        ) {
            return false;
        }

        const content =
            fs.readFileSync(
                eventsPath,
                "utf8"
            );

        return content
            .split("\n")
            .some(
                line => {
                    if (
                        !line.trim()
                    ) {
                        return false;
                    }

                    try {
                        const event =
                            JSON.parse(
                                line
                            );

                        return (
                            event.type ===
                                "session_started" &&
                            event.sessionId ===
                                sessionId
                        );
                    }
                    catch {
                        return false;
                    }
                }
            );
    }

    if (
        !activeSession
    ) {
        activeSession =
            createSession();

        sessions.push(
            activeSession
        );

        appendSessionMarker(
            projectRoot,
            "session_started",
            {
                sessionId:
                    activeSession.id
            }
        );

        saveSessions(
            projectRoot,
            sessions
        );
    }
    else if (
        !sessions.includes(
            activeSession
        )
    ) {
        sessions.push(
            activeSession
        );

        saveSessions(
            projectRoot,
            sessions
        );
    }

    // Recovery may rebuild sessions entirely from
    // events.jsonl when sessions.json is missing.
    // Persist that reconstructed state immediately.
    if (
        sessions.length > 0
    ) {
        saveSessions(
            projectRoot,
            sessions
        );
    }

    /*
     * If an existing active session has no durable
     * start marker, write one now.
     *
     * Baseline events from `init` remain before this
     * marker and therefore stay outside the session.
     */
    if (
        activeSession &&
        !hasSessionStartMarker(
            activeSession.id
        )
    ) {
        appendSessionMarker(
            projectRoot,
            "session_started",
            {
                sessionId:
                    activeSession.id
            }
        );
    }

    let idleTimer =
        null;


    // --------------------------------------------------
    // SAVE
    // --------------------------------------------------

    function save() {
        saveSessions(
            projectRoot,
            sessions
        );
    }


    // --------------------------------------------------
    // SEAL CURRENT SESSION
    // --------------------------------------------------

    function seal(
        reason = "manual",
        meta = {}
    ) {
        if (
            !activeSession ||
            activeSession.sealed
        ) {
            return null;
        }

        // Never seal an empty session.
        if (
            !activeSession.events ||
            activeSession.events.length === 0
        ) {
            return null;
        }

        sealSession(
            activeSession,
            reason,
            meta
        );

        appendSessionMarker(
            projectRoot,
            "session_sealed",
            {
                sessionId:
                    activeSession.id,

                reason,

                commit:
                    meta.commit || null
            }
        );

        save();

        const sealedSession =
            activeSession;

        activeSession =
            createSession();

        appendSessionMarker(
            projectRoot,
            "session_started",
            {
                sessionId:
                    activeSession.id
            }
        );

        sessions.push(
            activeSession
        );

        save();

        return sealedSession;
    }

    // --------------------------------------------------
    // DISCARD CURRENT SESSION
    // --------------------------------------------------
    // Used when Git changes branches.
    //
    // A branch checkout is not completed work, so the
    // current open session must not be sealed.
    // --------------------------------------------------

    function discard() {
        if (
            idleTimer
        ) {
            clearTimeout(
                idleTimer
            );

            idleTimer =
                null;
        }

        if (
            activeSession
        ) {
            const index =
                sessions.indexOf(
                    activeSession
                );

            if (
                index !== -1
            ) {
                sessions.splice(
                    index,
                    1
                );
            }
        }

        activeSession =
            createSession();

        sessions.push(
            activeSession
        );

        save();
    }


    // --------------------------------------------------
    // RESET IDLE TIMER
    // --------------------------------------------------

    function resetIdleTimer() {
        if (
            idleTimer
        ) {
            clearTimeout(
                idleTimer
            );
        }

        idleTimer =
            setTimeout(
                () => {
                    seal();
                },
                IDLE_TIMEOUT_MS
            );

        if (
            idleTimer.unref
        ) {
            idleTimer.unref();
        }
    }


    // --------------------------------------------------
    // ADD EVENTS
    // --------------------------------------------------

    function addEvents(
        events
    ) {
        if (
            !events ||
            events.length === 0
        ) {
            return null;
        }

        for (
            const event
            of events
        ) {
            const normalizedEvent = {
                identity:
                    event.identity,

                type:
                    event.type,

                delta:
                    event.type === "changed"
                        ? createCompactDelta(
                            event
                        )
                        : {}
            };

            addEventToSession(
                activeSession,
                normalizedEvent
            );
        }

        resetIdleTimer();

        const distinctCount =
            getDistinctIdentities(
                activeSession
            ).size;

        if (
            distinctCount >=
            MAX_DISTINCT_IDENTITIES
        ) {
            return seal();
        }

        save();

        return null;
    }

    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

    function getStatus() {
        return {
            activeSession,
            distinctIdentities:
                getDistinctIdentities(
                    activeSession
                ).size
        };
    }


    return {
        addEvents,
        seal,
        discard,
        getStatus,
        getActiveSession() {
            return activeSession;
        }
    };
}

import {
    createSession,
    addEventToSession,
    getDistinctIdentities,
    sealSession,
    loadSessions,
    saveSessions
} from "./sessions.js";


// --------------------------------------------------
// SESSION LIMITS
// --------------------------------------------------

const MAX_DISTINCT_IDENTITIES = 20;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;


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
        sessions.find(
            session =>
                !session.sealed
        );

    if (
        !activeSession
    ) {
        activeSession =
            createSession();

        sessions.push(
            activeSession
        );

        saveSessions(
            projectRoot,
            sessions
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

        save();

        const sealedSession =
            activeSession;

        activeSession =
            createSession();

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
            addEventToSession(
                activeSession,
                event
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
        getStatus
    };
}

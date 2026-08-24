const ALWAYS_SIGNIFICANT = new Set([
    "throws",
    "throwTypes",
    "returns",
    "returnsNullish",
    "catches",
    "emptyCatches",
    "params",
    "awaits"
]);

const DEFAULT_NOISE_CALL_PREFIXES = [
    "console.",
    "logger.",
    "debug."
];

function getNoiseCallPrefixes(session) {
    const configured =
        session?.config?.significance?.noiseCallPrefixes;

    if (
        Array.isArray(configured) &&
        configured.length > 0
    ) {
        return configured;
    }

    return DEFAULT_NOISE_CALL_PREFIXES;
}

function isNoiseCall(
    call,
    prefixes
) {
    if (typeof call !== "string") {
        return false;
    }

    return prefixes.some(
        prefix =>
            call === prefix ||
            call.startsWith(prefix)
    );
}

function changedValues(before, after) {
    return (
        JSON.stringify(before) !==
        JSON.stringify(after)
    );
}

function callsOnlyContainNoise(
    before,
    after,
    prefixes
) {
    const oldCalls =
        Array.isArray(before)
            ? before
            : [];

    const newCalls =
        Array.isArray(after)
            ? after
            : [];

    const removed =
        oldCalls.filter(
            call =>
                !newCalls.includes(call)
        );

    const added =
        newCalls.filter(
            call =>
                !oldCalls.includes(call)
        );

    return [
        ...removed,
        ...added
    ].every(
        call =>
            isNoiseCall(
                call,
                prefixes
            )
    );
}

function isPropertySignificant(
    property,
    change,
    noisePrefixes
) {
    const before =
        change.before;

    const after =
        change.after;

    if (
        !changedValues(
            before,
            after
        )
    ) {
        return false;
    }

    if (
        ALWAYS_SIGNIFICANT.has(
            property
        )
    ) {
        return true;
    }

    if (
        property === "numbers"
    ) {
        return true;
    }

    if (
        property === "calls"
    ) {
        return !callsOnlyContainNoise(
            before,
            after,
            noisePrefixes
        );
    }

    return false;
}


// --------------------------------------------------
// ANALYZE SESSION SIGNIFICANCE
// --------------------------------------------------

export function analyzeSignificance(
    session
) {
    const reasons = [];
    const declarations = [];

    const noisePrefixes =
        getNoiseCallPrefixes(
            session
        );

    for (
        const event
        of session.events || []
    ) {
        if (
            event.type === "added" ||
            event.type === "deleted"
        ) {
            declarations.push({
                identity:
                    event.identity,

                type:
                    event.type
            });
        }
    }

    for (
        const [
            identity,
            properties
        ]
        of Object.entries(
            session.netDelta || {}
        )
    ) {
        for (
            const [
                property,
                change
            ]
            of Object.entries(
                properties
            )
        ) {
            if (
                isPropertySignificant(
                    property,
                    change,
                    noisePrefixes
                )
            ) {
                reasons.push({
                    identity,
                    property,
                    before:
                        change.before,
                    after:
                        change.after,
                    eventCount:
                        change.eventCount
                });
            }
        }
    }

    // --------------------------------------------------
    // CHANGED DECLARATION SIGNIFICANCE
    // --------------------------------------------------
    //
    // reasons already contains the identities whose
    // changed properties were classified as significant.
    //
    // Keep declarations in sync so downstream session
    // entries can correctly set entry.significant.
    // --------------------------------------------------

    const significantDeclarationIdentities =
        new Set(
            declarations.map(
                declaration =>
                    declaration.identity
            )
        );

    for (
        const reason
        of reasons
    ) {
        if (
            !reason ||
            !reason.identity ||
            significantDeclarationIdentities.has(
                reason.identity
            )
        ) {
            continue;
        }

        declarations.push({
            identity:
                reason.identity,

            type:
                "changed"
        });

        significantDeclarationIdentities.add(
            reason.identity
        );
    }



    return {
        significant:
            declarations.length > 0 ||
            reasons.length > 0,

        reasons,

        declarations
    };
}

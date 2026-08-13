// src/diff.js


// --------------------------------------------------
// FORMAT PROPERTY VALUE
// --------------------------------------------------

function formatValue(value) {

    if (Array.isArray(value)) {

        if (value.length === 0) {
            return "[]";
        }

        return `[${value.join(", ")}]`;
    }


    if (
        value === undefined ||
        value === null
    ) {
        return "-";
    }


    return String(value);
}


// --------------------------------------------------
// COMPARE PROPERTY OBJECTS
// --------------------------------------------------

function diffProperties(
    before,
    after
) {

    const changes = [];


    // ------------------------------------------------
    // NORMAL FACTS
    // ------------------------------------------------

    const keys = [
        "throws",
        "throwTypes",
        "returnsNullish",
        "calls",
        "numbers",
        "awaits",
        "catches",
        "emptyCatches",
        "params"
    ];


    for (
        const key
        of keys
    ) {

        const beforeValue =
            before?.[key];

        const afterValue =
            after?.[key];


        if (
            JSON.stringify(
                beforeValue
            ) !==
            JSON.stringify(
                afterValue
            )
        ) {

            changes.push({
                property: key,
                before: beforeValue,
                after: afterValue
            });
        }
    }


    // ------------------------------------------------
    // NORMAL RETURNS
    // ------------------------------------------------
    //
    // returns includes nullish returns.
    //
    // We compare only non-nullish returns:
    //
    // normalReturns =
    //     returns - returnsNullish
    //
    // This prevents:
    //
    // throw → return null
    //
    // from appearing as two separate return
    // changes.

    const beforeReturns =
        before?.returns ?? 0;

    const afterReturns =
        after?.returns ?? 0;

    const beforeNullish =
        before?.returnsNullish ?? 0;

    const afterNullish =
        after?.returnsNullish ?? 0;


    const beforeNormalReturns =
        beforeReturns -
        beforeNullish;

    const afterNormalReturns =
        afterReturns -
        afterNullish;


    if (
        beforeNormalReturns !==
        afterNormalReturns
    ) {

        changes.push({
            property: "returns",
            before: beforeNormalReturns,
            after: afterNormalReturns
        });
    }


    return changes;
}


// --------------------------------------------------
// DIFF DECLARATIONS
// --------------------------------------------------

export function diffDeclarations(
    beforeDeclarations,
    afterDeclarations
) {

    const beforeMap =
        new Map(
            beforeDeclarations.map(
                declaration => [
                    declaration.identity,
                    declaration
                ]
            )
        );


    const afterMap =
        new Map(
            afterDeclarations.map(
                declaration => [
                    declaration.identity,
                    declaration
                ]
            )
        );


    const changes = [];


    // ------------------------------------------------
    // BEFORE → AFTER
    // ------------------------------------------------

    for (
        const [
            identity,
            before
        ]
        of beforeMap
    ) {

        // --------------------------------------------
        // DELETED
        // --------------------------------------------

        if (
            !afterMap.has(identity)
        ) {

            changes.push({
                identity,
                type: "deleted",
                before,
                after: null,
                changes: []
            });

            continue;
        }


        // --------------------------------------------
        // EXISTS IN BOTH
        // --------------------------------------------

        const after =
            afterMap.get(identity);


        const propertyChanges =
            diffProperties(
                before.properties,
                after.properties
            );


        if (
            propertyChanges.length > 0
        ) {

            changes.push({
                identity,
                type: "changed",
                before,
                after,
                changes: propertyChanges
            });

        }

        else {

            changes.push({
                identity,
                type: "unchanged",
                before,
                after,
                changes: []
            });
        }
    }


    // ------------------------------------------------
    // ADDED
    // ------------------------------------------------

    for (
        const [
            identity,
            after
        ]
        of afterMap
    ) {

        if (
            !beforeMap.has(identity)
        ) {

            changes.push({
                identity,
                type: "added",
                before: null,
                after,
                changes: []
            });
        }
    }


    return changes;
}


// --------------------------------------------------
// FORMAT DIFF OUTPUT
// --------------------------------------------------

export function formatDiff(
    changes,
    beforeFile,
    afterFile
) {

    console.log(
        `\nComparing ${beforeFile} → ${afterFile}\n`
    );


    let changed = 0;
    let added = 0;
    let deleted = 0;
    let unchanged = 0;


    for (
        const change
        of changes
    ) {

        // ------------------------------------------
        // CHANGED
        // ------------------------------------------

        if (
            change.type === "changed"
        ) {

            changed++;


            console.log(
                `  ${change.identity.padEnd(32)} CHANGED`
            );


            for (
                const propertyChange
                of change.changes
            ) {

                const before =
                    formatValue(
                        propertyChange.before
                    );

                const after =
                    formatValue(
                        propertyChange.after
                    );


                console.log(
                    `      ${propertyChange.property.padEnd(16)} ${before} → ${after}`
                );
            }


            console.log();
        }


        // ------------------------------------------
        // ADDED
        // ------------------------------------------

        else if (
            change.type === "added"
        ) {

            added++;


            console.log(
                `  ${change.identity.padEnd(32)} ADDED`
            );
        }


        // ------------------------------------------
        // DELETED
        // ------------------------------------------

        else if (
            change.type === "deleted"
        ) {

            deleted++;


            console.log(
                `  ${change.identity.padEnd(32)} DELETED`
            );
        }


        // ------------------------------------------
        // UNCHANGED
        // ------------------------------------------

        else if (
            change.type === "unchanged"
        ) {

            unchanged++;
        }
    }


    console.log(
        `${changed} changed · ` +
        `${added} added · ` +
        `${deleted} deleted · ` +
        `${unchanged} unchanged`
    );
}
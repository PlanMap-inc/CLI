
// --------------------------------------------------
// CHECK DUPLICATE IDENTITIES
// 1-Receives the declarations.
// 2-Creates a Set for identities.
// 3-Loops through declarations.
// 4-Checks whether an identity already exists.
// 5-Warns when a duplicate is found.
// 6-Stores each identity.
// --------------------------------------------------

export function checkDuplicates(
    declarations
) {
    const identities =
        new Set();

    for (
        const declaration
        of declarations
    ) {
        if (
            identities.has(
                declaration.identity
            )
        ) {
            console.warn(
                `Duplicate identity: ${declaration.identity}`
            );
        }

        identities.add(
            declaration.identity
        );
    }
}
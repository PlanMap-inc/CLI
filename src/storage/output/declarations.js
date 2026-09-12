// --------------------------------------------------
// PRINT DECLARATIONS
// --------------------------------------------------
// 1-Receives the file path and declarations.
// 2-Prints the file path.
// 3-Checks whether any declarations were found.
// 4-If there are no declarations:
// 5-Prints "No declarations found."
// 6-Calculates the name column width.
// 7-Prints the table header.
// 8-Prints the separator.
// 9-Loops through declarations.
// 10-Calculates each declaration location.
// 11-Checks whether the declaration has modifiers.
// 12-Formats the declaration information.
// 13-Prints each declaration.
// 14-Prints the total number of declarations.
// --------------------------------------------------

export function printDeclarations(
    filePath,
    declarations
) {
    console.log(
        `\nFile: ${filePath}\n`
    );

    if (
        declarations.length === 0
    ) {
        console.log(
            "No declarations found."
        );

        return;
    }

    const nameWidth =
        Math.max(
            "name".length,
            ...declarations.map(
                declaration =>
                    declaration.name.length
            )
        ) + 2;

    console.log(
        "kind".padEnd(24) +
        "name".padEnd(nameWidth) +
        "location"
    );

    console.log(
        "-".repeat(
            24 + nameWidth + 20
        )
    );

    for (
        const declaration
        of declarations
    ) {
        const location =
            `${declaration.startLine}:${declaration.startColumn}` +
            `-${declaration.endLine}:${declaration.endColumn}`;

        const displayKind =
            declaration.modifiers.length > 0
                ? `${declaration.kind} [${declaration.modifiers.join(", ")}]`
                : declaration.kind;

        console.log(
            displayKind.padEnd(24) +
            declaration.name.padEnd(nameWidth) +
            location
        );
    }

    console.log(
        `\n${declarations.length} declarations`
    );
}
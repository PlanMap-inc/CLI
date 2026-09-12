import { parseFile } from "../../baseline/parser.js";

import {
    diffDeclarations,
    formatDiff
} from "../../changes/diff.js";

// --------------------------------------------------
// RUN DIFF
// 1-Receives before and after file paths.
// 2-Checks both paths.
// 3-Parses both files.
// 4-Gets declarations.
// 5-Compares declarations.
// 6-Formats the differences.
// --------------------------------------------------

export function runDiff(
    beforePath,
    afterPath
) {
    if (
        !beforePath ||
        !afterPath
    ) {
        console.error(
            "Usage: node src/cli/cli.js diff <before> <after>"
        );

        process.exit(1);
    }

    const before =
        parseFile(
            beforePath
        );

    const after =
        parseFile(
            afterPath
        );

    const changes =
        diffDeclarations(
            before.declarations,
            after.declarations
        );

    formatDiff(
        changes,
        beforePath,
        afterPath
    );
}


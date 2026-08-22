import fs from "node:fs";
import path from "node:path";

import {
    loadSessions
} from "../sessions.js";


// --------------------------------------------------
// RUN NAME
//
// This command is intentionally the only session
// command that is allowed to invoke the LLM.
//
// The actual provider call should be connected to
// the existing evolution/LLM implementation.
// --------------------------------------------------

export async function runName(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js name <project-folder>"
        );

        process.exitCode = 1;
        return;
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
        console.error(
            `Project folder not found: ${projectPath}`
        );

        process.exitCode = 1;
        return;
    }

    const sessions =
        loadSessions(
            projectRoot
        );

    const candidates =
        sessions
            .filter(
                session =>
                    session.sealed &&
                    session.significance &&
                    session.significance.significant
            )
            .sort(
                (
                    left,
                    right
                ) =>
                    new Date(
                        right.sealedAt
                    ).getTime() -
                    new Date(
                        left.sealedAt
                    ).getTime()
            );

    if (
        candidates.length === 0
    ) {
        console.log(
            "No significant sealed session needs a name."
        );

        return;
    }

    const session =
        candidates[0];

    console.log(
        `Session ready for naming: ${session.id}`
    );

    console.log(
        "LLM boundary reached."
    );

    console.log(
        "Significant changes:"
    );

    console.log(
        JSON.stringify(
            session.significance,
            null,
            2
        )
    );

    // Intentionally no provider call here yet.
    // Connect this point to the existing LLM provider
    // after the session/significance tests pass.
}

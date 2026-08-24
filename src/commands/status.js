import fs from "node:fs";
import path from "node:path";

import {
    createSessionManager
} from "../session-manager.js";


// --------------------------------------------------
// RUN STATUS
// --------------------------------------------------

export function runStatus(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js status <project-folder>"
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

    const manager =
        createSessionManager(
            projectRoot
        );

    const activeSession =
        manager.getActiveSession();

    if (
        !activeSession
    ) {
        console.log(
            "No active session."
        );

        return;
    }

    const events =
        activeSession.events || [];

    const identities =
        new Set(
            events.map(
                event =>
                    event.identity
            )
        );

    console.log(
        "\nPlanMap Status\n"
    );

    console.log(
        `Active session: ${activeSession.id}`
    );

    console.log(
        `Opened: ${activeSession.openedAt}`
    );

    console.log(
        `Events: ${events.length}`
    );

    console.log(
        `Distinct declarations: ${identities.size}`
    );

    console.log(
        "\nSession is still open."
    );
}

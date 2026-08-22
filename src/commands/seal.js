import {
    createSessionManager
} from "../session-manager.js";


// --------------------------------------------------
// RUN SEAL
// --------------------------------------------------

export function runSeal(
    projectRoot
) {
    if (
        !projectRoot
    ) {
        console.error(
            "Usage: node src/cli.js seal <project-folder>"
        );

        process.exit(1);
    }

    const manager =
        createSessionManager(
            projectRoot
        );

    const result =
        manager.seal();

    if (
        !result
    ) {
        console.log(
            "No active session to seal."
        );

        return;
    }

    console.log(
        `Session sealed: ${result.id}`
    );

    console.log(
        `New active session: ${manager.getStatus().activeSession.id}`
    );
}

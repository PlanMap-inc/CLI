import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";


// --------------------------------------------------
// GET CURRENT GIT COMMIT
// --------------------------------------------------

function getCurrentCommit(
    projectRoot
) {
    try {
        return execFileSync(
            "git",
            [
                "-C",
                projectRoot,
                "rev-parse",
                "HEAD"
            ],
            {
                encoding: "utf8",
                stdio: [
                    "ignore",
                    "pipe",
                    "ignore"
                ]
            }
        ).trim();
    } catch {
        return null;
    }
}


// --------------------------------------------------
// WATCH GIT BOUNDARY
// --------------------------------------------------
// Detects a new Git commit while PlanMap is watching.
//
// Git filesystem ref files are not reliable watcher
// boundaries because Git may update refs through
// filesystem operations that do not produce the event
// we expect on the individual ref file.
//
// Therefore we poll the authoritative Git state:
//     git rev-parse HEAD
//
// A changed commit SHA represents a Git boundary.
// --------------------------------------------------

export function watchGitBoundary(
    projectRoot,
    onGitBoundary
) {
    const gitDirectory =
        path.join(
            projectRoot,
            ".git"
        );

    if (
        !fs.existsSync(
            gitDirectory
        )
    ) {
        return null;
    }

    let lastCommit =
        getCurrentCommit(
            projectRoot
        );

    if (
        !lastCommit
    ) {
        return null;
    }

    console.log(
        `Git boundary watcher active: ${lastCommit}`
    );


    const interval =
        setInterval(
            () => {

                const currentCommit =
                    getCurrentCommit(
                        projectRoot
                    );

                if (
                    !currentCommit
                ) {
                    return;
                }

                if (
                    currentCommit ===
                    lastCommit
                ) {
                    return;
                }

                const previousCommit =
                    lastCommit;

                lastCommit =
                    currentCommit;

                console.log(
                    "\nGIT STATE CHANGED"
                );

                console.log(
                    "Previous:",
                    previousCommit
                );

                console.log(
                    "Current:",
                    currentCommit
                );

                console.log(
                    "\nGit boundary detected."
                );

                try {
                    onGitBoundary({
                        previousCommit,
                        currentCommit
                    });
                } catch (error) {
                    console.error(
                        `Git boundary callback error: ${error.message}`
                    );
                }

            },
            1000
        );


    return {
        close() {
            clearInterval(
                interval
            );
        }
    };
}

import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";


// --------------------------------------------------
// GET CURRENT GIT COMMIT
// --------------------------------------------------

function getCurrentCommit(
    projectRoot
) {
    return new Promise(
        resolve => {

            execFile(
                "git",
                [
                    "-C",
                    projectRoot,
                    "rev-parse",
                    "HEAD"
                ],
                {
                    encoding:
                        "utf8"
                },
                (
                    error,
                    stdout
                ) => {

                    if (
                        error
                    ) {
                        resolve(
                            null
                        );

                        return;
                    }

                    resolve(
                        stdout.trim()
                    );
                }
            );
        }
    );
}


// --------------------------------------------------
// GET CURRENT GIT BRANCH
// --------------------------------------------------

function getCurrentBranch(
    projectRoot
) {
    return new Promise(
        resolve => {

            execFile(
                "git",
                [
                    "-C",
                    projectRoot,
                    "rev-parse",
                    "--abbrev-ref",
                    "HEAD"
                ],
                {
                    encoding:
                        "utf8"
                },
                (
                    error,
                    stdout
                ) => {

                    if (
                        error
                    ) {
                        resolve(
                            null
                        );

                        return;
                    }

                    resolve(
                        stdout.trim()
                    );
                }
            );
        }
    );
}


// --------------------------------------------------
// FIND GIT ROOT
// --------------------------------------------------

function findGitRoot(
    projectRoot
) {
    let current =
        path.resolve(
            projectRoot
        );

    while (true) {

        const gitDirectory =
            path.join(
                current,
                ".git"
            );

        if (
            fs.existsSync(
                gitDirectory
            )
        ) {
            return current;
        }

        const parent =
            path.dirname(
                current
            );

        if (
            parent ===
            current
        ) {
            return null;
        }

        current =
            parent;
    }
}


// --------------------------------------------------
// WATCH GIT BOUNDARY
// --------------------------------------------------
// Detects Git commit and branch boundaries while
// PlanMap watches a project inside a Git repository.
// --------------------------------------------------

export async function watchGitBoundary(
    projectRoot,
    onGitBoundary
) {
    const gitRoot =
        findGitRoot(
            projectRoot
        );

    if (
        !gitRoot
    ) {
        console.log(
            "Git boundary watcher disabled: no Git repository found."
        );

        return null;
    }

    let lastCommit =
        await getCurrentCommit(
            gitRoot
        );

    if (
        !lastCommit
    ) {
        return null;
    }

    let lastBranch =
        await getCurrentBranch(
            gitRoot
        );

    if (
        !lastBranch
    ) {
        return null;
    }

    console.log(
        `Git boundary watcher active: ${lastCommit}`
    );

    console.log(
        `Git branch watcher active: ${lastBranch}`
    );


    const interval =
        setInterval(
            async () => {

                const currentCommit =
                    await getCurrentCommit(
                        gitRoot
                    );

                const currentBranch =
                    await getCurrentBranch(
                        gitRoot
                    );

                if (
                    !currentCommit ||
                    !currentBranch
                ) {
                    return;
                }

                if (
                    currentBranch !==
                    lastBranch
                ) {
                    const previousBranch =
                        lastBranch;

                    const previousCommit =
                        lastCommit;

                    lastBranch =
                        currentBranch;

                    lastCommit =
                        currentCommit;

                    console.log(
                        "\nGIT BRANCH CHANGED"
                    );

                    console.log(
                        "Previous branch:",
                        previousBranch
                    );

                    console.log(
                        "Current branch:",
                        currentBranch
                    );

                    try {
                        onGitBoundary({
                            type:
                                "branch-switch",

                            previousCommit,

                            currentCommit,

                            previousBranch,

                            currentBranch
                        });
                    }

                    catch (error) {
                        console.error(
                            `Git branch callback error: ${error.message}`
                        );
                    }

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
                        type:
                            "commit",

                        previousCommit,

                        currentCommit,

                        currentBranch
                    });
                }

                catch (error) {
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

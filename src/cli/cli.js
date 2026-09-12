import {
    parseFile
} from "../baseline/parser.js";

import {
    checkDuplicates
} from "../baseline/declarations/utils.js";

import {
    printDeclarations
} from "../storage/output/declarations.js";

import {
    runInit
} from "./commands/init.js";

import {
    runProjectCheck
} from "./commands/check.js";

import {
    runAccept
} from "./commands/accept.js";

import {
    runWatch
} from "./commands/watch.js";

import {
    runSeal
} from "./commands/seal.js";

import {
    runDiff
} from "./commands/diff.js";

import {
    runEvolution
} from "./commands/evolution.js";

import {
    runPlanList,
    runPlanShow,
    runPlanDraft
} from "./commands/plan.js";

import {
    runPlanApprove
} from "./commands/approve.js";

import {
    runPlanReject
} from "./commands/reject.js";

import {
    runPlanRevise
} from "./commands/revise.js";

import {
    runStatus
} from "./commands/status.js";

import {
    runName
} from "./commands/name.js";

import {
    runVerify
} from "./commands/verify.js";


// --------------------------------------------------
// MAIN CLI
// --------------------------------------------------

const args =
    process.argv.slice(
        2
    );


// --------------------------------------------------
// NO COMMAND
// --------------------------------------------------

if (
    args.length === 0
) {
    console.error(
        "Usage:"
    );

    console.error(
        "  node src/cli/cli.js <file>"
    );

    console.error(
        "  node src/cli/cli.js <file> --json"
    );

    console.error(
        "  node src/cli/cli.js diff <before> <after>"
    );

    console.error(
        "  node src/cli/cli.js init <project-folder> [--verbose]"
    );

    console.error(
        "  node src/cli/cli.js check <project-folder> [--all] [--json] [--verbose]"
    );

    console.error(
        "  node src/cli/cli.js accept <project-folder> [--verbose]"
    );

    console.error(
        "  node src/cli/cli.js watch <project-folder>"
    );

    console.error(
        "  node src/cli/cli.js seal <project-folder>"
    );

    console.error(
        "  node src/cli/cli.js evolution <project-folder>"
    );

    console.error(
        "  node src/cli/cli.js evolution <project-folder> --md"
    );

    console.error(
        "  node src/cli/cli.js status <project-folder>"
    );

    console.error(
        "  node src/cli/cli.js name <project-folder>"
    );

    console.error(
        "  node src/cli/cli.js plan draft <project-folder>"
    );

    console.error(
        "  node src/cli/cli.js plan draft <project-folder> --from \"<description>\""
    );

    console.error(
        "  node src/cli/cli.js plan list <project-folder>"
    );

    console.error(
        "  node src/cli/cli.js plan show <project-folder> <identity>"
    );

    console.error(
        "  node src/cli/cli.js approve <project-folder> [identity]"
    );

    console.error(
        "  node src/cli/cli.js approve <project-folder> --all | --lens <id> | --feature <name>"
    );

    console.error(
        "  node src/cli/cli.js reject <project-folder> <identity> [--force]"
    );

    console.error(
        "  node src/cli/cli.js plan revise <project-folder> <identity>"
    );

    console.error(
        "  node src/cli/cli.js verify <project-folder> [--json] [--md] [--lens <id>] [--identity <id>] [--only drifted] [--strict]"
    );

    process.exit(1);
}


// --------------------------------------------------
// DIFF COMMAND
// --------------------------------------------------

if (
    args[0] === "diff"
) {
    runDiff(
        args[1],
        args[2]
    );
}


// --------------------------------------------------
// INIT COMMAND
// --------------------------------------------------

else if (
    args[0] === "init"
) {
    runInit(
        args[1],
        {
            verbose: args.includes("--verbose")
        }
    );
}


// --------------------------------------------------
// CHECK COMMAND
// --------------------------------------------------

else if (
    args[0] === "check"
) {
    if (
        args[1] === "--help" ||
        args[1] === "-h"
    ) {
        console.log(
            "Usage: node src/cli/cli.js check <project-folder> [--all] [--json] [--verbose]"
        );

        console.log(
            "  --all    Show insignificant changes too"
        );

        console.log(
            "  --json   Output machine-readable JSON"
        );

        console.log(
            "  --verbose Show skipped file paths"
        );

        process.exit(0);
    }

    runProjectCheck(
        args[1],
        {
            all:
                args.includes(
                    "--all"
                ),
            json:
                args.includes(
                    "--json"
                ),
            verbose:
                args.includes(
                    "--verbose"
                )
        }
    );
}


// --------------------------------------------------
// ACCEPT COMMAND
// --------------------------------------------------

else if (
    args[0] === "accept"
) {
    runAccept(
        args[1],
        {
            verbose: args.includes("--verbose")
        }
    );
}


// --------------------------------------------------
// WATCH COMMAND
// --------------------------------------------------

else if (
    args[0] === "watch"
) {
    runWatch(
        args[1]
    ).catch(
        error => {
            console.error(
                `Watch error: ${error.message}`
            );

            process.exit(1);
        }
    );
}


// --------------------------------------------------
// SEAL COMMAND
// --------------------------------------------------

else if (
    args[0] === "seal"
) {
    runSeal(
        args[1]
    );
}


// --------------------------------------------------
// VERIFY COMMAND
// --------------------------------------------------

else if (
    args[0] === "verify"
) {
    const lensIndex =
        args.indexOf("--lens");

    const identityIndex =
        args.indexOf("--identity");

    const onlyIndex =
        args.indexOf("--only");

    await runVerify(
        args[1],
        {
            json:
                args.includes("--json"),

            md:
                args.includes("--md"),

            lens:
                lensIndex !== -1
                    ? args[lensIndex + 1]
                    : undefined,

            identity:
                identityIndex !== -1
                    ? args[identityIndex + 1]
                    : undefined,

            only:
                onlyIndex !== -1
                    ? args[onlyIndex + 1]
                    : undefined,

            strict:
                args.includes("--strict")
        }
    );
}

// --------------------------------------------------
// STATUS COMMAND
// --------------------------------------------------

else if (
    args[0] === "status"
) {
    runStatus(
        args[1]
    );
}


// --------------------------------------------------
// NAME COMMAND
// --------------------------------------------------

else if (
    args[0] === "name"
) {
    await runName(
        args[1]
    );
}


// --------------------------------------------------
// EVOLUTION COMMAND
// --------------------------------------------------

else if (
    args[0] === "evolution"
) {
    await runEvolution(
        args[1],
        args.includes(
            "--md"
        )
    );
}


// --------------------------------------------------
// REJECT COMMAND
// --------------------------------------------------

else if (
    args[0] === "plan" &&
    args[1] === "revise"
) {
    const projectRoot =
        args[2];

    const identity =
        args[3];

    runPlanRevise(
        projectRoot,
        identity
    );
}

else if (
    args[0] === "reject"
) {
    const projectRoot =
        args[1];

    const target =
        args[2] &&
        !args[2].startsWith("--")
            ? args[2]
            : null;

    await runPlanReject(
        projectRoot,
        target,
        {
            force:
                args.includes("--force")
        }
    );
}

// --------------------------------------------------
// APPROVE COMMAND
// --------------------------------------------------

else if (
    args[0] === "approve"
) {
    const projectRoot =
        args[1];

    const target =
        args[2] &&
        !args[2].startsWith("--")
            ? args[2]
            : null;

    const lensIndex =
        args.indexOf("--lens");

    const featureIndex =
        args.indexOf("--feature");

    await runPlanApprove(
        projectRoot,
        target,
        {
            all:
                args.includes("--all"),

            lens:
                lensIndex !== -1
                    ? args[lensIndex + 1]
                    : null,

            feature:
                featureIndex !== -1
                    ? args[featureIndex + 1]
                    : null
        }
    );
}


// --------------------------------------------------
// PLAN COMMAND
// --------------------------------------------------

else if (
    args[0] === "plan"
) {
    const subcommand =
        args[1];

    if (
        subcommand === "draft"
    ) {
        const fromIndex =
            args.indexOf("--from");

        const description =
            fromIndex !== -1
                ? args[fromIndex + 1]
                : null;

        await runPlanDraft(
            args[2],
            description
        );
    }

    else if (
        subcommand === "list"
    ) {
        runPlanList(
            args[2]
        );
    }

    else if (
        subcommand === "show"
    ) {
        runPlanShow(
            args[2],
            args[3]
        );
    }

    else {
        console.error(
            "Usage: planmap plan list <project>"
        );

        console.error(
            "Usage: planmap plan show <project> <identity>"
        );
    }
}


// --------------------------------------------------
// NORMAL FILE COMMAND
// --------------------------------------------------

else {
    const filePath =
        args[0];

    const json =
        args.includes(
            "--json"
        );

    const result =
        parseFile(
            filePath
        );

    checkDuplicates(
        result.declarations
    );

    if (
        json
    ) {
        console.log(
            JSON.stringify(
                result.declarations,
                null,
                2
            )
        );
    }

    else {
        printDeclarations(
            filePath,
            result.declarations
        );
    }
}

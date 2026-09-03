import {
    parseFile
} from "./parser.js";

import {
    checkDuplicates
} from "./declarations/utils.js";

import {
    printDeclarations
} from "./output/declarations.js";

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
    runPlanShow
} from "./commands/plan.js";

import {
    runStatus
} from "./commands/status.js";

import {
    runName
} from "./commands/name.js";


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
        "  node src/cli.js <file>"
    );

    console.error(
        "  node src/cli.js <file> --json"
    );

    console.error(
        "  node src/cli.js diff <before> <after>"
    );

    console.error(
        "  node src/cli.js init <project-folder>"
    );

    console.error(
        "  node src/cli.js check <project-folder> [--all]"
    );

    console.error(
        "  node src/cli.js accept <project-folder>"
    );

    console.error(
        "  node src/cli.js watch <project-folder>"
    );

    console.error(
        "  node src/cli.js seal <project-folder>"
    );

    console.error(
        "  node src/cli.js evolution <project-folder>"
    );

    console.error(
        "  node src/cli.js evolution <project-folder> --md"
    );

    console.error(
        "  node src/cli.js status <project-folder>"
    );

    console.error(
        "  node src/cli.js name <project-folder>"
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
        args[1]
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
            "Usage: node src/cli.js check <project-folder> [--all]"
        );

        console.log(
            "  --all    Show insignificant changes too"
        );

        process.exit(0);
    }

    runProjectCheck(
        args[1],
        {
            all:
                args.includes(
                    "--all"
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
        args[1]
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
// PLAN COMMAND
// --------------------------------------------------

else if (
    args[0] === "plan"
) {
    const subcommand =
        args[1];

    if (
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

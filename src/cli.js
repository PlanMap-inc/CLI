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
    runDiff
} from "./commands/diff.js";

import {
    runEvolution
} from "./commands/evolution.js";


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
        "  node src/cli.js check <project-folder>"
    );

    console.error(
        "  node src/cli.js accept <project-folder>"
    );

    console.error(
        "  node src/cli.js watch <project-folder>"
    );

    console.error(
        "  node src/cli.js evolution <project-folder>"
    );

    console.error(
        "  node src/cli.js evolution <project-folder> --md"
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
    runProjectCheck(
        args[1]
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

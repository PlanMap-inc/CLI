import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Parser, Language } from "web-tree-sitter";
import { walk } from "./walk.js";
import { diffDeclarations, formatDiff } from "./diff.js";
import { scanProject } from "./scanner.js";
import { writeBaseline } from "./baseline.js";
import { runCheck } from "./check.js";
import { watchProject } from "./watcher.js";

// PATHS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wasmPath = path.resolve(__dirname, "../node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm");

// INITIALIZE PARSER
await Parser.init();
const jslang = await Language.load(wasmPath);


// --------------------------------------------------
// PARSE FILE
// 1-Receives the file path.
// 2-Converts the path into an absolute path.
// 3-Checks whether the file exists.
// 4-Reads the entire file.
// 5-Creates a new Tree-sitter parser.
// 6-Sets the parser to use the JavaScript language.
// 7-Parses the JavaScript source code.
// 8-Throws an error when throwOnError is enabled.
// 9-Sends the syntax tree to walk().
// 10-Returns the parsed file information.
// --------------------------------------------------

export function parseFile(
    filePath,
    options = {}
) {
    const absolutePath =
        path.resolve(
            filePath
        );

    if (
        !fs.existsSync(
            absolutePath
        )
    ) {
        const error =
            new Error(
                `Cannot read file: ${filePath}`
            );

        if (
            options.throwOnError
        ) {
            throw error;
        }

        console.error(
            error.message
        );

        process.exit(1);
    }

    const fileCode =
        fs.readFileSync(
            absolutePath,
            "utf8"
        );

    const parser =
        new Parser();

    parser.setLanguage(
        jslang
    );

    const tree =
        parser.parse(
            fileCode
        );

    if (
        tree.rootNode.hasError
    ) {
        const error =
            new Error(
                `Parse errors detected in ${filePath}`
            );

        if (
            options.throwOnError
        ) {
            throw error;
        }

        console.error(
            error.message
        );

        process.exit(1);
    }

    const declarations =
        walk(
            tree.rootNode
        );

    return {
        filePath,
        code: fileCode,
        tree,
        declarations
    };
}
// --------------------------------------------------
// PRINT DECLARATIONS
// 1-Receives the file path and declarations.
// 2-Prints the file name.
// 3-Checks whether any declarations were found.
// 4-If there are no declarations:
// 5-Prints "No declarations found."
// 6-Stops the function.
// 7-Finds the length of the longest declaration name.
// 8-Calculates the required width for the name column.
// 9-Prints the table headers:
//  Kind
//  Name
//  Location
// 10-Prints a separator line below the headers.
// 11-Loops through every declaration.
// 12-Calculates the starting and ending location of each declaration.
// 13-Checks whether the declaration has any modifiers.
// 14-If modifiers exist, adds them to the displayed declaration kind.
// 15-Formats the declaration information into columns.
// 16-Prints each declaration as a row.
// 17-After all declarations are printed, displays the total number of declarations.
// --------------------------------------------------

function printDeclarations(
    filePath,
    declarations
) {
    console.log(
        `\nFile: ${filePath}\n`
    );

    if (declarations.length === 0) {
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

    for (const declaration of declarations) {
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


// --------------------------------------------------
// CHECK DUPLICATE IDENTITIES
// 1-Receives the declarations.
// 2-Creates an empty Set to store declaration identities.
// 3-Loops through each declaration.
// 4-Gets the identity of the current declaration.
// 5-Checks whether the identity already exists in the Set.
// 6-If the identity already exists:
//    * Prints a duplicate identity warning.
// 7-If the identity does not exist, continues normally.
// 8-Adds the identity to the Set.
// 9-Repeats the process for all declarations.
// 10-Finishes after checking every declaration.
// --------------------------------------------------

function checkDuplicates(
    declarations
) {
    const identities = new Set();

    for (const declaration of declarations) {
        if (
            identities.has(
                declaration.identity
            )
        ) {
            console.warn(
                `Duplicate identity: ${declaration.identity}`
            );
        }

        identities.add(
            declaration.identity
        );
    }
}


// --------------------------------------------------
// RUN INIT
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Scans the entire project for JavaScript files.
// 6-Processes each file through parseFile().
// 7-Collects all declarations across the project.
// 8-Checks declaration identities across the entire project.
// 9-Writes the project declarations to baseline.json.
// 10-Prints the total number of declarations found.
// 11-Prints the location of the created baseline.
// --------------------------------------------------

function runInit(
    projectPath
) {
    if (!projectPath) {
        console.error(
            "Usage: node src/cli.js init <project-folder>"
        );
        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (!fs.existsSync(projectRoot)) {
        console.error(
            `Project folder not found: ${projectPath}`
        );
        process.exit(1);
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );
        process.exit(1);
    }

    console.log(
        `\nScanning project: ${projectRoot}\n`
    );

    const declarations =
        scanProject(
            projectRoot,
            parseFile
        );

    checkDuplicates(
        declarations
    );

    const baselinePath =
        writeBaseline(
            projectRoot,
            declarations
        );

    console.log(
        `\nFound ${declarations.length} declarations`
    );

    console.log(
        `Baseline written: ${baselinePath}`
    );
}


// --------------------------------------------------
// RUN PROJECT CHECK
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Reads the stored baseline.
// 6-Scans the current project.
// 7-Compares the current project with the baseline.
// 8-Prints the detected changes.
// 9-Sets exit code 1 when changes are detected.
// 10-Exits with code 0 when no changes are detected.
// 11-Does not update the baseline.
// --------------------------------------------------

// --------------------------------------------------
// RUN PROJECT CHECK
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Reads the stored baseline.
// 6-Scans the current project.
// 7-Compares the current project with the baseline.
// 8-Prints the detected changes.
// 9-Counts only real changes.
// 10-Sets exit code 1 when real changes are detected.
// 11-Exits with code 0 when no real changes are detected.
// 12-Does not update the baseline.
// --------------------------------------------------

function runProjectCheck(
    projectPath
) {
    if (!projectPath) {
        console.error(
            "Usage: node src/cli.js check <project-folder>"
        );
        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (!fs.existsSync(projectRoot)) {
        console.error(
            `Project folder not found: ${projectPath}`
        );
        process.exit(1);
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );
        process.exit(1);
    }

    console.log(
        `\nChecking project: ${projectRoot}\n`
    );

    const changes =
        runCheck(
            projectRoot,
            scanProject,
            parseFile,
            diffDeclarations
        );

    const realChanges =
        changes.filter(
            change =>
                change.type !== "unchanged"
        );

    if (realChanges.length === 0) {
        console.log(
            "No changes detected."
        );

        process.exitCode = 0;
        return;
    }

    formatDiff(
        changes,
        "baseline",
        "current"
    );

    process.exitCode = 1;
}

// --------------------------------------------------
// RUN ACCEPT
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Scans the current project.
// 6-Checks declaration identities across the entire project.
// 7-Writes the current project state to baseline.json.
// 8-Prints the location of the updated baseline.
// --------------------------------------------------

function runAccept(
    projectPath
) {
    if (!projectPath) {
        console.error(
            "Usage: node src/cli.js accept <project-folder>"
        );
        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (!fs.existsSync(projectRoot)) {
        console.error(
            `Project folder not found: ${projectPath}`
        );
        process.exit(1);
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );
        process.exit(1);
    }

    console.log(
        `\nAccepting current project state: ${projectRoot}\n`
    );

    const declarations =
        scanProject(
            projectRoot,
            parseFile
        );

    checkDuplicates(
        declarations
    );

    const baselinePath =
        writeBaseline(
            projectRoot,
            declarations
        );

    console.log(
        `\nBaseline updated: ${baselinePath}`
    );
}


// --------------------------------------------------
// RUN WATCH
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Checks whether a baseline exists.
// 6-Starts the Chokidar watcher.
// 7-Watches JavaScript files for changes.
// 8-Checks only the file that was changed.
// 9-Keeps the process running while the project is being watched.
// --------------------------------------------------

function runWatch(
    projectPath
) {
    if (!projectPath) {
        console.error(
            "Usage: node src/cli.js watch <project-folder>"
        );
        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (!fs.existsSync(projectRoot)) {
        console.error(
            `Project folder not found: ${projectPath}`
        );
        process.exit(1);
    }

    if (
        !fs.statSync(
            projectRoot
        ).isDirectory()
    ) {
        console.error(
            `Project path is not a folder: ${projectPath}`
        );
        process.exit(1);
    }

    const baselinePath =
        path.join(
            projectRoot,
            ".planmap",
            "baseline.json"
        );

    if (!fs.existsSync(baselinePath)) {
        console.error(
            "Baseline not found. Run init first."
        );
        process.exit(1);
    }

    console.log(
        `\nStarting watch: ${projectRoot}\n`
    );

    watchProject(
        projectRoot,
        parseFile
    );
}


// --------------------------------------------------
// RUN DIFF
// 1-Receives the **before file path** and **after file path**.
// 2-Checks whether both file paths were provided.
// 3-If either file path is missing:
//    * Prints the correct usage message.
//    * Exits the program.
// 4-Parses the **before file** using parseFile().
// 5-Parses the **after file** using parseFile().
// 6-Gets the declarations from the before file.
// 7-Gets the declarations from the after file.
// 8-Sends both declaration lists to diffDeclarations().
// 9-`diffDeclarations()` compares the declarations and identifies changes.
// 10-Stores the detected changes.
// 11-Sends the changes to formatDiff().
// 12-`formatDiff()` formats and displays the differences between the two files.
// 13-Finishes the diff operation.
// --------------------------------------------------

function runDiff(
    beforePath,
    afterPath
) {
    if (!beforePath || !afterPath) {
        console.error(
            "Usage: node src/cli.js diff <before> <after>"
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


// --------------------------------------------------
// MAIN CLI
// --------------------------------------------------

// Get the command-line arguments provided by the user
// and remove the first two default Node.js arguments.
const args =
    process.argv.slice(2);

// Check if the user provided any command-line arguments.
if (args.length === 0) {
    // Display the available CLI commands.
    console.error("Usage:");
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

    // Exit because no command was provided.
    process.exit(1);
}


// Check if the first argument is the "diff" command.
if (args[0] === "diff") {
    // Pass the before and after file paths to runDiff().
    runDiff(
        args[1],
        args[2]
    );
}


// Check if the first argument is the "init" command.
else if (args[0] === "init") {
    // Pass the project folder path to runInit().
    runInit(
        args[1]
    );
}


// Check if the first argument is the "check" command.
else if (args[0] === "check") {
    // Pass the project folder path to runProjectCheck().
    runProjectCheck(
        args[1]
    );
}


// Check if the first argument is the "accept" command.
else if (args[0] === "accept") {
    // Pass the project folder path to runAccept().
    runAccept(
        args[1]
    );
}


// Check if the first argument is the "watch" command.
else if (args[0] === "watch") {
    // Pass the project folder path to runWatch().
    runWatch(
        args[1]
    );
}


// NORMAL FILE COMMAND
else {
    // Treat the first argument as the file path.
    const filePath =
        args[0];

    // Check whether the user requested JSON output.
    const json =
        args.includes("--json");

    // Parse the file and extract its declarations.
    const result =
        parseFile(
            filePath
        );

    // Check the declarations for duplicate identities.
    checkDuplicates(
        result.declarations
    );

    // If --json was provided, print declarations as JSON.
    if (json) {
        console.log(
            JSON.stringify(
                result.declarations,
                null,
                2
            )
        );
    }

    // Otherwise, print declarations as a formatted table.
    else {
        printDeclarations(
            filePath,
            result.declarations
        );
    }
}
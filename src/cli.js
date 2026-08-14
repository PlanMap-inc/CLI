import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Parser, Language } from "web-tree-sitter";
import { walk } from "./walk.js";
import { diffDeclarations, formatDiff } from "./diff.js";

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
// 4-If the file doesn't exist:
// 5-Prints an error.
// 6-Exits the program.
// 7-Reads the entire file.
// 8-Creates a new Tree-sitter parser.
// 9-Sets the parser to use the JavaScript language.
// 10-Parses the JavaScript source code into a syntax tree.
// 11-Checks whether the syntax tree contains parse errors.
// 12-If there is a parse error:
// 13-Prints an error message.
// 14-Exits the program.
// 15-Sends the syntax tree to walk().
// 16-walk() traverses the syntax tree and extracts declarations.
// 17-Stores the extracted declarations.
// 18-Returns the file path, source code, syntax tree, and declarations.
// --------------------------------------------------

function parseFile(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`Cannot read file: ${filePath}`);
        process.exit(1);
    }
    const fileCode = fs.readFileSync(absolutePath, "utf8");
    const parser = new Parser();
    parser.setLanguage(jslang);
    const tree = parser.parse(fileCode);
    if (tree.rootNode.hasError) {
        console.error(`Parse errors detected in ${filePath}`);
        process.exit(1);
    }
    const declarations = walk(tree.rootNode);
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

function printDeclarations(filePath, declarations) {
    console.log(`\nFile: ${filePath}\n`);
    if (declarations.length === 0) {
        console.log("No declarations found.");
        return;
    }
    const nameWidth = Math.max("name".length, ...declarations.map(declaration => declaration.name.length)) + 2;
    console.log("kind".padEnd(24) + "name".padEnd(nameWidth) + "location");
    console.log("-".repeat(24 + nameWidth + 20));

    for (const declaration of declarations) {
        const location = `${declaration.startLine}:${declaration.startColumn}` + `-${declaration.endLine}:${declaration.endColumn}`;
        const displayKind = declaration.modifiers.length > 0 ? `${declaration.kind} [${declaration.modifiers.join(", ")}]` : declaration.kind;
        console.log(displayKind.padEnd(24) + declaration.name.padEnd(nameWidth) + location);
    }
    console.log(`\n${declarations.length} declarations`);
}


// --------------------------------------------------
// CHECK DUPLICATE IDENTITIES
// 1-Receives the declarations.
// 2-Creates an empty `Set` to store declaration identities.
// 3-Loops through each declaration.
// 4-Gets the identity of the current declaration.
// 5-Checks whether the identity already exists in the `Set`.
// 6-If the identity already exists:
//    * Prints a duplicate identity warning.
// 7-If the identity does not exist, continues normally.
// 8-Adds the identity to the `Set`.
// 9-Repeats the process for all declarations.
// 10-Finishes after checking every declaration.
// --------------------------------------------------
function checkDuplicates(declarations) {
    const identities = new Set()
    for (const declaration of declarations) {
        if (identities.has(declaration.identity)) {
            console.warn(`Duplicate identity: ${declaration.identity}`);
        }
        identities.add(declaration.identity);
    }
}

// --------------------------------------------------
// RUN DIFF
// 1-Receives the **before file path** and **after file path**.
// 2-Checks whether both file paths were provided.
// 3-If either file path is missing:
//    * Prints the correct usage message.
//    * Exits the program.
// 4-Parses the **before file** using `parseFile()`.
// 5-Parses the **after file** using `parseFile()`.
// 6-Gets the declarations from the before file.
// 7-Gets the declarations from the after file.
// 8-Sends both declaration lists to `diffDeclarations()`.
// 9-`diffDeclarations()` compares the declarations and identifies changes.
// 10-Stores the detected changes.
// 11-Sends the changes to `formatDiff()`.
// 12-`formatDiff()` formats and displays the differences between the two files.
// 13-Finishes the diff operation.
// --------------------------------------------------

function runDiff(beforePath, afterPath) {
    if (!beforePath || !afterPath) {
        console.error("Usage: node src/cli.js diff <before> <after>");
        process.exit(1);
    }
    const before = parseFile(beforePath);
    const after = parseFile(afterPath);
    const changes = diffDeclarations(before.declarations, after.declarations);
    formatDiff(changes, beforePath, afterPath);
}


// --------------------------------------------------
// MAIN CLI
// --------------------------------------------------

// Get the command-line arguments provided by the user
// and remove the first two default Node.js arguments.
const args = process.argv.slice(2);

// Check if the user provided any command-line arguments.
if (args.length === 0) {
    // Display the available CLI commands.
    console.error("Usage:");
    console.error("  node src/cli.js <file>");
    console.error("  node src/cli.js <file> --json");
    console.error("  node src/cli.js diff <before> <after>");
    // Exit because no command was provided.
    process.exit(1);
}
// Check if the first argument is the "diff" command.
if (args[0] === "diff") {
    // Pass the before and after file paths to runDiff().
    runDiff(args[1], args[2]);
}
// NORMAL FILE COMMAND
else {
    // Treat the first argument as the file path.
    const filePath = args[0];
    // Check whether the user requested JSON output.
    const json = args.includes("--json");
    // Parse the file and extract its declarations.
    const result = parseFile(filePath);
    // Check the declarations for duplicate identities.
    checkDuplicates(result.declarations);
    // If --json was provided, print declarations as JSON.
    if (json) { console.log(JSON.stringify(result.declarations, null, 2)); }
    // Otherwise, print declarations as a formatted table.
    else {
        printDeclarations(filePath, result.declarations);
    }
}

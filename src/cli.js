// PLAN_MAP-v0.1
// CLI that reads a JavaScript file, parses it with Tree-sitter WASM,
// builds its syntax tree, and creates a structural inventory.

//importing the modules
import fs from "node:fs";
import path from "node:path";
import { Parser, Language } from "web-tree-sitter";

//reading the file path from command line arguments
const filePath = process.argv[2];

//checking if the file path is provided and if the file exists
if (!filePath) {
    console.error("Usage: node src/cli.js <file>");
    process.exit(1);
}
const absolutePath = path.resolve(filePath);

//checking if the file exists and reading its content and making a string
if (!fs.existsSync(absolutePath)) {
    console.error(`Cannot read file: ${filePath}`);
    process.exit(1);
}
const fileCode = fs.readFileSync(absolutePath, "utf8");

//Initializing the parser
await Parser.init();

//Loading the JS grammer
const wasmPath = path.resolve("./node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm");
const jslang = await Language.load(wasmPath);

//creating a parser and setting the grammer 
const parser = new Parser();
parser.setLanguage(jslang);

//creating the tree
const tree = parser.parse(fileCode);
if (tree.rootNode.hasError) {
    console.error("Parse errors detected");
}


// This function gets the name of a declaration from the syntax tree.
// It looks for the "name" part of the node.
// If a name is found, it returns that name.
// If no name is found, it returns "<anonymous>".
function getDeclarationName(node) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
        return nameNode.text;
    }
    return "<anonymous>";
}

// This function creates a simple record for a declaration.
// It stores the declaration's type, name, and exact location in the file.
// This information is later used to build and print our structural inventory.
function createDeclaration(node) {
    return {
        type: node.type,
        name: getDeclarationName(node),

        startIndex: node.startIndex,
        endIndex: node.endIndex,

        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,

        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column
    };
}

// This array stores all the declarations we find in the JavaScript file.
const declarations = [];



// This function goes through the syntax tree and finds declarations.
function walk(node) {

    // Check if the current node is a function, class, or method.
    if (
        node.type === "function_declaration" ||
        node.type === "class_declaration" ||
        node.type === "method_definition"
    ) {
        // Save the declaration information in the declarations array.
        declarations.push(createDeclaration(node));
    }


    // Check if the current node is a variable declaration.
    if (node.type === "variable_declarator") {

        // Get the value assigned to the variable.
        const value = node.childForFieldName("value");


        // Check if the variable contains an arrow function.
        // Example: const getUser = () => {};
        if (value?.type === "arrow_function") {

            // Save the arrow function's declaration information.
            declarations.push(createDeclaration(node));
        }
    }


    // Go through all the child nodes of the current node.
    // This allows us to find declarations inside other functions,
    // classes, and other nested code.
    for (const child of node.namedChildren) {
        walk(child);
    }
}



// This function prints all the declarations found in the JavaScript file.
// It shows the declaration type, name, and its location in the source code.

function printDeclarations(filePath, declarations) {

    // Print the name of the file being analyzed.
    console.log(`\nFile: ${filePath}\n`);


    // Print the column headings for the output table.
    // padEnd() is used to keep the columns properly aligned.
    console.log(
        "kind".padEnd(24) +
        "name".padEnd(20) +
        "location"
    );


    // Print a line to separate the headings from the results.
    console.log("-".repeat(60));


    // Go through each declaration found by the walk() function.
    for (const declaration of declarations) {

        // Create a readable location for the declaration.
        // Example: 10:0-12:1
        // This means the declaration starts at line 10, column 0
        // and ends at line 12, column 1.
        const location =
            `${declaration.startLine}:${declaration.startColumn}` +
            `-${declaration.endLine}:${declaration.endColumn}`;


        // Print the declaration type, name, and location.
        console.log(
            declaration.type.padEnd(24) +
            declaration.name.padEnd(20) +
            location
        );
    }


    // Print the total number of declarations found.
    console.log(`\n${declarations.length} declarations`);
}


// Start walking through the syntax tree from its root node.
// This searches the entire JavaScript file for declarations.
walk(tree.rootNode);

printDeclarations(filePath, declarations);
//console.log(tree.rootNode.toString());

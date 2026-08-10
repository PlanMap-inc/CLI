// PLAN_MAP-v0.1
// CLI that reads a JavaScript file, parses it with Tree-sitter WASM,
// builds its syntax tree, and creates a structural inventory.

//importing the modules
import fs from "node:fs";
import path from "node:path";
import {Parser,Language} from "web-tree-sitter";

//Reading the file
const filePath = process.argv[2];
const absolutePath = path.resolve(filePath);
const fileCode = fs.readFileSync(absolutePath , "utf8");

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

console.log("File Read Successfully");
console.log(tree.rootNode.toString());

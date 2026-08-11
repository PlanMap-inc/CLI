PlanMap v0.1 — Structural Inventory

Today's deliverable: a CLI that reads one JS file, parses it, and prints every function-like declaration with exact byte ranges. No hashing, no annotations, no LLM.

1. Repo setup
bash
mkdir planmap && cd planmap && git init
npm init -y
npm pkg set type=module
npm install web-tree-sitter tree-sitter-wasms
mkdir -p src test/fixtures

Add a .gitignore with node_modules/. Commit the scaffold before writing any logic — you want a clean diff for the first real commit.

Final structure for today:

planmap/
  package.json
  src/cli.js
  test/fixtures/       ← 3 files copied from ai-developer-survey

One file. Don't split into modules yet; you don't know the seams.

2. Parser initialization

Named imports from web-tree-sitter — { Parser, Language }. The order is fixed:

await Parser.init() — boots the WASM runtime. Must complete before anything else.
await Language.load(wasmPath) — where wasmPath points at node_modules/tree-sitter-wasms/out/tree-sitter-javascript.wasm. Resolve it relative to your module, not the cwd, or it breaks the moment you run the CLI from another directory.
new Parser() then parser.setLanguage(lang).
parser.parse(sourceString) returns a Tree. tree.rootNode is your entry point.

Read the file with fs.readFileSync(path, 'utf8'). Keep the source string around — you need it later for slicing, and the byte offsets index into it.

3. What counts as a declaration

Four node types. Match on these exactly:

Node type	Where the name lives
function_declaration	childForFieldName('name')
class_declaration	childForFieldName('name')
method_definition	childForFieldName('name')
variable_declarator with an arrow_function or function_expression value	childForFieldName('name') on the declarator itself

The fourth is the one that matters most for your corpus. Match the declarator, not the arrow — the arrow node is anonymous, the name is its sibling. Check childForFieldName('value')?.type to decide whether a given declarator qualifies.

If childForFieldName('name') returns null, print the entry with name <anonymous>. Never synthesize a name.

4. Traversal

Walk the whole tree recursively from rootNode, testing every node against the four types. Depth-first, and do not stop descending when you find a match — a method lives inside a class, and you want both.

Use node.namedChildren or a TreeCursor. Either works; the cursor is faster and is what you'll want at scale, but a plain recursive function over namedChildren is easier to debug today.

For each match, collect:

type — the tree-sitter node type string
name — resolved per the table above
startIndex / endIndex — byte offsets, this is the real payload
startPosition.row / endPosition.row — zero-indexed, add 1 for display
5. Output format
test/fixtures/routes.js

  kind                  name                start    end    lines
  function_declaration  getSurvey             412    890    18–34
  variable_declarator   submitResponse        901   1580    36–58
  class_declaration     ResponseValidator    1602   2410    61–92
  method_definition     validate             1700   1820    64–68

  4 declarations

Path on top, aligned columns, a count at the bottom. The count is what tells you at a glance whether the walk missed something.

Nested declarations print flat, in source order, at the same indent level. Don't try to render the hierarchy today — parent-child relationships are a rung 4 concern and getting the tree drawing right will eat your evening.

6. Error handling

Three cases, each exiting non-zero with a message on stderr:

No argument passed → usage line
File doesn't exist → cannot read <path>
Parse produced errors → tree-sitter recovers from syntax errors rather than throwing, so check tree.rootNode.hasError and say so. Still print whatever you found, but flag it. Silent partial results are exactly the failure mode this product exists to prevent.
7. Acceptance test

Copy three files from ai-developer-survey into test/fixtures/, chosen deliberately:

A route file with arrow-function handlers — proves case four works
A file with a class — proves methods are found inside classes
A file with a nested closure, a callback inside a .map() or a setTimeout — this is the one that will surprise you

For each: run the CLI, put the output next to the source, and read them against each other line by line. Every function you can see with your eyes appears exactly once, with a real name, and nothing extra appears.

The third file forces a decision you have to make consciously today: does an anonymous callback inside .map() count as a declaration? There's a defensible answer either way. What isn't acceptable is not noticing. Write your answer in a DECISIONS.md with one sentence of reasoning — that file becomes genuinely valuable by rung 5, and it's the artifact that proves you made architectural choices rather than accepting whatever fell out.

8. Explicitly out of scope

No comment parsing. No hashing. No JSON. No .planmap/ directory. No directory recursion. No TypeScript. No arg-parsing library. No colors. No LLM.

If you finish early, don't start rung 2 — spend the time running the CLI against more files from the repo and finding cases where the traversal is wrong. Every bug you find today is one that isn't silently baked into the hash at rung 3.

Done when

You can run node src/cli.js <any file from the survey repo> and trust the output without checking it. Send me the three outputs plus the corresponding source and I'll review the traversal before you build hashing on top of it.
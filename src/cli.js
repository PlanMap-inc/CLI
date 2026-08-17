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
import {
    readEvents,
    groupSessions,
    buildLineage,
    readEvolution,
    writeEvolution,
    updateEvolution
} from "./evolution.js";
import {
    appendInitialEvents
} from "./events.js";
import {
    classifyEvolutionEvents
} from "./llm.js";
if (
    typeof process.loadEnvFile === "function"
) {
    try {
        process.loadEnvFile();
    } catch (
        error
    ) {
        /*
         * .env is optional.
         *
         * Commands that do not require an API key
         * must continue to work without one.
         */
    }
}
// PATHS

const __filename =
    fileURLToPath(
        import.meta.url
    );

const __dirname =
    path.dirname(
        __filename
    );

const wasmPath =
    path.resolve(
        __dirname,
        "../node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm"
    );


// INITIALIZE PARSER

await Parser.init();

const jslang =
    await Language.load(
        wasmPath
    );


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
//    Kind
//    Name
//    Location
// 10-Prints a separator line below the headers.
// 11-Loops through every declaration.
// 12-Calculates the starting and ending location.
// 13-Checks whether the declaration has modifiers.
// 14-Formats the declaration information.
// 15-Prints each declaration.
// 16-Prints the total number of declarations.
// --------------------------------------------------

function printDeclarations(
    filePath,
    declarations
) {
    console.log(
        `\nFile: ${filePath}\n`
    );

    if (
        declarations.length === 0
    ) {
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

    for (
        const declaration
        of declarations
    ) {
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
// 2-Creates a Set for identities.
// 3-Loops through declarations.
// 4-Checks whether an identity already exists.
// 5-Warns when a duplicate is found.
// 6-Stores each identity.
// --------------------------------------------------

function checkDuplicates(
    declarations
) {
    const identities =
        new Set();

    for (
        const declaration
        of declarations
    ) {
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
// 5-Scans the entire project.
// 6-Collects all declarations.
// 7-Checks declaration identities.
// 8-Appends initial "added" events.
// 9-Writes baseline.json.
// 10-Prints the result.
// --------------------------------------------------

function runInit(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js init <project-folder>"
        );

        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
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

    appendInitialEvents(
        projectRoot,
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
// 7-Compares current state with baseline.
// 8-Prints detected changes.
// 9-Only real changes affect the exit code.
// 10-Does not update baseline.
// --------------------------------------------------

function runProjectCheck(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js check <project-folder>"
        );

        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
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

    if (
        realChanges.length === 0
    ) {
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
// 6-Checks declaration identities.
// 7-Writes the current state to baseline.json.
// 8-Prints the updated baseline location.
// --------------------------------------------------

function runAccept(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js accept <project-folder>"
        );

        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
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
// 5-Checks whether baseline.json exists.
// 6-Starts the watcher.
// 7-Watches JavaScript files.
// --------------------------------------------------

function runWatch(
    projectPath
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js watch <project-folder>"
        );

        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
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

    if (
        !fs.existsSync(
            baselinePath
        )
    ) {
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
// EVOLUTION MARKDOWN HELPERS
// --------------------------------------------------
// These helpers are intentionally static.
//
// v0.4 currently does NOT use the LLM.
// The LLM will later provide:
// 1-category
// 2-subcategory
// 3-label
// 4-tags
//
// Until then, the Markdown renderer uses the
// file path and raw declaration identity.
//
// This keeps the structure testable before AI
// naming is introduced.
// --------------------------------------------------


// --------------------------------------------------
// PARSE EVOLUTION IDENTITY
// 1-Receives a declaration identity.
// 2-Separates the file path from the declaration.
// 3-Returns the file and declaration name.
// --------------------------------------------------

function parseEvolutionIdentity(
    identity
) {
    const separatorIndex =
        identity.lastIndexOf(
            "::"
        );

    if (
        separatorIndex === -1
    ) {
        return {
            file: identity,
            declaration: identity
        };
    }

    const file =
        identity.slice(
            0,
            separatorIndex
        );

    const declarationPart =
        identity.slice(
            separatorIndex + 2
        );

    const declaration =
        declarationPart.replace(
            /:[^:]+$/,
            ""
        );

    return {
        file,
        declaration
    };
}


// --------------------------------------------------
// GET PATH CATEGORY
//
// Offline fallback only.
//
// IMPORTANT:
// Path information is NOT treated as a product feature.
//
// We deliberately return "Unclassified" instead of
// pretending that a folder such as Backend or Frontend
// is a product capability.
// --------------------------------------------------

function getPathCategory(
    identity
) {

    return {
        category:
            "Unclassified",

    };
}

// --------------------------------------------------
// GET EVENT LABEL
// 1-Receives an evolution node.
// 2-Uses the declaration identity.
// 3-Creates a simple offline label.
// 4-Does not use the LLM.
// --------------------------------------------------

function getEvolutionLabel(
    node
) {
    const parsed =
        parseEvolutionIdentity(
            node.identity
        );

    if (
        node.type === "added"
    ) {
        return `Added ${parsed.declaration}`;
    }

    if (
        node.type === "changed"
    ) {
        return `Changed ${parsed.declaration}`;
    }

    if (
        node.type === "deleted"
    ) {
        return `Removed ${parsed.declaration}`;
    }

    return parsed.declaration;
}


// --------------------------------------------------
// FORMAT DELTA
// 1-Receives an evolution node.
// 2-Checks whether a property delta exists.
// 3-Formats known property changes.
// 4-Returns an empty string when no delta exists.
// --------------------------------------------------

function formatEvolutionDelta(
    node
) {
    if (
        !node.delta
    ) {
        return "";
    }

    const delta =
        node.delta;

    const parts = [];

    if (
        delta.numbers
    ) {
        const before =
            JSON.stringify(
                delta.numbers[0]
            );

        const after =
            JSON.stringify(
                delta.numbers[1]
            );

        parts.push(
            `numbers ${before} → ${after}`
        );
    }

    if (
        delta.calls
    ) {
        const before =
            delta.calls[0] || [];

        const after =
            delta.calls[1] || [];

        const added =
            after.filter(
                value =>
                    !before.includes(
                        value
                    )
            );

        const removed =
            before.filter(
                value =>
                    !after.includes(
                        value
                    )
            );

        if (
            added.length > 0
        ) {
            parts.push(
                `calls +${added.join(", ")}`
            );
        }

        if (
            removed.length > 0
        ) {
            parts.push(
                `calls -${removed.join(", ")}`
            );
        }
    }

    if (
        delta.params
    ) {
        parts.push(
            `params ${JSON.stringify(delta.params)}`
        );
    }

    if (
        delta.throws
    ) {
        parts.push(
            `throws ${JSON.stringify(delta.throws)}`
        );
    }

    if (
        delta.returns
    ) {
        parts.push(
            `returns ${JSON.stringify(delta.returns)}`
        );
    }

    return parts.length > 0
        ? `   ${parts.join(" | ")}`
        : "";
}

// --------------------------------------------------
// RENDER EVOLUTION MARKDOWN
//
// Hierarchy:
//
// Feature
//   └── Evolution change
//       └── Child evolution change
//
// The hierarchy is NOT architecture-based.
//
// Lineage controls nesting.
// Feature controls grouping.
// Tags remain metadata.
// --------------------------------------------------

function renderEvolutionMarkdown(
    evolution
) {

    const nodes =
        evolution.nodes || [];


    const children =
        new Map();


    for (
        const node
        of nodes
    ) {

        if (
            !node.parent
        ) {
            continue;
        }


        if (
            !children.has(
                node.parent
            )
        ) {

            children.set(
                node.parent,
                []
            );
        }


        children
            .get(
                node.parent
            )
            .push(
                node
            );
    }


    const roots =
        nodes.filter(
            node =>
                !node.parent
        );


    /*
     * Group only ROOT events by feature.
     *
     * Children inherit their position
     * through lineage.
     */

    const features =
        new Map();


    for (
        const node
        of roots
    ) {

        const feature =
            node.feature ||
            node.category ||
            "Unclassified";


        if (
            !features.has(
                feature
            )
        ) {

            features.set(
                feature,
                []
            );
        }


        features
            .get(
                feature
            )
            .push(
                node
            );
    }


    const lines =
        [];


    lines.push(
        "# Project Evolution"
    );


    lines.push(
        ""
    );


    lines.push(
        "> Feature-oriented evolution history generated by PlanMap."
    );


    lines.push(
        "> Product features form the top level. Event lineage forms the nesting."
    );


    lines.push(
        ""
    );


    const sortedFeatures =
        [
            ...features.entries()
        ]
            .sort(
                (
                    first,
                    second
                ) =>
                    first[0]
                        .localeCompare(
                            second[0]
                        )
            );


    for (
        const [
            feature,
            featureRoots
        ]
        of sortedFeatures
    ) {

        lines.push(
            `- **${feature}**`
        );


        const sortedRoots =
            [
                ...featureRoots
            ]
                .sort(
                    (
                        first,
                        second
                    ) =>
                        first.ts.localeCompare(
                            second.ts
                        )
                );


        for (
            const node
            of sortedRoots
        ) {

            renderEvolutionNode(
                node,
                children,
                lines,
                1
            );
        }


        lines.push(
            ""
        );
    }


    return (
        lines
            .join(
                "\n"
            )
            .trim() +
        "\n"
    );
}

// --------------------------------------------------
// RENDER EVOLUTION NODE
//
// Only the human-facing change is shown in the
// main tree.
//
// Technical identity and tags are kept as metadata
// underneath the change so the tree stays readable.
// --------------------------------------------------

function renderEvolutionNode(
    node,
    children,
    lines,
    depth
) {

    const indentation =
        "  ".repeat(
            depth
        );


    const label =
        node.label ||
        getEvolutionLabel(
            node
        );


    const inlineTags =
        Array.isArray(node.tags) &&
        node.tags.length > 0
            ? " " +
              node.tags
                  .map(
                      tag =>
                          `\`${String(tag).trim()}\``
                  )
                  .join(" ")
            : "";

    lines.push(
        `${indentation}- ${label}${inlineTags}`
    );


    const delta =
        formatEvolutionDelta(
            node
        );


    if (
        delta
    ) {

        lines.push(
            `${indentation}  - ${delta.trim()}`
        );
    }


    const nodeChildren =
        children.get(
            node.id
        ) || [];


    const sortedChildren =
        [
            ...nodeChildren
        ]
            .sort(
                (
                    first,
                    second
                ) =>
                    first.ts.localeCompare(
                        second.ts
                    )
            );


    for (
        const child
        of sortedChildren
    ) {

        renderEvolutionNode(
            child,
            children,
            lines,
            depth + 1
        );
    }
}
// --------------------------------------------------
// WRITE EVOLUTION MARKDOWN
// 1-Receives the project root.
// 2-Receives the evolution data.
// 3-Renders deterministic Markdown.
// 4-Writes EVOLUTION.md in the project root.
// 5-Returns the written path.
// --------------------------------------------------

function writeEvolutionMarkdown(
    projectRoot,
    evolution
) {
    const markdown =
        renderEvolutionMarkdown(
            evolution
        );

    const markdownPath =
        path.join(
            projectRoot,
            "EVOLUTION.md"
        );

    fs.writeFileSync(
        markdownPath,
        markdown,
        "utf8"
    );

    return markdownPath;
}

// --------------------------------------------------
// GET EVOLUTION FACTS
// 1-Receives an event.
// 2-Reads the latest static properties for the declaration.
// 3-Uses the event delta when available.
// 4-Returns only facts already known by PlanMap.
// --------------------------------------------------

function getEvolutionFacts(
    projectRoot,
    event
) {
    const baselinePath =
        path.join(
            projectRoot,
            ".planmap",
            "baseline.json"
        );

    let baseline =
        {
            declarations: []
        };

    if (
        fs.existsSync(
            baselinePath
        )
    ) {
        baseline =
            JSON.parse(
                fs.readFileSync(
                    baselinePath,
                    "utf8"
                )
            );
    }

    const baselineDeclaration =
        baseline.declarations.find(
            declaration =>
                declaration.identity ===
                event.identity
        );

    const after =
        event.delta &&
        event.delta.after;

    if (
        after
    ) {
        return {
            file:
                after.file ||
                baselineDeclaration?.file,

            kind:
                after.kind ||
                baselineDeclaration?.kind,

            properties:
                after.properties ||
                baselineDeclaration?.properties ||
                {}
        };
    }

    if (
        baselineDeclaration
    ) {
        return {
            file:
                baselineDeclaration.file,

            kind:
                baselineDeclaration.kind,

            properties:
                baselineDeclaration.properties ||
                {}
        };
    }

    return {
        file: "",
        kind: "",
        properties: {}
    };
}

// --------------------------------------------------
// GET EXISTING EVOLUTION VOCABULARY
//
// Existing features and tags are passed to the LLM.
//
// This is what keeps terminology stable across
// multiple evolution sessions.
// --------------------------------------------------

function getEvolutionVocabulary(
    evolution
) {

    const features =
        [];


    const tags =
        [];


    const featureSet =
        new Set();


    const tagSet =
        new Set();


    for (
        const node
        of evolution.nodes || []
    ) {

        const feature =
            node.feature ||
            node.category;


        if (
            feature
        ) {

            const normalizedFeature =
                String(
                    feature
                ).trim();


            const featureKey =
                normalizedFeature
                    .toLowerCase();


            if (
                normalizedFeature &&
                !featureSet.has(
                    featureKey
                )
            ) {

                featureSet.add(
                    featureKey
                );


                features.push(
                    normalizedFeature
                );
            }
        }


        for (
            const tag
            of node.tags || []
        ) {

            const normalizedTag =
                String(
                    tag
                ).trim();


            const tagKey =
                normalizedTag
                    .toLowerCase();


            if (
                normalizedTag &&
                !tagSet.has(
                    tagKey
                )
            ) {

                tagSet.add(
                    tagKey
                );


                tags.push(
                    normalizedTag
                );
            }
        }
    }


    return {
        features,
        categories:
            features,
        tags
    };
}
// --------------------------------------------------
// GET NEW EVOLUTION EVENTS
// 1-Receives all events.
// 2-Receives the stored evolution.
// 3-Checks whether an event already exists.
// 4-Requeues temporary path-fallback events for LLM retry.
// 5-Returns new events plus retryable fallback events.
// --------------------------------------------------

function getNewEvolutionEvents(
    events,
    evolution
) {
    const storedNodes =
        new Map(
            (evolution.nodes || [])
                .map(
                    node => [
                        `${node.ts}|${node.type}|${node.identity}`,
                        node
                    ]
                )
        );

    return events.filter(
        event => {
            const key =
                `${event.ts}|${event.type}|${event.identity}`;

            const existingNode =
                storedNodes.get(
                    key
                );

            if (!existingNode) {
                return true;
            }

            /*
             * A path fallback is temporary.
             *
             * If the LLM was unavailable during a previous run,
             * the event remains in evolution.json with
             * labelSource/tagSource set to "path".
             *
             * Such an event MUST be sent to the LLM again on the
             * next run so classification can be retried.
             */

            return (
                existingNode.labelSource === "path" ||
                existingNode.tagSource === "path"
            );
        }
    );
}


/// --------------------------------------------------
// GET FALLBACK TAGS
//
// Offline mode must NOT invent architecture tags.
//
// If this event has a parent, reuse the parent's
// frozen tags.
//
// Otherwise return no tags.
//
// The next successful LLM classification can provide
// the metadata.
// --------------------------------------------------

function getFallbackTags(
    event,
    facts,
    parentNode = null
) {

    if (
        parentNode &&
        Array.isArray(
            parentNode.tags
        )
    ) {

        return [
            ...parentNode.tags
        ];
    }


    return [];
}

// --------------------------------------------------
// APPLY LLM EVOLUTION CLASSIFICATION
//
// The LLM provides:
// - feature
// - label
// - tags
//
// PlanMap provides:
// - event identity
// - timestamp
// - lineage
//
// Successful LLM classifications are frozen.
// Temporary path fallbacks remain retryable.
// --------------------------------------------------

function applyEvolutionClassification(
    evolution,
    classifications,
    fallbackData
) {

    const classificationMap =
        new Map();


    for (
        const item
        of classifications
    ) {

        classificationMap.set(
            `${item.ts}|${item.identity}`,
            item
        );
    }


    const fallbackMap =
        new Map();


    for (
        const item
        of fallbackData
    ) {

        fallbackMap.set(
            `${item.ts}|${item.identity}`,
            item
        );
    }


    for (
        const node
        of evolution.nodes || []
    ) {

        const key =
            `${node.ts}|${node.identity}`;


        /*
         * IMPORTANT:
         *
         * Only successful LLM classifications are frozen.
         *
         * A "path" classification is an offline fallback and
         * is intentionally temporary. It may be replaced by a
         * successful LLM classification on a later run.
         */

        if (
            node.labelSource === "llm" ||
            node.tagSource === "llm"
        ) {
            continue;
        }


        const classification =
            classificationMap.get(
                key
            );


        if (
            classification
        ) {

            node.feature =
                classification.feature;


            node.category =
                classification.feature;




            node.label =
                classification.label;


            node.tags =
                [
                    ...classification.tags
                ];


            node.labelSource =
                "llm";


            node.tagSource =
                "llm";


            continue;
        }


        /*
         * Offline fallback.
         */

        const fallback =
            fallbackMap.get(
                key
            );


        if (
            fallback
        ) {

            node.feature =
                fallback.feature ||
                "Unclassified";


            node.category =
                node.feature;




            node.label =
                fallback.label;


            node.tags =
                Array.isArray(
                    fallback.tags
                )
                    ? [
                        ...fallback.tags
                    ]
                    : [];


            node.labelSource =
                "path";


            node.tagSource =
                "path";
        }
    }


    return evolution;
}
// --------------------------------------------------

// --------------------------------------------------
// ENFORCE PROJECT-WIDE TAG VOCABULARY
//
// The tag vocabulary is controlled by a configurable
// project-wide rule.
//
// No specific tag names are hard-coded.
// Existing tags are preserved.
// New tags can only be introduced until the
// configured maximum is reached.
// --------------------------------------------------

function enforceProjectTagRule(
    evolution,
    maxTags = Number(
        process.env.PLANMAP_MAX_TAGS || 8
    )
) {

    const limit =
        Number.isFinite(maxTags) && maxTags > 0
            ? Math.floor(maxTags)
            : 8;

    /*
     * Build the existing project-wide vocabulary.
     *
     * This vocabulary is collected before allowing
     * any new tag to enter the project.
     */
    const vocabulary =
        new Map();

    for (
        const node
        of evolution.nodes || []
    ) {

        if (
            !Array.isArray(node.tags)
        ) {
            continue;
        }

        for (
            const tag
            of node.tags
        ) {

            if (
                typeof tag !== "string"
            ) {
                continue;
            }

            const cleaned =
                tag.trim();

            if (!cleaned) {
                continue;
            }

            const key =
                cleaned.toLowerCase();

            if (
                !vocabulary.has(key)
            ) {

                vocabulary.set(
                    key,
                    cleaned
                );
            }
        }
    }

    /*
     * Enforce the maximum.
     *
     * Existing vocabulary is retained.
     * New vocabulary is accepted only while
     * the project-wide limit has capacity.
     */
    for (
        const node
        of evolution.nodes || []
    ) {

        if (
            !Array.isArray(node.tags)
        ) {
            continue;
        }

        const accepted = [];

        for (
            const tag
            of node.tags
        ) {

            if (
                typeof tag !== "string"
            ) {
                continue;
            }

            const cleaned =
                tag.trim();

            if (!cleaned) {
                continue;
            }

            const key =
                cleaned.toLowerCase();

            /*
             * Existing vocabulary is always allowed.
             */
            if (
                vocabulary.has(key)
            ) {

                accepted.push(
                    vocabulary.get(key)
                );

                continue;
            }

            /*
             * A genuinely new tag can only be added
             * while the project vocabulary has room.
             */
            if (
                vocabulary.size < limit
            ) {

                vocabulary.set(
                    key,
                    cleaned
                );

                accepted.push(
                    cleaned
                );
            }
        }

        node.tags =
            [
                ...new Set(accepted)
            ];
    }

    return evolution;
}

// RUN EVOLUTION
// 1-Receives the project folder path.
// 2-Checks whether the project folder was provided.
// 3-Converts the project path into an absolute path.
// 4-Checks whether the project folder exists.
// 5-Reads events.jsonl.
// 6-Groups events into deterministic sessions.
// 7-Builds lineage relationships.
// 8-Reads evolution.json.
// 9-Finds new evolution events and retryable fallback events.
// 10-Collects static facts for events requiring classification.
// 11-Sends events to Gemini.
// 12-Validates and stores successful classifications.
// 13-Uses temporary fallback metadata when Gemini is unavailable.
// 14-Writes evolution.json.
// 15-Prints sessions.
// 16-Prints lineage.
// 17-When --md is provided, writes EVOLUTION.md.
// --------------------------------------------------

async function runEvolution(
    projectPath,
    markdownRequested = false
) {
    if (
        !projectPath
    ) {
        console.error(
            "Usage: node src/cli.js evolution <project-folder> [--md]"
        );

        process.exit(1);
    }

    const projectRoot =
        path.resolve(
            projectPath
        );

    if (
        !fs.existsSync(
            projectRoot
        )
    ) {
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


    // --------------------------------------------------
    // LOAD ENVIRONMENT
    // --------------------------------------------------

    if (
        typeof process.loadEnvFile ===
        "function"
    ) {
        try {
            process.loadEnvFile();
        } catch (
            error
        ) {
            // .env is optional because
            // evolution must still work offline.
        }
    }


    // --------------------------------------------------
    // READ EVOLUTION DATA
    // --------------------------------------------------

    const events =
        readEvents(
            projectRoot
        );

    const sessions =
        groupSessions(
            events
        );

    const lineage =
        buildLineage(
            events
        );

    const evolution =
        readEvolution(
            projectRoot
        );


    // --------------------------------------------------
    // FIND NEW EVENTS
    // --------------------------------------------------

    const newEvents =
        getNewEvolutionEvents(
            events,
            evolution
        );


    // --------------------------------------------------
    // ADD NEW EVENTS TO EVOLUTION STORE
    // --------------------------------------------------

    let updatedEvolution =
        updateEvolution(
            evolution,
            newEvents
        );


    // --------------------------------------------------
    // CLASSIFY NEW EVENTS
    // --------------------------------------------------

    if (
        newEvents.length > 0
    ) {
        const factsByEvent =
            new Map();

        const llmEvents =
            newEvents.map(
                event => {
                    const facts =
                        getEvolutionFacts(
                            projectRoot,
                            event
                        );

                    factsByEvent.set(
                        `${event.ts}|${event.identity}`,
                        facts
                    );

                    return {
                        ts:
                            event.ts,

                        identity:
                            event.identity,

                        type:
                            event.type,

                        delta:
                            event.delta ||
                            {},

                        facts
                    };
                }
            );


        // --------------------------------------------------
        // EXISTING CATEGORY + TAG VOCABULARY
        // --------------------------------------------------

        const vocabulary =
            getEvolutionVocabulary(
                evolution
            );


        let classifications =
            [];

        const fallbackData =
            [];


        // --------------------------------------------------
        // PREPARE OFFLINE FALLBACK
        // --------------------------------------------------

        for (
            const event
            of newEvents
        ) {
            const facts =
                factsByEvent.get(
                    `${event.ts}|${event.identity}`
                );

            const pathCategory =
                getPathCategory(
                    event.identity
                );

            fallbackData.push({
                ts:
                    event.ts,

                identity:
                    event.identity,

                category:
                    pathCategory.category,


                label:
                    getEvolutionLabel(
                        event
                    ),

                tags:
                    getFallbackTags(
                        event,
                        facts
                    )
            });
        }


        // --------------------------------------------------
        // CALL GEMINI
        // --------------------------------------------------

        try {
            const {
                classifyEvolutionEvents
            } = await import(
                "./llm.js"
            );

       classifications =
    await classifyEvolutionEvents(
        llmEvents,
        vocabulary.features,
        vocabulary.tags,
        Number(
            process.env.PLANMAP_MAX_TAGS ||
            8
        )
    );

            console.log(
                `\nGemini classified ${classifications.length} evolution events.`
            );

        } catch (
            error
        ) {
            console.warn(
                "\nGemini classification unavailable."
            );

            console.warn(
                `Using offline fallback: ${error.message}`
            );

            classifications =
                [];
        }


        // --------------------------------------------------
        // APPLY CLASSIFICATION
        // --------------------------------------------------

        updatedEvolution =
            applyEvolutionClassification(
                updatedEvolution,
                classifications,
                fallbackData
            );
    }


    // --------------------------------------------------
    // WRITE EVOLUTION
    // --------------------------------------------------

    const evolutionPath =
        writeEvolution(
            projectRoot,
            updatedEvolution
        );


    // --------------------------------------------------
    // PRINT SESSIONS
    // --------------------------------------------------

    console.log(
        `\nEvolution sessions: ${sessions.length}\n`
    );

    for (
        let index = 0;
        index < sessions.length;
        index++
    ) {
        const session =
            sessions[index];

        console.log(
            `Session ${index + 1}`
        );

        for (
            const event
            of session
        ) {
            console.log(
                `  ${event.ts}  ${event.type}  ${event.identity}`
            );
        }

        console.log();
    }


    // --------------------------------------------------
    // PRINT LINEAGE
    // --------------------------------------------------

    console.log(
        "\nLineage:\n"
    );

    for (
        const node
        of lineage
    ) {
        console.log(
            `  ${node.event.type}  ${node.event.identity}`
        );

        if (
            node.parent
        ) {
            console.log(
                `    parent: ${node.parent.identity}`
            );
        } else {
            console.log(
                "    parent: none"
            );
        }
    }


    // --------------------------------------------------
    // PRINT EVOLUTION STORE
    // --------------------------------------------------

    console.log(
        `\nEvolution written: ${evolutionPath}`
    );


    // --------------------------------------------------
    // WRITE MARKDOWN
    // --------------------------------------------------

    if (
        markdownRequested
    ) {
        const markdownPath =
            writeEvolutionMarkdown(
                projectRoot,
                updatedEvolution
            );

        console.log(
            `Evolution Markdown written: ${markdownPath}`
        );
    }
}


// --------------------------------------------------
// RUN DIFF
// 1-Receives before and after file paths.
// 2-Checks both paths.
// 3-Parses both files.
// 4-Gets declarations.
// 5-Compares declarations.
// 6-Formats the differences.
// --------------------------------------------------

function runDiff(
    beforePath,
    afterPath
) {
    if (
        !beforePath ||
        !afterPath
    ) {
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
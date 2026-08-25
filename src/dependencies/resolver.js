import fs from "node:fs";
import path from "node:path";

import { parseFile } from "../parser.js";


// ------------------------------------------------------------
// SUPPORTED SOURCE EXTENSIONS
// ------------------------------------------------------------

const SOURCE_EXTENSIONS = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx"
];


// ------------------------------------------------------------
// RESOLVE RELATIVE MODULE
// ------------------------------------------------------------

function resolveRelativeModule(
    importerPath,
    source
) {
    if (
        typeof source !== "string" ||
        !source.startsWith(".")
    ) {
        return {
            path: null,
            confidence: "unresolved",
            reason: "external-or-non-relative"
        };
    }

    const importerDirectory =
        path.dirname(
            importerPath
        );

    const requestedPath =
        path.resolve(
            importerDirectory,
            source
        );

    const candidates = [];

    /*
     * First try the path exactly as written.
     */
    candidates.push(
        requestedPath
    );

    /*
     * ESM imports frequently use .js while the
     * source file is TypeScript.
     *
     * Example:
     *
     *     import "./fileA.js"
     *
     *     -> fileA.ts
     *
     * Try source-language extensions after the
     * explicitly written extension.
     */
    const requestedExtension =
        path.extname(
            requestedPath
        );

    const requestedWithoutExtension =
        requestedExtension
            ? requestedPath.slice(
                0,
                -requestedExtension.length
            )
            : requestedPath;

    for (
        const candidateExtension
        of SOURCE_EXTENSIONS
    ) {
        candidates.push(
            requestedWithoutExtension +
            candidateExtension
        );
    }

    /*
     * Also support directory imports.
     */
    for (
        const candidateExtension
        of SOURCE_EXTENSIONS
    ) {
        candidates.push(
            path.join(
                requestedPath,
                `index${candidateExtension}`
            )
        );
    }

    /*
     * Remove duplicate candidates while preserving
     * deterministic resolution order.
     */
    const uniqueCandidates =
        [...new Set(candidates)];

    for (
        const candidate
        of uniqueCandidates
    ) {
        if (
            fs.existsSync(candidate) &&
            fs.statSync(candidate).isFile()
        ) {
            return {
                path:
                    path.resolve(candidate),

                confidence:
                    "certain",

                reason:
                    "relative-module-resolved"
            };
        }
    }

    return {
        path: null,
        confidence: "unresolved",
        reason: "module-not-found"
    };
}


// ------------------------------------------------------------
// EXTRACT IMPORTS
// ------------------------------------------------------------

function extractImports(
    tree
) {
    const imports = [];

    function textOf(node) {
        return node?.text ?? null;
    }

    function stringValue(node) {
        const text = textOf(node);

        if (
            typeof text !== "string"
        ) {
            return null;
        }

        return text
            .replace(/^["']/, "")
            .replace(/["']$/, "");
    }

    function getSource(
        node
    ) {
        const sourceNode =
            node.childForFieldName(
                "source"
            );

        return stringValue(
            sourceNode
        );
    }

    function collectESMClause(
        clause
    ) {
        const specifiers = [];

        if (!clause) {
            return specifiers;
        }

        /*
         * Default import:
         *
         *     import createClient from "./source.js"
         *
         * Tree-sitter:
         *
         *     import_clause
         *       identifier
         */
        const defaultIdentifier =
            clause.namedChildren.find(
                child =>
                    child.type ===
                    "identifier"
            );

        if (
            defaultIdentifier
        ) {
            specifiers.push({
                imported: "default",
                local:
                    defaultIdentifier.text,
                kind: "default"
            });
        }

        function collect(
            current
        ) {
            if (!current) {
                return;
            }

            /*
             * Named import:
             *
             *     import { validate } from "./source.js"
             */
            if (
                current.type ===
                "import_specifier"
            ) {
                const imported =
                    current.childForFieldName(
                        "name"
                    );

                const alias =
                    current.childForFieldName(
                        "alias"
                    );

                specifiers.push({
                    imported:
                        imported?.text ??
                        current.text,

                    local:
                        alias?.text ??
                        imported?.text ??
                        current.text,

                    kind: "named"
                });

                return;
            }

            /*
             * Namespace import:
             *
             *     import * as api from "./source.js"
             */
            if (
                current.type ===
                "namespace_import"
            ) {
                const identifier =
                    current.namedChildren.find(
                        child =>
                            child.type ===
                            "identifier"
                    );

                specifiers.push({
                    imported: "*",
                    local:
                        identifier?.text ??
                        current.text
                            .replace(
                                /^\*\s+as\s+/,
                                ""
                            )
                            .trim(),

                    kind: "namespace"
                });

                return;
            }

            for (
                const child
                of current.namedChildren
            ) {
                collect(child);
            }
        }

        /*
         * Start below the default identifier so it
         * isn't collected again.
         */
        for (
            const child
            of clause.namedChildren
        ) {
            if (
                child.type !==
                "identifier"
            ) {
                collect(child);
            }
        }

        return specifiers;
    }

    function extractRequire(
        node
    ) {
        if (
            !node ||
            node.type !==
            "call_expression"
        ) {
            return null;
        }

        const functionNode =
            node.childForFieldName(
                "function"
            );

        if (
            functionNode?.text !==
            "require"
        ) {
            return null;
        }

        const argumentsNode =
            node.childForFieldName(
                "arguments"
            );

        const sourceNode =
            argumentsNode?.namedChildren?.[0];

        const source =
            stringValue(
                sourceNode
            );

        if (!source) {
            return null;
        }

        return source;
    }

    function visit(
        node
    ) {
        if (!node) {
            return;
        }

        /*
         * ----------------------------------------------------
         * ESM imports
         * ----------------------------------------------------
         */
        if (
            node.type ===
            "import_statement"
        ) {
            const source =
                getSource(node);

            const clause =
                node.namedChildren.find(
                    child =>
                        child.type ===
                        "import_clause"
                );

            imports.push({
                source,
                specifiers:
                    collectESMClause(
                        clause
                    )
            });

            return;
        }

        /*
         * ----------------------------------------------------
         * CommonJS require()
         * ----------------------------------------------------
         */
        if (
            node.type ===
            "variable_declarator"
        ) {
            const value =
                node.childForFieldName(
                    "value"
                );

            const source =
                extractRequire(
                    value
                );

            if (source) {
                const name =
                    node.childForFieldName(
                        "name"
                    );

                if (
                    name?.type ===
                    "identifier"
                ) {
                    imports.push({
                        source,
                        specifiers: [
                            {
                                imported: "*",
                                local:
                                    name.text,
                                kind:
                                    "commonjs"
                            }
                        ]
                    });
                } else if (
                    name?.type ===
                    "object_pattern"
                ) {
                    const specifiers = [];

                    for (
                        const child
                        of name.namedChildren
                    ) {
                        if (
                            child.type ===
                            "shorthand_property_identifier_pattern"
                        ) {
                            specifiers.push({
                                imported:
                                    child.text,
                                local:
                                    child.text,
                                kind:
                                    "commonjs-named"
                            });

                            continue;
                        }

                        if (
                            child.type ===
                            "pair_pattern"
                        ) {
                            const key =
                                child.childForFieldName(
                                    "key"
                                );

                            const valueNode =
                                child.childForFieldName(
                                    "value"
                                );

                            specifiers.push({
                                imported:
                                    key?.text ??
                                    child.text,
                                local:
                                    valueNode?.text ??
                                    key?.text ??
                                    child.text,
                                kind:
                                    "commonjs-named"
                            });
                        }
                    }

                    imports.push({
                        source,
                        specifiers
                    });
                }
            }
        }

        for (
            const child
            of node.namedChildren
        ) {
            visit(child);
        }
    }

    visit(
        tree.rootNode
    );

    return imports;
}


// ------------------------------------------------------------
// DECLARATION LOOKUP
// ------------------------------------------------------------

function findExportedDeclaration(
    parsedFile,
    importedName
) {
    if (
        !importedName ||
        !parsedFile ||
        !Array.isArray(parsedFile.declarations)
    ) {
        return null;
    }

    /*
     * Default exports are different from named exports.
     *
     *     export default function createClient() {}
     *
     * The declaration identity is:
     *
     *     createClient:function
     *
     * NOT:
     *
     *     default:function
     *
     * Therefore a default import must resolve to the
     * declaration actually marked with `export default`.
     */
    if (
        importedName === "default"
    ) {
        const code =
            typeof parsedFile.code === "string"
                ? parsedFile.code
                : "";

        const defaultMatches =
            parsedFile.declarations.filter(
                declaration => {
                    const name =
                        declaration?.name;

                    if (
                        typeof name !== "string" ||
                        name.length === 0
                    ) {
                        return false;
                    }

                    /*
                     * Direct default declaration:
                     *
                     * export default function createClient
                     * export default class Client
                     */
                    const directDefault =
                        new RegExp(
                            `export\\s+default\\s+(?:async\\s+)?(?:function|class)\\s+${escapeRegExp(name)}\\b`
                        );

                    if (
                        directDefault.test(code)
                    ) {
                        return true;
                    }

                    /*
                     * Bound default export:
                     *
                     * const createClient = ...
                     * export default createClient;
                     */
                    const boundDefault =
                        new RegExp(
                            `export\\s+default\\s+${escapeRegExp(name)}\\s*;`
                        );

                    return boundDefault.test(code);
                }
            );

        if (
            defaultMatches.length === 1
        ) {
            return defaultMatches[0];
        }

        return null;
    }

    /*
     * Named export lookup remains file-scoped.
     *
     * This prevents same-name declarations in another
     * file from being selected.
     */
    const matches =
        parsedFile.declarations.filter(
            declaration =>
                declaration.name === importedName
        );

    if (
        matches.length === 1
    ) {
        return matches[0];
    }

    /*
     * Fallback for declaration implementations where
     * `name` is unavailable but the identity contains
     * the imported symbol as its final declaration name.
     */
    const identityMatches =
        parsedFile.declarations.filter(
            declaration => {
                const identity =
                    declaration?.identity;

                if (
                    typeof identity !== "string"
                ) {
                    return false;
                }

                const parts =
                    identity.split(":");

                return (
                    parts.length >= 2 &&
                    parts[0] === importedName
                );
            }
        );

    if (
        identityMatches.length === 1
    ) {
        return identityMatches[0];
    }

    return null;
}


function escapeRegExp(
    value
) {
    return String(value).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

// ------------------------------------------------------------
// RESOLVE RE-EXPORT
// ------------------------------------------------------------
//
// Resolve:
//
//     export { validate } from "./source.js";
//
// when an importer points at the barrel:
//
//     import { validate } from "./barrel.js";
//
// The returned declaration belongs to the final source file,
// not the barrel file.
// ------------------------------------------------------------

function resolveReExport(
    barrelPath,
    importedName,
    visited = new Set()
) {
    const absoluteBarrel =
        path.resolve(
            barrelPath
        );

    if (
        visited.has(
            absoluteBarrel
        )
    ) {
        return null;
    }

    visited.add(
        absoluteBarrel
    );

    let parsedBarrel;

    try {
        parsedBarrel =
            parseFile(
                absoluteBarrel
            );
    } catch {
        return null;
    }

    let match = null;

    function visit(node) {
        if (
            !node ||
            match
        ) {
            return;
        }

        if (
            node.type ===
            "export_statement"
        ) {
            const text =
                node.text ?? "";

            /*
             * Match:
             *
             * export { validate } from "./source.js";
             *
             * and:
             *
             * export { validate as check } from "./source.js";
             */
            const exportMatch =
                text.match(
                    /^\s*export\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/
                );

            if (exportMatch) {
                const specifierText =
                    exportMatch[1];

                const source =
                    exportMatch[2];

                const entries =
                    specifierText
                        .split(",")
                        .map(
                            value =>
                                value.trim()
                        )
                        .filter(
                            Boolean
                        );

                for (
                    const entry
                    of entries
                ) {
                    const parts =
                        entry
                            .split(/\s+as\s+/)
                            .map(
                                value =>
                                    value.trim()
                            );

                    const exportedName =
                        parts.length === 2
                            ? parts[1]
                            : parts[0];

                    const sourceName =
                        parts[0];

                    if (
                        exportedName !==
                        importedName
                    ) {
                        continue;
                    }

                    const resolution =
                        resolveRelativeModule(
                            absoluteBarrel,
                            source
                        );

                    if (
                        !resolution.path
                    ) {
                        return;
                    }

                    let parsedTarget;

                    try {
                        parsedTarget =
                            parseFile(
                                resolution.path
                            );
                    } catch {
                        return;
                    }

                    const declaration =
                        findExportedDeclaration(
                            parsedTarget,
                            sourceName
                        );

                    if (
                        declaration
                    ) {
                        match = {
                            path:
                                resolution.path,

                            declaration
                        };
                    }

                    return;
                }
            }
        }

        for (
            const child
            of node.namedChildren || []
        ) {
            visit(child);

            if (
                match
            ) {
                return;
            }
        }
    }

    visit(
        parsedBarrel.tree.rootNode
    );

    return match;
}


// ------------------------------------------------------------
// RESOLVE FILE IMPORTS
// ------------------------------------------------------------

export function resolveFileImports(
    projectRoot,
    filePath
) {
    const absoluteImporter =
        path.resolve(
            filePath
        );

    let parsedImporter;

    try {
        parsedImporter =
            parseFile(
                absoluteImporter
            );
    } catch {
        return {
            filePath:
                absoluteImporter,

            edges:
                []
        };
    }

    const imports =
        extractImports(
            parsedImporter.tree
        );

    const edges = [];

    /*
     * Imports are currently extracted at file scope.
     * Use the project-relative importer path as the source
     * identity until declaration-level symbol ownership is joined.
     */
    const importerIdentity =
        path.relative(
            projectRoot,
            absoluteImporter
        );

    for (
        const importRecord
        of imports
    ) {
        const resolution =
            resolveRelativeModule(
                absoluteImporter,
                importRecord.source
            );

        for (
            const specifier
            of importRecord.specifiers
        ) {
            if (
                !resolution.path
            ) {
                edges.push({
                    from:
                        importerIdentity,

                    to:
                        null,

                    importer:
                        absoluteImporter,

                    source:
                        importRecord.source,

                    imported:
                        specifier.imported,

                    local:
                        specifier.local,

                    kind:
                        "import",

                    confidence:
                        "unresolved",

                    reason:
                        resolution.reason
                });

                continue;
            }

            /*
             * CommonJS namespace require resolves to the
             * required module itself.
             *
             * Example:
             *
             *     const api = require("./source.js");
             *
             * There is no single imported declaration to
             * select at this stage.
             */
            if (
                specifier.imported === "*" &&
                specifier.kind !== "namespace"
            ) {
                edges.push({
                    from:
                        importerIdentity,

                    to:
                        path.relative(
                            projectRoot,
                            resolution.path
                        ),

                    importer:
                        absoluteImporter,

                    source:
                        importRecord.source,

                    imported:
                        specifier.imported,

                    local:
                        specifier.local,

                    kind:
                        "commonjs",

                    targetFile:
                        path.resolve(
                            resolution.path
                        ),

                    confidence:
                        "certain",

                    reason:
                        "commonjs-module-resolved"
                });

                continue;
            }

            /*
             * Namespace imports resolve to the module itself.
             *
             * Example:
             *
             *     import * as api from "./source.js";
             *
             * There is no declaration named "*", so do not attempt
             * declaration lookup for namespace imports.
             */
            if (
                specifier.kind ===
                "namespace"
            ) {
                edges.push({
                    from:
                        importerIdentity,

                    to:
                        path.relative(
                            projectRoot,
                            resolution.path
                        ),

                    importer:
                        absoluteImporter,

                    source:
                        importRecord.source,

                    imported:
                        specifier.imported,

                    local:
                        specifier.local,

                    kind:
                        "namespace",

                    targetFile:
                        path.resolve(
                            resolution.path
                        ),

                    confidence:
                        "certain",

                    reason:
                        "namespace-module-resolved"
                });

                continue;
            }

            let isReExport =
                false;

            let parsedTarget;

            try {
                parsedTarget =
                    parseFile(
                        resolution.path
                    );
            } catch {
                edges.push({
                    from:
                        importerIdentity,

                    to:
                        null,

                    importer:
                        absoluteImporter,

                    source:
                        importRecord.source,

                    imported:
                        specifier.imported,

                    local:
                        specifier.local,

                    kind:
                        isReExport
                            ? "reexport"
                            : "import",

                    targetFile:
                        path.resolve(
                            resolution.path
                        ),

                    confidence:
                        "unresolved",

                    reason:
                        "target-parse-failed"
                });

                continue;
            }

            let targetPath =
                resolution.path;

            let targetDeclaration =
                findExportedDeclaration(
                    parsedTarget,
                    specifier.imported
                );

            /*
             * The resolved file may be a barrel that
             * re-exports the requested declaration.
             *
             * Example:
             *
             *     import { validate } from "./barrel.js";
             *
             *     barrel.ts:
             *         export { validate } from "./source.js";
             */
            if (
                !targetDeclaration
            ) {
                const reExport =
                    resolveReExport(
                        resolution.path,
                        specifier.imported
                    );

                if (
                    reExport
                ) {
                    targetPath =
                        reExport.path;

                    targetDeclaration =
                        reExport.declaration;

                    isReExport =
                        true;
                }
            }

            if (
                !targetDeclaration
            ) {
                edges.push({
                    from:
                        importerIdentity,

                    to:
                        null,

                    importer:
                        absoluteImporter,

                    source:
                        importRecord.source,

                    imported:
                        specifier.imported,

                    local:
                        specifier.local,

                    kind:
                        "import",

                    confidence:
                        "unresolved",

                    reason:
                        "target-declaration-not-found"
                });

                continue;
            }

            edges.push({
                from:
                    importerIdentity,

                to:
                    `${path.relative(
                        projectRoot,
                        targetPath
                    )}::${targetDeclaration.identity}`,

                importer:
                    absoluteImporter,

                source:
                    importRecord.source,

                imported:
                    specifier.imported,

                local:
                    specifier.local,

                kind:
                    isReExport
                        ? "reexport"
                        : "import",

                targetFile:
                    path.resolve(
                        resolution.path
                    ),

                confidence:
                    "certain",

                reason:
                    resolution.reason
            });
        }
    }

    return {
        filePath:
            absoluteImporter,

        edges
    };
}


// ------------------------------------------------------------
// RESOLVE PROJECT IMPORTS
// ------------------------------------------------------------

export function resolveProjectImports(
    projectRoot
) {
    const absoluteRoot =
        path.resolve(
            projectRoot
        );

    const files = [];

    function collectFiles(
        directory
    ) {
        for (
            const entry
            of fs.readdirSync(
                directory,
                {
                    withFileTypes: true
                }
            )
        ) {
            const entryPath =
                path.join(
                    directory,
                    entry.name
                );

            if (
                entry.isDirectory()
            ) {
                if (
                    entry.name ===
                    "node_modules"
                ) {
                    continue;
                }

                if (
                    entry.name ===
                    ".planmap"
                ) {
                    continue;
                }

                collectFiles(
                    entryPath
                );

                continue;
            }

            if (
                SOURCE_EXTENSIONS.includes(
                    path.extname(
                        entry.name
                    ).toLowerCase()
                )
            ) {
                files.push(
                    entryPath
                );
            }
        }
    }

    collectFiles(
        absoluteRoot
    );

    const edges = [];

    for (
        const file
        of files
    ) {
        const result =
            resolveFileImports(
                absoluteRoot,
                file
            );

        edges.push(
            ...result.edges
        );
    }

    return {
        projectRoot:
            absoluteRoot,

        edges
    };
}


// ------------------------------------------------------------
// PUBLIC HELPERS
// ------------------------------------------------------------

export {
    extractImports,
    resolveRelativeModule
};

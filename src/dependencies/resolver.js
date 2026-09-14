import fs from "node:fs";
import path from "node:path";

import { parseFile } from "../baseline/parser.js";


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
// PYTHON IMPORTS
// ------------------------------------------------------------
//
// Python's import grammar and resolution rules are unrelated
// to the ESM/CommonJS logic above: imports are dot-counted
// relative ("from . import x", "from ..pkg import y") or
// absolute from the project root, packages are directories
// with __init__.py (not index.js), and there is no explicit
// export keyword - any top-level name is importable.
//
// Scope is deliberately narrow, per the plan this implements:
// exactly four import forms, one hop of __init__.py re-export
// following, no sys.path handling, no namespace packages.
// ------------------------------------------------------------

function extractPythonImportRecords(tree) {

    const records = [];

    function visit(node) {

        if (!node) {
            return;
        }

        if (node.type === "import_statement") {

            for (const child of node.namedChildren) {

                if (child.type === "dotted_name") {

                    records.push({
                        dots: 0,
                        modulePath: child.text,
                        imported: null,
                        local: child.text
                    });

                } else if (child.type === "aliased_import") {

                    const dotted =
                        child.namedChildren.find(
                            c => c.type === "dotted_name"
                        );

                    const alias =
                        child.namedChildren.find(
                            c => c.type === "identifier"
                        );

                    records.push({
                        dots: 0,
                        modulePath: dotted?.text ?? null,
                        imported: null,
                        local: alias?.text ?? dotted?.text ?? null
                    });
                }
            }

            return;
        }

        if (node.type === "import_from_statement") {

            const moduleNameNode =
                node.childForFieldName("module_name");

            /*
             * module_name is always the first namedChild.
             * Reference equality on node wrapper objects
             * returned by separate accessor calls is not
             * reliable in this binding - verified directly -
             * so the specifier list is taken positionally.
             */
            const specifierNodes =
                node.namedChildren.slice(1);

            let dots = 0;
            let modulePath = null;

            if (moduleNameNode?.type === "relative_import") {

                const prefix =
                    moduleNameNode.namedChildren.find(
                        c => c.type === "import_prefix"
                    );

                dots = prefix ? prefix.text.length : 0;

                const dotted =
                    moduleNameNode.namedChildren.find(
                        c => c.type === "dotted_name"
                    );

                modulePath = dotted?.text ?? null;

            } else if (moduleNameNode?.type === "dotted_name") {

                modulePath = moduleNameNode.text;
            }

            for (const spec of specifierNodes) {

                if (spec.type === "dotted_name") {

                    records.push({
                        dots,
                        modulePath,
                        imported: spec.text,
                        local: spec.text
                    });

                } else if (spec.type === "aliased_import") {

                    const dotted =
                        spec.namedChildren.find(
                            c => c.type === "dotted_name"
                        );

                    const alias =
                        spec.namedChildren.find(
                            c => c.type === "identifier"
                        );

                    records.push({
                        dots,
                        modulePath,
                        imported: dotted?.text ?? null,
                        local: alias?.text ?? dotted?.text ?? null
                    });

                } else if (spec.type === "wildcard_import") {

                    records.push({
                        dots,
                        modulePath,
                        imported: "*",
                        local: "*"
                    });
                }
            }

            return;
        }

        for (const child of node.namedChildren) {
            visit(child);
        }
    }

    visit(tree.rootNode);
    return records;
}


function resolvePythonModuleFile(
    baseDir,
    projectRoot,
    dots,
    modulePath
) {

    let dir;

    if (dots === 0) {
        dir = projectRoot;
    } else {
        dir = baseDir;
        for (let i = 0; i < dots - 1; i++) {
            dir = path.dirname(dir);
        }
    }

    const segments =
        modulePath ? modulePath.split(".") : [];

    const target =
        segments.length > 0
            ? path.join(dir, ...segments)
            : dir;

    /*
     * An over-deep relative import ("from .... import x" with
     * more dots than the importer has ancestor directories
     * inside the project) can walk above projectRoot. That can
     * never match an in-project declaration, so treat it as
     * unresolved rather than asserting a "certain" edge that
     * points outside the project.
     */
    if (
        path.relative(projectRoot, target).startsWith("..")
    ) {
        return null;
    }

    if (
        fs.existsSync(target + ".py") &&
        fs.statSync(target + ".py").isFile()
    ) {
        return {
            file: target + ".py",
            isPackage: false
        };
    }

    const initFile = path.join(target, "__init__.py");

    if (
        fs.existsSync(initFile) &&
        fs.statSync(initFile).isFile()
    ) {
        return {
            file: initFile,
            isPackage: true
        };
    }

    return null;
}


function findTopLevelPythonDeclaration(
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
     * A Python "from x import name" specifier can only ever
     * name a top-level module member - never a nested/qualified
     * one (there is no "from x import Class.method" in real
     * Python). declaration.name holds the qualified name for a
     * method ("Class.method"), so without this guard, a
     * specifier that happens to carry a dot (tree-sitter parses
     * "from mod import a.b" leniently even though it is not
     * valid Python) would match a nested declaration and produce
     * a confidently-wrong "certain" edge to it.
     */
    const matches =
        parsedFile.declarations.filter(
            declaration =>
                declaration.name === importedName &&
                !declaration.name.includes(".")
        );

    return matches.length === 1 ? matches[0] : null;
}


function resolveInitPyReexport(
    projectRoot,
    initFile,
    importedName
) {

    let parsedInit;

    try {
        parsedInit = parseFile(initFile);
    } catch {
        return null;
    }

    const records = extractPythonImportRecords(parsedInit.tree);

    for (const record of records) {

        if (record.local !== importedName) {
            continue;
        }

        const hopDots = record.dots === 0 ? 1 : record.dots;

        const resolved =
            resolvePythonModuleFile(
                path.dirname(initFile),
                projectRoot,
                hopDots,
                record.modulePath
            );

        if (!resolved) {
            continue;
        }

        let parsedTarget;

        try {
            parsedTarget = parseFile(resolved.file);
        } catch {
            continue;
        }

        const declaration =
            findTopLevelPythonDeclaration(
                parsedTarget,
                record.imported ?? importedName
            );

        if (declaration) {
            return {
                path: resolved.file,
                declaration
            };
        }
    }

    return null;
}


function resolvePythonFileImports(
    projectRoot,
    absoluteImporter,
    parsedImporter
) {

    const records = extractPythonImportRecords(parsedImporter.tree);
    const edges = [];

    const importerIdentity =
        path.relative(projectRoot, absoluteImporter);

    const baseDir = path.dirname(absoluteImporter);

    for (const record of records) {

        const isRelative = record.dots > 0;

        /*
         * "from . import X" / "from .. import X" - no
         * modulePath. X may be a submodule file, or a name
         * defined directly inside the package's __init__.py.
         */
        if (isRelative && !record.modulePath) {

            const asSubmodule =
                resolvePythonModuleFile(
                    baseDir,
                    projectRoot,
                    record.dots,
                    record.imported
                );

            if (asSubmodule) {

                edges.push({
                    from: importerIdentity,
                    to: path.relative(projectRoot, asSubmodule.file),
                    importer: absoluteImporter,
                    source: record.modulePath,
                    imported: record.imported,
                    local: record.local,
                    kind: "import",
                    targetFile: asSubmodule.file,
                    confidence: "certain",
                    reason: "relative-submodule-resolved"
                });

                continue;
            }

            let packageDir = baseDir;

            for (let i = 0; i < record.dots - 1; i++) {
                packageDir = path.dirname(packageDir);
            }

            const initFile = path.join(packageDir, "__init__.py");
            let declarationFromInit = null;

            if (fs.existsSync(initFile)) {

                try {
                    const parsedInit = parseFile(initFile);

                    declarationFromInit =
                        findTopLevelPythonDeclaration(
                            parsedInit,
                            record.imported
                        );
                } catch {
                    declarationFromInit = null;
                }
            }

            if (declarationFromInit) {

                edges.push({
                    from: importerIdentity,
                    to: `${path.relative(projectRoot, initFile)}::${declarationFromInit.identity}`,
                    importer: absoluteImporter,
                    source: null,
                    imported: record.imported,
                    local: record.local,
                    kind: "import",
                    targetFile: initFile,
                    confidence: "certain",
                    reason: "package-init-name-found"
                });

                continue;
            }

            edges.push({
                from: importerIdentity,
                to: null,
                importer: absoluteImporter,
                source: null,
                imported: record.imported,
                local: record.local,
                kind: "import",
                confidence: "unresolved",
                reason: "relative-import-path-not-found"
            });

            continue;
        }

        /*
         * "from .module import X" / "from ..pkg.sub import X" /
         * "from package import X" / "import module"
         */
        const resolved =
            resolvePythonModuleFile(
                baseDir,
                projectRoot,
                record.dots,
                record.modulePath
            );

        if (!resolved) {

            /*
             * A relative import that fails to resolve is always
             * unresolved - the dots make the intent to reference
             * a local project file unambiguous, and it wasn't
             * found. An absolute import gets one narrow upgrade
             * to "inferred": when its first dotted segment names
             * a real top-level entry in this project (so the
             * name plausibly matches something local) but the
             * full path still didn't resolve to a file. Anything
             * else absolute (no project-level name match at all,
             * e.g. a third-party package name) is unresolved.
             */
            let confidence = "unresolved";
            let reason = isRelative ? "relative-import-path-not-found" : "external-or-stdlib";

            if (!isRelative && record.modulePath) {
                const firstSegment = record.modulePath.split(".")[0];
                const firstSegmentPath = path.join(projectRoot, firstSegment);

                const matchesProjectEntry =
                    fs.existsSync(firstSegmentPath + ".py") ||
                    fs.existsSync(path.join(firstSegmentPath, "__init__.py"));

                if (matchesProjectEntry) {
                    confidence = "inferred";
                    reason = "partial-path-matches-project-package";
                }
            }

            edges.push({
                from: importerIdentity,
                to: null,
                importer: absoluteImporter,
                source: record.modulePath,
                imported: record.imported,
                local: record.local,
                kind: "import",
                confidence,
                reason
            });

            continue;
        }

        if (record.imported === null || record.imported === "*") {

            edges.push({
                from: importerIdentity,
                to: path.relative(projectRoot, resolved.file),
                importer: absoluteImporter,
                source: record.modulePath,
                imported: record.imported,
                local: record.local,
                kind: record.imported === "*" ? "wildcard" : "import",
                targetFile: resolved.file,
                confidence: "certain",
                reason: "module-resolved"
            });

            continue;
        }

        let parsedTarget;

        try {
            parsedTarget = parseFile(resolved.file);
        } catch {

            edges.push({
                from: importerIdentity,
                to: null,
                importer: absoluteImporter,
                source: record.modulePath,
                imported: record.imported,
                local: record.local,
                kind: "import",
                targetFile: resolved.file,
                confidence: "unresolved",
                reason: "target-parse-failed"
            });

            continue;
        }

        const declaration =
            findTopLevelPythonDeclaration(
                parsedTarget,
                record.imported
            );

        if (declaration) {

            edges.push({
                from: importerIdentity,
                to: `${path.relative(projectRoot, resolved.file)}::${declaration.identity}`,
                importer: absoluteImporter,
                source: record.modulePath,
                imported: record.imported,
                local: record.local,
                kind: "import",
                targetFile: resolved.file,
                confidence: "certain",
                reason: "declaration-found"
            });

            continue;
        }

        if (resolved.isPackage) {

            const reexport =
                resolveInitPyReexport(
                    projectRoot,
                    resolved.file,
                    record.imported
                );

            if (reexport) {

                edges.push({
                    from: importerIdentity,
                    to: `${path.relative(projectRoot, reexport.path)}::${reexport.declaration.identity}`,
                    importer: absoluteImporter,
                    source: record.modulePath,
                    imported: record.imported,
                    local: record.local,
                    kind: "reexport",
                    targetFile: reexport.path,
                    confidence: "certain",
                    reason: "init-reexport-one-hop"
                });

                continue;
            }
        }

        edges.push({
            from: importerIdentity,
            to: path.relative(projectRoot, resolved.file),
            importer: absoluteImporter,
            source: record.modulePath,
            imported: record.imported,
            local: record.local,
            kind: "import",
            targetFile: resolved.file,
            confidence: "certain",
            reason: "module-resolved-name-not-found"
        });
    }

    return {
        filePath: absoluteImporter,
        edges
    };
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

    if (
        path.extname(absoluteImporter).toLowerCase() === ".py"
    ) {
        return resolvePythonFileImports(
            projectRoot,
            absoluteImporter,
            parsedImporter
        );
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

            const entryExtension =
                path.extname(
                    entry.name
                ).toLowerCase();

            if (
                SOURCE_EXTENSIONS.includes(entryExtension) ||
                entryExtension === ".py"
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

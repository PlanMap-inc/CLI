import {
    isSourceFile
} from "../scanner.js";


// --------------------------------------------------
// WATCHER FILE FILTER
// --------------------------------------------------
// 1-Receives a file path and optional filesystem stats.
// 2-Ignores PlanMap internal files.
// 3-Ignores dependency directories.
// 4-Ignores common build/cache directories.
// 5-Ignores common system files.
// 6-Only applies the JavaScript extension check when
//   the path is confirmed to be a file.
// 7-Allows paths when stats are not yet available so
//   Chokidar can continue traversing directories.
// --------------------------------------------------

export function shouldIgnore(
    filePath,
    stats
) {

    const normalizedPath =
        filePath
            .split("\\")
            .join("/");


    // --------------------------------------------------
    // PLANMAP INTERNAL FILES
    // --------------------------------------------------

    if (
        normalizedPath.includes(
            "/.planmap/"
        )
    ) {
        return true;
    }


    // --------------------------------------------------
    // DEPENDENCY / GENERATED DIRECTORIES
    // --------------------------------------------------

    const ignoredDirectories = [
        "/node_modules/",
        "/.git/",
        "/dist/",
        "/build/",
        "/coverage/",
        "/.next/",
        "/.cache/",
        "/out/",
        "/.turbo/"
    ];


    for (
        const directory
        of ignoredDirectories
    ) {

        if (
            normalizedPath.includes(
                directory
            )
        ) {
            return true;
        }
    }


    // --------------------------------------------------
    // DIRECTORIES
    // --------------------------------------------------
    // Chokidar may call this function before filesystem
    // stats are available.
    //
    // When stats are available and this is a directory,
    // allow it so Chokidar can continue traversing it.
    // --------------------------------------------------

    if (
        stats &&
        stats.isDirectory()
    ) {
        return false;
    }


    // --------------------------------------------------
    // SYSTEM FILES
    // --------------------------------------------------

    const fileName =
        normalizedPath
            .split("/")
            .pop();


    if (
        fileName ===
        ".DS_Store"
    ) {
        return true;
    }


    // --------------------------------------------------
    // FILE EXTENSION
    // --------------------------------------------------
    // IMPORTANT:
    //
    // Do NOT reject a path when stats are undefined.
    //
    // Chokidar can call `ignored` before it has stat'd
    // the path. At that point we do not know whether
    // the path is a directory or a file.
    // --------------------------------------------------

    if (
        stats &&
        stats.isFile() &&
        !isSourceFile(
            normalizedPath
        )
    ) {
        return true;
    }


    // --------------------------------------------------
    // ALLOW
    // --------------------------------------------------

    return false;
}
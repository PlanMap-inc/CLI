// --------------------------------------------------
// WATCHER FILE FILTER
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
    // DEPENDENCIES
    // --------------------------------------------------

    const ignoredDirectories = [
        "/node_modules/",
        "/.git/",
        "/dist/",
        "/build/",
        "/coverage/",
        "/.next/",
        "/.cache/",
        "/out/"
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
    // ALWAYS ALLOW DIRECTORIES
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
    // ONLY JAVASCRIPT FILES
    // --------------------------------------------------

    if (
        !normalizedPath.endsWith(
            ".js"
        )
    ) {
        return true;
    }


    return false;
}
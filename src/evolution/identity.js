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

export function parseEvolutionIdentity(
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

export function getPathCategory(
    identity
) {

    return {
        category:
            "Unclassified",

    };
}
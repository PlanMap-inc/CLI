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

export function enforceProjectTagRule(
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
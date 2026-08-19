import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// GET EVENTS PATH
// --------------------------------------------------

export function getEventsPath(
    projectRoot
) {
    return path.join(
        projectRoot,
        ".planmap",
        "events.jsonl"
    );
}


// --------------------------------------------------
// GET EVOLUTION PATH
// --------------------------------------------------

export function getEvolutionPath(
    projectRoot
) {
    return path.join(
        projectRoot,
        ".planmap",
        "evolution.json"
    );
}


// --------------------------------------------------
// READ EVOLUTION
// --------------------------------------------------

export function readEvolution(
    projectRoot
) {
    const evolutionPath =
        getEvolutionPath(
            projectRoot
        );

    if (
        !fs.existsSync(
            evolutionPath
        )
    ) {
        return {
            version: 1,
            nodes: []
        };
    }

    const content =
        fs.readFileSync(
            evolutionPath,
            "utf8"
        );

    return JSON.parse(
        content
    );
}


// --------------------------------------------------
// WRITE EVOLUTION
// --------------------------------------------------

export function writeEvolution(
    projectRoot,
    evolution
) {
    const planmapDirectory =
        path.join(
            projectRoot,
            ".planmap"
        );

    fs.mkdirSync(
        planmapDirectory,
        {
            recursive: true
        }
    );

    const evolutionPath =
        getEvolutionPath(
            projectRoot
        );

    fs.writeFileSync(
        evolutionPath,
        JSON.stringify(
            evolution,
            null,
            2
        ) + "\n",
        "utf8"
    );

    return evolutionPath;
}


// --------------------------------------------------
// CREATE EVENT KEY
// --------------------------------------------------

export function createEventKey(
    event
) {
    return [
        event.ts,
        event.identity,
        event.type
    ].join(
        "|"
    );
}


// --------------------------------------------------
// CREATE NODE ID
// --------------------------------------------------

export function createNodeId(
    nodeNumber
) {
    return (
        `n_${String(
            nodeNumber
        ).padStart(
            4,
            "0"
        )}`
    );
}
import fs from "node:fs";
import path from "node:path";


// --------------------------------------------------
// GET EVENTS PATH
// 1-Receives the project root.
// 2-Builds the path to .planmap/events.jsonl.
// 3-Returns the events file path.
// --------------------------------------------------

function getEventsPath(
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
// 1-Receives the project root.
// 2-Builds the path to .planmap/evolution.json.
// 3-Returns the evolution file path.
// --------------------------------------------------

function getEvolutionPath(
    projectRoot
) {
    return path.join(
        projectRoot,
        ".planmap",
        "evolution.json"
    );
}


// --------------------------------------------------
// READ EVENTS
// 1-Receives the project root.
// 2-Reads events.jsonl when it exists.
// 3-Parses one JSON object from each line.
// 4-Ignores empty lines.
// 5-Returns all events in file order.
// --------------------------------------------------

export function readEvents(
    projectRoot
) {
    const eventsPath =
        getEventsPath(
            projectRoot
        );

    if (
        !fs.existsSync(
            eventsPath
        )
    ) {
        return [];
    }

    const content =
        fs.readFileSync(
            eventsPath,
            "utf8"
        );

    const events = [];

    for (
        const line
        of content.split("\n")
    ) {
        const trimmed =
            line.trim();

        if (
            !trimmed
        ) {
            continue;
        }

        events.push(
            JSON.parse(
                trimmed
            )
        );
    }

    return events;
}


// --------------------------------------------------
// GROUP EVENTS INTO SESSIONS
// 1-Receives the events.
// 2-Receives the maximum session gap in minutes.
// 3-Sorts a copy of the events by timestamp.
// 4-Keeps events less than 5 minutes apart
//    in the same session.
// 5-Starts a new session when the gap is 5 minutes
//    or more.
// 6-Returns all sessions.
// --------------------------------------------------

export function groupSessions(
    events,
    gapMinutes = 5
) {
    if (
        events.length === 0
    ) {
        return [];
    }

    const sortedEvents =
        [...events].sort(
            (
                left,
                right
            ) => {
                const leftTime =
                    new Date(
                        left.ts
                    ).getTime();

                const rightTime =
                    new Date(
                        right.ts
                    ).getTime();

                return (
                    leftTime -
                    rightTime
                );
            }
        );

    const gapMilliseconds =
        gapMinutes *
        60 *
        1000;

    const sessions = [];

    let currentSession = [];

    for (
        let index = 0;
        index < sortedEvents.length;
        index++
    ) {
        const event =
            sortedEvents[index];

        if (
            currentSession.length === 0
        ) {
            currentSession.push(
                event
            );

            continue;
        }

        const previousEvent =
            sortedEvents[
                index - 1
            ];

        const previousTime =
            new Date(
                previousEvent.ts
            ).getTime();

        const currentTime =
            new Date(
                event.ts
            ).getTime();

        const gap =
            currentTime -
            previousTime;

        if (
            gap < gapMilliseconds
        ) {
            currentSession.push(
                event
            );
        } else {
            sessions.push(
                currentSession
            );

            currentSession = [
                event
            ];
        }
    }

    if (
        currentSession.length > 0
    ) {
        sessions.push(
            currentSession
        );
    }

    return sessions;
}


// --------------------------------------------------
// BUILD LINEAGE
// 1-Receives the events.
// 2-Creates a Map to store the latest event
//    by declaration identity.
// 3-Creates an empty list for lineage nodes.
// 4-Loops through every event.
// 5-If the event is added:
//    * Creates a root node.
//    * Stores it as the latest event.
// 6-If the event is changed:
//    * Finds the latest event for the identity.
//    * Makes that event its parent when one exists.
//    * Keeps it as a root when no previous event exists.
//    * Stores the changed event as the latest event.
// 7-If the event is deleted:
//    * Finds the latest event for the identity.
//    * Makes that event its parent when one exists.
//    * Keeps it as a root when no previous event exists.
//    * Stores the deleted event as the latest event.
// 8-Returns the events with their parent relationships.
// --------------------------------------------------

export function buildLineage(
    events
) {
    const latestEvents =
        new Map();

    const lineage =
        [];

    for (
        const event
        of events
    ) {
        if (
            event.type === "added"
        ) {
            lineage.push({
                event,
                parent: null
            });

            latestEvents.set(
                event.identity,
                event
            );

            continue;
        }

        if (
            event.type === "changed" ||
            event.type === "deleted"
        ) {
            const parentEvent =
                latestEvents.get(
                    event.identity
                );

            lineage.push({
                event,
                parent:
                    parentEvent || null
            });

            /*
             * Keep the original "added" event as the
             * lineage anchor.
             *
             * Do NOT replace latestEvents with the
             * changed/deleted event.
             *
             * This keeps subsequent changes as
             * siblings instead of creating a
             * staircase of nested changes.
             */
        }
    }

    return lineage;
}


// --------------------------------------------------
// READ EVOLUTION
// 1-Receives the project root.
// 2-Builds the evolution.json path.
// 3-Returns an empty evolution store when the file
//    does not exist.
// 4-Reads and parses evolution.json when it exists.
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
// 1-Receives the project root.
// 2-Receives the evolution data.
// 3-Creates .planmap when needed.
// 4-Writes evolution.json.
// 5-Uses readable JSON formatting.
// 6-Returns the written file path.
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
// 1-Receives an event.
// 2-Combines its timestamp, identity and type.
// 3-Returns a unique key for the event.
// --------------------------------------------------

function createEventKey(
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
// 1-Receives the current node count.
// 2-Creates the next sequential node number.
// 3-Formats the number with four digits.
// 4-Returns the evolution node ID.
// --------------------------------------------------

function createNodeId(
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


// --------------------------------------------------
// UPDATE EVOLUTION
// 1-Receives the existing evolution data.
// 2-Receives all events from events.jsonl.
// 3-Builds lineage from the complete event history.
// 4-Maps existing events to their stored node IDs.
// 5-Processes only events that are not already stored.
// 6-Creates one evolution node for every new event.
// 7-Connects each node to its lineage parent.
// 8-Copies identity, type, timestamp and delta.
// 9-Returns the updated evolution data.
// --------------------------------------------------

export function updateEvolution(
    evolution,
    events
) {
    const existingEventKeys =
        new Set();

    const nodeIdsByEventKey =
        new Map();

    for (
        const node
        of evolution.nodes
    ) {
        const eventKey =
            createEventKey(
                node
            );

        existingEventKeys.add(
            eventKey
        );

        nodeIdsByEventKey.set(
            eventKey,
            node.id
        );
    }

    const lineage =
        buildLineage(
            events
        );

    let nextNodeNumber =
        evolution.nodes.length + 1;

    for (
        const lineageNode
        of lineage
    ) {
        const event =
            lineageNode.event;

        const eventKey =
            createEventKey(
                event
            );

        if (
            existingEventKeys.has(
                eventKey
            )
        ) {
            continue;
        }

        let parentId =
            null;

        if (
            lineageNode.parent
        ) {
            const parentKey =
                createEventKey(
                    lineageNode.parent
                );

            parentId =
                nodeIdsByEventKey.get(
                    parentKey
                ) || null;
        }

        const nodeId =
            createNodeId(
                nextNodeNumber
            );

        const node = {
            id: nodeId,
            identity: event.identity,
            type: event.type,
            parent: parentId,
            ts: event.ts,
            delta:
                event.delta || {}
        };

        evolution.nodes.push(
            node
        );

        existingEventKeys.add(
            eventKey
        );

        nodeIdsByEventKey.set(
            eventKey,
            nodeId
        );

        nextNodeNumber++;
    }

    return evolution;
}

// --------------------------------------------------
// GET PATH PARTS
// 1-Receives a declaration identity.
// 2-Removes the declaration name from the identity.
// 3-Splits the remaining file path into parts.
// 4-Removes "src" when it is part of the path.
// 5-Uses the directory as the temporary category.
// 6-Uses the file name as the temporary subcategory.
// 7-Returns the path information.
// --------------------------------------------------

function getPathParts(
    identity
) {
    const declarationPath =
        identity.split(
            "::"
        )[0];

    const pathParts =
        declarationPath.split(
            "/"
        );

    const fileName =
        pathParts.pop();

    const filteredParts =
        pathParts.filter(
            part =>
                part !== "src"
        );

    const category =
        filteredParts.length > 0
            ? filteredParts[
                filteredParts.length - 1
            ]
            : fileName;

    return {
        category,
        subcategory: fileName
    };
}


// --------------------------------------------------
// FORMAT EVENT DELTA
// 1-Receives an evolution node.
// 2-Checks whether the node contains a delta.
// 3-Formats changed properties for Markdown.
// 4-Returns an empty string when no delta exists.
// --------------------------------------------------

function formatEventDelta(
    node
) {
    if (
        !node.delta ||
        Object.keys(
            node.delta
        ).length === 0
    ) {
        return "";
    }

    const parts = [];

    for (
        const [
            property,
            change
        ]
        of Object.entries(
            node.delta
        )
    ) {
        if (
            Array.isArray(change) &&
            change.length === 2
        ) {
            parts.push(
                `${property} ${JSON.stringify(change[0])} → ${JSON.stringify(change[1])}`
            );

            continue;
        }

        parts.push(
            `${property} ${JSON.stringify(change)}`
        );
    }

    return parts.join(
        ", "
    );
}


// --------------------------------------------------
// GET NODE CHILDREN
// 1-Receives the evolution nodes.
// 2-Receives the parent node ID.
// 3-Finds every node whose parent matches the ID.
// 4-Sorts children by timestamp.
// 5-Returns the child nodes.
// --------------------------------------------------

function getNodeChildren(
    nodes,
    parentId
) {
    return nodes
        .filter(
            node =>
                node.parent === parentId
        )
        .sort(
            (
                left,
                right
            ) =>
                new Date(
                    left.ts
                ).getTime() -
                new Date(
                    right.ts
                ).getTime()
        );
}


// --------------------------------------------------
// FORMAT EVOLUTION NODE
// 1-Receives an evolution node.
// 2-Receives the indentation depth.
// 3-Formats the event type.
// 4-Formats the declaration identity.
// 5-Adds the property delta when available.
// 6-Returns the Markdown line.
// --------------------------------------------------

function formatEvolutionNode(
    node,
    depth
) {
    const prefix =
        "  ".repeat(
            depth
        );

    const eventSymbol =
        node.type === "added"
            ? "+"
            : node.type === "changed"
                ? "~"
                : node.type === "deleted"
                    ? "-"
                    : node.type;

    const delta =
        formatEventDelta(
            node
        );

    const deltaText =
        delta
            ? `   ${delta}`
            : "";

    return (
        `${prefix}- ${eventSymbol} ${node.identity}${deltaText}`
    );
}


// --------------------------------------------------
// RENDER NODE TREE
// 1-Receives all evolution nodes.
// 2-Receives the current parent ID.
// 3-Receives the Markdown output array.
// 4-Finds all children of the current parent.
// 5-Writes each child.
// 6-Recursively writes descendants.
// --------------------------------------------------

function renderNodeTree(
    nodes,
    parentId,
    output,
    depth
) {
    const children =
        getNodeChildren(
            nodes,
            parentId
        );

    for (
        const node
        of children
    ) {
        output.push(
            formatEvolutionNode(
                node,
                depth
            )
        );

        renderNodeTree(
            nodes,
            node.id,
            output,
            depth + 1
        );
    }
}


// --------------------------------------------------
// RENDER EVOLUTION MARKDOWN
// 1-Receives the persisted evolution data.
// 2-Groups nodes by temporary path category.
// 3-Groups nodes inside each category by file.
// 4-Renders root nodes first.
// 5-Renders changed/deleted descendants underneath
//    their parent nodes.
// 6-Uses raw identities because the LLM has not been
//    introduced yet.
// 7-Returns the complete Markdown document.
// --------------------------------------------------

export function renderEvolutionMarkdown(
    evolution
) {
    const nodes =
        evolution.nodes || [];

    if (
        nodes.length === 0
    ) {
        return (
            "# Evolution\n\n" +
            "No evolution events found.\n"
        );
    }

    const groups =
        new Map();

    for (
        const node
        of nodes
    ) {
        const pathParts =
            getPathParts(
                node.identity
            );

        if (
            !groups.has(
                pathParts.category
            )
        ) {
            groups.set(
                pathParts.category,
                new Map()
            );
        }

        const files =
            groups.get(
                pathParts.category
            );

        if (
            !files.has(
                pathParts.subcategory
            )
        ) {
            files.set(
                pathParts.subcategory,
                []
            );
        }

        files.get(
            pathParts.subcategory
        ).push(
            node
        );
    }

    const output = [];

    output.push(
        "# Evolution"
    );

    output.push("");

    const categories =
        [...groups.keys()].sort();

    for (
        const category
        of categories
    ) {
        output.push(
            `## ${category}`
        );

        output.push("");

        const files =
            groups.get(
                category
            );

        const fileNames =
            [...files.keys()].sort();

        for (
            const fileName
            of fileNames
        ) {
            output.push(
                `### ${fileName}`
            );

            output.push("");

            const fileNodes =
                files.get(
                    fileName
                );

            const fileNodeIds =
                new Set(
                    fileNodes.map(
                        node =>
                            node.id
                    )
                );

            const rootNodes =
                fileNodes.filter(
                    node =>
                        !node.parent ||
                        !fileNodeIds.has(
                            node.parent
                        )
                );

            const sortedRoots =
                [...rootNodes].sort(
                    (
                        left,
                        right
                    ) =>
                        new Date(
                            left.ts
                        ).getTime() -
                        new Date(
                            right.ts
                        ).getTime()
                );

            for (
                const node
                of sortedRoots
            ) {
                output.push(
                    formatEvolutionNode(
                        node,
                        0
                    )
                );

                renderNodeTree(
                    fileNodes,
                    node.id,
                    output,
                    1
                );
            }

            output.push("");
        }
    }

    return (
        output.join(
            "\n"
        ).trimEnd() +
        "\n"
    );
}
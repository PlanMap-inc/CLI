import {
    buildLineage
} from "./events.js";

import {
    createEventKey,
    createNodeId
} from "./storage.js";


// --------------------------------------------------
// UPDATE EVOLUTION
// --------------------------------------------------
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

    // --------------------------------------------------
    // The same event, keyed two ways.
    //
    // An event key is ts|identity|type, and the two writers disagree about
    // the ts: "init" records a declaration that predates PlanMap with
    // 1970-01-01, deliberately, meaning "already there when we started
    // watching", while events.jsonl carries the real scan time. So a later
    // change looked up its parent by exact key and missed every time, and
    // every change to pre-existing code was left an orphan.
    //
    // Identity is what a change actually hangs from, so it is the fallback.
    // Insertion order means the most recent node for an identity wins.
    // --------------------------------------------------

    const nodeIdsByIdentity =
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

        if (
            node.identity
        ) {
            nodeIdsByIdentity.set(
                node.identity,
                node.id
            );
        }
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
                ) ||
                nodeIdsByIdentity.get(
                    lineageNode.parent.identity
                ) ||
                null;
        }

        // Lineage is built from the events being added, and the "added"
        // that a change descends from was stored on an earlier run, so it
        // is usually not in that list at all - leaving every change to
        // existing code parentless, and the outline flat.
        //
        // A change hangs from whatever node already stands for that
        // declaration.
        if (
            !parentId &&
            event.type !== "added" &&
            event.identity
        ) {
            parentId =
                nodeIdsByIdentity.get(
                    event.identity
                ) || null;
        }

        const nodeId =
            createNodeId(
                nextNodeNumber
            );

        const node = {
            id: nodeId,

            identity:
                event.identity,

            type:
                event.type,

            parent:
                parentId,

            ts:
                event.ts,

            delta:
                event.delta || {},

            ...(event.origin
                ? {
                    origin:
                        event.origin
                }
                : {})
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

        if (
            event.identity
        ) {
            nodeIdsByIdentity.set(
                event.identity,
                nodeId
            );
        }

        nextNodeNumber++;
    }

    return evolution;
}
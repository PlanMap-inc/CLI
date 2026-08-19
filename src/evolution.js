import {
    buildLineage
} from "./evolution/events.js";

import {
    createEventKey,
    createNodeId
} from "./evolution/storage.js";


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

            identity:
                event.identity,

            type:
                event.type,

            parent:
                parentId,

            ts:
                event.ts,

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
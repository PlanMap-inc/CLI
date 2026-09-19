import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BEHAVIOUR_LINE } from "../../src/llm/behaviour.js";
import { buildEvolutionPrompt } from "../../src/llm/prompts.js";
import { dropRepeatedReadings } from "../../src/plan/draft.js";

// --------------------------------------------------
// THE BEHAVIOUR LINE REACHES EVERY GENERATED LINE
// --------------------------------------------------
// Titles, readings and outline labels are three surfaces that drifted apart
// once: the title rules had a ban list, readings had none, and readings were
// where "Process the send" and "Handle the saving" came from. One standard
// now covers all three, and this checks it still reaches all three.
// --------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
const draft = fs.readFileSync(path.join(root, "src", "plan", "draft.js"), "utf8");

// The standard states the shape and names the failure it exists to stop.
for (const required of ["VERB + OBJECT", "FORBIDDEN OPENINGS", "Process the send", "Handle the saving"]) {
    assert.ok(BEHAVIOUR_LINE.includes(required), `the standard no longer states: ${required}`);
}

// Titles, readings and greenfield all pull in the same text, not their own.
const uses = draft.split("${BEHAVIOUR_LINE}").length - 1;
assert.equal(uses, 2, "the brownfield and greenfield prompts must both carry the standard");
assert.ok(
    buildEvolutionPrompt([], [], [], 5).includes("VERB + OBJECT"),
    "the evolution prompt no longer carries the standard"
);

// --------------------------------------------------
// EXAMPLES MUST NOT BE IN A DOMAIN PLANMAP IS POINTED AT
// --------------------------------------------------
// Ten of sixty-six lines in one real draft were sentences copied verbatim
// out of the prompt, because the examples were written in the same domain as
// the project being analysed. They are parcel-delivery examples now, and a
// survey or auth example creeping back in brings the copying back with it.
// --------------------------------------------------

for (const leak of ["survey", "JWT", "session token", "sign-in button", "question"]) {
    assert.ok(
        !BEHAVIOUR_LINE.toLowerCase().includes(leak.toLowerCase()),
        `the standard teaches with a "${leak}" example; use a domain PlanMap is not pointed at`
    );
}

// --------------------------------------------------
// A READING IS NEVER USED TWICE
// --------------------------------------------------
// A prompt cannot hold a uniqueness constraint over a whole response. On a
// bad run one lens falls into a stock phrase and repeats it across a dozen
// nodes, which is exactly what makes distinct steps look like one node
// drawn over and over. The first node to use a line keeps it.
// --------------------------------------------------

assert.ok(
    draft.includes("dropRepeatedReadings(\n            linked,"),
    "dropRepeatedReadings must run over the whole plan, after the batches are linked"
);

const dedupe = nodes => dropRepeatedReadings(nodes, []);

const deduped = dedupe([
    { id: "a", readings: { database: "Nothing is read or written", backend: "Answer 200 on a booking" } },
    { id: "b", readings: { database: "Nothing is read or written.", backend: "Insert one row per parcel" } },
    { id: "c", readings: { database: "nothing is read or written", backend: "Answer 200 on a booking" } },
    { id: "d", title: "Handle the booking", readings: { backend: "Process the dispatch", security: "Reject a booking with no address" } }
]);

assert.deepEqual(deduped[0].readings, { database: "Nothing is read or written", backend: "Answer 200 on a booking" });
assert.deepEqual(deduped[1].readings, { backend: "Insert one row per parcel" }, "a repeat differing only by a full stop must still go");
assert.deepEqual(deduped[2].readings, {}, "a repeat differing only by case must still go");

// A placeholder verb costs the reading, not the whole node.
assert.deepEqual(
    deduped[3].readings,
    { security: "Reject a booking with no address" },
    "a reading opening with a placeholder verb must go; the real one must stay"
);

console.log("PASS: behaviour-line-regression");

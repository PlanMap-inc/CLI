import assert from "node:assert/strict";

// The model is never reached. The endpoint is set to the URL the shared
// mock keys on, and the mock is loaded before anything that can fetch.
process.env.PLANMAP_LLM_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
process.env.PLANMAP_LLM_MODEL = "test-model";
process.env.PLANMAP_LLM_API_KEY = "test-key";
process.env.OPENROUTER_API_KEY = "test-key";
process.env.PLANMAP_TEST_RESPONSE = "{}";

await import("../helpers/mock-openrouter.mjs");

const { summariseFeatures, titleSummaries, TITLE_CHUNK } =
    await import("../../src/plan/summarise.js");

const { callOpenRouter } = await import("../../src/plan/draft.js");

// --------------------------------------------------
// NAMING A SUMMARY STEP IS THE ONE PART THAT NEEDS A MODEL
// --------------------------------------------------
// And so it is the one part that must never be trusted. A title that
// names a function, pads with a placeholder verb, or runs to a paragraph
// is worse than the deterministic fallback, because the fallback is at
// least a heading the outline already agreed on.
//
// Every rejection below leaves that fallback in place and says so. None
// of them fails the run: a badly named group is a reporting problem, and
// losing a whole draft over one is not a trade worth making.
// --------------------------------------------------

const identityOf = name => `src/orders.js::${name}:function`;

function drafted(index, name, extra = {}) {
    return {
        id: `plan_${String(index).padStart(4, "0")}`,
        feature: "f1",
        identity: identityOf(name),
        role: "behaviour",
        title: `Record the ${name} entry`,
        intent: `A ${name} entry is written once`,
        step: index,
        path: ["Dispatch"],
        status: "intended",
        origin: "ai_drafted",
        rules: [],
        edgesOut: [],
        ...extra
    };
}

const NAMES = [
    "bookParcel", "weighParcel", "labelParcel", "loadVan", "signHandover",
    "scanBarcode", "routeParcel", "notifyDepot", "closeManifest", "sealVan"
];

// Two eligible steps over a cap of nine, so exactly one group of two
// forms and there is one summary step to name.
function oneSummary(cap = 9) {
    const nodes = NAMES.map((name, at) => drafted(at + 1, name));

    const result = summariseFeatures(
        { version: 1, lenses: [], features: [{ id: "f1", name: "Dispatch" }], nodes },
        { cap }
    );

    assert.equal(result.summaries.length, 1, "the fixture must produce exactly one summary step");

    return result;
}


// --------------------------------------------------
// WHAT THE MODEL ANSWERS IS USED
// --------------------------------------------------

{
    const result = oneSummary();
    const key = result.summaries[0].node.id;

    process.env.PLANMAP_TEST_RESPONSE = JSON.stringify({
        steps: [
            {
                key,
                title: "Seal the van before it leaves",
                intent: "A loaded van is sealed and signed for in one pass."
            }
        ]
    });

    const { fallbacks } = await titleSummaries(result.summaries, { call: callOpenRouter });

    assert.deepEqual(fallbacks, [], `unexpected fallbacks: ${fallbacks.join("; ")}`);
    assert.equal(result.summaries[0].node.title, "Seal the van before it leaves");
    assert.equal(result.summaries[0].node.intent, "A loaded van is sealed and signed for in one pass.");
}


// --------------------------------------------------
// EVERY REJECTION FALLS BACK, AND IS REPORTED
// --------------------------------------------------

// Each takes the summary step being named, so that the function-name
// case can use a name the step really holds.
const rejections = [
    ["an empty title", () => ({ title: "   ", intent: "Something true of the group." }), /empty title/],
    [
        "a title over twelve words",
        () => ({
            title: "Seal the van before it leaves the depot and then also tell the office about it",
            intent: "Something true of the group."
        }),
        /over 12 words/
    ],
    ["a placeholder verb", () => ({ title: "Handle the van sealing", intent: "Something true." }), /placeholder verb/],
    [
        "a function name",
        summary => ({
            title: `Seal the van in ${summary.node.identities[0].split("::")[1].split(":")[0]}`,
            intent: "Something true."
        }),
        /names the function \w+/
    ],
    ["an empty intent", () => ({ title: "Seal the van before it leaves", intent: "  " }), /empty intent/],
    ["no answer at all", null, /did not answer/]
];

for (const [what, build, expected] of rejections) {
    const result = oneSummary();
    const summary = result.summaries[0];
    const answer = build ? build(summary) : null;
    const fallbackTitle = summary.node.title;
    const fallbackIntent = summary.node.intent;

    process.env.PLANMAP_TEST_RESPONSE = JSON.stringify({
        steps: answer ? [{ key: summary.node.id, ...answer }] : []
    });

    const { fallbacks } = await titleSummaries(result.summaries, { call: callOpenRouter });

    assert.equal(fallbacks.length, 1, `${what} must be reported`);
    assert.match(fallbacks[0], expected, `${what}: ${fallbacks[0]}`);
    assert.equal(summary.node.title, fallbackTitle, `${what} must leave the fallback title`);
    assert.equal(summary.node.intent, fallbackIntent, `${what} must leave the fallback intent`);
}


// --------------------------------------------------
// THE FALLBACK ITSELF
// --------------------------------------------------
// The part heading when every member shares one, and an intent that says
// plainly what the step covers.

{
    const result = oneSummary();
    const summary = result.summaries[0];

    assert.equal(summary.node.title, "Dispatch", "every member shares one part, so that names the step");

    assert.match(
        summary.node.intent,
        /^Covers 2 steps: Record the \w+ entry, Record the \w+ entry…$/,
        `unexpected fallback intent: ${summary.node.intent}`
    );
}

// Where the members share no heading, the lead's own title stands in.
// Every step gets a part of its own, so the same-part fold has nothing to
// do and the neighbour fold puts two different parts together.
{
    const nodes = NAMES.map((name, at) =>
        drafted(at + 1, name, { path: [`Part ${at}`] }));

    const result = summariseFeatures(
        { version: 1, lenses: [], features: [{ id: "f1", name: "Dispatch" }], nodes },
        { cap: 9 }
    );

    const summary = result.summaries[0];
    const leadTitle = summary.members[0].title;

    assert.equal(
        summary.node.title,
        leadTitle,
        "with no shared part the lead member's own title is the fallback"
    );
}


// --------------------------------------------------
// A REPLY THAT WILL NOT PARSE
// --------------------------------------------------

{
    const result = oneSummary();
    const fallbackTitle = result.summaries[0].node.title;

    process.env.PLANMAP_TEST_RESPONSE = "this is not JSON at all";

    const { fallbacks } = await titleSummaries(result.summaries, { call: callOpenRouter });

    assert.equal(fallbacks.length, 1, "an unparseable reply falls back rather than throwing");
    assert.equal(result.summaries[0].node.title, fallbackTitle);
}


// --------------------------------------------------
// NO MODEL AT ALL
// --------------------------------------------------
// The cap is deterministic; only the wording ever needs a model. With
// none configured every step keeps its fallback and the run carries on.

{
    const result = oneSummary();
    const fallbackTitle = result.summaries[0].node.title;

    const { fallbacks } = await titleSummaries(result.summaries, { call: null });

    assert.equal(fallbacks.length, 1);
    assert.match(fallbacks[0], /no model configured/);
    assert.equal(result.summaries[0].node.title, fallbackTitle);
}

// And when the key is missing, callOpenRouter refuses before it reaches
// the network - which is the same fallback, reported by its own reason.
{
    const result = oneSummary();

    const had = process.env.OPENROUTER_API_KEY;
    const hadNeutral = process.env.PLANMAP_LLM_API_KEY;

    process.env.OPENROUTER_API_KEY = "";
    process.env.PLANMAP_LLM_API_KEY = "";

    const { fallbacks } = await titleSummaries(result.summaries, { call: callOpenRouter });

    process.env.OPENROUTER_API_KEY = had;
    process.env.PLANMAP_LLM_API_KEY = hadNeutral;

    assert.equal(fallbacks.length, 1);
    assert.match(fallbacks[0], /not configured/);
}


// --------------------------------------------------
// ONE REQUEST PER FIFTEEN STEPS
// --------------------------------------------------

{
    const nodes = Array.from({ length: 80 }, (_, at) =>
        drafted(at + 1, `stepFunction${at}`));

    const result = summariseFeatures(
        { version: 1, lenses: [], features: [{ id: "f1", name: "Dispatch" }], nodes },
        { cap: 20 }
    );

    const sent = [];

    await titleSummaries(result.summaries, {
        call: async prompt => {
            sent.push(prompt);
            return { steps: [] };
        }
    });

    assert.equal(
        sent.length,
        Math.ceil(result.summaries.length / TITLE_CHUNK),
        "the summary steps are named in chunks, not one request each"
    );

    // Never a file and never a line of source: the prompt carries titles,
    // intents and qualified names only.
    for (const prompt of sent) {
        assert.ok(!prompt.includes("src/orders.js"), "a title prompt must not carry file paths");
        assert.ok(prompt.includes("Record the"), "a title prompt carries the member titles");
    }
}

console.log("PASS: summarise-titles");

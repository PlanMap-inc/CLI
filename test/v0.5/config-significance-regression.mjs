import assert from "node:assert/strict";

import {
    analyzeSignificance
} from "../../src/evolution/significance.js";


// --------------------------------------------------
// CUSTOM NOISE PREFIX
// --------------------------------------------------

const customNoiseSession = {
    config: {
        significance: {
            noiseCallPrefixes: [
                "trace."
            ]
        }
    },

    events: [],

    netDelta: {
        "demo::fn:function": {
            calls: {
                before: [
                    "trace.old"
                ],
                after: [
                    "trace.new"
                ],
                eventCount: 1
            }
        }
    }
};

const customNoiseResult =
    analyzeSignificance(
        customNoiseSession
    );

assert.equal(
    customNoiseResult.significant,
    false
);


// --------------------------------------------------
// NON-NOISE CALL REMAINS SIGNIFICANT
// --------------------------------------------------

const realCallSession = {
    config: {
        significance: {
            noiseCallPrefixes: [
                "trace."
            ]
        }
    },

    events: [],

    netDelta: {
        "demo::fn:function": {
            calls: {
                before: [
                    "trace.old"
                ],
                after: [
                    "validate"
                ],
                eventCount: 1
            }
        }
    }
};

const realCallResult =
    analyzeSignificance(
        realCallSession
    );

assert.equal(
    realCallResult.significant,
    true
);

assert.equal(
    realCallResult.reasons.length,
    1
);

console.log(
    "PASS: config significance regression tests"
);

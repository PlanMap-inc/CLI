import assert from "node:assert/strict";
import { analyzeSignificance } from "../../src/evolution/significance.js";

function session(netDelta) {
    return {
        events: [],
        netDelta
    };
}

// Significant numeric change
{
    const result = analyzeSignificance(
        session({
            "demo::fn:function": {
                numbers: {
                    before: [1],
                    after: [2],
                    eventCount: 1
                }
            }
        })
    );

    assert.equal(result.significant, true);
    assert.equal(result.reasons.length, 1);
    assert.equal(result.declarations.length, 1);
    assert.equal(
        result.declarations[0].identity,
        "demo::fn:function"
    );
}

// Insignificant console -> logger change
{
    const result = analyzeSignificance(
        session({
            "demo::fn:function": {
                calls: {
                    before: ["console.log"],
                    after: ["logger.debug"],
                    eventCount: 1
                }
            }
        })
    );

    assert.equal(result.significant, false);
    assert.equal(result.reasons.length, 0);
    assert.equal(result.declarations.length, 0);
}

// Real call change must be significant
{
    const result = analyzeSignificance(
        session({
            "demo::fn:function": {
                calls: {
                    before: ["console.log"],
                    after: ["validate"],
                    eventCount: 1
                }
            }
        })
    );

    assert.equal(result.significant, true);
    assert.equal(result.reasons.length, 1);
    assert.equal(result.declarations.length, 1);
}

// Significant changed declaration must be represented
{
    const result = analyzeSignificance(
        session({
            "demo::fn:function": {
                throws: {
                    before: 0,
                    after: 1,
                    eventCount: 1
                }
            }
        })
    );

    assert.equal(result.significant, true);
    assert.equal(
        result.declarations[0].type,
        "changed"
    );
}

console.log("PASS: significance regression tests");

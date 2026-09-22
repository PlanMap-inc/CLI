import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";


const repoRoot =
    path.resolve(
        path.dirname(
            new URL(
                import.meta.url
            ).pathname
        ),
        "../.."
    );


const projectRoot =
    fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "planmap-status-"
        )
    );


/*
 * ------------------------------------------------------------
 * CREATE MINIMAL PROJECT
 * ------------------------------------------------------------
 */

fs.writeFileSync(
    path.join(
        projectRoot,
        "auth.js"
    ),
    `
export function verifyToken(token) {
    if (!token) {
        throw new Error("Invalid token");
    }

    return true;
}
`,
    "utf8"
);


/*
 * ------------------------------------------------------------
 * OFFLINE, ON EVERY MACHINE
 * ------------------------------------------------------------
 *
 * An empty key alone does not mean offline - it only means
 * "no key for whichever endpoint is configured".
 *
 * This test used to set nothing else, and passed only where
 * something in the environment (a .env beside PlanMap, or a
 * shell) already pointed PLANMAP_LLM_ENDPOINT at a hosted
 * provider. Anywhere without that - CI, a fresh clone - the
 * endpoint fell back to the built-in local default, and the
 * run spent three attempts per batch on an Ollama nobody
 * started before failing.
 *
 * So the endpoint is pinned too, the same way
 * test/helpers/run-cli.mjs pins it: a hosted URL with no key,
 * which is the one combination that means "no model" out loud
 * and never touches the network.
 * ------------------------------------------------------------
 */

const OFFLINE = {
    ...process.env,

    PLANMAP_LLM_ENDPOINT:
        "https://openrouter.ai/api/v1/chat/completions",

    PLANMAP_LLM_API_KEY:
        "",

    OPENROUTER_API_KEY:
        ""
};


/*
 * ------------------------------------------------------------
 * INIT
 * ------------------------------------------------------------
 */

const init =
    spawnSync(
        process.execPath,
        [
            path.join(
                repoRoot,
                "src/cli/cli.js"
            ),
            "init",
            projectRoot
        ],
        {
            encoding:
                "utf8",

            env: OFFLINE
        }
    );


assert.equal(
    init.status,
    0,
    `init failed:\n${init.stdout}\n${init.stderr}`
);


/*
 * ------------------------------------------------------------
 * EVOLUTION
 * ------------------------------------------------------------
 *
 * No API key means deterministic fallback classification.
 * The test therefore exercises the real CLI wiring without
 * making an external request.
 * ------------------------------------------------------------
 */

const evolution =
    spawnSync(
        process.execPath,
        [
            path.join(
                repoRoot,
                "src/cli/cli.js"
            ),
            "evolution",
            projectRoot
        ],
        {
            encoding:
                "utf8",

            env: OFFLINE
        }
    );


assert.equal(
    evolution.status,
    0,
    `evolution failed:\n${evolution.stdout}\n${evolution.stderr}`
);


/*
 * ------------------------------------------------------------
 * READ PERSISTED EVOLUTION
 * ------------------------------------------------------------
 */

const evolutionPath =
    path.join(
        projectRoot,
        ".planmap",
        "evolution.json"
    );


assert.equal(
    fs.existsSync(
        evolutionPath
    ),
    true,
    "evolution.json must be written by the CLI"
);


const storedEvolution =
    JSON.parse(
        fs.readFileSync(
            evolutionPath,
            "utf8"
        )
    );


assert.ok(
    Array.isArray(
        storedEvolution.nodes
    ),
    "evolution.json must contain nodes"
);

assert.ok(
    storedEvolution.nodes.length > 0,
    "CLI evolution run must create at least one node"
);


/*
 * ------------------------------------------------------------
 * STATUS PERSISTENCE
 * ------------------------------------------------------------
 */

for (
    const node
    of storedEvolution.nodes
) {
    assert.equal(
        node.status,
        "implemented",
        `node ${node.identity} must have status=implemented`
    );
}


/*
 * ------------------------------------------------------------
 * RESULT
 * ------------------------------------------------------------
 */

console.log(
    "PASS: evolution status CLI regression"
);

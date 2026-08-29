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
 * INIT
 * ------------------------------------------------------------
 */

const init =
    spawnSync(
        process.execPath,
        [
            path.join(
                repoRoot,
                "src/cli.js"
            ),
            "init",
            projectRoot
        ],
        {
            encoding:
                "utf8",

            env: {
                ...process.env,

                OPENROUTER_API_KEY:
                    ""
            }
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
                "src/cli.js"
            ),
            "evolution",
            projectRoot
        ],
        {
            encoding:
                "utf8",

            env: {
                ...process.env,

                OPENROUTER_API_KEY:
                    ""
            }
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

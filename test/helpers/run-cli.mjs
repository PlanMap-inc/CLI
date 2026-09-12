import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const CLI = path.join(ROOT, "src", "cli", "cli.js");
const MOCK = path.join(
    ROOT,
    "test",
    "helpers",
    "mock-openrouter.mjs"
);

export function runCli(
    args,
    cwd,
    {
        env = {},
        apiKey = "",
        response = null,
        mock = false,
        nodeOptions = []
    } = {}
) {
    const mergedEnv = {
        ...process.env,
        ...env,
        OPENROUTER_API_KEY: apiKey
    };

    if (response !== null) {
        mergedEnv.PLANMAP_TEST_RESPONSE =
            response;
    }

    const options = [...nodeOptions];

    if (mock) {
        options.push(`--import=${MOCK}`);
    }

    if (options.length > 0) {
        mergedEnv.NODE_OPTIONS = [
            mergedEnv.NODE_OPTIONS || "",
            ...options
        ]
            .filter(Boolean)
            .join(" ");
    }

    const result = spawnSync(
        process.execPath,
        [CLI, ...args],
        {
            cwd,
            env: mergedEnv,
            encoding: "utf8"
        }
    );

    return {
        code: result.status,
        stdout: result.stdout || "",
        stderr: result.stderr || ""
    };
}

export { ROOT, CLI };

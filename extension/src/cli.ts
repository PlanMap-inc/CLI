import { spawn } from "child_process";


// --------------------------------------------------
// OUTCOMES
// --------------------------------------------------
// The CLI's exit codes carry meaning:
//   0  success, nothing drifted
//   1  drift or error found - a successful run reporting findings
//   2  nothing to do - no plan, nothing approved, filter matched nothing
// A command that promised JSON but printed none never got as far as
// producing findings (bad path, usage error, crash), so that is "failed".
// --------------------------------------------------

export type CliOutcome = "ok" | "findings" | "nothing" | "failed";

export interface CliResult {
    args: string[];
    code: number | null;
    stdout: string;
    stderr: string;
    json: unknown;
    outcome: CliOutcome;
}

export interface CliRunOptions {
    nodePath: string;
    cliPath: string;
    cwd: string;
    runAsNode: boolean;
    offline?: boolean;
}


export function parseJsonOutput(stdout: string): unknown {
    const text = stdout.trim();

    if (!text.startsWith("{")) {
        return undefined;
    }

    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}


export function classifyOutcome(
    code: number | null,
    expectsJson: boolean,
    json: unknown
): CliOutcome {
    if (code === null) {
        return "failed";
    }

    if (expectsJson && json === undefined) {
        return "failed";
    }

    if (code === 0) {
        return "ok";
    }

    if (code === 1) {
        return "findings";
    }

    if (code === 2) {
        return "nothing";
    }

    return "failed";
}


export function runCli(
    args: string[],
    options: CliRunOptions
): Promise<CliResult> {
    const expectsJson = args.includes("--json");

    const env: Record<string, string | undefined> = { ...process.env };

    if (options.runAsNode) {
        env.ELECTRON_RUN_AS_NODE = "1";
    }

    // An empty key still counts as set, so the CLI's .env loading cannot
    // fill it in: the command classifies offline and makes no LLM request.
    if (options.offline) {
        env.OPENROUTER_API_KEY = "";
    }

    return new Promise(resolve => {
        let stdout = "";
        let stderr = "";

        const child = spawn(
            options.nodePath,
            [options.cliPath, ...args],
            { cwd: options.cwd, env, shell: false }
        );

        child.stdout?.on("data", chunk => {
            stdout += chunk.toString();
        });

        child.stderr?.on("data", chunk => {
            stderr += chunk.toString();
        });

        child.on("error", error => {
            resolve({
                args,
                code: null,
                stdout,
                stderr: stderr + error.message,
                json: undefined,
                outcome: "failed"
            });
        });

        child.on("close", code => {
            const json = expectsJson ? parseJsonOutput(stdout) : undefined;

            resolve({
                args,
                code,
                stdout,
                stderr,
                json,
                outcome: classifyOutcome(code, expectsJson, json)
            });
        });
    });
}

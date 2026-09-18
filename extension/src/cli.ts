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
    apiKey?: string;
    // Extra environment for the CLI, such as which model to use.
    env?: Record<string, string>;
    // Called with each complete line the CLI prints, while it runs.
    onLine?: (line: string) => void;
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

    // A key from VS Code's secret storage is handed to the CLI's environment.
    // Without one, the CLI does its own lookup (environment, then the project's
    // .env). An empty string still counts as set, so it forces no LLM request.
    if (typeof options.apiKey === "string") {
        env.OPENROUTER_API_KEY = options.apiKey;
    }

    for (const [name, value] of Object.entries(options.env ?? {})) {
        if (value) env[name] = value;
    }

    return new Promise(resolve => {
        let stdout = "";
        let stderr = "";
        // One buffer per stream: stdout and stderr interleave, and a half
        // written line from one must never be joined to the other.
        const pending = { stdout: "", stderr: "" };

        // The CLI reports progress as it goes; hand over whole lines only.
        const emit = (stream: "stdout" | "stderr", chunk: string) => {
            if (!options.onLine) return;

            pending[stream] += chunk;
            const lines = pending[stream].split("\n");
            pending[stream] = lines.pop() ?? "";

            for (const line of lines) {
                if (line.trim()) options.onLine(line.trimEnd());
            }
        };

        const flush = () => {
            for (const stream of ["stdout", "stderr"] as const) {
                const rest = pending[stream];
                pending[stream] = "";
                if (rest.trim() && options.onLine) options.onLine(rest.trimEnd());
            }
        };

        const child = spawn(
            options.nodePath,
            [options.cliPath, ...args],
            { cwd: options.cwd, env, shell: false }
        );

        child.stdout?.on("data", chunk => {
            const text = chunk.toString();
            stdout += text;
            emit("stdout", text);
        });

        child.stderr?.on("data", chunk => {
            const text = chunk.toString();
            stderr += text;
            emit("stderr", text);
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
            flush();

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

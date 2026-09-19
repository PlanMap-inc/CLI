import type { CliOutcome } from "./cli";


// --------------------------------------------------
// WEBVIEW -> HOST
// --------------------------------------------------
// "ready" asks for state. Every other message is a mutation or a
// CLI-backed read, and maps to exactly one CLI invocation. The webview
// never writes .planmap/ itself - the host runs the CLI and re-reads.
// --------------------------------------------------

export type WebviewMessage =
    | { type: "ready" }
    | { type: "init" }
    | { type: "verify" }
    // approve and reject take a plan node id (the CLI matches id or identity);
    // revise takes the identity, the only thing "plan revise" matches.
    | { type: "approve"; target: string }
    | { type: "approveLens"; lensId: string }
    | { type: "reject"; target: string; force: boolean }
    | { type: "revise"; identity: string }
    | { type: "evolution" }
    | { type: "draftPlan" }
    | { type: "openPlan" }
    | { type: "setApiKey" }
    | { type: "openFolder" };

export const WEBVIEW_MESSAGE_TYPES: readonly WebviewMessage["type"][] = [
    "ready",
    "init",
    "verify",
    "approve",
    "approveLens",
    "reject",
    "revise",
    "evolution",
    "draftPlan",
    "openPlan",
    "setApiKey",
    "openFolder"
];


// --------------------------------------------------
// HOST -> WEBVIEW
// --------------------------------------------------

export type SetupState = "missing" | "no-plan" | "invalid-plan" | "ready";

// Where the CLI will get an OpenRouter key from. The key itself never leaves the host.
export type ApiKeySource = "local" | "stored" | "environment" | "project" | null;

export interface VerifiedStatus {
    status: string;
    verifiedAgainst: string;
    ts: string;
}

export interface ViewState {
    projectName: string;
    setup: SetupState;
    plan: unknown;
    verifiedStatus: Record<string, VerifiedStatus>;
    problem: string | null;
    // evolution.json as the CLI wrote it, or null when there is none yet.
    evolution: unknown;
    // baseline.json declarations.length, or null before the first scan.
    declarationCount: number | null;
    aiKey: ApiKeySource;
    // Evolution node ids the last refresh added. Empty on a plain re-read,
    // so a node is marked as new only by a run that actually brought it in.
    arrivals?: string[];
    // What the last refresh's scan found in the code, from "check --json".
    // Present only after a refresh, and zeroed counts are meaningful: they
    // say the code has not moved since the last scan.
    scan?: ScanSummary;
    // The code has moved on and the outline has not caught up yet. Set by
    // the source watcher, cleared by the refresh that folds the changes in.
    pendingScan?: boolean;
}

// What one "check" run found. Mirrors the CLI's own summary block.
export interface ScanSummary {
    changes: number;
    added: number;
    deleted: number;
    significant: number;
    // Declarations whose facts moved: changes that are neither new nor gone.
    changed: number;
}

// The CLI's summary, or null when the output was not the shape we expect.
export function readScanSummary(json: unknown): ScanSummary | null {
    const summary = (json as { summary?: unknown } | null)?.summary;
    if (!summary || typeof summary !== "object") return null;

    const count = (key: string) => {
        const value = (summary as Record<string, unknown>)[key];
        return typeof value === "number" && Number.isFinite(value) ? value : 0;
    };

    const changes = count("changes");
    const added = count("added");
    const deleted = count("deleted");

    return {
        changes,
        added,
        deleted,
        significant: count("significant"),
        changed: Math.max(0, changes - added - deleted)
    };
}

export type HostMessage =
    | { type: "state"; state: ViewState }
    | {
        type: "cliResult";
        requestType: WebviewMessage["type"];
        outcome: CliOutcome;
        code: number | null;
        json: unknown;
        stdout: string;
        stderr: string;
    }
    // A line the CLI printed while it was still running.
    | { type: "progress"; requestType: WebviewMessage["type"]; line: string }
    // The user dismissed a confirmation dialog; no CLI call was made.
    | { type: "cancelled"; requestType: WebviewMessage["type"] };


// --------------------------------------------------
// MESSAGE -> CLI ARGUMENTS
// --------------------------------------------------

export function buildCliArgs(
    message: WebviewMessage,
    projectRoot: string
): string[] | null {
    switch (message.type) {
        case "ready":
            return null;
        case "init":
            return ["init", projectRoot];
        case "verify":
            return ["verify", projectRoot, "--json"];
        case "approve":
            return ["approve", projectRoot, message.target];
        case "approveLens":
            return ["approve", projectRoot, "--lens", message.lensId];
        case "reject":
            return message.force
                ? ["reject", projectRoot, message.target, "--force"]
                : ["reject", projectRoot, message.target];
        case "revise":
            return ["plan", "revise", projectRoot, message.identity];
        case "evolution":
            return ["evolution", projectRoot];
        case "draftPlan":
            return ["plan", "draft", projectRoot];
        case "openPlan":
            // Not a CLI call and not a write: the host opens an unsaved
            // editor at .planmap/plan.json, and the file exists once the user saves.
            return null;
        case "setApiKey":
            // Not a CLI call: the host asks for the key and keeps it in secret storage.
            return null;
        case "openFolder":
            // Not a CLI call: the host shows VS Code's folder picker and reopens the window there.
            return null;
    }
}

// --------------------------------------------------
// CLI STEPS
// --------------------------------------------------
// Most actions are one command. Refreshing evolution is two, and running
// only the second is why new code never appeared in the outline:
//
//   check      reads the code, compares it with the baseline, and records
//              what was added, changed or deleted as durable events
//   evolution  turns those events into the outline
//
// "evolution" alone re-reads events nobody has written to since the last
// scan, so it faithfully rebuilds the same graph every time.
// --------------------------------------------------

export function buildCliSteps(message: WebviewMessage, projectRoot: string): string[][] {
    if (message.type === "evolution") {
        return [
            // --json so the view can say what the scan found, including
            // that it found nothing: a refresh that silently rebuilds the
            // same outline is indistinguishable from one that is broken.
            ["check", projectRoot, "--json"],
            ["evolution", projectRoot]
        ];
    }

    const args = buildCliArgs(message, projectRoot);
    return args ? [args] : [];
}

// Values that become CLI arguments. A value starting with "-" would be read
// as a flag (think "--all"), so it is refused rather than passed through.
const ARGUMENT_FIELDS: Partial<Record<WebviewMessage["type"], string[]>> = {
    approve: ["target"],
    approveLens: ["lensId"],
    reject: ["target"],
    revise: ["identity"]
};


export function isWebviewMessage(value: unknown): value is WebviewMessage {
    if (!value || typeof value !== "object") {
        return false;
    }

    const type = (value as { type?: unknown }).type;

    if (
        typeof type !== "string" ||
        !(WEBVIEW_MESSAGE_TYPES as readonly string[]).includes(type)
    ) {
        return false;
    }

    const fields = ARGUMENT_FIELDS[type as WebviewMessage["type"]] ?? [];
    const record = value as Record<string, unknown>;

    return fields.every(field => {
        const argument = record[field];
        return typeof argument === "string" && argument.length > 0 && !argument.startsWith("-");
    });
}

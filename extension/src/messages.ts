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
    | { type: "approve"; identity: string }
    | { type: "approveLens"; lensId: string }
    | { type: "reject"; identity: string; force: boolean }
    | { type: "revise"; identity: string }
    | { type: "evolution" };

export const WEBVIEW_MESSAGE_TYPES: readonly WebviewMessage["type"][] = [
    "ready",
    "init",
    "verify",
    "approve",
    "approveLens",
    "reject",
    "revise",
    "evolution"
];


// --------------------------------------------------
// HOST -> WEBVIEW
// --------------------------------------------------

export type SetupState = "missing" | "no-plan" | "invalid-plan" | "ready";

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
}

export type HostMessage =
    | { type: "state"; state: ViewState }
    | {
        type: "cliResult";
        requestType: WebviewMessage["type"];
        outcome: CliOutcome;
        code: number | null;
        json: unknown;
        stderr: string;
    };


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
            return ["approve", projectRoot, message.identity];
        case "approveLens":
            return ["approve", projectRoot, "--lens", message.lensId];
        case "reject":
            return message.force
                ? ["reject", projectRoot, message.identity, "--force"]
                : ["reject", projectRoot, message.identity];
        case "revise":
            return ["plan", "revise", projectRoot, message.identity];
        case "evolution":
            return ["evolution", projectRoot];
    }
}


export function isWebviewMessage(value: unknown): value is WebviewMessage {
    if (!value || typeof value !== "object") {
        return false;
    }

    const type = (value as { type?: unknown }).type;

    return (
        typeof type === "string" &&
        (WEBVIEW_MESSAGE_TYPES as readonly string[]).includes(type)
    );
}

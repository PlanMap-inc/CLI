import * as path from "path";
import { readFile, stat } from "fs/promises";

import type { ViewState } from "./messages";


// --------------------------------------------------
// READ-ONLY STATE
// --------------------------------------------------
// Reads plan.json and evolution.json. Never writes them: every mutation
// goes through the CLI, and the watcher triggers a re-read. No vscode
// import, so this is testable in plain Node.
// --------------------------------------------------

async function isDirectory(target: string): Promise<boolean> {
    try {
        return (await stat(target)).isDirectory();
    } catch {
        return false;
    }
}

async function readJson(target: string): Promise<
    { ok: true; value: unknown } | { ok: false; missing: boolean; message: string }
> {
    let text: string;

    try {
        text = await readFile(target, "utf8");
    } catch (error) {
        const code = (error as { code?: string }).code;
        return { ok: false, missing: code === "ENOENT", message: String(error) };
    }

    try {
        return { ok: true, value: JSON.parse(text) };
    } catch (error) {
        return { ok: false, missing: false, message: (error as Error).message };
    }
}

// The CLI silently treats an invalid plan.json as an empty plan. Surface the
// problem instead of showing an empty map.
export function planShapeProblem(plan: unknown): string | null {
    if (!plan || typeof plan !== "object") return "plan.json is not a JSON object.";
    const p = plan as Record<string, unknown>;
    if (p.version !== 1) return "plan.json version must be 1.";
    for (const key of ["lenses", "features", "nodes"]) {
        if (!Array.isArray(p[key])) return `plan.json "${key}" must be an array.`;
    }
    return null;
}

// The latest verify-sourced status per identity. Statuses the evolution
// command derived on its own are not verification and are ignored.
export function latestVerifiedStatus(evolution: unknown): ViewState["verifiedStatus"] {
    const result: ViewState["verifiedStatus"] = {};
    const nodes = (evolution as { nodes?: unknown[] } | null)?.nodes;

    if (!Array.isArray(nodes)) return result;

    for (const raw of nodes) {
        const node = raw as Record<string, unknown>;

        if (
            node.statusSource !== "verified" ||
            typeof node.identity !== "string" ||
            typeof node.status !== "string" ||
            node.status === "superseded"
        ) {
            continue;
        }

        const ts = String(node.ts ?? "");
        const existing = result[node.identity];

        if (!existing || ts >= existing.ts) {
            result[node.identity] = {
                status: node.status,
                verifiedAgainst: String(node.verifiedAgainst ?? ""),
                ts
            };
        }
    }

    return result;
}

// Where the CLI will find an OpenRouter key without one from the extension,
// mirroring src/llm/config.js: the environment first, then the project's
// .env. Reports only the source - the key is never returned.
export async function detectApiKeySource(
    projectRoot: string,
    env: Record<string, string | undefined>
): Promise<"environment" | "project" | null> {
    if (env.OPENROUTER_API_KEY?.trim()) return "environment";

    let text: string;

    try {
        text = await readFile(path.join(projectRoot, ".env"), "utf8");
    } catch {
        return null;
    }

    const found = text.split(/\r?\n/).some(line => {
        const trimmed = line.trim();
        return (
            trimmed.startsWith("OPENROUTER_API_KEY=") &&
            trimmed.slice("OPENROUTER_API_KEY=".length).trim().replace(/^["']|["']$/g, "").length > 0
        );
    });

    return found ? "project" : null;
}

// The CLI reads a plan that fails its own validation as an empty plan, so every
// command would see no nodes while the map still drew them. "plan validate"
// reports those errors, and the map shows them instead. A CLI without the
// command (outcome "failed") leaves the state as read.
export function applyPlanValidation(
    state: ViewState,
    check: { outcome: string; json: unknown }
): ViewState {
    const errors = (check.json as { errors?: unknown } | null | undefined)?.errors;

    if (state.setup !== "ready" || check.outcome !== "findings" || !Array.isArray(errors) || errors.length === 0) {
        return state;
    }

    return {
        ...state,
        setup: "invalid-plan",
        plan: null,
        problem: `The PlanMap CLI can't use this plan.json, so every command would treat the plan as empty:\n${errors.map(error => `- ${String(error)}`).join("\n")}`
    };
}

// The folder PlanMap asked VS Code to open. PlanMap opens by itself only in
// that folder and only right after the switch, not whenever it is opened later.
export const OPEN_ON_START_WINDOW_MS = 2 * 60 * 1000;

export function pendingProjectMatches(pending: unknown, folderPath: string | undefined, now: number): boolean {
    const request = pending as { path?: unknown; at?: unknown } | null | undefined;
    const age = typeof request?.at === "number" ? now - request.at : -1;

    return (
        typeof folderPath === "string" &&
        typeof request?.path === "string" &&
        request.path === folderPath &&
        age >= 0 &&
        age <= OPEN_ON_START_WINDOW_MS
    );
}

export function declarationCount(baseline: unknown): number | null {
    const declarations = (baseline as { declarations?: unknown } | null)?.declarations;
    return Array.isArray(declarations) ? declarations.length : null;
}

export async function readViewState(projectRoot: string): Promise<ViewState> {
    const projectName = path.basename(projectRoot);
    const planmapDir = path.join(projectRoot, ".planmap");
    // aiKey is filled in by the host, which alone can see secret storage.
    const base = { projectName, plan: null, verifiedStatus: {}, problem: null, evolution: null, declarationCount: null, aiKey: null };

    if (!(await isDirectory(planmapDir))) {
        return { ...base, setup: "missing" };
    }

    // A scan produces evolution and the declaration count before any plan exists.
    const [evolution, baseline] = await Promise.all([
        readJson(path.join(planmapDir, "evolution.json")),
        readJson(path.join(planmapDir, "baseline.json"))
    ]);

    const evolutionNodes = evolution.ok ? (evolution.value as { nodes?: unknown } | null)?.nodes : undefined;

    const scanned = {
        ...base,
        evolution: evolution.ok && Array.isArray(evolutionNodes) ? evolution.value : null,
        verifiedStatus: evolution.ok ? latestVerifiedStatus(evolution.value) : {},
        declarationCount: baseline.ok ? declarationCount(baseline.value) : null
    };

    const plan = await readJson(path.join(planmapDir, "plan.json"));

    if (!plan.ok) {
        return plan.missing
            ? { ...scanned, setup: "no-plan" }
            : { ...scanned, setup: "invalid-plan", problem: `plan.json could not be read: ${plan.message}` };
    }

    const shapeProblem = planShapeProblem(plan.value);

    if (shapeProblem) {
        return { ...scanned, setup: "invalid-plan", problem: shapeProblem };
    }

    return { ...scanned, setup: "ready", plan: plan.value };
}

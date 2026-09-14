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

export async function readViewState(projectRoot: string): Promise<ViewState> {
    const projectName = path.basename(projectRoot);
    const planmapDir = path.join(projectRoot, ".planmap");
    const base = { projectName, plan: null, verifiedStatus: {}, problem: null };

    if (!(await isDirectory(planmapDir))) {
        return { ...base, setup: "missing" };
    }

    const plan = await readJson(path.join(planmapDir, "plan.json"));

    if (!plan.ok) {
        return plan.missing
            ? { ...base, setup: "no-plan" }
            : { ...base, setup: "invalid-plan", problem: `plan.json could not be read: ${plan.message}` };
    }

    const shapeProblem = planShapeProblem(plan.value);

    if (shapeProblem) {
        return { ...base, setup: "invalid-plan", problem: shapeProblem };
    }

    const evolution = await readJson(path.join(planmapDir, "evolution.json"));

    return {
        ...base,
        setup: "ready",
        plan: plan.value,
        verifiedStatus: evolution.ok ? latestVerifiedStatus(evolution.value) : {}
    };
}

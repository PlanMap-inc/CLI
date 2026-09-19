import * as vscode from "vscode";
import * as path from "path";
import { readFile } from "fs/promises";

import { runCli } from "./cli";
import {
    buildCliSteps,
    isWebviewMessage,
    readScanSummary,
    type ScanSummary,
    type HostMessage,
    type WebviewMessage
} from "./messages";
import { applyPlanValidation, detectApiKeySource, evolutionNodeIds, pendingProjectMatches, readViewState, sinceRefresh } from "./state";
import { watchPlanmap, watchSources } from "./watcher";

const PLAN_SKELETON = '{ "version": 1, "lenses": [], "features": [], "nodes": [] }\n';

// The OpenRouter key lives in VS Code's secret storage (the OS keychain). It is
// handed to the CLI's environment and never sent to the webview, logged, or
// put in a file.
const API_KEY_SECRET = "planmap.openRouterApiKey";

// Set just before PlanMap asks VS Code to reopen the window on another folder,
// so PlanMap opens by itself once that folder has loaded.
const OPEN_ON_START = "planmap.openOnStart";


export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand("planmap.open", () => {
            PlanMapPanel.show(context);
        }),
        vscode.commands.registerCommand("planmap.openProjectFolder", () => openProjectFolder(context)),
        vscode.commands.registerCommand("planmap.setApiKey", () => setApiKey(context)),
        vscode.commands.registerCommand("planmap.clearApiKey", () => clearApiKey(context)),
        context.secrets.onDidChange(event => {
            if (event.key === API_KEY_SECRET) PlanMapPanel.refresh();
        })
    );

    const pending = context.globalState.get(OPEN_ON_START);

    if (pending !== undefined) {
        void context.globalState.update(OPEN_ON_START, undefined);

        if (pendingProjectMatches(pending, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath, Date.now())) {
            PlanMapPanel.show(context);
        }
    }
}

export function deactivate() {}


// --------------------------------------------------
// PROJECT FOLDER
// --------------------------------------------------

// Like File > Open Folder: VS Code reloads this window on the chosen folder,
// and PlanMap reopens there on its own (see activate).
async function openProjectFolder(context: vscode.ExtensionContext) {
    const current = vscode.workspace.workspaceFolders?.[0]?.uri;

    const picked = await vscode.window.showOpenDialog({
        title: "Open a project folder with PlanMap",
        openLabel: "Open with PlanMap",
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        defaultUri: current
    });

    const folder = picked?.[0];
    if (!folder) return;

    if (current && folder.fsPath === current.fsPath) {
        PlanMapPanel.show(context);
        return;
    }

    await context.globalState.update(OPEN_ON_START, { path: folder.fsPath, at: Date.now() });
    await vscode.commands.executeCommand("vscode.openFolder", folder, { forceNewWindow: false });
}


// --------------------------------------------------
// API KEY
// --------------------------------------------------

async function setApiKey(context: vscode.ExtensionContext) {
    const key = await vscode.window.showInputBox({
        title: "OpenRouter API key",
        prompt: "PlanMap uses it to group your code into features and to draft plans. It is kept in your system keychain.",
        password: true,
        ignoreFocusOut: true,
        validateInput: value => (value.trim() ? null : "Enter a key, or press Escape to cancel.")
    });

    if (!key?.trim()) return;

    await context.secrets.store(API_KEY_SECRET, key.trim());
    void vscode.window.showInformationMessage("PlanMap will use this OpenRouter key.");
}

async function clearApiKey(context: vscode.ExtensionContext) {
    await context.secrets.delete(API_KEY_SECRET);
    void vscode.window.showInformationMessage("PlanMap no longer has a stored OpenRouter key.");
}


// --------------------------------------------------
// PANEL
// --------------------------------------------------

class PlanMapPanel {
    private static current: PlanMapPanel | undefined;

    private readonly disposables: vscode.Disposable[] = [];
    private readonly panel: vscode.WebviewPanel;

    // Ids the last refresh added to the outline, so the view can point at
    // them. Cleared once the user has been shown them.
    private arrivals: string[] = [];

    // What the last refresh's scan found in the code. Kept so a plain
    // re-read does not wipe the report the user is still looking at.
    private scan: ScanSummary | undefined;

    // True while the code has moved on and the outline has not caught up.
    private pendingScan = false;

    // One check at a time: saves come in bursts and a scan reads every file.
    private scanning = false;

    static show(context: vscode.ExtensionContext) {
        const folder = vscode.workspace.workspaceFolders?.[0];

        if (!folder) {
            void vscode.window
                .showInformationMessage("Open a project folder to see its PlanMap.", "Open Folder…")
                .then(choice => {
                    if (choice) void openProjectFolder(context);
                });
            return;
        }

        if (PlanMapPanel.current) {
            PlanMapPanel.current.panel.reveal();
            return;
        }

        PlanMapPanel.current = new PlanMapPanel(context, folder.uri.fsPath);
    }

    static refresh() {
        void PlanMapPanel.current?.postState();
    }

    private constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly projectRoot: string
    ) {
        const webviewRoot = vscode.Uri.file(path.join(context.extensionPath, "webview"));

        this.panel = vscode.window.createWebviewPanel(
            "planmap",
            `Plan Graph — ${path.basename(projectRoot)}`,
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [webviewRoot]
            }
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            message => this.onMessage(message),
            null,
            this.disposables
        );

        this.disposables.push(watchPlanmap(projectRoot, () => this.postState()));

        // Your code, watched continuously. "check" is local and cheap, so
        // detection is free and automatic; turning what it finds into the
        // outline calls a model, so that stays on the Refresh button where
        // you can see it coming.
        this.disposables.push(watchSources(projectRoot, () => this.rescan()));

        void this.render(webviewRoot);
    }

    private async render(webviewRoot: vscode.Uri) {
        const webview = this.panel.webview;
        const nonce = makeNonce();
        const asUri = (file: string) =>
            webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, file)).toString();

        const template = await readFile(
            path.join(this.context.extensionPath, "webview", "index.html"),
            "utf8"
        );

        webview.html = template
            .split("{{cspSource}}").join(webview.cspSource)
            .split("{{nonce}}").join(nonce)
            .split("{{stylesUri}}").join(asUri("styles.css"))
            .split("{{mainUri}}").join(asUri("main.js"));
    }

    private async postState() {
        const [read, stored] = await Promise.all([
            readViewState(this.projectRoot),
            this.context.secrets.get(API_KEY_SECRET)
        ]);

        // A plan the CLI would treat as empty is shown as invalid, with the CLI's own reasons.
        const state = read.setup === "ready"
            ? applyPlanValidation(read, await runCli(["plan", "validate", this.projectRoot, "--json"], this.cliOptions()))
            : read;

        // A local model needs no key at all, and is the CLI's default.
        const endpoint =
            vscode.workspace.getConfiguration("planmap").get<string>("llmEndpoint")?.trim() ||
            "http://localhost:11434/v1/chat/completions";

        const aiKey = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(endpoint)
            ? "local"
            : stored ? "stored" : await detectApiKeySource(this.projectRoot, process.env);

        this.post({ type: "state", state: { ...state, aiKey, arrivals: this.arrivals, scan: this.scan, pendingScan: this.pendingScan } });
    }

    // What the code looks like now, against the last scan. Runs on every
    // save, so it must never touch a model and never write anything: the
    // only thing it changes is what the view is able to tell you.
    private async rescan() {
        if (this.scanning) return;
        this.scanning = true;

        try {
            const result = await runCli(
                ["check", this.projectRoot, "--json"],
                this.cliOptions()
            );

            if (result.outcome === "failed") return;

            const summary = readScanSummary(result.json);
            if (!summary) return;

            // Only speak up when something is actually waiting. A quiet
            // save should stay quiet.
            if (summary.changes === 0 && !this.scan) return;

            this.scan = summary;
            this.pendingScan = summary.changes > 0;
            await this.postState();
        } finally {
            this.scanning = false;
        }
    }

    private post(message: HostMessage) {
        void this.panel.webview.postMessage(message);
    }

    // Every plan or code message becomes CLI invocations - one for most, two
    // for a refresh. The CLI owns .planmap/; the watcher and the re-read below
    // pick up its writes.
    private async onMessage(raw: unknown) {
        if (!isWebviewMessage(raw)) return;

        const message: WebviewMessage = raw;

        if (message.type === "ready") {
            await this.postState();
            return;
        }

        if (message.type === "openPlan") {
            await this.openPlan();
            return;
        }

        if (message.type === "openFolder") {
            await openProjectFolder(this.context);
            return;
        }

        if (message.type === "setApiKey") {
            await setApiKey(this.context);
            await this.postState();
            return;
        }

        const steps = buildCliSteps(message, this.projectRoot);
        if (steps.length === 0) return;

        if (!(await this.confirm(message))) {
            this.post({ type: "cancelled", requestType: message.type });
            return;
        }

        const apiKey = await this.context.secrets.get(API_KEY_SECRET);

        // What the outline holds before the run, so the view can mark what
        // this refresh brought in.
        const before = await evolutionNodeIds(this.projectRoot);

        let result!: Awaited<ReturnType<typeof runCli>>;

        if (message.type === "evolution") {
            this.scan = undefined;
            this.pendingScan = false;
        }

        for (const args of steps) {
            result = await runCli(args, {
                ...this.cliOptions(),
                apiKey,
                onLine: line => this.post({ type: "progress", requestType: message.type, line })
            });

            // What that step found in the code, so the view can report it.
            // "check" exits 1 when it has findings, which is the interesting
            // case, so the summary is read before the outcome is judged.
            if (args[0] === "check") {
                this.scan = readScanSummary(result.json) ?? undefined;
            }

            // Exit 1 is a finding, not a failure: "check" reports exactly that
            // when the code has moved on, which is when the next step matters
            // most. Only a real failure stops the run.
            if (result.outcome === "failed") break;
        }

        if (result.outcome !== "failed") {
            this.arrivals = await sinceRefresh(this.projectRoot, before);
        }

        this.post({
            type: "cliResult",
            requestType: message.type,
            outcome: result.outcome,
            code: result.code,
            json: result.json,
            stdout: result.stdout,
            stderr: result.stderr
        });

        await this.postState();
    }

    // Removing a node, and approving a whole lens across every feature, are
    // confirmed in a VS Code dialog before the CLI runs.
    private async confirm(message: WebviewMessage): Promise<boolean> {
        if (message.type !== "reject" && message.type !== "approveLens") return true;

        const { plan } = await readViewState(this.projectRoot);
        const nodes = ((plan as { nodes?: unknown[] } | null)?.nodes ?? []) as Array<Record<string, unknown>>;
        const lenses = ((plan as { lenses?: unknown[] } | null)?.lenses ?? []) as Array<Record<string, unknown>>;

        let question: string;
        let action: string;

        if (message.type === "reject") {
            const node = nodes.find(candidate => candidate.id === message.target || candidate.identity === message.target);
            const name = typeof node?.title === "string" ? `"${node.title}"` : message.target;
            question = message.force
                ? `Reject ${name}? It is approved, and rejecting removes it from plan.json.`
                : `Reject ${name}? Rejecting removes it from plan.json.`;
            action = "Reject";
        } else {
            const lens = lenses.find(candidate => candidate.id === message.lensId);
            const label = typeof lens?.label === "string" ? lens.label : message.lensId;
            const count = nodes.filter(node =>
                node.status === "intended" &&
                Array.isArray(node.lensTags) &&
                node.lensTags.includes(message.lensId)
            ).length;
            question = `Approve ${count} intended ${count === 1 ? "node" : "nodes"} tagged ${label}? This covers every feature, not just the one open.`;
            action = "Approve";
        }

        return (await vscode.window.showWarningMessage(question, { modal: true }, action)) === action;
    }

    // "Write one rule myself". The extension never writes .planmap/: an existing
    // plan.json opens as it is; otherwise an unsaved editor at that path holds
    // the empty skeleton, and the file exists once the user saves it.
    private async openPlan() {
        const planUri = vscode.Uri.file(path.join(this.projectRoot, ".planmap", "plan.json"));
        const exists = await vscode.workspace.fs.stat(planUri).then(() => true, () => false);

        if (exists) {
            await vscode.window.showTextDocument(planUri, { viewColumn: vscode.ViewColumn.Beside });
            return;
        }

        const document = await vscode.workspace.openTextDocument(planUri.with({ scheme: "untitled" }));
        const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);

        if (document.getText().length === 0) {
            await editor.edit(builder => builder.insert(new vscode.Position(0, 0), PLAN_SKELETON));
        }
    }

    private cliOptions() {
        const config = vscode.workspace.getConfiguration("planmap");
        const nodePath = config.get<string>("nodePath") || "";
        const cliPath =
            config.get<string>("cliPath") ||
            path.resolve(this.context.extensionPath, "..", "src", "cli", "cli.js");

        // VS Code's own runtime runs the CLI when no node path is configured,
        // so a node install on PATH is not required.
        return {
            nodePath: nodePath || process.execPath,
            cliPath,
            cwd: this.projectRoot,
            runAsNode: !nodePath,
            // A local model (Ollama) instead of OpenRouter, when configured.
            env: {
                PLANMAP_LLM_ENDPOINT: config.get<string>("llmEndpoint")?.trim() ?? "",
                PLANMAP_LLM_MODEL: config.get<string>("llmModel")?.trim() ?? "",
                PLANMAP_LLM_BATCH_SIZE: String(config.get<number>("llmBatchSize") ?? "").trim()
            }
        };
    }

    private dispose() {
        PlanMapPanel.current = undefined;
        this.panel.dispose();
        while (this.disposables.length) this.disposables.pop()?.dispose();
    }
}

function makeNonce(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let i = 0; i < 32; i++) nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    return nonce;
}

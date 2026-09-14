import * as vscode from "vscode";
import * as path from "path";
import { readFile } from "fs/promises";

import { runCli } from "./cli";
import {
    buildCliArgs,
    isWebviewMessage,
    type HostMessage,
    type WebviewMessage
} from "./messages";
import { readViewState } from "./state";
import { watchPlanmap } from "./watcher";


export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand("planmap.open", () => {
            PlanMapPanel.show(context);
        })
    );
}

export function deactivate() {}


// --------------------------------------------------
// PANEL
// --------------------------------------------------

class PlanMapPanel {
    private static current: PlanMapPanel | undefined;

    private readonly disposables: vscode.Disposable[] = [];
    private readonly panel: vscode.WebviewPanel;

    static show(context: vscode.ExtensionContext) {
        const folder = vscode.workspace.workspaceFolders?.[0];

        if (!folder) {
            vscode.window.showInformationMessage("Open a project folder to see its PlanMap.");
            return;
        }

        if (PlanMapPanel.current) {
            PlanMapPanel.current.panel.reveal();
            return;
        }

        PlanMapPanel.current = new PlanMapPanel(context, folder.uri.fsPath);
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
        const state = await readViewState(this.projectRoot);
        this.post({ type: "state", state });
    }

    private post(message: HostMessage) {
        void this.panel.webview.postMessage(message);
    }

    // Every message except "ready" becomes exactly one CLI invocation. The
    // CLI owns .planmap/; the watcher and the re-read below pick up its writes.
    private async onMessage(raw: unknown) {
        if (!isWebviewMessage(raw)) return;

        const message: WebviewMessage = raw;

        if (message.type === "ready") {
            await this.postState();
            return;
        }

        const args = buildCliArgs(message, this.projectRoot);
        if (!args) return;

        const result = await runCli(args, this.cliOptions());

        this.post({
            type: "cliResult",
            requestType: message.type,
            outcome: result.outcome,
            code: result.code,
            json: result.json,
            stderr: result.stderr
        });

        await this.postState();
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
            runAsNode: !nodePath
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

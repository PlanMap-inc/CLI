import * as vscode from "vscode";

import { isSkipped } from "./state";


// --------------------------------------------------
// .planmap/ WATCHER
// --------------------------------------------------
// Anything that changes the artifacts - the CLI run from this panel, a
// terminal, another tool - triggers one debounced reload. The extension
// never writes these files; it only notices that they changed.
// --------------------------------------------------

export function watchPlanmap(
    projectRoot: string,
    onChange: () => void
): vscode.Disposable {
    const pattern = new vscode.RelativePattern(
        projectRoot,
        ".planmap/{plan,evolution,baseline}.json"
    );

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    let pending: unknown = null;

    const schedule = () => {
        if (pending !== null) {
            clearTimeout(pending);
        }

        pending = setTimeout(() => {
            pending = null;
            onChange();
        }, 150);
    };

    watcher.onDidCreate(schedule);
    watcher.onDidChange(schedule);
    watcher.onDidDelete(schedule);

    return new vscode.Disposable(() => {
        if (pending !== null) {
            clearTimeout(pending);
        }

        watcher.dispose();
    });
}


// --------------------------------------------------
// SOURCE WATCHER
// --------------------------------------------------
// The .planmap watcher above notices PlanMap's own output. This one notices
// YOUR code, which is what PlanMap is supposed to be tracking - without it,
// the graphs only ever move when you remember to press a button, and an
// edit looks exactly like a broken refresh.
//
// The pattern mirrors src/baseline/scanner.js: the same extensions it reads,
// the same directories it skips. Watching more would fire on files the scan
// cannot see, which is its own kind of lie.
//
// Debounced hard, because saving a file in an editor is bursty and the work
// this schedules reads every source file in the project.
// --------------------------------------------------

const SOURCE_GLOB = "**/*.{js,ts,tsx,py}";



export function watchSources(
    projectRoot: string,
    onChange: () => void,
    delayMs = 1200
): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(projectRoot, SOURCE_GLOB)
    );

    let pending: unknown = null;

    const schedule = (uri: vscode.Uri) => {
        // A scan skips these directories, so a change inside one changes
        // nothing a scan could find.
        if (isSkipped(uri.fsPath) || uri.fsPath.endsWith(".d.ts")) return;

        if (pending !== null) clearTimeout(pending);

        pending = setTimeout(() => {
            pending = null;
            onChange();
        }, delayMs);
    };

    watcher.onDidCreate(schedule);
    watcher.onDidChange(schedule);
    watcher.onDidDelete(schedule);

    return new vscode.Disposable(() => {
        if (pending !== null) clearTimeout(pending);
        watcher.dispose();
    });
}

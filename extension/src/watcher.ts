import * as vscode from "vscode";


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

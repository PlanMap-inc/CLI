import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { OPEN_ON_START_WINDOW_MS, pendingProjectMatches } from "../out/state.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = file => fs.readFileSync(path.resolve(HERE, "..", file), "utf8");

// PlanMap reopens by itself only in the folder it switched to, and only right after the switch.
const now = 1_000_000_000;
const request = { path: "/work/shop", at: now - 5_000 };

assert.equal(pendingProjectMatches(request, "/work/shop", now), true);
assert.equal(pendingProjectMatches(request, "/work/blog", now), false, "not in a different folder");
assert.equal(pendingProjectMatches({ ...request, at: now - OPEN_ON_START_WINDOW_MS - 1 }, "/work/shop", now), false, "not when that folder is opened again later");
assert.equal(pendingProjectMatches({ ...request, at: now + 60_000 }, "/work/shop", now), false, "a timestamp from the future is not trusted");
assert.equal(pendingProjectMatches(undefined, "/work/shop", now), false, "nothing was requested");
assert.equal(pendingProjectMatches(request, undefined, now), false, "no folder is open");
assert.equal(pendingProjectMatches("/work/shop", "/work/shop", now), false, "a bare path is not a request");

// The command exists, and PlanMap activates at startup so it can reopen.
const pkg = JSON.parse(read("package.json"));
assert.ok(pkg.contributes.commands.some(c => c.command === "planmap.openProjectFolder" && c.title === "Open Project Folder…"));
assert.ok(pkg.activationEvents.includes("onStartupFinished"));

// The host: VS Code's folder picker, the reopen request recorded before the window reloads, and the check on activation.
const host = read("src/extension.ts");
assert.match(host, /registerCommand\("planmap\.openProjectFolder", \(\) => openProjectFolder\(context\)\)/);
assert.match(host, /showOpenDialog\(\{[\s\S]*?canSelectFolders: true,[\s\S]*?canSelectFiles: false,/);
const recorded = host.indexOf("globalState.update(OPEN_ON_START, { path: folder.fsPath, at: Date.now() })");
const reopened = host.indexOf('executeCommand("vscode.openFolder", folder, { forceNewWindow: false })');
assert.ok(recorded > 0 && reopened > recorded, "the request is saved before VS Code reloads the window");
assert.match(host, /pendingProjectMatches\(pending, vscode\.workspace\.workspaceFolders\?\.\[0\]\?\.uri\.fsPath, Date\.now\(\)\)\) \{\s*PlanMapPanel\.show\(context\);/);
assert.match(host, /globalState\.update\(OPEN_ON_START, undefined\)/, "a request is used at most once");
assert.match(host, /if \(message\.type === "openFolder"\) \{\s*await openProjectFolder\(this\.context\);/);

// The webview: a folder button on the rail that is not one of the two view radios.
const html = read("webview/index.html");
assert.match(html, /<button class="nav-icon-btn rail-folder" id="openFolderBtn"[^>]*>/);
assert.doesNotMatch(html.match(/<button class="nav-icon-btn rail-folder"[^>]*>/)[0], /data-nav|role="radio"/);

const main = read("webview/main.js");
assert.match(main, /openFolderBtn\.addEventListener\("click", \(\) => vscode\.postMessage\(\{ type: "openFolder" \}\)\)/);
assert.match(main, /otherFolderBtn[\s\S]*vscode\.postMessage\(\{ type: "openFolder" \}\)/);

console.log("PASS: project-folder");

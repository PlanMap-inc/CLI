import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION = path.resolve(HERE, "..");

function listFiles(directory, extensions) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) return listFiles(full, extensions);
        return extensions.includes(path.extname(entry.name)) ? [full] : [];
    });
}

// The webview renders; it never touches the filesystem.
const webviewFiles = listFiles(path.join(EXTENSION, "webview"), [".js", ".html"]);
assert.ok(webviewFiles.length >= 3, "expected the webview's html and js files");

const webviewForbidden = [
    [/\bfs\b/, "fs"],
    [/require\s*\(/, "require("],
    [/writeFile/, "writeFile"],
    [/["']node:/, "node: import"]
];

for (const file of webviewFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const [pattern, label] of webviewForbidden) {
        assert.equal(pattern.test(source), false, `${path.relative(EXTENSION, file)} contains ${label}`);
    }
}

// The host may read .planmap/ files, but every mutation goes through the CLI.
const hostFiles = listFiles(path.join(EXTENSION, "src"), [".ts"]);
assert.ok(hostFiles.length >= 4, "expected the host source files");

// Only an actual call counts. "rename" and "rm" are also CLI verbs the host
// passes through as arguments - ["plan", "rename", root] is the extension
// asking the CLI to do the write, which is exactly the rule working.
const hostForbidden = /\b(writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|unlink|unlinkSync|rm|rmSync|rename|renameSync|copyFile|createWriteStream)\s*\(/;

for (const file of hostFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(hostForbidden.test(source), false, `${path.relative(EXTENSION, file)} contains a filesystem write`);
}

console.log("PASS: no-direct-writes");

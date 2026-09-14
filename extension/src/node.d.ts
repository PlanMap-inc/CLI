// Minimal ambient types for the few Node APIs the host uses. The dependency
// budget allows only typescript and @types/vscode, so @types/node is not used.

declare const process: {
    execPath: string;
    platform: string;
    env: Record<string, string | undefined>;
};

declare function setTimeout(callback: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;

declare module "child_process" {
    interface ReadableLike {
        on(event: "data", listener: (chunk: { toString(): string }) => void): void;
    }

    interface ChildProcess {
        stdout: ReadableLike | null;
        stderr: ReadableLike | null;
        on(event: "error", listener: (error: Error) => void): ChildProcess;
        on(event: "close", listener: (code: number | null) => void): ChildProcess;
    }

    export function spawn(
        command: string,
        args: readonly string[],
        options: {
            cwd?: string;
            env?: Record<string, string | undefined>;
            shell?: boolean;
        }
    ): ChildProcess;
}

declare module "fs/promises" {
    export function readFile(path: string, encoding: "utf8"): Promise<string>;
    export function stat(path: string): Promise<{
        isDirectory(): boolean;
        isFile(): boolean;
    }>;
}

declare module "path" {
    export function join(...parts: string[]): string;
    export function resolve(...parts: string[]): string;
    export function basename(path: string): string;
}

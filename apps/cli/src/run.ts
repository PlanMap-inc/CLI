import {
  approveNode,
  driftCheck,
  handoffForNode,
  impactForNode,
  initStore,
  mapRepo,
  projectMarkdown,
  resolveLlmProvider,
} from '@planmap/engine';

export const USAGE = `planmap — plan-aware analysis for your repo

Usage:
  planmap init                 Initialize a .planmap store here
  planmap map                  Analyze this repo and auto-populate the graph
  planmap impact <nodeId>      What a change to a node affects, and why
  planmap approve <nodeId>     Approve a node (sets the drift baseline)
  planmap drift                Check approved nodes against the real code
  planmap handoff <nodeId>     Emit a scoped instruction for your coding agent
  planmap project              Regenerate the markdown projection
`;

/** Minimal stream sink so `run` is testable without touching the real process. */
export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

const processIo: Io = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

/**
 * Execute one CLI invocation and return its exit code. Pure with respect to the
 * process: the working directory and output streams are injected, so the same
 * dispatch is exercised by tests and by the `planmap` bin. All domain logic lives
 * in `@planmap/engine`; this layer only parses argv and formats output.
 */
export async function run(
  argv: string[],
  cwd: string = process.cwd(),
  io: Io = processIo,
): Promise<number> {
  const [command, arg] = argv;
  const llm = resolveLlmProvider();

  switch (command) {
    case 'init':
      await initStore(cwd);
      io.out('Initialized .planmap\n');
      return 0;
    case 'map': {
      const result = await mapRepo(cwd);
      io.out(`Mapped ${result.nodes} nodes, ${result.edges} edges\n`);
      return 0;
    }
    case 'impact': {
      if (!arg) {
        io.err('usage: planmap impact <nodeId>\n');
        return 1;
      }
      io.out(`${JSON.stringify(await impactForNode(arg, cwd, cwd, llm), null, 2)}\n`);
      return 0;
    }
    case 'approve': {
      if (!arg) {
        io.err('usage: planmap approve <nodeId>\n');
        return 1;
      }
      await approveNode(arg, cwd);
      io.out(`Approved ${arg}\n`);
      return 0;
    }
    case 'drift': {
      const report = await driftCheck(cwd, cwd, llm);
      io.out(
        `verified ${report.verified.length}, drifted ${report.drifted.length}, error ${report.errored.length}\n`,
      );
      return report.drifted.length + report.errored.length > 0 ? 1 : 0;
    }
    case 'handoff': {
      if (!arg) {
        io.err('usage: planmap handoff <nodeId>\n');
        return 1;
      }
      io.out(`${await handoffForNode(arg, cwd, cwd, llm)}\n`);
      return 0;
    }
    case 'project': {
      await projectMarkdown(cwd);
      io.out('Wrote .planmap/projections/evolution.md\n');
      return 0;
    }
    default:
      io.out(USAGE);
      return command ? 1 : 0;
  }
}

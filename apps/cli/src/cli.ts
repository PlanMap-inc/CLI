import {
  approveNode,
  driftCheck,
  handoffForNode,
  impactForNode,
  initStore,
  mapRepo,
  projectMarkdown,
} from './engine';
import { resolveLlmProvider } from './llm';

const USAGE = `planmap — plan-aware analysis for your repo

Usage:
  planmap init                 Initialize a .planmap store here
  planmap map                  Analyze this repo and auto-populate the graph
  planmap impact <nodeId>      What a change to a node affects, and why
  planmap approve <nodeId>     Approve a node (sets the drift baseline)
  planmap drift                Check approved nodes against the real code
  planmap handoff <nodeId>     Emit a scoped instruction for your coding agent
  planmap project              Regenerate the markdown projection
`;

async function main(argv: string[]): Promise<number> {
  const [command, arg] = argv;
  const cwd = process.cwd();
  const llm = resolveLlmProvider();

  switch (command) {
    case 'init':
      await initStore(cwd);
      process.stdout.write('Initialized .planmap\n');
      return 0;
    case 'map': {
      const result = await mapRepo(cwd);
      process.stdout.write(`Mapped ${result.nodes} nodes, ${result.edges} edges\n`);
      return 0;
    }
    case 'impact': {
      if (!arg) {
        process.stderr.write('usage: planmap impact <nodeId>\n');
        return 1;
      }
      process.stdout.write(`${JSON.stringify(await impactForNode(arg, cwd, cwd, llm), null, 2)}\n`);
      return 0;
    }
    case 'approve': {
      if (!arg) {
        process.stderr.write('usage: planmap approve <nodeId>\n');
        return 1;
      }
      await approveNode(arg, cwd);
      process.stdout.write(`Approved ${arg}\n`);
      return 0;
    }
    case 'drift': {
      const report = await driftCheck(cwd, cwd, llm);
      process.stdout.write(
        `verified ${report.verified.length}, drifted ${report.drifted.length}, error ${report.errored.length}\n`,
      );
      return report.drifted.length + report.errored.length > 0 ? 1 : 0;
    }
    case 'handoff': {
      if (!arg) {
        process.stderr.write('usage: planmap handoff <nodeId>\n');
        return 1;
      }
      process.stdout.write(`${await handoffForNode(arg, cwd, cwd, llm)}\n`);
      return 0;
    }
    case 'project': {
      await projectMarkdown(cwd);
      process.stdout.write('Wrote .planmap/projections/evolution.md\n');
      return 0;
    }
    default:
      process.stdout.write(USAGE);
      return command ? 1 : 0;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });

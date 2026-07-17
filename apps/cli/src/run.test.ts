import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run, type Io } from './run';

/** Collect the CLI's output instead of writing to the real process streams. */
function captureIo(): Io & { stdout: string; stderr: string } {
  const sink = {
    stdout: '',
    stderr: '',
    out(text: string) {
      sink.stdout += text;
    },
    err(text: string) {
      sink.stderr += text;
    },
  };
  return sink;
}

describe('cli dispatch', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'planmap-cli-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('init creates a .planmap store and exits 0', async () => {
    const io = captureIo();
    const code = await run(['init'], dir, io);
    expect(code).toBe(0);
    expect(io.stdout).toContain('Initialized');
    await expect(access(join(dir, '.planmap'))).resolves.toBeUndefined();
  });

  it('prints usage and exits 0 when no command is given', async () => {
    const io = captureIo();
    const code = await run([], dir, io);
    expect(code).toBe(0);
    expect(io.stdout).toContain('Usage:');
  });

  it('exits 1 on an unknown command', async () => {
    const io = captureIo();
    const code = await run(['nonsense'], dir, io);
    expect(code).toBe(1);
    expect(io.stdout).toContain('Usage:');
  });

  it('exits 1 when impact is missing its node id', async () => {
    const io = captureIo();
    const code = await run(['impact'], dir, io);
    expect(code).toBe(1);
    expect(io.stderr).toContain('usage: planmap impact');
  });
});

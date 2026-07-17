import { describe, expect, it } from 'vitest';

import { makeNode } from '../testing';

import { graphToMarkdown, nodeToMarkdown } from './project';

describe('nodeToMarkdown', () => {
  it('renders title, status, tags, body, parent, code, and why', () => {
    const node = makeNode({
      id: 'n1',
      title: 'Added refresh tokens',
      status: 'implemented',
      lens_tags: ['security', 'backend'],
      summary: 'Issues a refresh token alongside the JWT.',
      parent: 'p1',
      depends_on: ['p1'],
      linked_code: [{ path: 'src/auth/jwt.ts', range: [88, 141], hash: 'h' }],
      annotation: '7-day refresh window.',
    });
    const md = nodeToMarkdown(node, (id) => (id === 'p1' ? 'Login' : undefined));
    expect(md).toContain('### Added refresh tokens');
    expect(md).toContain('`implemented`');
    expect(md).toContain('security, backend');
    expect(md).toContain('Issues a refresh token');
    expect(md).toContain('**Parent:** Login');
    expect(md).toContain('src/auth/jwt.ts:88–141');
    expect(md).toContain('**Why:** 7-day refresh window.');
  });

  it('marks a drifted node with its issue', () => {
    const node = makeNode({
      id: 'n',
      title: 'x',
      status: 'drifted',
      drift: { detected_at: 'now', file: 'a.ts', issue: 'session shrank to 24h' },
    });
    const md = nodeToMarkdown(node, () => undefined);
    expect(md).toContain('⚠ Drifted');
    expect(md).toContain('session shrank to 24h');
  });
});

describe('graphToMarkdown', () => {
  const nodes = [
    makeNode({ id: 'login', title: 'Login', parent: null, graph: 'evolution' }),
    makeNode({ id: 'jwt', title: 'Added JWT auth', parent: 'login' }),
    makeNode({ id: 'browse', title: 'Browse', parent: null }),
  ];

  it('renders roots (title-sorted) with children nested under them', () => {
    const md = graphToMarkdown(nodes, 'Food App');
    expect(md.startsWith('# Food App')).toBe(true);
    expect(md.indexOf('### Browse')).toBeLessThan(md.indexOf('### Login'));
    expect(md.indexOf('### Login')).toBeLessThan(md.indexOf('### Added JWT auth'));
  });

  it('is a one-way projection where a field change surfaces in the output', () => {
    const before = graphToMarkdown(nodes);
    const changed = nodes.map((n) => (n.id === 'jwt' ? { ...n, summary: 'now with refresh' } : n));
    const after = graphToMarkdown(changed);
    expect(before).not.toContain('now with refresh');
    expect(after).toContain('now with refresh');
  });
});

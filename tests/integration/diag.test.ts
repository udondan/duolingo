import { it } from 'vitest';
import { DuolingoClient } from '../../src/client/duolingo.js';

it('diag: /users/<name> response shape', async () => {
  const client = new DuolingoClient(process.env.DUOLINGO_USERNAME!, process.env.DUOLINGO_JWT!);
  const targets: [string, string][] = [
    ['self', process.env.DUOLINGO_USERNAME!],
    ['test', process.env.DUOLINGO_TEST_USERNAME!],
    ['luis', 'luis'],
  ];
  for (const [label, name] of targets) {
    try {
      const d = (await client.getUserData(name)) as unknown as Record<string, unknown>;
      const shape = Object.keys(d)
        .sort()
        .map((k) => `${k}:${Array.isArray(d[k]) ? `array(${(d[k] as unknown[]).length})` : d[k] === null ? 'null' : typeof d[k]}`);
      console.log(`DIAG ${label} ${shape.length} keys: ${shape.join(' ')}`);
    } catch (e) {
      console.log(`DIAG ${label} error: ${String(e)}`);
    }
  }
});

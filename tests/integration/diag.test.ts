import { it } from 'vitest';
import { DuolingoClient } from '../../src/client/duolingo.js';

it('diag: current course and calendar', async () => {
  const client = new DuolingoClient(
    process.env.DUOLINGO_USERNAME!,
    process.env.DUOLINGO_JWT!,
  );
  const test = await client.getUserData(process.env.DUOLINGO_TEST_USERNAME);
  const url = `https://www.duolingo.com/2023-05-23/users/${test.id}?fields=currentCourseId,courses`;
  const raw = (await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then((r) => r.json())) as {
    currentCourseId?: string;
    courses?: { id: string }[];
  };
  console.log(
    `DIAG test currentCourseId=${raw.currentCourseId ?? 'none'} courses=${(raw.courses ?? []).map((c) => c.id).join(',')}`,
  );
  const luis = (await client.getUserData('luis')) as unknown as {
    learning_language: string;
    language_data: Record<string, Record<string, unknown>>;
  };
  const ld = luis.language_data[luis.learning_language] ?? {};
  console.log(
    `DIAG luis language_data keys=${Object.keys(luis.language_data).join(',')} fields=${Object.keys(ld).sort().join(',')}`,
  );
});

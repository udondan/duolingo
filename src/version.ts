import { createRequire } from 'node:module';

/** The package version, read from package.json (one level above dist/). */
export const { version } = createRequire(import.meta.url)(
  '../package.json',
) as { version: string };

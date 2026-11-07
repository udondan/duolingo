/**
 * Tests for the CLI config file loader.
 */

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultConfigFilePath,
  loadConfigFile,
} from '../../src/cli/config-file.js';

const KEYS = ['DUO_TEST_A', 'DUO_TEST_B', 'DUO_TEST_C'];

describe('loadConfigFile', () => {
  let dir: string;
  let stderr: ReturnType<typeof vi.spyOn>;

  function writeConfig(content: string, mode = 0o600): string {
    const path = join(dir, 'config');
    writeFileSync(path, content);
    chmodSync(path, mode);
    return path;
  }

  function warnings(): string {
    return stderr.mock.calls.map((c: unknown[]) => String(c[0])).join('');
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'duolingo-config-'));
    stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    for (const key of KEYS) Reflect.deleteProperty(process.env, key);
  });

  afterEach(() => {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
    for (const key of KEYS) Reflect.deleteProperty(process.env, key);
  });

  it('defaults to ~/.config/duolingo/config', () => {
    expect(defaultConfigFilePath()).toBe(
      join(homedir(), '.config', 'duolingo', 'config'),
    );
  });

  it('does nothing when the file does not exist', () => {
    loadConfigFile(join(dir, 'missing'));
    expect(stderr).not.toHaveBeenCalled();
  });

  it('loads KEY=VALUE pairs and skips comments, blanks and junk', () => {
    const path = writeConfig(
      [
        '# comment',
        '',
        '  DUO_TEST_A = first  ',
        'DUO_TEST_B=a=b=c',
        '=no-key',
        'no equals sign',
        'invalid-key=x',
        '__proto__=polluted',
      ].join('\n'),
    );

    loadConfigFile(path);

    expect(process.env.DUO_TEST_A).toBe('first');
    expect(process.env.DUO_TEST_B).toBe('a=b=c');
    expect(process.env['invalid-key']).toBeUndefined();
    expect(Object.hasOwn(process.env, '__proto__')).toBe(false);
    expect(stderr).not.toHaveBeenCalled();
  });

  it('does not override existing environment variables', () => {
    process.env.DUO_TEST_C = 'from-env';
    loadConfigFile(writeConfig('DUO_TEST_C=from-file'));
    expect(process.env.DUO_TEST_C).toBe('from-env');
  });

  it.skipIf(process.platform === 'win32')(
    'refuses a file other users can read',
    () => {
      const path = writeConfig('DUO_TEST_A=secret', 0o644);
      loadConfigFile(path);
      expect(process.env.DUO_TEST_A).toBeUndefined();
      expect(warnings()).toContain('other users can access it (mode 644)');
      expect(warnings()).toContain(`chmod 0600 "${path}"`);
    },
  );

  it('refuses a path that is not a file', () => {
    const path = join(dir, 'config');
    mkdirSync(path);
    loadConfigFile(path);
    expect(warnings()).toContain('because it is not a file');
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'warns when the file cannot be read',
    () => {
      const path = writeConfig('DUO_TEST_A=secret', 0o000);
      loadConfigFile(path);
      expect(process.env.DUO_TEST_A).toBeUndefined();
      expect(warnings()).toContain(`unable to read config file ${path}`);
    },
  );
});

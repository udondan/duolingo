/**
 * Config file loader for the Duolingo CLI.
 *
 * Reads ~/.config/duolingo/config (or the path given) and applies any
 * KEY=VALUE entries to process.env, but only when the variable is not
 * already set. Environment variables always take precedence.
 *
 * File format:
 *   # comment
 *   DUOLINGO_USERNAME=your_username
 *   DUOLINGO_JWT=your_jwt
 *
 * The file holds secrets, so it is only read when nobody but its owner can
 * access it (e.g. mode 0600).
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function defaultConfigFilePath(): string {
  return join(homedir(), '.config', 'duolingo', 'config');
}

function warn(message: string): void {
  process.stderr.write(`[duolingo] Warning: ${message}\n`);
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Load the config file and apply entries to process.env.
 * Values already present in the environment are not overwritten.
 */
export function loadConfigFile(path = defaultConfigFilePath()): void {
  if (!existsSync(path)) return;

  let content: string;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) {
      warn(`refusing to load config file ${path} because it is not a file.`);
      return;
    }
    if (process.platform !== 'win32' && stat.mode & 0o077) {
      const mode = (stat.mode & 0o777).toString(8);
      warn(
        `refusing to load config file ${path} because other users can access it (mode ${mode}). Run: chmod 0600 "${path}"`,
      );
      return;
    }
    content = readFileSync(path, 'utf8');
  } catch (error) {
    // fs always throws Error objects
    warn(`unable to read config file ${path}: ${(error as Error).message}`);
    return;
  }

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq < 1) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    if (
      !UNSAFE_KEYS.has(key) &&
      /^[A-Z_][A-Z0-9_]*$/i.test(key) &&
      !Object.hasOwn(process.env, key)
    ) {
      process.env[key] = value;
    }
  }
}

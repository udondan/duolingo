/**
 * Integration tests for all MCP tools that accept a `username` parameter.
 *
 * For each such tool we verify two paths:
 *   1. Without `username` → returns data for the authenticated user
 *   2. With `username=TEST_USERNAME` → returns data for a different public user
 *
 * This ensures the username routing works end-to-end through the MCP tool
 * layer (not just the client layer).
 *
 * Requirements:
 *   DUOLINGO_USERNAME      — authenticated Duolingo username
 *   DUOLINGO_JWT           — JWT token for the authenticated user
 *   DUOLINGO_TEST_USERNAME — a different public Duolingo account to query
 *
 * Tools with username support (6 total):
 *   account: get_user_info, get_streak_info, get_languages, get_calendar, get_courses
 *   language: get_language_details
 *
 * Note: get_friends, get_leaderboard, and get_language_progress do NOT support
 * username — the Duolingo API requires authentication for friends/leaderboard,
 * and language_data only contains the user's currently active language.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAccountTools } from '../../src/tools/account.js';
import { registerLanguageTools } from '../../src/tools/language.js';
import { resetClient } from '../../src/client/duolingo.js';
import { callTool } from '../helpers.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const AUTH_USERNAME = process.env.DUOLINGO_USERNAME;
const JWT = process.env.DUOLINGO_JWT;
const TEST_USERNAME = process.env.DUOLINGO_TEST_USERNAME;

const SKIP =
  !AUTH_USERNAME || !JWT || !TEST_USERNAME
    ? 'Skipping: DUOLINGO_USERNAME, DUOLINGO_JWT, or DUOLINGO_TEST_USERNAME not set'
    : false;

let server: McpServer;

beforeAll(() => {
  resetClient();
  server = new McpServer({ name: 'test', version: '0.0.0' });
  registerAccountTools(server);
  registerLanguageTools(server);
});

// ---------------------------------------------------------------------------
// Helper: parse JSON tool output
// ---------------------------------------------------------------------------

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Tool did not return valid JSON. Got:\n${text}`);
  }
}

// ---------------------------------------------------------------------------
// duolingo_get_user_info
// ---------------------------------------------------------------------------

describe('duolingo_get_user_info', () => {
  it('returns profile for the authenticated user (no username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_user_info', {
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>;

    expect(typeof data.username).toBe('string');
    expect(data.username).toBe(AUTH_USERNAME);
    expect(typeof data.id).toBe('number');
    expect(typeof data.bio).toBe('string');
  });

  it('returns profile for the test user (with username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_user_info', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>;

    expect(data.username).toBe(TEST_USERNAME);
    expect(typeof data.id).toBe('number');
    expect(data.username).not.toBe(AUTH_USERNAME);
  });

  it('returns different users for authenticated vs test username', async () => {
    if (SKIP) return;

    const authText = await callTool(server, 'duolingo_get_user_info', {
      response_format: 'json',
    });
    const testText = await callTool(server, 'duolingo_get_user_info', {
      username: TEST_USERNAME,
      response_format: 'json',
    });

    const authData = parseJson(authText) as Record<string, unknown>;
    const testData = parseJson(testText) as Record<string, unknown>;

    expect(authData.id).not.toBe(testData.id);
    expect(authData.username).not.toBe(testData.username);
  });
});

// ---------------------------------------------------------------------------
// duolingo_get_streak_info
// ---------------------------------------------------------------------------

describe('duolingo_get_streak_info', () => {
  it('returns streak for the authenticated user (no username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_streak_info', {
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>;

    expect(typeof data.site_streak).toBe('number');
    expect(data.site_streak).toBeGreaterThanOrEqual(0);
    expect(typeof data.streak_extended_today).toBe('boolean');
  });

  it('returns streak for the test user (with username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_streak_info', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>;

    expect(typeof data.site_streak).toBe('number');
    expect(data.site_streak).toBeGreaterThanOrEqual(0);
    expect(typeof data.streak_extended_today).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// duolingo_get_languages
// ---------------------------------------------------------------------------

describe('duolingo_get_languages', () => {
  it('returns languages for the authenticated user (no username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_languages', {
      response_format: 'json',
    });
    const data = parseJson(text);

    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThan(0);
    for (const lang of data as string[]) {
      expect(typeof lang).toBe('string');
      expect(lang.length).toBeGreaterThan(0);
    }
  });

  it('returns languages for the test user (with username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_languages', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    const data = parseJson(text);

    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it('returns the name and abbreviation of each language', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_languages', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    const data = parseJson(text) as { name: string; abbreviation: string }[];

    expect(Array.isArray(data)).toBe(true);
    for (const { name, abbreviation } of data) {
      expect(name.length).toBeGreaterThan(0);
      // Abbreviations are short codes like 'fr', 'es', 'ja'
      expect(abbreviation.length).toBeGreaterThanOrEqual(2);
      expect(abbreviation.length).toBeLessThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// duolingo_get_calendar
// ---------------------------------------------------------------------------

describe('duolingo_get_calendar', () => {
  it('returns calendar for the authenticated user (no username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_calendar', {
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>[];

    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const entry = data[0];
      expect(typeof entry.datetime).toBe('number');
      expect(typeof entry.improvement).toBe('number');
    }
  });

  it('returns calendar for the test user (with username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_calendar', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    // The API does not return the calendar for other users, so an empty
    // result is valid here.
    if (text === 'No calendar entries found.') return;
    const data = parseJson(text) as Record<string, unknown>[];

    expect(Array.isArray(data)).toBe(true);
    for (const entry of data.slice(0, 3)) {
      expect(typeof entry.datetime).toBe('number');
      expect(entry.datetime).toBeGreaterThan(0);
      expect(typeof entry.improvement).toBe('number');
    }
  });

  it('returns entries sorted newest first', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_calendar', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    if (text === 'No calendar entries found.') return;
    const data = parseJson(text) as Record<string, unknown>[];

    if (data.length < 2) return;
    expect(data[0].datetime as number).toBeGreaterThanOrEqual(
      data[1].datetime as number,
    );
  });
});

// ---------------------------------------------------------------------------
// duolingo_get_courses
// ---------------------------------------------------------------------------

describe('duolingo_get_courses', () => {
  it('returns courses for the authenticated user (no username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_courses', {
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>[];

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const course of data) {
      expect(typeof course.subject).toBe('string');
      // title is present for language courses; non-language courses (math/chess/music)
      // may only have topic. Either title or topic must be a string.
      expect(
        typeof course.title === 'string' || typeof course.topic === 'string',
      ).toBe(true);
      expect(typeof course.xp).toBe('number');
    }
  });

  it('returns courses for the test user (with username)', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_courses', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>[];

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const course of data) {
      expect(typeof course.subject).toBe('string');
      expect(
        typeof course.title === 'string' || typeof course.topic === 'string',
      ).toBe(true);
      expect(typeof course.xp).toBe('number');
    }
  });

  it('test user has both language and non-language courses', async () => {
    if (SKIP) return;

    const text = await callTool(server, 'duolingo_get_courses', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>[];

    const langCourses = data.filter((c) => c.subject === 'language');
    const nonLangCourses = data.filter((c) => c.subject !== 'language');

    expect(langCourses.length).toBeGreaterThan(0);
    expect(nonLangCourses.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// duolingo_get_language_details
// ---------------------------------------------------------------------------

describe('duolingo_get_language_details', () => {
  it('returns language details for the authenticated user (no username)', async () => {
    if (SKIP) return;

    // Get the authenticated user's current language first
    const langsText = await callTool(server, 'duolingo_get_languages', {
      response_format: 'json',
    });
    const langs = parseJson(langsText) as string[];
    if (langs.length === 0) return;

    const text = await callTool(server, 'duolingo_get_language_details', {
      language_name: langs[0],
      response_format: 'json',
    });
    const data = parseJson(text) as Record<string, unknown>;

    expect(typeof data.level).toBe('number');
    expect(typeof data.points).toBe('number');
    expect(typeof data.streak).toBe('number');
    expect(typeof data.current_learning).toBe('boolean');
  });

  it('returns language details for the test user (with username)', async () => {
    if (SKIP) return;

    // Get the test user's languages first
    const langsText = await callTool(server, 'duolingo_get_languages', {
      username: TEST_USERNAME,
      response_format: 'json',
    });
    const langs = parseJson(langsText) as string[];
    if (langs.length === 0) return;

    const text = await callTool(server, 'duolingo_get_language_details', {
      language_name: langs[0],
      username: TEST_USERNAME,
      response_format: 'json',
    });
    // Not available while the test user's current course is not a language
    if (text.startsWith('Language details are not available')) return;
    const data = parseJson(text) as Record<string, unknown>;

    expect(typeof data.level).toBe('number');
    expect(typeof data.points).toBe('number');
    expect(typeof data.streak).toBe('number');
    expect(typeof data.current_learning).toBe('boolean');
  });
});

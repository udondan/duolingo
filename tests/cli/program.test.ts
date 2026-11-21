/**
 * Tests for the `duolingo` CLI, run in-process with a mocked client.
 */

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatView, main } from '../../src/cli/program.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import { DuolingoNotFoundError } from '../../src/client/errors.js';
import { startMcpServer } from '../../src/mcp.js';
import type {
  DuolingoFriendUser,
  DuolingoUserData,
  DuolingoUserDataV2,
} from '../../src/client/types.js';

vi.mock('../../src/mcp.js', () => ({ startMcpServer: vi.fn() }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_DATA = {
  username: 'testuser',
  bio: 'Test bio',
  id: 12345,
  cohort: 1,
  learning_language_string: 'Spanish',
  creation_date: '2020-01-01T00:00:00',
  admin: false,
  location: 'Berlin',
  fullname: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  ui_language: 'en',
  daily_goal: 50,
  site_streak: 42,
  streak_extended_today: true,
  notify_comment: true,
  deactivated: false,
  tracking_properties: { num_followers: 10, num_following: 5 },
  calendar: [{ datetime: 1700000000000, improvement: 10 }],
  languages: [
    {
      language: 'es',
      language_string: 'Spanish',
      learning: true,
      current_learning: true,
      level: 5,
      points: 1500,
      streak: 42,
    },
  ],
  language_data: {
    es: {
      streak: 42,
      language_string: 'Spanish',
      level_progress: 200,
      num_skills_learned: 1,
      level_percent: 40,
      level_points: 500,
      next_level: 6,
      level_left: 300,
      language: 'es',
      points: 1500,
      fluency_score: 0.35,
      level: 5,
      calendar: [{ datetime: 1700000000000, improvement: 10 }],
      skills: [
        {
          id: 'skill-1',
          name: 'Basics 1',
          title: 'Basics 1',
          learned: true,
          strength: 1.0,
          progress_percent: 100,
          words: ['hola', 'gracias'],
          dependencies_name: [],
        },
      ],
    },
  },
} as unknown as DuolingoUserData;

const TODAY = new Date().toISOString().slice(0, 10);

const USER_DATA_V2 = {
  id: 12345,
  username: 'testuser',
  name: 'Test User',
  picture: '//example.com/avatar.jpg',
  totalXp: 50000,
  streak: 42,
  streakData: {
    currentStreak: {
      length: 42,
      lastExtendedDate: TODAY,
      startDate: '2026-02-22',
      endDate: TODAY,
    },
    previousStreak: null,
    longestStreak: { length: 42, startDate: '2026-02-22', endDate: TODAY },
  },
  hasPlus: false,
  subscriberLevel: 'FREE',
  fromLanguage: 'en',
  learningLanguage: 'es',
  courses: [
    {
      id: 'DUOLINGO_ES_EN',
      subject: 'language',
      topic: 'es',
      xp: 1500,
      fromLanguage: 'en',
      learningLanguage: 'es',
      title: 'Spanish',
    },
    {
      id: 'MATH_BT',
      subject: 'math',
      topic: 'bt',
      xp: 3200,
      fromLanguage: 'en',
    },
  ],
} as unknown as DuolingoUserDataV2;

const FOLLOWING = [
  {
    userId: 99001,
    username: 'friend1',
    displayName: 'Friend One',
    picture: '//example.com/f1.jpg',
    totalXp: 2000,
    isFollowing: true,
    isFollowedBy: false,
    hasSubscription: false,
    userScore: { courseId: 'DUOLINGO_ES_EN', score: 150 },
  },
] as unknown as DuolingoFriendUser[];

function mockClient(overrides: Partial<Record<string, unknown>> = {}) {
  const client = {
    getUserData: vi.fn().mockResolvedValue(USER_DATA),
    getUserDataById: vi.fn().mockResolvedValue({
      xpGoal: 50,
      xpGains: [],
      streakData: { updatedTimestamp: Math.floor(Date.now() / 1000) },
    }),
    getUserDataV2: vi.fn().mockResolvedValue(USER_DATA_V2),
    getUserIdByUsername: vi.fn().mockResolvedValue(12345),
    getFollowing: vi.fn().mockResolvedValue(FOLLOWING),
    getShopItems: vi.fn().mockResolvedValue([
      {
        id: 'streak_freeze',
        name: 'Streak Freeze',
        type: 'misc',
        price: 200,
        currencyType: 'XGM',
      },
    ]),
    getHealth: vi.fn().mockResolvedValue({
      hearts: 4,
      maxHearts: 5,
      healthEnabled: true,
      eligibleForFreeRefill: false,
      secondsPerHeartSegment: 21600,
      secondsUntilNextHeartSegment: 600,
      useHealth: true,
      unlimitedHeartsAvailable: false,
    }),
    getCurrencies: vi.fn().mockResolvedValue({ gems: 1234, lingots: 10 }),
    getStreakGoalCurrent: vi
      .fn()
      .mockResolvedValue({ hasActiveGoal: false, streakGoal: null }),
    getLanguageVoices: vi.fn().mockResolvedValue(['mathieu']),
    buildAudioUrl: vi
      .fn()
      .mockImplementation((word: string, lang: string, voice?: string) =>
        Promise.resolve(
          `https://tts.example.com/${lang}/${voice ?? 'default'}/${word}`,
        ),
      ),
    ...overrides,
  };
  vi.spyOn(duolingoModule, 'getClient').mockReturnValue(
    client as unknown as DuolingoClient,
  );
  return client;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let stdout: string;
let stderr: string;
let configDir: string;

async function run(...argv: string[]): Promise<number> {
  return main(argv, { configFile: join(configDir, 'missing') });
}

beforeEach(() => {
  stdout = '';
  stderr = '';
  configDir = mkdtempSync(join(tmpdir(), 'duolingo-cli-'));
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatView', () => {
  it('prints JSON data', () => {
    expect(formatView({ data: [1], markdown: () => 'md' }, 'json')).toBe(
      '[\n  1\n]',
    );
  });

  it('prefers the message over markdown', () => {
    const view = { data: [], markdown: () => 'md', message: 'empty' };
    expect(formatView(view, 'markdown')).toBe('empty');
    expect(formatView(view, 'json')).toBe('[]');
  });

  it('throws when the view has no data', () => {
    expect(() =>
      formatView(
        { data: undefined, markdown: () => '', message: 'gone' },
        'json',
      ),
    ).toThrow(DuolingoNotFoundError);
  });
});

describe('commands (JSON)', () => {
  beforeEach(() => {
    mockClient();
  });

  it.each([
    [['user'], '"username": "testuser"'],
    [['user', '-u', 'other'], '"username": "testuser"'],
    [['settings'], '"notify_comment": true'],
    [['streak'], '42'],
    [['streak', '--username', 'other'], '42'],
    [['xp'], '50'],
    [['languages'], 'Spanish'],
    [['languages', '--abbreviations'], '"es"'],
    [['courses'], 'MATH_BT'],
    [['friends'], 'friend1'],
    [['calendar'], '10'],
    [['leaderboard'], 'friend1'],
    [['leaderboard', '--unit', 'month'], 'friend1'],
    [['shop'], 'Streak Freeze'],
    [['health'], '"hearts": 4'],
    [['currencies'], '"gems": 1234'],
    [['streak-goal'], '"hasActiveGoal": false'],
    [['language', 'Spanish'], '"level": 5'],
    [['progress', 'es'], '"level": 5'],
    [['known-topics', 'es'], 'Basics 1'],
    [['unknown-topics', 'es'], '[]'],
    [['golden-topics', 'es'], 'Basics 1'],
    [['reviewable-topics', 'es'], '[]'],
    [['known-words', 'es'], 'gracias'],
    [['learned-skills', 'es', '-u', 'testuser'], 'Basics 1'],
    [['voices'], 'mathieu'],
    [['voices', 'es'], 'mathieu'],
    [['audio-url', 'hola'], '"https://tts.example.com/es/mathieu/hola"'],
    [
      ['audio-url', 'hola', 'es', '--voice', 'lupe'],
      '"https://tts.example.com/es/lupe/hola"',
    ],
    [
      ['audio-url', 'hola', 'es', '--no-random'],
      '"https://tts.example.com/es/default/hola"',
    ],
    [['language-name', 'es'], '"Spanish"'],
    [['abbreviation', 'Spanish'], '"es"'],
  ])('%j prints JSON', async (argv, expected) => {
    expect(await run(...argv)).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain(expected);
    expect(stdout.endsWith('\n')).toBe(true);
    expect(() => {
      JSON.parse(stdout);
    }).not.toThrow();
  });
});

describe('commands (markdown)', () => {
  beforeEach(() => {
    mockClient();
  });

  it.each([
    [['user'], '# Duolingo User: testuser'],
    [['health'], '- **Next Heart In**: 10 min'],
    [['shop'], '- **Streak Freeze** — 200 gems'],
    [['streak-goal'], 'No active streak goal.'],
    [['known-words', 'es'], 'gracias'],
    [
      ['audio-url', 'hola', 'es', '--voice', 'lupe'],
      'https://tts.example.com/es/lupe/hola',
    ],
  ])('%j prints markdown', async (argv, expected) => {
    expect(await run('--format', 'markdown', ...argv)).toBe(0);
    expect(stdout).toContain(expected);
  });

  it('prints the empty-list message', async () => {
    mockClient({ getFollowing: vi.fn().mockResolvedValue([]) });
    expect(await run('-f', 'markdown', 'friends')).toBe(0);
    expect(stdout).toBe('No friends found.\n');
  });

  it('prints empty JSON for an empty list', async () => {
    mockClient({ getFollowing: vi.fn().mockResolvedValue([]) });
    expect(await run('friends')).toBe(0);
    expect(stdout).toBe('[]\n');
  });
});

describe('errors', () => {
  it('fails with exit code 1 when nothing is found', async () => {
    mockClient();
    expect(await run('language', 'Klingon')).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toMatch(/^\[duolingo\] Error: .*Klingon/);
  });

  it('reports client errors on stderr', async () => {
    mockClient({
      getCurrencies: vi.fn().mockRejectedValue(new Error('boom')),
    });
    expect(await run('currencies')).toBe(1);
    expect(stderr).toBe('[duolingo] Error: Unexpected error — Error: boom\n');
  });

  it('rejects an invalid choice', async () => {
    expect(await run('leaderboard', '--unit', 'year')).toBe(1);
    expect(stderr).toContain("'year' is invalid");
  });

  it('rejects an unknown command', async () => {
    expect(await run('nope')).toBe(1);
    expect(stderr).toContain("unknown command 'nope'");
  });
});

describe('program', () => {
  it('prints the version', async () => {
    const pkg = (await import('../../package.json', {
      with: { type: 'json' },
    })) as { default: { version: string } };
    expect(await run('--version')).toBe(0);
    expect(stdout).toBe(`${pkg.default.version}\n`);
  });

  it('prints help listing all commands', async () => {
    expect(await run('--help')).toBe(0);
    for (const command of ['mcp', 'user', 'audio-url', 'abbreviation']) {
      expect(stdout).toContain(command);
    }
  });

  it('starts the MCP server', async () => {
    expect(await run('mcp')).toBe(0);
    expect(startMcpServer).toHaveBeenCalledOnce();
  });

  it('loads credentials from the config file', async () => {
    const path = join(configDir, 'config');
    writeFileSync(path, 'DUO_CLI_TEST=from-file\n');
    chmodSync(path, 0o600);
    delete process.env.DUO_CLI_TEST;
    mockClient();

    try {
      expect(await main(['health'], { configFile: path })).toBe(0);
      expect(process.env.DUO_CLI_TEST).toBe('from-file');
    } finally {
      delete process.env.DUO_CLI_TEST;
    }
  });
});

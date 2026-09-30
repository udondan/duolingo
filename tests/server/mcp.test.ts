/**
 * MCP server integration tests.
 *
 * These tests spin up the actual McpServer (the same one used by the binary)
 * connected to an in-memory transport, then drive it with a real MCP Client.
 * This verifies the full MCP wire protocol: tool discovery, schema validation,
 * and tool execution — without any stdio or network I/O.
 *
 * The Duolingo API client is mocked so these tests are fast and offline.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerAccountTools } from '../../src/tools/account.js';
import { registerLanguageTools } from '../../src/tools/language.js';
import { registerShopTools } from '../../src/tools/shop.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import type {
  DuolingoUserData,
  DuolingoUserDataV2,
  DuolingoFriendUser,
} from '../../src/client/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER_DATA: DuolingoUserData = {
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
      num_skills_learned: 15,
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
};

const MOCK_USER_DATA_V2: DuolingoUserDataV2 = {
  id: 12345,
  username: 'testuser',
  name: 'Test User',
  picture: '//example.com/avatar.jpg',
  totalXp: 50000,
  streak: 42,
  streakData: {
    currentStreak: {
      length: 42,
      lastExtendedDate: new Date().toISOString().slice(0, 10),
      startDate: '2026-02-22',
      endDate: new Date().toISOString().slice(0, 10),
    },
    previousStreak: null,
    longestStreak: {
      length: 42,
      startDate: '2026-02-22',
      endDate: '2026-04-05',
    },
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
};

const MOCK_FOLLOWING: DuolingoFriendUser[] = [
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
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a linked server+client pair and connect them. */
async function createMcpPair(): Promise<{
  server: McpServer;
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const server = new McpServer({ name: 'duolingo_mcp', version: '1.0.0' });
  registerAccountTools(server);
  registerLanguageTools(server);
  registerShopTools(server);

  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    server,
    client,
    cleanup: async () => {
      await client.close();
      await serverTransport.close();
    },
  };
}

/** Call a tool via the MCP client and return the text content. */
async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return content.map((c) => c.text).join('');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP Server: tool discovery', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    vi.spyOn(duolingoModule, 'getClient').mockReturnValue({
      getUserData: vi.fn().mockResolvedValue(MOCK_USER_DATA),
      getUserDataById: vi.fn().mockResolvedValue({
        xpGoal: 50,
        xpGains: [],
        streakData: { updatedTimestamp: Math.floor(Date.now() / 1000) },
      }),
      getUserDataV2: vi.fn().mockResolvedValue(MOCK_USER_DATA_V2),
      getUserIdByUsername: vi.fn().mockResolvedValue(12345),
      getFollowing: vi.fn().mockResolvedValue(MOCK_FOLLOWING),
      getShopItems: vi.fn().mockResolvedValue([]),
      getHealth: vi.fn().mockResolvedValue({
        hearts: 5,
        maxHearts: 5,
        healthEnabled: true,
        eligibleForFreeRefill: false,
        secondsPerHeartSegment: 21600,
        secondsUntilNextHeartSegment: null,
        useHealth: false,
        unlimitedHeartsAvailable: false,
      }),
      getCurrencies: vi.fn().mockResolvedValue({ gems: 100, lingots: 10 }),
      getStreakGoalCurrent: vi.fn().mockResolvedValue({
        hasActiveGoal: false,
        streakGoal: null,
      }),
      getLanguageVoices: vi.fn().mockResolvedValue(['voice1']),
      buildAudioUrl: vi
        .fn()
        .mockResolvedValue('https://cdn.example.com/audio.mp3'),
    } as unknown as DuolingoClient);

    ({ client, cleanup } = await createMcpPair());
  });

  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it('lists all expected tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    const expectedTools = [
      'duolingo_get_abbreviation_of',
      'duolingo_get_audio_url',
      'duolingo_get_calendar',
      'duolingo_get_courses',
      'duolingo_get_currencies',
      'duolingo_get_daily_xp_progress',
      'duolingo_get_friends',
      'duolingo_get_golden_topics',
      'duolingo_get_health',
      'duolingo_get_known_topics',
      'duolingo_get_known_words',
      'duolingo_get_language_details',
      'duolingo_get_language_from_abbr',
      'duolingo_get_language_progress',
      'duolingo_get_language_voices',
      'duolingo_get_languages',
      'duolingo_get_leaderboard',
      'duolingo_get_learned_skills',
      'duolingo_get_reviewable_topics',
      'duolingo_get_settings',
      'duolingo_get_shop_items',
      'duolingo_get_streak_goal',
      'duolingo_get_streak_info',
      'duolingo_get_unknown_topics',
      'duolingo_get_user_info',
    ].sort();

    expect(names).toEqual(expectedTools);
  });

  it('each tool has a description and inputSchema', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(
        tool.description?.length,
        `${tool.name} should have a description`,
      ).toBeGreaterThan(0);
      expect(
        tool.inputSchema,
        `${tool.name} should have an inputSchema`,
      ).toBeDefined();
    }
  });

  it('tools have readOnlyHint = true (no destructive tools)', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(
        tool.annotations?.readOnlyHint,
        `${tool.name} should be read-only`,
      ).toBe(true);
      expect(
        tool.annotations?.destructiveHint,
        `${tool.name} should not be destructive`,
      ).toBe(false);
    }
  });
});

describe('MCP Server: tool execution via wire protocol', () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    vi.spyOn(duolingoModule, 'getClient').mockReturnValue({
      getUserData: vi.fn().mockResolvedValue(MOCK_USER_DATA),
      getUserDataById: vi.fn().mockResolvedValue({
        xpGoal: 50,
        xpGains: [
          {
            skillId: 'skill-1',
            xp: 10,
            time: Math.floor(Date.now() / 1000) - 3600,
          },
        ],
        streakData: { updatedTimestamp: Math.floor(Date.now() / 1000) - 3600 },
      }),
      getUserDataV2: vi.fn().mockResolvedValue(MOCK_USER_DATA_V2),
      getUserIdByUsername: vi.fn().mockResolvedValue(12345),
      getFollowing: vi.fn().mockResolvedValue(MOCK_FOLLOWING),
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
        secondsUntilNextHeartSegment: 3600,
        useHealth: true,
        unlimitedHeartsAvailable: false,
      }),
      getCurrencies: vi.fn().mockResolvedValue({ gems: 9705, lingots: 92 }),
      getStreakGoalCurrent: vi.fn().mockResolvedValue({
        hasActiveGoal: true,
        streakGoal: {
          userId: '12345',
          lastCompleteGoal: 175,
          checkpoints: [{ length: 200, dayInterval: 25, tier: 2 }],
          nextSelectedGoal: { length: 250, dayInterval: 25, tier: 2 },
        },
      }),
      getLanguageVoices: vi.fn().mockResolvedValue(['beaes', 'juniores']),
      buildAudioUrl: vi
        .fn()
        .mockResolvedValue(
          'https://d7mj4aqfscim2.cloudfront.net/tts/es/token/hola',
        ),
    } as unknown as DuolingoClient);

    ({ client, cleanup } = await createMcpPair());
  });

  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it('duolingo_get_user_info returns user profile', async () => {
    const result = await callTool(client, 'duolingo_get_user_info');
    expect(result).toContain('testuser');
    expect(result).toContain('Test User');
  });

  it('duolingo_get_user_info returns JSON when requested', async () => {
    const result = await callTool(client, 'duolingo_get_user_info', {
      response_format: 'json',
    });
    const parsed = JSON.parse(result) as { username: string; id: number };
    expect(parsed.username).toBe('testuser');
    expect(parsed.id).toBe(12345);
  });

  it('duolingo_get_streak_info returns streak data', async () => {
    const result = await callTool(client, 'duolingo_get_streak_info');
    expect(result).toContain('42 days');
  });

  it('duolingo_get_daily_xp_progress returns XP progress', async () => {
    const result = await callTool(client, 'duolingo_get_daily_xp_progress');
    expect(result).toContain('XP Today');
    expect(result).toContain('10');
  });

  it('duolingo_get_languages returns language list', async () => {
    const result = await callTool(client, 'duolingo_get_languages');
    expect(result).toContain('Spanish');
  });

  it('duolingo_get_courses returns all courses including non-language', async () => {
    const result = await callTool(client, 'duolingo_get_courses');
    expect(result).toContain('Spanish');
    expect(result).toContain('Math');
  });

  it('duolingo_get_friends returns friends list', async () => {
    const result = await callTool(client, 'duolingo_get_friends');
    expect(result).toContain('friend1');
  });

  it('duolingo_get_leaderboard returns leaderboard', async () => {
    const result = await callTool(client, 'duolingo_get_leaderboard', {
      unit: 'week',
    });
    expect(result).toContain('Leaderboard');
    expect(result).toContain('friend1');
  });

  it('duolingo_get_shop_items returns shop catalogue', async () => {
    const result = await callTool(client, 'duolingo_get_shop_items');
    expect(result).toContain('Streak Freeze');
  });

  it('duolingo_get_health returns hearts status', async () => {
    const result = await callTool(client, 'duolingo_get_health');
    expect(result).toContain('4 / 5');
  });

  it('duolingo_get_currencies returns gem and lingot balances', async () => {
    const result = await callTool(client, 'duolingo_get_currencies');
    expect(result).toContain('9,705');
    expect(result).toContain('92');
  });

  it('duolingo_get_streak_goal returns streak goal', async () => {
    const result = await callTool(client, 'duolingo_get_streak_goal');
    expect(result).toContain('175 days');
  });

  it('duolingo_get_language_voices returns voice list', async () => {
    const result = await callTool(client, 'duolingo_get_language_voices', {
      language_abbr: 'es',
    });
    expect(result).toContain('beaes');
  });

  it('duolingo_get_audio_url returns CDN URL', async () => {
    const result = await callTool(client, 'duolingo_get_audio_url', {
      word: 'hola',
      language_abbr: 'es',
    });
    expect(result).toContain('cloudfront.net');
    expect(result).toContain('hola');
  });

  it('duolingo_get_language_from_abbr returns full name', async () => {
    const result = await callTool(client, 'duolingo_get_language_from_abbr', {
      language_abbr: 'es',
    });
    expect(result).toBe('Spanish');
  });

  it('duolingo_get_abbreviation_of returns abbreviation', async () => {
    const result = await callTool(client, 'duolingo_get_abbreviation_of', {
      language_name: 'Spanish',
    });
    expect(result).toBe('es');
  });

  it('duolingo_get_known_topics returns learned topics', async () => {
    const result = await callTool(client, 'duolingo_get_known_topics', {
      language_abbr: 'es',
    });
    expect(result).toContain('Basics 1');
  });

  it('duolingo_get_language_details returns level and points', async () => {
    const result = await callTool(client, 'duolingo_get_language_details', {
      language_name: 'Spanish',
    });
    expect(result).toContain('Spanish');
    expect(result).toContain('1500');
  });

  it('invalid tool name returns error in content', async () => {
    // The MCP SDK returns unknown tool errors as content with isError: true
    const result = await client.callTool({
      name: 'duolingo_nonexistent_tool',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])
      .map((c) => c.text)
      .join('');
    expect(text).toContain('duolingo_nonexistent_tool');
  });

  it('missing required argument returns validation error in content', async () => {
    // duolingo_get_language_from_abbr requires language_abbr
    const result = await client.callTool({
      name: 'duolingo_get_language_from_abbr',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])
      .map((c) => c.text)
      .join('');
    expect(text).toContain('duolingo_get_language_from_abbr');
  });
});

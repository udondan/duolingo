import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DuolingoClient,
  getClient,
  resetClient,
} from '../../src/client/duolingo.js';
import {
  DuolingoAuthError,
  DuolingoCaptchaError,
  DuolingoNotFoundError,
} from '../../src/client/errors.js';
import type { DuolingoUserData } from '../../src/client/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER_DATA: DuolingoUserData = {
  username: 'testuser',
  bio: 'Test bio',
  id: 12345,
  cohort: 1,
  learning_language_string: 'French',
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
  dict_base_url: 'http://d2.duolingo.com/',
  calendar: [{ datetime: 1700000000, improvement: 10 }],
  languages: [
    {
      language: 'fr',
      language_string: 'French',
      learning: true,
      current_learning: true,
      level: 5,
      points: 1500,
      streak: 42,
    },
  ],
  language_data: {
    fr: {
      streak: 42,
      language_string: 'French',
      level_progress: 200,
      num_skills_learned: 15,
      level_percent: 40,
      level_points: 500,
      next_level: 6,
      level_left: 300,
      language: 'fr',
      points: 1500,
      fluency_score: 0.35,
      level: 5,
      calendar: [{ datetime: 1700000000, improvement: 10 }],
      skills: [
        {
          id: 'skill-1',
          name: 'Basics 1',
          title: 'Basics 1',
          learned: true,
          strength: 1.0,
          progress_percent: 100,
          words: ['bonjour', 'merci'],
          dependencies_name: [],
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Helper: create a client with a mocked http instance
// ---------------------------------------------------------------------------

function makeClientWithMockHttp(
  responses: Map<string, { status: number; data: unknown }>,
): DuolingoClient {
  const client = new DuolingoClient('testuser', 'test-jwt');

  // Replace the internal http instance with a mock
  const mockHttp = {
    get: vi.fn(async (url: string) => {
      const key = [...responses.keys()].find((k) => url.includes(k));
      if (!key)
        throw Object.assign(new Error('Network error'), {
          isAxiosError: false,
        });
      const resp = responses.get(key)!;
      if (resp.status >= 400) {
        const err = Object.assign(new Error(`HTTP ${resp.status}`), {
          isAxiosError: true,
          response: { status: resp.status, data: resp.data },
        });
        throw err;
      }
      return { data: resp.data, status: resp.status };
    }),
    post: vi.fn(async (url: string, _data: unknown) => {
      const key = [...responses.keys()].find((k) => url.includes(k));
      if (!key)
        throw Object.assign(new Error('Network error'), {
          isAxiosError: false,
        });
      const resp = responses.get(key)!;
      if (resp.status >= 400) {
        const err = Object.assign(new Error(`HTTP ${resp.status}`), {
          isAxiosError: true,
          response: { status: resp.status, data: resp.data },
        });
        throw err;
      }
      return { data: resp.data, status: resp.status };
    }),
  };

  // Inject mock http
  (client as unknown as { http: typeof mockHttp }).http = mockHttp;
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DuolingoClient', () => {
  afterEach(() => {
    resetClient();
  });

  // -------------------------------------------------------------------------
  // getUserData
  // -------------------------------------------------------------------------
  describe('getUserData', () => {
    it('fetches user data for the authenticated user', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/testuser', { status: 200, data: MOCK_USER_DATA }]]),
      );
      const data = await client.getUserData();
      expect(data.username).toBe('testuser');
      expect(data.site_streak).toBe(42);
    });

    it('fetches user data for a different username', async () => {
      const otherUser = { ...MOCK_USER_DATA, username: 'otheruser' };
      const client = makeClientWithMockHttp(
        new Map([['/users/otheruser', { status: 200, data: otherUser }]]),
      );
      const data = await client.getUserData('otheruser');
      expect(data.username).toBe('otheruser');
    });

    it('caches user data on repeated calls', async () => {
      const responses = new Map([
        ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
      ]);
      const client = makeClientWithMockHttp(responses);
      const mockGet = (
        client as unknown as { http: { get: ReturnType<typeof vi.fn> } }
      ).http.get;

      await client.getUserData();
      await client.getUserData();

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache and re-fetches after invalidateCache()', async () => {
      const responses = new Map([
        ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
      ]);
      const client = makeClientWithMockHttp(responses);
      const mockGet = (
        client as unknown as { http: { get: ReturnType<typeof vi.fn> } }
      ).http.get;

      await client.getUserData();
      client.invalidateCache('testuser');
      await client.getUserData();

      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('throws DuolingoNotFoundError on 404', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/nobody', { status: 404, data: {} }]]),
      );
      await expect(client.getUserData('nobody')).rejects.toThrow(
        DuolingoNotFoundError,
      );
    });

    it('throws DuolingoAuthError on 401', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/testuser', { status: 401, data: {} }]]),
      );
      await expect(client.getUserData()).rejects.toThrow(DuolingoAuthError);
    });

    it('throws DuolingoAuthError on 403 without blockScript', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/testuser', { status: 403, data: {} }]]),
      );
      await expect(client.getUserData()).rejects.toThrow(DuolingoAuthError);
    });

    it('throws DuolingoCaptchaError on 403 with blockScript', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 403, data: { blockScript: 'script' } }],
        ]),
      );
      await expect(client.getUserData()).rejects.toThrow(DuolingoCaptchaError);
    });
  });

  // -------------------------------------------------------------------------
  // getUserDataById
  // -------------------------------------------------------------------------
  describe('getUserDataById', () => {
    it('fetches daily progress data', async () => {
      const mockProgress = {
        xpGoal: 50,
        xpGains: [{ skillId: 'skill-1', xp: 10, time: 1700000000 }],
        streakData: { updatedTimestamp: 1700000000 },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/2023-05-23/users/12345', { status: 200, data: mockProgress }],
        ]),
      );
      const data = await client.getUserDataById(12345, [
        'xpGoal',
        'xpGains',
        'streakData',
      ]);
      expect(data.xpGoal).toBe(50);
      expect(data.xpGains).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getFollowing / getFollowers
  // -------------------------------------------------------------------------
  describe('getFollowing', () => {
    it('fetches the list of users the authenticated user follows', async () => {
      const mockFollowing = {
        following: {
          users: [
            {
              userId: 99001,
              username: 'friend1',
              displayName: 'Friend One',
              picture: '//example.com/avatar.jpg',
              totalXp: 2000,
              isFollowing: true,
              isFollowedBy: false,
              hasSubscription: false,
              userScore: { courseId: 'DUOLINGO_FR_EN', score: 150 },
            },
          ],
          totalUsers: 1,
          cursor: null,
        },
      };
      const client = makeClientWithMockHttp(
        new Map([
          [
            '/friends/users/12345/following',
            { status: 200, data: mockFollowing },
          ],
        ]),
      );
      const users = await client.getFollowing(12345);
      expect(users).toHaveLength(1);
      expect(users[0]!.username).toBe('friend1');
      expect(users[0]!.totalXp).toBe(2000);
    });
  });

  // -------------------------------------------------------------------------
  // getLeaderboard
  // -------------------------------------------------------------------------
  describe('getLeaderboard', () => {
    it('fetches leaderboard data', async () => {
      const mockLeaderboard = {
        ranking: { '99001': '2000', '12345': '1500' },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['leaderboard_activity', { status: 200, data: mockLeaderboard }],
        ]),
      );
      const data = await client.getLeaderboard('week', '1234567890');
      expect(data.ranking).toEqual({ '99001': '2000', '12345': '1500' });
    });
  });

  // -------------------------------------------------------------------------
  // getTranslations
  // -------------------------------------------------------------------------
  describe('getTranslations', () => {
    it('fetches translations for words', async () => {
      const mockTranslations = {
        bonjour: ['hello', 'good morning'],
        merci: ['thank you', 'thanks'],
      };
      // getTranslations now calls getUserData first to get dict_base_url
      const userDataWithDict = {
        ...MOCK_USER_DATA,
        dict_base_url: 'http://d2.duolingo.com/',
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: userDataWithDict }],
          ['dictionary/hints', { status: 200, data: mockTranslations }],
        ]),
      );
      const result = await client.getTranslations(
        ['bonjour', 'merci'],
        'fr',
        'en',
      );
      expect(result['bonjour']).toEqual(['hello', 'good morning']);
      expect(result['merci']).toEqual(['thank you', 'thanks']);
    });

    it('segments large word lists and makes multiple requests', async () => {
      const userDataWithDict = {
        ...MOCK_USER_DATA,
        dict_base_url: 'http://d2.duolingo.com/',
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: userDataWithDict }],
          ['dictionary/hints', { status: 200, data: {} }],
        ]),
      );
      const mockGet = (
        client as unknown as { http: { get: ReturnType<typeof vi.fn> } }
      ).http.get;

      // 2500 words exceeds the 2000-word limit
      const words = Array.from({ length: 2500 }, (_, i) => `word${i}`);
      await client.getTranslations(words, 'fr', 'en');

      // 1 call for getUserData + 3 calls for segments (2500 words → 3 segments)
      expect(mockGet).toHaveBeenCalledTimes(4);
    });
  });
});

// ---------------------------------------------------------------------------
// getClient singleton
// ---------------------------------------------------------------------------
describe('getClient', () => {
  afterEach(() => {
    resetClient();
    delete process.env['DUOLINGO_USERNAME'];
    delete process.env['DUOLINGO_JWT'];
  });

  it('throws DuolingoAuthError when DUOLINGO_USERNAME is missing', () => {
    delete process.env['DUOLINGO_USERNAME'];
    process.env['DUOLINGO_JWT'] = 'some-jwt';
    expect(() => getClient()).toThrow(DuolingoAuthError);
  });

  it('throws DuolingoAuthError when DUOLINGO_JWT is missing', () => {
    process.env['DUOLINGO_USERNAME'] = 'testuser';
    delete process.env['DUOLINGO_JWT'];
    expect(() => getClient()).toThrow(DuolingoAuthError);
  });

  it('creates a client when both env vars are set', () => {
    process.env['DUOLINGO_USERNAME'] = 'testuser';
    process.env['DUOLINGO_JWT'] = 'some-jwt';
    const client = getClient();
    expect(client).toBeInstanceOf(DuolingoClient);
  });

  it('returns the same instance on repeated calls', () => {
    process.env['DUOLINGO_USERNAME'] = 'testuser';
    process.env['DUOLINGO_JWT'] = 'some-jwt';
    const c1 = getClient();
    const c2 = getClient();
    expect(c1).toBe(c2);
  });

  it('creates a new instance after resetClient()', () => {
    process.env['DUOLINGO_USERNAME'] = 'testuser';
    process.env['DUOLINGO_JWT'] = 'some-jwt';
    const c1 = getClient();
    resetClient();
    const c2 = getClient();
    expect(c1).not.toBe(c2);
  });
});

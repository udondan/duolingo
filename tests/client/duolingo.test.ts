import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  DuolingoClient,
  getClient,
  resetClient,
} from '../../src/client/duolingo.js';
import {
  DuolingoAuthError,
  DuolingoCaptchaError,
  DuolingoClientError,
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
  calendar: [{ datetime: 1699920000000, improvement: 10 }], // 2023-11-14
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
      calendar: [{ datetime: 1699920000000, improvement: 10 }], // 2023-11-14
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

interface HttpMock {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
}

function httpMock(client: DuolingoClient): HttpMock {
  return (client as unknown as { http: HttpMock }).http;
}

/** The body of the last POST request of the client. */
function postBody(client: DuolingoClient): unknown {
  return httpMock(client).post.mock.calls.at(-1)![1];
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
          // getFollowing now calls getAuthenticatedUserId() → getUserData()
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
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
  // getLanguageVoices / extractVoiceFromTtsUrl
  // -------------------------------------------------------------------------
  describe('getLanguageVoices', () => {
    it('extracts voice names from legacy challenge tts URLs', async () => {
      // Legacy TTS URL format: https://<cdn>/<voiceName>/<hash>
      const mockSession = {
        challenges: [
          {
            prompt: 'hola',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/beaes/abc123',
          },
          {
            prompt: 'gracias',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/juniores/def456',
          },
          {
            prompt: 'adios',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/beaes/ghi789', // duplicate voice
          },
        ],
        ttsAnnotations: {},
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toContain('beaes');
      expect(voices).toContain('juniores');
      expect(voices).toHaveLength(2); // deduped
    });

    it('extracts voice names from modern tts URLs', async () => {
      // Modern TTS URL format: https://<cdn>/tts/<lang>/<voice>/token/<word>
      const mockSession = {
        challenges: [
          {
            prompt: 'hola',
            tts: 'https://d7mj4aqfscim2.cloudfront.net/tts/es/beaes/token/hola',
          },
          {
            prompt: 'gracias',
            tts: 'https://d7mj4aqfscim2.cloudfront.net/tts/es/juniores/token/gracias',
          },
          {
            // No-voice URL (tts/<lang>/token/<word>) should not produce a voice
            prompt: 'adios',
            tts: 'https://d7mj4aqfscim2.cloudfront.net/tts/es/token/adios',
          },
        ],
        ttsAnnotations: {},
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toContain('beaes');
      expect(voices).toContain('juniores');
      expect(voices).not.toContain('token'); // no-voice URL should not produce 'token'
      expect(voices).not.toContain('tts');
    });

    it('extracts voice names from ttsAnnotations keys', async () => {
      const mockSession = {
        challenges: [],
        ttsAnnotations: {
          'https://d1vq87e9lcf771.cloudfront.net/vikrames/aaa111': {},
          'https://d1vq87e9lcf771.cloudfront.net/oscares/bbb222': {},
        },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toContain('vikrames');
      expect(voices).toContain('oscares');
    });

    it('returns empty array when session is unavailable', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 500, data: {} }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toEqual([]);
    });

    it('caches voice results on repeated calls', async () => {
      const mockSession = {
        challenges: [
          {
            prompt: 'hola',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/beaes/abc123',
          },
        ],
        ttsAnnotations: {},
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const mockPost = (
        client as unknown as { http: { post: ReturnType<typeof vi.fn> } }
      ).http.post;

      await client.getLanguageVoices('es');
      await client.getLanguageVoices('es'); // second call should use cache

      // Only one POST to sessions (first call), second uses cache
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('ignores challenges and annotations without a voice', async () => {
      const mockSession = {
        challenges: [
          { prompt: 'hola' },
          {
            prompt: 'gracias',
            tts: 'https://d7mj4aqfscim2.cloudfront.net/tts/es/gracias',
          },
        ],
        ttsAnnotations: {
          'https://example.com/not-a-tts-url': {},
        },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      expect(await client.getLanguageVoices('es')).toEqual([]);
    });

    it('handles a session without ttsAnnotations', async () => {
      const mockSession = {
        challenges: [
          {
            prompt: 'hola',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/beaes/abc123',
          },
        ],
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      expect(await client.getLanguageVoices('es')).toEqual(['beaes']);
    });

    it('requests the session from German for English', async () => {
      const userData = {
        ...MOCK_USER_DATA,
        language_data: { en: MOCK_USER_DATA.language_data!.fr! },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: userData }],
          ['/2017-06-30/sessions', { status: 200, data: { challenges: [] } }],
        ]),
      );
      await client.getLanguageVoices('en');
      expect(postBody(client)).toMatchObject({
        fromLanguage: 'de',
        learningLanguage: 'en',
      });
    });

    it('requests the session from English for a learned language', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: { challenges: [] } }],
        ]),
      );
      await client.getLanguageVoices('fr');
      expect(postBody(client)).toMatchObject({ fromLanguage: 'en' });
    });

    it('requests the session from English for English if not learned', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: { challenges: [] } }],
        ]),
      );
      await client.getLanguageVoices('en');
      expect(postBody(client)).toMatchObject({ fromLanguage: 'en' });
    });

    it('works for users without language data', async () => {
      const { language_data: _, ...userData } = MOCK_USER_DATA;
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: userData }],
          ['/2017-06-30/sessions', { status: 200, data: { challenges: [] } }],
        ]),
      );
      await client.getLanguageVoices('en');
      expect(postBody(client)).toMatchObject({ fromLanguage: 'en' });
    });
  });

  // -------------------------------------------------------------------------
  // Error handling of GET requests
  // -------------------------------------------------------------------------
  describe('request errors', () => {
    it('throws DuolingoClientError on other HTTP errors', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 500, data: { error: 'boom' } }],
        ]),
      );
      await expect(client.getUserData()).rejects.toThrow(
        new DuolingoClientError('Duolingo API error 500: {"error":"boom"}'),
      );
    });

    it('re-throws errors without a response', async () => {
      const client = makeClientWithMockHttp(new Map());
      await expect(client.getUserData()).rejects.toThrow('Network error');
    });

    it('clears the whole cache with invalidateCache() without username', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/', { status: 200, data: MOCK_USER_DATA }]]),
      );
      await client.getUserData();
      await client.getUserData('otheruser');
      client.invalidateCache();
      await client.getUserData();
      await client.getUserData('otheruser');
      expect(httpMock(client).get).toHaveBeenCalledTimes(4);
    });
  });

  // -------------------------------------------------------------------------
  // getUserIdByUsername / getUserDataV2
  // -------------------------------------------------------------------------
  describe('getUserIdByUsername', () => {
    it('returns the ID of the user', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          [
            '/2023-05-23/users?fields=users%7Bid%7D&username=other%20user',
            { status: 200, data: { users: [{ id: 777 }] } },
          ],
        ]),
      );
      expect(await client.getUserIdByUsername('other user')).toBe(777);
    });

    it('throws DuolingoNotFoundError for unknown users', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/2023-05-23/users?', { status: 200, data: { users: [] } }]]),
      );
      await expect(client.getUserIdByUsername('nobody')).rejects.toThrow(
        new DuolingoNotFoundError("User 'nobody' not found."),
      );
    });
  });

  describe('getUserDataV2', () => {
    const v2 = { id: 777, username: 'other', totalXp: 100, courses: [] };

    function makeV2Client(): DuolingoClient {
      return makeClientWithMockHttp(
        new Map([
          [
            '/2023-05-23/users?',
            { status: 200, data: { users: [{ id: 777 }] } },
          ],
          ['/2023-05-23/users/777?fields=', { status: 200, data: v2 }],
        ]),
      );
    }

    it('fetches the data by numeric ID', async () => {
      const client = makeV2Client();
      expect(await client.getUserDataV2(777)).toEqual(v2);
      expect(httpMock(client).get).toHaveBeenCalledTimes(1);
    });

    it('treats a numeric string as ID', async () => {
      const client = makeV2Client();
      expect(await client.getUserDataV2('777')).toEqual(v2);
      expect(httpMock(client).get).toHaveBeenCalledTimes(1);
    });

    it('resolves a username to the ID first', async () => {
      const client = makeV2Client();
      expect(await client.getUserDataV2('other')).toEqual(v2);
      expect(httpMock(client).get).toHaveBeenCalledTimes(2);
    });

    it('treats a string that only starts with digits as username', async () => {
      const client = makeV2Client();
      await client.getUserDataV2('777abc');
      expect(httpMock(client).get.mock.calls[0]![0]).toContain(
        'username=777abc',
      );
    });

    it('caches the data per user ID', async () => {
      const client = makeV2Client();
      await client.getUserDataV2(777);
      await client.getUserDataV2('777');
      expect(httpMock(client).get).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Simple endpoints
  // -------------------------------------------------------------------------
  describe('endpoints of the authenticated user', () => {
    function makeEndpointClient(key: string, data: unknown): DuolingoClient {
      return makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          [key, { status: 200, data }],
        ]),
      );
    }

    it('getFollowers returns the followers', async () => {
      const users = [{ userId: 1, username: 'fan' }];
      const client = makeEndpointClient('/friends/users/42/followers', {
        followers: { users },
      });
      expect(await client.getFollowers(42)).toEqual(users);
      expect(httpMock(client).get.mock.calls[1]![0]).toContain(
        'viewerId=12345',
      );
    });

    it('getShopItems returns the shop items', async () => {
      const shopItems = [{ id: 'streak_freeze', price: 200 }];
      const client = makeEndpointClient('/2023-05-23/shop-items', {
        shopItems,
      });
      expect(await client.getShopItems()).toEqual(shopItems);
    });

    it('getHealth returns the health', async () => {
      const health = { hearts: 5, maxHearts: 5 };
      const client = makeEndpointClient('/users/12345?fields=health', {
        health,
      });
      expect(await client.getHealth()).toEqual(health);
    });

    it('getCurrencies returns gems and lingots only', async () => {
      const client = makeEndpointClient('/users/12345?fields=gems,lingots', {
        gems: 500,
        lingots: 20,
        other: true,
      });
      expect(await client.getCurrencies()).toEqual({ gems: 500, lingots: 20 });
    });

    it('getStreakGoalCurrent returns the streak goal', async () => {
      const goal = { hasActiveGoal: true };
      const client = makeEndpointClient(
        '/users/12345/streak-goal-current',
        goal,
      );
      expect(await client.getStreakGoalCurrent()).toEqual(goal);
    });

    it('getStreakGoalNextOptions returns the options', async () => {
      const options = { nextOptions: [7, 14] };
      const client = makeEndpointClient(
        '/users/12345/streak-goal-next-options',
        options,
      );
      expect(await client.getStreakGoalNextOptions()).toEqual(options);
    });
  });

  // -------------------------------------------------------------------------
  // getTtsBaseUrl / buildAudioUrl
  // -------------------------------------------------------------------------
  describe('buildAudioUrl', () => {
    function makeTtsClient(ttsBaseUrl?: string): DuolingoClient {
      return makeClientWithMockHttp(
        new Map([
          [
            '/users/testuser',
            {
              status: 200,
              data: { ...MOCK_USER_DATA, tts_base_url: ttsBaseUrl },
            },
          ],
        ]),
      );
    }

    it('uses the fallback CDN without tts_base_url', async () => {
      const client = makeTtsClient();
      expect(await client.getTtsBaseUrl()).toBe(
        'https://d7mj4aqfscim2.cloudfront.net/',
      );
    });

    it('normalizes tts_base_url to HTTPS with a trailing slash', async () => {
      const client = makeTtsClient('http://cdn.example.com');
      expect(await client.getTtsBaseUrl()).toBe('https://cdn.example.com/');
    });

    it('keeps an existing trailing slash', async () => {
      const client = makeTtsClient('https://cdn.example.com/');
      expect(await client.getTtsBaseUrl()).toBe('https://cdn.example.com/');
    });

    it('builds a URL with voice', async () => {
      const client = makeTtsClient('https://cdn.example.com/');
      expect(await client.buildAudioUrl('ça va', 'fr', 'mathieu')).toBe(
        'https://cdn.example.com/tts/fr/mathieu/token/%C3%A7a%20va',
      );
    });

    it('builds a URL without voice', async () => {
      const client = makeTtsClient('https://cdn.example.com/');
      expect(await client.buildAudioUrl('bonjour', 'fr')).toBe(
        'https://cdn.example.com/tts/fr/token/bonjour',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getGlobalPracticeSession / getSession
  // -------------------------------------------------------------------------
  describe('getGlobalPracticeSession', () => {
    function makeSessionClient(status: number): DuolingoClient {
      return makeClientWithMockHttp(
        new Map([
          ['/2017-06-30/sessions', { status, data: { challenges: [] } }],
        ]),
      );
    }

    it('returns the session', async () => {
      const client = makeSessionClient(200);
      expect(await client.getGlobalPracticeSession('fr', 'en')).toEqual({
        challenges: [],
      });
      expect(postBody(client)).toEqual({
        fromLanguage: 'en',
        learningLanguage: 'fr',
        challengeTypes: ['definition', 'translate'],
        type: 'GLOBAL_PRACTICE',
        juicy: true,
        smartTipsVersion: 2,
      });
    });

    it('returns null for other success statuses', async () => {
      const client = makeSessionClient(204);
      expect(await client.getGlobalPracticeSession('fr', 'en')).toBeNull();
    });

    it.each([401, 403])('throws DuolingoAuthError on %i', async (status) => {
      const client = makeSessionClient(status);
      await expect(client.getGlobalPracticeSession('fr', 'en')).rejects.toThrow(
        DuolingoAuthError,
      );
    });

    it('re-throws errors without a response', async () => {
      const client = makeClientWithMockHttp(new Map());
      await expect(client.getGlobalPracticeSession('fr', 'en')).rejects.toThrow(
        'Network error',
      );
    });

    it.each([
      ['fr', 'en'],
      ['en', 'de'],
    ])(
      'getSession requests %s from %s',
      async (learningLanguage, fromLanguage) => {
        const client = makeSessionClient(200);
        await client.getSession('skill-1', learningLanguage);
        expect(postBody(client)).toMatchObject({
          fromLanguage,
          learningLanguage,
        });
      },
    );
  });

  // -------------------------------------------------------------------------
  // Voice URL dictionary
  // -------------------------------------------------------------------------
  describe('getVoiceUrlDictionary', () => {
    const tts = (word: string): string =>
      `https://d7mj4aqfscim2.cloudfront.net/tts/fr/mathieu/token/${word}`;

    const mockSession = {
      challenges: [
        { prompt: 'Bonjour', tts: tts('bonjour') },
        { prompt: 'bonjour', tts: tts('bonjour2') },
        { prompt: 'merci' },
        {
          metadata: {
            non_character_tts: { tokens: { Salut: tts('salut') } },
          },
          tokens: [
            { value: 'chat', tts: tts('chat') },
            [{ value: 'chien', tts: tts('chien') }, [null, 'text']],
            { value: 'sans', tts: '' },
            { value: 'nope' },
          ],
        },
        { metadata: {} },
      ],
    };

    function makeDictClient(
      session: { status: number; data: unknown } = {
        status: 200,
        data: mockSession,
      },
    ): DuolingoClient {
      return makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', session],
        ]),
      );
    }

    it('collects the audio URLs of all words of a session', async () => {
      const client = makeDictClient();
      const dict = await client.getVoiceUrlDictionary('fr');
      expect(
        Object.fromEntries([...dict].map(([k, v]) => [k, [...v]])),
      ).toEqual({
        bonjour: [tts('bonjour'), tts('bonjour2')],
        salut: [tts('salut')],
        chat: [tts('chat')],
        chien: [tts('chien')],
      });
    });

    it('fetches the session only once', async () => {
      const client = makeDictClient();
      const first = await client.getVoiceUrlDictionary('fr');
      const second = await client.getVoiceUrlDictionary('fr');
      expect(second).toBe(first);
      expect(httpMock(client).post).toHaveBeenCalledTimes(1);
    });

    it('adds the words of a new session with populateVoiceUrlDictionary()', async () => {
      const client = makeDictClient();
      const dict = await client.getVoiceUrlDictionary('fr');
      await client.populateVoiceUrlDictionary('fr');
      expect(httpMock(client).post).toHaveBeenCalledTimes(2);
      expect(await client.getVoiceUrlDictionary('fr')).toBe(dict);
      expect(dict.get('bonjour')?.size).toBe(2);
    });

    it('returns an empty dictionary when the session is unavailable', async () => {
      const client = makeDictClient({ status: 500, data: {} });
      const dict = await client.getVoiceUrlDictionary('fr');
      expect(dict.size).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getClient singleton
// ---------------------------------------------------------------------------
describe('getClient', () => {
  afterEach(() => {
    resetClient();
    delete process.env.DUOLINGO_USERNAME;
    delete process.env.DUOLINGO_JWT;
  });

  it('throws DuolingoAuthError when DUOLINGO_USERNAME is missing', () => {
    delete process.env.DUOLINGO_USERNAME;
    process.env.DUOLINGO_JWT = 'some-jwt';
    expect(() => getClient()).toThrow(DuolingoAuthError);
  });

  it('throws DuolingoAuthError when DUOLINGO_JWT is missing', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    delete process.env.DUOLINGO_JWT;
    expect(() => getClient()).toThrow(DuolingoAuthError);
  });

  it('creates a client when both env vars are set', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    process.env.DUOLINGO_JWT = 'some-jwt';
    const client = getClient();
    expect(client).toBeInstanceOf(DuolingoClient);
  });

  it('returns the same instance on repeated calls', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    process.env.DUOLINGO_JWT = 'some-jwt';
    const c1 = getClient();
    const c2 = getClient();
    expect(c1).toBe(c2);
  });

  it('creates a new instance after resetClient()', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    process.env.DUOLINGO_JWT = 'some-jwt';
    const c1 = getClient();
    resetClient();
    const c2 = getClient();
    expect(c1).not.toBe(c2);
  });
});

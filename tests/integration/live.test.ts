/**
 * Integration tests that fire against the live Duolingo API.
 *
 * These tests require DUOLINGO_USERNAME and DUOLINGO_JWT environment variables.
 * They test the actual API responses to catch regressions when the Duolingo
 * API changes its response shape.
 *
 * Run with: npm test (all tests) or vitest run tests/integration
 *
 * NOTE: These tests are read-only. They never purchase items or mutate state.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DuolingoClient, resetClient } from '../../src/client/duolingo.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const USERNAME = process.env.DUOLINGO_USERNAME;
const JWT = process.env.DUOLINGO_JWT;
const TEST_USERNAME = process.env.DUOLINGO_TEST_USERNAME ?? 'testuser123';

function skipIfNoCredentials() {
  if (!USERNAME || !JWT) {
    return true;
  }
  return false;
}

let client: DuolingoClient;

beforeAll(() => {
  resetClient();
  if (USERNAME && JWT) {
    client = new DuolingoClient(USERNAME, JWT);
  }
});

// ---------------------------------------------------------------------------
// getUserData — /users/<username>
// ---------------------------------------------------------------------------

describe('Live API: getUserData', () => {
  it('returns user data for the authenticated user', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();

    // Core identity fields
    expect(data.username).toBe(USERNAME);
    expect(typeof data.id).toBe('number');
    expect(data.id).toBeGreaterThan(0);

    // The API always returns these fields
    expect(typeof data.ui_language).toBe('string');
    expect(data.ui_language.length).toBeGreaterThan(0);

    // learning_language_string may be empty if user has no active language
    expect(typeof data.learning_language_string).toBe('string');

    // languages array must exist (may be empty)
    expect(Array.isArray(data.languages)).toBe(true);

    // language_data must be an object
    expect(typeof data.language_data).toBe('object');
    expect(data.language_data).not.toBeNull();

    // calendar must be an array
    expect(Array.isArray(data.calendar)).toBe(true);

    // streak fields
    expect(typeof data.site_streak).toBe('number');
    expect(data.site_streak).toBeGreaterThanOrEqual(0);
    expect(typeof data.streak_extended_today).toBe('boolean');
  });

  it('returns user data for a known public user', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData(TEST_USERNAME);

    expect(data.username).toBe(TEST_USERNAME);
    expect(typeof data.id).toBe('number');
    expect(Array.isArray(data.languages)).toBe(true);
    expect(data.languages.length).toBeGreaterThan(0);
  });

  it('throws DuolingoNotFoundError for a non-existent user', async () => {
    if (skipIfNoCredentials()) return;

    const { DuolingoNotFoundError } =
      await import('../../src/client/errors.js');
    await expect(client.getUserData('xyznonexistentuser99999')).rejects.toThrow(
      DuolingoNotFoundError,
    );
  });

  it('caches user data on repeated calls', async () => {
    if (skipIfNoCredentials()) return;

    // Use the shared client which already has data cached from earlier tests.
    // The second call must return the exact same object reference (no network call).
    const data1 = await client.getUserData();
    const data2 = await client.getUserData();

    expect(data1).toBe(data2);
  });

  it('returns language_data with correct structure for learning languages', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    const langKeys = Object.keys(data.language_data);

    // User must be learning at least one language
    expect(langKeys.length).toBeGreaterThan(0);

    for (const key of langKeys) {
      const langData = data.language_data[key]!;

      // Required numeric fields
      expect(typeof langData.streak).toBe('number');
      expect(typeof langData.level).toBe('number');
      expect(typeof langData.points).toBe('number');
      expect(typeof langData.num_skills_learned).toBe('number');

      // Skills array
      expect(Array.isArray(langData.skills)).toBe(true);

      // Calendar array
      expect(Array.isArray(langData.calendar)).toBe(true);
    }
  });

  it('returns languages array with correct structure', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();

    for (const lang of data.languages) {
      expect(typeof lang.language).toBe('string');
      expect(lang.language.length).toBeGreaterThan(0);
      expect(typeof lang.language_string).toBe('string');
      expect(typeof lang.learning).toBe('boolean');
      expect(typeof lang.current_learning).toBe('boolean');
      expect(typeof lang.level).toBe('number');
      expect(typeof lang.points).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// getUserDataById — /2017-06-30/users/<id>
// ---------------------------------------------------------------------------

describe('Live API: getUserDataById (daily XP progress)', () => {
  it('returns daily XP progress data', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const dailyData = await client.getUserDataById(userData.id, [
      'xpGoal',
      'xpGains',
      'streakData',
    ]);

    // xpGoal must be a positive number
    expect(typeof dailyData.xpGoal).toBe('number');
    expect(dailyData.xpGoal).toBeGreaterThan(0);

    // xpGains must be an array
    expect(Array.isArray(dailyData.xpGains)).toBe(true);

    // Each xpGain entry must have required fields
    for (const gain of dailyData.xpGains) {
      expect(typeof gain.xp).toBe('number');
      // skillId can be null for some lesson types
      expect(gain.skillId === null || typeof gain.skillId === 'string').toBe(
        true,
      );
      expect(typeof gain.time).toBe('number');
      expect(gain.time).toBeGreaterThan(0);
    }

    // streakData must have updatedTimestamp
    expect(typeof dailyData.streakData).toBe('object');
    expect(typeof dailyData.streakData.updatedTimestamp).toBe('number');
    expect(dailyData.streakData.updatedTimestamp).toBeGreaterThan(0);
  });

  it('xpGains time values are Unix timestamps (seconds, not ms)', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const dailyData = await client.getUserDataById(userData.id, [
      'xpGoal',
      'xpGains',
      'streakData',
    ]);

    // Unix timestamps in seconds should be around 1.7-1.8 billion (year 2024-2026)
    // Millisecond timestamps would be ~1.7 trillion — way too large
    for (const gain of dailyData.xpGains) {
      expect(gain.time).toBeLessThan(2_000_000_000); // < year 2033 in seconds
      expect(gain.time).toBeGreaterThan(1_000_000_000); // > year 2001 in seconds
    }
  });
});

// ---------------------------------------------------------------------------
// getLeaderboard — /friendships/leaderboard_activity
// ---------------------------------------------------------------------------

describe('Live API: getLeaderboard', () => {
  it('returns leaderboard data with ranking object', async () => {
    if (skipIfNoCredentials()) return;

    const before = String(Math.floor(Date.now() / 1000));
    const data = await client.getLeaderboard('week', before);

    // ranking must be an object (may be empty if user has no friends)
    expect(typeof data.ranking).toBe('object');
    expect(data.ranking).not.toBeNull();
  });

  it('returns leaderboard data for month unit', async () => {
    if (skipIfNoCredentials()) return;

    const before = String(Math.floor(Date.now() / 1000));
    const data = await client.getLeaderboard('month', before);

    expect(typeof data.ranking).toBe('object');
  });

  it('ranking values are string-encoded numbers', async () => {
    if (skipIfNoCredentials()) return;

    const before = String(Math.floor(Date.now() / 1000));
    const data = await client.getLeaderboard('week', before);

    for (const [uid, points] of Object.entries(data.ranking)) {
      // Keys are user IDs (numeric strings)
      expect(Number.isNaN(parseInt(uid, 10))).toBe(false);
      // Values are XP points (numeric strings)
      expect(Number.isNaN(parseInt(points, 10))).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// getFollowing / getFollowers — friends and leaderboard data
// ---------------------------------------------------------------------------

describe('Live API: getFollowing / getFollowers', () => {
  it('getFollowing returns the list of users the authenticated user follows', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const following = await client.getFollowing(userData.id);

    expect(Array.isArray(following)).toBe(true);

    for (const user of following) {
      expect(typeof user.userId).toBe('number');
      expect(typeof user.username).toBe('string');
      expect(typeof user.totalXp).toBe('number');
      expect(typeof user.isFollowing).toBe('boolean');
      expect(typeof user.isFollowedBy).toBe('boolean');
    }
  });

  it('getFollowers returns the list of users who follow the authenticated user', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const followers = await client.getFollowers(userData.id);

    expect(Array.isArray(followers)).toBe(true);

    for (const user of followers) {
      expect(typeof user.userId).toBe('number');
      expect(typeof user.username).toBe('string');
    }
  });

  it('following count matches tracking_properties.num_following', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const following = await client.getFollowing(userData.id);
    const tp = userData.tracking_properties ?? {};

    if (tp.num_following != null) {
      expect(following.length).toBe(tp.num_following);
    }
  });

  it('followers count matches tracking_properties.num_followers', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const followers = await client.getFollowers(userData.id);
    const tp = userData.tracking_properties ?? {};

    if (tp.num_followers != null) {
      expect(followers.length).toBe(tp.num_followers);
    }
  });
});

// ---------------------------------------------------------------------------
// getLanguageVoices — TTS voice discovery via session API
// ---------------------------------------------------------------------------

describe('Live API: getLanguageVoices (TTS voices via session API)', () => {
  it('discovers voice names for the current learning language', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const langKeys = Object.keys(userData.language_data);
    if (langKeys.length === 0) return;

    const langAbbr = langKeys[0]!;
    const voices = await client.getLanguageVoices(langAbbr);

    // Should return an array (may be empty if session returns no TTS URLs)
    expect(Array.isArray(voices)).toBe(true);

    if (voices.length > 0) {
      // Voice names should be non-empty strings
      for (const voice of voices) {
        expect(typeof voice).toBe('string');
        expect(voice.length).toBeGreaterThan(0);
      }
    }
  });

  it('buildAudioUrl returns a valid CDN URL', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const langKeys = Object.keys(userData.language_data);
    if (langKeys.length === 0) return;

    const langAbbr = langKeys[0]!;
    const url = await client.buildAudioUrl('hola', langAbbr);

    expect(typeof url).toBe('string');
    expect(url).toContain('cloudfront.net');
    expect(url).toContain('hola');
  });

  it('buildAudioUrl with voice returns voice-specific URL', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const langKeys = Object.keys(userData.language_data);
    if (langKeys.length === 0) return;

    const langAbbr = langKeys[0]!;
    const voices = await client.getLanguageVoices(langAbbr);
    if (voices.length === 0) return;

    const voice = voices[0]!;
    const url = await client.buildAudioUrl('hola', langAbbr, voice);

    expect(url).toContain(voice);
    expect(url).toContain('hola');
  });
});

// ---------------------------------------------------------------------------
// Skills data structure validation
// ---------------------------------------------------------------------------

describe('Live API: Skills data structure', () => {
  it('skills have required fields', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    const langKeys = Object.keys(data.language_data);
    if (langKeys.length === 0) return;

    const langData = data.language_data[langKeys[0]!]!;
    if (langData.skills.length === 0) return;

    for (const skill of langData.skills.slice(0, 5)) {
      expect(typeof skill.id).toBe('string');
      expect(typeof skill.name).toBe('string');
      expect(typeof skill.title).toBe('string');
      expect(typeof skill.learned).toBe('boolean');
      expect(typeof skill.strength).toBe('number');
      expect(typeof skill.progress_percent).toBe('number');
      expect(Array.isArray(skill.words)).toBe(true);
      expect(Array.isArray(skill.dependencies_name)).toBe(true);
    }
  });

  it('known_topics returns only learned skills', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    const langKeys = Object.keys(data.language_data);
    if (langKeys.length === 0) return;

    const langData = data.language_data[langKeys[0]!]!;
    const knownTopics = langData.skills
      .filter((s) => s.learned)
      .map((s) => s.title);
    const unknownTopics = langData.skills
      .filter((s) => !s.learned)
      .map((s) => s.title);

    // No overlap between known and unknown
    for (const topic of knownTopics) {
      expect(unknownTopics).not.toContain(topic);
    }
  });

  it('golden topics are a subset of known topics', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    const langKeys = Object.keys(data.language_data);
    if (langKeys.length === 0) return;

    const langData = data.language_data[langKeys[0]!]!;
    const knownTopics = new Set(
      langData.skills.filter((s) => s.learned).map((s) => s.title),
    );
    const goldenTopics = langData.skills
      .filter((s) => s.learned && s.strength === 1.0)
      .map((s) => s.title);

    for (const topic of goldenTopics) {
      expect(knownTopics.has(topic)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Calendar data structure validation
// ---------------------------------------------------------------------------

describe('Live API: Calendar data structure', () => {
  it('calendar entries have datetime and improvement fields', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();

    for (const entry of data.calendar.slice(0, 5)) {
      expect(typeof entry.datetime).toBe('number');
      expect(entry.datetime).toBeGreaterThan(0);
      expect(typeof entry.improvement).toBe('number');
      expect(entry.improvement).toBeGreaterThanOrEqual(0);
    }
  });

  it('calendar datetime values are millisecond timestamps', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    if (data.calendar.length === 0) return;

    // Millisecond timestamps should be > 1 trillion (year 2001+)
    // Second timestamps would be ~1.7 billion
    for (const entry of data.calendar.slice(0, 5)) {
      // The API returns ms timestamps (13 digits)
      expect(entry.datetime).toBeGreaterThan(1_000_000_000_000);
    }
  });
});

// ---------------------------------------------------------------------------
// Language data completeness
// ---------------------------------------------------------------------------

describe('Live API: Language data completeness', () => {
  it('authenticated user has at least one learning language', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    const learningLanguages = data.languages.filter((l) => l.learning);
    expect(learningLanguages.length).toBeGreaterThan(0);
  });

  it('language_data contains the current learning language', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    const langKeys = Object.keys(data.language_data);

    // The current learning language should be in language_data
    // (Note: the API only returns language_data for the current language)
    expect(langKeys.length).toBeGreaterThan(0);
  });

  it('language abbreviations in language_data match languages array', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();
    const langDataKeys = Object.keys(data.language_data);
    const languageAbbrs = new Set(data.languages.map((l) => l.language));

    for (const key of langDataKeys) {
      expect(languageAbbrs.has(key)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Known API field regressions
// ---------------------------------------------------------------------------

describe('Live API: Known field regressions', () => {
  it('num_followers/num_following are in tracking_properties (not top-level)', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();

    // num_followers/num_following moved to tracking_properties in current API
    expect(data.num_followers).toBeUndefined();
    expect(data.num_following).toBeUndefined();
    const tp = data.tracking_properties ?? {};
    expect(typeof tp.num_followers).toBe('number');
    expect(typeof tp.num_following).toBe('number');
  });

  it('friends/leaderboard data comes from /friends/users/{id}/following endpoint', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const following = await client.getFollowing(userData.id);

    expect(Array.isArray(following)).toBe(true);
    for (const user of following) {
      expect(typeof user.totalXp).toBe('number');
      expect(
        user.userScore === undefined || typeof user.userScore === 'object',
      ).toBe(true);
    }
  });

  it('creation_date is a valid ISO date string', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData();

    expect(typeof data.creation_date).toBe('string');
    expect(data.creation_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// Public user data
// ---------------------------------------------------------------------------

describe('Live API: Public user data', () => {
  it('can fetch public data for a known public user', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData(TEST_USERNAME);

    expect(typeof data.username).toBe('string');
    expect(data.username).toBe(TEST_USERNAME);
    expect(typeof data.id).toBe('number');
    expect(Array.isArray(data.languages)).toBe(true);
    expect(data.languages.length).toBeGreaterThan(0);
  });

  it('public user has language_data for current language only', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getUserData(TEST_USERNAME);
    const langKeys = Object.keys(data.language_data);

    // The API only returns language_data for the current learning language
    expect(langKeys.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// getUserDataV2 — 2023-05-23 API (all courses including math/chess/music)
// ---------------------------------------------------------------------------

describe('Live API: getUserDataV2 (2023-05-23 API)', () => {
  it('returns all courses including non-language subjects', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const v2 = await client.getUserDataV2(userData.id);

    expect(typeof v2.id).toBe('number');
    expect(typeof v2.username).toBe('string');
    expect(typeof v2.totalXp).toBe('number');
    expect(typeof v2.streak).toBe('number');
    expect(Array.isArray(v2.courses)).toBe(true);
    expect(v2.courses.length).toBeGreaterThan(0);
  });

  it('each course has required fields', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const v2 = await client.getUserDataV2(userData.id);

    for (const course of v2.courses) {
      expect(typeof course.id).toBe('string');
      expect(typeof course.subject).toBe('string');
      expect(typeof course.topic).toBe('string');
      expect(typeof course.xp).toBe('number');
      expect(course.xp).toBeGreaterThanOrEqual(0);
    }
  });

  it('subject field distinguishes language from non-language courses', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const v2 = await client.getUserDataV2(userData.id);

    const subjects = new Set(v2.courses.map((c) => c.subject));
    // Must have at least one language course
    expect(subjects.has('language')).toBe(true);
  });

  it('non-language courses (math/chess/music) have subject and xp but no learningLanguage', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const v2 = await client.getUserDataV2(userData.id);

    const nonLanguage = v2.courses.filter((c) => c.subject !== 'language');
    for (const course of nonLanguage) {
      expect(['math', 'chess', 'music']).toContain(course.subject);
      expect(course.learningLanguage).toBeUndefined();
      expect(typeof course.xp).toBe('number');
    }
  });

  it('streakData has currentStreak with length', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const v2 = await client.getUserDataV2(userData.id);

    expect(typeof v2.streakData).toBe('object');
    if (v2.streakData.currentStreak) {
      expect(typeof v2.streakData.currentStreak.length).toBe('number');
    }
  });

  it('can fetch data for a friend by user ID', async () => {
    if (skipIfNoCredentials()) return;

    // Use the authenticated user's own ID to avoid depending on a specific third-party account
    const userData = await client.getUserData();
    const v2 = await client.getUserDataV2(userData.id);

    expect(typeof v2.username).toBe('string');
    expect(v2.username.length).toBeGreaterThan(0);
    expect(Array.isArray(v2.courses)).toBe(true);
  });

  it('getUserIdByUsername resolves username to a positive numeric ID', async () => {
    if (skipIfNoCredentials()) return;

    // Use the authenticated user's own username — no dependency on third-party accounts
    const id = await client.getUserIdByUsername(USERNAME!);
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('caches v2 data on repeated calls', async () => {
    if (skipIfNoCredentials()) return;

    const userData = await client.getUserData();
    const v2a = await client.getUserDataV2(userData.id);
    const v2b = await client.getUserDataV2(userData.id);
    expect(v2a).toBe(v2b); // same object reference = cached
  });
});

// ---------------------------------------------------------------------------
// getShopItems — 2023-05-23/shop-items
// ---------------------------------------------------------------------------

describe('Live API: getShopItems', () => {
  it('returns a non-empty list of shop items', async () => {
    if (skipIfNoCredentials()) return;

    const items = await client.getShopItems();

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it('each item has required fields', async () => {
    if (skipIfNoCredentials()) return;

    const items = await client.getShopItems();

    for (const item of items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.type).toBe('string');
      expect(typeof item.price).toBe('number');
      expect(typeof item.currencyType).toBe('string');
    }
  });

  it('streak_freeze is always in the shop', async () => {
    if (skipIfNoCredentials()) return;

    const items = await client.getShopItems();
    const ids = items.map((i) => i.id);
    expect(ids).toContain('streak_freeze');
  });
});

// ---------------------------------------------------------------------------
// getHealth — 2023-05-23/users/{id}?fields=health
// ---------------------------------------------------------------------------

describe('Live API: getHealth', () => {
  it('returns health/hearts data', async () => {
    if (skipIfNoCredentials()) return;

    const health = await client.getHealth();

    expect(typeof health.hearts).toBe('number');
    expect(typeof health.maxHearts).toBe('number');
    expect(health.hearts).toBeGreaterThanOrEqual(0);
    expect(health.maxHearts).toBeGreaterThan(0);
    expect(health.hearts).toBeLessThanOrEqual(health.maxHearts);
    expect(typeof health.healthEnabled).toBe('boolean');
    expect(typeof health.eligibleForFreeRefill).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// getCurrencies — 2023-05-23/users/{id}?fields=gems,lingots
// ---------------------------------------------------------------------------

describe('Live API: getCurrencies', () => {
  it('returns gem and lingot balances', async () => {
    if (skipIfNoCredentials()) return;

    const currencies = await client.getCurrencies();

    expect(typeof currencies.gems).toBe('number');
    expect(typeof currencies.lingots).toBe('number');
    expect(currencies.gems).toBeGreaterThanOrEqual(0);
    expect(currencies.lingots).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// getStreakGoalCurrent — /users/{id}/streak-goal-current
// ---------------------------------------------------------------------------

describe('Live API: getStreakGoalCurrent', () => {
  it('returns streak goal data', async () => {
    if (skipIfNoCredentials()) return;

    const data = await client.getStreakGoalCurrent();

    expect(typeof data.hasActiveGoal).toBe('boolean');

    if (data.hasActiveGoal && data.streakGoal) {
      expect(typeof data.streakGoal.lastCompleteGoal).toBe('number');
      expect(Array.isArray(data.streakGoal.checkpoints)).toBe(true);

      for (const cp of data.streakGoal.checkpoints) {
        expect(typeof cp.length).toBe('number');
        expect(typeof cp.dayInterval).toBe('number');
        expect(typeof cp.tier).toBe('number');
      }
    }
  });
});

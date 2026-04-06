/**
 * Package export tests.
 *
 * These tests verify that the public API surface of @udondan/duolingo is
 * correct and stable. They import exclusively from the package entry point
 * (src/index.ts) — never from internal paths — to catch any accidental
 * omissions or regressions in what the package exposes.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Import everything from the public entry point
// ---------------------------------------------------------------------------
import {
  // Runtime exports
  DuolingoClient,
  getClient,
  resetClient,
  DuolingoClientError,
  DuolingoAuthError,
  DuolingoNotFoundError,
  DuolingoCaptchaError,
  DuolingoLanguageNotFoundError,
} from '../../src/index.js';

// Type-only imports — these are compile-time checks; if a type is missing
// from the public API the TypeScript compiler will fail the build.
import type {
  DuolingoUserData,
  DuolingoUserDataV2,
  DuolingoLanguage,
  DuolingoLanguageData,
  DuolingoCalendarEntry,
  DuolingoSkill,
  DuolingoTrackingProperties,
  DuolingoCourse,
  DuolingoFriendUser,
  DuolingoFollowingResponse,
  DuolingoFollowersResponse,
  DuolingoDailyProgress,
  DuolingoXpGain,
  DuolingoStreakData,
  DuolingoStreakDataV2,
  DuolingoStreakInfo,
  DuolingoStreakGoal,
  DuolingoStreakGoalCheckpoint,
  DuolingoStreakGoalCurrentResponse,
  DuolingoStreakGoalNextOptionsResponse,
  DuolingoStreakGoalOption,
  DuolingoShopItem,
  DuolingoHealth,
  DuolingoLeaderboardData,
  DuolingoSessionRequest,
  DuolingoSessionResponse,
  DuolingoChallenge,
  DuolingoToken,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Runtime value exports
// ---------------------------------------------------------------------------

describe('Package exports: runtime values', () => {
  describe('DuolingoClient', () => {
    it('is exported as a class (function)', () => {
      expect(typeof DuolingoClient).toBe('function');
    });

    it('can be instantiated with username and jwt', () => {
      const client = new DuolingoClient('testuser', 'testjwt');
      expect(client).toBeInstanceOf(DuolingoClient);
    });

    it('exposes all expected public methods', () => {
      const client = new DuolingoClient('testuser', 'testjwt');
      const expectedMethods = [
        'getUserData',
        'getUserDataById',
        'getUserDataV2',
        'getUserIdByUsername',
        'getFollowing',
        'getFollowers',
        'getLeaderboard',
        'getShopItems',
        'getHealth',
        'getCurrencies',
        'getStreakGoalCurrent',
        'getStreakGoalNextOptions',
        'getLanguageVoices',
        'buildAudioUrl',
        'getGlobalPracticeSession',
        'getVoiceUrlDictionary',
        'invalidateCache',
      ];
      for (const method of expectedMethods) {
        expect(
          typeof (client as unknown as Record<string, unknown>)[method],
          `DuolingoClient.${method} should be a function`,
        ).toBe('function');
      }
    });
  });

  describe('getClient / resetClient', () => {
    it('getClient is exported as a function', () => {
      expect(typeof getClient).toBe('function');
    });

    it('resetClient is exported as a function', () => {
      expect(typeof resetClient).toBe('function');
    });

    it('resetClient clears the singleton so getClient throws without env vars', () => {
      resetClient();
      const savedUsername = process.env.DUOLINGO_USERNAME;
      const savedJwt = process.env.DUOLINGO_JWT;
      delete process.env.DUOLINGO_USERNAME;
      delete process.env.DUOLINGO_JWT;

      expect(() => getClient()).toThrow(DuolingoAuthError);

      // Restore
      if (savedUsername) process.env.DUOLINGO_USERNAME = savedUsername;
      if (savedJwt) process.env.DUOLINGO_JWT = savedJwt;
      resetClient();
    });
  });

  describe('Error classes', () => {
    it('DuolingoClientError is exported and constructable', () => {
      const err = new DuolingoClientError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DuolingoClientError);
      expect(err.message).toBe('test');
      expect(err.name).toBe('DuolingoClientError');
    });

    it('DuolingoAuthError extends DuolingoClientError', () => {
      const err = new DuolingoAuthError('auth failed');
      expect(err).toBeInstanceOf(DuolingoClientError);
      expect(err).toBeInstanceOf(DuolingoAuthError);
      expect(err.name).toBe('DuolingoAuthError');
    });

    it('DuolingoNotFoundError extends DuolingoClientError', () => {
      const err = new DuolingoNotFoundError('not found');
      expect(err).toBeInstanceOf(DuolingoClientError);
      expect(err).toBeInstanceOf(DuolingoNotFoundError);
      expect(err.name).toBe('DuolingoNotFoundError');
    });

    it('DuolingoCaptchaError extends DuolingoClientError', () => {
      const err = new DuolingoCaptchaError();
      expect(err).toBeInstanceOf(DuolingoClientError);
      expect(err).toBeInstanceOf(DuolingoCaptchaError);
      expect(err.name).toBe('DuolingoCaptchaError');
    });

    it('DuolingoLanguageNotFoundError extends DuolingoClientError', () => {
      const err = new DuolingoLanguageNotFoundError('fr');
      expect(err).toBeInstanceOf(DuolingoClientError);
      expect(err).toBeInstanceOf(DuolingoLanguageNotFoundError);
      expect(err.name).toBe('DuolingoLanguageNotFoundError');
    });

    it('error instanceof checks work correctly across the hierarchy', () => {
      const errors = [
        new DuolingoAuthError('x'),
        new DuolingoNotFoundError('x'),
        new DuolingoCaptchaError(),
        new DuolingoLanguageNotFoundError('fr'),
      ];
      for (const err of errors) {
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(DuolingoClientError);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Type-level checks (compile-time only)
// These functions are never called — they exist purely to make TypeScript
// verify that the exported types have the expected shapes.
// ---------------------------------------------------------------------------

describe('Package exports: type shapes (compile-time)', () => {
  it('DuolingoUserData has required fields', () => {
    // This is a compile-time check — if the type is wrong, tsc fails
    const _check = (d: DuolingoUserData) => {
      const _username: string = d.username;
      const _id: number = d.id;
      const _site_streak: number = d.site_streak;
      const _languages: DuolingoLanguage[] = d.languages;
      const _language_data: Record<string, DuolingoLanguageData> =
        d.language_data;
      const _calendar: DuolingoCalendarEntry[] = d.calendar;
    };
    expect(typeof _check).toBe('function');
  });

  it('DuolingoUserDataV2 has required fields', () => {
    const _check = (d: DuolingoUserDataV2) => {
      const _id: number = d.id;
      const _username: string = d.username;
      const _totalXp: number = d.totalXp;
      const _streak: number = d.streak;
      const _courses: DuolingoCourse[] = d.courses;
      const _hasPlus: boolean = d.hasPlus;
      const _subscriberLevel: string = d.subscriberLevel;
    };
    expect(typeof _check).toBe('function');
  });

  it('DuolingoCourse has subject field for non-language courses', () => {
    const _check = (c: DuolingoCourse) => {
      const _id: string = c.id;
      const _subject: string = c.subject;
      const _topic: string = c.topic;
      const _xp: number = c.xp;
      // Optional fields for language courses
      const _title: string | undefined = c.title;
      const _learningLanguage: string | undefined = c.learningLanguage;
    };
    expect(typeof _check).toBe('function');
  });

  it('DuolingoFriendUser has social fields', () => {
    const _check = (u: DuolingoFriendUser) => {
      const _userId: number = u.userId;
      const _username: string = u.username;
      const _totalXp: number = u.totalXp;
      const _isFollowing: boolean = u.isFollowing;
      const _isFollowedBy: boolean = u.isFollowedBy;
    };
    expect(typeof _check).toBe('function');
  });

  it('DuolingoShopItem has price and currencyType', () => {
    const _check = (i: DuolingoShopItem) => {
      const _id: string = i.id;
      const _type: string = i.type;
      const _price: number = i.price;
      const _currencyType: string = i.currencyType;
    };
    expect(typeof _check).toBe('function');
  });

  it('DuolingoHealth has hearts fields', () => {
    const _check = (h: DuolingoHealth) => {
      const _hearts: number = h.hearts;
      const _maxHearts: number = h.maxHearts;
      const _healthEnabled: boolean = h.healthEnabled;
      const _eligibleForFreeRefill: boolean = h.eligibleForFreeRefill;
    };
    expect(typeof _check).toBe('function');
  });

  it('DuolingoStreakGoalCurrentResponse has hasActiveGoal', () => {
    const _check = (r: DuolingoStreakGoalCurrentResponse) => {
      const _hasActiveGoal: boolean = r.hasActiveGoal;
      const _goal: DuolingoStreakGoal | null = r.streakGoal;
    };
    expect(typeof _check).toBe('function');
  });

  it('DuolingoXpGain has nullable skillId', () => {
    const _check = (g: DuolingoXpGain) => {
      const _xp: number = g.xp;
      const _time: number = g.time;
      // skillId is string | null — both must be assignable
      const _skillId: string | null = g.skillId;
    };
    expect(typeof _check).toBe('function');
  });

  // Verify all type imports resolve (if any are missing, tsc fails)
  it('all exported types are importable', () => {
    // These variables are typed with every exported type.
    // If any type is removed from the public API, tsc will fail here.
    type _AllTypes =
      | DuolingoUserData
      | DuolingoUserDataV2
      | DuolingoLanguage
      | DuolingoLanguageData
      | DuolingoCalendarEntry
      | DuolingoSkill
      | DuolingoTrackingProperties
      | DuolingoCourse
      | DuolingoFriendUser
      | DuolingoFollowingResponse
      | DuolingoFollowersResponse
      | DuolingoDailyProgress
      | DuolingoXpGain
      | DuolingoStreakData
      | DuolingoStreakDataV2
      | DuolingoStreakInfo
      | DuolingoStreakGoal
      | DuolingoStreakGoalCheckpoint
      | DuolingoStreakGoalCurrentResponse
      | DuolingoStreakGoalNextOptionsResponse
      | DuolingoStreakGoalOption
      | DuolingoShopItem
      | DuolingoHealth
      | DuolingoLeaderboardData
      | DuolingoSessionRequest
      | DuolingoSessionResponse
      | DuolingoChallenge
      | DuolingoToken;

    // Dummy assertion to prevent "unused variable" warnings
    const _dummy: _AllTypes | undefined = undefined;
    expect(_dummy).toBeUndefined();
  });
});

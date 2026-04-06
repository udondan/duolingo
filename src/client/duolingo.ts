/**
 * Native TypeScript Duolingo API client.
 *
 * Calls the unofficial Duolingo REST API directly using axios.
 * No third-party Duolingo library dependency.
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
  DuolingoAuthError,
  DuolingoCaptchaError,
  DuolingoClientError,
  DuolingoNotFoundError,
} from './errors.js';
import type {
  DuolingoUserData,
  DuolingoDailyProgress,
  DuolingoLeaderboardData,
  DuolingoFollowingResponse,
  DuolingoFollowersResponse,
  DuolingoFriendUser,
  DuolingoUserDataV2,
  DuolingoUserIdResponse,
  DuolingoShopItemsResponse,
  DuolingoShopItem,
  DuolingoHealth,
  DuolingoStreakGoalCurrentResponse,
  DuolingoStreakGoalNextOptionsResponse,
  DuolingoSessionRequest,
  DuolingoSessionResponse,
} from './types.js';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36';

const BASE_URL = 'https://www.duolingo.com';

/**
 * Fallback TTS CDN base URL used when the user data does not provide one.
 * The actual URL is returned in the /users/<username> response as `tts_base_url`.
 */
const FALLBACK_TTS_BASE_URL = 'https://d7mj4aqfscim2.cloudfront.net/';

export class DuolingoClient {
  private readonly http: AxiosInstance;
  private readonly username: string;
  private readonly jwt: string;

  /** Cache of user data keyed by username. */
  private readonly userDataCache = new Map<string, DuolingoUserData>();

  /** Cache of v2 user data keyed by numeric user ID. */
  private readonly userDataV2Cache = new Map<number, DuolingoUserDataV2>();

  /**
   * Cached set of voice names discovered for each language via the session API.
   * lang → Set<voiceName>
   */
  private voiceCache = new Map<string, Set<string>>();

  /** Voice URL dictionary: lang → word → Set<url> */
  private voiceUrlDict = new Map<string, Map<string, Set<string>>>();

  constructor(username: string, jwt: string) {
    this.username = username;
    this.jwt = jwt;

    this.http = axios.create({
      headers: {
        Authorization: `Bearer ${jwt}`,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Core data fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch user data from /users/<username>.
   * Results are cached per username for the lifetime of this client instance.
   */
  async getUserData(username?: string): Promise<DuolingoUserData> {
    const target = username ?? this.username;
    const cached = this.userDataCache.get(target);
    if (cached) return cached;

    const url = `${BASE_URL}/users/${encodeURIComponent(target)}`;
    const resp = await this.makeRequest<DuolingoUserData>(url);
    this.userDataCache.set(target, resp);
    return resp;
  }

  /**
   * Invalidate the user data cache for a specific username (or all).
   */
  invalidateCache(username?: string): void {
    if (username) {
      this.userDataCache.delete(username);
    } else {
      this.userDataCache.clear();
    }
  }

  /**
   * Fetch daily XP progress data for a user.
   * Uses the 2023-05-23 API which supersedes the 2017-06-30 endpoint.
   */
  async getUserDataById(
    userId: number,
    fields: string[],
  ): Promise<DuolingoDailyProgress> {
    const ts = Date.now();
    const fieldsParam = encodeURIComponent(fields.join(','));
    const url = `${BASE_URL}/2023-05-23/users/${userId}?fields=${fieldsParam}&_=${ts}`;
    return this.makeRequest<DuolingoDailyProgress>(url);
  }

  /**
   * Get the list of users the given user is following.
   * Uses the 2023-05-23 API which supersedes the 2017-06-30 endpoint.
   *
   * The `viewerId` must be the authenticated user's ID (not the target user's ID).
   */
  async getFollowing(userId: number): Promise<DuolingoFriendUser[]> {
    const ts = Date.now();
    const viewerId = await this.getAuthenticatedUserId();
    const url = `${BASE_URL}/2023-05-23/friends/users/${userId}/following?pageSize=500&viewerId=${viewerId}&_=${ts}`;
    const resp = await this.makeRequest<DuolingoFollowingResponse>(url);
    return resp.following.users;
  }

  /**
   * Get the list of users who follow the given user.
   * Uses the 2023-05-23 API which supersedes the 2017-06-30 endpoint.
   *
   * The `viewerId` must be the authenticated user's ID (not the target user's ID).
   */
  async getFollowers(userId: number): Promise<DuolingoFriendUser[]> {
    const ts = Date.now();
    const viewerId = await this.getAuthenticatedUserId();
    const url = `${BASE_URL}/2023-05-23/friends/users/${userId}/followers?pageSize=500&viewerId=${viewerId}&_=${ts}`;
    const resp = await this.makeRequest<DuolingoFollowersResponse>(url);
    return resp.followers.users;
  }

  /**
   * Resolve a username to a numeric user ID using the 2023-05-23 API.
   * Throws DuolingoNotFoundError if the username does not exist.
   */
  async getUserIdByUsername(username: string): Promise<number> {
    const ts = Date.now();
    const url = `${BASE_URL}/2023-05-23/users?fields=users%7Bid%7D&username=${encodeURIComponent(username)}&_=${ts}`;
    const resp = await this.makeRequest<DuolingoUserIdResponse>(url);
    const id = resp.users[0]?.id;
    if (id === undefined) {
      throw new DuolingoNotFoundError(`User '${username}' not found.`);
    }
    return id;
  }

  /**
   * Fetch rich user data from the 2023-05-23 API.
   * Returns all courses including non-language subjects (math, chess, music),
   * plus streak data, subscriber level, and more.
   *
   * Accepts either a numeric user ID or a username string.
   * Results are cached per user ID for the lifetime of this client instance.
   */
  async getUserDataV2(
    userIdOrUsername: number | string,
  ): Promise<DuolingoUserDataV2> {
    // Resolve username to ID if needed
    let userId: number;
    if (typeof userIdOrUsername === 'string') {
      // Check if it looks like a number
      const parsed = parseInt(userIdOrUsername, 10);
      if (!isNaN(parsed) && String(parsed) === userIdOrUsername) {
        userId = parsed;
      } else {
        userId = await this.getUserIdByUsername(userIdOrUsername);
      }
    } else {
      userId = userIdOrUsername;
    }

    const cached = this.userDataV2Cache.get(userId);
    if (cached) return cached;

    const ts = Date.now();
    const fields = [
      'courses',
      'creationDate',
      'fromLanguage',
      'hasPlus',
      'id',
      'learningLanguage',
      'location',
      'name',
      'picture',
      'streak',
      'streakData{currentStreak,previousStreak,longestStreak,updatedTimestamp}',
      'subscriberLevel',
      'totalXp',
      'username',
    ].join(',');
    const url = `${BASE_URL}/2023-05-23/users/${userId}?fields=${encodeURIComponent(fields)}&_=${ts}`;
    const resp = await this.makeRequest<DuolingoUserDataV2>(url);
    this.userDataV2Cache.set(userId, resp);
    return resp;
  }

  /**
   * Get the full shop item catalogue from the 2023-05-23 API.
   * Returns all purchasable items with prices, types, and last-used dates.
   * This is a read-only endpoint — it does not purchase anything.
   */
  async getShopItems(): Promise<DuolingoShopItem[]> {
    const ts = Date.now();
    const url = `${BASE_URL}/2023-05-23/shop-items?_=${ts}`;
    const resp = await this.makeRequest<DuolingoShopItemsResponse>(url);
    return resp.shopItems;
  }

  /**
   * Get the authenticated user's current hearts/health status.
   * Returns heart count, max hearts, refill eligibility, and timing.
   */
  async getHealth(): Promise<DuolingoHealth> {
    const ts = Date.now();
    const url = `${BASE_URL}/2023-05-23/users/${await this.getAuthenticatedUserId()}?fields=health&_=${ts}`;
    const resp = await this.makeRequest<{ health: DuolingoHealth }>(url);
    return resp.health;
  }

  /**
   * Get the authenticated user's gem and lingot balances.
   */
  async getCurrencies(): Promise<{ gems: number; lingots: number }> {
    const ts = Date.now();
    const url = `${BASE_URL}/2023-05-23/users/${await this.getAuthenticatedUserId()}?fields=gems,lingots&_=${ts}`;
    const resp = await this.makeRequest<{ gems: number; lingots: number }>(url);
    return { gems: resp.gems, lingots: resp.lingots };
  }

  /**
   * Get the authenticated user's current streak goal.
   */
  async getStreakGoalCurrent(): Promise<DuolingoStreakGoalCurrentResponse> {
    const ts = Date.now();
    const userId = await this.getAuthenticatedUserId();
    const url = `${BASE_URL}/users/${userId}/streak-goal-current?_=${ts}`;
    return this.makeRequest<DuolingoStreakGoalCurrentResponse>(url);
  }

  /**
   * Get the available next streak goal options for the authenticated user.
   */
  async getStreakGoalNextOptions(): Promise<DuolingoStreakGoalNextOptionsResponse> {
    const ts = Date.now();
    const userId = await this.getAuthenticatedUserId();
    const url = `${BASE_URL}/users/${userId}/streak-goal-next-options?_=${ts}`;
    return this.makeRequest<DuolingoStreakGoalNextOptionsResponse>(url);
  }

  /**
   * Get the numeric user ID of the authenticated user.
   * Cached via getUserData().
   */
  private async getAuthenticatedUserId(): Promise<number> {
    const userData = await this.getUserData();
    return userData.id;
  }

  /**
   * Get leaderboard data for a time unit.
   * Note: the /friendships/leaderboard_activity endpoint returns an empty ranking
   * for most users. Prefer getFollowing() and sort by weeklyXp/monthlyXp instead.
   */
  async getLeaderboard(
    unit: string,
    before: string,
  ): Promise<DuolingoLeaderboardData> {
    const url = `${BASE_URL}/friendships/leaderboard_activity?unit=${encodeURIComponent(unit)}&_=${encodeURIComponent(before)}`;
    return this.makeRequest<DuolingoLeaderboardData>(url);
  }

  /**
   * Get the TTS base URL for the authenticated user.
   * Falls back to the known CDN URL if not present in user data.
   */
  async getTtsBaseUrl(): Promise<string> {
    const userData = await this.getUserData();
    return this.normalizeTtsBaseUrl(userData.tts_base_url);
  }

  /**
   * Discover available TTS voice names for a language by making a single
   * GLOBAL_PRACTICE session request and extracting voice names from the
   * TTS CDN URLs returned in the challenges.
   *
   * Voice names are extracted from URLs of the form:
   *   https://<cdn>/<voiceName>/<hash>
   *
   * Results are cached per language.
   */
  async getLanguageVoices(langAbbr: string): Promise<string[]> {
    const cached = this.voiceCache.get(langAbbr);
    if (cached !== undefined) {
      return [...cached];
    }

    const userData = await this.getUserData();
    const langData = userData.language_data[langAbbr];
    const fromLanguage = langData ? (langAbbr !== 'en' ? 'en' : 'de') : 'en';

    const session = await this.getGlobalPracticeSession(langAbbr, fromLanguage);

    const voices = new Set<string>();
    if (session) {
      // Extract voice names from TTS URLs in challenges
      for (const challenge of session.challenges) {
        const voiceName = this.extractVoiceFromTtsUrl(challenge.tts);
        if (voiceName) voices.add(voiceName);
      }
      // Also extract from ttsAnnotations keys
      for (const url of Object.keys(session.ttsAnnotations ?? {})) {
        const voiceName = this.extractVoiceFromTtsUrl(url);
        if (voiceName) voices.add(voiceName);
      }
    }

    this.voiceCache.set(langAbbr, voices);
    return [...voices];
  }

  /**
   * Build a TTS audio URL for a word using the tts_base_url from user data.
   *
   * URL format: {ttsBaseUrl}tts/{lang}/{voice}/token/{word}
   * Without voice: {ttsBaseUrl}tts/{lang}/token/{word}
   */
  async buildAudioUrl(
    word: string,
    langAbbr: string,
    voice?: string,
  ): Promise<string> {
    const ttsBaseUrl = await this.getTtsBaseUrl();
    const base = ttsBaseUrl.endsWith('/') ? ttsBaseUrl : `${ttsBaseUrl}/`;
    const encodedWord = encodeURIComponent(word);
    if (voice) {
      return `${base}tts/${langAbbr}/${voice}/token/${encodedWord}`;
    }
    return `${base}tts/${langAbbr}/token/${encodedWord}`;
  }

  /**
   * Fetch a GLOBAL_PRACTICE session for a language.
   * Used to discover TTS voice names and audio URLs.
   */
  async getGlobalPracticeSession(
    langAbbr: string,
    fromLanguage: string,
  ): Promise<DuolingoSessionResponse | null> {
    const url = `${BASE_URL}/2017-06-30/sessions`;
    const data: DuolingoSessionRequest = {
      fromLanguage,
      learningLanguage: langAbbr,
      challengeTypes: ['definition', 'translate'],
      type: 'GLOBAL_PRACTICE',
      juicy: true,
      smartTipsVersion: 2,
    };

    let resp: AxiosResponse<DuolingoSessionResponse>;
    try {
      resp = await this.http.post<DuolingoSessionResponse>(url, data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        // Surface auth errors so callers know credentials are invalid
        if (status === 401 || status === 403) {
          throw new DuolingoAuthError(
            'Authentication failed while starting a practice session.',
          );
        }
        // Other HTTP errors (e.g. 404, 500) are non-fatal for voice discovery
        return null;
      }
      throw err;
    }

    if (resp.status !== 200) return null;
    return resp.data;
  }

  /**
   * Fetch a practice session for a skill.
   * Note: SKILL_PRACTICE is no longer supported by the API.
   * Delegates to getGlobalPracticeSession instead.
   */
  async getSession(
    _skillId: string,
    langAbbr: string,
  ): Promise<DuolingoSessionResponse | null> {
    return this.getGlobalPracticeSession(
      langAbbr,
      langAbbr !== 'en' ? 'en' : 'de',
    );
  }

  // ---------------------------------------------------------------------------
  // Voice URL dictionary
  // ---------------------------------------------------------------------------

  /**
   * Populate the voice URL dictionary for a language by scraping a session.
   * Uses GLOBAL_PRACTICE (the only supported session type in the current API).
   */
  async populateVoiceUrlDictionary(langAbbr: string): Promise<void> {
    if (!this.voiceUrlDict.has(langAbbr)) {
      this.voiceUrlDict.set(langAbbr, new Map());
    }
    // Safe: we just set it above if it wasn't present
    const langDict =
      this.voiceUrlDict.get(langAbbr) ?? new Map<string, Set<string>>();
    this.voiceUrlDict.set(langAbbr, langDict);

    const userData = await this.getUserData();
    const langData = userData.language_data[langAbbr];
    const fromLanguage = langData ? (langAbbr !== 'en' ? 'en' : 'de') : 'en';

    const session = await this.getGlobalPracticeSession(langAbbr, fromLanguage);
    if (!session) return;

    for (const challenge of session.challenges) {
      if (challenge.prompt && challenge.tts) {
        this.addToVoiceUrlDict(langDict, challenge.prompt, challenge.tts);
      }
      if (challenge.metadata?.non_character_tts?.tokens) {
        for (const [word, url] of Object.entries(
          challenge.metadata.non_character_tts.tokens,
        )) {
          this.addToVoiceUrlDict(langDict, word, url);
        }
      }
      if (challenge.tokens) {
        this.addTokenListToVoiceUrlDict(langDict, challenge.tokens);
      }
    }
  }

  /**
   * Get the voice URL dictionary for a language, populating it if needed.
   */
  async getVoiceUrlDictionary(
    langAbbr: string,
  ): Promise<Map<string, Set<string>>> {
    if (!this.voiceUrlDict.has(langAbbr)) {
      await this.populateVoiceUrlDictionary(langAbbr);
    }
    return this.voiceUrlDict.get(langAbbr) ?? new Map();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract the voice name from a Duolingo TTS CDN URL.
   * Supports two URL formats:
   *   Legacy: https://<cdn>/<voice>/<hash>
   *   Modern: https://<cdn>/tts/<lang>/<voice>/token/<word>
   */
  private extractVoiceFromTtsUrl(url?: string): string | null {
    if (!url) return null;
    // Modern format: .../tts/<lang>/<voice>/token/<word>
    const modern = /cloudfront\.net\/tts\/[^/]+\/([^/]+)\/token\//.exec(url);
    if (modern) return modern[1] ?? null;
    // Legacy format: .../<voice>/<hash> — only applies to non-/tts/ URLs
    if (url.includes('/tts/')) return null;
    const legacy = /cloudfront\.net\/([^/]+)\/[^/]+$/.exec(url);
    return legacy?.[1] ?? null;
  }

  /**
   * Normalize a TTS base URL to always end with a slash and use HTTPS.
   */
  private normalizeTtsBaseUrl(raw?: string): string {
    if (!raw) return FALLBACK_TTS_BASE_URL;
    const url = raw.replace(/^http:\/\//, 'https://');
    return url.endsWith('/') ? url : `${url}/`;
  }

  private addToVoiceUrlDict(
    dict: Map<string, Set<string>>,
    word: string,
    url: string,
  ): void {
    const key = word.toLowerCase();
    const existing = dict.get(key);
    if (existing !== undefined) {
      existing.add(url);
    } else {
      dict.set(key, new Set([url]));
    }
  }

  private addTokenListToVoiceUrlDict(
    dict: Map<string, Set<string>>,
    tokens: unknown[],
  ): void {
    for (const token of tokens) {
      if (Array.isArray(token)) {
        this.addTokenListToVoiceUrlDict(dict, token);
      } else if (
        token !== null &&
        typeof token === 'object' &&
        'tts' in token &&
        'value' in token
      ) {
        const t = token as { tts?: string; value?: string };
        if (t.tts && t.value) {
          this.addToVoiceUrlDict(dict, t.value, t.tts);
        }
      }
    }
  }

  private async makeRequest<T>(url: string, data?: unknown): Promise<T> {
    let resp: AxiosResponse<T>;
    try {
      if (data !== undefined) {
        resp = await this.http.post<T>(url, data);
      } else {
        resp = await this.http.get<T>(url);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const status = err.response.status;
        const body = err.response.data as Record<string, unknown>;

        if (status === 403 && body.blockScript != null) {
          throw new DuolingoCaptchaError();
        }
        if (status === 401 || status === 403) {
          throw new DuolingoAuthError(
            'Authentication failed. Your JWT token may have expired. ' +
              'Extract a new one from your browser: ' +
              "document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)",
          );
        }
        if (status === 404) {
          throw new DuolingoNotFoundError(`Resource not found: ${url}`);
        }
        throw new DuolingoClientError(
          `Duolingo API error ${status}: ${JSON.stringify(body)}`,
        );
      }
      throw err;
    }
    return resp.data;
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _client: DuolingoClient | null = null;

/**
 * Get or create the singleton DuolingoClient.
 * Reads DUOLINGO_USERNAME and DUOLINGO_JWT from environment variables.
 */
export function getClient(): DuolingoClient {
  if (_client) return _client;

  const username = process.env.DUOLINGO_USERNAME;
  const jwt = process.env.DUOLINGO_JWT;

  if (!username) {
    throw new DuolingoAuthError(
      'DUOLINGO_USERNAME environment variable is not set. ' +
        'Please set it to your Duolingo username.',
    );
  }
  if (!jwt) {
    throw new DuolingoAuthError(
      'DUOLINGO_JWT environment variable is not set. ' +
        'Extract your JWT token from the browser console: ' +
        "document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)",
    );
  }

  _client = new DuolingoClient(username, jwt);
  return _client;
}

/**
 * Reset the singleton client (useful for testing or credential rotation).
 */
export function resetClient(): void {
  _client = null;
}

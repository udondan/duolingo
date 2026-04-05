/**
 * Native TypeScript Duolingo API client.
 *
 * Calls the unofficial Duolingo REST API directly using axios.
 * No third-party Duolingo library dependency.
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
  DuolingoAuthError,
  DuolingoAlreadyHaveItemError,
  DuolingoInsufficientFundsError,
  DuolingoCaptchaError,
  DuolingoClientError,
  DuolingoNotFoundError,
} from './errors.js';
import type {
  DuolingoUserData,
  DuolingoVocabOverview,
  DuolingoDailyProgress,
  DuolingoLeaderboardData,
  DuolingoShopErrorResponse,
  DuolingoSessionRequest,
  DuolingoSessionResponse,
} from './types.js';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36';

const BASE_URL = 'https://www.duolingo.com';
const DICT_BASE_URL = 'https://d2.duolingo.com';

/** Maximum words per translation request (Duolingo API limit). */
const TRANSLATION_WORD_COUNT_LIMIT = 2000;
/** Maximum JSON length per translation request (Duolingo API limit). */
const TRANSLATION_JSON_LIMIT = 12800;

export class DuolingoClient {
  private readonly http: AxiosInstance;
  private readonly username: string;
  private readonly jwt: string;

  /** Cache of user data keyed by username. */
  private readonly userDataCache = new Map<string, DuolingoUserData>();

  /** Cached homepage HTML for TTS voice discovery. */
  private homepageCache: string | null = null;

  /** Voice URL dictionary: lang → word → Set<url> */
  private voiceUrlDict: Map<string, Map<string, Set<string>>> = new Map();

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
   * Fetch user data by user ID with specific fields.
   * Used for daily XP progress.
   */
  async getUserDataById(
    userId: number,
    fields: string[],
  ): Promise<DuolingoDailyProgress> {
    const fieldsParam = fields.join(',');
    const url = `${BASE_URL}/2017-06-30/users/${userId}?fields=${encodeURIComponent(fieldsParam)}`;
    return this.makeRequest<DuolingoDailyProgress>(url);
  }

  /**
   * Switch the active learning language for the authenticated user.
   * Invalidates the user data cache after switching.
   */
  async switchLanguage(lang: string): Promise<void> {
    const url = `${BASE_URL}/switch_language`;
    await this.makeRequest(url, { learning_language: lang });
    // Invalidate cache so next getUserData() fetches fresh data
    this.invalidateCache(this.username);
  }

  /**
   * Get vocabulary overview for the authenticated user.
   * Optionally switches language first.
   */
  async getVocabularyOverview(
    languageAbbr?: string,
  ): Promise<DuolingoVocabOverview> {
    if (languageAbbr) {
      const userData = await this.getUserData();
      if (!(languageAbbr in userData.language_data)) {
        await this.switchLanguage(languageAbbr);
      }
    }
    const url = `${BASE_URL}/vocabulary/overview`;
    return this.makeRequest<DuolingoVocabOverview>(url);
  }

  /**
   * Get leaderboard data for a time unit.
   */
  async getLeaderboard(
    unit: string,
    before: string,
  ): Promise<DuolingoLeaderboardData> {
    const url = `${BASE_URL}/friendships/leaderboard_activity?unit=${encodeURIComponent(unit)}&_=${encodeURIComponent(before)}`;
    return this.makeRequest<DuolingoLeaderboardData>(url);
  }

  /**
   * Get translations for a list of words.
   * Automatically segments large word lists to stay within API limits.
   */
  async getTranslations(
    words: string[],
    source: string,
    target: string,
  ): Promise<Record<string, string[]>> {
    const segments = this.segmentWordList(words);
    const results: Record<string, string[]> = {};
    for (const segment of segments) {
      const segmentResults = await this.getRawTranslations(
        segment,
        source,
        target,
      );
      Object.assign(results, segmentResults);
    }
    return results;
  }

  /**
   * Buy a shop item for the authenticated user.
   */
  async buyItem(
    userId: number,
    itemName: string,
    languageAbbr: string,
  ): Promise<void> {
    const url = `${BASE_URL}/2017-06-30/users/${userId}/shop-items`;
    const data = { itemName, learningLanguage: languageAbbr };

    let resp: AxiosResponse;
    try {
      resp = await this.http.post(url, data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        resp = err.response;
      } else {
        throw err;
      }
    }

    if (resp.status === 400) {
      const body = resp.data as DuolingoShopErrorResponse;
      if (body.error === 'ALREADY_HAVE_STORE_ITEM') {
        throw new DuolingoAlreadyHaveItemError(itemName);
      }
      if (body.error === 'INSUFFICIENT_FUNDS') {
        throw new DuolingoInsufficientFundsError(itemName);
      }
      throw new DuolingoClientError(
        `Unknown shop error while purchasing '${itemName}': ${body.error ?? 'unknown'}`,
      );
    }

    if (!resp.status || resp.status < 200 || resp.status >= 300) {
      throw new DuolingoClientError(`Failed to purchase '${itemName}'.`);
    }
  }

  /**
   * Fetch the Duolingo homepage HTML (cached).
   * Used for TTS voice discovery.
   */
  async getHomepage(): Promise<string> {
    if (this.homepageCache) return this.homepageCache;
    const resp = await this.http.get<string>(BASE_URL, {
      responseType: 'text',
    });
    this.homepageCache = resp.data;
    return this.homepageCache;
  }

  /**
   * Fetch a practice session for a skill.
   * Used to discover audio URLs for words.
   */
  async getSession(
    skillId: string,
    langAbbr: string,
  ): Promise<DuolingoSessionResponse | null> {
    const url = `${BASE_URL}/2017-06-30/sessions`;
    const data: DuolingoSessionRequest = {
      fromLanguage: langAbbr !== 'en' ? 'en' : 'de',
      learningLanguage: langAbbr,
      challengeTypes: ['definition', 'translate'],
      skillId,
      type: 'SKILL_PRACTICE',
      juicy: true,
      smartTipsVersion: 2,
    };

    let resp: AxiosResponse;
    try {
      resp = await this.http.post<DuolingoSessionResponse>(url, data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        return null; // Non-fatal: skip this skill
      }
      throw err;
    }

    if (resp.status !== 200) return null;
    return resp.data as DuolingoSessionResponse;
  }

  // ---------------------------------------------------------------------------
  // Voice URL dictionary
  // ---------------------------------------------------------------------------

  /**
   * Populate the voice URL dictionary for a language by scraping sessions.
   * This is expensive — it makes one API call per skill.
   */
  async populateVoiceUrlDictionary(langAbbr: string): Promise<void> {
    if (!this.voiceUrlDict.has(langAbbr)) {
      this.voiceUrlDict.set(langAbbr, new Map());
    }
    const langDict = this.voiceUrlDict.get(langAbbr)!;

    const userData = await this.getUserData();
    const langData = userData.language_data[langAbbr];
    if (!langData) return;

    for (const skill of langData.skills) {
      const session = await this.getSession(skill.id, langAbbr);
      if (!session) continue;

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

  private addToVoiceUrlDict(
    dict: Map<string, Set<string>>,
    word: string,
    url: string,
  ): void {
    const key = word.toLowerCase();
    if (!dict.has(key)) {
      dict.set(key, new Set());
    }
    dict.get(key)!.add(url);
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

  private segmentWordList(words: string[]): string[][] {
    const isValid = (list: string[]): boolean =>
      list.length < TRANSLATION_WORD_COUNT_LIMIT &&
      JSON.stringify(list).length < TRANSLATION_JSON_LIMIT;

    if (isValid(words)) return [words];

    const segments: string[][] = [];
    let segment: string[] = [];
    for (const word of words) {
      if (!isValid([...segment, word])) {
        segments.push(segment);
        segment = [];
      }
      segment.push(word);
    }
    if (segment.length > 0) segments.push(segment);
    return segments;
  }

  private async getRawTranslations(
    words: string[],
    source: string,
    target: string,
  ): Promise<Record<string, string[]>> {
    const wordParam = JSON.stringify(words);
    const url = `${DICT_BASE_URL}/api/1/dictionary/hints/${encodeURIComponent(source)}/${encodeURIComponent(target)}?tokens=${encodeURIComponent(wordParam)}`;
    const resp = await this.http.get<Record<string, string[]>>(url);
    return resp.data;
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

        if (status === 403 && body['blockScript'] != null) {
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

  const username = process.env['DUOLINGO_USERNAME'];
  const jwt = process.env['DUOLINGO_JWT'];

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

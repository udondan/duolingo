/**
 * Helpers for Duolingo's text-to-speech (TTS) URLs: voice names, base URLs
 * and the word → audio URL dictionary built from practice sessions.
 */

import type { DuolingoSessionResponse } from './types.js';

/** Word (lowercase) → audio URLs. */
export type VoiceUrlDictionary = Map<string, Set<string>>;

/**
 * Fallback TTS CDN base URL used when the user data does not provide one.
 * The actual URL is returned in the /users/<username> response as `tts_base_url`.
 */
export const FALLBACK_TTS_BASE_URL = 'https://d7mj4aqfscim2.cloudfront.net/';

/**
 * Extract the voice name from a Duolingo TTS CDN URL.
 * Supports two URL formats:
 *   Legacy: https://<cdn>/<voice>/<hash>
 *   Modern: https://<cdn>/tts/<lang>/<voice>/token/<word>
 */
export function extractVoiceFromTtsUrl(url?: string): string | null {
  if (!url) return null;
  // Modern format: .../tts/<lang>/<voice>/token/<word>
  const modern = /cloudfront\.net\/tts\/[^/]+\/([^/]+)\/token\//.exec(url)?.[1];
  if (modern !== undefined) return modern;
  // Legacy format: .../<voice>/<hash> — only applies to non-/tts/ URLs
  if (url.includes('/tts/')) return null;
  const legacy = /cloudfront\.net\/([^/]+)\/[^/]+$/.exec(url);
  return legacy?.[1] ?? null;
}

/**
 * Normalize a TTS base URL to always end with a slash and use HTTPS.
 */
export function normalizeTtsBaseUrl(raw?: string): string {
  if (!raw) return FALLBACK_TTS_BASE_URL;
  const url = raw.replace(/^http:\/\//, 'https://');
  return url.endsWith('/') ? url : `${url}/`;
}

/**
 * The voice names in the TTS URLs of a session: the challenge audio and the
 * keys of `ttsAnnotations`.
 */
export function collectSessionVoices(
  session: DuolingoSessionResponse,
): Set<string> {
  const urls = [
    ...session.challenges.map((challenge) => challenge.tts),
    ...Object.keys(session.ttsAnnotations ?? {}),
  ];
  const voices = new Set<string>();
  for (const url of urls) {
    const voiceName = extractVoiceFromTtsUrl(url);
    if (voiceName) voices.add(voiceName);
  }
  return voices;
}

/**
 * Add the words of a session to a voice URL dictionary: challenge prompts,
 * the tokens of non-character TTS and the (nested) token lists.
 */
export function addSessionToVoiceUrlDict(
  dict: VoiceUrlDictionary,
  session: DuolingoSessionResponse,
): void {
  for (const challenge of session.challenges) {
    if (challenge.prompt && challenge.tts) {
      addToVoiceUrlDict(dict, challenge.prompt, challenge.tts);
    }
    const tokens = challenge.metadata?.non_character_tts?.tokens ?? {};
    for (const [word, url] of Object.entries(tokens)) {
      addToVoiceUrlDict(dict, word, url);
    }
    addTokenListToVoiceUrlDict(dict, challenge.tokens ?? []);
  }
}

function addToVoiceUrlDict(
  dict: VoiceUrlDictionary,
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

function addTokenListToVoiceUrlDict(
  dict: VoiceUrlDictionary,
  tokens: unknown[],
): void {
  for (const token of tokens) {
    if (Array.isArray(token)) {
      addTokenListToVoiceUrlDict(dict, token);
    } else if (isTtsToken(token) && token.tts && token.value) {
      addToVoiceUrlDict(dict, token.value, token.tts);
    }
  }
}

function isTtsToken(token: unknown): token is { tts?: string; value?: string } {
  return (
    token !== null &&
    typeof token === 'object' &&
    'tts' in token &&
    'value' in token
  );
}

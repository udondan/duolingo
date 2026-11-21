/**
 * Custom error classes for the Duolingo API client.
 */

import axios from 'axios';

/** Base error for all Duolingo client failures. */
export class DuolingoClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuolingoClientError';
  }
}

/** Raised when credentials are missing or invalid. */
export class DuolingoAuthError extends DuolingoClientError {
  constructor(message: string) {
    super(message);
    this.name = 'DuolingoAuthError';
  }
}

/** Raised when a requested user or resource is not found. */
export class DuolingoNotFoundError extends DuolingoClientError {
  constructor(message: string) {
    super(message);
    this.name = 'DuolingoNotFoundError';
  }
}

/** Raised when Duolingo returns a CAPTCHA challenge. */
export class DuolingoCaptchaError extends DuolingoClientError {
  constructor() {
    super(
      'Request was blocked by Duolingo CAPTCHA. ' +
        'Try refreshing your JWT token by logging in again at duolingo.com.',
    );
    this.name = 'DuolingoCaptchaError';
  }
}

/** Raised when the language is not in the user's learning list. */
export class DuolingoLanguageNotFoundError extends DuolingoClientError {
  constructor(lang: string) {
    super(
      `Language '${lang}' not found in user's language data. ` +
        'Make sure the user is learning this language.',
    );
    this.name = 'DuolingoLanguageNotFoundError';
  }
}

/** How to get a fresh JWT from a logged-in browser session. */
export const JWT_HINT =
  "document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)";

/** The HTTP status of a failed request, or `undefined` for other errors. */
export function httpStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

/**
 * Map a failed GET request to the matching client error. Errors without an
 * HTTP response, such as network errors, are returned unchanged.
 */
export function toRequestError(err: unknown, url: string): unknown {
  if (!axios.isAxiosError(err) || !err.response) return err;
  const status = err.response.status;
  const body = err.response.data as Record<string, unknown>;

  if (status === 403 && body.blockScript != null) {
    return new DuolingoCaptchaError();
  }
  if (status === 401 || status === 403) {
    return new DuolingoAuthError(
      'Authentication failed. Your JWT token may have expired. ' +
        `Extract a new one from your browser: ${JWT_HINT}`,
    );
  }
  if (status === 404) {
    return new DuolingoNotFoundError(`Resource not found: ${url}`);
  }
  return new DuolingoClientError(
    `Duolingo API error ${status}: ${JSON.stringify(body)}`,
  );
}

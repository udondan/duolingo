/**
 * Custom error classes for the Duolingo API client.
 */

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

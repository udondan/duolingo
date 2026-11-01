/**
 * Language-level Duolingo MCP tools.
 *
 * Tools: get_language_details, get_language_progress, get_known_topics,
 *        get_unknown_topics, get_golden_topics, get_reviewable_topics,
 *        get_known_words, get_learned_skills,
 *        get_language_voices, get_audio_url
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  audioUrlView,
  goldenTopicsView,
  knownTopicsView,
  knownWordsView,
  languageDetailsView,
  languageProgressView,
  languageVoicesView,
  learnedSkillsView,
  reviewableTopicsView,
  unknownTopicsView,
  type LanguageQuery,
} from '../views/language.js';
import type { View } from '../views/view.js';
import {
  READ_ONLY,
  reply,
  ResponseFormatSchema,
  UsernameFieldSchema,
} from './helpers.js';

const LanguageAbbrSchema = z
  .string()
  .min(2)
  .max(5)
  .describe("Language abbreviation (e.g. 'fr' for French, 'es' for Spanish).");

const OptionalLanguageAbbrSchema = z
  .string()
  .min(2)
  .max(5)
  .optional()
  .describe("Language abbreviation (e.g. 'fr'). Defaults to current language.");

/** Tools that take a language and an optional username. */
const LANGUAGE_QUERY_TOOLS: [
  string,
  string,
  string,
  (opts: LanguageQuery) => Promise<View>,
][] = [
  [
    'duolingo_get_known_topics',
    'Get Duolingo Known Topics',
    'Get the list of learned topic/skill names for a language.',
    knownTopicsView,
  ],
  [
    'duolingo_get_unknown_topics',
    'Get Duolingo Unknown Topics',
    'Get the list of not-yet-learned topics/skills for a language.',
    unknownTopicsView,
  ],
  [
    'duolingo_get_golden_topics',
    'Get Duolingo Golden (Mastered) Topics',
    'Get the list of fully mastered ("golden") topics for a language. ' +
      'A golden topic has a strength of 1.0 (fully reviewed).',
    goldenTopicsView,
  ],
  [
    'duolingo_get_reviewable_topics',
    'Get Duolingo Reviewable Topics',
    'Get the list of learned but not fully mastered topics for a language. ' +
      'These are topics that have been started but whose strength is below 1.0, meaning they need review.',
    reviewableTopicsView,
  ],
  [
    'duolingo_get_known_words',
    'Get Duolingo Known Words',
    'Get the set of words a user has learned in a language.',
    knownWordsView,
  ],
  [
    'duolingo_get_learned_skills',
    'Get Duolingo Learned Skills',
    'Get full skill objects for all learned skills, sorted by learning order. ' +
      'Returns detailed skill data including title, strength, progress, words, and more.',
    learnedSkillsView,
  ],
];

export function registerLanguageTools(server: McpServer): void {
  server.registerTool(
    'duolingo_get_language_details',
    {
      title: 'Get Duolingo Language Details',
      description:
        "Get a user's status and details for a specific language. " +
        'Returns level, points, streak, and learning status for the given language.',
      inputSchema: {
        language_name: z
          .string()
          .min(1)
          .describe("Full name of the language (e.g. 'French', 'Spanish')."),
        username: UsernameFieldSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ language_name, username, response_format }) =>
      reply(
        () => languageDetailsView({ language_name, username }),
        response_format,
      ),
  );

  server.registerTool(
    'duolingo_get_language_progress',
    {
      title: 'Get Duolingo Language Progress',
      description:
        'Get detailed progress metrics for a specific language. ' +
        'Returns level, percent to next level, points rank, fluency score, skills learned, and more.',
      inputSchema: {
        language_abbr: LanguageAbbrSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ language_abbr, response_format }) =>
      reply(() => languageProgressView({ language_abbr }), response_format),
  );

  for (const [name, title, description, view] of LANGUAGE_QUERY_TOOLS) {
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema: {
          language_abbr: LanguageAbbrSchema,
          username: UsernameFieldSchema,
          response_format: ResponseFormatSchema,
        },
        annotations: READ_ONLY,
      },
      ({ language_abbr, username, response_format }) =>
        reply(() => view({ language_abbr, username }), response_format),
    );
  }

  server.registerTool(
    'duolingo_get_language_voices',
    {
      title: 'Get Duolingo Language TTS Voices',
      description:
        'Get the available text-to-speech (TTS) voices for a language. ' +
        'Returns a list of voice names.',
      inputSchema: {
        language_abbr: OptionalLanguageAbbrSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ language_abbr, response_format }) =>
      reply(() => languageVoicesView({ language_abbr }), response_format),
  );

  server.registerTool(
    'duolingo_get_audio_url',
    {
      title: 'Get Duolingo Word Audio URL',
      description:
        'Get the URL of a pronunciation audio file for a word. ' +
        'Returns a CloudFront CDN URL pointing to the TTS audio file.',
      inputSchema: {
        word: z
          .string()
          .min(1)
          .describe(
            "The word to get pronunciation audio for (e.g. 'bonjour').",
          ),
        language_abbr: OptionalLanguageAbbrSchema,
        voice: z
          .string()
          .optional()
          .describe(
            "Specific voice name to use (e.g. 'mathieu'). Defaults to random.",
          ),
        random: z
          .boolean()
          .default(true)
          .describe(
            "If true, select a random voice. Ignored if 'voice' is specified.",
          ),
      },
      annotations: { ...READ_ONLY, idempotentHint: false },
    },
    ({ word, language_abbr, voice, random }) =>
      reply(() => audioUrlView({ word, language_abbr, voice, random })),
  );
}

/**
 * Language-level Duolingo MCP tools.
 *
 * Tools: get_language_details, get_language_progress, get_topics,
 *        get_known_words, get_learned_skills,
 *        get_language_voices, get_audio_url
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  audioUrlView,
  knownWordsView,
  languageDetailsView,
  languageProgressView,
  languageVoicesView,
  learnedSkillsView,
  TOPIC_FILTERS,
  topicsView,
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
  .describe(
    "Abbreviation of a language the user learns, like 'fr' for French or 'es' for Spanish, as duolingo_get_languages lists them.",
  );

const OptionalLanguageAbbrSchema = z
  .string()
  .min(2)
  .max(5)
  .optional()
  .describe(
    "Abbreviation of the language, like 'fr'. Default: the first course of the authenticated user.",
  );

/** Tools that take a language and an optional username. */
const LANGUAGE_QUERY_TOOLS: [
  string,
  string,
  string,
  (opts: LanguageQuery) => Promise<View>,
][] = [
  [
    'duolingo_get_known_words',
    'Get Duolingo Known Words',
    "Lists the words (lexemes) the user has learned in one language, without duplicates and sorted alphabetically; it can be several hundred words. Use it for vocabulary, for example to build practice sentences from known words; for topics use duolingo_get_topics. On learning-path courses the words come from the authenticated user's active course: switch with duolingo_switch_course to read another.",
    knownWordsView,
  ],
  [
    'duolingo_get_learned_skills',
    'Get Duolingo Learned Skills',
    "Returns the learned skills of one language as full objects in the order they were learned: title, strength (0 to 1), progress in percent, words, and more. The most detailed and largest of the topic tools: for names only use duolingo_get_topics, with `filter: reviewable` for the weak ones. Courses on the learning path report skills only for the authenticated user's active course: switch with duolingo_switch_course to read another.",
    learnedSkillsView,
  ],
];

export function registerLanguageTools(server: McpServer): void {
  server.registerTool(
    'duolingo_get_language_details',
    {
      title: 'Get Duolingo Language Details',
      description:
        "Reads the status of one language for a user, by its full name like 'French': level, points (XP), streak and whether it is the language being learned now. Fails while the active course is not a language course, like Math. Takes the full name; duolingo_get_languages lists the name and abbreviation of each language. For percent to the next level, fluency and skill counts use duolingo_get_language_progress; for all courses at once duolingo_get_courses.",
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
        "Reads detailed progress of the authenticated user in one language, by abbreviation like 'fr': level, percent and points to the next level, fluency score, number of skills learned out of all, and more. Use it to report how far a course is; for level and streak of another user use duolingo_get_language_details, for which topics are done duolingo_get_topics.",
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
    'duolingo_get_topics',
    {
      title: 'Get Duolingo Topics',
      description:
        "Lists the names of the topics (skills) of one language, sorted alphabetically: names only. `filter` picks which: `known` (default) the learned ones, `unknown` the ones not learned yet, `golden` the learned ones that are fully mastered (strength 1.0, nothing to review), `reviewable` the learned ones whose strength is below 1.0, so practice would refresh them; golden and reviewable together make up known. For the skills with strength and progress use duolingo_get_learned_skills. Courses on the learning path report skills only for the authenticated user's active course: switch with duolingo_switch_course to read another.",
      inputSchema: {
        language_abbr: LanguageAbbrSchema,
        username: UsernameFieldSchema,
        filter: z
          .enum(TOPIC_FILTERS)
          .default('known')
          .describe(
            "Which topics to list: 'known' (learned), 'unknown' (not learned yet), 'golden' (learned and fully mastered) or 'reviewable' (learned, strength below 1.0).",
          ),
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ language_abbr, username, filter, response_format }) =>
      reply(
        () => topicsView({ language_abbr, username, filter }),
        response_format,
      ),
  );

  server.registerTool(
    'duolingo_get_language_voices',
    {
      title: 'Get Duolingo Language TTS Voices',
      description:
        "Lists the text-to-speech voice names Duolingo has for one language, like 'mathieu'. Reads them from a practice session it requests but never starts or completes, and caches them while the server runs. The language defaults to the first course of the authenticated user. Use the names as `voice` of duolingo_get_audio_url. Empty if Duolingo reports none.",
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
        "Builds the URL of the Duolingo text-to-speech audio of a word or phrase, on Duolingo's CDN, which plays without a login. Does not download the audio or check that it exists. Without `voice` it picks a random voice of duolingo_get_language_voices, so the result varies; with `random` false and no voice, the URL has no voice. The language defaults to the first course of the authenticated user. Returns the URL as text.",
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
            "Voice name from duolingo_get_language_voices, like 'mathieu'. Default: see `random`.",
          ),
        random: z
          .boolean()
          .default(true)
          .describe(
            'Without `voice`: true picks a random voice of the language, false builds the URL without a voice. Ignored when `voice` is given.',
          ),
      },
      annotations: { ...READ_ONLY, idempotentHint: false },
    },
    ({ word, language_abbr, voice, random }) =>
      reply(() => audioUrlView({ word, language_abbr, voice, random })),
  );
}

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
import { getClient } from '../client/duolingo.js';
import {
  handleError,
  ResponseFormatSchema,
  UsernameFieldSchema,
  computeDependencyOrder,
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

export function registerLanguageTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // Get Language Details
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_name, username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const lang = userData.languages.find(
          (l) => l.language_string === language_name,
        );

        if (!lang) {
          return {
            content: [
              {
                type: 'text',
                text: `No details found for language '${language_name}'. Check the language name.`,
              },
            ],
          };
        }

        const details = {
          language: lang.language,
          language_string: lang.language_string,
          level: lang.level,
          points: lang.points,
          streak: lang.streak,
          current_learning: lang.current_learning,
          learning: lang.learning,
        };

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(details, null, 2) }],
          };
        }

        const lines = [`# ${language_name} Details`, ''];
        lines.push(`- **Level**: ${details.level}`);
        lines.push(`- **Points**: ${details.points}`);
        lines.push(`- **Streak**: ${details.streak} days`);
        lines.push(`- **Currently Learning**: ${details.current_learning}`);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Language Progress
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, response_format }) => {
      try {
        const userData = await getClient().getUserData();
        const langData = userData.language_data[language_abbr];
        if (!langData) {
          return {
            content: [
              {
                type: 'text',
                text: `Language '${language_abbr}' not found. Make sure you are learning this language.`,
              },
            ],
          };
        }

        const progress = {
          language: langData.language,
          language_string: langData.language_string,
          level: langData.level,
          level_percent: langData.level_percent,
          level_points: langData.level_points,
          level_progress: langData.level_progress,
          level_left: langData.level_left,
          next_level: langData.next_level,
          points: langData.points,
          // points_rank is absent in the current API response
          points_rank: langData.points_rank,
          streak: langData.streak,
          num_skills_learned: langData.num_skills_learned,
          fluency_score: langData.fluency_score,
        };

        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(progress, null, 2) },
            ],
          };
        }

        const lang = progress.language_string || language_abbr;
        const lines = [`# ${lang} Progress`, ''];
        lines.push(`- **Level**: ${progress.level}`);
        lines.push(`- **Level Progress**: ${progress.level_percent}%`);
        lines.push(`- **Points to Next Level**: ${progress.level_left}`);
        lines.push(`- **Total Points**: ${progress.points}`);
        if (typeof progress.points_rank === 'number')
          lines.push(`- **Points Rank**: #${progress.points_rank}`);
        lines.push(`- **Streak**: ${progress.streak} days`);
        lines.push(`- **Skills Learned**: ${progress.num_skills_learned}`);
        if (progress.fluency_score !== null) {
          lines.push(`- **Fluency Score**: ${progress.fluency_score}`);
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Shared topic/word tool schema
  // -------------------------------------------------------------------------
  const topicInputSchema = {
    language_abbr: LanguageAbbrSchema,
    username: UsernameFieldSchema,
    response_format: ResponseFormatSchema,
  };

  function formatTopicList(
    title: string,
    topics: string[],
    fmt: string,
  ): string {
    if (fmt === 'json') return JSON.stringify([...topics].sort(), null, 2);
    if (topics.length === 0) return `No ${title.toLowerCase()} found.`;
    const lines = [`# ${title}`, ''];
    for (const topic of [...topics].sort()) {
      lines.push(`- ${topic}`);
    }
    return lines.join('\n');
  }

  // -------------------------------------------------------------------------
  // Get Known Topics
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_known_topics',
    {
      title: 'Get Duolingo Known Topics',
      description: 'Get the list of learned topic/skill names for a language.',
      inputSchema: topicInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const langData = userData.language_data[language_abbr];
        if (!langData) {
          return {
            content: [
              {
                type: 'text',
                text: `Language '${language_abbr}' not found. Make sure the user is learning this language.`,
              },
            ],
          };
        }
        const topics = langData.skills
          .filter((s) => s.learned)
          .map((s) => s.title);
        return {
          content: [
            {
              type: 'text',
              text: formatTopicList('Known Topics', topics, response_format),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Unknown Topics
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_unknown_topics',
    {
      title: 'Get Duolingo Unknown Topics',
      description:
        'Get the list of not-yet-learned topics/skills for a language.',
      inputSchema: topicInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const langData = userData.language_data[language_abbr];
        if (!langData) {
          return {
            content: [
              {
                type: 'text',
                text: `Language '${language_abbr}' not found. Make sure the user is learning this language.`,
              },
            ],
          };
        }
        const topics = langData.skills
          .filter((s) => !s.learned)
          .map((s) => s.title);
        return {
          content: [
            {
              type: 'text',
              text: formatTopicList('Unknown Topics', topics, response_format),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Golden Topics
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_golden_topics',
    {
      title: 'Get Duolingo Golden (Mastered) Topics',
      description:
        'Get the list of fully mastered ("golden") topics for a language. ' +
        'A golden topic has a strength of 1.0 (fully reviewed).',
      inputSchema: topicInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const langData = userData.language_data[language_abbr];
        if (!langData) {
          return {
            content: [
              {
                type: 'text',
                text: `Language '${language_abbr}' not found. Make sure the user is learning this language.`,
              },
            ],
          };
        }
        const topics = langData.skills
          .filter((s) => s.learned && s.strength === 1.0)
          .map((s) => s.title);
        return {
          content: [
            {
              type: 'text',
              text: formatTopicList(
                'Golden (Mastered) Topics',
                topics,
                response_format,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Reviewable Topics
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_reviewable_topics',
    {
      title: 'Get Duolingo Reviewable Topics',
      description:
        'Get the list of learned but not fully mastered topics for a language. ' +
        'These are topics that have been started but whose strength is below 1.0, meaning they need review.',
      inputSchema: topicInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const langData = userData.language_data[language_abbr];
        if (!langData) {
          return {
            content: [
              {
                type: 'text',
                text: `Language '${language_abbr}' not found. Make sure the user is learning this language.`,
              },
            ],
          };
        }
        const topics = langData.skills
          .filter((s) => s.learned && s.strength < 1.0)
          .map((s) => s.title);
        return {
          content: [
            {
              type: 'text',
              text: formatTopicList(
                'Reviewable Topics',
                topics,
                response_format,
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Known Words
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_known_words',
    {
      title: 'Get Duolingo Known Words',
      description: 'Get the set of words a user has learned in a language.',
      inputSchema: topicInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const langData = userData.language_data[language_abbr];
        if (!langData) {
          return {
            content: [
              {
                type: 'text',
                text: `Language '${language_abbr}' not found. Make sure the user is learning this language.`,
              },
            ],
          };
        }

        const wordSet = new Set<string>();
        for (const skill of langData.skills) {
          if (skill.learned) {
            for (const word of skill.words) {
              wordSet.add(word);
            }
          }
        }

        const words = [...wordSet].sort();

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(words, null, 2) }],
          };
        }

        if (words.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No known words found for language '${language_abbr}'.`,
              },
            ],
          };
        }

        const lines = [
          `# Known Words (${language_abbr.toUpperCase()}) — ${words.length} words`,
          '',
          words.join(', '),
        ];
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Learned Skills
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_learned_skills',
    {
      title: 'Get Duolingo Learned Skills',
      description:
        'Get full skill objects for all learned skills, sorted by learning order. ' +
        'Returns detailed skill data including title, strength, progress, words, and more.',
      inputSchema: topicInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const langData = userData.language_data[language_abbr];
        if (!langData) {
          return {
            content: [
              {
                type: 'text',
                text: `Language '${language_abbr}' not found. Make sure the user is learning this language.`,
              },
            ],
          };
        }

        const allSkills = [...langData.skills];
        computeDependencyOrder(allSkills);

        const learnedSkills = allSkills
          .filter((s) => s.learned)
          .sort(
            (a, b) => (a.dependency_order ?? 0) - (b.dependency_order ?? 0),
          );

        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(learnedSkills, null, 2) },
            ],
          };
        }

        if (learnedSkills.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No learned skills found for language '${language_abbr}'.`,
              },
            ],
          };
        }

        const lines = [`# Learned Skills (${language_abbr.toUpperCase()})`, ''];
        for (const skill of learnedSkills) {
          const strengthPct = Math.round(skill.strength * 100);
          lines.push(
            `- **${skill.title}** — Strength: ${strengthPct}% | Progress: ${Math.round(skill.progress_percent)}%`,
          );
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Language Voices
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, response_format }) => {
      try {
        const client = getClient();

        // Resolve language abbreviation
        let langAbbr = language_abbr;
        if (!langAbbr) {
          const userData = await client.getUserData();
          const langKeys = Object.keys(userData.language_data);
          langAbbr = langKeys[0];
        }

        if (!langAbbr) {
          return {
            content: [
              {
                type: 'text',
                text: 'No language found. Make sure you are learning a language.',
              },
            ],
          };
        }

        // Discover voices via the session API (duo.tts_multi_voices is no longer
        // embedded in the homepage — voices are now discovered from session TTS URLs)
        const voices = await client.getLanguageVoices(langAbbr);

        if (voices.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No voices found for language '${langAbbr}'.`,
              },
            ],
          };
        }

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(voices, null, 2) }],
          };
        }

        const lines = [
          `# TTS Voices (${langAbbr})`,
          '',
          ...voices.map((v) => `- ${v}`),
        ];
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Audio URL
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ word, language_abbr, voice, random }) => {
      try {
        const client = getClient();

        // Resolve language abbreviation
        let langAbbr = language_abbr;
        if (!langAbbr) {
          const userData = await client.getUserData();
          const langKeys = Object.keys(userData.language_data);
          langAbbr = langKeys[0];
        }

        if (!langAbbr) {
          return {
            content: [
              {
                type: 'text',
                text: 'No language found. Make sure you are learning a language.',
              },
            ],
          };
        }

        // If a specific voice is requested, build the URL directly.
        // URL format: {ttsBaseUrl}tts/{lang}/{voice}/token/{word}
        if (voice) {
          const url = await client.buildAudioUrl(word, langAbbr, voice);
          return { content: [{ type: 'text', text: url }] };
        }

        // If random voice is requested, discover available voices first.
        if (random) {
          const voices = await client.getLanguageVoices(langAbbr);
          if (voices.length > 0) {
            const selectedVoice =
              voices[Math.floor(Math.random() * voices.length)] ?? voices[0];
            const url = await client.buildAudioUrl(
              word,
              langAbbr,
              selectedVoice,
            );
            return { content: [{ type: 'text', text: url }] };
          }
        }

        // Fall back to the default (no-voice) URL
        const url = await client.buildAudioUrl(word, langAbbr);
        return { content: [{ type: 'text', text: url }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}

/**
 * Utility Duolingo MCP tools.
 *
 * Tools: get_language_from_abbr, get_abbreviation_of
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../client/duolingo.js';
import { handleError, UsernameFieldSchema } from './helpers.js';

export function registerShopTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // Get Language from Abbreviation
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_language_from_abbr',
    'Convert a language abbreviation to its full name. ' +
      'Only works for languages the given user is currently learning.',
    {
      language_abbr: z
        .string()
        .min(2)
        .max(5)
        .describe("Language abbreviation to look up (e.g. 'fr', 'es', 'de')."),
      username: UsernameFieldSchema,
    },
    {
      title: 'Get Duolingo Language Name from Abbreviation',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ language_abbr, username }) => {
      try {
        const userData = await getClient().getUserData(username);
        const lang = userData.languages.find(
          (l) => l.language === language_abbr,
        );

        if (!lang) {
          return {
            content: [
              {
                type: 'text',
                text:
                  `No language found for abbreviation '${language_abbr}'. ` +
                  'Make sure the user is learning this language.',
              },
            ],
          };
        }

        return {
          content: [{ type: 'text', text: lang.language_string }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Abbreviation Of
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_abbreviation_of',
    'Convert a full language name to its abbreviation. ' +
      'Only works for languages the given user is currently learning.',
    {
      language_name: z
        .string()
        .min(1)
        .describe("Full language name to look up (e.g. 'French', 'Spanish')."),
      username: UsernameFieldSchema,
    },
    {
      title: 'Get Duolingo Language Abbreviation',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async ({ language_name, username }) => {
      try {
        const userData = await getClient().getUserData(username);
        const lang = userData.languages.find(
          (l) =>
            l.language_string.toLowerCase() === language_name.toLowerCase(),
        );

        if (!lang) {
          return {
            content: [
              {
                type: 'text',
                text:
                  `No abbreviation found for language '${language_name}'. ` +
                  'Make sure the user is learning this language.',
              },
            ],
          };
        }

        return {
          content: [{ type: 'text', text: lang.language }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}

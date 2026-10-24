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
  server.registerTool(
    'duolingo_get_language_from_abbr',
    {
      title: 'Get Duolingo Language Name from Abbreviation',
      description:
        'Convert a language abbreviation to its full name. ' +
        'Only works for languages the given user is currently learning.',
      inputSchema: {
        language_abbr: z
          .string()
          .min(2)
          .max(5)
          .describe(
            "Language abbreviation to look up (e.g. 'fr', 'es', 'de').",
          ),
        username: UsernameFieldSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, username }) => {
      try {
        const client = getClient();

        let userId: number;
        if (!username) {
          const userData = await client.getUserData();
          userId = userData.id;
        } else {
          userId = await client.getUserIdByUsername(username);
        }

        const v2 = await client.getUserDataV2(userId);
        const course = v2.courses.find(
          (c) =>
            c.subject === 'language' &&
            (c.learningLanguage === language_abbr || c.topic === language_abbr),
        );

        if (!course) {
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
          content: [
            {
              type: 'text',
              text: course.title ?? course.learningLanguage ?? language_abbr,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Abbreviation Of
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_abbreviation_of',
    {
      title: 'Get Duolingo Language Abbreviation',
      description:
        'Convert a full language name to its abbreviation. ' +
        'Only works for languages the given user is currently learning.',
      inputSchema: {
        language_name: z
          .string()
          .min(1)
          .describe(
            "Full language name to look up (e.g. 'French', 'Spanish').",
          ),
        username: UsernameFieldSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_name, username }) => {
      try {
        const client = getClient();

        let userId: number;
        if (!username) {
          const userData = await client.getUserData();
          userId = userData.id;
        } else {
          userId = await client.getUserIdByUsername(username);
        }

        const v2 = await client.getUserDataV2(userId);
        const course = v2.courses.find(
          (c) =>
            c.subject === 'language' &&
            (c.title ?? '').toLowerCase() === language_name.toLowerCase(),
        );

        if (!course) {
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
          content: [
            { type: 'text', text: course.learningLanguage ?? course.topic },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}

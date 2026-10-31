/**
 * Utility Duolingo MCP tools.
 *
 * Tools: get_language_from_abbr, get_abbreviation_of
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { abbreviationOfView, languageFromAbbrView } from '../views/utils.js';
import { READ_ONLY, reply, UsernameFieldSchema } from './helpers.js';

export function registerShopTools(server: McpServer): void {
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
      annotations: READ_ONLY,
    },
    ({ language_abbr, username }) =>
      reply(() => languageFromAbbrView({ language_abbr, username })),
  );

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
      annotations: READ_ONLY,
    },
    ({ language_name, username }) =>
      reply(() => abbreviationOfView({ language_name, username })),
  );
}

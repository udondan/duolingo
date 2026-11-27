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
        "Converts a language abbreviation like 'fr' to the course name, like 'French'. Looks only at the courses of the given user (default: the authenticated user) and fails for languages the user does not learn. For the reverse use duolingo_get_abbreviation_of; for all languages of the user at once duolingo_get_languages. Returns the name as text.",
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
        "Converts a language name like 'French' to its abbreviation, like 'fr', which most language tools take as `language_abbr`. Looks only at the courses of the given user (default: the authenticated user) and fails for languages the user does not learn. For the reverse use duolingo_get_language_from_abbr. Returns the abbreviation as text.",
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

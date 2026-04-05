/**
 * Shop, utility, and write-action Duolingo MCP tools.
 *
 * Tools: get_language_from_abbr, get_abbreviation_of, set_username,
 *        buy_item, buy_streak_freeze
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

  // -------------------------------------------------------------------------
  // Set Username (switch active user for subsequent queries)
  // NOTE: This tool was mentioned in the README but missing from the Python
  // implementation. It is now properly implemented.
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_set_username',
    'Switch to another user to query their public data. ' +
      'After calling this, subsequent tool calls will use the new username by default. ' +
      'Call without a username (or with the authenticated username) to reset to yourself.',
    {
      username: z.string().min(1).describe('Duolingo username to switch to.'),
    },
    {
      title: 'Set Duolingo Username',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ username }) => {
      try {
        // Pre-fetch to validate the username exists
        const client = getClient();
        await client.getUserData(username);
        return {
          content: [
            {
              type: 'text',
              text: `Switched to user '${username}'. Pass username='${username}' to other tools to query their data.`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Buy Item (destructive)
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_buy_item',
    'Purchase a specific item from the Duolingo shop. ' +
      'This is a destructive action that spends Lingots/Gems. Common items: ' +
      "'streak_freeze' (protects your streak for one missed day), " +
      "'weekend_amulet' (protects your streak over the weekend).",
    {
      item_name: z
        .string()
        .min(1)
        .describe(
          "Name of the item to buy (e.g. 'streak_freeze', 'weekend_amulet').",
        ),
      language_abbr: z
        .string()
        .min(2)
        .max(5)
        .describe(
          "Language abbreviation for which to buy the item (e.g. 'fr').",
        ),
    },
    {
      title: 'Buy Duolingo Shop Item',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ item_name, language_abbr }) => {
      try {
        const client = getClient();
        const userData = await client.getUserData();
        await client.buyItem(userData.id, item_name, language_abbr);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully purchased '${item_name}'.`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Buy Streak Freeze (destructive convenience)
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_buy_streak_freeze',
    "Buy a streak freeze for the user's current learning language. " +
      'A streak freeze protects your streak for one missed day. ' +
      'This is a convenience wrapper that automatically uses the current learning language. ' +
      'This is a destructive action that spends Lingots/Gems.',
    {},
    {
      title: 'Buy Duolingo Streak Freeze',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    async () => {
      try {
        const client = getClient();
        const userData = await client.getUserData();

        // Find the abbreviation of the current learning language
        const learningLangString = userData.learning_language_string;
        const lang = userData.languages.find(
          (l) =>
            l.language_string.toLowerCase() ===
            learningLangString.toLowerCase(),
        );

        if (!lang) {
          return {
            content: [
              {
                type: 'text',
                text: 'No learning language found. Make sure you are actively learning a language.',
              },
            ],
          };
        }

        try {
          await client.buyItem(userData.id, 'streak_freeze', lang.language);
          return {
            content: [
              { type: 'text', text: 'Streak freeze purchased successfully.' },
            ],
          };
        } catch (buyErr) {
          // Re-use handleError which handles AlreadyHaveItemError specifically
          const msg = handleError(buyErr);
          if (msg.includes('Already equipped')) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Streak freeze already equipped — no purchase needed.',
                },
              ],
            };
          }
          return { content: [{ type: 'text', text: msg }] };
        }
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}

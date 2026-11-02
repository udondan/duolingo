/**
 * Account-level Duolingo MCP tools.
 *
 * Tools: get_user_info, get_settings, get_streak_info, get_daily_xp_progress,
 *        get_languages, get_courses, get_friends, get_calendar, get_leaderboard,
 *        get_shop_items, get_health, get_currencies, get_streak_goal
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  calendarView,
  coursesView,
  currenciesView,
  dailyXpProgressView,
  friendsView,
  healthView,
  languagesView,
  leaderboardView,
  settingsView,
  shopItemsView,
  streakGoalView,
  streakInfoView,
  userInfoView,
} from '../views/account.js';
import {
  READ_ONLY,
  reply,
  ResponseFormatSchema,
  UsernameFieldSchema,
} from './helpers.js';

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    'duolingo_get_user_info',
    {
      title: 'Get Duolingo User Info',
      description:
        "Get a Duolingo user's profile information. Returns username, full name, bio, location, " +
        'avatar URL, follower/following counts, learning language, UI language, cohort, admin status, and more.',
      inputSchema: {
        username: UsernameFieldSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ username, response_format }) =>
      reply(() => userInfoView({ username }), response_format),
  );

  server.registerTool(
    'duolingo_get_settings',
    {
      title: 'Get Duolingo User Settings',
      description:
        "Get the authenticated user's Duolingo account settings. " +
        'Returns notification preferences and follow/follower relationship flags. ' +
        'Only works for the authenticated user.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ response_format }) => reply(settingsView, response_format),
  );

  server.registerTool(
    'duolingo_get_streak_info',
    {
      title: 'Get Duolingo Streak Info',
      description:
        "Get a Duolingo user's current streak information. " +
        'Returns the site-wide streak count, daily XP goal, and whether the streak has been extended today.',
      inputSchema: {
        username: UsernameFieldSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ username, response_format }) =>
      reply(() => streakInfoView({ username }), response_format),
  );

  server.registerTool(
    'duolingo_get_daily_xp_progress',
    {
      title: 'Get Duolingo Daily XP Progress',
      description:
        "Get the authenticated user's XP progress for today. " +
        'Returns the daily XP goal, total XP earned today, and a list of lessons completed today. ' +
        'Only works for the authenticated user.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: { ...READ_ONLY, idempotentHint: false },
    },
    ({ response_format }) => reply(dailyXpProgressView, response_format),
  );

  server.registerTool(
    'duolingo_get_languages',
    {
      title: 'Get Duolingo Learning Languages',
      description:
        'Get the list of languages a Duolingo user is currently learning.',
      inputSchema: {
        username: UsernameFieldSchema,
        abbreviations: z
          .boolean()
          .default(false)
          .describe(
            "If true, return language abbreviations (e.g. 'fr') instead of full names (e.g. 'French').",
          ),
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ username, abbreviations, response_format }) =>
      reply(() => languagesView({ username, abbreviations }), response_format),
  );

  server.registerTool(
    'duolingo_get_friends',
    {
      title: 'Get Duolingo Friends',
      description:
        'Get the list of Duolingo users that a given user is following (their friends). ' +
        "Returns each friend's username, display name, and total XP. " +
        'Only works for the authenticated user.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ response_format }) => reply(friendsView, response_format),
  );

  server.registerTool(
    'duolingo_get_calendar',
    {
      title: 'Get Duolingo Activity Calendar',
      description:
        "Get a Duolingo user's recent activity calendar. " +
        'Returns all recent activity entries, sorted newest first. ' +
        'The Duolingo API provides roughly the last 2 weeks of activity. ' +
        'Note: the calendar reflects the currently selected course only ' +
        '(e.g. Spanish, Math, Chess) — not all courses combined.',
      inputSchema: {
        username: UsernameFieldSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ username, response_format }) =>
      reply(() => calendarView({ username }), response_format),
  );

  server.registerTool(
    'duolingo_get_leaderboard',
    {
      title: 'Get Duolingo Leaderboard',
      description:
        "Get the XP leaderboard for a Duolingo user's friends. " +
        'Returns the users they follow, sorted by XP for the given time unit (week or month). ' +
        'Only works for the authenticated user.',
      inputSchema: {
        unit: z
          .enum(['week', 'month'])
          .default('week')
          .describe("Time unit for the leaderboard: 'week' or 'month'."),
        response_format: ResponseFormatSchema,
      },
      annotations: { ...READ_ONLY, idempotentHint: false },
    },
    ({ unit, response_format }) =>
      reply(() => leaderboardView({ unit }), response_format),
  );

  server.registerTool(
    'duolingo_get_courses',
    {
      title: 'Get Duolingo Courses',
      description:
        'Get all courses a Duolingo user is enrolled in, including non-language subjects ' +
        "like Math, Chess, and Music. Returns each course's subject, title, XP earned, " +
        'and course ID. Language courses also include the language code.',
      inputSchema: {
        username: UsernameFieldSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ username, response_format }) =>
      reply(() => coursesView({ username }), response_format),
  );

  server.registerTool(
    'duolingo_get_shop_items',
    {
      title: 'Get Duolingo Shop Items',
      description:
        'Get the full Duolingo shop catalogue. Returns all purchasable items with ' +
        'their prices, currency type (gems/lingots), item type, and last-used dates. ' +
        'This is read-only — it does not purchase anything.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ response_format }) => reply(shopItemsView, response_format),
  );

  server.registerTool(
    'duolingo_get_health',
    {
      title: 'Get Duolingo Health (Hearts)',
      description:
        "Get the authenticated user's current hearts/health status. " +
        'Returns heart count, max hearts, refill eligibility, and time until next heart refill. ' +
        'Only works for the authenticated user.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ response_format }) => reply(healthView, response_format),
  );

  server.registerTool(
    'duolingo_get_currencies',
    {
      title: 'Get Duolingo Currency Balances',
      description:
        "Get the authenticated user's gem and lingot balances. " +
        'Only works for the authenticated user.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ response_format }) => reply(currenciesView, response_format),
  );

  server.registerTool(
    'duolingo_get_streak_goal',
    {
      title: 'Get Duolingo Streak Goal',
      description:
        "Get the authenticated user's current streak goal and upcoming checkpoints. " +
        'Shows the last completed goal, upcoming milestones, and the next selected goal. ' +
        'Only works for the authenticated user.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ response_format }) => reply(streakGoalView, response_format),
  );
}

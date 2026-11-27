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
  coursesView,
  currenciesView,
  healthView,
  languagesView,
  shopItemsView,
  switchCourseView,
} from '../views/account.js';
import { settingsView, userInfoView } from '../views/profile.js';
import {
  calendarView,
  dailyXpProgressView,
  streakGoalView,
  streakInfoView,
} from '../views/progress.js';
import { friendsView, leaderboardView } from '../views/social.js';
import {
  READ_ONLY,
  reply,
  ResponseFormatSchema,
  UsernameFieldSchema,
  WRITE,
} from './helpers.js';

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    'duolingo_get_user_info',
    {
      title: 'Get Duolingo User Info',
      description:
        'Reads the profile of a Duolingo user (default: the authenticated user): username, full name, bio, location, avatar URL, follower and following counts, learning and UI language, cohort, and more. Use it for who the user is; for the streak use duolingo_get_streak_info, for the courses duolingo_get_courses.',
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
        "Reads the account settings of the authenticated user: notification preferences and follow flags. Changes nothing, and takes no username: other users' settings are not visible. For the profile use duolingo_get_user_info.",
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
        "Reads the streak of a user (default: the authenticated user): current streak in days, daily XP goal, and whether the streak was already extended today. Use it to tell whether a lesson is still needed today; for today's XP and lessons use duolingo_get_daily_xp_progress, for the streak goal and its milestones duolingo_get_streak_goal, for the days with activity duolingo_get_calendar.",
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
        "Reads today's XP of the authenticated user: daily goal, XP earned today, and the lessons completed today. The result changes as the user learns. For the streak use duolingo_get_streak_info; for the last two weeks duolingo_get_calendar.",
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
        "Lists the language courses a user (default: the authenticated user) learns, as full names like 'French' or, with `abbreviations`, as codes like 'fr', which most language tools take. Languages only: for all courses, Math, Chess and Music too, with XP use duolingo_get_courses.",
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
        'Lists the users the authenticated user follows, each with username, display name and total XP. Takes no username. To rank them by XP of this week or month use duolingo_get_leaderboard; for one of them in detail duolingo_get_user_info with their username.',
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
        'Lists the recent activity of a user (default: the authenticated user), newest first: each entry with time, XP and, where reported, skill and event type, for about the last two weeks, as far as Duolingo keeps them. Covers only the active course (like Spanish, Math or Chess), not all courses. Use it to see on which days the user learned; for today alone use duolingo_get_daily_xp_progress.',
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
        'Ranks the users the authenticated user follows by the XP they earned this `unit` (week or month), highest first. Takes no username; the ranking changes as they learn. For the list of friends with total XP use duolingo_get_friends.',
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
        'Lists all courses a user (default: the authenticated user) is enrolled in, including Math, Chess and Music: subject, title, XP earned and course id, and for language courses the language code and the language it is taught in. Use it for an overview of all courses, or to find the course to pass to duolingo_switch_course; for language names only use duolingo_get_languages.',
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
    'duolingo_switch_course',
    {
      title: 'Switch Duolingo Course',
      description:
        "Switches the authenticated user's active course to another language course they are enrolled in. Duolingo returns topics, skills and words only for the active course, so switch first to read another one with the topic tools. This changes the account: the Duolingo apps and website continue with the new course. Switching back undoes it. Find the courses with duolingo_get_courses. Call it only when the user asks to switch or agrees to it. Returns the new active course.",
      inputSchema: {
        language_abbr: z
          .string()
          .min(2)
          .max(5)
          .describe("Language to switch to (e.g. 'es' for Spanish)."),
        from_language: z
          .string()
          .min(2)
          .max(5)
          .optional()
          .describe(
            "Language the course is taught in (e.g. 'en'). Only needed when the user learns the language from more than one language.",
          ),
        response_format: ResponseFormatSchema,
      },
      annotations: WRITE,
    },
    ({ language_abbr, from_language, response_format }) =>
      reply(
        () => switchCourseView({ language_abbr, from_language }),
        response_format,
      ),
  );

  server.registerTool(
    'duolingo_get_shop_items',
    {
      title: 'Get Duolingo Shop Items',
      description:
        'Lists the Duolingo shop catalogue: each item with name, type, price and currency (gems or lingots), and when the user last used it. Only reads, never buys. For the balance to pay with use duolingo_get_currencies.',
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
        'Reads the hearts of the authenticated user: current and maximum hearts, whether a refill is possible, and the time until the next heart. Use it to tell whether the user can start a lesson now; for gems use duolingo_get_currencies.',
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
        'Reads the gem and lingot balances of the authenticated user. Takes no username. For what they buy use duolingo_get_shop_items; for hearts duolingo_get_health.',
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
        'Reads the streak goal of the authenticated user: the last goal reached, the upcoming milestones (checkpoints in days), and the next goal selected. For the current streak use duolingo_get_streak_info.',
      inputSchema: {
        response_format: ResponseFormatSchema,
      },
      annotations: READ_ONLY,
    },
    ({ response_format }) => reply(streakGoalView, response_format),
  );
}

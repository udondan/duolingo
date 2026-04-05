/**
 * Account-level Duolingo MCP tools.
 *
 * Tools: get_user_info, get_settings, get_streak_info, get_daily_xp_progress,
 *        get_languages, get_friends, get_calendar, get_leaderboard
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../client/duolingo.js';
import {
  handleError,
  ResponseFormatSchema,
  UsernameFieldSchema,
} from './helpers.js';

export function registerAccountTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // Get User Info
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_user_info',
    "Get a Duolingo user's profile information. Returns username, full name, bio, location, " +
      'avatar URL, follower/following counts, learning language, UI language, cohort, admin status, and more.',
    {
      username: UsernameFieldSchema,
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo User Info',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const info = {
          username: userData.username,
          fullname: userData.fullname,
          bio: userData.bio,
          location: userData.location,
          avatar: userData.avatar,
          id: userData.id,
          num_followers: userData.num_followers,
          num_following: userData.num_following,
          learning_language_string: userData.learning_language_string,
          ui_language: userData.ui_language,
          admin: userData.admin,
          cohort: userData.cohort,
          contribution_points: userData.contribution_points,
          created: userData.created,
          invites_left: userData.invites_left,
        };

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
          };
        }

        const lines = [`# Duolingo User: ${info.username}`, ''];
        if (info.fullname) lines.push(`- **Full Name**: ${info.fullname}`);
        if (info.bio) lines.push(`- **Bio**: ${info.bio}`);
        if (info.location) lines.push(`- **Location**: ${info.location}`);
        lines.push(`- **Learning**: ${info.learning_language_string || 'N/A'}`);
        lines.push(`- **UI Language**: ${info.ui_language || 'N/A'}`);
        lines.push(`- **Followers**: ${info.num_followers}`);
        lines.push(`- **Following**: ${info.num_following}`);
        lines.push(`- **Contribution Points**: ${info.contribution_points}`);
        lines.push(`- **Member Since**: ${info.created || 'N/A'}`);
        if (info.avatar) lines.push(`- **Avatar**: ${info.avatar}`);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Settings (authenticated user only)
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_settings',
    "Get the authenticated user's Duolingo account settings. " +
      'Returns notification preferences and follow/follower relationship flags. ' +
      'Only works for the authenticated user.',
    {
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo User Settings',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ response_format }) => {
      try {
        const userData = await getClient().getUserData();
        const settings = {
          notify_comment: userData.notify_comment,
          deactivated: userData.deactivated,
          is_follower_by: userData.is_follower_by,
          is_following: userData.is_following,
        };

        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(settings, null, 2) },
            ],
          };
        }

        const lines = ['# Duolingo Settings', ''];
        for (const [key, value] of Object.entries(settings)) {
          const label = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          lines.push(`- **${label}**: ${value}`);
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Streak Info
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_streak_info',
    "Get a Duolingo user's current streak information. " +
      'Returns the site-wide streak count, daily XP goal, and whether the streak has been extended today.',
    {
      username: UsernameFieldSchema,
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo Streak Info',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const info = {
          site_streak: userData.site_streak,
          daily_goal: userData.daily_goal,
          streak_extended_today: userData.streak_extended_today,
        };

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
          };
        }

        const extended = info.streak_extended_today ? '✅ Yes' : '❌ No';
        const lines = [
          '# Duolingo Streak',
          '',
          `- **Current Streak**: ${info.site_streak} days`,
          `- **Daily Goal**: ${info.daily_goal} XP`,
          `- **Extended Today**: ${extended}`,
        ];
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Daily XP Progress (authenticated user only)
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_daily_xp_progress',
    "Get the authenticated user's XP progress for today. " +
      'Returns the daily XP goal, total XP earned today, and a list of lessons completed today. ' +
      'Only works for the authenticated user.',
    {
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo Daily XP Progress',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ response_format }) => {
      try {
        const client = getClient();
        const userData = await client.getUserData();
        const dailyData = await client.getUserDataById(userData.id, [
          'xpGoal',
          'xpGains',
          'streakData',
        ]);

        // Filter lessons to only those from today.
        // Use streakData.updatedTimestamp as the "last midnight" reference.
        const reportedTimestamp = dailyData.streakData.updatedTimestamp;
        const reportedMidnight = new Date(reportedTimestamp * 1000);
        reportedMidnight.setHours(0, 0, 0, 0);

        const systemMidnight = new Date();
        systemMidnight.setHours(0, 0, 0, 0);

        // If reported midnight is in the future, fall back to system midnight
        const cutoffMidnight =
          reportedMidnight > systemMidnight ? systemMidnight : reportedMidnight;
        const updateCutoff = Math.round(cutoffMidnight.getTime() / 1000);

        const lessonsToday = dailyData.xpGains.filter(
          (lesson) => lesson.time > updateCutoff,
        );
        const xpToday = lessonsToday.reduce((sum, l) => sum + l.xp, 0);

        const progress = {
          xp_goal: dailyData.xpGoal,
          xp_today: xpToday,
          lessons_today: lessonsToday,
        };

        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(progress, null, 2) },
            ],
          };
        }

        const pct =
          progress.xp_goal > 0
            ? Math.round((xpToday / progress.xp_goal) * 100)
            : 0;
        const lines = [
          '# Daily XP Progress',
          '',
          `- **XP Today**: ${xpToday} / ${progress.xp_goal} (${pct}%)`,
          `- **Lessons Completed**: ${lessonsToday.length}`,
        ];
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Languages
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_languages',
    'Get the list of languages a Duolingo user is currently learning.',
    {
      username: UsernameFieldSchema,
      abbreviations: z
        .boolean()
        .default(false)
        .describe(
          "If true, return language abbreviations (e.g. 'fr') instead of full names (e.g. 'French').",
        ),
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo Learning Languages',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ username, abbreviations, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const languages = userData.languages
          .filter((lang) => lang.learning)
          .map((lang) =>
            abbreviations ? lang.language : lang.language_string,
          );

        if (languages.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No languages found. The user may not be learning any languages.',
              },
            ],
          };
        }

        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(languages, null, 2) },
            ],
          };
        }

        const lines = ['# Learning Languages', ''];
        for (const lang of languages) {
          lines.push(`- ${lang}`);
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Friends
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_friends',
    "Get a Duolingo user's friends list. " +
      "Returns each friend's username, total points, and languages they are learning. " +
      'The queried user is included in this list.',
    {
      username: UsernameFieldSchema,
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo Friends',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);

        // Bug fix: handle missing points_ranking_data gracefully
        const langValues = Object.values(userData.language_data);
        const firstLangWithRanking = langValues.find(
          (v) => v.points_ranking_data && v.points_ranking_data.length > 0,
        );

        if (!firstLangWithRanking?.points_ranking_data) {
          return { content: [{ type: 'text', text: 'No friends found.' }] };
        }

        const friends = firstLangWithRanking.points_ranking_data.map(
          (friend) => ({
            username: friend.username,
            id: friend.id,
            points: friend.points_data.total,
            languages: friend.points_data.languages.map(
              (l) => l.language_string,
            ),
          }),
        );

        if (friends.length === 0) {
          return { content: [{ type: 'text', text: 'No friends found.' }] };
        }

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(friends, null, 2) }],
          };
        }

        const lines = ['# Duolingo Friends', ''];
        for (const friend of friends) {
          const langs = friend.languages.join(', ');
          lines.push(
            `- **${friend.username}** — ${friend.points} pts | Languages: ${langs || 'None'}`,
          );
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Calendar
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_calendar',
    "Get a Duolingo user's recent activity calendar. " +
      'Returns a list of recent activity entries. Optionally filter by language.',
    {
      username: UsernameFieldSchema,
      language_abbr: z
        .string()
        .optional()
        .describe(
          "Language abbreviation to filter calendar by (e.g. 'fr'). " +
            'If omitted, returns the overall calendar.',
        ),
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo Activity Calendar',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ username, language_abbr, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        let calendar;

        if (language_abbr) {
          const langData = userData.language_data[language_abbr];
          if (!langData) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No calendar found for language '${language_abbr}'. Make sure the user is learning this language.`,
                },
              ],
            };
          }
          calendar = langData.calendar;
        } else {
          calendar = userData.calendar;
        }

        if (!calendar || calendar.length === 0) {
          return {
            content: [{ type: 'text', text: 'No calendar entries found.' }],
          };
        }

        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(calendar, null, 2) },
            ],
          };
        }

        const lines = ['# Activity Calendar', ''];
        const entries = calendar.slice(0, 20);
        for (const entry of entries) {
          lines.push(`- ${JSON.stringify(entry)}`);
        }
        if (calendar.length > 20) {
          lines.push(`\n_... and ${calendar.length - 20} more entries_`);
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Leaderboard
  // -------------------------------------------------------------------------
  server.tool(
    'duolingo_get_leaderboard',
    "Get a Duolingo user's leaderboard ranking among their friends. " +
      'Returns an ordered list of friends sorted by XP points for the given time unit.',
    {
      username: UsernameFieldSchema,
      unit: z
        .enum(['week', 'month'])
        .default('week')
        .describe("Time unit for the leaderboard: 'week' or 'month'."),
      response_format: ResponseFormatSchema,
    },
    {
      title: 'Get Duolingo Leaderboard',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ username, unit, response_format }) => {
      try {
        const client = getClient();
        const before = String(Date.now() / 1000);
        const leaderboardData = await client.getLeaderboard(unit, before);

        const ranking = leaderboardData.ranking ?? {};
        if (Object.keys(ranking).length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No leaderboard data found for unit '${unit}'.`,
              },
            ],
          };
        }

        // Bug fix: handle missing points_ranking_data gracefully
        const userData = await client.getUserData(username);
        const langValues = Object.values(userData.language_data);
        const firstLangWithRanking = langValues.find(
          (v) => v.points_ranking_data && v.points_ranking_data.length > 0,
        );

        const friendsById = new Map<number, string>();
        if (firstLangWithRanking?.points_ranking_data) {
          for (const friend of firstLangWithRanking.points_ranking_data) {
            friendsById.set(friend.id, friend.username);
          }
        }

        const data = Object.entries(ranking)
          .map(([uid, points]) => {
            const id = parseInt(uid, 10);
            const friendUsername = friendsById.get(id);
            if (!friendUsername) return null;
            return {
              unit,
              id,
              points: parseInt(points, 10),
              username: friendUsername,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .sort((a, b) => b.points - a.points);

        if (data.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No leaderboard data found for unit '${unit}'.`,
              },
            ],
          };
        }

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          };
        }

        const lines = [
          `# Leaderboard (${unit.charAt(0).toUpperCase() + unit.slice(1)})`,
          '',
        ];
        for (const [rank, entry] of data.entries()) {
          lines.push(
            `${rank + 1}. **${entry.username}** — ${entry.points} pts`,
          );
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}

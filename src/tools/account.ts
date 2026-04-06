/**
 * Account-level Duolingo MCP tools.
 *
 * Tools: get_user_info, get_settings, get_streak_info, get_daily_xp_progress,
 *        get_languages, get_courses, get_friends, get_calendar, get_leaderboard,
 *        get_shop_items, get_health, get_currencies, get_streak_goal
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        // num_followers/num_following moved to tracking_properties in current API
        const tp = userData.tracking_properties ?? {};
        const numFollowers =
          typeof tp.num_followers === 'number'
            ? tp.num_followers
            : userData.num_followers;
        const numFollowing =
          typeof tp.num_following === 'number'
            ? tp.num_following
            : userData.num_following;
        const info = {
          username: userData.username,
          fullname: userData.fullname,
          bio: userData.bio,
          location: userData.location,
          avatar: userData.avatar,
          id: userData.id,
          num_followers: numFollowers,
          num_following: numFollowing,
          learning_language_string: userData.learning_language_string,
          ui_language: userData.ui_language,
          admin: userData.admin,
          cohort: userData.cohort,
          // creation_date is an ISO string (preferred); created is a human-readable relative string
          creation_date: userData.creation_date,
          created: userData.created,
        };

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
          };
        }

        const lines = [`# Duolingo User: ${info.username}`, ''];
        if (info.fullname.length > 0)
          lines.push(`- **Full Name**: ${info.fullname}`);
        if (info.bio.length > 0) lines.push(`- **Bio**: ${info.bio}`);
        if (info.location !== null && info.location.length > 0)
          lines.push(`- **Location**: ${info.location}`);
        lines.push(
          `- **Learning**: ${info.learning_language_string.length > 0 ? info.learning_language_string : 'N/A'}`,
        );
        lines.push(
          `- **UI Language**: ${info.ui_language.length > 0 ? info.ui_language : 'N/A'}`,
        );
        if (typeof info.num_followers === 'number')
          lines.push(`- **Followers**: ${info.num_followers}`);
        if (typeof info.num_following === 'number')
          lines.push(`- **Following**: ${info.num_following}`);
        if (info.creation_date)
          lines.push(`- **Member Since**: ${info.creation_date.slice(0, 10)}`);
        else if (info.created)
          lines.push(`- **Member Since**: ${info.created}`);
        if (info.avatar.length > 0) lines.push(`- **Avatar**: ${info.avatar}`);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Settings (authenticated user only)
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const userData = await getClient().getUserData();
        // is_follower_by / is_following are no longer in the API response;
        // notify_comment and deactivated are still present.
        const settings: Record<string, unknown> = {
          notify_comment: userData.notify_comment,
          deactivated: userData.deactivated,
        };
        // Include social flags only when the API returns them
        if (userData.is_follower_by !== undefined)
          settings.is_follower_by = userData.is_follower_by;
        if (userData.is_following !== undefined)
          settings.is_following = userData.is_following;

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
          lines.push(`- **${label}**: ${String(value)}`);
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ username, response_format }) => {
      try {
        const client = getClient();

        // Fetch legacy user data (has daily_goal) and v2 data (has streak details)
        let userId: number;
        let dailyGoal: number | null;
        if (!username) {
          const userData = await client.getUserData();
          userId = userData.id;
          dailyGoal = userData.daily_goal ?? null;
        } else {
          userId = await client.getUserIdByUsername(username);
          const userData = await client.getUserData(username);
          dailyGoal = userData.daily_goal ?? null;
        }

        const v2 = await client.getUserDataV2(userId);
        const streakData = v2.streakData;
        const current = streakData.currentStreak;

        const info = {
          site_streak: v2.streak,
          daily_goal: dailyGoal,
          streak_extended_today:
            current !== null
              ? current.lastExtendedDate ===
                new Date().toISOString().slice(0, 10)
              : false,
          streak_start: current?.startDate ?? null,
          longest_streak: streakData.longestStreak?.length ?? null,
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
          `- **Extended Today**: ${extended}`,
        ];
        if (typeof info.daily_goal === 'number')
          lines.push(`- **Daily Goal**: ${info.daily_goal} XP`);
        if (info.streak_start !== null)
          lines.push(`- **Streak Started**: ${info.streak_start}`);
        if (info.longest_streak !== null)
          lines.push(`- **Longest Streak**: ${info.longest_streak} days`);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Daily XP Progress (authenticated user only)
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ username, abbreviations, response_format }) => {
      try {
        const client = getClient();

        // Resolve user ID for the v2 API
        let userId: number;
        if (!username) {
          const userData = await client.getUserData();
          userId = userData.id;
        } else {
          userId = await client.getUserIdByUsername(username);
        }

        const v2 = await client.getUserDataV2(userId);
        // Filter to language courses only (not math/chess/music)
        const langCourses = v2.courses.filter(
          (c) => c.subject === 'language' && c.learningLanguage !== undefined,
        );
        const languages = langCourses.map((c) =>
          abbreviations
            ? (c.learningLanguage ?? c.topic)
            : (c.title ?? c.learningLanguage ?? c.topic),
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const client = getClient();
        const userData = await client.getUserData();
        // Friends = people the authenticated user is following
        const following = await client.getFollowing(userData.id);

        if (following.length === 0) {
          return { content: [{ type: 'text', text: 'No friends found.' }] };
        }

        const friends = following.map((f) => ({
          username: f.username,
          id: f.userId,
          points: f.totalXp,
          display_name: f.displayName,
        }));

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(friends, null, 2) }],
          };
        }

        const lines = ['# Duolingo Friends', ''];
        for (const friend of friends) {
          const name = friend.display_name ?? friend.username;
          lines.push(
            `- **${name}** (@${friend.username}) — ${friend.points} XP`,
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ username, response_format }) => {
      try {
        const userData = await getClient().getUserData(username);
        const calendar = userData.calendar;

        // Sort newest first
        const sorted = [...calendar].sort((a, b) => b.datetime - a.datetime);

        if (sorted.length === 0) {
          return {
            content: [{ type: 'text', text: 'No calendar entries found.' }],
          };
        }

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(sorted, null, 2) }],
          };
        }

        const lines = ['# Activity Calendar', ''];
        for (const entry of sorted) {
          const date = new Date(entry.datetime)
            .toISOString()
            .replace('T', ' ')
            .slice(0, 16);
          const parts = [`**${date}**`, `${entry.improvement} XP`];
          if (entry.skill_id) parts.push(`skill: ${entry.skill_id}`);
          if (entry.event_type) parts.push(`type: ${entry.event_type}`);
          lines.push(`- ${parts.join(' — ')}`);
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ unit, response_format }) => {
      try {
        const client = getClient();
        const userData = await client.getUserData();
        // Leaderboard = people the authenticated user is following, sorted by XP
        const following = await client.getFollowing(userData.id);

        if (following.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No leaderboard data found for unit '${unit}'.`,
              },
            ],
          };
        }

        const data = following
          .map((f) => ({
            unit,
            id: f.userId,
            username: f.username,
            display_name: f.displayName,
            points: unit === 'week' ? (f.userScore?.score ?? 0) : f.totalXp,
          }))
          .sort((a, b) => b.points - a.points);

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
          const name = entry.display_name ?? entry.username;
          lines.push(
            `${rank + 1}. **${name}** (@${entry.username}) — ${entry.points} pts`,
          );
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Courses (all subjects: language, math, chess, music)
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ username, response_format }) => {
      try {
        const client = getClient();

        // Resolve user ID: use authenticated user's ID if no username given,
        // otherwise look up the target user's ID via the v2 API.
        let userId: number;
        if (!username) {
          const userData = await client.getUserData();
          userId = userData.id;
        } else {
          userId = await client.getUserIdByUsername(username);
        }

        const v2 = await client.getUserDataV2(userId);
        const courses = v2.courses;

        if (courses.length === 0) {
          return {
            content: [{ type: 'text', text: 'No courses found.' }],
          };
        }

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(courses, null, 2) }],
          };
        }

        const SUBJECT_LABELS: Record<string, string> = {
          language: '🌐 Language',
          math: '🔢 Math',
          chess: '♟️ Chess',
          music: '🎵 Music',
        };

        const lines = [`# Courses for ${v2.username}`, ''];
        for (const course of courses) {
          const label = SUBJECT_LABELS[course.subject] ?? course.subject;
          const title =
            course.title ??
            course.subject.charAt(0).toUpperCase() + course.subject.slice(1);
          const lang = course.learningLanguage
            ? ` (${course.learningLanguage})`
            : '';
          lines.push(
            `- **${label}: ${title}${lang}** — ${course.xp.toLocaleString()} XP`,
          );
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Shop Items
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const items = await getClient().getShopItems();

        if (items.length === 0) {
          return { content: [{ type: 'text', text: 'No shop items found.' }] };
        }

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(items, null, 2) }],
          };
        }

        const lines = ['# Duolingo Shop', ''];
        // Group by type
        const byType = new Map<string, typeof items>();
        for (const item of items) {
          const group = byType.get(item.type) ?? [];
          group.push(item);
          byType.set(item.type, group);
        }
        for (const [type, typeItems] of byType) {
          lines.push(
            `## ${type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
          );
          for (const item of typeItems) {
            const name = item.name ?? item.id;
            const currency = item.currencyType === 'XGM' ? 'gems' : 'lingots';
            lines.push(`- **${name}** — ${item.price} ${currency}`);
          }
          lines.push('');
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Health (hearts)
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const health = await getClient().getHealth();

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(health, null, 2) }],
          };
        }

        const lines = ['# Hearts / Health', ''];
        lines.push(`- **Hearts**: ${health.hearts} / ${health.maxHearts}`);
        lines.push(
          `- **Health Enabled**: ${health.healthEnabled ? 'Yes' : 'No'}`,
        );
        lines.push(
          `- **Unlimited Hearts**: ${health.unlimitedHeartsAvailable ? 'Yes' : 'No'}`,
        );
        lines.push(
          `- **Eligible for Free Refill**: ${health.eligibleForFreeRefill ? 'Yes' : 'No'}`,
        );
        if (health.secondsUntilNextHeartSegment !== null) {
          const mins = Math.ceil(health.secondsUntilNextHeartSegment / 60);
          lines.push(`- **Next Heart In**: ${mins} min`);
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Currencies (gems + lingots)
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const currencies = await getClient().getCurrencies();

        if (response_format === 'json') {
          return {
            content: [
              { type: 'text', text: JSON.stringify(currencies, null, 2) },
            ],
          };
        }

        const lines = ['# Currency Balances', ''];
        lines.push(`- **Gems**: ${currencies.gems.toLocaleString()}`);
        lines.push(`- **Lingots**: ${currencies.lingots.toLocaleString()}`);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Streak Goal
  // -------------------------------------------------------------------------
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
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }) => {
      try {
        const data = await getClient().getStreakGoalCurrent();

        if (response_format === 'json') {
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          };
        }

        if (!data.hasActiveGoal || !data.streakGoal) {
          return {
            content: [{ type: 'text', text: 'No active streak goal.' }],
          };
        }

        const goal = data.streakGoal;
        const lines = ['# Streak Goal', ''];
        lines.push(`- **Last Completed Goal**: ${goal.lastCompleteGoal} days`);
        if (goal.nextSelectedGoal) {
          lines.push(
            `- **Next Goal**: ${goal.nextSelectedGoal.length} days (every ${goal.nextSelectedGoal.dayInterval} days)`,
          );
        }
        if (goal.checkpoints.length > 0) {
          lines.push('', '## Upcoming Checkpoints');
          for (const cp of goal.checkpoints) {
            lines.push(`- ${cp.length} days`);
          }
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}

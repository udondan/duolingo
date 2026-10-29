/**
 * Account-level views: profile, settings, streak, XP, languages, courses,
 * friends, calendar, leaderboard, shop, health, currencies and streak goal.
 */

import { getClient } from '../client/duolingo.js';
import { resolveUserId, type View } from './view.js';

function titleCase(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function userInfoView(opts: { username?: string }): Promise<View> {
  const userData = await getClient().getUserData(opts.username);
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

  return {
    data: info,
    markdown: () => {
      const lines = [`# Duolingo User: ${info.username}`, ''];
      if (info.fullname.length > 0)
        lines.push(`- **Full Name**: ${info.fullname}`);
      if (info.bio.length > 0) lines.push(`- **Bio**: ${info.bio}`);
      if (info.location !== null && info.location.length > 0)
        lines.push(`- **Location**: ${info.location}`);
      lines.push(
        `- **Learning**: ${info.learning_language_string !== null && info.learning_language_string.length > 0 ? info.learning_language_string : 'N/A'}`,
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
      else if (info.created) lines.push(`- **Member Since**: ${info.created}`);
      if (info.avatar.length > 0) lines.push(`- **Avatar**: ${info.avatar}`);
      return lines.join('\n');
    },
  };
}

export async function settingsView(): Promise<View> {
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

  return {
    data: settings,
    markdown: () => {
      const lines = ['# Duolingo Settings', ''];
      for (const [key, value] of Object.entries(settings)) {
        lines.push(`- **${titleCase(key)}**: ${String(value)}`);
      }
      return lines.join('\n');
    },
  };
}

export async function streakInfoView(opts: {
  username?: string;
}): Promise<View> {
  const client = getClient();

  // Fetch legacy user data (has daily_goal) and v2 data (has streak details)
  let userId: number;
  let dailyGoal: number | null;
  if (!opts.username) {
    const userData = await client.getUserData();
    userId = userData.id;
    dailyGoal = userData.daily_goal ?? null;
  } else {
    userId = await client.getUserIdByUsername(opts.username);
    const userData = await client.getUserData(opts.username);
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
        ? current.lastExtendedDate === new Date().toISOString().slice(0, 10)
        : false,
    streak_start: current?.startDate ?? null,
    longest_streak: streakData.longestStreak?.length ?? null,
  };

  return {
    data: info,
    markdown: () => {
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
      return lines.join('\n');
    },
  };
}

export async function dailyXpProgressView(): Promise<View> {
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

  return {
    data: progress,
    markdown: () => {
      const pct =
        progress.xp_goal > 0
          ? Math.round((xpToday / progress.xp_goal) * 100)
          : 0;
      return [
        '# Daily XP Progress',
        '',
        `- **XP Today**: ${xpToday} / ${progress.xp_goal} (${pct}%)`,
        `- **Lessons Completed**: ${lessonsToday.length}`,
      ].join('\n');
    },
  };
}

export async function languagesView(opts: {
  username?: string;
  abbreviations?: boolean;
}): Promise<View> {
  const client = getClient();
  const userId = await resolveUserId(client, opts.username);
  const v2 = await client.getUserDataV2(userId);
  // Filter to language courses only (not math/chess/music)
  const langCourses = v2.courses.filter(
    (c) => c.subject === 'language' && c.learningLanguage !== undefined,
  );
  const languages = langCourses.map((c) =>
    opts.abbreviations
      ? (c.learningLanguage ?? c.topic)
      : (c.title ?? c.learningLanguage ?? c.topic),
  );

  return {
    data: languages,
    message:
      languages.length === 0
        ? 'No languages found. The user may not be learning any languages.'
        : undefined,
    markdown: () =>
      ['# Learning Languages', '', ...languages.map((l) => `- ${l}`)].join(
        '\n',
      ),
  };
}

export async function friendsView(): Promise<View> {
  const client = getClient();
  const userData = await client.getUserData();
  // Friends = people the authenticated user is following
  const following = await client.getFollowing(userData.id);

  const friends = following.map((f) => ({
    username: f.username,
    id: f.userId,
    points: f.totalXp,
    display_name: f.displayName,
  }));

  return {
    data: friends,
    message: friends.length === 0 ? 'No friends found.' : undefined,
    markdown: () => {
      const lines = ['# Duolingo Friends', ''];
      for (const friend of friends) {
        const name = friend.display_name ?? friend.username;
        lines.push(`- **${name}** (@${friend.username}) — ${friend.points} XP`);
      }
      return lines.join('\n');
    },
  };
}

export async function calendarView(opts: { username?: string }): Promise<View> {
  const userData = await getClient().getUserData(opts.username);
  const calendar = userData.calendar ?? [];

  // Sort newest first
  const sorted = [...calendar].sort((a, b) => b.datetime - a.datetime);

  return {
    data: sorted,
    message: sorted.length === 0 ? 'No calendar entries found.' : undefined,
    markdown: () => {
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
      return lines.join('\n');
    },
  };
}

export async function leaderboardView(opts: {
  unit: 'week' | 'month';
}): Promise<View> {
  const { unit } = opts;
  const client = getClient();
  const userData = await client.getUserData();
  // Leaderboard = people the authenticated user is following, sorted by XP
  const following = await client.getFollowing(userData.id);

  const data = following
    .map((f) => ({
      unit,
      id: f.userId,
      username: f.username,
      display_name: f.displayName,
      points: unit === 'week' ? (f.userScore?.score ?? 0) : f.totalXp,
    }))
    .sort((a, b) => b.points - a.points);

  return {
    data,
    message:
      data.length === 0
        ? `No leaderboard data found for unit '${unit}'.`
        : undefined,
    markdown: () => {
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
      return lines.join('\n');
    },
  };
}

const SUBJECT_LABELS: Record<string, string> = {
  language: '🌐 Language',
  math: '🔢 Math',
  chess: '♟️ Chess',
  music: '🎵 Music',
};

export async function coursesView(opts: { username?: string }): Promise<View> {
  const client = getClient();
  const userId = await resolveUserId(client, opts.username);
  const v2 = await client.getUserDataV2(userId);
  const courses = v2.courses;

  return {
    data: courses,
    message: courses.length === 0 ? 'No courses found.' : undefined,
    markdown: () => {
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
      return lines.join('\n');
    },
  };
}

export async function shopItemsView(): Promise<View> {
  const items = await getClient().getShopItems();

  return {
    data: items,
    message: items.length === 0 ? 'No shop items found.' : undefined,
    markdown: () => {
      const lines = ['# Duolingo Shop', ''];
      // Group by type
      const byType = new Map<string, typeof items>();
      for (const item of items) {
        const group = byType.get(item.type) ?? [];
        group.push(item);
        byType.set(item.type, group);
      }
      for (const [type, typeItems] of byType) {
        lines.push(`## ${titleCase(type)}`);
        for (const item of typeItems) {
          const name = item.name ?? item.id;
          const currency = item.currencyType === 'XGM' ? 'gems' : 'lingots';
          lines.push(`- **${name}** — ${item.price} ${currency}`);
        }
        lines.push('');
      }
      return lines.join('\n');
    },
  };
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

export async function healthView(): Promise<View> {
  const health = await getClient().getHealth();

  return {
    data: health,
    markdown: () => {
      const lines = [
        '# Hearts / Health',
        '',
        `- **Hearts**: ${health.hearts} / ${health.maxHearts}`,
        `- **Health Enabled**: ${yesNo(health.healthEnabled)}`,
        `- **Unlimited Hearts**: ${yesNo(health.unlimitedHeartsAvailable)}`,
        `- **Eligible for Free Refill**: ${yesNo(health.eligibleForFreeRefill)}`,
      ];
      if (health.secondsUntilNextHeartSegment !== null) {
        const mins = Math.ceil(health.secondsUntilNextHeartSegment / 60);
        lines.push(`- **Next Heart In**: ${mins} min`);
      }
      return lines.join('\n');
    },
  };
}

export async function currenciesView(): Promise<View> {
  const currencies = await getClient().getCurrencies();

  return {
    data: currencies,
    markdown: () =>
      [
        '# Currency Balances',
        '',
        `- **Gems**: ${currencies.gems.toLocaleString()}`,
        `- **Lingots**: ${currencies.lingots.toLocaleString()}`,
      ].join('\n'),
  };
}

export async function streakGoalView(): Promise<View> {
  const data = await getClient().getStreakGoalCurrent();

  return {
    data,
    markdown: () => {
      if (!data.hasActiveGoal || !data.streakGoal) {
        return 'No active streak goal.';
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
      return lines.join('\n');
    },
  };
}

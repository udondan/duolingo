/**
 * Progress views: streak, daily XP, streak goal and activity calendar.
 */

import { getClient } from '../client/duolingo.js';
import type { View } from './view.js';

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

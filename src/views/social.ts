/**
 * Social views: friends and leaderboard.
 */

import { getClient } from '../client/duolingo.js';
import type { View } from './view.js';

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

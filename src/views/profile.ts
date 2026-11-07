/**
 * Profile views: user info and settings.
 */

import { getClient } from '../client/duolingo.js';
import type { DuolingoUserData } from '../client/types.js';
import { bullet, nonEmpty, titleCase, type View } from './view.js';

/**
 * Follower counts moved to tracking_properties in the current API. Prefer
 * them and fall back to the top-level fields of older responses.
 */
function followCount(tracked: number | undefined, fallback: unknown): unknown {
  return typeof tracked === 'number' ? tracked : fallback;
}

function userInfo(userData: DuolingoUserData) {
  const tp = userData.tracking_properties ?? {};
  return {
    username: userData.username,
    fullname: userData.fullname,
    bio: userData.bio,
    location: userData.location,
    avatar: userData.avatar,
    id: userData.id,
    num_followers: followCount(tp.num_followers, userData.num_followers),
    num_following: followCount(tp.num_following, userData.num_following),
    learning_language_string: userData.learning_language_string,
    ui_language: userData.ui_language,
    admin: userData.admin,
    cohort: userData.cohort,
    // creation_date is an ISO string (preferred); created is a human-readable relative string
    creation_date: userData.creation_date,
    created: userData.created,
  };
}

function userInfoMarkdown(info: ReturnType<typeof userInfo>): string {
  const memberSince =
    nonEmpty(info.creation_date)?.slice(0, 10) ?? nonEmpty(info.created);
  return [
    `# Duolingo User: ${info.username}`,
    '',
    ...bullet('Full Name', info.fullname),
    ...bullet('Bio', info.bio),
    ...bullet('Location', info.location),
    ...bullet('Learning', nonEmpty(info.learning_language_string) ?? 'N/A'),
    ...bullet('UI Language', nonEmpty(info.ui_language) ?? 'N/A'),
    ...bullet('Followers', info.num_followers),
    ...bullet('Following', info.num_following),
    ...bullet('Member Since', memberSince),
    ...bullet('Avatar', info.avatar),
  ].join('\n');
}

export async function userInfoView(opts: { username?: string }): Promise<View> {
  const info = userInfo(await getClient().getUserData(opts.username));
  return { data: info, markdown: () => userInfoMarkdown(info) };
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

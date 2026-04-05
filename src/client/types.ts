/**
 * TypeScript interfaces for Duolingo REST API response shapes.
 * Based on the unofficial Duolingo API at https://www.duolingo.com/users/<username>
 */

export interface DuolingoCalendarEntry {
  datetime: number;
  improvement: number;
}

export interface DuolingoSkill {
  id: string;
  name: string;
  title: string;
  learned: boolean;
  strength: number;
  progress_percent: number;
  words: string[];
  dependencies_name: string[];
  dependency_order?: number;
  [key: string]: unknown;
}

export interface DuolingoLanguageData {
  streak: number;
  language_string: string;
  level_progress: number;
  num_skills_learned: number;
  level_percent: number;
  level_points: number;
  next_level: number;
  level_left: number;
  language: string;
  points: number;
  fluency_score: number | null;
  level: number;
  calendar: DuolingoCalendarEntry[];
  skills: DuolingoSkill[];
  [key: string]: unknown;
}

export interface DuolingoLanguage {
  language: string;
  language_string: string;
  learning: boolean;
  current_learning: boolean;
  level: number;
  points: number;
  streak: number;
  [key: string]: unknown;
}

export interface DuolingoTrackingProperties {
  num_followers?: number;
  num_following?: number;
  streak?: number;
  gems?: number;
  [key: string]: unknown;
}

export interface DuolingoUserData {
  username: string;
  bio: string;
  id: number;
  cohort: number | null;
  learning_language_string: string;
  /** Returns human-readable relative text. Use creation_date for ISO string. */
  created?: string;
  /** ISO date string e.g. "2025-08-07T17:13:57". */
  creation_date?: string;
  /** Unix ms timestamp. */
  created_dt?: number;
  gplus_id?: string;
  twitter_id?: string;
  admin: boolean;
  location: string | null;
  fullname: string;
  avatar: string;
  ui_language: string;
  daily_goal: number | null;
  site_streak: number;
  streak_extended_today: boolean;
  notify_comment: boolean;
  deactivated: boolean;
  tts_base_url?: string;
  dict_base_url?: string;
  tracking_properties?: DuolingoTrackingProperties;
  calendar: DuolingoCalendarEntry[];
  languages: DuolingoLanguage[];
  language_data: Record<string, DuolingoLanguageData>;
  [key: string]: unknown;
}

export interface DuolingoXpGain {
  skillId: string | null;
  xp: number;
  time: number;
  eventType?: string | null;
}

export interface DuolingoStreakData {
  updatedTimestamp: number;
  [key: string]: unknown;
}

export interface DuolingoDailyProgress {
  xpGoal: number;
  xpGains: DuolingoXpGain[];
  streakData: DuolingoStreakData;
}

export interface DuolingoLeaderboardData {
  ranking: Record<string, string>;
}

/** A user entry from /2017-06-30/friends/users/{id}/following or /followers */
export interface DuolingoFriendUser {
  userId: number;
  username: string;
  displayName: string | null;
  picture: string;
  totalXp: number;
  isFollowing: boolean;
  isFollowedBy: boolean;
  hasSubscription: boolean;
  userScore?: {
    courseId: string;
    score: number | null;
  };
  [key: string]: unknown;
}

export interface DuolingoFollowingResponse {
  following: {
    users: DuolingoFriendUser[];
    totalUsers: number;
    cursor: string | null;
  };
}

export interface DuolingoFollowersResponse {
  followers: {
    users: DuolingoFriendUser[];
    totalUsers: number;
    cursor: string | null;
  };
}

export interface DuolingoSessionRequest {
  fromLanguage: string;
  learningLanguage: string;
  challengeTypes: string[];
  skillId?: string;
  type: string;
  juicy: boolean;
  smartTipsVersion: number;
}

export interface DuolingoChallenge {
  prompt?: string;
  tts?: string;
  metadata?: {
    non_character_tts?: {
      tokens: Record<string, string>;
    };
  };
  tokens?: DuolingoToken[];
  [key: string]: unknown;
}

export type DuolingoToken =
  | { tts?: string; value?: string; [key: string]: unknown }
  | DuolingoToken[];

export interface DuolingoSessionResponse {
  challenges: DuolingoChallenge[];
  /** Map of TTS URL → annotation data. Keys are the TTS CDN URLs. */
  ttsAnnotations?: Record<string, unknown>;
}

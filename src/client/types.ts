/**
 * TypeScript interfaces for Duolingo REST API response shapes.
 * Based on the unofficial Duolingo API at https://www.duolingo.com/users/<username>
 */

export interface DuolingoCalendarEntry {
  datetime: number;
  improvement: number;
  event_type?: string | null;
  skill_id?: string | null;
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
  tracking_properties?: DuolingoTrackingProperties;
  calendar: DuolingoCalendarEntry[];
  languages: DuolingoLanguage[];
  language_data: Record<string, DuolingoLanguageData>;
  [key: string]: unknown;
}

/**
 * A course entry from the 2023-05-23 API.
 * Covers language courses as well as non-language subjects (math, chess, music).
 */
export interface DuolingoCourse {
  id: string;
  /** Subject type: 'language' | 'math' | 'chess' | 'music' */
  subject: string;
  /** Short topic code, e.g. 'es', 'bt' (math), 'ch' (chess), 'mt' (music). */
  topic: string;
  xp: number;
  fromLanguage: string;
  /** Only present for language courses. */
  learningLanguage?: string;
  /** Only present for language courses. */
  title?: string;
  /** Only present for language courses. */
  authorId?: string;
  [key: string]: unknown;
}

export interface DuolingoStreakInfo {
  length: number;
  lastExtendedDate?: string;
  startDate?: string;
  endDate?: string;
}

export interface DuolingoStreakDataV2 {
  currentStreak: DuolingoStreakInfo | null;
  previousStreak: DuolingoStreakInfo | null;
  longestStreak?: DuolingoStreakInfo;
  updatedTimestamp?: number;
  [key: string]: unknown;
}

/** User data from the 2023-05-23 API — includes non-language courses. */
export interface DuolingoUserDataV2 {
  id: number;
  username: string;
  name: string | null;
  picture: string;
  totalXp: number;
  streak: number;
  streakData: DuolingoStreakDataV2;
  courses: DuolingoCourse[];
  hasPlus: boolean;
  subscriberLevel: string;
  fromLanguage: string;
  learningLanguage: string;
  location?: string | null;
  creationDate?: number;
  [key: string]: unknown;
}

export interface DuolingoUserIdResponse {
  users: { id: number }[];
}

export interface DuolingoShopItem {
  id: string;
  name?: string;
  type: string;
  localizedDescription?: string;
  price: number;
  currencyType: string;
  lastUsedDate?: number;
  lastPurchaseDate?: number;
  isActive?: boolean;
  value?: number;
  [key: string]: unknown;
}

export interface DuolingoShopItemsResponse {
  shopItems: DuolingoShopItem[];
}

export interface DuolingoHealth {
  eligibleForFreeRefill: boolean;
  healthEnabled: boolean;
  hearts: number;
  maxHearts: number;
  secondsPerHeartSegment: number;
  secondsUntilNextHeartSegment: number | null;
  useHealth: boolean;
  unlimitedHeartsAvailable: boolean;
}

export interface DuolingoStreakGoalCheckpoint {
  length: number;
  dayInterval: number;
  tier: number;
}

export interface DuolingoStreakGoal {
  userId: string;
  lastCompleteGoal: number;
  checkpoints: DuolingoStreakGoalCheckpoint[];
  nextSelectedGoal?: DuolingoStreakGoalCheckpoint;
}

export interface DuolingoStreakGoalCurrentResponse {
  hasActiveGoal: boolean;
  streakGoal: DuolingoStreakGoal | null;
}

export interface DuolingoStreakGoalOption {
  length: number;
  dayInterval: number;
  tier: number;
}

export interface DuolingoStreakGoalNextOptionsResponse {
  currentStreakOptions: DuolingoStreakGoalOption[];
  previousStreakOptions: DuolingoStreakGoalOption[];
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

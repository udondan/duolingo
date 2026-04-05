/**
 * TypeScript interfaces for Duolingo REST API response shapes.
 * Based on the unofficial Duolingo API at https://www.duolingo.com/users/<username>
 */

export interface DuolingoCalendarEntry {
  datetime: number;
  improvement: number;
}

export interface DuolingoFriendLanguage {
  language_string: string;
  [key: string]: unknown;
}

export interface DuolingoFriendPointsData {
  total: number;
  languages: DuolingoFriendLanguage[];
}

export interface DuolingoFriend {
  username: string;
  id: number;
  points_data: DuolingoFriendPointsData;
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
  points_rank: number;
  next_level: number;
  level_left: number;
  language: string;
  points: number;
  fluency_score: number | null;
  level: number;
  calendar: DuolingoCalendarEntry[];
  points_ranking_data: DuolingoFriend[] | null;
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

export interface DuolingoUserData {
  username: string;
  bio: string;
  id: number;
  num_following: number;
  cohort: number;
  num_followers: number;
  learning_language_string: string;
  created: string;
  contribution_points: number;
  gplus_id: string;
  twitter_id: string;
  admin: boolean;
  invites_left: number;
  location: string;
  fullname: string;
  avatar: string;
  ui_language: string;
  daily_goal: number;
  site_streak: number;
  streak_extended_today: boolean;
  notify_comment: boolean;
  deactivated: boolean;
  is_follower_by: boolean;
  is_following: boolean;
  calendar: DuolingoCalendarEntry[];
  languages: DuolingoLanguage[];
  language_data: Record<string, DuolingoLanguageData>;
  [key: string]: unknown;
}

export interface DuolingoVocabWord {
  word_string: string;
  normalized_string: string;
  pos: string;
  strength: number;
  strength_bars: number;
  skill: string;
  last_practiced: string;
  gender: string | null;
  infinitive: string | null;
  lexeme_id: string;
  related_lexemes: string[];
  [key: string]: unknown;
}

export interface DuolingoVocabOverview {
  language_string: string;
  learning_language: string;
  from_language: string;
  vocab_overview: DuolingoVocabWord[];
}

export interface DuolingoXpGain {
  skillId: string;
  xp: number;
  time: number;
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

export interface DuolingoShopItemRequest {
  itemName: string;
  learningLanguage: string;
}

export interface DuolingoShopErrorResponse {
  error?: string;
}

export interface DuolingoSessionRequest {
  fromLanguage: string;
  learningLanguage: string;
  challengeTypes: string[];
  skillId: string;
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
}

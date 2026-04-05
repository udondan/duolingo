import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAccountTools } from '../../src/tools/account.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import type {
  DuolingoUserData,
  DuolingoFriendUser,
} from '../../src/client/types.js';
import { DuolingoAuthError } from '../../src/client/errors.js';
import { callTool } from '../helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER_DATA: DuolingoUserData = {
  username: 'testuser',
  bio: 'Test bio',
  id: 12345,
  cohort: 1,
  learning_language_string: 'French',
  creation_date: '2020-01-01T00:00:00',
  admin: false,
  location: 'Berlin',
  fullname: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  ui_language: 'en',
  daily_goal: 50,
  site_streak: 42,
  streak_extended_today: true,
  notify_comment: true,
  deactivated: false,
  tracking_properties: {
    num_followers: 10,
    num_following: 5,
  },
  calendar: [{ datetime: 1700000000, improvement: 10 }],
  languages: [
    {
      language: 'fr',
      language_string: 'French',
      learning: true,
      current_learning: true,
      level: 5,
      points: 1500,
      streak: 42,
    },
  ],
  language_data: {
    fr: {
      streak: 42,
      language_string: 'French',
      level_progress: 200,
      num_skills_learned: 15,
      level_percent: 40,
      level_points: 500,
      next_level: 6,
      level_left: 300,
      language: 'fr',
      points: 1500,
      fluency_score: 0.35,
      level: 5,
      calendar: [{ datetime: 1700000000, improvement: 10 }],
      skills: [],
    },
  },
};

const MOCK_FOLLOWING: DuolingoFriendUser[] = [
  {
    userId: 99001,
    username: 'friend1',
    displayName: 'Friend One',
    picture: '//example.com/avatar1.jpg',
    totalXp: 2000,
    isFollowing: true,
    isFollowedBy: false,
    hasSubscription: false,
    userScore: { courseId: 'DUOLINGO_FR_EN', score: 150 },
  },
  {
    userId: 12345,
    username: 'testuser',
    displayName: 'Test User',
    picture: '//example.com/avatar2.jpg',
    totalXp: 1500,
    isFollowing: true,
    isFollowedBy: true,
    hasSubscription: false,
    userScore: { courseId: 'DUOLINGO_FR_EN', score: 100 },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Account Tools', () => {
  let server: McpServer;
  let mockClient: Partial<DuolingoClient>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      getUserData: vi.fn().mockResolvedValue(MOCK_USER_DATA),
      getUserDataById: vi.fn().mockResolvedValue({
        xpGoal: 50,
        xpGains: [
          {
            skillId: 'skill-1',
            xp: 10,
            time: Math.floor(Date.now() / 1000) - 3600,
          },
        ],
        streakData: {
          updatedTimestamp: Math.floor(Date.now() / 1000) - 3600,
        },
      }),
      getFollowing: vi.fn().mockResolvedValue(MOCK_FOLLOWING),
    };

    vi.spyOn(duolingoModule, 'getClient').mockReturnValue(
      mockClient as DuolingoClient,
    );

    registerAccountTools(server);
  });

  // -------------------------------------------------------------------------
  // duolingo_get_user_info
  // -------------------------------------------------------------------------
  describe('duolingo_get_user_info', () => {
    it('returns markdown user info by default', async () => {
      const result = await callTool(server, 'duolingo_get_user_info', {});
      expect(result).toContain('# Duolingo User: testuser');
      expect(result).toContain('**Full Name**: Test User');
      expect(result).toContain('**Followers**: 10');
    });

    it('returns JSON when response_format is json', async () => {
      const result = await callTool(server, 'duolingo_get_user_info', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.username).toBe('testuser');
      expect(parsed.id).toBe(12345);
    });

    it('reads num_followers from tracking_properties', async () => {
      const result = await callTool(server, 'duolingo_get_user_info', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.num_followers).toBe(10);
      expect(parsed.num_following).toBe(5);
    });

    it('uses creation_date as the member since date', async () => {
      const result = await callTool(server, 'duolingo_get_user_info', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.created).toBe('2020-01-01T00:00:00');
    });

    it('passes username to getUserData', async () => {
      await callTool(server, 'duolingo_get_user_info', {
        username: 'otheruser',
      });
      expect(mockClient.getUserData).toHaveBeenCalledWith('otheruser');
    });

    it('returns error message on auth failure', async () => {
      vi.mocked(mockClient.getUserData!).mockRejectedValue(
        new DuolingoAuthError('Token expired'),
      );
      const result = await callTool(server, 'duolingo_get_user_info', {});
      expect(result).toContain('Error:');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_settings
  // -------------------------------------------------------------------------
  describe('duolingo_get_settings', () => {
    it('returns markdown settings by default', async () => {
      const result = await callTool(server, 'duolingo_get_settings', {});
      expect(result).toContain('# Duolingo Settings');
      expect(result).toContain('Notify Comment');
    });

    it('returns JSON when response_format is json', async () => {
      const result = await callTool(server, 'duolingo_get_settings', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.notify_comment).toBe(true);
      expect(parsed.deactivated).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_streak_info
  // -------------------------------------------------------------------------
  describe('duolingo_get_streak_info', () => {
    it('returns markdown streak info', async () => {
      const result = await callTool(server, 'duolingo_get_streak_info', {});
      expect(result).toContain('# Duolingo Streak');
      expect(result).toContain('42 days');
      expect(result).toContain('✅ Yes');
    });

    it('returns JSON streak info', async () => {
      const result = await callTool(server, 'duolingo_get_streak_info', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.site_streak).toBe(42);
      expect(parsed.streak_extended_today).toBe(true);
    });

    it('shows ❌ No when streak not extended today', async () => {
      vi.mocked(mockClient.getUserData!).mockResolvedValue({
        ...MOCK_USER_DATA,
        streak_extended_today: false,
      });
      const result = await callTool(server, 'duolingo_get_streak_info', {});
      expect(result).toContain('❌ No');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_daily_xp_progress
  // -------------------------------------------------------------------------
  describe('duolingo_get_daily_xp_progress', () => {
    it('returns markdown XP progress', async () => {
      const result = await callTool(
        server,
        'duolingo_get_daily_xp_progress',
        {},
      );
      expect(result).toContain('# Daily XP Progress');
      expect(result).toContain('XP Today');
    });

    it('returns JSON XP progress', async () => {
      const result = await callTool(server, 'duolingo_get_daily_xp_progress', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.xp_goal).toBe(50);
      expect(parsed.xp_today).toBe(10);
      expect(parsed.lessons_today).toHaveLength(1);
    });

    it('filters out old lessons from yesterday', async () => {
      vi.mocked(mockClient.getUserDataById!).mockResolvedValue({
        xpGoal: 50,
        xpGains: [
          // Today's lesson
          {
            skillId: 'skill-1',
            xp: 10,
            time: Math.floor(Date.now() / 1000) - 3600,
          },
          // Yesterday's lesson (more than 24h ago)
          {
            skillId: 'skill-2',
            xp: 20,
            time: Math.floor(Date.now() / 1000) - 90000,
          },
        ],
        streakData: {
          updatedTimestamp: Math.floor(Date.now() / 1000) - 3600,
        },
      });

      const result = await callTool(server, 'duolingo_get_daily_xp_progress', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.lessons_today).toHaveLength(1);
      expect(parsed.xp_today).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_languages
  // -------------------------------------------------------------------------
  describe('duolingo_get_languages', () => {
    it('returns full language names by default', async () => {
      const result = await callTool(server, 'duolingo_get_languages', {});
      expect(result).toContain('French');
      expect(result).not.toContain('- fr');
    });

    it('returns abbreviations when requested', async () => {
      const result = await callTool(server, 'duolingo_get_languages', {
        abbreviations: true,
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed).toContain('fr');
    });

    it('returns message when no languages found', async () => {
      vi.mocked(mockClient.getUserData!).mockResolvedValue({
        ...MOCK_USER_DATA,
        languages: [],
      });
      const result = await callTool(server, 'duolingo_get_languages', {});
      expect(result).toContain('No languages found');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_friends
  // -------------------------------------------------------------------------
  describe('duolingo_get_friends', () => {
    it('returns markdown friends list', async () => {
      const result = await callTool(server, 'duolingo_get_friends', {});
      expect(result).toContain('# Duolingo Friends');
      expect(result).toContain('friend1');
    });

    it('returns JSON friends list', async () => {
      const result = await callTool(server, 'duolingo_get_friends', {
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].username).toBe('friend1');
      expect(parsed[0].points).toBe(2000);
    });

    it('returns "No friends found" when following list is empty', async () => {
      vi.mocked(mockClient.getFollowing!).mockResolvedValue([]);
      const result = await callTool(server, 'duolingo_get_friends', {});
      expect(result).toBe('No friends found.');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_calendar
  // -------------------------------------------------------------------------
  describe('duolingo_get_calendar', () => {
    it('returns overall calendar', async () => {
      const result = await callTool(server, 'duolingo_get_calendar', {});
      expect(result).toContain('# Activity Calendar');
    });

    it('returns language-specific calendar', async () => {
      const result = await callTool(server, 'duolingo_get_calendar', {
        language_abbr: 'fr',
      });
      expect(result).toContain('# Activity Calendar');
    });

    it('returns error for unknown language', async () => {
      const result = await callTool(server, 'duolingo_get_calendar', {
        language_abbr: 'xx',
      });
      expect(result).toContain("No calendar found for language 'xx'");
    });

    it('returns message when calendar is empty', async () => {
      vi.mocked(mockClient.getUserData!).mockResolvedValue({
        ...MOCK_USER_DATA,
        calendar: [],
      });
      const result = await callTool(server, 'duolingo_get_calendar', {});
      expect(result).toBe('No calendar entries found.');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_leaderboard
  // -------------------------------------------------------------------------
  describe('duolingo_get_leaderboard', () => {
    it('returns markdown leaderboard sorted by weekly score', async () => {
      const result = await callTool(server, 'duolingo_get_leaderboard', {
        unit: 'week',
      });
      expect(result).toContain('# Leaderboard (Week)');
      expect(result).toContain('friend1');
    });

    it('returns JSON leaderboard with weekly scores', async () => {
      const result = await callTool(server, 'duolingo_get_leaderboard', {
        unit: 'week',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed[0].username).toBe('friend1');
      expect(parsed[0].points).toBe(150); // userScore.score for week
    });

    it('returns JSON leaderboard with totalXp for month', async () => {
      const result = await callTool(server, 'duolingo_get_leaderboard', {
        unit: 'month',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed[0].username).toBe('friend1');
      expect(parsed[0].points).toBe(2000); // totalXp for month
    });

    it('returns message when following list is empty', async () => {
      vi.mocked(mockClient.getFollowing!).mockResolvedValue([]);
      const result = await callTool(server, 'duolingo_get_leaderboard', {
        unit: 'week',
      });
      expect(result).toContain("No leaderboard data found for unit 'week'");
    });
  });
});

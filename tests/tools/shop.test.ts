import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerShopTools } from '../../src/tools/shop.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import type {
  DuolingoUserData,
  DuolingoUserDataV2,
} from '../../src/client/types.js';
import { callTool } from '../helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER_DATA: DuolingoUserData = {
  username: 'testuser',
  bio: '',
  id: 12345,
  cohort: 1,
  learning_language_string: 'French',
  creation_date: '2020-01-01T00:00:00',
  admin: false,
  location: null,
  fullname: '',
  avatar: '',
  ui_language: 'en',
  daily_goal: 50,
  site_streak: 10,
  streak_extended_today: false,
  notify_comment: false,
  deactivated: false,
  calendar: [],
  languages: [
    {
      language: 'fr',
      language_string: 'French',
      learning: true,
      current_learning: true,
      level: 5,
      points: 1500,
      streak: 10,
    },
    {
      language: 'de',
      language_string: 'German',
      learning: true,
      current_learning: false,
      level: 2,
      points: 300,
      streak: 0,
    },
  ],
  language_data: {
    fr: {
      streak: 10,
      language_string: 'French',
      level_progress: 0,
      num_skills_learned: 0,
      level_percent: 0,
      level_points: 0,
      next_level: 0,
      level_left: 0,
      language: 'fr',
      points: 0,
      fluency_score: null,
      level: 0,
      calendar: [],
      skills: [],
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Shop Tools', () => {
  let server: McpServer;
  let mockClient: Partial<DuolingoClient>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    const mockV2: DuolingoUserDataV2 = {
      id: 12345,
      username: 'testuser',
      name: 'Test User',
      picture: '',
      totalXp: 1000,
      streak: 10,
      streakData: { currentStreak: null, previousStreak: null },
      hasPlus: false,
      subscriberLevel: 'FREE',
      fromLanguage: 'en',
      learningLanguage: 'fr',
      courses: [
        {
          id: 'DUOLINGO_FR_EN',
          subject: 'language',
          topic: 'fr',
          xp: 1500,
          fromLanguage: 'en',
          learningLanguage: 'fr',
          title: 'French',
        },
        {
          id: 'DUOLINGO_DE_EN',
          subject: 'language',
          topic: 'de',
          xp: 300,
          fromLanguage: 'en',
          learningLanguage: 'de',
          title: 'German',
        },
      ],
    };

    mockClient = {
      getUserData: vi.fn().mockResolvedValue(MOCK_USER_DATA),
      getUserIdByUsername: vi.fn().mockResolvedValue(12345),
      getUserDataV2: vi.fn().mockResolvedValue(mockV2),
    };

    vi.spyOn(duolingoModule, 'getClient').mockReturnValue(
      mockClient as DuolingoClient,
    );

    registerShopTools(server);
  });

  // -------------------------------------------------------------------------
  // duolingo_get_language_from_abbr
  // -------------------------------------------------------------------------
  describe('duolingo_get_language_from_abbr', () => {
    it('returns full language name for known abbreviation', async () => {
      const result = await callTool(server, 'duolingo_get_language_from_abbr', {
        language_abbr: 'fr',
      });
      expect(result).toBe('French');
    });

    it('returns full language name for German', async () => {
      const result = await callTool(server, 'duolingo_get_language_from_abbr', {
        language_abbr: 'de',
      });
      expect(result).toBe('German');
    });

    it('returns not found message for unknown abbreviation', async () => {
      const result = await callTool(server, 'duolingo_get_language_from_abbr', {
        language_abbr: 'xx',
      });
      expect(result).toContain("No language found for abbreviation 'xx'");
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_abbreviation_of
  // -------------------------------------------------------------------------
  describe('duolingo_get_abbreviation_of', () => {
    it('returns abbreviation for known language name', async () => {
      const result = await callTool(server, 'duolingo_get_abbreviation_of', {
        language_name: 'French',
      });
      expect(result).toBe('fr');
    });

    it('is case-insensitive', async () => {
      const result = await callTool(server, 'duolingo_get_abbreviation_of', {
        language_name: 'french',
      });
      expect(result).toBe('fr');
    });

    it('returns not found message for unknown language', async () => {
      const result = await callTool(server, 'duolingo_get_abbreviation_of', {
        language_name: 'Klingon',
      });
      expect(result).toContain("No abbreviation found for language 'Klingon'");
    });
  });
});

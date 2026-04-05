import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerShopTools } from '../../src/tools/shop.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import type { DuolingoUserData } from '../../src/client/types.js';
import {
  DuolingoAlreadyHaveItemError,
  DuolingoInsufficientFundsError,
} from '../../src/client/errors.js';
import { callTool } from '../helpers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER_DATA: DuolingoUserData = {
  username: 'testuser',
  bio: '',
  id: 12345,
  num_following: 0,
  cohort: 1,
  num_followers: 0,
  learning_language_string: 'French',
  created: '2020-01-01',
  contribution_points: 0,
  gplus_id: '',
  twitter_id: '',
  admin: false,
  invites_left: 0,
  location: '',
  fullname: '',
  avatar: '',
  ui_language: 'en',
  daily_goal: 50,
  site_streak: 10,
  streak_extended_today: false,
  notify_comment: false,
  deactivated: false,
  is_follower_by: false,
  is_following: false,
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
      points_rank: 0,
      next_level: 0,
      level_left: 0,
      language: 'fr',
      points: 0,
      fluency_score: null,
      level: 0,
      calendar: [],
      points_ranking_data: null,
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
    mockClient = {
      getUserData: vi.fn().mockResolvedValue(MOCK_USER_DATA),
      buyItem: vi.fn().mockResolvedValue(undefined),
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

  // -------------------------------------------------------------------------
  // duolingo_set_username
  // -------------------------------------------------------------------------
  describe('duolingo_set_username', () => {
    it('validates username exists and returns confirmation', async () => {
      const result = await callTool(server, 'duolingo_set_username', {
        username: 'testuser',
      });
      expect(result).toContain("Switched to user 'testuser'");
      expect(mockClient.getUserData).toHaveBeenCalledWith('testuser');
    });

    it('returns error when user not found', async () => {
      vi.mocked(mockClient.getUserData!).mockRejectedValue(
        new Error('User not found'),
      );
      const result = await callTool(server, 'duolingo_set_username', {
        username: 'nobody',
      });
      expect(result).toContain('Error:');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_buy_item
  // -------------------------------------------------------------------------
  describe('duolingo_buy_item', () => {
    it('successfully purchases an item', async () => {
      const result = await callTool(server, 'duolingo_buy_item', {
        item_name: 'streak_freeze',
        language_abbr: 'fr',
      });
      expect(result).toBe("Successfully purchased 'streak_freeze'.");
      expect(mockClient.buyItem).toHaveBeenCalledWith(
        12345,
        'streak_freeze',
        'fr',
      );
    });

    it('returns error when already have item', async () => {
      vi.mocked(mockClient.buyItem!).mockRejectedValue(
        new DuolingoAlreadyHaveItemError('streak_freeze'),
      );
      const result = await callTool(server, 'duolingo_buy_item', {
        item_name: 'streak_freeze',
        language_abbr: 'fr',
      });
      expect(result).toContain('Error:');
      expect(result).toContain('Already equipped');
    });

    it('returns error when insufficient funds', async () => {
      vi.mocked(mockClient.buyItem!).mockRejectedValue(
        new DuolingoInsufficientFundsError('streak_freeze'),
      );
      const result = await callTool(server, 'duolingo_buy_item', {
        item_name: 'streak_freeze',
        language_abbr: 'fr',
      });
      expect(result).toContain('Error:');
      expect(result).toContain('Insufficient funds');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_buy_streak_freeze
  // -------------------------------------------------------------------------
  describe('duolingo_buy_streak_freeze', () => {
    it('purchases streak freeze for current learning language', async () => {
      const result = await callTool(server, 'duolingo_buy_streak_freeze', {});
      expect(result).toBe('Streak freeze purchased successfully.');
      expect(mockClient.buyItem).toHaveBeenCalledWith(
        12345,
        'streak_freeze',
        'fr',
      );
    });

    it('returns already equipped message when already owned', async () => {
      vi.mocked(mockClient.buyItem!).mockRejectedValue(
        new DuolingoAlreadyHaveItemError('streak_freeze'),
      );
      const result = await callTool(server, 'duolingo_buy_streak_freeze', {});
      expect(result).toBe(
        'Streak freeze already equipped — no purchase needed.',
      );
    });

    it('returns error when no learning language found', async () => {
      vi.mocked(mockClient.getUserData!).mockResolvedValue({
        ...MOCK_USER_DATA,
        learning_language_string: 'Klingon',
        languages: [],
      });
      const result = await callTool(server, 'duolingo_buy_streak_freeze', {});
      expect(result).toContain('No learning language found');
    });
  });
});

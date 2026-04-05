import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerLanguageTools } from '../../src/tools/language.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import type { DuolingoUserData } from '../../src/client/types.js';
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
  ],
  language_data: {
    fr: {
      streak: 10,
      language_string: 'French',
      level_progress: 200,
      num_skills_learned: 2,
      level_percent: 40,
      level_points: 500,
      next_level: 6,
      level_left: 300,
      language: 'fr',
      points: 1500,
      fluency_score: 0.35,
      level: 5,
      calendar: [],
      skills: [
        {
          id: 'skill-1',
          name: 'Basics 1',
          title: 'Basics 1',
          learned: true,
          strength: 1.0,
          progress_percent: 100,
          words: ['bonjour', 'merci'],
          dependencies_name: [],
        },
        {
          id: 'skill-2',
          name: 'Basics 2',
          title: 'Basics 2',
          learned: true,
          strength: 0.7,
          progress_percent: 70,
          words: ['oui', 'non'],
          dependencies_name: ['Basics 1'],
        },
        {
          id: 'skill-3',
          name: 'Colors',
          title: 'Colors',
          learned: false,
          strength: 0,
          progress_percent: 0,
          words: ['rouge', 'bleu'],
          dependencies_name: ['Basics 2'],
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Helper to call a registered tool by name
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Language Tools', () => {
  let server: McpServer;
  let mockClient: Partial<DuolingoClient>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      getUserData: vi.fn().mockResolvedValue(MOCK_USER_DATA),
      getLanguageVoices: vi.fn().mockResolvedValue(['default', 'mathieu']),
      buildAudioUrl: vi
        .fn()
        .mockImplementation(
          async (word: string, lang: string, voice?: string) => {
            const base = 'https://d7mj4aqfscim2.cloudfront.net/';
            if (voice) {
              return `${base}tts/${lang}/${voice}/token/${word}`;
            }
            return `${base}tts/${lang}/token/${word}`;
          },
        ),
      invalidateCache: vi.fn(),
    };

    vi.spyOn(duolingoModule, 'getClient').mockReturnValue(
      mockClient as DuolingoClient,
    );

    registerLanguageTools(server);
  });

  // -------------------------------------------------------------------------
  // duolingo_get_language_details
  // -------------------------------------------------------------------------
  describe('duolingo_get_language_details', () => {
    it('returns markdown language details', async () => {
      const result = await callTool(server, 'duolingo_get_language_details', {
        language_name: 'French',
      });
      expect(result).toContain('# French Details');
      expect(result).toContain('**Level**: 5');
      expect(result).toContain('**Points**: 1500');
    });

    it('returns JSON language details', async () => {
      const result = await callTool(server, 'duolingo_get_language_details', {
        language_name: 'French',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.language).toBe('fr');
      expect(parsed.level).toBe(5);
    });

    it('returns error for unknown language', async () => {
      const result = await callTool(server, 'duolingo_get_language_details', {
        language_name: 'Klingon',
      });
      expect(result).toContain("No details found for language 'Klingon'");
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_language_progress
  // -------------------------------------------------------------------------
  describe('duolingo_get_language_progress', () => {
    it('returns markdown language progress', async () => {
      const result = await callTool(server, 'duolingo_get_language_progress', {
        language_abbr: 'fr',
      });
      expect(result).toContain('# French Progress');
      expect(result).toContain('**Level**: 5');
      expect(result).toContain('**Fluency Score**: 0.35');
    });

    it('returns JSON language progress', async () => {
      const result = await callTool(server, 'duolingo_get_language_progress', {
        language_abbr: 'fr',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed.level).toBe(5);
      expect(parsed.fluency_score).toBe(0.35);
    });

    it('returns error for unknown language abbreviation', async () => {
      const result = await callTool(server, 'duolingo_get_language_progress', {
        language_abbr: 'xx',
      });
      expect(result).toContain("Language 'xx' not found");
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_known_topics
  // -------------------------------------------------------------------------
  describe('duolingo_get_known_topics', () => {
    it('returns learned topics', async () => {
      const result = await callTool(server, 'duolingo_get_known_topics', {
        language_abbr: 'fr',
      });
      expect(result).toContain('Basics 1');
      expect(result).toContain('Basics 2');
      expect(result).not.toContain('Colors');
    });

    it('returns JSON list', async () => {
      const result = await callTool(server, 'duolingo_get_known_topics', {
        language_abbr: 'fr',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed).toContain('Basics 1');
      expect(parsed).not.toContain('Colors');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_unknown_topics
  // -------------------------------------------------------------------------
  describe('duolingo_get_unknown_topics', () => {
    it('returns unlearned topics', async () => {
      const result = await callTool(server, 'duolingo_get_unknown_topics', {
        language_abbr: 'fr',
      });
      expect(result).toContain('Colors');
      expect(result).not.toContain('Basics 1');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_golden_topics
  // -------------------------------------------------------------------------
  describe('duolingo_get_golden_topics', () => {
    it('returns only strength=1.0 topics', async () => {
      const result = await callTool(server, 'duolingo_get_golden_topics', {
        language_abbr: 'fr',
      });
      expect(result).toContain('Basics 1');
      expect(result).not.toContain('Basics 2'); // strength 0.7
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_reviewable_topics
  // -------------------------------------------------------------------------
  describe('duolingo_get_reviewable_topics', () => {
    it('returns learned topics with strength < 1.0', async () => {
      const result = await callTool(server, 'duolingo_get_reviewable_topics', {
        language_abbr: 'fr',
      });
      expect(result).toContain('Basics 2');
      expect(result).not.toContain('Basics 1'); // strength 1.0
      expect(result).not.toContain('Colors'); // not learned
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_known_words
  // -------------------------------------------------------------------------
  describe('duolingo_get_known_words', () => {
    it('returns deduplicated sorted word list', async () => {
      const result = await callTool(server, 'duolingo_get_known_words', {
        language_abbr: 'fr',
      });
      expect(result).toContain('bonjour');
      expect(result).toContain('merci');
      expect(result).toContain('oui');
      expect(result).toContain('non');
      expect(result).not.toContain('rouge'); // from unlearned skill
    });

    it('returns JSON word list', async () => {
      const result = await callTool(server, 'duolingo_get_known_words', {
        language_abbr: 'fr',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed).toContain('bonjour');
      expect(parsed).not.toContain('rouge');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_learned_skills
  // -------------------------------------------------------------------------
  describe('duolingo_get_learned_skills', () => {
    it('returns learned skills sorted by dependency order', async () => {
      const result = await callTool(server, 'duolingo_get_learned_skills', {
        language_abbr: 'fr',
      });
      expect(result).toContain('Basics 1');
      expect(result).toContain('Basics 2');
      expect(result).not.toContain('Colors');
      // Basics 1 should appear before Basics 2
      expect(result.indexOf('Basics 1')).toBeLessThan(
        result.indexOf('Basics 2'),
      );
    });

    it('returns JSON skills', async () => {
      const result = await callTool(server, 'duolingo_get_learned_skills', {
        language_abbr: 'fr',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Basics 1');
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_language_voices
  // -------------------------------------------------------------------------
  describe('duolingo_get_language_voices', () => {
    it('returns voice list', async () => {
      const result = await callTool(server, 'duolingo_get_language_voices', {
        language_abbr: 'fr',
      });
      expect(result).toContain('default');
      expect(result).toContain('mathieu');
    });

    it('returns JSON voice list', async () => {
      const result = await callTool(server, 'duolingo_get_language_voices', {
        language_abbr: 'fr',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);
      expect(parsed).toContain('default');
      expect(parsed).toContain('mathieu');
    });

    it('returns message when no voices found', async () => {
      vi.mocked(mockClient.getLanguageVoices!).mockResolvedValue([]);
      const result = await callTool(server, 'duolingo_get_language_voices', {
        language_abbr: 'fr',
      });
      expect(result).toContain("No voices found for language 'fr'");
    });
  });

  // -------------------------------------------------------------------------
  // duolingo_get_audio_url
  // -------------------------------------------------------------------------
  describe('duolingo_get_audio_url', () => {
    it('returns audio URL for a word with specific voice', async () => {
      const result = await callTool(server, 'duolingo_get_audio_url', {
        word: 'bonjour',
        language_abbr: 'fr',
        voice: 'mathieu',
        random: false,
      });
      expect(result).toContain('d7mj4aqfscim2.cloudfront.net');
      expect(result).toContain('mathieu');
      expect(result).toContain('bonjour');
    });

    it('returns audio URL with random voice when voices are available', async () => {
      const result = await callTool(server, 'duolingo_get_audio_url', {
        word: 'bonjour',
        language_abbr: 'fr',
        random: true,
      });
      expect(result).toContain('d7mj4aqfscim2.cloudfront.net');
      expect(result).toContain('bonjour');
    });

    it('returns default audio URL when no voices found and random=false', async () => {
      vi.mocked(mockClient.getLanguageVoices!).mockResolvedValue([]);
      const result = await callTool(server, 'duolingo_get_audio_url', {
        word: 'bonjour',
        language_abbr: 'fr',
        random: false,
      });
      expect(result).toContain('d7mj4aqfscim2.cloudfront.net');
      expect(result).toContain('bonjour');
    });
  });
});

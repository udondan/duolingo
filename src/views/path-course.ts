/**
 * Support for courses on the learning path. Their legacy skill tree in
 * `language_data` is empty, so the authenticated user's current course is
 * read from the current API instead.
 */

import type { DuolingoClient } from '../client/duolingo.js';
import type {
  DuolingoCurrentCourseSkill,
  DuolingoLanguageData,
  DuolingoSkill,
  DuolingoUserData,
} from '../client/types.js';
import { notFound, type View } from './view.js';

/** Language codes that the legacy API uses in place of the current ones. */
const LEGACY_LANGUAGE_CODES: Record<string, string> = { zh: 'zs', zs: 'zh' };

/**
 * The reply for a course of the authenticated user that is not the active
 * one: Duolingo only returns the data of the active course.
 */
export function inactiveCourse(abbr: string): View {
  return notFound(
    `'${abbr}' is not your active course, and Duolingo only returns the ` +
      'topics, skills and words of the active course. Switch to it first ' +
      '(MCP tool duolingo_switch_course, CLI command switch-course); this ' +
      'also changes the active course in the Duolingo apps.',
  );
}

/**
 * The reply for a language without language data: for the authenticated
 * user's other courses, that they are not active, otherwise `message`.
 */
export async function missingLanguage(
  client: DuolingoClient,
  abbr: string,
  username: string | undefined,
  message: string,
): Promise<View> {
  if (client.isAuthenticatedUser(username)) {
    const { id } = await client.getUserData();
    const wanted = abbr === 'zs' ? 'zh' : abbr;
    const { courses } = await client.getUserDataV2(id);
    if (courses.some((c) => c.learningLanguage === wanted)) {
      return inactiveCourse(abbr);
    }
  }
  return notFound(message);
}

/**
 * The legacy language data of a language, by its current or legacy code
 * (Chinese is 'zh' in the current API but 'zs' in `language_data`).
 */
export function languageData(
  userData: DuolingoUserData,
  abbr: string,
): DuolingoLanguageData | undefined {
  const data = userData.language_data ?? {};
  const legacy = LEGACY_LANGUAGE_CODES[abbr];
  return data[abbr] ?? (legacy === undefined ? undefined : data[legacy]);
}

/**
 * A skill of the current course in the shape of a legacy skill. Path courses
 * have no skill strength, so `strength` is the share of the skill's levels
 * (crowns) the user has finished, and `progress_percent` the same share in
 * percent. Words are not available per skill.
 */
function pathSkill(skill: DuolingoCurrentCourseSkill): DuolingoSkill {
  const finishedLevels = skill.finishedLevels ?? 0;
  const levels = skill.levels ?? 0;
  const name = skill.name ?? skill.id;
  const strength = levels > 0 ? Math.min(finishedLevels / levels, 1) : 0;
  return {
    id: skill.id,
    name,
    title: name,
    learned: finishedLevels > 0,
    strength,
    progress_percent: strength * 100,
    words: [],
    dependencies_name: [],
    finished_levels: finishedLevels,
    levels,
  };
}

/**
 * The language data with the skills of the current course when its legacy
 * skill tree is empty. Unchanged for other users; for a language that is not
 * the active course, the reply that says so.
 */
export async function withPathSkills(
  client: DuolingoClient,
  langData: DuolingoLanguageData,
  opts: { language_abbr: string; username?: string },
): Promise<DuolingoLanguageData | View> {
  if (langData.skills.length > 0) return langData;
  if (!client.isAuthenticatedUser(opts.username)) return langData;
  const course = await client.getCurrentCourse(opts.language_abbr);
  if (!course) return inactiveCourse(opts.language_abbr);
  return { ...langData, skills: course.skills.map(pathSkill) };
}

/** The number of skills learned in the current course (0 for other courses). */
export async function pathSkillsLearned(
  client: DuolingoClient,
  abbr: string,
): Promise<number> {
  const course = await client.getCurrentCourse(abbr);
  return course?.skills.filter((s) => (s.finishedLevels ?? 0) > 0).length ?? 0;
}

/**
 * The words the authenticated user learned in the current course, or
 * `undefined` for other users and other courses.
 */
export async function pathCourseWords(
  client: DuolingoClient,
  abbr: string,
  username: string | undefined,
): Promise<string[] | undefined> {
  if (!client.isAuthenticatedUser(username)) return undefined;
  const lexemes = await client.getLearnedLexemes(abbr);
  return lexemes?.map((lexeme) => lexeme.text);
}

/** The level of a path skill, as "x/y", or `undefined` for legacy skills. */
export function pathSkillLevel(skill: DuolingoSkill): string | undefined {
  const { finished_levels, levels } = skill;
  if (typeof finished_levels !== 'number' || typeof levels !== 'number') {
    return undefined;
  }
  return `${finished_levels}/${levels}`;
}

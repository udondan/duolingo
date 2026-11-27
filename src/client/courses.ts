/**
 * Picking and confirming the course to switch to.
 */

import { DuolingoClientError, DuolingoNotFoundError } from './errors.js';
import type { DuolingoCourse } from './types.js';

/** Whether a reply names the language and source language of a course. */
export function isSameCourse(
  resp: Partial<DuolingoCourse>,
  course: DuolingoCourse,
): boolean {
  return (
    resp.learningLanguage === course.learningLanguage &&
    resp.fromLanguage === course.fromLanguage
  );
}

/**
 * The language course of the user to switch to: the one for `langAbbr`
 * ('zs' is Chinese too), from `fromLanguage` when the user learns the
 * language from several languages.
 */
export function findCourse(
  courses: DuolingoCourse[],
  langAbbr: string,
  fromLanguage?: string,
): DuolingoCourse {
  const wanted = langAbbr === 'zs' ? 'zh' : langAbbr;
  const matches = courses.filter(
    (c) =>
      c.subject === 'language' &&
      c.learningLanguage === wanted &&
      (fromLanguage === undefined || c.fromLanguage === fromLanguage),
  );
  const course = matches[0];
  if (course === undefined) {
    const from = fromLanguage === undefined ? '' : ` from '${fromLanguage}'`;
    throw new DuolingoNotFoundError(
      `No course for '${langAbbr}'${from} found. ` +
        'Only courses you are enrolled in can be switched to.',
    );
  }
  if (matches.length > 1) {
    const from = matches.map((c) => `'${c.fromLanguage}'`).join(', ');
    throw new DuolingoClientError(
      `You learn '${langAbbr}' from ${from}. Say which one to switch to.`,
    );
  }
  return course;
}

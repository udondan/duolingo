/**
 * Shared utilities for MCP tool handlers.
 */

import { z } from 'zod';
import {
  DuolingoClientError,
  DuolingoAuthError,
  DuolingoNotFoundError,
  DuolingoCaptchaError,
} from '../client/errors.js';
import type { DuolingoSkill } from '../client/types.js';

// ---------------------------------------------------------------------------
// Response format
// ---------------------------------------------------------------------------

export const ResponseFormatSchema = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe("Output format: 'markdown' or 'json'.");

export type ResponseFormat = z.infer<typeof ResponseFormatSchema>;

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

export const UsernameFieldSchema = z
  .string()
  .optional()
  .describe(
    'Duolingo username to query. Defaults to the authenticated user. ' +
      "Use this to look up another user's public data.",
  );

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * Convert any error into a user-friendly string for MCP tool responses.
 */
export function handleError(err: unknown): string {
  if (err instanceof DuolingoAuthError) {
    return `Error: ${err.message}`;
  }
  if (err instanceof DuolingoCaptchaError) {
    return `Error: ${err.message}`;
  }
  if (err instanceof DuolingoNotFoundError) {
    return `Error: ${err.message}`;
  }
  if (err instanceof DuolingoClientError) {
    return `Error: ${err.message}`;
  }
  if (err instanceof Error) {
    return `Error: Unexpected error — ${err.name}: ${err.message}`;
  }
  return `Error: Unknown error — ${String(err)}`;
}

// ---------------------------------------------------------------------------
// Dependency order computation (topological sort for learned skills)
// ---------------------------------------------------------------------------

/**
 * Compute dependency order for all skills using topological sort.
 * Mutates the `dependency_order` field on each skill object.
 */
export function computeDependencyOrder(skills: DuolingoSkill[]): void {
  const skillsDict = new Map<string, DuolingoSkill>();
  for (const skill of skills) {
    skillsDict.set(skill.name, skill);
  }
  for (const skill of skills) {
    getSkillOrdinal(skillsDict, skill, []);
  }
}

function getSkillOrdinal(
  skillsDict: Map<string, DuolingoSkill>,
  skill: DuolingoSkill,
  breadcrumbs: string[],
): number {
  if (breadcrumbs.includes(skill.name)) {
    // Loop detected — assign order 1 to break the cycle
    skill.dependency_order = 1;
    return 1;
  }
  if (skill.dependency_order !== undefined) {
    return skill.dependency_order;
  }
  if (skill.dependencies_name.length === 0) {
    skill.dependency_order = 1;
    return 1;
  }

  const newBreadcrumbs = [...breadcrumbs, skill.name];
  const depOrders = skill.dependencies_name
    .map((name) => skillsDict.get(name))
    .filter((dep): dep is DuolingoSkill => dep !== undefined)
    .map((dep) => getSkillOrdinal(skillsDict, dep, newBreadcrumbs));

  const order = 1 + (depOrders.length > 0 ? Math.max(...depOrders) : 0);
  skill.dependency_order = order;
  return order;
}

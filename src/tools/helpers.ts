/**
 * Shared utilities for MCP tool handlers.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DuolingoClientError } from '../client/errors.js';
import { renderView, type ResponseFormat, type View } from '../views/view.js';

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

export const ResponseFormatSchema = z
  .enum(['markdown', 'json'])
  .default('markdown')
  .describe("Output format: 'markdown' or 'json'.");

export const UsernameFieldSchema = z
  .string()
  .optional()
  .describe(
    'Duolingo username to query. Defaults to the authenticated user. ' +
      "Use this to look up another user's public data.",
  );

/** Annotations shared by all tools: they only read from Duolingo. */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

/**
 * Convert any error into a user-friendly string for MCP tool responses.
 */
export function handleError(err: unknown): string {
  if (err instanceof DuolingoClientError) {
    return `Error: ${err.message}`;
  }
  if (err instanceof Error) {
    return `Error: Unexpected error — ${err.name}: ${err.message}`;
  }
  return `Error: Unknown error — ${String(err)}`;
}

/** Build the view and render it as the text reply of a tool. */
export async function reply(
  load: () => Promise<View>,
  format: ResponseFormat = 'markdown',
): Promise<CallToolResult> {
  let text: string;
  try {
    text = renderView(await load(), format);
  } catch (err) {
    text = handleError(err);
  }
  return { content: [{ type: 'text', text }] };
}

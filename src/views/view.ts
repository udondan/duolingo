/**
 * The result of a query, ready to be rendered as JSON or markdown.
 *
 * The MCP tools and the CLI share these views, so both show the same data.
 */

import type { DuolingoClient } from '../client/duolingo.js';

export type ResponseFormat = 'markdown' | 'json';

export interface View {
  /**
   * The JSON payload. `undefined` when the query found nothing to show,
   * `message` then says why.
   */
  data: unknown;
  /** Render the data as markdown. */
  markdown: () => string;
  /**
   * Replaces the JSON and the markdown in MCP replies, e.g. when a list is
   * empty or a language was not found.
   */
  message?: string;
}

/** A view that only carries a message, e.g. for an unknown language. */
export function notFound(message: string): View {
  return { data: undefined, markdown: () => message, message };
}

/** A view whose data is a single line of text, such as a URL. */
export function textView(text: string): View {
  return { data: text, markdown: () => text };
}

export function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/** Render a view the way the MCP tools reply. */
export function renderView(view: View, format: ResponseFormat): string {
  if (view.message !== undefined) return view.message;
  return format === 'json' ? toJson(view.data) : view.markdown();
}

/**
 * Resolve the numeric user ID: the authenticated user when no username is
 * given, otherwise the given user.
 */
export async function resolveUserId(
  client: DuolingoClient,
  username?: string,
): Promise<number> {
  if (!username) {
    const userData = await client.getUserData();
    return userData.id;
  }
  return client.getUserIdByUsername(username);
}

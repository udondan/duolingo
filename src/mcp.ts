/**
 * Duolingo MCP server.
 *
 * Exposes Duolingo learning data to LLM agents over stdio.
 * Start via: duolingo mcp
 *
 * Authentication: DUOLINGO_USERNAME and DUOLINGO_JWT environment variables.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAccountTools } from './tools/account.js';
import { registerLanguageTools } from './tools/language.js';
import { registerShopTools } from './tools/shop.js';
import { version } from './version.js';

/** Create the MCP server with all Duolingo tools registered. */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'duolingo_mcp',
      version,
    },
    {
      instructions:
        'This server provides access to Duolingo learning data via the unofficial ' +
        'Duolingo API. You can query user profiles, streak information, language ' +
        'progress, topics, words, TTS audio, and more. ' +
        'Authentication requires DUOLINGO_USERNAME and DUOLINGO_JWT environment variables. ' +
        'To get your JWT token: log in to Duolingo in a browser, open the developer ' +
        'console, and run: ' +
        "document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)",
    },
  );

  registerAccountTools(server);
  registerLanguageTools(server);
  registerShopTools(server);
  return server;
}

/** Start the MCP server on stdin/stdout. */
export async function startMcpServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

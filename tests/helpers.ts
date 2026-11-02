/**
 * Shared test utilities.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

/**
 * Call a registered MCP tool by name via the public MCP wire protocol.
 * Uses InMemoryTransport to avoid any stdio or network I/O.
 * Both the client and server transports are closed after each call.
 */
export async function callTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return content.map((c) => c.text).join('');
  } finally {
    await client.close();
    await serverTransport.close();
  }
}

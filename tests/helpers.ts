/**
 * Shared test utilities.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ToolRegistry = Record<
  string,
  {
    handler: (args: unknown) => Promise<{
      content: { type: string; text: string }[];
    }>;
  }
>;

/**
 * Call a registered MCP tool by name and return the first text content.
 */
export async function callTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const registry = (server as unknown as { _registeredTools: ToolRegistry })
    ._registeredTools;

  const tool = registry[toolName];
  if (!tool) throw new Error(`Tool '${toolName}' not found`);

  const result = await tool.handler(args);
  return result.content[0]?.text ?? '';
}

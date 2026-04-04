"""
Duolingo MCP Server

An MCP server that exposes Duolingo learning data and actions to LLM agents
via the unofficial Duolingo API (iSteve-O/Duolingo).

Authentication:
    Set the following environment variables before starting the server:
    - DUOLINGO_USERNAME: Your Duolingo username
    - DUOLINGO_JWT: Your Duolingo JWT token (extracted from browser)

Usage:
    uv run python server.py
    # or
    uv run mcp dev server.py
"""

from mcp.server.fastmcp import FastMCP

from tools import account, language, shop

mcp = FastMCP(
    "duolingo_mcp",
    instructions=(
        "This server provides access to Duolingo learning data via the unofficial "
        "Duolingo API. You can query user profiles, streak information, language "
        "progress, vocabulary, topics, translations, and more. "
        "Authentication requires DUOLINGO_USERNAME and DUOLINGO_JWT environment variables. "
        "To get your JWT token: log in to Duolingo in a browser, open the developer "
        "console, and run: "
        "document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)"
    ),
)

# Register all tool groups
account.register(mcp)
language.register(mcp)
shop.register(mcp)


def main() -> None:
    """Entry point for the Duolingo MCP server."""
    mcp.run()


if __name__ == "__main__":
    main()

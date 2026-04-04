"""Account-level Duolingo MCP tools."""

import json
import time
from enum import Enum
from typing import Optional

import duolingo
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field

from duolingo_client import (
    DuolingoClientError,
    call,
    call_as,
    get_friends as _get_friends,
    get_leaderboard as _get_leaderboard,
)

_USERNAME_FIELD = Field(
    default=None,
    description=(
        "Duolingo username to query. Defaults to the authenticated user. "
        "Use this to look up another user's public data."
    ),
)


class ResponseFormat(str, Enum):
    """Output format for tool responses."""

    MARKDOWN = "markdown"
    JSON = "json"


def _handle_error(exc: Exception) -> str:
    """Return a human-readable error string for any exception."""
    if isinstance(exc, DuolingoClientError):
        return f"Error: {exc}"
    if isinstance(exc, duolingo.DuolingoException):
        return f"Error: Duolingo API error — {exc}"
    if isinstance(exc, KeyError):
        return (
            f"Error: Unexpected field missing in Duolingo API response ({exc}). "
            "The Duolingo API may have changed. "
            "See https://github.com/iSteve-O/Duolingo for updates."
        )
    return f"Error: Unexpected error — {type(exc).__name__}: {exc}"


def register(mcp: FastMCP) -> None:
    """Register all account tools on the given FastMCP instance."""

    # -------------------------------------------------------------------------
    # Get User Info
    # -------------------------------------------------------------------------
    class GetUserInfoInput(BaseModel):
        """Input for getting user profile information."""

        model_config = ConfigDict(str_strip_whitespace=True)

        username: Optional[str] = _USERNAME_FIELD
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_user_info",
        annotations={
            "title": "Get Duolingo User Info",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_user_info(params: GetUserInfoInput) -> str:
        """
        Get a Duolingo user's profile information.

        Returns username, full name, bio, location, avatar URL, follower/following
        counts, learning language, UI language, cohort, admin status, and more.

        Args:
            params (GetUserInfoInput): Input parameters:
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: User profile data.

            Success (json):
            {
                "username": str,
                "fullname": str,
                "bio": str,
                "location": str,
                "avatar": str,
                "id": int,
                "num_followers": int,
                "num_following": int,
                "learning_language_string": str,
                "ui_language": str,
                "admin": bool,
                "cohort": int,
                "contribution_points": int,
                "created": str,
                "invites_left": int
            }

            Error: "Error: <message>"
        """
        try:
            info = await call_as(params.username, "get_user_info")
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(info, indent=2)
            lines = [f"# Duolingo User: {info.get('username', 'Unknown')}", ""]
            if info.get("fullname"):
                lines.append(f"- **Full Name**: {info['fullname']}")
            if info.get("bio"):
                lines.append(f"- **Bio**: {info['bio']}")
            if info.get("location"):
                lines.append(f"- **Location**: {info['location']}")
            lines.append(
                f"- **Learning**: {info.get('learning_language_string', 'N/A')}"
            )
            lines.append(f"- **UI Language**: {info.get('ui_language', 'N/A')}")
            lines.append(f"- **Followers**: {info.get('num_followers', 0)}")
            lines.append(f"- **Following**: {info.get('num_following', 0)}")
            lines.append(
                f"- **Contribution Points**: {info.get('contribution_points', 0)}"
            )
            lines.append(f"- **Member Since**: {info.get('created', 'N/A')}")
            if info.get("avatar"):
                lines.append(f"- **Avatar**: {info['avatar']}")
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Settings  (authenticated user only — no username param)
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_settings",
        annotations={
            "title": "Get Duolingo User Settings",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_settings(
        response_format: ResponseFormat = ResponseFormat.MARKDOWN,
    ) -> str:
        """
        Get the authenticated user's Duolingo account settings.

        Returns notification preferences and follow/follower relationship flags.
        Only works for the authenticated user — not available for other users.

        Args:
            response_format: Output format — 'markdown' (default) or 'json'.

        Returns:
            str: Settings data.

            Success (json):
            {
                "notify_comment": bool,
                "deactivated": bool,
                "is_follower_by": bool,
                "is_following": bool
            }

            Error: "Error: <message>"
        """
        try:
            settings = await call("get_settings")
            if response_format == ResponseFormat.JSON:
                return json.dumps(settings, indent=2)
            lines = ["# Duolingo Settings", ""]
            for key, value in settings.items():
                label = key.replace("_", " ").title()
                lines.append(f"- **{label}**: {value}")
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Streak Info
    # -------------------------------------------------------------------------
    class GetStreakInfoInput(BaseModel):
        """Input for getting streak information."""

        model_config = ConfigDict(str_strip_whitespace=True)

        username: Optional[str] = _USERNAME_FIELD
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_streak_info",
        annotations={
            "title": "Get Duolingo Streak Info",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_streak_info(params: GetStreakInfoInput) -> str:
        """
        Get a Duolingo user's current streak information.

        Returns the site-wide streak count, daily XP goal, and whether the streak
        has been extended today.

        Args:
            params (GetStreakInfoInput): Input parameters:
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Streak data.

            Success (json):
            {
                "site_streak": int,
                "daily_goal": int,
                "streak_extended_today": bool
            }

            Error: "Error: <message>"
        """
        try:
            info = await call_as(params.username, "get_streak_info")
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(info, indent=2)
            extended = "✅ Yes" if info.get("streak_extended_today") else "❌ No"
            lines = [
                "# Duolingo Streak",
                "",
                f"- **Current Streak**: {info.get('site_streak', 0)} days",
                f"- **Daily Goal**: {info.get('daily_goal', 0)} XP",
                f"- **Extended Today**: {extended}",
            ]
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Daily XP Progress  (authenticated user only — no username param)
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_daily_xp_progress",
        annotations={
            "title": "Get Duolingo Daily XP Progress",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_daily_xp_progress(
        response_format: ResponseFormat = ResponseFormat.MARKDOWN,
    ) -> str:
        """
        Get the authenticated user's XP progress for today.

        Returns the daily XP goal, total XP earned today, and a list of lessons
        completed today. Only works for the authenticated user — not available for
        other users due to a limitation in the Duolingo API.

        Args:
            response_format: Output format — 'markdown' (default) or 'json'.

        Returns:
            str: Daily XP progress data.

            Success (json):
            {
                "xp_goal": int,
                "xp_today": int,
                "lessons_today": [
                    {
                        "skillId": str,
                        "xp": int,
                        "time": int
                    }
                ]
            }

            Error: "Error: <message>"
        """
        try:
            progress = await call("get_daily_xp_progress")
            if response_format == ResponseFormat.JSON:
                return json.dumps(progress, indent=2)
            xp_today = progress.get("xp_today", 0)
            xp_goal = progress.get("xp_goal", 0)
            lessons = progress.get("lessons_today", [])
            pct = int((xp_today / xp_goal * 100)) if xp_goal else 0
            lines = [
                "# Daily XP Progress",
                "",
                f"- **XP Today**: {xp_today} / {xp_goal} ({pct}%)",
                f"- **Lessons Completed**: {len(lessons)}",
            ]
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Languages
    # -------------------------------------------------------------------------
    class GetLanguagesInput(BaseModel):
        """Input for getting the user's learning languages."""

        model_config = ConfigDict(str_strip_whitespace=True)

        username: Optional[str] = _USERNAME_FIELD
        abbreviations: bool = Field(
            default=False,
            description="If true, return language abbreviations (e.g. 'fr') instead of full names (e.g. 'French').",
        )
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_languages",
        annotations={
            "title": "Get Duolingo Learning Languages",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_languages(params: GetLanguagesInput) -> str:
        """
        Get the list of languages a Duolingo user is currently learning.

        Args:
            params (GetLanguagesInput): Input parameters:
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - abbreviations (bool): Return abbreviations instead of full names. Default: false.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of languages.

            Success (json): ["French", "Spanish", "German"] or ["fr", "es", "de"]
            Success (markdown): Bulleted list of languages.
            Error: "Error: <message>"
        """
        try:
            languages = await call_as(
                params.username, "get_languages", abbreviations=params.abbreviations
            )
            if not languages:
                return "No languages found. The user may not be learning any languages."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(languages, indent=2)
            lines = ["# Learning Languages", ""]
            for lang in languages:
                lines.append(f"- {lang}")
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Friends
    # -------------------------------------------------------------------------
    class GetFriendsInput(BaseModel):
        """Input for getting the friends list."""

        model_config = ConfigDict(str_strip_whitespace=True)

        username: Optional[str] = _USERNAME_FIELD
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_friends",
        annotations={
            "title": "Get Duolingo Friends",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_friends(params: GetFriendsInput) -> str:
        """
        Get a Duolingo user's friends list.

        Returns each friend's username, total points, and languages they are learning.
        The queried user is included in this list.

        Args:
            params (GetFriendsInput): Input parameters:
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Friends list data.

            Success (json):
            [
                {
                    "username": str,
                    "id": int,
                    "points": int,
                    "languages": [str]
                }
            ]

            Error: "Error: <message>"
        """
        try:
            friends = await _get_friends(params.username)
            if not friends:
                return "No friends found."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(friends, indent=2)
            lines = ["# Duolingo Friends", ""]
            for friend in friends:
                langs = ", ".join(friend.get("languages", []))
                lines.append(
                    f"- **{friend['username']}** — {friend.get('points', 0)} pts"
                    f" | Languages: {langs or 'None'}"
                )
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Calendar
    # -------------------------------------------------------------------------
    class GetCalendarInput(BaseModel):
        """Input for getting the user's activity calendar."""

        model_config = ConfigDict(str_strip_whitespace=True)

        username: Optional[str] = _USERNAME_FIELD
        language_abbr: Optional[str] = Field(
            default=None,
            description="Language abbreviation to filter calendar by (e.g. 'fr'). "
            "If omitted, returns the overall calendar.",
        )
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_calendar",
        annotations={
            "title": "Get Duolingo Activity Calendar",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_calendar(params: GetCalendarInput) -> str:
        """
        Get a Duolingo user's recent activity calendar.

        Returns a list of recent activity entries. Optionally filter by language.

        Args:
            params (GetCalendarInput): Input parameters:
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - language_abbr (str, optional): Language abbreviation (e.g. 'fr').
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Calendar activity data.

            Success (json): List of calendar entry dicts.
            Error: "Error: <message>"
        """
        try:
            calendar = await call_as(
                params.username, "get_calendar", params.language_abbr
            )
            if not calendar:
                return "No calendar entries found."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(calendar, indent=2)
            lines = ["# Activity Calendar", ""]
            for entry in calendar[:20]:  # Limit to 20 most recent
                lines.append(f"- {json.dumps(entry)}")
            if len(calendar) > 20:
                lines.append(f"\n_... and {len(calendar) - 20} more entries_")
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Leaderboard
    # -------------------------------------------------------------------------
    class GetLeaderboardInput(BaseModel):
        """Input for getting the user's leaderboard."""

        model_config = ConfigDict(str_strip_whitespace=True)

        username: Optional[str] = _USERNAME_FIELD
        unit: str = Field(
            default="week",
            description="Time unit for the leaderboard: 'week' or 'month'.",
        )
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_leaderboard",
        annotations={
            "title": "Get Duolingo Leaderboard",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_leaderboard(params: GetLeaderboardInput) -> str:
        """
        Get a Duolingo user's leaderboard ranking among their friends.

        Returns an ordered list of friends sorted by XP points for the given time unit.

        Args:
            params (GetLeaderboardInput): Input parameters:
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - unit (str): 'week' or 'month'. Default: 'week'.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Leaderboard data sorted by points descending.

            Success (json):
            [
                {
                    "unit": str,
                    "id": int,
                    "points": int,
                    "username": str
                }
            ]

            Error: "Error: <message>"
        """
        try:
            before = str(time.time())
            data = await _get_leaderboard(params.unit, before, params.username)
            if not data:
                return f"No leaderboard data found for unit '{params.unit}'."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(data, indent=2)
            lines = [f"# Leaderboard ({params.unit.title()})", ""]
            for rank, entry in enumerate(data, start=1):
                lines.append(
                    f"{rank}. **{entry['username']}** — {entry.get('points', 0)} pts"
                )
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

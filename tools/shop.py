"""Shop, utility, and write-action Duolingo MCP tools."""

import json
from enum import Enum
from typing import Optional

import duolingo
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field

from duolingo_client import DuolingoClientError, call, call_as

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
    return f"Error: Unexpected error — {type(exc).__name__}: {exc}"


def register(mcp: FastMCP) -> None:
    """Register all shop and utility tools on the given FastMCP instance."""

    # -------------------------------------------------------------------------
    # Get Language from Abbreviation
    # -------------------------------------------------------------------------
    class GetLanguageFromAbbrInput(BaseModel):
        """Input for converting a language abbreviation to its full name."""

        model_config = ConfigDict(str_strip_whitespace=True)

        language_abbr: str = Field(
            ...,
            description="Language abbreviation to look up (e.g. 'fr', 'es', 'de').",
            min_length=2,
            max_length=5,
        )
        username: Optional[str] = _USERNAME_FIELD

    @mcp.tool(
        name="duolingo_get_language_from_abbr",
        annotations={
            "title": "Get Duolingo Language Name from Abbreviation",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": False,
        },
    )
    async def duolingo_get_language_from_abbr(params: GetLanguageFromAbbrInput) -> str:
        """
        Convert a language abbreviation to its full name.

        Only works for languages the given user is currently learning.

        Args:
            params (GetLanguageFromAbbrInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.

        Returns:
            str: Full language name (e.g. 'French') or error message.

            Success: "French"
            Not found: "No language found for abbreviation 'xx'."
            Error: "Error: <message>"
        """
        try:
            name = await call_as(
                params.username, "get_language_from_abbr", params.language_abbr
            )
            if name is None:
                return (
                    f"No language found for abbreviation '{params.language_abbr}'. "
                    "Make sure the user is learning this language."
                )
            return name
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Abbreviation Of
    # -------------------------------------------------------------------------
    class GetAbbreviationOfInput(BaseModel):
        """Input for converting a language name to its abbreviation."""

        model_config = ConfigDict(str_strip_whitespace=True)

        language_name: str = Field(
            ...,
            description="Full language name to look up (e.g. 'French', 'Spanish').",
            min_length=1,
        )
        username: Optional[str] = _USERNAME_FIELD

    @mcp.tool(
        name="duolingo_get_abbreviation_of",
        annotations={
            "title": "Get Duolingo Language Abbreviation",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": False,
        },
    )
    async def duolingo_get_abbreviation_of(params: GetAbbreviationOfInput) -> str:
        """
        Convert a full language name to its abbreviation.

        Only works for languages the given user is currently learning.

        Args:
            params (GetAbbreviationOfInput): Input parameters:
                - language_name (str): Full language name (e.g. 'French').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.

        Returns:
            str: Language abbreviation (e.g. 'fr') or error message.

            Success: "fr"
            Not found: "No abbreviation found for language 'Unknown'."
            Error: "Error: <message>"
        """
        try:
            abbr = await call_as(
                params.username, "get_abbreviation_of", params.language_name
            )
            if abbr is None:
                return (
                    f"No abbreviation found for language '{params.language_name}'. "
                    "Make sure the user is learning this language."
                )
            return abbr
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Buy Item (destructive)
    # -------------------------------------------------------------------------
    class BuyItemInput(BaseModel):
        """Input for buying a shop item."""

        model_config = ConfigDict(str_strip_whitespace=True)

        item_name: str = Field(
            ...,
            description="Name of the item to buy (e.g. 'streak_freeze', 'weekend_amulet').",
            min_length=1,
        )
        language_abbr: str = Field(
            ...,
            description="Language abbreviation for which to buy the item (e.g. 'fr').",
            min_length=2,
            max_length=5,
        )

    @mcp.tool(
        name="duolingo_buy_item",
        annotations={
            "title": "Buy Duolingo Shop Item",
            "readOnlyHint": False,
            "destructiveHint": True,
            "idempotentHint": False,
            "openWorldHint": True,
        },
    )
    async def duolingo_buy_item(params: BuyItemInput) -> str:
        """
        Purchase a specific item from the Duolingo shop.

        This is a destructive action that spends Lingots/Gems. Common items:
        - 'streak_freeze': Protects your streak for one missed day.
        - 'weekend_amulet': Protects your streak over the weekend.

        Args:
            params (BuyItemInput): Input parameters:
                - item_name (str): Item to purchase (e.g. 'streak_freeze').
                - language_abbr (str): Language abbreviation (e.g. 'fr').

        Returns:
            str: Purchase confirmation or error.

            Success: "Successfully purchased 'streak_freeze'."
            Already owned: "Error: Already equipped with streak_freeze."
            Insufficient funds: "Error: Insufficient funds to purchase streak_freeze."
            Error: "Error: <message>"
        """
        try:
            await call("buy_item", params.item_name, params.language_abbr)
            return f"Successfully purchased '{params.item_name}'."
        except duolingo.AlreadyHaveStoreItemException as exc:
            return f"Error: {exc}"
        except duolingo.InsufficientFundsException as exc:
            return f"Error: {exc}"
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Buy Streak Freeze (destructive convenience)
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_buy_streak_freeze",
        annotations={
            "title": "Buy Duolingo Streak Freeze",
            "readOnlyHint": False,
            "destructiveHint": True,
            "idempotentHint": False,
            "openWorldHint": True,
        },
    )
    async def duolingo_buy_streak_freeze() -> str:
        """
        Buy a streak freeze for the user's current learning language.

        A streak freeze protects your streak for one missed day. This is a
        convenience wrapper around duolingo_buy_item that automatically uses
        the current learning language.

        This is a destructive action that spends Lingots/Gems.

        Returns:
            str: Result of the purchase.

            Success: "Streak freeze purchased successfully."
            Already owned: "Streak freeze already equipped — no purchase needed."
            Error: "Error: <message>"
        """
        try:
            purchased = await call("buy_streak_freeze")
            if purchased:
                return "Streak freeze purchased successfully."
            return "Streak freeze already equipped — no purchase needed."
        except Exception as exc:
            return _handle_error(exc)

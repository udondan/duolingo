"""Async wrapper around the synchronous duolingo.py library."""

import asyncio
import os
from contextlib import contextmanager
from functools import partial
from typing import Any, Generator

import duolingo


class DuolingoClientError(Exception):
    """Raised when the Duolingo client cannot be initialized or a call fails."""


_client: duolingo.Duolingo | None = None


def _get_client() -> duolingo.Duolingo:
    """Return the cached Duolingo client, creating it if necessary."""
    global _client
    if _client is not None:
        return _client

    username = os.environ.get("DUOLINGO_USERNAME")
    jwt = os.environ.get("DUOLINGO_JWT")

    if not username:
        raise DuolingoClientError(
            "DUOLINGO_USERNAME environment variable is not set. "
            "Please set it to your Duolingo username."
        )
    if not jwt:
        raise DuolingoClientError(
            "DUOLINGO_JWT environment variable is not set. "
            "Extract your JWT token from the browser console: "
            "document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11)"
        )

    try:
        _client = duolingo.Duolingo(username, jwt=jwt)
    except duolingo.DuolingoException as exc:
        raise DuolingoClientError(
            f"Failed to authenticate with Duolingo: {exc}"
        ) from exc

    return _client


@contextmanager
def _as_user(
    client: duolingo.Duolingo, username: str | None
) -> Generator[None, None, None]:
    """
    Context manager that temporarily switches the client to a different user,
    then restores the original username on exit.

    If username is None, does nothing (no-op).
    """
    if username is None:
        yield
        return

    original = client.username
    try:
        client.set_username(username)
        yield
    finally:
        if client.username != original:
            client.set_username(original)


async def call(method_name: str, *args: Any, **kwargs: Any) -> Any:
    """
    Call a synchronous Duolingo client method asynchronously.

    Runs the blocking call in a thread pool executor to avoid blocking the
    asyncio event loop.

    :param method_name: Name of the method on the Duolingo client instance.
    :param args: Positional arguments forwarded to the method.
    :param kwargs: Keyword arguments forwarded to the method.
    :return: The return value of the method.
    :raises DuolingoClientError: If the client cannot be initialized.
    :raises duolingo.DuolingoException: If the Duolingo API call fails.
    """
    client = _get_client()
    method = getattr(client, method_name)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(method, *args, **kwargs))


async def call_as(
    username: str | None, method_name: str, *args: Any, **kwargs: Any
) -> Any:
    """
    Call a synchronous Duolingo client method as a specific user, then restore
    the original user.

    If username is None, behaves identically to call().

    :param username: Duolingo username to switch to before the call, or None.
    :param method_name: Name of the method on the Duolingo client instance.
    :param args: Positional arguments forwarded to the method.
    :param kwargs: Keyword arguments forwarded to the method.
    :return: The return value of the method.
    :raises DuolingoClientError: If the client cannot be initialized.
    :raises duolingo.DuolingoException: If the Duolingo API call fails.
    """
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _run() -> Any:
        with _as_user(client, username):
            method = getattr(client, method_name)
            return method(*args, **kwargs)

    return await loop.run_in_executor(None, _run)


async def get_leaderboard(
    unit: str, before: str, username: str | None = None
) -> list[dict]:
    """
    Get a user's leaderboard, working around the upstream library's dependency
    on `get_friends()` which crashes when `points_ranking_data` is absent.
    """
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _run() -> list[dict]:
        with _as_user(client, username):
            import requests as _requests

            url = (
                "https://www.duolingo.com/friendships/leaderboard_activity"
                f"?unit={unit}&_={before}"
            )
            resp = client._make_req(url)
            leader_data = resp.json()
            ranking = leader_data.get("ranking", {})
            if not ranking:
                return []

            # Build friends map from safe get_friends logic
            friends_by_id: dict[int, str] = {}
            for v in client.user_data.language_data.values():
                for friend in v.get("points_ranking_data") or []:
                    friends_by_id[friend["id"]] = friend.get("username", "")
                break  # only first language block, matching upstream

            data = []
            for uid_str, points in ranking.items():
                uid = int(uid_str)
                if uid in friends_by_id:
                    data.append(
                        {
                            "unit": unit,
                            "id": uid,
                            "points": int(points),
                            "username": friends_by_id[uid],
                        }
                    )
            return sorted(data, key=lambda u: u["points"], reverse=True)

    return await loop.run_in_executor(None, _run)


async def get_friends(username: str | None = None) -> list[dict]:
    """
    Get a user's friends list, working around the upstream library's assumption
    that `points_ranking_data` exists in every language's data block.

    Falls back to an empty list if the field is absent (Duolingo API drift).
    """
    client = _get_client()
    loop = asyncio.get_event_loop()

    def _run() -> list[dict]:
        with _as_user(client, username):
            data = []
            for v in client.user_data.language_data.values():
                ranking = v.get("points_ranking_data")
                if not ranking:
                    continue
                for friend in ranking:
                    points_data = friend.get("points_data", {})
                    data.append(
                        {
                            "username": friend.get("username", ""),
                            "id": friend.get("id"),
                            "points": points_data.get("total", 0),
                            "languages": [
                                lang.get("language_string", "")
                                for lang in points_data.get("languages", [])
                            ],
                        }
                    )
                return data  # only use the first language block, matching upstream behaviour
            return data

    return await loop.run_in_executor(None, _run)


def reset_client() -> None:
    """Reset the cached client (useful for testing or credential rotation)."""
    global _client
    _client = None

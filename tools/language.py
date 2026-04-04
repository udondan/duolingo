"""Language-level Duolingo MCP tools."""

import json
from enum import Enum
from typing import List, Optional

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


def _format_topic_list(title: str, topics: List[str], fmt: ResponseFormat) -> str:
    if not topics:
        return f"No {title.lower()} found."
    if fmt == ResponseFormat.JSON:
        return json.dumps(topics, indent=2)
    lines = [f"# {title}", ""]
    for topic in sorted(topics):
        lines.append(f"- {topic}")
    return "\n".join(lines)


def register(mcp: FastMCP) -> None:
    """Register all language tools on the given FastMCP instance."""

    # -------------------------------------------------------------------------
    # Get Language Details
    # -------------------------------------------------------------------------
    class GetLanguageDetailsInput(BaseModel):
        """Input for getting language details."""

        model_config = ConfigDict(str_strip_whitespace=True)

        language_name: str = Field(
            ...,
            description="Full name of the language (e.g. 'French', 'Spanish').",
            min_length=1,
        )
        username: Optional[str] = _USERNAME_FIELD
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_language_details",
        annotations={
            "title": "Get Duolingo Language Details",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_language_details(params: GetLanguageDetailsInput) -> str:
        """
        Get a user's status and details for a specific language.

        Returns level, points, streak, and learning status for the given language.

        Args:
            params (GetLanguageDetailsInput): Input parameters:
                - language_name (str): Full language name (e.g. 'French').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Language details.

            Success (json):
            {
                "language": str,
                "language_string": str,
                "level": int,
                "points": int,
                "streak": int,
                "current_learning": bool,
                "learning": bool
            }

            Error: "Error: <message>"
        """
        try:
            details = await call_as(
                params.username, "get_language_details", params.language_name
            )
            if not details:
                return f"No details found for language '{params.language_name}'. Check the language name."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(details, indent=2)
            lines = [f"# {params.language_name} Details", ""]
            lines.append(f"- **Level**: {details.get('level', 'N/A')}")
            lines.append(f"- **Points**: {details.get('points', 0)}")
            lines.append(f"- **Streak**: {details.get('streak', 0)} days")
            lines.append(
                f"- **Currently Learning**: {details.get('current_learning', False)}"
            )
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Language Progress
    # -------------------------------------------------------------------------
    class GetLanguageProgressInput(BaseModel):
        """Input for getting language progress."""

        model_config = ConfigDict(str_strip_whitespace=True)

        language_abbr: str = Field(
            ...,
            description="Language abbreviation (e.g. 'fr' for French, 'es' for Spanish).",
            min_length=2,
            max_length=5,
        )
        username: Optional[str] = _USERNAME_FIELD
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_language_progress",
        annotations={
            "title": "Get Duolingo Language Progress",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_language_progress(params: GetLanguageProgressInput) -> str:
        """
        Get detailed progress metrics for a specific language.

        Returns level, percent to next level, points rank, fluency score, skills
        learned, and more.

        Args:
            params (GetLanguageProgressInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Language progress data.

            Success (json):
            {
                "language": str,
                "language_string": str,
                "level": int,
                "level_percent": int,
                "level_points": int,
                "level_progress": int,
                "level_left": int,
                "next_level": int,
                "points": int,
                "points_rank": int,
                "streak": int,
                "num_skills_learned": int,
                "fluency_score": float
            }

            Error: "Error: <message>"
        """
        try:
            progress = await call_as(
                params.username, "get_language_progress", params.language_abbr
            )
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(progress, indent=2)
            lang = progress.get("language_string", params.language_abbr)
            lines = [f"# {lang} Progress", ""]
            lines.append(f"- **Level**: {progress.get('level', 'N/A')}")
            lines.append(f"- **Level Progress**: {progress.get('level_percent', 0)}%")
            lines.append(f"- **Points to Next Level**: {progress.get('level_left', 0)}")
            lines.append(f"- **Total Points**: {progress.get('points', 0)}")
            lines.append(f"- **Points Rank**: #{progress.get('points_rank', 'N/A')}")
            lines.append(f"- **Streak**: {progress.get('streak', 0)} days")
            lines.append(
                f"- **Skills Learned**: {progress.get('num_skills_learned', 0)}"
            )
            if progress.get("fluency_score") is not None:
                lines.append(f"- **Fluency Score**: {progress['fluency_score']}")
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Shared input model for topic/word tools (language + optional username)
    # -------------------------------------------------------------------------
    class GetTopicsInput(BaseModel):
        """Input for topic and word list tools."""

        model_config = ConfigDict(str_strip_whitespace=True)

        language_abbr: str = Field(
            ...,
            description="Language abbreviation (e.g. 'fr' for French).",
            min_length=2,
            max_length=5,
        )
        username: Optional[str] = _USERNAME_FIELD
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    # -------------------------------------------------------------------------
    # Get Known Topics
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_known_topics",
        annotations={
            "title": "Get Duolingo Known Topics",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_known_topics(params: GetTopicsInput) -> str:
        """
        Get the list of learned topic/skill names for a language.

        Args:
            params (GetTopicsInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of known topic names.

            Success (json): ["Colors", "Basics 2", "Animals", ...]
            Error: "Error: <message>"
        """
        try:
            topics = await call_as(
                params.username, "get_known_topics", params.language_abbr
            )
            return _format_topic_list("Known Topics", topics, params.response_format)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Unknown Topics
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_unknown_topics",
        annotations={
            "title": "Get Duolingo Unknown Topics",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_unknown_topics(params: GetTopicsInput) -> str:
        """
        Get the list of not-yet-learned topics/skills for a language.

        Args:
            params (GetTopicsInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of unknown topic names.

            Success (json): ["The", "Accusative Case", "Nature 1", ...]
            Error: "Error: <message>"
        """
        try:
            topics = await call_as(
                params.username, "get_unknown_topics", params.language_abbr
            )
            return _format_topic_list("Unknown Topics", topics, params.response_format)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Golden Topics
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_golden_topics",
        annotations={
            "title": "Get Duolingo Golden (Mastered) Topics",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_golden_topics(params: GetTopicsInput) -> str:
        """
        Get the list of fully mastered ("golden") topics for a language.

        A golden topic has a strength of 1.0 (fully reviewed).

        Args:
            params (GetTopicsInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of golden topic names.

            Success (json): ["Colors", "Basics 2", ...]
            Error: "Error: <message>"
        """
        try:
            topics = await call_as(
                params.username, "get_golden_topics", params.language_abbr
            )
            return _format_topic_list(
                "Golden (Mastered) Topics", topics, params.response_format
            )
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Reviewable Topics
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_reviewable_topics",
        annotations={
            "title": "Get Duolingo Reviewable Topics",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_reviewable_topics(params: GetTopicsInput) -> str:
        """
        Get the list of learned but not fully mastered topics for a language.

        These are topics that have been started but whose strength is below 1.0,
        meaning they need review.

        Args:
            params (GetTopicsInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of reviewable topic names.

            Success (json): ["Food", "Questions", "Basics", ...]
            Error: "Error: <message>"
        """
        try:
            topics = await call_as(
                params.username, "get_reviewable_topics", params.language_abbr
            )
            return _format_topic_list(
                "Reviewable Topics", topics, params.response_format
            )
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Known Words
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_known_words",
        annotations={
            "title": "Get Duolingo Known Words",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_known_words(params: GetTopicsInput) -> str:
        """
        Get the set of words a user has learned in a language.

        Args:
            params (GetTopicsInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of known words.

            Success (json): ["absolument", "accepté", "acier", ...]
            Error: "Error: <message>"
        """
        try:
            words = await call_as(
                params.username, "get_known_words", params.language_abbr
            )
            if not words:
                return f"No known words found for language '{params.language_abbr}'."
            words_sorted = sorted(words)
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(words_sorted, indent=2)
            lines = [
                f"# Known Words ({params.language_abbr.upper()}) — {len(words_sorted)} words",
                "",
            ]
            lines.append(", ".join(words_sorted))
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Learned Skills
    # -------------------------------------------------------------------------
    @mcp.tool(
        name="duolingo_get_learned_skills",
        annotations={
            "title": "Get Duolingo Learned Skills",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_learned_skills(params: GetTopicsInput) -> str:
        """
        Get full skill objects for all learned skills, sorted by learning order.

        Returns detailed skill data including title, strength, progress, words, and more.

        Args:
            params (GetTopicsInput): Input parameters:
                - language_abbr (str): Language abbreviation (e.g. 'fr').
                - username (str, optional): Duolingo username to query. Defaults to authenticated user.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Ordered list of learned skill objects.

            Success (json): Array of skill objects with title, strength, progress_percent, etc.
            Error: "Error: <message>"
        """
        try:
            skills = await call_as(
                params.username, "get_learned_skills", params.language_abbr
            )
            if not skills:
                return f"No learned skills found for language '{params.language_abbr}'."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(skills, indent=2)
            lines = [f"# Learned Skills ({params.language_abbr.upper()})", ""]
            for skill in skills:
                strength_pct = int(skill.get("strength", 0) * 100)
                lines.append(
                    f"- **{skill.get('title', 'Unknown')}** — "
                    f"Strength: {strength_pct}% | "
                    f"Progress: {skill.get('progress_percent', 0):.0f}%"
                )
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Vocabulary  (authenticated user only — upstream library restriction)
    # -------------------------------------------------------------------------
    class GetVocabularyInput(BaseModel):
        """Input for getting vocabulary overview."""

        model_config = ConfigDict(str_strip_whitespace=True)

        language_abbr: Optional[str] = Field(
            default=None,
            description="Language abbreviation (e.g. 'fr'). Defaults to the user's current language.",
        )
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_vocabulary",
        annotations={
            "title": "Get Duolingo Vocabulary Overview",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_vocabulary(params: GetVocabularyInput) -> str:
        """
        Get the full vocabulary overview for a language.

        Returns detailed word data including strength, part of speech, last practiced
        date, and related lexemes. Only works for the authenticated user — the upstream
        Duolingo API does not expose vocabulary for other users.

        Args:
            params (GetVocabularyInput): Input parameters:
                - language_abbr (str, optional): Language abbreviation. Defaults to current language.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Vocabulary overview data.

            Success (json):
            {
                "language_string": str,
                "learning_language": str,
                "from_language": str,
                "vocab_overview": [
                    {
                        "word_string": str,
                        "normalized_string": str,
                        "pos": str,
                        "strength": float,
                        "strength_bars": int,
                        "skill": str,
                        "last_practiced": str,
                        "gender": str,
                        "infinitive": str
                    }
                ]
            }

            Error: "Error: <message>"
        """
        try:
            vocab = await call("get_vocabulary", language_abbr=params.language_abbr)
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(vocab, indent=2)
            lang = vocab.get("language_string", params.language_abbr or "current")
            overview = vocab.get("vocab_overview", [])
            lines = [f"# Vocabulary: {lang} ({len(overview)} words)", ""]
            for word in overview[:50]:  # Limit to 50 for readability
                strength_pct = int(word.get("strength", 0) * 100)
                pos = word.get("pos", "")
                lines.append(
                    f"- **{word.get('word_string', '?')}** "
                    f"({pos}) — Strength: {strength_pct}%"
                )
            if len(overview) > 50:
                lines.append(
                    f"\n_... and {len(overview) - 50} more words. Use json format for full list._"
                )
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Related Words  (authenticated user only — depends on vocabulary)
    # -------------------------------------------------------------------------
    class GetRelatedWordsInput(BaseModel):
        """Input for getting related words."""

        model_config = ConfigDict(str_strip_whitespace=True)

        word: str = Field(
            ...,
            description="The word to find related forms for (e.g. 'aller', 'gehen').",
            min_length=1,
        )
        language_abbr: Optional[str] = Field(
            default=None,
            description="Language abbreviation (e.g. 'fr'). Defaults to current language.",
        )
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_related_words",
        annotations={
            "title": "Get Duolingo Related Words",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_related_words(params: GetRelatedWordsInput) -> str:
        """
        Get conjugations and related word forms for a given word.

        For example, for the French verb 'aller', returns conjugations like 'allait',
        'allons', etc. from the user's vocabulary list. Only works for the authenticated
        user — the upstream Duolingo API does not expose vocabulary for other users.

        Args:
            params (GetRelatedWordsInput): Input parameters:
                - word (str): The base word to look up (e.g. 'aller').
                - language_abbr (str, optional): Language abbreviation.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of related word objects.

            Success (json): Array of vocab word objects with word_string, pos, strength, etc.
            Error: "Error: <message>"
        """
        try:
            related = await call(
                "get_related_words", params.word, language_abbr=params.language_abbr
            )
            if not related:
                return f"No related words found for '{params.word}'."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(related, indent=2)
            lines = [f"# Related Words: '{params.word}'", ""]
            for w in related:
                lines.append(
                    f"- **{w.get('word_string', '?')}** "
                    f"({w.get('pos', '')}) — "
                    f"Skill: {w.get('skill', 'N/A')}"
                )
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Translations
    # -------------------------------------------------------------------------
    class GetTranslationsInput(BaseModel):
        """Input for getting word translations."""

        model_config = ConfigDict(str_strip_whitespace=True)

        words: List[str] = Field(
            ...,
            description="List of words to translate (e.g. ['bonjour', 'merci']).",
            min_length=1,
        )
        source: Optional[str] = Field(
            default=None,
            description="Source language abbreviation (e.g. 'fr'). Defaults to user's UI language.",
        )
        target: Optional[str] = Field(
            default=None,
            description="Target language abbreviation (e.g. 'en'). Defaults to user's current learning language.",
        )
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_translations",
        annotations={
            "title": "Get Duolingo Word Translations",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_translations(params: GetTranslationsInput) -> str:
        """
        Get translations for a list of words between two languages.

        Returns a dictionary mapping each word to its list of possible translations.
        Translations are fetched from Duolingo's dictionary API and do not depend on
        a specific user's data.

        Args:
            params (GetTranslationsInput): Input parameters:
                - words (list[str]): Words to translate.
                - source (str, optional): Source language abbreviation.
                - target (str, optional): Target language abbreviation.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: Translation data.

            Success (json):
            {
                "bonjour": ["hello", "good morning"],
                "merci": ["thank you", "thanks"]
            }

            Error: "Error: <message>"
        """
        try:
            translations = await call(
                "get_translations",
                params.words,
                source=params.source,
                target=params.target,
            )
            if not translations:
                return "No translations found."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(translations, indent=2)
            lines = ["# Translations", ""]
            for word, trans in translations.items():
                trans_str = ", ".join(trans) if trans else "No translation found"
                lines.append(f"- **{word}**: {trans_str}")
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Language Voices
    # -------------------------------------------------------------------------
    class GetLanguageVoicesInput(BaseModel):
        """Input for getting language voices."""

        model_config = ConfigDict(str_strip_whitespace=True)

        language_abbr: Optional[str] = Field(
            default=None,
            description="Language abbreviation (e.g. 'fr'). Defaults to current language.",
        )
        response_format: ResponseFormat = Field(
            default=ResponseFormat.MARKDOWN,
            description="Output format: 'markdown' or 'json'.",
        )

    @mcp.tool(
        name="duolingo_get_language_voices",
        annotations={
            "title": "Get Duolingo Language TTS Voices",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": True,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_language_voices(params: GetLanguageVoicesInput) -> str:
        """
        Get the available text-to-speech (TTS) voices for a language.

        Returns a list of voice names. Always includes at least one voice.

        Args:
            params (GetLanguageVoicesInput): Input parameters:
                - language_abbr (str, optional): Language abbreviation.
                - response_format (str): 'markdown' or 'json'. Default: 'markdown'.

        Returns:
            str: List of voice names.

            Success (json): ["default", "mathieu"]
            Error: "Error: <message>"
        """
        try:
            voices = await call("get_language_voices", params.language_abbr)
            if not voices:
                return "No voices found."
            if params.response_format == ResponseFormat.JSON:
                return json.dumps(voices, indent=2)
            lines = [f"# TTS Voices ({params.language_abbr or 'current language'})", ""]
            for voice in voices:
                lines.append(f"- {voice}")
            return "\n".join(lines)
        except Exception as exc:
            return _handle_error(exc)

    # -------------------------------------------------------------------------
    # Get Audio URL
    # -------------------------------------------------------------------------
    class GetAudioUrlInput(BaseModel):
        """Input for getting a word's audio URL."""

        model_config = ConfigDict(str_strip_whitespace=True)

        word: str = Field(
            ...,
            description="The word to get pronunciation audio for (e.g. 'bonjour').",
            min_length=1,
        )
        language_abbr: Optional[str] = Field(
            default=None,
            description="Language abbreviation (e.g. 'fr'). Defaults to current language.",
        )
        voice: Optional[str] = Field(
            default=None,
            description="Specific voice name to use (e.g. 'mathieu'). Defaults to random.",
        )
        random: bool = Field(
            default=True,
            description="If true, select a random voice. Ignored if 'voice' is specified.",
        )

    @mcp.tool(
        name="duolingo_get_audio_url",
        annotations={
            "title": "Get Duolingo Word Audio URL",
            "readOnlyHint": True,
            "destructiveHint": False,
            "idempotentHint": False,
            "openWorldHint": True,
        },
    )
    async def duolingo_get_audio_url(params: GetAudioUrlInput) -> str:
        """
        Get the URL of a pronunciation audio file for a word.

        Returns a CloudFront CDN URL pointing to the TTS audio file.

        Args:
            params (GetAudioUrlInput): Input parameters:
                - word (str): The word to get audio for.
                - language_abbr (str, optional): Language abbreviation.
                - voice (str, optional): Specific voice name.
                - random (bool): Use a random voice. Default: true.

        Returns:
            str: Audio URL or error message.

            Success: "https://d7mj4aqfscim2.cloudfront.net/tts/fr/token/bonjour"
            Not found: "No audio found for word '<word>'."
            Error: "Error: <message>"
        """
        try:
            url = await call(
                "get_audio_url",
                params.word,
                language_abbr=params.language_abbr,
                rand=params.random,
                voice=params.voice,
            )
            if url is None:
                return f"No audio found for word '{params.word}'."
            return url
        except Exception as exc:
            return _handle_error(exc)

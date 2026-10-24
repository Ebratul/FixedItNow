"""Small text helpers shared across modules."""

from __future__ import annotations

import re
import unicodedata

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏‪-‮⁦-⁩﻿]")
_SPACES = re.compile(r"\s+")
_BENGALI_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def normalize(text: str, limit: int | None = None) -> str:
    """NFC, no control/bidi-override characters, collapsed whitespace."""
    text = unicodedata.normalize("NFC", text)
    text = _CONTROL.sub(" ", text)
    text = _SPACES.sub(" ", text).strip()
    return text[:limit] if limit else text


def ascii_digits(text: str) -> str:
    return text.translate(_BENGALI_DIGITS)


def bengali_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    bengali = sum(1 for c in letters if "ঀ" <= c <= "৿")
    return bengali / len(letters)


def detect_language(text: str) -> str:
    return "bn" if bengali_ratio(text) >= 0.3 else "en"


_LINKS = re.compile(r"https?://\S+|www\.\S+|\[[^\]]*\]\([^)]*\)|<[^>]*>|`+")


def strip_markup(text: str) -> str:
    """Remove URLs, markdown links, HTML tags and code fences from model text."""
    return _SPACES.sub(" ", _LINKS.sub("", text)).strip()

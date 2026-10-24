"""Deterministic extraction used when the language model is unavailable.

Small on purpose: it recognises the eight divisions, the seeded service
categories (English, Bangla and common Banglish words), a budget and a minimum
experience. It never guesses beyond that, so a miss produces a clarification
question rather than a wrong search.
"""

from __future__ import annotations

import re

from app.schemas import DIVISIONS, MAX_BUDGET_BDT, MIN_BUDGET_BDT
from app.text import ascii_digits

_DIVISION_WORDS: dict[str, tuple[str, ...]] = {
    "Dhaka": ("dhaka", "dacca", "ঢাকা"),
    "Chattogram": ("chattogram", "chittagong", "chottogram", "ctg", "চট্টগ্রাম", "চট্রগ্রাম"),
    "Rajshahi": ("rajshahi", "রাজশাহী"),
    "Khulna": ("khulna", "খুলনা"),
    "Barishal": ("barishal", "barisal", "বরিশাল"),
    "Sylhet": ("sylhet", "sileti", "সিলেট"),
    "Rangpur": ("rangpur", "রংপুর"),
    "Mymensingh": ("mymensingh", "mymensing", "ময়মনসিংহ"),
}

# Keyed by the seeded category slugs; a slug missing from the live catalogue is ignored.
_CATEGORY_WORDS: dict[str, tuple[str, ...]] = {
    "electrical": ("electrician", "electric", "wiring", "wire", "switchboard", "ইলেকট্রিশিয়ান", "ইলেকট্রিক", "বিদ্যুৎ", "ওয়ারিং"),
    "plumbing": ("plumber", "plumbing", "pipe", "leak", "faucet", "প্লাম্বার", "পাইপ", "লিক", "ট্যাপ"),
    "ac-repair": ("ac technician", "ac repair", "ac service", "air conditioner", "air conditioning", "এসি", "এয়ার কন্ডিশনার"),
    "home-cleaning": ("cleaning", "cleaner", "deep clean", "পরিষ্কার", "ক্লিনিং"),
    "appliance-repair": ("washing machine", "fridge", "refrigerator", "oven", "microwave", "ওয়াশিং মেশিন", "ফ্রিজ", "রেফ্রিজারেটর"),
    "painting": ("painter", "painting", "paint", "রং", "পেইন্ট"),
    "carpentry": ("carpenter", "carpentry", "furniture", "woodwork", "কাঠমিস্ত্রি", "ফার্নিচার", "কার্পেন্টার"),
    "moving-shifting": ("moving", "shifting", "relocation", "packers", "বাসা বদল", "শিফটিং"),
    "pest-control": ("pest", "cockroach", "termite", "rodent", "mosquito", "তেলাপোকা", "উইপোকা", "পেস্ট"),
    "computer-it": ("laptop", "computer", "desktop", "wifi", "wi-fi", "network", "router", "ল্যাপটপ", "কম্পিউটার"),
}

_WORD = re.compile(r"[\w'-]+", re.UNICODE)
_BUDGET_MARKED = re.compile(
    r"(?:under|below|within|max(?:imum)?|upto|up to|budget(?: is| of)?|less than|er moddhe|এর মধ্যে|টাকার মধ্যে|বাজেট)"
    r"\D{0,12}(\d[\d,]*)\s*(?:k\b|হাজার|thousand)?",
    re.IGNORECASE,
)
_BUDGET_CURRENCY = re.compile(
    r"(?:৳|bdt|tk\.?|taka)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:৳|bdt|tk\b|taka|টাকা)", re.IGNORECASE
)
_EXPERIENCE = re.compile(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?|বছর)", re.IGNORECASE)
_TIME_HINT = re.compile(
    r"\b(today|tomorrow|tonight|this weekend|weekend|morning|afternoon|evening|night|monday|tuesday|wednesday|"
    r"thursday|friday|saturday|sunday|asap|urgent)\b|আজ|কাল|আগামীকাল|সকাল|বিকাল|সন্ধ্যা|রাত|সপ্তাহ",
    re.IGNORECASE,
)


def _contains(text: str, word: str) -> bool:
    if word.isascii() and word.replace(" ", "").isalnum() and len(word) <= 3:
        return re.search(rf"\b{re.escape(word)}\b", text) is not None
    return word in text


def find_location(text: str) -> str | None:
    lowered = text.lower()
    hits = [name for name, words in _DIVISION_WORDS.items() if any(_contains(lowered, w) for w in words)]
    return hits[0] if len(hits) == 1 else None  # two divisions: ambiguous, ask


def find_category(text: str, available_slugs: set[str]) -> str | None:
    lowered = text.lower()
    hits = [
        slug
        for slug, words in _CATEGORY_WORDS.items()
        if slug in available_slugs and any(_contains(lowered, w) for w in words)
    ]
    return hits[0] if len(hits) == 1 else None


def find_budget(text: str) -> int | None:
    digits = ascii_digits(text).replace("৳", "৳ ")
    for pattern in (_BUDGET_MARKED, _BUDGET_CURRENCY):
        match = pattern.search(digits)
        if not match:
            continue
        number = next(g for g in match.groups() if g)
        value = int(number.replace(",", ""))
        tail = digits[match.end() - 12 : match.end()].lower()
        if re.search(r"\d\s*k\b|thousand|হাজার", tail):
            value *= 1000
        if MIN_BUDGET_BDT <= value <= MAX_BUDGET_BDT:
            return value
    return None


def find_experience(text: str) -> int | None:
    match = _EXPERIENCE.search(ascii_digits(text))
    if not match:
        return None
    value = int(match.group(1))
    return value if 0 <= value <= 60 else None


def find_time_hint(text: str) -> str | None:
    match = _TIME_HINT.search(text)
    return match.group(0) if match else None


def extract(text: str, available_slugs: set[str]) -> dict[str, object]:
    found: dict[str, object] = {
        "category": find_category(text, available_slugs),
        "location": find_location(text),
        "max_budget_bdt": find_budget(text),
        "min_experience_years": find_experience(text),
        "preferred_time": find_time_hint(text),
    }
    return {k: v for k, v in found.items() if v is not None}


assert set(_DIVISION_WORDS) == set(DIVISIONS)

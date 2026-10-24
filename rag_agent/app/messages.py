"""Fixed assistant wording (English and Bangla).

Chat text for worker search is built here from verified counts and the user's own
filters, never written by a model, so it cannot promise anything the data does not
support. The Bangla strings should be reviewed by a native speaker before launch.
"""

from __future__ import annotations

from typing import Literal

Lang = Literal["en", "bn"]

_ORDER = {
    "experience": {"en": "most experience first", "bn": "বেশি অভিজ্ঞতা আগে"},
    "price_asc": {"en": "lowest starting price first", "bn": "কম শুরুর দাম আগে"},
    "newest": {"en": "most recently listed first", "bn": "সর্বশেষ যুক্ত আগে"},
}


def order_label(sort: str, lang: Lang) -> str:
    return _ORDER[sort][lang]


def results(lang: Lang, shown: int, total: int, sort: str) -> str:
    order = order_label(sort, lang)
    if lang == "bn":
        return f"আপনার শর্ত অনুযায়ী {total} জন পেশাদার পেয়েছি। {order} ক্রমে প্রথম {shown} জনকে দেখাচ্ছি।"
    noun = "professional" if total == 1 else "professionals"
    if shown == total:
        return f"I found {total} {noun} matching your filters, listed with {order}."
    return f"I found {total} {noun} matching your filters. Showing the top {shown}, {order}."


def no_results(lang: Lang, has_relaxations: bool) -> str:
    if lang == "bn":
        base = "আপনার সব শর্ত মিলিয়ে এখন কোনো প্রকাশিত পেশাদার পাইনি।"
        return base + (" নিচের কোনো শর্ত শিথিল করলে ফলাফল পাওয়া যাবে।" if has_relaxations else "")
    base = "No published professional matches all of your filters right now."
    return base + (" Relaxing one of these filters would give results:" if has_relaxations else "")


def ask_category(lang: Lang) -> str:
    return "আপনার কোন ধরনের সার্ভিস দরকার?" if lang == "bn" else "What kind of service do you need?"


def ask_location(lang: Lang) -> str:
    return (
        "কোন বিভাগে খুঁজব? (বললে ফলাফল আরও সঠিক হবে)"
        if lang == "bn"
        else "Which division should I search in? (It makes the results more relevant.)"
    )


def out_of_scope(lang: Lang) -> str:
    if lang == "bn":
        return (
            "আমি শুধু FixedItNow-এ সার্ভিস পেশাদার খুঁজতে এবং প্ল্যাটফর্ম কীভাবে কাজ করে তা বুঝতে সাহায্য করতে পারি। "
            "যেমন: “সিলেটে একজন ইলেকট্রিশিয়ান দরকার”।"
        )
    return (
        "I can only help you find service professionals on FixedItNow and explain how the platform works. "
        "For example: “I need an electrician in Sylhet.”"
    )


def refused(lang: Lang, reason: str) -> str:
    if lang == "bn":
        if reason == "contact":
            return (
                "অন্য কারও ফোন, ইমেইল, ঠিকানা বা ব্যক্তিগত তথ্য আমি দিতে পারি না। "
                "বুকিং নিশ্চিত হলে প্ল্যাটফর্মের নিয়ম অনুযায়ী প্রয়োজনীয় তথ্য বুকিং পেজে দেখা যায়।"
            )
        return "এই অনুরোধটি আমি পূরণ করতে পারি না। আমি শুধু সার্ভিস পেশাদার খুঁজতে সাহায্য করি।"
    if reason == "contact":
        return (
            "I can't share anyone's phone number, email, address or other private details. "
            "Once a booking is confirmed, the details the platform allows are shown on the booking page."
        )
    return "I can't help with that request. I only help find service professionals and explain how FixedItNow works."


def unclear(lang: Lang) -> str:
    if lang == "bn":
        return "কোন সার্ভিস ও কোন এলাকায় পেশাদার দরকার তা লিখুন, যেমন “ঢাকায় প্লাম্বার দরকার”।"
    return "Tell me which service you need and where, for example “I need a plumber in Dhaka”."


def not_established(lang: Lang) -> str:
    if lang == "bn":
        return (
            "FixedItNow-এর সহায়তা তথ্যে এর নির্ভরযোগ্য উত্তর পাইনি, তাই অনুমান করে বলছি না। "
            "Help পেজ দেখুন বা আমাদের সঙ্গে যোগাযোগ করুন।"
        )
    return (
        "The FixedItNow help content I have doesn't establish an answer to that, so I won't guess. "
        "Please check the Help page or contact us."
    )


def marketplace_down(lang: Lang) -> str:
    return "এখন তথ্য আনা যাচ্ছে না।" if lang == "bn" else "I can't reach the marketplace data right now."

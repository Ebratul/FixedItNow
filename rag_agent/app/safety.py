"""Deterministic input screening and output checks.

These are *signals and guard rails*, not the security boundary. The boundary is
structural: the model never chooses tools, arguments or worker ids, every field it
returns is validated against closed enums/ranges, and the main API re-reads all
facts from the database. Pattern lists here only decide how to *respond*.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_I = re.IGNORECASE

_PRIVATE_TERM = re.compile(
    r"((phone|mobile|contact)\s*(number|no\.?|details|info)|e-?mail\s*(address|id)|\bnid\b|national\s+id|passport|"
    r"password|home\s+address|ফোন\s*নম্বর|মোবাইল\s*নম্বর|ইমেইল|ঠিকানা|পাসওয়ার্ড)",
    _I,
)
_THIRD_PARTY = re.compile(
    r"((of|for|from)\s+(the\s+|any\s+|all\s+|that\s+)?(customer|user|worker|professional|electrician|plumber|"
    r"technician|admin|booking|them|him|her)|\b(their|his|her)\b|\b(worker|customer|user|admin|professional)'?s\b|"
    r"(ওয়ার্কার|কাস্টমার|ইউজার|প্লাম্বার|ইলেকট্রিশিয়ান|অ্যাডমিন)(র|ের|এর))",
    _I,
)
_OTHER_PEOPLE = re.compile(
    r"(other|another|someone else'?s?|all|every|list of)\s+(customer|user|worker|booking|payment|account)s?",
    _I,
)
_SYSTEM_PROBE = re.compile(
    r"(system\s*prompt|your\s+(hidden\s+)?(instructions|prompt|rules)|developer\s+message|"
    r"reveal\s+(the\s+)?(prompt|instructions|config)|api[\s_-]?key|openrouter|environment\s+variable)",
    _I,
)
_SQL_SHELL = re.compile(
    r"(\bselect\b.+\bfrom\b|\bdrop\s+table\b|\bdelete\s+from\b|\binsert\s+into\b|\bunion\s+select\b|"
    r"\bupdate\b.+\bset\b|;\s*--|\brm\s+-rf\b|\bsudo\b|\bcurl\s+https?://|\bchmod\b|/etc/passwd|"
    r"\bexec(ute)?\s+(sql|query|command|shell))",
    _I,
)
_ACTION = re.compile(
    r"(\b(book|reserve|hire|schedule|cancel|refund|pay|charge|confirm)\b.{0,30}\b(for me|now|it|this|him|her|them)\b|"
    r"\b(please\s+)?(book|cancel|refund|pay for)\b|বুক\s*করে|ক্যান্সেল|রিফান্ড|পেমেন্ট\s*করে)",
    _I,
)
_INJECTION_MARKER = re.compile(
    r"(ignore|disregard|forget|override)\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier|system)|"
    r"you\s+are\s+now|act\s+as\s+(an?\s+)?(admin|developer|root)|jailbreak|developer\s+mode|"
    r"pretend\s+(to\s+be|you)",
    _I,
)
_ADMIN_CLAIM = re.compile(r"(i\s+am|i'm|as)\s+(an?\s+)?(admin|administrator|staff|developer|owner)", _I)


@dataclass(frozen=True)
class Screen:
    private_data: bool
    system_probe: bool
    sql_or_shell: bool
    action_request: bool
    injection_marker: bool

    @property
    def refuse(self) -> bool:
        """Requests that can never be served by service discovery."""
        return self.private_data or self.system_probe or self.sql_or_shell

    def flags(self) -> list[str]:
        return [name for name, on in vars(self).items() if on]


def screen(text: str) -> Screen:
    return Screen(
        private_data=bool(
            (_PRIVATE_TERM.search(text) and _THIRD_PARTY.search(text)) or _OTHER_PEOPLE.search(text)
        ),
        system_probe=bool(_SYSTEM_PROBE.search(text)),
        sql_or_shell=bool(_SQL_SHELL.search(text)),
        action_request=bool(_ACTION.search(text)),
        injection_marker=bool(_INJECTION_MARKER.search(text) or _ADMIN_CLAIM.search(text)),
    )


# First-person claims that an action was performed. The assistant cannot perform
# any, so model-written text containing one is rejected.
_ACTION_CLAIM = re.compile(
    r"\b(i|we)(\s+have|'ve|\s+just|\s+already)?\s+(booked|cancel(l)?ed|paid|refunded|confirmed|scheduled|reserved|"
    r"charged|processed)\b|"
    r"\b(your|the)\s+(booking|payment|refund|appointment)\s+(is|has been|was)\s+(confirmed|booked|cancel(l)?ed|"
    r"processed|completed|made)\b|"
    r"(বুক\s*করে\s*দিয়েছি|ক্যান্সেল\s*করে\s*দিয়েছি|রিফান্ড\s*করে\s*দিয়েছি|পেমেন্ট\s*হয়ে\s*গেছে)",
    _I,
)


def claims_action(text: str) -> bool:
    return bool(_ACTION_CLAIM.search(text))

"""Retirement age + date calculation per Egyptian Law 148/2019 schedule.

Pure functions — no DB access. Extracted from server.py (Phase B refactor).
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


DEFAULT_RETIREMENT_SCHEDULE = [
    {"id": "ret-60", "effective_date": "1900-01-01", "retirement_age": 60,
     "description": "حتى يونيو 2032: سن المعاش 60 عامًا لمواليد ما قبل 1 يوليو 1971"},
    {"id": "ret-61", "effective_date": "2032-07-01", "retirement_age": 61,
     "description": "يوليو 2032: سن المعاش 61 عامًا"},
    {"id": "ret-62", "effective_date": "2034-07-01", "retirement_age": 62,
     "description": "يوليو 2034: سن المعاش 62 عامًا"},
    {"id": "ret-63", "effective_date": "2036-07-01", "retirement_age": 63,
     "description": "يوليو 2036: سن المعاش 63 عامًا"},
    {"id": "ret-65", "effective_date": "2040-07-01", "retirement_age": 65,
     "description": "يوليو 2040: سن المعاش 65 عامًا"},
]


def parse_date_value(value: str) -> Optional[datetime]:
    if not value:
        return None
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def add_years(value: datetime, years: int) -> datetime:
    try:
        return value.replace(year=value.year + years)
    except ValueError:
        return value.replace(month=2, day=28, year=value.year + years)


def compute_retirement_info(birth_date: str, schedule: List[Dict[str, Any]]) -> Dict[str, Any]:
    birth = parse_date_value(birth_date)
    if not birth:
        return {"retirement_age": None, "retirement_date": "", "retirement_due": False,
                "retirement_label": "تاريخ الميلاد غير مكتمل"}
    sorted_schedule = sorted(schedule or DEFAULT_RETIREMENT_SCHEDULE,
                             key=lambda item: item.get("effective_date", "1900-01-01"), reverse=True)
    chosen = sorted_schedule[-1] if sorted_schedule else DEFAULT_RETIREMENT_SCHEDULE[0]
    for entry in sorted_schedule:
        effective_date = parse_date_value(entry.get("effective_date", ""))
        if not effective_date:
            continue
        candidate_date = add_years(birth, int(entry.get("retirement_age", 60)))
        if candidate_date >= effective_date:
            chosen = entry
            break
    retirement_age = int(chosen.get("retirement_age", 60))
    retirement_date = add_years(birth, retirement_age)
    due = retirement_date.date() <= datetime.now(timezone.utc).date()
    return {
        "retirement_age": retirement_age,
        "retirement_date": retirement_date.strftime("%Y-%m-%d"),
        "retirement_due": due,
        "retirement_label": "مستحق للخروج على المعاش" if due else f"سن المعاش {retirement_age} سنة",
    }

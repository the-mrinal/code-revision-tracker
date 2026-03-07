"""Supabase database queries for Revise."""

import os
import re
from datetime import date, datetime
from urllib.parse import urlparse, urlunparse

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

_client = None


def get_client():
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client


COLUMNS = (
    "id, user_id, url, title, platform, difficulty, self_rating, time_taken, "
    "notes, solved_at, easiness_factor, interval, repetitions, next_review, "
    "last_reviewed, attempts"
)


def insert_question(user_id: str, data: dict) -> dict:
    client = get_client()
    row = {**data, "user_id": user_id}
    result = client.table("questions").insert(row).execute()
    return result.data[0]


def get_all_questions(user_id: str) -> list[dict]:
    client = get_client()
    result = (
        client.table("questions")
        .select(COLUMNS)
        .eq("user_id", user_id)
        .order("solved_at", desc=True)
        .execute()
    )
    return result.data


def get_question(user_id: str, qid: int) -> dict | None:
    client = get_client()
    result = (
        client.table("questions")
        .select(COLUMNS)
        .eq("user_id", user_id)
        .eq("id", qid)
        .execute()
    )
    return result.data[0] if result.data else None


def update_question_sm2(user_id: str, qid: int, data: dict, set_reviewed: bool = False):
    client = get_client()
    update_data = {
        "easiness_factor": data["easiness_factor"],
        "interval": data["interval"],
        "repetitions": data["repetitions"],
        "next_review": data["next_review"],
    }
    if set_reviewed:
        update_data["last_reviewed"] = datetime.utcnow().isoformat()
    (
        client.table("questions")
        .update(update_data)
        .eq("user_id", user_id)
        .eq("id", qid)
        .execute()
    )


def get_revisions_due(user_id: str, target_date: str | None = None) -> list[dict]:
    target = target_date or date.today().isoformat()
    client = get_client()
    result = (
        client.table("questions")
        .select(COLUMNS)
        .eq("user_id", user_id)
        .lte("next_review", target)
        .order("next_review", desc=False)
        .execute()
    )
    return result.data


def update_question(user_id: str, qid: int, data: dict) -> dict | None:
    client = get_client()
    result = (
        client.table("questions")
        .update(data)
        .eq("user_id", user_id)
        .eq("id", qid)
        .execute()
    )
    return result.data[0] if result.data else None


def delete_question(user_id: str, qid: int) -> bool:
    client = get_client()
    result = (
        client.table("questions")
        .delete()
        .eq("user_id", user_id)
        .eq("id", qid)
        .execute()
    )
    return len(result.data) > 0


def get_today_activity(user_id: str) -> list[dict]:
    today = date.today().isoformat()
    client = get_client()
    # Fetch rows where solved_at or last_reviewed is today
    result = (
        client.table("questions")
        .select(COLUMNS)
        .eq("user_id", user_id)
        .or_(f"solved_at.gte.{today}T00:00:00,last_reviewed.gte.{today}T00:00:00")
        .execute()
    )
    # Compute activity_type in Python
    rows = []
    for r in result.data:
        solved_date = (r.get("solved_at") or "")[:10]
        activity_type = "NEW" if solved_date == today else "REVISION"
        rows.append({**r, "activity_type": activity_type})
    # Sort: most recent activity first
    rows.sort(
        key=lambda r: r.get("last_reviewed") or r.get("solved_at") or "",
        reverse=True,
    )
    return rows


def find_by_url(user_id: str, url: str) -> dict | None:
    client = get_client()
    result = (
        client.table("questions")
        .select(COLUMNS)
        .eq("user_id", user_id)
        .eq("url", url)
        .execute()
    )
    return result.data[0] if result.data else None


def increment_attempts(user_id: str, qid: int, title: str | None = None) -> dict:
    # Fetch current, increment, update
    question = get_question(user_id, qid)
    if not question:
        raise ValueError(f"Question {qid} not found")
    update_data = {"attempts": (question.get("attempts") or 1) + 1}
    if title:
        update_data["title"] = title
    return update_question(user_id, qid, update_data)


def _normalize_url(url: str) -> str:
    """Normalize URL for dedup: strip query params, fragments, sub-paths."""
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    m = re.match(r"(/problems/[^/]+)", path)
    if m and "leetcode.com" in parsed.netloc:
        path = m.group(1)
    return urlunparse((parsed.scheme, parsed.netloc, path + "/", "", "", ""))


def merge_duplicates(user_id: str):
    """Consolidate duplicate URL entries for a user."""
    all_rows = get_all_questions(user_id)
    # Group by normalized URL
    by_url: dict[str, list[dict]] = {}
    for row in all_rows:
        key = _normalize_url(row["url"])
        by_url.setdefault(key, []).append(row)

    client = get_client()
    for url, rows in by_url.items():
        if len(rows) < 2:
            continue
        # Keep the row with highest repetitions
        rows.sort(key=lambda r: (r.get("repetitions") or 0, r.get("solved_at") or ""), reverse=True)
        keep = rows[0]
        others = rows[1:]

        total_time = sum(r.get("time_taken") or 0 for r in rows)
        most_recent = max(rows, key=lambda r: r.get("solved_at") or "")

        update_data = {
            "url": url,  # normalized URL
            "attempts": len(rows),
            "time_taken": total_time if total_time > 0 else None,
            "title": most_recent.get("title"),
            "difficulty": most_recent.get("difficulty"),
            "self_rating": most_recent.get("self_rating"),
            "notes": most_recent.get("notes"),
        }
        client.table("questions").update(update_data).eq("id", keep["id"]).execute()
        for other in others:
            client.table("questions").delete().eq("id", other["id"]).execute()


def get_user_platforms(user_id: str) -> list[dict]:
    client = get_client()
    result = (
        client.table("user_platforms")
        .select("id, user_id, name, url_pattern, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data


def insert_user_platform(user_id: str, data: dict) -> dict:
    client = get_client()
    row = {"user_id": user_id, "name": data["name"], "url_pattern": data["url_pattern"]}
    result = client.table("user_platforms").insert(row).execute()
    return result.data[0]


def delete_user_platform(user_id: str, platform_id: int) -> bool:
    client = get_client()
    result = (
        client.table("user_platforms")
        .delete()
        .eq("user_id", user_id)
        .eq("id", platform_id)
        .execute()
    )
    return len(result.data) > 0


def get_stats(user_id: str) -> dict:
    all_rows = get_all_questions(user_id)
    total = len(all_rows)

    by_difficulty: dict[str, int] = {}
    by_platform: dict[str, int] = {}
    ratings = []
    due_today = 0
    today = date.today().isoformat()

    for r in all_rows:
        diff = r.get("difficulty") or "unknown"
        by_difficulty[diff] = by_difficulty.get(diff, 0) + 1

        plat = r.get("platform") or "unknown"
        by_platform[plat] = by_platform.get(plat, 0) + 1

        if r.get("self_rating"):
            ratings.append(r["self_rating"])

        if r.get("next_review") and r["next_review"] <= today:
            due_today += 1

    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0

    return {
        "total": total,
        "by_difficulty": by_difficulty,
        "by_platform": by_platform,
        "due_today": due_today,
        "avg_rating": avg_rating,
    }

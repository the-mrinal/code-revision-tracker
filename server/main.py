"""FastAPI server for Code Revision Tracker."""

import re
from datetime import date
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from database import (
    delete_question,
    get_all_questions,
    get_question,
    get_revisions_due,
    get_stats,
    insert_question,
    update_question,
    update_question_sm2,
)
from sm2 import sm2

app = FastAPI(title="Code Revision Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PLATFORM_PATTERNS = {
    "leetcode": r"leetcode\.com",
    "codechef": r"codechef\.com",
    "hackerrank": r"hackerrank\.com",
    "codeforces": r"codeforces\.com",
    "geeksforgeeks": r"geeksforgeeks\.org",
    "interviewbit": r"interviewbit\.com",
    "atcoder": r"atcoder\.jp",
    "neetcode": r"neetcode\.io",
    "algomonster": r"algo\.monster",
    "designgurus": r"designgurus\.io",
}


def detect_platform(url: str) -> str:
    for platform, pattern in PLATFORM_PATTERNS.items():
        if re.search(pattern, url, re.IGNORECASE):
            return platform
    return "other"


class QuestionIn(BaseModel):
    url: str
    title: Optional[str] = None
    difficulty: Optional[str] = None
    self_rating: int = Field(ge=1, le=5)
    time_taken: Optional[int] = None
    notes: Optional[str] = None


class QuestionUpdate(BaseModel):
    url: Optional[str] = None
    title: Optional[str] = None
    difficulty: Optional[str] = None
    self_rating: Optional[int] = Field(default=None, ge=1, le=5)
    time_taken: Optional[int] = None
    notes: Optional[str] = None


class ReviewIn(BaseModel):
    self_rating: int = Field(ge=1, le=5)


# --- API Endpoints ---


@app.post("/api/questions")
async def create_question(q: QuestionIn):
    platform = detect_platform(q.url)
    sm2_result = sm2(q.self_rating, 2.5, 1, 0)
    data = {
        "url": q.url,
        "title": q.title,
        "platform": platform,
        "difficulty": q.difficulty,
        "self_rating": q.self_rating,
        "time_taken": q.time_taken,
        "notes": q.notes,
        "next_review": sm2_result["next_review"],
    }
    question = await insert_question(data)
    # Apply SM-2 fields
    await update_question_sm2(question["id"], sm2_result)
    updated = await get_question(question["id"])
    return updated


@app.get("/api/questions")
async def list_questions():
    return await get_all_questions()


@app.get("/api/revisions/today")
async def revisions_today():
    return await get_revisions_due(date.today().isoformat())


@app.post("/api/questions/{qid}/review")
async def review_question(qid: int, review: ReviewIn):
    question = await get_question(qid)
    if not question:
        raise HTTPException(404, "Question not found")
    result = sm2(
        review.self_rating,
        question["easiness_factor"],
        question["interval"],
        question["repetitions"],
    )
    await update_question_sm2(qid, result)
    return await get_question(qid)


@app.put("/api/questions/{qid}")
async def edit_question(qid: int, q: QuestionUpdate):
    existing = await get_question(qid)
    if not existing:
        raise HTTPException(404, "Question not found")
    updates = {}
    for field in ["url", "title", "difficulty", "self_rating", "time_taken", "notes"]:
        val = getattr(q, field)
        if val is not None:
            updates[field] = val
    if "url" in updates:
        updates["platform"] = detect_platform(updates["url"])
    if not updates:
        raise HTTPException(400, "No fields to update")
    return await update_question(qid, updates)


@app.get("/api/stats")
async def stats():
    return await get_stats()


@app.delete("/api/questions/{qid}")
async def remove_question(qid: int):
    deleted = await delete_question(qid)
    if not deleted:
        raise HTTPException(404, "Question not found")
    return {"ok": True}


# --- Dashboard ---


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    with open("templates/dashboard.html") as f:
        return f.read()

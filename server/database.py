"""SQLite database setup and queries."""

import aiosqlite
import os
from datetime import date

DB_PATH = os.environ.get("DB_PATH", "data/revisions.db")

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    platform TEXT,
    difficulty TEXT,
    self_rating INTEGER,
    time_taken INTEGER,
    notes TEXT,
    solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    easiness_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review DATE
);
"""


async def get_db() -> aiosqlite.Connection:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute(CREATE_TABLE)
    await db.commit()
    return db


async def insert_question(data: dict) -> dict:
    db = await get_db()
    try:
        cursor = await db.execute(
            """INSERT INTO questions (url, title, platform, difficulty, self_rating, time_taken, notes, next_review)
               VALUES (:url, :title, :platform, :difficulty, :self_rating, :time_taken, :notes, :next_review)""",
            data,
        )
        await db.commit()
        row = await (await db.execute("SELECT * FROM questions WHERE id = ?", (cursor.lastrowid,))).fetchone()
        return dict(row)
    finally:
        await db.close()


async def get_all_questions() -> list[dict]:
    db = await get_db()
    try:
        rows = await (await db.execute("SELECT * FROM questions ORDER BY solved_at DESC")).fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_question(qid: int) -> dict | None:
    db = await get_db()
    try:
        row = await (await db.execute("SELECT * FROM questions WHERE id = ?", (qid,))).fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def update_question_sm2(qid: int, data: dict):
    db = await get_db()
    try:
        await db.execute(
            """UPDATE questions
               SET easiness_factor = :easiness_factor,
                   interval = :interval,
                   repetitions = :repetitions,
                   next_review = :next_review
               WHERE id = :id""",
            {**data, "id": qid},
        )
        await db.commit()
    finally:
        await db.close()


async def get_revisions_due(target_date: str | None = None) -> list[dict]:
    target = target_date or date.today().isoformat()
    db = await get_db()
    try:
        rows = await (
            await db.execute(
                "SELECT * FROM questions WHERE next_review <= ? ORDER BY next_review ASC", (target,)
            )
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def update_question(qid: int, data: dict) -> dict | None:
    db = await get_db()
    try:
        sets = ", ".join(f"{k} = :{k}" for k in data)
        await db.execute(f"UPDATE questions SET {sets} WHERE id = :id", {**data, "id": qid})
        await db.commit()
        row = await (await db.execute("SELECT * FROM questions WHERE id = ?", (qid,))).fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def delete_question(qid: int) -> bool:
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM questions WHERE id = ?", (qid,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def get_stats() -> dict:
    db = await get_db()
    try:
        total = (await (await db.execute("SELECT COUNT(*) FROM questions")).fetchone())[0]

        by_difficulty = {}
        rows = await (await db.execute("SELECT difficulty, COUNT(*) as cnt FROM questions GROUP BY difficulty")).fetchall()
        for r in rows:
            by_difficulty[r["difficulty"] or "unknown"] = r["cnt"]

        by_platform = {}
        rows = await (await db.execute("SELECT platform, COUNT(*) as cnt FROM questions GROUP BY platform")).fetchall()
        for r in rows:
            by_platform[r["platform"] or "unknown"] = r["cnt"]

        due_today = (
            await (
                await db.execute("SELECT COUNT(*) FROM questions WHERE next_review <= ?", (date.today().isoformat(),))
            ).fetchone()
        )[0]

        avg_rating = (await (await db.execute("SELECT AVG(self_rating) FROM questions")).fetchone())[0]

        return {
            "total": total,
            "by_difficulty": by_difficulty,
            "by_platform": by_platform,
            "due_today": due_today,
            "avg_rating": round(avg_rating, 1) if avg_rating else 0,
        }
    finally:
        await db.close()

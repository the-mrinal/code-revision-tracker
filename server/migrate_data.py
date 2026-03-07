"""One-time migration: SQLite → Supabase.

Usage: docker compose exec server python migrate_data.py
"""

import os
import sqlite3

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

DB_PATH = os.environ.get("DB_PATH", "data/revisions.db")
DEFAULT_EMAIL = "dmrinal626@gmail.com"


def main():
    # Connect to Supabase with service role key (admin access)
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # Look up or create user
    print(f"Looking up user: {DEFAULT_EMAIL}")
    users = client.auth.admin.list_users()
    user = None
    for u in users:
        if u.email == DEFAULT_EMAIL:
            user = u
            break

    if user is None:
        print(f"Creating user: {DEFAULT_EMAIL}")
        user = client.auth.admin.create_user(
            {"email": DEFAULT_EMAIL, "email_confirm": True}
        )

    user_id = user.id
    print(f"User ID: {user_id}")

    # Read all rows from SQLite
    if not os.path.exists(DB_PATH):
        print(f"SQLite database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.execute("SELECT * FROM questions ORDER BY id")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    print(f"Found {len(rows)} rows in SQLite")

    # Insert each row into Supabase
    for row in rows:
        # Remove SQLite id (Supabase generates its own)
        row.pop("id", None)
        row["user_id"] = user_id

        # Convert None values for consistency
        for key in row:
            if row[key] == "":
                row[key] = None

        try:
            client.table("questions").insert(row).execute()
            print(f"  Inserted: {row.get('title') or row.get('url')}")
        except Exception as e:
            print(f"  FAILED: {row.get('title') or row.get('url')} — {e}")

    print(f"\nMigration complete! {len(rows)} rows migrated for {DEFAULT_EMAIL}")


if __name__ == "__main__":
    main()

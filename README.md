# Code Revision Tracker

A browser extension + server to track coding practice across LeetCode, CodeChef, HackerRank, Codeforces, and more. Uses the **SM-2 spaced repetition algorithm** to intelligently schedule which problems you should revisit.

Stop forgetting solutions. Start retaining patterns.

## Features

- **Browser Extension** (Chrome & Safari) — built-in timer, one-click capture of the current problem URL
- **Auto-detect platform** — LeetCode, CodeChef, HackerRank, Codeforces, GeeksForGeeks, InterviewBit, AtCoder, NeetCode, AlgoMonster, DesignGurus
- **Self-rating system** — rate how well you solved each problem (1-5 stars)
- **SM-2 spaced repetition** — scientifically-backed algorithm schedules your revision
- **Magic link auth** — passwordless login via email (Supabase Auth)
- **Per-user data isolation** — each user sees only their own questions (Row Level Security)
- **Dashboard** — filterable table, stats, charts, inline editing, CSV export
- **Cloud-hosted** — Supabase Postgres database, deployable anywhere

## Architecture

```
Browser Extension (popup UI)
        ↓ REST API (revise.mrinal.dev)
Python FastAPI Server → Supabase (Postgres + Auth)
        ↓
Dashboard UI (revise.mrinal.dev/dashboard)
```

## Quick Start

### 1. Supabase Setup

Create a Supabase project and run the table creation SQL in the SQL Editor:

```sql
create table public.questions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  platform text,
  difficulty text,
  self_rating integer check (self_rating between 1 and 5),
  time_taken integer,
  notes text,
  solved_at timestamptz default now(),
  easiness_factor double precision default 2.5,
  interval integer default 1,
  repetitions integer default 0,
  next_review date,
  last_reviewed timestamptz,
  attempts integer default 1
);

alter table public.questions enable row level security;

create policy "Users see own questions" on public.questions for select using (auth.uid() = user_id);
create policy "Users insert own questions" on public.questions for insert with check (auth.uid() = user_id);
create policy "Users update own questions" on public.questions for update using (auth.uid() = user_id);
create policy "Users delete own questions" on public.questions for delete using (auth.uid() = user_id);

create index idx_questions_user_url on public.questions(user_id, url);
create index idx_questions_next_review on public.questions(user_id, next_review);
```

Configure Auth redirect URLs in Supabase Dashboard:
- **Site URL**: `https://your-domain.com/dashboard`
- **Redirect URL**: `https://your-domain.com/api/auth/callback`

### 2. Configure environment

Create a `.env` file:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
```

### 3. Start the server

```bash
docker compose up -d
```

### 4. Install the Chrome extension

1. Download [`extension.zip`](https://github.com/the-mrinal/code-revision-tracker/raw/main/extension.zip)
2. Unzip the downloaded file
3. Go to `chrome://extensions` in Chrome
4. Enable **Developer mode** (top right toggle)
5. Click **Load unpacked** → select the unzipped folder
6. Pin the extension from the puzzle icon in the toolbar

**Safari:** Available on request — contact dmrinal626@gmail.com for a build.

### 5. Use it

1. Open the extension popup or dashboard
2. Enter your email and click "Send Magic Link"
3. Click the link in your email to authenticate
4. Navigate to a coding problem (e.g. LeetCode Two Sum)
5. Click the extension icon → Start Timer → solve the problem → Stop → rate and save
6. Visit the dashboard to see tracked problems and revision schedule

## API Endpoints

All endpoints except auth require a `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/magic-link` | Send magic link email |
| `GET` | `/api/auth/callback` | Exchange magic link token for session |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/questions` | Save a new question |
| `GET` | `/api/questions` | List all questions |
| `PUT` | `/api/questions/{id}` | Edit a question |
| `DELETE` | `/api/questions/{id}` | Delete a question |
| `POST` | `/api/questions/{id}/review` | Submit a review rating |
| `GET` | `/api/revisions/today` | Get questions due for revision today |
| `GET` | `/api/activity/today` | Today's new + revised questions |
| `GET` | `/api/stats` | Summary statistics |

## Supported Platforms

| Platform | Auto-detected |
|----------|:---:|
| LeetCode | Yes |
| CodeChef | Yes |
| HackerRank | Yes |
| Codeforces | Yes |
| GeeksForGeeks | Yes |
| InterviewBit | Yes |
| AtCoder | Yes |
| NeetCode | Yes |
| AlgoMonster | Yes |
| DesignGurus.io | Yes |

Any other URL is tagged as "other".

## SM-2 Algorithm

The spaced repetition schedule is based on the [SM-2 algorithm](https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm):

- **Rating 1-2**: Reset interval (review again soon)
- **Rating 3**: Hard recall — short interval
- **Rating 4**: Good recall — moderate interval
- **Rating 5**: Easy recall — long interval

The easiness factor adjusts over time, making well-known problems appear less frequently and difficult ones more often.

## Tech Stack

- **Backend**: Python, FastAPI
- **Database**: Supabase (Postgres + Row Level Security)
- **Auth**: Supabase Auth (magic link / passwordless)
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Extension**: Manifest V3 (Chrome & Safari compatible)
- **Deployment**: Docker Compose

## License

MIT

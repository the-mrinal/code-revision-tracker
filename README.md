# Code Revision Tracker

A browser extension + local server to track coding practice across LeetCode, CodeChef, HackerRank, Codeforces, and more. Uses the **SM-2 spaced repetition algorithm** to intelligently schedule which problems you should revisit.

Stop forgetting solutions. Start retaining patterns.

## Features

- **Browser Extension** (Chrome & Safari) — one-click capture of the current problem URL
- **Auto-detect platform** — LeetCode, CodeChef, HackerRank, Codeforces, GeeksForGeeks, InterviewBit, AtCoder, NeetCode, AlgoMonster, DesignGurus
- **Self-rating system** — rate how well you solved each problem (1-5 stars)
- **SM-2 spaced repetition** — scientifically-backed algorithm schedules your revision
- **Dashboard** — filterable table, stats, charts, inline editing, CSV export
- **Lightweight** — SQLite database, runs locally, no cloud dependency

## Architecture

```
Browser Extension (popup UI)
        ↓ REST API (localhost:8765)
Python FastAPI Server → SQLite Database
        ↓
Dashboard UI (localhost:8765/dashboard)
```

## Quick Start

### 1. Start the server

```bash
docker compose up -d
```

Server runs at `http://localhost:8765`. Dashboard at `http://localhost:8765/dashboard`.

### 2. Load the browser extension

**Chrome:**
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` folder

**Safari:**
1. Convert to Safari extension:
   ```bash
   xcrun safari-web-extension-converter extension/
   ```
2. Build & Run in Xcode (Cmd+R)
3. Safari → Settings → Advanced → check "Show features for web developers"
4. Develop → Allow Unsigned Extensions
5. Safari → Settings → Extensions → enable Code Revision Tracker

### 3. Use it

1. Navigate to a coding problem (e.g. LeetCode Two Sum)
2. Click the extension icon
3. Fill in difficulty, time taken, self-rating, and notes
4. Click "Save Question"
5. Visit the dashboard to see tracked problems and revision schedule

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/questions` | Save a new question |
| `GET` | `/api/questions` | List all questions |
| `PUT` | `/api/questions/{id}` | Edit a question |
| `DELETE` | `/api/questions/{id}` | Delete a question |
| `POST` | `/api/questions/{id}/review` | Submit a review rating |
| `GET` | `/api/revisions/today` | Get questions due for revision today |
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

## Development (without Docker)

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --port 8765 --reload
```

## Tech Stack

- **Backend**: Python, FastAPI, SQLite (aiosqlite)
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks)
- **Extension**: Manifest V3 (Chrome & Safari compatible)
- **Deployment**: Docker Compose

## License

MIT

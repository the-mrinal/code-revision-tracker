---
date: 2026-03-07T00:00:00+05:30
researcher: mrinal
git_commit: 4e5819ec2de6b73dc216eb845e1effa7e72a766d
branch: main
repository: idea1
topic: "Making the revision tracker generic and extensible beyond coding problems"
tags: [research, codebase, extensibility, platform-detection, data-model, architecture]
status: complete
last_updated: 2026-03-07
last_updated_by: mrinal
---

# Research: Making the Revision Tracker Generic and Extensible

**Date**: 2026-03-07
**Researcher**: mrinal
**Git Commit**: 4e5819ec2de6b73dc216eb845e1effa7e72a766d
**Branch**: main
**Repository**: idea1

## Research Question
How can the Code Revision Tracker be made generic to support any type of learning content (math, system design, organic chemistry, etc.) instead of being limited to coding problems? How can we allow users to add their own websites?

## Summary

The codebase is a **browser extension + web dashboard** that tracks coding problems using SM-2 spaced repetition. The core architecture is surprisingly close to being generic — the SM-2 algorithm, URL deduplication, timer, and auth system have zero domain coupling. The tight coupling to "coding" lives in three layers: (1) the hardcoded `PLATFORM_PATTERNS` dict in `main.py`, (2) the fixed `easy/medium/hard` difficulty taxonomy, and (3) UI copy throughout. The extension already works on **any website** — it just grabs the current tab's URL. Platform classification is purely server-side regex matching.

## Detailed Findings

### 1. Current Platform Detection System
**File**: `server/main.py:42-60`

Platform detection is a single Python dict of 10 regex patterns, all for coding/interview platforms:
```python
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
```

The `detect_platform()` function (line 56-60) loops through this dict and returns `"other"` for unmatched URLs. This is called on question create and update.

### 2. Extension Architecture — Already Site-Agnostic
**Files**: `extension/manifest.json`, `extension/popup.js`

The extension has **no content scripts** and **no URL match patterns**. It uses `chrome.tabs.query({ active: true, currentWindow: true })` to grab whatever tab the user is on. The only `host_permissions` entry is the backend API URL (`https://revise.mrinal.dev/*`). This means the extension already works on any website — it just sends the URL to the server for classification.

### 3. Data Model — Mostly Generic
**Files**: `server/database.py`, `server/main.py`

Single `questions` table with columns:
- Generic: `id`, `user_id`, `url`, `title`, `notes`, `time_taken`, `attempts`
- SM-2 state (generic): `easiness_factor`, `interval`, `repetitions`, `next_review`, `last_reviewed`
- Domain-coupled: `platform` (auto-detected string), `difficulty` (easy/medium/hard), `self_rating` (1-5), `solved_at`

No tags table, no topics table, no categories table. Classification is flat (platform + difficulty only).

### 4. SM-2 Algorithm — Fully Generic
**File**: `server/sm2.py`

The SM-2 implementation is completely domain-agnostic. It takes `(self_rating, easiness_factor, interval, repetitions)` and returns scheduling parameters. Zero coupling to coding, problems, or any domain concept.

### 5. Dashboard — Tightly Coupled to Coding
**File**: `server/templates/dashboard.html`

- Title: "Code Revision Tracker"
- Subtitle: "Spaced repetition for coding problems"
- Stats cards: "Total Solved", "Due Today", "Avg Rating", "Platforms"
- Charts: "By Difficulty" (easy/medium/hard), "By Platform" (hardcoded coding platforms)
- Table columns: Title, Platform, Difficulty, Rating, Attempts, Time, Solved, Next Review
- Filter dropdowns: hardcoded Easy/Medium/Hard difficulty options
- CSS classes: `tag-easy`, `tag-medium`, `tag-hard` with green/yellow/red colors

### 6. Landing Page — Coding-Specific Marketing Copy
**File**: `server/templates/landing.html`

- Hero: "Never Forget a Coding Solution Again"
- All use cases described in competitive programming / interview terms
- Platform logos/names all reference coding websites

### 7. Extension Popup — Coding-Specific Labels
**File**: `extension/popup.html`

- Difficulty dropdown: Easy/Medium/Hard (hardcoded)
- Notes placeholder: "Key insights, patterns used..." (algorithm-specific)
- Title: "Code Revision Tracker"

## What Is Already Generic vs. What Needs Change

### Already Generic (no changes needed)
| Component | Why |
|---|---|
| SM-2 algorithm (`sm2.py`) | Pure math, zero domain knowledge |
| Auth system (`auth.py`) | Supabase magic link, domain-agnostic |
| URL deduplication (`database.py`) | Works for any URL |
| Timer system (`popup.js`) | Domain-agnostic |
| Extension URL capture (`popup.js`) | Already grabs any tab's URL |
| CSV export (`dashboard.html`) | Exports whatever data exists |
| Row Level Security | Standard user isolation |

### Needs Changes to Generalize
| Component | Current State | What's Coupled |
|---|---|---|
| `PLATFORM_PATTERNS` in `main.py` | Hardcoded 10 coding sites | Static server-side dict |
| `difficulty` field | `easy/medium/hard` only | LeetCode vocabulary baked into UI |
| `solved_at` field name | Implies "solving" a problem | Naming convention |
| All UI copy | "Code Revision Tracker", "coding problems", etc. | Text strings |
| Dashboard charts | "By Difficulty" and "By Platform" | Assumes these two dimensions |
| Platform filter dropdown | Dynamically populated from data but only coding platforms exist | Data-driven but source is limited |

## Architecture for User-Configurable Websites

The current architecture makes this surprisingly feasible because:

1. **The extension is already site-agnostic** — no content scripts, no URL matching. It works on any tab.
2. **Platform detection is centralized** in one function (`detect_platform()`) in one file (`main.py`).
3. **The `platform` field is a free-text string** in the database, not a foreign key to a platforms table. Any string value works.

To enable user-added websites, the system would need:
- A `user_platforms` table or similar to store user-defined URL patterns and labels
- The `detect_platform()` function to check user patterns in addition to (or instead of) the global `PLATFORM_PATTERNS`
- UI in the dashboard for managing custom platforms
- The concept of "categories" or "domains" above platforms (e.g., "Coding", "Math", "Design")

## Code References
- `server/main.py:42-53` — `PLATFORM_PATTERNS` dict (the single source of platform definitions)
- `server/main.py:56-60` — `detect_platform()` function
- `server/main.py:141` — Platform detection on question creation
- `server/main.py:195` — Platform detection on question update
- `server/database.py` — All database queries (COLUMNS list defines the schema)
- `server/sm2.py` — SM-2 algorithm (fully generic)
- `server/templates/dashboard.html:131` — "Spaced repetition for coding problems" subtitle
- `server/templates/dashboard.html:172-176` — Hardcoded difficulty dropdown
- `server/templates/dashboard.html:414` — Stats cards rendering
- `server/templates/landing.html` — Coding-specific landing page copy
- `extension/popup.html` — Extension popup with hardcoded difficulty options
- `extension/popup.js:156` — Tab URL capture (already generic)
- `extension/manifest.json` — No content_scripts, no URL patterns
- `extension/background.js` — Badge counter polling (generic)

## Open Questions
1. Should the difficulty taxonomy be user-configurable per category, or should we use a universal scale (e.g., 1-5 difficulty)?
2. Should "platform" and "category/domain" be separate concepts? (e.g., platform=Khan Academy, category=Math)
3. Should there be a community/shared platform registry, or purely per-user configuration?
4. How should the dashboard adapt its visualizations when the user has mixed content types?
5. Should the extension popup change its labels/fields based on the detected platform category?

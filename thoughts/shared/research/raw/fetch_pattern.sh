#!/bin/bash
# Usage: ./fetch_pattern.sh <pattern_name>
# Example: ./fetch_pattern.sh "Two Pointers"
# Fetches all problems for a pattern category and saves raw JSON to raw/<number>.json

PATTERN_NAME="$1"
RAW_DIR="$(dirname "$0")"
VENV="/Users/mrinalchandra/Documents/data-dashbaord/.venv/bin/activate"
SCRAPER="/Users/mrinalchandra/Documents/data-dashbaord/scripts/fetch_leetcode_question.py"
PATTERNS_PY="/Users/mrinalchandra/Documents/idea1/server/patterns.py"

if [ -z "$PATTERN_NAME" ]; then
    echo "Usage: $0 <pattern_name>"
    exit 1
fi

source "$VENV"

# Extract problem numbers and slugs for this pattern using Python
python3 -c "
import sys, json
sys.path.insert(0, '$(dirname "$PATTERNS_PY")')
from patterns import PATTERNS, PROBLEM_SLUGS

cat = '$PATTERN_NAME'
if cat not in PATTERNS:
    print(f'ERROR: Pattern \"{cat}\" not found', file=sys.stderr)
    sys.exit(1)

seen = set()
for sub, nums in PATTERNS[cat].items():
    for n in nums:
        if n not in seen:
            seen.add(n)
            slug = PROBLEM_SLUGS.get(n, '')
            if slug:
                print(f'{n} {slug}')
            else:
                print(f'WARN: No slug for problem {n}', file=sys.stderr)
" | while read -r NUM SLUG; do
    OUTFILE="$RAW_DIR/$NUM.json"
    if [ -f "$OUTFILE" ]; then
        echo "SKIP $NUM ($SLUG) — already exists"
        continue
    fi
    echo "FETCH $NUM ($SLUG)..."
    RESULT=$(python "$SCRAPER" "https://leetcode.com/problems/$SLUG/" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$RESULT" ]; then
        echo "$RESULT" > "$OUTFILE"
        echo "  SAVED → $OUTFILE"
    else
        echo "  FAILED $NUM"
    fi
    sleep 3
done

echo "DONE: $PATTERN_NAME"

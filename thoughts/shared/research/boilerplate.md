# DSA Pattern Research Document — Boilerplate & Process

## How the Backtracking Research Doc Was Constructed

This documents the exact steps, structure, and methodology so any future pattern category can be researched identically.

---

## Step 1: Identify the Pattern Category & Sub-Patterns

Source: `server/patterns.py` — the `PATTERNS` dict.

Each category has:
- **Category name** (e.g., "Backtracking")
- **Sub-patterns** (e.g., "Subsets", "Permutations", ...)
- **Problem numbers** per sub-pattern (LeetCode IDs)

Extract from patterns.py:
```python
"Backtracking": {
    "Subsets": [17, 77, 78, 90],
    "Permutations": [31, 46, 60],
    ...
}
```

## Step 2: Fetch LeetCode Questions via Scraper

**CRITICAL**: Stagger calls — one at a time with `sleep 3` between each.

```bash
source /Users/mrinalchandra/Documents/data-dashbaord/.venv/bin/activate && \
python /Users/mrinalchandra/Documents/data-dashbaord/scripts/fetch_leetcode_question.py <url>
```

For each sub-pattern, fetch:
1. The **primary/classic** question first (the one that defines the pattern)
2. Then the **secondary** questions (variations, harder versions)

**Order within each sub-pattern** (fetch the defining question first):
- Subsets: 78 (Subsets) → 90 (Subsets II) → 77 (Combinations) → 17 (Letter Combinations)
- Permutations: 46 (Permutations) → 31 (Next Permutation) → 60 (Permutation Sequence)
- Pick the most "textbook" question as primary

**Output JSON fields used**: title, difficulty, description, examples, constraints

### Saving Raw Responses

All raw scraper JSON responses are saved to:
```
thoughts/shared/research/raw/<problem-number>.json
```

- One file per problem number (e.g., `raw/20.json`, `raw/739.json`)
- Saved BEFORE writing the research doc — fetch all, save raw, then compose
- If a file already exists, skip fetching (avoids redundant calls)
- Premium/inaccessible problems will have empty fields — still save the response

## Step 3: Write the Research Document

### File naming
```
thoughts/shared/research/YYYY-MM-DD-<category>-patterns-deep-dive.md
```

### Frontmatter
```yaml
---
date: YYYY-MM-DDT00:00:00+05:30
researcher: claude
git_commit: <current HEAD>
branch: main
repository: idea1
topic: "<Category> Patterns Deep Dive — All N Sub-Patterns with Question Analysis"
tags: [research, codebase, <category-lowercase>, dsa-patterns, leetcode]
status: complete
last_updated: YYYY-MM-DD
last_updated_by: claude
---
```

### Document Structure per Sub-Pattern

Each sub-pattern section follows this exact template:

```markdown
## N. <Sub-Pattern Name> Pattern

![<Sub-Pattern> Diagram](diagrams/<n>-<name>.svg)

**Problems**: <num> (<title>), <num> (<title>), ...

### What is it?
- Real-world analogy (packing a bag, maze, vending machine, etc.)
- Concrete example with small input walked through manually
- Show the input → all valid outputs mapping

### The Decision Tree (Visualized)
- ASCII art showing the recursion tree for a small example
- Label each node with the current state
- Show which branches are explored vs pruned

### Core Template (with walkthrough)
- Pseudocode template (not language-specific)
- Line-by-line comments explaining WHY each line exists
- Immediately after: a step-by-step trace through the example

### How to Recognize This Pattern
- 4-5 bullet points of trigger phrases from problem statements
- What makes this DIFFERENT from similar patterns
- "Look for: ..." summary

### Key Insight / Trick
- The ONE thing that makes this pattern click
- For example: "start index" for Subsets, "used set" for Permutations
- Why it works (not just what it is)

### Variations & Edge Cases
- How duplicates are handled (if applicable)
- Optimization tricks (sorting, early termination)
- When this pattern transitions to DP instead

### Questions Detail
| # | Title | Difficulty | Key Twist |
|---|-------|-----------|-----------|

Each row gets 2-3 sentences explaining what makes THIS question
different from the base pattern. Not just "Medium, backtracking"
but the specific twist: "unlimited reuse vs single use",
"Trie optimization for multiple words", etc.
```

### Comparison Table at the End

After all sub-patterns, add a comparison table showing how they differ:

```markdown
| Aspect | SubPat1 | SubPat2 | SubPat3 | ... |
|--------|---------|---------|---------|-----|
| Loop start | ... | ... | ... | ... |
| Reuse allowed | ... | ... | ... | ... |
| Pruning condition | ... | ... | ... | ... |
| Result count | ... | ... | ... | ... |
```

## Step 4: Create SVG Diagrams

### File naming
```
thoughts/shared/research/diagrams/<prefix>-<n>-<descriptive-name>.svg
```

**Category prefixes** (to avoid filename collisions):
| Category | Prefix |
|----------|--------|
| Backtracking | `bt-` |
| Binary Search | `bs-` |
| Bit Manipulation | `bit-` |
| Greedy | `greedy-` |
| Heap (Priority Queue) | `heap-` |
| Linked List | `ll-` |
| Sliding Window | `sw-` |
| Stack | `stk-` |
| Tree Traversal | `tt-` |
| Two Pointers | `tp-` |
| Array/Matrix | `am-` |
| String Manipulation | `sm-` |
| Dynamic Programming | `dp-` |
| Graph Traversal | `gt-` |
| Design | `des-` |

### Design specs
- **Dark theme**: background `#0a0a0a`, cards `#111`, borders `#222`
- **Color palette** (matches dashboard CSS variables):
  - Accent/primary: `#5b6abf` (blue-purple)
  - Success/found: `#34d399` (green)
  - Warning/active: `#fbbf24` (yellow)
  - Error/pruned: `#f87171` (red)
  - Secondary: `#a78bfa` (purple)
  - Each pattern category can have its own accent color
- **Font**: `SF Mono, Menlo, monospace`
- **ViewBox**: `0 0 900 <height>` (900 wide, height varies 480-520)
- **Rounded corners**: `rx="6"` for nodes, `rx="8"` for info boxes, `rx="12"` for outer

### What each diagram should show
1. **Decision/recursion tree** — the core visual for tree-based patterns
2. **Color coding** — green for valid/found, red for pruned, yellow for in-progress
3. **State labels** — what data is at each node (current path, remaining target, etc.)
4. **Legend box** — explain the colors and symbols
5. **Comparison or summary box** — key takeaway at the bottom

### Diagram types per pattern style
- **Tree patterns** (Subsets, Permutations, Combo Sum, Palindrome): Decision tree
- **Grid patterns** (Word Search, N-Queens): Board visualization with path/placement
- **String patterns** (Parentheses): Binary choice tree with constraint labels
- **Constraint patterns** (N-Queens, Sudoku): Board + constraint set explanation

### Embedding in markdown
```markdown
![Description](diagrams/<filename>.svg)
```

### Embedding in HTML dashboard
```html
<img src="/static/diagrams/<filename>.svg" alt="Description" style="width:100%;border-radius:8px;"/>
```
Or inline the SVG directly for interactivity.

## Step 5: Link Diagrams in Research Doc

Add the `![](diagrams/...)` line right after the `## N. Sub-Pattern` heading, before the **Problems** line.

## Step 6: Code References

Always end with:
```markdown
## Code References
- `server/patterns.py:<lines>` — Category definition
- `server/patterns.py:362-367` — Reverse lookup
- `server/main.py:307-369` — API endpoint
- `extension/patterns.js:<lines>` — Client-side labels
```

---

## Checklist for New Pattern Category

- [ ] Read `server/patterns.py` for category definition + problem numbers
- [ ] List all sub-patterns and their problem IDs
- [ ] Fetch ALL questions via scraper (staggered, one at a time, sleep 3)
- [ ] Write section for each sub-pattern using template above
- [ ] Ensure each section has: analogy, decision tree, template, recognition tips, question table
- [ ] Create SVG diagram for each sub-pattern (dark theme, 900px wide)
- [ ] Link diagrams in the markdown doc
- [ ] Add comparison table at the end
- [ ] Add code references section
- [ ] Open in VS Code for review

---

## Pattern Categories To Do

From `server/patterns.py`, remaining categories (ordered by sub-pattern count):

| Category | Sub-Patterns | Total Problems | Complexity |
|----------|-------------|----------------|------------|
| ~~Bit Manipulation~~ | ~~4~~ | ~~12~~ | ~~DONE~~ |
| ~~Heap (Priority Queue)~~ | ~~4~~ | ~~22~~ | ~~DONE~~ |
| ~~Sliding Window~~ | ~~4~~ | ~~31~~ | ~~DONE~~ |
| ~~Binary Search~~ | ~~5~~ | ~~27~~ | ~~DONE~~ |
| ~~Linked List~~ | ~~5~~ | ~~17~~ | ~~DONE~~ |
| ~~Greedy~~ | ~~6~~ | ~~18~~ | ~~DONE~~ |
| ~~Tree Traversal~~ | ~~6~~ | ~~33~~ | ~~DONE~~ |
| ~~Stack~~ | ~~6~~ | ~~26~~ | ~~DONE~~ |
| ~~Two Pointers~~ | ~~7~~ | ~~34~~ | ~~DONE~~ |
| ~~Array/Matrix~~ | ~~7~~ | ~~24~~ | ~~DONE~~ |
| ~~String Manipulation~~ | ~~7~~ | ~~20~~ | ~~DONE~~ |
| ~~Dynamic Programming~~ | ~~11~~ | ~~47~~ | ~~DONE~~ |
| ~~Graph Traversal~~ | ~~12~~ | ~~68~~ | ~~DONE~~ |
| ~~Design~~ | ~~2~~ | ~~39~~ | ~~DONE~~ |
| ~~Backtracking~~ | ~~7~~ | ~~19~~ | ~~DONE~~ |

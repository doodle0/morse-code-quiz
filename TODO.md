# TODO: Stats Upgrade + Digits Setting

## Goal

Add a second stats table to the session-end screen that aggregates performance
**by character** across the session, showing mean attempts and mean response time,
sorted by slowest average response time (descending). This helps the user see
which characters they struggle with most.

---

## Context

### Existing data (`session.log` entries)

Each entry logged by `logQuestion()` in `app.js`:

```js
{
  char:      'A',          // character quizzed
  correct:   true,         // boolean
  attempts:  2,            // number of attempts used (1–3)
  timeTaken: '4.3',        // string (seconds, 1 decimal) — see note below
}
```

> **Note**: `timeTaken` is stored as a string via `.toFixed(1)`. The aggregation
> logic must `parseFloat()` it, or we refactor storage to use a raw number.

### Existing session-end layout

1. Summary stats (`reportSummary`): Correct / Accuracy % / Best Streak
2. Per-question table (`reportBody`): chronological list of every question
3. "Start New Session" button

The new per-character table will be inserted **between** the per-question table
and the button.

---

## Tasks

### 1. Refactor `timeTaken` storage to a number  [`app.js`]

In `logQuestion()`, store `timeTaken` as a raw number (seconds, not formatted):

```js
// Before
timeTaken: ((Date.now() - question.startTime) / 1000).toFixed(1),

// After
timeTaken: (Date.now() - question.startTime) / 1000,
```

Update the existing per-question table renderer in `endSession()` to format it
at display time:

```js
// Before
<td>${q.timeTaken}s</td>

// After
<td>${q.timeTaken.toFixed(1)}s</td>
```

This makes all downstream math clean without repeated `parseFloat()` calls.

---

### 2. Write the aggregation function  [`app.js`]

Add a pure helper function (outside `DOMContentLoaded`, or inside it near
`endSession`) that takes `session.log` and returns a sorted array of per-char
stats:

```js
function aggregateByChar(log) {
    const map = {};                    // char → { count, totalTries, totalTime }

    for (const entry of log) {
        if (!map[entry.char]) {
            map[entry.char] = { count: 0, totalTries: 0, totalTime: 0 };
        }
        map[entry.char].count++;
        map[entry.char].totalTries += entry.attempts;
        map[entry.char].totalTime  += entry.timeTaken;
    }

    return Object.entries(map).map(([char, s]) => ({
        char,
        pattern:  morsePlayer.getMorsePattern(char),
        count:    s.count,
        avgTries: s.totalTries / s.count,
        avgTime:  s.totalTime  / s.count,
    })).sort((a, b) => b.avgTime - a.avgTime);  // slowest first
}
```

**Edge cases handled automatically:**
- Character asked once: avg of one value = the value itself.
- Multiple questions for same char: all entries contribute.

---

### 3. Add HTML for the new table  [`index.html`]

Inside `screen-end`, between the existing `<table>` and the button:

```html
<h3 class="section-heading">By Character</h3>
<table class="report-table">
    <thead>
        <tr>
            <th>Char</th>
            <th>Pattern</th>
            <th>Asked</th>
            <th>Avg Tries</th>
            <th>Avg Time</th>
        </tr>
    </thead>
    <tbody id="charStatsBody"></tbody>
</table>
```

Grab the element in `app.js`:

```js
const charStatsBodyEl = document.getElementById('charStatsBody');
```

---

### 4. Render the per-character table in `endSession()`  [`app.js`]

After rendering `reportBody`, call `aggregateByChar` and populate the new table:

```js
const charStats = aggregateByChar(session.log);
charStatsBodyEl.innerHTML = charStats.map(s => `
    <tr>
        <td><strong>${s.char}</strong></td>
        <td class="pattern">${s.pattern}</td>
        <td>${s.count}</td>
        <td>${s.avgTries.toFixed(1)}</td>
        <td>${s.avgTime.toFixed(1)}s</td>
    </tr>
`).join('');
```

**Formatting decisions:**
- `avgTries` to 1 decimal (e.g. `1.7`)
- `avgTime` to 1 decimal followed by `s` (e.g. `3.2s`)
- No row coloring needed by default — sort order alone communicates rank

---

### 5. Add CSS for the section heading  [`style.css`]

```css
.section-heading {
    font-size: 1em;
    font-weight: 600;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin: 24px 0 12px;
}
```

This visually separates the two tables without a heavy divider.

---

### 6. Widen the end-screen container  [`style.css`]

The new table adds a 5-column layout. The current `.container--wide` max-width
is `580px`. If it feels cramped after testing, bump it:

```css
.container--wide {
    max-width: 680px;   /* was 580px */
}
```

Adjust after visual review — may not be necessary.

---

## Feature 2: Include Digits Setting

### Goal

Add a session setting that lets the user opt in to including digits (0–9) in the
quiz character pool alongside letters (A–Z). Off by default.

### Context

- `MORSE_CODE` in `morse-player.js` already defines all 10 digits.
- `morsePlayer.getLetters()` — returns A–Z only (current behavior).
- `morsePlayer.getCharacters()` — returns all keys (A–Z + 0–9).
- The keyboard handler in `app.js` already matches `/^[a-zA-Z0-9]$/`, so digit
  key presses are already captured — no change needed there.

### Tasks

#### 7. Add `getDigits()` to `MorsePlayer`  [`morse-player.js`]

```js
/** Returns only digits (0–9) */
getDigits() {
    return Object.keys(MORSE_CODE).filter(c => c >= '0' && c <= '9');
}
```

Not strictly required (could use `getCharacters()` directly), but makes the API
explicit and consistent with `getLetters()`.

#### 8. Add the setting checkbox to the settings screen  [`index.html`]

After the time-limit setting row, add:

```html
<div class="setting-row setting-row--checkbox">
    <label>
        <input type="checkbox" id="s-digits">
        Include digits (0–9)
    </label>
</div>
```

#### 9. Capture the setting and build the character pool  [`app.js`]

In the `startSessionBtn` click handler, read the checkbox:

```js
settings = {
    ...
    includeDigits: document.getElementById('s-digits').checked,
};
```

Update `pickRandom()` to use the setting:

```js
function pickRandom() {
    const pool = settings.includeDigits
        ? morsePlayer.getCharacters()   // A–Z + 0–9
        : morsePlayer.getLetters();     // A–Z only
    return pool[Math.floor(Math.random() * pool.length)];
}
```

#### 10. Style the checkbox row  [`style.css`]

```css
.setting-row--checkbox label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
}

.setting-row--checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #667eea;
    cursor: pointer;
}
```

---

## Acceptance Criteria

### Stats table
- [ ] Session-end screen shows two tables: chronological per-question table
      (unchanged) and the new per-character table below it.
- [ ] Per-character table has columns: Char, Pattern, Asked, Avg Tries, Avg Time.
- [ ] Rows are sorted by Avg Time **descending** (slowest character at top).
- [ ] If a character was asked multiple times, its row shows the true mean of all
      those attempts and times.
- [ ] If a character was asked exactly once, its averages equal its single values.
- [ ] Numbers display to 1 decimal place.
- [ ] The "Start New Session" button remains below both tables.

### Digits setting
- [ ] Settings screen has a checkbox "Include digits (0–9)", default unchecked.
- [ ] When unchecked: only A–Z are quizzed (existing behavior).
- [ ] When checked: A–Z and 0–9 are all eligible to be quizzed.
- [ ] Pressing the correct digit key registers as a correct answer.
- [ ] Digits appear correctly in both report tables (char + pattern columns).

---

## Out of Scope (this session)

- Persisting stats across multiple sessions (localStorage)
- Highlighting "worst" rows with color
- "Digits only" mode (no letters)

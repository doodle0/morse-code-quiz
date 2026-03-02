# Morse Code Testing Web Project

## Project Overview
A web application that tests users on morse code recognition by playing morse code sounds and having the user identify the character(s) via keyboard input anywhere on the page. Organized into **sessions** of a fixed number of questions.

Two quiz modes:
- **Single-character mode** — plays one character; user types a single letter or digit.
- **Multi-character mode** — plays a sequence of N characters; user types all N before evaluation. Input is accepted during playback.

The two modes are distinct code paths. Single-character mode is unchanged by any multi-character additions.

## Technical Stack
- Vanilla HTML/CSS/JavaScript
- Web Audio API for sound generation
- Pico CSS v2 (classless) for base styles and design tokens

## Architecture
- **sound-engine.js** — `SoundEngine` class. Generates sine wave tones via Web Audio API. Singleton: `soundEngine`.
- **morse-player.js** — `MorsePlayer` class. Holds the `MORSE_CODE` map and schedules tones through the sound engine using PARIS timing. Singleton: `morsePlayer`.
- **app.js** — Quiz state machine and UI logic.
- **index.html / style.css** — UI shell and styles.

## Sound Engine Specifications
- Web Audio API, pure sine wave
- Default frequency: 600 Hz
- PARIS timing: dot = 1200ms / WPM, dash = 3× dot, element gap = 1× dot, character gap = 3× dot
- Attack/release envelope (5ms) to avoid clicks
- `stopAll()` — ramps master gain to 0 and cancels all tracked oscillators; used to interrupt playback when multi-char evaluation fires mid-sequence

---

## Hierarchy: Session → Question

### Session
A session is a fixed sequence of N questions with a consistent set of settings chosen before the session begins. Settings cannot be changed mid-session.

**Session lifecycle:**
1. **session-start** — Settings screen shown. User configures and clicks "Start Session".
2. Questions are asked one by one until N questions are answered (or exhausted of attempts).
3. **session-end** — Report screen shown. "Start New Session" returns to session-start.

### Question — Single-character mode
Each question plays a random character in morse code and waits for the user to respond.

**Question lifecycle:**
1. **playing** — Morse plays automatically. Key input and replay blocked. Timer not started yet.
2. **awaiting** — Morse finished. Timer countdown begins. User can answer or replay.
3. **feedback** — Answer evaluated. Result shown briefly, then either replays (try-again) or auto-advances to next question (correct / exhausted).

### Question — Multi-character mode
Each question plays a sequence of N random characters and collects up to N keystrokes from the user.

**Question lifecycle:**
1. **playing** — Sequence plays automatically. Letter/digit and Backspace input accepted; Space (replay) blocked. Timer starts immediately at entry.
2. **awaiting** — Sequence finished. Timer still running (started at `playing`). User can continue typing, backspace, or replay.
3. **feedback** — Answer evaluated when buffer fills to N. Result shown briefly, then replays (try-again) or advances (correct / exhausted).

---

## States

| State | Description |
|---|---|
| `session-start` | Settings visible, Start Session button. No quiz activity. |
| `playing` | Morse audio playing. In single-char: all input blocked, timer not started. In multi-char: letter/digit/Backspace accepted, timer running. |
| `awaiting` | Waiting for user input. In single-char: timer counting down from setting value. In multi-char: timer still counting (started in `playing`). Space = replay in both modes. |
| `feedback` | Showing result. Correct/exhausted: auto-advances after delay. Try-again: auto-replays after delay. |
| `session-end` | Session report shown. Start New Session button visible. |

---

## Controls (global keyboard — no input field)

### Single-character mode

| Key | Effect |
|---|---|
| Any letter / digit | Submit as answer (only in `awaiting` state) |
| Space | Replay morse for current character (only in `awaiting` state; costs an attempt; resets timer) |

### Multi-character mode

| Key | Effect |
|---|---|
| Any letter / digit | Append to input buffer (`playing` or `awaiting`); auto-submits when buffer length = N |
| Backspace | Remove last typed character (`playing` or `awaiting`) |
| Space | Replay full sequence and clear buffer (`awaiting` only; costs an attempt; resets timer) |

---

## Scoring & Attempts

- Each question allows **up to 3 attempts**. Wrong answers, timeouts, and Space replays all consume attempts (`attemptsUsed` is incremented for all three); the last attempt is always reserved for answering (Space is blocked when only 1 remains).
- **Correct answer**: show result, auto-advance after 1.2s.
- **Wrong answer, attempts remaining**: show result, auto-replay after 1.2s, return to `playing`/`awaiting` with fresh timer.
- **Wrong answer, no attempts left**: show answer reveal, auto-advance after 1.8s. Counts as incorrect.
- **Timeout**: treated as a wrong attempt. Same flow as wrong answer.
- Multi-char grading is all-or-nothing at the question level.
- Score tracks: correct questions / total questions. Streak increments on **any correct answer** (even if not first attempt), resets only when a question is fully failed.

---

## Time Limit

- User sets a **time limit per character**: **0 (off) – 10s** in 0.5s steps.
- Timer displayed as a **color-coded progress bar**: green (full) → orange-red (empty), using OKLCH hue 140→20.
- On expiry: counts as a wrong attempt, same handling as a wrong keypress.

### Single-character mode
- Timer starts when state enters `awaiting`.
- Total timeout = setting value.
- Timer resets on each new attempt (wrong-answer replay or Space replay).

### Multi-character mode
- Timer starts when `playing` is entered (at the beginning of playback).
- Total timeout = `charsPerQuestion × timePerChar`. This guarantees the timeout exceeds playback duration at any WPM.
- Timer resets on each new attempt.

---

## Session Settings (shown only at session-start)

| Setting | Default | Range / Step | Visibility |
|---|---|---|---|
| Mode | Single-character | Single-character / Multi-character | always |
| Characters per question | 2 | 2 – 10, step 1 | multi-char mode only |
| Questions per session | 10 | 5 – 50, step 5 | always |
| WPM (speed) | 5 | 5 – 50, step 1 | always |
| Frequency | 600 Hz | 400 – 900 Hz, step 50 | always |
| Time limit per character | 5s | 0 (off) – 10s, step 0.5s | always |
| Letters (A–Z) | on | checkbox | always |
| Digits (0–9) | off | checkbox | always |

---

## Session Report (session-end screen)

Shown after all questions in the session are completed.

**Summary metrics (both modes):**
- Correct / total questions
- Overall accuracy %
- Longest streak during session

**Actions:**
- "Start New Session" — returns to session-start (settings screen)

### Single-character mode

**Per-question table:** #, Char, Pattern, Result, Tries, Time

> **Time** = cumulative time spent in `awaiting` state only. Playback durations are excluded.

**Per-character table:** Char, Pattern, Times asked, Avg Tries, Avg Time — sorted by slowest avg time descending.

### Multi-character mode

**Per-question table:** #, Chars (full sequence string), Result, Tries, Time

> **Time** = cumulative elapsed time across all attempts, measured from the start of each `playing` phase (includes playback duration).

**Per-character table:** Char, Pattern, Times asked, Avg Tries — sorted by highest avg tries descending. No time column.

> **Avg tries per character** is computed per position, not uniformly across the question: for each character position, the attempt number on which it was first typed correctly is recorded. Positions never typed correctly get the question's final `attemptsUsed`. This identifies which specific characters caused difficulty within multi-char questions.

---

## Character Set
- Letters A–Z and digits 0–9 are each independently toggled via session settings
- At least one group must be enabled; Start button disables itself (with a message) when both are off
- Session pool = letters (if on) + digits (if on), sampled uniformly

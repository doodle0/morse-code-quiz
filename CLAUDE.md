# Morse Code Testing Web Project

## Project Overview
A web application that tests users on morse code recognition by playing morse code sounds and having the user identify the character via keyboard input anywhere on the page. Organized into **sessions** of a fixed number of questions.

## Technical Stack
- Vanilla HTML/CSS/JavaScript
- Web Audio API for sound generation

## Architecture
- **sound-engine.js** — `SoundEngine` class. Generates sine wave tones via Web Audio API. Singleton: `soundEngine`.
- **morse-player.js** — `MorsePlayer` class. Holds the `MORSE_CODE` map and schedules tones through the sound engine using PARIS timing. Singleton: `morsePlayer`.
- **app.js** — Quiz state machine and UI logic.
- **index.html / style.css** — UI shell and styles.

## Sound Engine Specifications
- Web Audio API, pure sine wave
- Default frequency: 600 Hz
- PARIS timing: dot = 1200ms / WPM, dash = 3× dot, element gap = 1× dot
- Attack/release envelope (5ms) to avoid clicks

---

## Hierarchy: Session → Question

### Session
A session is a fixed sequence of N questions with a consistent set of settings chosen before the session begins. Settings cannot be changed mid-session.

**Session lifecycle:**
1. **session-start** — Settings screen shown. User configures and clicks "Start Session".
2. Questions are asked one by one until N questions are answered (or exhausted of attempts).
3. **session-end** — Report screen shown. "Start New Session" returns to session-start.

### Question
Each question plays a random character in morse code and waits for the user to respond.

**Question lifecycle:**
1. **playing** — Morse plays automatically. Key input and replay blocked.
2. **awaiting** — Morse finished. Timer countdown begins. User can answer or replay.
3. **feedback** — Answer evaluated. Result shown briefly, then either replays (try-again) or auto-advances to next question (correct / exhausted).

---

## States

| State | Description |
|---|---|
| `session-start` | Settings visible, Start Session button. No quiz activity. |
| `playing` | Morse audio playing. Input and replay blocked. Timer not started yet. |
| `awaiting` | Waiting for user input. Timer counting down. Space = replay (resets timer). Any letter/digit key = answer. |
| `feedback` | Showing result. Correct/exhausted: auto-advances after delay. Try-again: auto-replays after delay. |
| `session-end` | Session report shown. Start New Session button visible. |

---

## Controls (global keyboard — no input field)

| Key | Effect |
|---|---|
| Any letter / digit | Submit as answer (only in `awaiting` state) |
| Space | Replay morse for current character (only in `awaiting` state, blocked while playing, resets timer) |

---

## Scoring & Attempts

- Each question allows **up to 3 attempts**.
- **Correct answer**: show `Correct! "X" is .-`, auto-advance after 1.2s.
- **Wrong answer, attempts remaining**: show `Wrong. Try again — N attempt(s) left`, auto-replay morse after 1.2s, return to `awaiting` with fresh timer.
- **Wrong answer, no attempts left**: show `Answer: "X" (.-)`, auto-advance after 1.8s. Counts as incorrect for the session.
- **Timeout** (time limit exceeded in `awaiting`): treated as a wrong attempt. Same flow as wrong answer.
- Score tracks: correct questions / total questions (not attempts). Streak increments on **any correct answer** (even if not first attempt), resets only when a question is fully failed (all attempts exhausted or timed out on last attempt).

---

## Time Limit

- User sets a per-question time limit in settings: **0.5s – 10s** in 0.5s steps.
- Timer starts when state enters `awaiting`.
- Timer resets on each new attempt — both after a wrong-answer replay and after a Space replay.
- Timer displayed as a **color-coded progress bar**: green (full) → yellow → red (empty).
- On expiry: counts as a wrong attempt, same handling as a wrong keypress.

---

## Session Settings (shown only at session-start)

| Setting | Default | Range / Step |
|---|---|---|
| Questions per session | 10 | 5 – 50, step 5 |
| WPM (speed) | 5 | 1 – 25, step 1 |
| Frequency | 600 Hz | 400 – 900 Hz, step 50 |
| Time limit per question | 5s | 0.5s – 10s, step 0.5s |

---

## Session Report (session-end screen)

Shown after all questions in the session are completed.

**Metrics displayed:**
- Correct / total questions
- Overall accuracy %
- Longest streak during session
- Per-question table: character, morse pattern, correct/wrong, attempts used, total time on question

**Actions:**
- "Start New Session" — returns to session-start (settings screen)

---

## Character Set
- Letters A–Z (default, beginner)
- Digits 0–9 defined in `MORSE_CODE` but not yet used in quiz

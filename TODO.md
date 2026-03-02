# TODO

## Possible future work

- Persist stats across sessions (localStorage)
- Highlight "worst" character rows in the per-character table

## Punctuation support

Standard ITU Morse includes punctuation (`. , ? / = - ( )` etc.). Each is a
single character with a unique code, so the existing single-key answer model
fits. The main challenges:

- **Input**: many punctuation keys require Shift or are layout-dependent. Best
  approach is to intercept `keydown` and match `e.key` (which gives the actual
  typed character) against the expected answer, rather than relying on key
  position. The current handler already uses `e.key` so the change is minimal.
- **Character set toggle**: add a "Punctuation" checkbox alongside Letters/Digits.
  `MorsePlayer` would get a `getPunctuation()` method, and `pickRandom()` spreads
  it into the pool the same way digits are handled today.
- **Hint text**: should reflect that punctuation keys are also valid answers.

## Prosign support

Prosigns (AR, SK, BT, KN, …) are transmitted as merged letter pairs with no
inter-character gap. They have no single typed equivalent, so the current
answer model breaks. Two realistic options:

1. **Key binding**: assign each prosign to an unused key or chord (e.g. `\` →
   SK). Simple, but requires the user to learn a custom mapping — show a
   reference on the settings or quiz screen.
2. **Multi-key input**: collect a short sequence of keystrokes (e.g. "S" then
   "K") and match the full string. The input-buffer model now exists (multi-char
   mode), so the infrastructure is mostly in place; the main remaining question
   is how to represent prosigns in the character pool and what letter sequence
   the user types.

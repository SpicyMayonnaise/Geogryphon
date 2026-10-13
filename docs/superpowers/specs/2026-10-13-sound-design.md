# Sound effects

Date: 2026-10-13. Branch: `sounds`.

## Goal

Give Geogryphon arcade-style sound feedback that matches the "Arcade" look, with answer sounds that react to how
fast the player was. Sounds are generated in code with the Web Audio API: no audio files, no new dependencies,
still works from `file://` and offline.

Success:
- Every listed event plays its sound, including when triggered from the keyboard.
- Correct sounds get more intense the more time was left; wrong sounds get more intense the less time was left.
- A tick plays while the timer is in its red zone and stops as soon as the round ends.
- A mute toggle (button + `M` key) is remembered between visits.
- A missing or blocked audio system never breaks the game or logs errors.

Out of scope: volume slider and other sound settings (they move into the future settings menu), music, a reveal
"whoosh", hover sounds on map countries, recorded samples.

## User requirements (verbatim intent)

1. Universal hover and click sounds for buttons, including clicks made through keyboard bindings.
2. Right and wrong answers each have their own sound family; intensity depends on the timer. Right is more intense
   the more time is left; wrong is the opposite.
3. A ticking sound as the timer nears its limit.
4. Extras chosen by the user: Time's up, Run over, Map pick, Score saved.
5. Mute toggle now; finer settings wait for the settings menu.

## Sounds

`intensity` is a number from 0 to 1 (values outside are clamped).

| Name | Trigger | Character |
|---|---|---|
| `hover` | Pointer enters a sound target (see Wiring). At most one per 40 ms. | Very soft, very short high tick. |
| `click` | A sound target is clicked (mouse, Enter/Space on focus, keys 1-4), and the Space game key (confirm / skip reveal). | Short low-mid "pop". |
| `correct` | Right answer. intensity = `Clock.ratio()` at the moment of answering (time left). | Rising blips. 0: two notes, soft, square-ish. 1: four fast notes up an arpeggio, a high shimmer on top, louder. Smooth in between. |
| `wrong` | Wrong answer. intensity = `1 - Clock.ratio()` before any penalty (time used). | Falling tone. 0: a short soft two-step "bonk". 1: longer, lower, harsher sawtooth buzz. A new `wrong` cuts any `wrong` still sounding. |
| `tick` | Each new whole second while `Clock.ratio() <= 0.25` and the clock is running; in the final second it plays a second, higher "tock" half a second later. | Short woodblock click, slightly higher and louder each second. |
| `timesUp` | The clock reaches zero (natural expiry, or a penalty that runs it out). | Two-tone buzzer, ~0.6 s. |
| `runOver` | The run-over modal opens (`showGameOver`). | Short descending 3-4 note jingle. |
| `pick` / `unpick` | A country is selected / deselected in Map or Trivia. | Soft "pip" up / down. |
| `full` | The "Selection full" reaction. | Dull low thud. |
| `saved` | A score is saved successfully. | Two-note rising chime. |

Ticks follow the seconds shown on screen (rounded up): Normal (10 s) turns red at 2.5 s left, which shows as
"3s", so it ticks at 3, 2 and 1 (with the final tock); Easy (20 s) from 5; Hard (5 s) at 2 and 1; Extreme (3 s)
only in the final second. The tick tracker resets on every `Clock.start`, so no tick leaks into the next question.

## Architecture

New file `js/sound.js`, loaded after `js/util.js` and before `js/game.js` (classic script, global `Sound`). It is
the only file that uses the Web Audio API.

```
Sound.unlock()                 // create/resume the AudioContext; called on the first pointerdown/keydown
Sound.play(name, intensity=0)  // no-op if muted, locked, unknown name or no Web Audio
Sound.tick(secondsLeft)        // plays 'tick' once per new whole second; Sound.resetTick() on clock start
Sound.setMuted(bool) / Sound.isMuted()   // persisted in LS key 'geogryphon.muted'
```

- Recipes: `RECIPES[name](intensity) -> [{ f, f2?, t, d, type, v, noise? }]` (frequency, optional end frequency
  for a glide, start offset s, duration s, oscillator type, volume). Pure functions, testable without audio.
- `playNotes(notes)` schedules oscillators (and a short noise buffer for `noise` notes) through one master gain
  with fast attack / exponential release envelopes, so there are no clicks at note edges.
- Hover throttle and tick de-duplication are plain state checks before `playNotes`.
- `wrong` keeps a handle to its nodes and stops them when the next `wrong` starts.
- Every Web Audio call is wrapped so a failure disables sound (silent) instead of throwing.

## Wiring

`js/game.js`
- `onCorrect`: `Sound.play('correct', r)` with the ratio it already reads.
- `applyPenalty` (Map/Trivia wrong): read `Clock.ratio()` before the penalty, `Sound.play('wrong', 1 - r)`; if
  the penalty ran out the clock, play `wrong` at intensity 1 and then `timesUp`.
- `onFlagAnswer` wrong branch: `Sound.play('wrong', 1 - Clock.ratio())` before `lose(...)`.
- `beginAsking`: the clock's expire callback plays `timesUp` before `lose('Time’s up!')`.
- `Clock`: `start` calls `Sound.resetTick()`; the frame loop calls `Sound.tick(Math.ceil(r * max))` while
  `r <= .25` and running. Pausing stops the loop, so ticks stop too.
- `showGameOver`: `Sound.play('runOver')` after it opens the modal.
- `selectMapCountry`: `pick` / `unpick`; the "Selection full" path plays `full`.

`js/scores.js`
- `saveScore`: `Sound.play('saved')` after a successful save (not when empty name or already saved).

`js/main.js`
- Delegated `pointerover` and `click` listeners on `document` for targets matching
  `button, .difficulty label, .answer, .mapControl` (hover only when entering a new target, not moving inside it,
  and never for touch, where a tap would otherwise play hover and click together).
  Keys 1-4 already call `.click()`, so they get the click sound.
- The Space key branches (confirm, skip reveal) call `Sound.play('click')`.
- First `pointerdown` / `keydown` anywhere calls `Sound.unlock()`.
- `M` toggles mute (ignored while typing in an input, and with modifier keys).

Mute button (`index.html` + `css/style.css`)
- `.muteBtn`: round button styled like `.mapControl`, one in the menu (top right) and one in the game header next
  to the stats; icon 🔊 / 🔇, `aria-pressed`, `title`/`aria-label` "Mute sounds" / "Unmute sounds". Both reflect
  the same state. Colours and sizes only from tokens (`check-tokens.js` must pass).

## Error handling

- No `AudioContext` (old browser, test environment): `Sound` methods are no-ops.
- Locked context before the first gesture: `play` does nothing (no queued backlog).
- Storage blocked: `LS` already swallows errors; mute defaults to off.

## Testing

- `tools/test-sound.js` (VM-extracted `js/sound.js` with a fake `AudioContext`):
  - `correct` intensity 1 has more notes and higher peak volume/pitch than intensity 0; `wrong` 1 is longer and
    lower than `wrong` 0; out-of-range intensities clamp.
  - `tick` plays once per new whole second and not twice for the same second; `resetTick` re-arms it.
  - hover throttle: two hovers within 40 ms play once.
  - muted: nothing is scheduled; mute state round-trips through storage.
  - no `AudioContext`: every method returns without throwing.
- `tools/test-sound-wiring.js`: run `onCorrect`, `applyPenalty`, the flag wrong branch and `showGameOver`
  with a stub `Sound` and stub `Clock`, and assert the sound name and intensity sent.
- Existing tools stay green; `node --check` on changed files.
- Browser pane: no console errors in each mode; mute buttons stay in sync; header layout still fits at 375 px.
- By ear (user): a temporary sound board page plays every sound at intensity 0, 0.5 and 1. It is not committed.

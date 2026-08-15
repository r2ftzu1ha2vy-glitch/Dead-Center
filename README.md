# Dead Center

A browser rhythm game. Defend the center as a top-down goalkeeper — move to
intercept incoming balls synced to the beat of any song you drop in.

## Running it

Browsers block audio file access and `fetch()` over `file://`, so the game
needs to be served, not opened directly:

```bash
cd dead-center
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Adding songs

1. Drop an `.mp3` file into the `songs/` folder.
2. Open `js/songs.js` and add its filename to the `SONG_FILENAMES` list near
   the top of the file:

   ```js
   const SONG_FILENAMES = [
     "Rush.mp3",
     "Eclipse.mp3",
     "Midnight.mp3",
   ];
   ```

That's the only manual step — browsers can't list a folder's contents on
their own, so this array is how the game knows what's in `songs/`. Once a
filename is listed, everything else is automatic:

- **Chart generation** — the song's audio is analyzed in-browser (FFT
  spectral-flux onset detection) the first time it's played, placing notes
  on the actual beats and building intensity from the track's energy. No
  manual chart authoring.
- **Cover art** — a generated abstract cover consistent with the game's
  diamond motif, seeded from the filename so it's stable across sessions.
- **Level Select entry** — appears automatically in the sidebar.
- **Completion % and high score** — tracked per song in `localStorage` as
  you play, no setup needed.

## Project structure

```
index.html          Screens: menu, level select, gameplay
css/style.css        Theme: dark pink/magenta/purple, rounded, responsive
js/background.js     Animated floating diamond backdrop
js/songs.js           Song list, cover generation, progress/high-score storage
js/chartgen.js         Audio analysis → chart generation
js/menu.js             Main menu
js/levelselect.js      Level select screen
js/game.js             Core gameplay engine (canvas rendering, input, scoring)
js/main.js              Screen manager / bootstrap
assets/                 logo.png, play_button.png, goalkeeper.png, ball.png, ring.png
songs/                  Drop .mp3 files here
```

## How to play

Move the mouse (or drag on touch) around the arena — the goalkeeper tracks
your angle around the ring. Balls spawn outside the outer ring and travel
toward the center; get the goalkeeper to the ball's angle before it reaches
the inner **Dead Zone** ring to save it. Missing one ends the run.

Note types:
- **normal** — straight shot
- **curve_left / curve_right** — bends up to 40° during its approach; judged
  at its final (curved) position, not its spawn angle
- **double** — two-handed reach, slightly wider save window

## Notes on assets

`ring.png` is a very faint, thin outline by design — it's tinted and glowed
via canvas compositing at render time (colored per context: pink for the
arena boundary, magenta/red for the Dead Zone) rather than being redrawn,
so both rings share the same underlying asset.

The goalkeeper sprite is top-down and always rendered at a fixed 30°
clockwise resting rotation, as specified — it doesn't reorient to face
incoming balls, only its position along the ring changes.

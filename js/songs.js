/* =========================================================
   Song library — auto-detects mp3 files placed in /songs/
   OR linked directly by URL.
   No manual configuration beyond listing the source below:
   everything else — chart generation, cover art, level select
   entry, completion tracking — happens automatically.
   ========================================================= */

const SongLibrary = (function () {

  // ---- The ONLY manual step: list your songs here ----
  // Each entry can be either:
  //   - a plain filename string (assumed to live in /songs/), e.g. "Rush.mp3"
  //   - an object { name, url, cover?, chart? } pointing to any direct mp3 link
  //     - cover: optional image URL, replaces the auto-generated cover
  //     - chart: optional hand-authored { duration, notes } — skips auto-detection
  const SONG_SOURCES = [
    // "Rush.mp3",
    // "Eclipse.mp3",
    // "Midnight.mp3",
    {
      name: "Tutorial",
      url: "https://raw.githubusercontent.com/NecroHub/Audio/main/YTDown.com_YouTube_Earth-Wind-_-Fire-September-Lyrics_Media_aqZxIL4YE2I_001_1080p.mp3",
      cover: "https://iili.io/CiRkehg.jpg",
      chart: {
        duration: 70,
        // Each note now carries a "direction" (left/right/up/down) describing
        // roughly where the ball should come from. The actual spawn angle is
        // randomized within that direction's arc at runtime (see
        // pickSpawnAngle in game.js), so notes aren't all fixed at one spot.
        notes: [
          { type: "normal", time: 20.0, direction: "left" },
          { type: "normal", time: 21.0, direction: "left" },
          { type: "normal", time: 22.0, direction: "left" },
          { type: "normal", time: 23.0, direction: "left" },
          { type: "normal", time: 24.0, direction: "up" },
          { type: "normal", time: 25.0, direction: "up" },
          { type: "normal", time: 26.0, direction: "up" },
          { type: "normal", time: 27.0, direction: "up" },
          { type: "normal", time: 28.0, direction: "up" },
          { type: "normal", time: 29.0, direction: "right" },
          { type: "normal", time: 30.0, direction: "right" },
          { type: "normal", time: 31.0, direction: "right" },
          { type: "normal", time: 32.0, direction: "right" },
          { type: "normal", time: 36.5, direction: "down" },
          { type: "normal", time: 37.5, direction: "down" },
          { type: "normal", time: 38.5, direction: "down" },
          { type: "normal", time: 39.5, direction: "down" },
          { type: "normal", time: 40.5, direction: "right" },
          { type: "normal", time: 41.5, direction: "right" },
          { type: "normal", time: 42.5, direction: "right" },
          { type: "normal", time: 43.5, direction: "right" },
          { type: "normal", time: 44.5, direction: "up" },
          { type: "normal", time: 45.5, direction: "left" },
          { type: "normal", time: 46.5, direction: "down" },
          { type: "normal", time: 47.5, direction: "left" },
          { type: "normal", time: 48.5, direction: "up" },
          { type: "normal", time: 53.0, direction: "up" },
          { type: "normal", time: 53.5, direction: "left" },
          { type: "normal", time: 54.0, direction: "left" },
          { type: "normal", time: 54.5, direction: "down" },
          { type: "normal", time: 55.0, direction: "down" },
          { type: "normal", time: 55.5, direction: "right" },
          { type: "normal", time: 56.0, direction: "right" },
          { type: "normal", time: 56.5, direction: "down" },
          { type: "normal", time: 57.0, direction: "down" },
          { type: "normal", time: 57.5, direction: "left" },
          { type: "normal", time: 58.0, direction: "up" },
        ],
      },
    },
  ];

  // Tutorial-only text cues. Format mirrors the note chart: "[text]: [time]"
  // Shown at top-middle of the arena instead of spawning a ball.
  // Only active when the song's name is exactly "Tutorial".
  const TUTORIAL_TEXT_CUES = [
    { text: "Welcome To Dead Center", time: 1.000 },
    { text: "Let's Start With The Basics", time: 3.000 },
    { text: "move Your Cursor To Where The Ball Is", time: 5.000 },
    { text: "To Hit The Ball Back", time: 7.000 },
    { text: "Balls May Charge In Any Direction", time: 10.000 },
    { text: "So Be Ready!", time: 12.000 },
    { text: "Are You Ready For The Fun?", time: 15.000 },
    { text: "Try Some On Beats", time: 18.500 },
    { text: "Nice, Now Try Some Off Beats", time: 32.500 },
    { text: "Excellent, Now Try Both!", time: 51.250 },
    { text: "Fantastic! Thats All For The Tutorial!", time: 63.000 },
  ];

  const STORAGE_KEY = "deadcenter_progress_v1";

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      /* storage unavailable, ignore */
    }
  }

  let progress = loadProgress();

  function niceName(filename) {
    return filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function slug(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  // deterministic pseudo-random cover hue per song, so covers feel distinct
  // but consistent between sessions (no external image dependency required)
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function makeCoverDataUrl(name) {
    const hash = hashString(name);
    const hue1 = hash % 360;
    const hue2 = (hue1 + 40 + (hash % 60)) % 360;

    const size = 240;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, `hsl(${hue1}, 70%, 22%)`);
    grad.addColorStop(1, `hsl(${hue2}, 80%, 12%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `hsla(${hue1}, 90%, 60%, 0.18)`;
    ctx.fillRect(-size * 0.35, -size * 0.35, size * 0.7, size * 0.7);
    ctx.restore();

    ctx.save();
    ctx.translate(size * 0.22, size * 0.78);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `hsla(${hue2}, 90%, 65%, 0.25)`;
    ctx.fillRect(-30, -30, 60, 60);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue1}, 100%, 75%, 0.35)`;
    ctx.lineWidth = 3;
    ctx.stroke();

    return c.toDataURL("image/png");
  }

  // Normalize each entry into { filename, url, name, cover, chart }
  function resolveSource(source) {
    if (typeof source === "string") {
      return {
        filename: source,
        url: `songs/${source}`,
        name: niceName(source),
        cover: null,
        chart: null,
      };
    }
    return {
      filename: source.name,
      url: source.url,
      name: source.name,
      cover: source.cover || null,
      chart: source.chart || null,
    };
  }

  const songs = SONG_SOURCES.map((source) => {
    const resolved = resolveSource(source);
    const id = slug(resolved.name);
    const isTutorial = resolved.name === "Tutorial";
    return {
      id,
      filename: resolved.filename,
      url: resolved.url,
      name: resolved.name,
      cover: resolved.cover || makeCoverDataUrl(resolved.name),
      chart: resolved.chart || null, // if set, skips auto-generation
      isTutorial,
      textCues: isTutorial ? TUTORIAL_TEXT_CUES.slice() : null,
    };
  });

  function getAll() {
    return songs;
  }

  function getById(id) {
    return songs.find((s) => s.id === id);
  }

  function getCompletion(id) {
    return (progress[id] && progress[id].completion) || 0;
  }

  function getHighScore(id) {
    return (progress[id] && progress[id].highScore) || null;
  }

  function reportResult(id, { accuracy, score }) {
    const prev = progress[id] || { completion: 0, highScore: null };
    progress[id] = {
      completion: Math.max(prev.completion, accuracy),
      highScore: prev.highScore === null ? score : Math.max(prev.highScore, score),
    };
    saveProgress(progress);
  }

  return { getAll, getById, getCompletion, getHighScore, reportResult };
})();

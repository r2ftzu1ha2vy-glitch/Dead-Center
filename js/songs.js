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
  //   - an object { name, url } pointing to any direct mp3 link
  const SONG_SOURCES = [
    // "Rush.mp3",
    // "Eclipse.mp3",
    // "Midnight.mp3",
    { name: "Tutorial", url: "https://raw.githubusercontent.com/NecroHub/Audio/main/YTDown.com_YouTube_Earth-Wind-_-Fire-September-Lyrics_Media_aqZxIL4YE2I_001_1080p.mp3", cover: "https://iili.io/CiRkehg.jpg" },
  ];

  // Tutorial-only text cues. Format mirrors the note chart: "[text]: [time]"
  // Shown at top-middle of the arena instead of spawning a ball.
  // Only active when the song's name is exactly "Tutorial".
  const TUTORIAL_TEXT_CUES = [
    { text: "Move to intercept the ball", time: 1.000 },
    { text: "Get close to the center", time: 4.500 },
    { text: "Watch for curve shots", time: 9.000 },
    { text: "Double balls need a wider stance", time: 14.000 },
    { text: "Don't let it reach the Dead Zone", time: 19.000 },
    { text: "You're ready. Good luck!", time: 24.000 },
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

    // diamond motif matching background theme
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

    // ring accent (echoes ring.png motif)
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue1}, 100%, 75%, 0.35)`;
    ctx.lineWidth = 3;
    ctx.stroke();

    return c.toDataURL("image/png");
  }

  // Normalize each entry into { id, filename, url, name }
function resolveSource(source) {
    if (typeof source === "string") {
      return {
        filename: source,
        url: `songs/${source}`,
        name: niceName(source),
        cover: null,
      };
    }
    return {
      filename: source.name,
      url: source.url,
      name: source.name,
      cover: source.cover || null,
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
      chart: null,
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
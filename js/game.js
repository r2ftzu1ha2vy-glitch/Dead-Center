/* =========================================================
   Gameplay Engine
   Top-down goalkeeper defends the Dead Center from incoming
   balls synchronized to the music. Move to intercept.
   ========================================================= */

const Game = (function () {

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const audio = document.getElementById("audio-player");

  const assets = {};
  let assetsLoaded = false;

  function loadAssets() {
    return new Promise((resolve) => {
      const names = {
        goalkeeper: "assets/goalkeeper.png",
        ball: "assets/ball.png",
        ring: "assets/ring.png",
      };
      const keys = Object.keys(names);
      let loaded = 0;
      keys.forEach((k) => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          if (loaded === keys.length) {
            assetsLoaded = true;
            resolve();
          }
        };
        img.src = names[k];
        assets[k] = img;
      });
    });
  }

  // ---- State ----
  let song = null;
  let chart = null;
  let notes = [];        // active + upcoming note objects
  let arena = { cx: 0, cy: 0, outerR: 0, deadR: 0 };
  let keeper = { angleDeg: 200, targetAngleDeg: 200 }; // position around ring, degrees
  let keeperRadius = 0;  // distance of keeper from center (fixed, near ring edge)
  let running = false;
  let startTime = 0;     // audio.currentTime reference
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let hits = 0;
  let totalNotes = 0;
  let missedNotes = 0;
  let rafId = null;

  const TRAVEL_TIME = 1.15;   // seconds for ball to travel from outer ring to dead zone
  const HIT_WINDOW = 0.18;    // seconds of leeway around a note's target arrival
  const SAVE_FLASH_TIME = 0.25;

  let pointerActive = false;
  let saveFlashUntil = 0;
  let saveFlashSide = 0;

  let activeCues = [];
  let cueEl = null;
  let cueHideTimeout = null;

  // ---- Public API ----
  async function start(selectedSong) {
    song = selectedSong;
    if (!assetsLoaded) await loadAssets();

    ScreenManager.show("game");
    document.getElementById("hud-song-title").textContent = song.name;
    document.getElementById("hud-score").textContent = "0";
    document.getElementById("hud-combo").textContent = "";
    document.getElementById("game-overlay").classList.add("hidden");

    resizeCanvas();

    // generate chart if not cached
    if (!song.chart) {
      showLoadingState(true);
      song.chart = await ChartGen.generateChart(song);
      showLoadingState(false);
    }
    chart = song.chart;

    cueEl = document.getElementById("tutorial-cue");
    activeCues = (song.isTutorial && song.textCues)
      ? song.textCues.map(c => ({ ...c, shown: false }))
      : [];
    if (cueEl) { cueEl.textContent = ""; cueEl.classList.remove("visible"); }

    resetState();
    audio.src = song.url;
    audio.currentTime = 0;
    audio.volume = 1;

    await runCountdown();

    audio.play();
    running = true;
    startTime = performance.now() / 1000 - 0; // audio driven, this is a fallback clock
    rafId = requestAnimationFrame(loop);

    audio.onended = () => finish(true);
  }

  function showLoadingState(isLoading) {
    const cd = document.getElementById("countdown");
    if (isLoading) {
      cd.textContent = "ANALYZING TRACK…";
      cd.style.fontSize = "1.6rem";
      cd.classList.remove("hidden");
    } else {
      cd.classList.add("hidden");
      cd.style.fontSize = "";
    }
  }

  function resetState() {
    const noteCount = chart.notes.length;
    notes = chart.notes.map((n, i) => ({
      id: i,
      type: n.type,
      targetTime: n.time,
      spawnTime: n.time - TRAVEL_TIME,
      angle: pickSpawnAngle(n, i, noteCount),
      resolved: false,
      hit: false,
      curveOffset: 0,
    }));
    totalNotes = notes.length;
    score = 0;
    combo = 0;
    bestCombo = 0;
    hits = 0;
    missedNotes = 0;
    keeper.angleDeg = 200;
    keeper.targetAngleDeg = 200;
  }

  // Center angle (in degrees, standard canvas convention: 0=right, 90=down,
  // 180=left, 270=up) for each cardinal direction a tutorial note can use.
  const DIRECTION_ANGLES = { right: 0, down: 90, left: 180, up: 270 };
  const DIRECTION_SPREAD = 35; // ± degrees randomized around the direction's center

  function pickSpawnAngle(note, i, noteCount) {
    if (song && song.isTutorial) {
      // Tutorial notes are authored with a "direction" (left/right/up/down)
      // in songs.js rather than a fixed angle, so the same direction never
      // spawns from exactly the same spot twice — it's randomized within
      // that direction's arc, keeping the ball's general approach
      // predictable (easy to learn) while still feeling varied.
      const dir = note.direction;
      const center = DIRECTION_ANGLES.hasOwnProperty(dir) ? DIRECTION_ANGLES[dir] : 200;
      const jitter = (Math.random() * 2 - 1) * DIRECTION_SPREAD;
      return center + jitter;
    }
    // Distribute spawn angles around the circle with variety influenced by type
    const base = (i * 137.5) % 360; // golden-angle distribution for even spread
    return base;
  }

  function runCountdown() {
    return new Promise((resolve) => {
      const cd = document.getElementById("countdown");
      cd.classList.remove("hidden");
      let n = 3;
      cd.textContent = n;
      const iv = setInterval(() => {
        n--;
        if (n > 0) {
          cd.textContent = n;
        } else if (n === 0) {
          cd.textContent = "GO!";
        } else {
          clearInterval(iv);
          cd.classList.add("hidden");
          resolve();
        }
      }, 600);
    });
  }

  function quit() {
    running = false;
    audio.pause();
    audio.onended = null;
    if (rafId) cancelAnimationFrame(rafId);
    if (cueEl) cueEl.classList.remove("visible");
    clearTimeout(cueHideTimeout);
    ScreenManager.show("select");
    LevelSelect.refresh();
  }

function finish(completed) {
    running = false;
    audio.onended = null;
    audio.pause();
    if (rafId) cancelAnimationFrame(rafId);
    if (cueEl) cueEl.classList.remove("visible");
    clearTimeout(cueHideTimeout);

    const accuracy = totalNotes > 0 ? (hits / totalNotes) * 100 : 0;

    SongLibrary.reportResult(song.id, { accuracy, score });

    document.getElementById("overlay-title").textContent = completed ? "Track Cleared" : "Game Over";
    document.getElementById("overlay-acc").textContent = accuracy.toFixed(3) + "%";
    document.getElementById("overlay-score").textContent = score.toLocaleString();
    document.getElementById("overlay-combo").textContent = bestCombo;
    document.getElementById("game-overlay").classList.remove("hidden");
  }

  // ---- Input ----
  function angleFromPointer(clientX, clientY) {
    const dx = clientX - arena.cx;
    const dy = clientY - arena.cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }

  function handlePointerMove(e) {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    keeper.targetAngleDeg = angleFromPointer(clientX, clientY);
  }

  canvas.addEventListener("mousemove", handlePointerMove);
  canvas.addEventListener("touchmove", (e) => {
    handlePointerMove(e);
    e.preventDefault();
  }, { passive: false });

  document.getElementById("quit-btn").addEventListener("click", quit);
  document.getElementById("overlay-retry").addEventListener("click", () => {
    document.getElementById("game-overlay").classList.add("hidden");
    start(song);
  });
  document.getElementById("overlay-exit").addEventListener("click", () => {
    document.getElementById("game-overlay").classList.add("hidden");
    ScreenManager.show("select");
    LevelSelect.refresh();
  });

  window.addEventListener("resize", () => {
    if (document.getElementById("screen-game").classList.contains("active")) {
      resizeCanvas();
    }
  });

  function resizeCanvas() {
    const wrap = document.getElementById("arena-wrap");
    const size = Math.min(wrap.clientWidth, wrap.clientHeight) * 0.94;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * DPR;
    canvas.height = size * DPR;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const rect = canvas.getBoundingClientRect();
    arena.cx = rect.left + rect.width / 2;
    arena.cy = rect.top + rect.height / 2;
    arena.outerR = size * 0.46;
    arena.deadR = size * 0.16;
    keeperRadius = arena.deadR * 1.35;
  }

  // ---- Main Loop ----
  function loop() {
    if (!running) return;
    const t = audio.currentTime;

    update(t);
    render(t);

    rafId = requestAnimationFrame(loop);
  }

  function update(t) {
    // End the level once the chart's authored duration is reached, rather
    // than relying solely on audio.onended — the underlying mp3 file can
    // run longer than the chart, which would otherwise leave the player
    // stuck in the level with nothing left to do.
    if (running && chart && chart.duration && t >= chart.duration) {
      finish(true);
      return;
    }

    // smooth keeper angle toward target (shortest path)
    let diff = shortestAngleDiff(keeper.angleDeg, keeper.targetAngleDeg);
    keeper.angleDeg += diff * 0.28;
    keeper.angleDeg = ((keeper.angleDeg % 360) + 360) % 360;

    for (const note of notes) {
      if (note.resolved) continue;
      if (t < note.spawnTime) continue;

      const progress = (t - note.spawnTime) / TRAVEL_TIME; // 0..1+
      note.progress = progress;

      if (progress >= 1) {
        // arrived at / past dead zone — resolve
        resolveNote(note, t);
      }
    }

    for (const cue of activeCues) {
      if (!cue.shown && t >= cue.time) {
        cue.shown = true;
        showTutorialCue(cue.text);
      }
    }
  }

  function showTutorialCue(text) {
    if (!cueEl) return;
    cueEl.textContent = text;
    cueEl.classList.add("visible");
    clearTimeout(cueHideTimeout);
    cueHideTimeout = setTimeout(() => {
      cueEl.classList.remove("visible");
    }, 3000);
  }

  function shortestAngleDiff(a, b) {
    let diff = (b - a + 540) % 360 - 180;
    return diff;
  }

  function finalAngleForNote(note) {
    // Must match the angle drawNote() renders the ball at when progress reaches 1,
    // so curve notes are judged at the position the player actually sees.
    let angleDeg = note.angle;
    if (note.type === "curve_left") angleDeg -= 40;
    else if (note.type === "curve_right") angleDeg += 40;
    return angleDeg;
  }

  function resolveNote(note, t) {
    note.resolved = true;
    const timingError = Math.abs(t - note.targetTime);

    const keeperAngleAtHit = keeper.angleDeg;
    const arrivalAngle = finalAngleForNote(note);
    const angleDiff = Math.abs(shortestAngleDiff(keeperAngleAtHit, arrivalAngle));

    // hit window: goalkeeper coverage arc widens slightly for "double" (two-handed reach)
    const coverageArc = note.type === "double" ? 52 : 40;

    const withinArc = angleDiff <= coverageArc;
    const withinTime = timingError <= HIT_WINDOW + TRAVEL_TIME * 0.001;

    if (withinArc) {
      // SAVE
      note.hit = true;
      hits++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);

      const timingBonus = Math.max(0, 1 - timingError / HIT_WINDOW);
      const base = 100;
      const comboMult = 1 + Math.min(combo, 50) * 0.02;
      score += Math.round(base * (0.6 + 0.4 * timingBonus) * comboMult);

      saveFlashUntil = performance.now() + SAVE_FLASH_TIME * 1000;
      saveFlashSide = arrivalAngle;

      updateHud();
    } else {
      // GOAL CONCEDED — ball reached dead zone unguarded
      missedNotes++;
      combo = 0;
      updateHud();
      triggerLoseFlash();
      setTimeout(() => finish(false), 550);
      running = false; // stop updates immediately; render one more frame for flash
    }
  }

  function updateHud() {
    document.getElementById("hud-score").textContent = score.toLocaleString();
    const comboEl = document.getElementById("hud-combo");
    comboEl.textContent = combo > 1 ? `${combo}x COMBO` : "";
  }

let loseFlashUntil = 0;
  function triggerLoseFlash() {
    audio.pause();
    loseFlashUntil = performance.now() + 500;
    running = true;
    const flashLoop = () => {
      render(audio.currentTime);
      if (performance.now() < loseFlashUntil) {
        requestAnimationFrame(flashLoop);
      } else {
        running = false;
      }
    };
    requestAnimationFrame(flashLoop);
  }

  // ---- Rendering ----
  function render(t) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const outerR = arena.outerR;
    const deadR = arena.deadR;

    // subtle arena backdrop glow
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR * 1.1);
    bgGrad.addColorStop(0, "rgba(122, 19, 80, 0.18)");
    bgGrad.addColorStop(1, "rgba(10, 4, 16, 0)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // outer ring (arena boundary) — ring.png tinted via composite + glow
    drawRing(cx, cy, outerR * 2, "rgba(255, 111, 176, 0.9)", 10);

    // dead zone ring (smaller, danger tint)
    const loseFlashActive = performance.now() < loseFlashUntil;
    drawRing(cx, cy, deadR * 2, loseFlashActive ? "rgba(255, 59, 92, 1)" : "rgba(214, 38, 110, 0.85)", 18);

    // dead zone fill
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, deadR, 0, Math.PI * 2);
    const dzGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, deadR);
    dzGrad.addColorStop(0, loseFlashActive ? "rgba(255, 59, 92, 0.35)" : "rgba(255, 47, 143, 0.12)");
    dzGrad.addColorStop(1, "rgba(255, 47, 143, 0.02)");
    ctx.fillStyle = dzGrad;
    ctx.fill();
    ctx.restore();

    // notes (balls)
    for (const note of notes) {
      if (note.resolved || note.progress === undefined) continue;
      if (note.progress < 0) continue;
      drawNote(note, cx, cy, outerR, deadR, t);
    }

    // save flash ring pulse
    if (performance.now() < saveFlashUntil) {
      const p = 1 - (saveFlashUntil - performance.now()) / (SAVE_FLASH_TIME * 1000);
      const rad = (Math.PI / 180) * saveFlashSide;
      const fx = cx + Math.cos(rad) * keeperRadius;
      const fy = cy + Math.sin(rad) * keeperRadius;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(fx, fy, 20 + p * 40, 0, Math.PI * 2);
      ctx.strokeStyle = "#38f0b0";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // goalkeeper
    drawKeeper(cx, cy);
  }

  function drawRing(cx, cy, diameter, tintColor, glowBlur) {
    if (!assets.ring) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = tintColor;
    ctx.shadowBlur = glowBlur;
    // Draw ring image multiple times to build up visible opacity (source asset is very faint)
    const size = diameter;
    for (let i = 0; i < 6; i++) {
      ctx.drawImage(assets.ring, -size / 2, -size / 2, size, size);
    }
    // colored overlay using 'source-atop' to tint within ring's alpha shape
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = tintColor;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawNote(note, cx, cy, outerR, deadR, t) {
    const p = Math.min(Math.max(note.progress, 0), 1);
    const dist = outerR - (outerR - deadR) * p;

    let angleDeg = note.angle;
    // curve types bend their path angularly as they travel
    if (note.type === "curve_left") {
      angleDeg -= 40 * p;
    } else if (note.type === "curve_right") {
      angleDeg += 40 * p;
    }

    const rad = (Math.PI / 180) * angleDeg;
    const x = cx + Math.cos(rad) * dist;
    const y = cy + Math.sin(rad) * dist;

    const ballSize = 34 + p * 10;

    ctx.save();
    ctx.translate(x, y);

    // color cue by type via glow
    let glow = "rgba(255,255,255,0.5)";
    if (note.type === "double") glow = "rgba(255, 59, 92, 0.7)";
    else if (note.type === "curve_left" || note.type === "curve_right") glow = "rgba(255, 111, 176, 0.7)";

    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;

    if (note.type === "double") {
      // render two staggered balls to signal a double-note
      ctx.drawImage(assets.ball, -ballSize / 2 - 6, -ballSize / 2, ballSize, ballSize);
      ctx.drawImage(assets.ball, -ballSize / 2 + 6, -ballSize / 2, ballSize, ballSize);
    } else {
      ctx.drawImage(assets.ball, -ballSize / 2, -ballSize / 2, ballSize, ballSize);
    }
    ctx.restore();
  }

  function drawKeeper(cx, cy) {
    const rad = (Math.PI / 180) * keeper.angleDeg;
    const x = cx + Math.cos(rad) * keeperRadius;
    const y = cy + Math.sin(rad) * keeperRadius;

    const size = 74;

    // Save-lunge: briefly nudge the sprite outward toward the last save's
    // direction while it faces the direction it's currently covering.
    let lungeScale = 1;
    if (performance.now() < saveFlashUntil) {
      const remaining = (saveFlashUntil - performance.now()) / (SAVE_FLASH_TIME * 1000);
      lungeScale = 1 + 0.18 * remaining;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(lungeScale, lungeScale);
    // Face outward toward wherever the keeper currently is on the ring —
    // e.g. on the left side it looks left, at the bottom it looks down —
    // instead of a fixed rotation. The sprite's art faces "up" (screen
    // angle 270°) at 0° rotation, so offset by +90° to align it with
    // keeper.angleDeg (0°=right, 90°=down, 180°=left, 270°=up).
    ctx.rotate(((keeper.angleDeg + 90) * Math.PI) / 180);
    ctx.shadowColor = "rgba(255, 47, 143, 0.6)";
    ctx.shadowBlur = 12;
    ctx.drawImage(assets.goalkeeper, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  return { start, quit };
})();

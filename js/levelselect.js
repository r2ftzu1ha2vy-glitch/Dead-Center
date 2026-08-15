/* =========================================================
   Level Select screen
   ========================================================= */

const LevelSelect = (function () {
  let selectedSong = null;

  function init() {
    document.getElementById("back-to-menu").addEventListener("click", () => {
      ScreenManager.show("menu");
    });

    document.getElementById("start-song-btn").addEventListener("click", () => {
      if (selectedSong) {
        Game.start(selectedSong);
      }
    });

    render();
  }

  function render() {
    const songs = SongLibrary.getAll();
    const listEl = document.getElementById("song-list");
    listEl.innerHTML = "";

    if (songs.length === 0) {
      listEl.innerHTML = `
        <div class="song-list-empty">
          No tracks found.<br/>
          Drop an .mp3 file into <b>/songs/</b> and register its filename
          in <b>js/songs.js</b> — a chart, cover, and level entry are
          generated automatically.
        </div>`;
      updateLeftPanel(null);
      return;
    }

    songs.forEach((song, idx) => {
      const row = document.createElement("div");
      row.className = "song-row";
      row.dataset.id = song.id;

      const pct = SongLibrary.getCompletion(song.id);

      row.innerHTML = `
        <img class="song-row-cover" src="${song.cover}" alt="" />
        <div class="song-row-info">
          <div class="song-row-title">${escapeHtml(song.name)}</div>
          <div class="song-row-sub">Track ${idx + 1}</div>
        </div>
        <div class="song-row-pct">${pct.toFixed(1)}%</div>
      `;

      row.addEventListener("click", () => selectSong(song.id));
      listEl.appendChild(row);
    });

    // auto-select first song
    selectSong(songs[0].id);
  }

  function selectSong(id) {
    selectedSong = SongLibrary.getById(id);

    document.querySelectorAll(".song-row").forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === id);
    });

    updateLeftPanel(selectedSong);
  }

  function updateLeftPanel(song) {
    const coverEl = document.getElementById("sel-cover");
    const titleEl = document.getElementById("sel-title");
    const completionEl = document.getElementById("sel-completion");
    const highscoreEl = document.getElementById("sel-highscore");
    const startBtn = document.getElementById("start-song-btn");

    if (!song) {
      coverEl.src = "";
      titleEl.textContent = "";
      completionEl.textContent = "0.000%";
      highscoreEl.textContent = "—";
      startBtn.style.opacity = "0.4";
      startBtn.style.pointerEvents = "none";
      return;
    }

    startBtn.style.opacity = "1";
    startBtn.style.pointerEvents = "auto";

    coverEl.style.opacity = "0";
    setTimeout(() => {
      coverEl.src = song.cover;
      coverEl.style.opacity = "1";
    }, 120);

    titleEl.textContent = song.name;

    const pct = SongLibrary.getCompletion(song.id);
    completionEl.textContent = pct.toFixed(3) + "%";

    const hs = SongLibrary.getHighScore(song.id);
    highscoreEl.textContent = hs === null ? "—" : hs.toLocaleString();
  }

  function refresh() {
    render();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, refresh };
})();

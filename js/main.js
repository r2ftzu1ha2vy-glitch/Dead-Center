/* =========================================================
   Screen Manager + App Bootstrap
   ========================================================= */

const ScreenManager = (function () {
  const screens = {
    menu: document.getElementById("screen-menu"),
    select: document.getElementById("screen-select"),
    game: document.getElementById("screen-game"),
  };

  const menuAudio = document.getElementById("menu-audio-player");
  menuAudio.volume = 0.5;

  let current = "menu";

  function show(name) {
    if (!screens[name]) return;
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle("active", key === name);
    });
    current = name;

    if (name === "menu") {
      menuAudio.volume = 0.5;
      menuAudio.play().catch(() => {
        // autoplay blocked until a user gesture happens — the unlock
        // listener below will start it as soon as the person interacts.
      });
    } else if (name === "select") {
      // Level select plays a preview of the selected song instead of the
      // menu theme, so keep the menu track running (for a seamless loop)
      // but silent.
      menuAudio.volume = 0;
      menuAudio.play().catch(() => {});
    } else {
      menuAudio.pause();
    }

    if (name !== "select") {
      LevelSelect.stopPreview();
    }

    if (name === "select") {
      LevelSelect.refresh();
    }
  }

  // Browsers block audio.play() before any user gesture on the page.
  // Catch the first click/keydown/touch anywhere and, if we're still on
  // the menu, (re)start the menu music then.
  function unlockAudioOnce() {
    if ((current === "menu" || current === "select") && menuAudio.paused) {
      menuAudio.play().catch(() => {});
    }
    window.removeEventListener("pointerdown", unlockAudioOnce);
    window.removeEventListener("keydown", unlockAudioOnce);
  }
  window.addEventListener("pointerdown", unlockAudioOnce);
  window.addEventListener("keydown", unlockAudioOnce);

  function getCurrent() {
    return current;
  }

  return { show, getCurrent };
})();

document.addEventListener("DOMContentLoaded", () => {
  Menu.init();
  LevelSelect.init();
  ScreenManager.show("menu");
});

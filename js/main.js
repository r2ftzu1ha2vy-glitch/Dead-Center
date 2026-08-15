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
      menuAudio.play().catch(() => {
        // autoplay may be blocked until first user interaction; will retry on next show()
      });
    } else {
      menuAudio.pause();
    }

    if (name === "select") {
      LevelSelect.refresh();
    }
  }

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

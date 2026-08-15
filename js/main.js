/* =========================================================
   Screen Manager + App Bootstrap
   ========================================================= */

const ScreenManager = (function () {
  const screens = {
    menu: document.getElementById("screen-menu"),
    select: document.getElementById("screen-select"),
    game: document.getElementById("screen-game"),
  };

  let current = "menu";

  function show(name) {
    if (!screens[name]) return;
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle("active", key === name);
    });
    current = name;

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

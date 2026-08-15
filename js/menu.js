/* =========================================================
   Main Menu logic
   ========================================================= */

const Menu = (function () {
  function init() {
    const playBtn = document.getElementById("play-btn");
    playBtn.addEventListener("click", () => {
      ScreenManager.show("select");
    });
  }
  return { init };
})();

/* =========================================================
   Animated background — floating rotated squares (diamonds)
   Decorative, low opacity, dark pink tones, parallax float
   ========================================================= */

(function () {
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const COLORS = [
    "rgba(255, 47, 143, ALPHA)",
    "rgba(214, 38, 110, ALPHA)",
    "rgba(122, 19, 80, ALPHA)",
    "rgba(92, 42, 138, ALPHA)",
  ];

  function makeDiamond() {
    const size = 40 + Math.random() * 160;
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      size,
      baseAlpha: 0.03 + Math.random() * 0.07,
      speedX: (Math.random() - 0.5) * 6,
      speedY: -(6 + Math.random() * 10),
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.05,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      phase: Math.random() * Math.PI * 2,
    };
  }

  const NUM = 26;
  let diamonds = Array.from({ length: NUM }, makeDiamond);

  let last = performance.now();

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    ctx.clearRect(0, 0, W, H);

    for (const d of diamonds) {
      d.y += d.speedY * dt;
      d.x += d.speedX * dt;
      d.rot += d.rotSpeed * dt;
      d.phase += dt * 0.5;

      // wrap around
      if (d.y < -d.size * 1.5) {
        d.y = H + d.size;
        d.x = Math.random() * W;
      }
      if (d.x < -d.size * 1.5) d.x = W + d.size;
      if (d.x > W + d.size * 1.5) d.x = -d.size;

      const flicker = 0.8 + Math.sin(d.phase) * 0.2;
      const alpha = d.baseAlpha * flicker;

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot + Math.PI / 4); // 45deg base rotation (diamond)
      ctx.fillStyle = d.color.replace("ALPHA", alpha.toFixed(3));
      const s = d.size;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();

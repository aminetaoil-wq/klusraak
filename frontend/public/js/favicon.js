// Animated favicon. Every ~80 ms (≈12 fps) we redraw a 32×32 canvas
// and swap the <link rel="icon"> href to its PNG data URL. This is the
// only approach that animates across Chrome, Firefox, Safari, and Edge —
// animated GIF favicons render only on Firefox, animated SVG only on
// Safari, so canvas + setLink is the lowest common denominator.
//
// Visual: a dark rounded badge with a white "K" wordmark and a brand-
// orange arc that sweeps the perimeter once every 1.6 s. Pauses while
// the tab is hidden (visibilitychange) to keep the CPU honest.
(function () {
  const FPS = 12;
  const TICK_MS = 1000 / FPS;
  const PERIOD_MS = 1600;
  const SIZE = 32;
  const ARC_LEN = Math.PI * 0.55;
  const BG = '#0d0d0d';
  const FG = '#ffffff';
  const ACCENT = '#ff7a1a';

  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(phase) {
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Rounded badge background.
    ctx.fillStyle = BG;
    roundRect(1, 1, SIZE - 2, SIZE - 2, 7);
    ctx.fill();

    // Letter mark.
    ctx.fillStyle = FG;
    ctx.font = 'bold 18px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('K', SIZE / 2, SIZE / 2 + 1);

    // Sweeping accent arc. Starts at 12 o'clock and moves clockwise.
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = ACCENT;
    const start = phase - Math.PI / 2;
    const end = start + ARC_LEN;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 3, start, end);
    ctx.stroke();
  }

  let raf = 0;
  let lastDraw = 0;
  let t0 = 0;

  function tick(now) {
    if (!t0) t0 = now;
    if (now - lastDraw >= TICK_MS) {
      const phase = ((now - t0) % PERIOD_MS) / PERIOD_MS * Math.PI * 2;
      draw(phase);
      link.href = canvas.toDataURL('image/png');
      lastDraw = now;
    }
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf) return;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  // Start as soon as the script runs; the canvas API needs no DOM beyond
  // <head>, which is already present at this point in the load order.
  start();
})();

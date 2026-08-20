// ============================================================
// A small confetti burst, built with the Web Animations API so
// each piece gets its own randomized trajectory without needing
// to generate dynamic @keyframes. No external library.
// ============================================================

export function fireConfetti(colors, opts = {}) {
  const count = opts.count ?? 150;
  const vh = window.innerHeight;

  const container = document.createElement("div");
  container.className = "confetti-container";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    // spawn across the top of the screen, like real confetti raining down
    // spread pieces across a tall band ABOVE the screen (never inside it),
    // so everything visibly falls in from above — staggered deep enough
    // that once falling, they still fill the whole screen at once.
    const startOffsetPct = 10 + Math.random() * 120; // 10%–130% of viewport height above the top edge
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = `${-startOffsetPct}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${5 + Math.random() * 6}px`;
    piece.style.height = `${8 + Math.random() * 10}px`;
    piece.style.borderRadius = Math.random() < 0.5 ? "50%" : "2px";
    container.appendChild(piece);

    // A wide sideways sway partway through the fall, for a more organic,
    // wind-blown look rather than a straight drop. Total travel accounts
    // for each piece's own starting offset, so pieces that start deeper
    // above the screen still fully cross it and exit below — at the same
    // visual speed as pieces that started just above the top edge.
    const startOffsetPx = (startOffsetPct / 100) * vh;
    const totalFall = startOffsetPx + vh * (1.05 + Math.random() * 0.25);
    const swayDx = Math.random() * 220 - 110;
    const swayDy = totalFall * 0.55;

    const finalDx = swayDx + (Math.random() * 260 - 130);
    const finalDy = totalFall;

    const rot = (720 + Math.random() * 1440) * (Math.random() < 0.5 ? -1 : 1);
    // Duration scales with distance so every piece falls at roughly the
    // same speed, however far above the screen it started.
    const FALL_SPEED = (1.15 * vh) / 7000; // px per ms, calibrated to the original feel
    const duration = (totalFall / FALL_SPEED) * (0.85 + Math.random() * 0.3);
    const delay = Math.random() * 450;

    piece.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1, offset: 0 },
        { transform: `translate(calc(-50% + ${swayDx}px), calc(-50% + ${swayDy}px)) rotate(${rot * 0.55}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${finalDx}px), calc(-50% + ${finalDy}px)) rotate(${rot}deg)`, opacity: 0, offset: 1 },
      ],
      { duration, delay, easing: "cubic-bezier(.15,.5,.25,1)", fill: "forwards" },
    );
  }

  setTimeout(() => container.remove(), 10200);
}

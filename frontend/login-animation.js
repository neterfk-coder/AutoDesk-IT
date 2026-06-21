// ── ResolveAI Premium Login Animation ────────────────────────────────────────
(function () {
  const canvas = document.getElementById("login-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W,
    H,
    frame = 0;
  let particles = [],
    nodes = [],
    codeLines = [];
  let mouse = { x: -999, y: -999 };

  const COLORS = ["#3b82f6", "#7c3aed", "#0d9488", "#06b6d4", "#10b981"];

  // ── Resize ──────────────────────────────────────────────────────────────────
  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    init();
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.5 + 0.15,
      pulse: Math.random() * Math.PI * 2,
    }));

    nodes = Array.from({ length: 10 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 4 + 3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0,
      targetAlpha: Math.random() * 0.7 + 0.3,
      pulse: Math.random() * Math.PI * 2,
    }));

    codeLines = Array.from({ length: 8 }, (_, i) => ({
      x: (W / 8) * i + Math.random() * (W / 8),
      y: Math.random() * H,
      speed: Math.random() * 1.2 + 0.4,
      chars: randomChars(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.12 + 0.04,
    }));
  }

  function randomChars() {
    return Array.from({ length: Math.floor(Math.random() * 7) + 4 }, () =>
      String.fromCharCode(33 + Math.floor(Math.random() * 93)),
    );
  }

  // ── Mouse ────────────────────────────────────────────────────────────────────
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });

  canvas.addEventListener("mouseleave", () => {
    mouse.x = -999;
    mouse.y = -999;
  });

  // ── Draw Aurora ──────────────────────────────────────────────────────────────
  function drawAurora() {
    const t = frame * 0.007;

    const blobs = [
      {
        cx: 0.25 + Math.sin(t) * 0.15,
        cy: 0.3 + Math.cos(t * 0.8) * 0.15,
        color: "59,130,246",
        a: 0.055,
      },
      {
        cx: 0.75 + Math.cos(t * 0.9) * 0.12,
        cy: 0.65 + Math.sin(t * 0.6) * 0.15,
        color: "124,58,237",
        a: 0.045,
      },
      {
        cx: 0.5 + Math.sin(t * 1.1) * 0.1,
        cy: 0.15 + Math.cos(t * 1.3) * 0.1,
        color: "13,148,136",
        a: 0.035,
      },
      {
        cx: 0.15 + Math.cos(t * 0.7) * 0.1,
        cy: 0.8 + Math.sin(t * 0.9) * 0.1,
        color: "6,182,212",
        a: 0.03,
      },
    ];

    blobs.forEach((b) => {
      const g = ctx.createRadialGradient(
        W * b.cx,
        H * b.cy,
        0,
        W * b.cx,
        H * b.cy,
        W * 0.55,
      );
      g.addColorStop(0, `rgba(${b.color},${b.a})`);
      g.addColorStop(0.5, `rgba(${b.color},${b.a * 0.4})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
  }

  // ── Draw Grid ────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.strokeStyle = "rgba(30,42,63,0.45)";
    ctx.lineWidth = 0.5;
    const s = 48;

    for (let x = 0; x < W; x += s) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += s) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── Draw Code Rain ───────────────────────────────────────────────────────────
  function drawCodeRain() {
    codeLines.forEach((line) => {
      line.y += line.speed;
      if (line.y > H + 120) {
        line.y = -80;
        line.chars = randomChars();
      }
      if (frame % 18 === 0) {
        const i = Math.floor(Math.random() * line.chars.length);
        line.chars[i] = String.fromCharCode(
          33 + Math.floor(Math.random() * 93),
        );
      }

      ctx.font = "11px JetBrains Mono, monospace";
      line.chars.forEach((ch, i) => {
        const a = Math.max(0, line.alpha - i * 0.012);
        ctx.globalAlpha = a;
        ctx.fillStyle = line.color;
        ctx.fillText(ch, line.x, line.y - i * 15);
      });
    });
    ctx.globalAlpha = 1;
  }

  // ── Draw Particles ───────────────────────────────────────────────────────────
  function drawParticles() {
    particles.forEach((p) => {
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 90 && dist > 0) {
        p.vx += (dx / dist) * 0.25;
        p.vy += (dy / dist) * 0.25;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.pulse += 0.035;

      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      const a = p.alpha * (0.65 + Math.sin(p.pulse) * 0.35);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
  }

  // ── Draw Network ─────────────────────────────────────────────────────────────
  function drawNetwork() {
    nodes.forEach((n) => {
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += 0.018;
      n.alpha = Math.min(n.alpha + 0.008, n.targetAlpha);
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });

    // Connections
    nodes.forEach((a, i) => {
      nodes.slice(i + 1).forEach((b, j) => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist > 200) return;
        const alpha = (1 - dist / 200) * 0.22;

        ctx.save();
        ctx.setLineDash([4, 9]);
        ctx.lineDashOffset = -(frame * 0.4);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(
          0,
          a.color +
            Math.round(alpha * 255)
              .toString(16)
              .padStart(2, "0"),
        );
        g.addColorStop(
          1,
          b.color +
            Math.round(alpha * 255)
              .toString(16)
              .padStart(2, "0"),
        );
        ctx.strokeStyle = g;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();

        // Data packet
        const pk = (frame + i * 17 + j * 31) % 90;
        if (pk < 90) {
          const t = pk / 90;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = a.color;
          ctx.globalAlpha = 0.7 * alpha * 4;
          ctx.shadowColor = a.color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      });
    });

    // Nodes
    nodes.forEach((n) => {
      const pulse = Math.sin(n.pulse) * 3;

      // Ring
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + pulse + 5, 0, Math.PI * 2);
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = n.alpha * 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Glow
      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r + 10);
      grd.addColorStop(0, n.color + "bb");
      grd.addColorStop(1, n.color + "00");
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 10, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.globalAlpha = n.alpha * 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Core
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = n.alpha;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
  }

  // ── Draw Labels ──────────────────────────────────────────────────────────────
  function drawLabels() {
    const labels = [
      { text: "UiPath Maestro", x: W * 0.08, y: H * 0.1 },
      { text: "Groq AI ⚡", x: W * 0.58, y: H * 0.16 },
      { text: "Firebase RT", x: W * 0.06, y: H * 0.84 },
      { text: "ServiceNow", x: W * 0.55, y: H * 0.8 },
      { text: "Slack API", x: W * 0.72, y: H * 0.46 },
      { text: "✓ Auto-resolve", x: W * 0.04, y: H * 0.52 },
    ];

    ctx.font = "10px Inter, sans-serif";
    labels.forEach((l, i) => {
      const t = frame * 0.007 + i * 1.1;
      const y = l.y + Math.sin(t) * 5;
      const a = 0.2 + Math.sin(t * 0.6) * 0.08;
      const tw = ctx.measureText(l.text).width;
      const col = COLORS[i % COLORS.length];

      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(8,12,20,0.75)";
      ctx.beginPath();
      ctx.roundRect(l.x - 7, y - 13, tw + 14, 20, 5);
      ctx.fill();

      ctx.strokeStyle = col + "55";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.globalAlpha = a * 1.8;
      ctx.fillText(l.text, l.x, y);
      ctx.globalAlpha = 1;
    });
  }

  // ── Scan line ────────────────────────────────────────────────────────────────
  function drawScanLine() {
    const y = (frame * 1.0) % H;
    const g = ctx.createLinearGradient(0, y - 24, 0, y + 24);
    g.addColorStop(0, "rgba(59,130,246,0)");
    g.addColorStop(0.5, "rgba(59,130,246,0.035)");
    g.addColorStop(1, "rgba(59,130,246,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 24, W, 48);
  }

  // ── Corner brackets ──────────────────────────────────────────────────────────
  function drawCorners() {
    const s = 22;
    const a = 0.5 + Math.sin(frame * 0.04) * 0.15;
    const col = `rgba(59,130,246,${a})`;

    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;

    const corners = [
      [0, 0, 1, 1],
      [W, 0, -1, 1],
      [0, H, 1, -1],
      [W, H, -1, -1],
    ];

    corners.forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x + sx * s, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * s);
      ctx.stroke();
    });
  }

  // ── Loop ─────────────────────────────────────────────────────────────────────
  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawAurora();
    drawGrid();
    drawCodeRain();
    drawParticles();
    drawNetwork();
    drawLabels();
    drawScanLine();
    drawCorners();
    frame++;
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  loop();
})();

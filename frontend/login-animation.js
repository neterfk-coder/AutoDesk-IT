// ── Login Canvas Animation — Real-time Ticket Graph ───────────────────────────
(function () {
  const canvas = document.getElementById("login-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W, H, bars, line, particles, frame;

  // ── Colors ──────────────────────────────────────────────────────────────────
  const C = {
    accent: "#3b82f6",
    purple: "#7c3aed",
    teal: "#0d9488",
    green: "#16a34a",
    amber: "#d97706",
    red: "#dc2626",
    text: "rgba(226,234,247,0.6)",
    grid: "rgba(30,42,63,0.8)",
    bg: "rgba(8,12,20,0)",
  };

  // ── Resize ───────────────────────────────────────────────────────────────────
  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    init();
  }

  // ── Init data ────────────────────────────────────────────────────────────────
  function init() {
    // Bar chart data — simulates ticket volume per hour
    const categories = ["Network", "Software", "Hardware", "Access", "Other"];
    bars = categories.map((cat, i) => ({
      label: cat,
      value: 0.2 + Math.random() * 0.7,
      target: 0.2 + Math.random() * 0.7,
      color: [C.accent, C.purple, C.teal, C.amber, C.green][i],
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    }));

    // Line chart — ticket resolution rate over time
    line = {
      points: Array.from({ length: 30 }, (_, i) => ({
        x: i,
        y: 0.3 + Math.sin(i * 0.4) * 0.2 + Math.random() * 0.15,
      })),
      color: C.accent,
    };

    // Floating particles — represent active tickets
    particles = Array.from({ length: 18 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1.5 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color: [C.accent, C.purple, C.teal, C.green, C.amber][
        Math.floor(Math.random() * 5)
      ],
      alpha: 0.3 + Math.random() * 0.5,
    }));
  }

  // ── Update ───────────────────────────────────────────────────────────────────
  function update() {
    // Animate bar values toward targets
    bars.forEach((b) => {
      b.value += (b.target - b.value) * 0.03;
      if (Math.abs(b.value - b.target) < 0.01) {
        b.target = 0.15 + Math.random() * 0.75;
      }
    });

    // Shift line chart left and add new point
    if (frame % 40 === 0) {
      line.points.shift();
      const last = line.points[line.points.length - 1];
      line.points.push({
        x: last.x + 1,
        y: Math.max(
          0.05,
          Math.min(0.95, last.y + (Math.random() - 0.48) * 0.12),
        ),
      });
    }

    // Move particles
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      p.alpha = 0.2 + Math.sin(frame * 0.02 + p.x) * 0.15;
    });
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);

    drawGrid();
    drawParticles();
    drawBarChart();
    drawLineChart();
    drawLabels();
    drawStatusDots();
  }

  function drawGrid() {
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.5;

    const cols = 8,
      rows = 6;
    for (let i = 0; i <= cols; i++) {
      const x = (W / cols) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      const y = (H / rows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawParticles() {
    // Draw connections between nearby particles
    particles.forEach((p, i) => {
      particles.slice(i + 1).forEach((q) => {
        const dist = Math.hypot(p.x - q.x, p.y - q.y);
        if (dist < 80) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(59,130,246,${0.08 * (1 - dist / 80)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      });
    });

    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle =
        p.color +
        Math.round(p.alpha * 255)
          .toString(16)
          .padStart(2, "0");
      ctx.fill();
    });
  }

  function drawBarChart() {
    const chartW = W * 0.38;
    const chartH = H * 0.28;
    const chartX = W * 0.08;
    const chartY = H * 0.58;
    const barW = (chartW / bars.length) * 0.6;
    const gap = chartW / bars.length;

    // Chart background
    ctx.fillStyle = "rgba(15,22,35,0.6)";
    ctx.beginPath();
    ctx.roundRect(chartX - 12, chartY - 20, chartW + 24, chartH + 36, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = C.text;
    ctx.font = `500 10px Inter, sans-serif`;
    ctx.fillText("TICKETS BY CATEGORY", chartX, chartY - 8);

    bars.forEach((b, i) => {
      const x = chartX + i * gap + (gap - barW) / 2;
      const h = chartH * b.value;
      const y = chartY + chartH - h;

      // Bar background
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath();
      ctx.roundRect(x, chartY, barW, chartH, 3);
      ctx.fill();

      // Bar fill with gradient
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, b.color + "cc");
      grad.addColorStop(1, b.color + "33");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, 3);
      ctx.fill();

      // Glow
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color + "44";
      ctx.beginPath();
      ctx.roundRect(x, y, barW, 3, 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Value
      ctx.fillStyle = C.text;
      ctx.font = `600 9px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(Math.round(b.value * 100), x + barW / 2, y - 4);

      // Label
      ctx.font = `400 8px Inter, sans-serif`;
      ctx.fillStyle = "rgba(226,234,247,0.4)";
      ctx.fillText(b.label.slice(0, 4), x + barW / 2, chartY + chartH + 12);
    });

    ctx.textAlign = "left";
  }

  function drawLineChart() {
    const chartW = W * 0.38;
    const chartH = H * 0.22;
    const chartX = W * 0.54;
    const chartY = H * 0.58;

    // Background
    ctx.fillStyle = "rgba(15,22,35,0.6)";
    ctx.beginPath();
    ctx.roundRect(chartX - 12, chartY - 20, chartW + 24, chartH + 36, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = C.text;
    ctx.font = `500 10px Inter, sans-serif`;
    ctx.fillText("RESOLUTION RATE", chartX, chartY - 8);

    if (line.points.length < 2) return;

    const minX = line.points[0].x;
    const maxX = line.points[line.points.length - 1].x;
    const scaleX = (p) => chartX + ((p.x - minX) / (maxX - minX)) * chartW;
    const scaleY = (p) => chartY + chartH - p.y * chartH;

    // Area fill
    const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
    grad.addColorStop(0, C.accent + "40");
    grad.addColorStop(1, C.accent + "00");

    ctx.beginPath();
    ctx.moveTo(scaleX(line.points[0]), chartY + chartH);
    line.points.forEach((p) => ctx.lineTo(scaleX(p), scaleY(p)));
    ctx.lineTo(scaleX(line.points[line.points.length - 1]), chartY + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(scaleX(line.points[0]), scaleY(line.points[0]));
    line.points.forEach((p) => ctx.lineTo(scaleX(p), scaleY(p)));
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Last point dot
    const last = line.points[line.points.length - 1];
    ctx.beginPath();
    ctx.arc(scaleX(last), scaleY(last), 4, 0, Math.PI * 2);
    ctx.fillStyle = C.accent;
    ctx.shadowColor = C.accent;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Current value
    const pct = Math.round(last.y * 100);
    ctx.fillStyle = "#86efac";
    ctx.font = `700 13px Inter, sans-serif`;
    ctx.fillText(`${pct}%`, chartX + chartW - 28, chartY - 8);
  }

  function drawLabels() {
    // Top metrics row
    const metrics = [
      {
        label: "Active",
        value: Math.floor(12 + Math.sin(frame * 0.02) * 3),
        color: C.accent,
      },
      {
        label: "Resolved",
        value: Math.floor(48 + Math.sin(frame * 0.015) * 5),
        color: "#86efac",
      },
      {
        label: "Escalated",
        value: Math.floor(3 + Math.sin(frame * 0.03) * 1),
        color: C.amber,
      },
      {
        label: "Critical",
        value: Math.floor(1 + Math.abs(Math.sin(frame * 0.04))),
        color: "#fca5a5",
      },
    ];

    const metW = W * 0.18;
    const metY = H * 0.08;
    const startX = W * 0.08;

    metrics.forEach((m, i) => {
      const x = startX + i * (metW + 8);

      ctx.fillStyle = "rgba(15,22,35,0.7)";
      ctx.beginPath();
      ctx.roundRect(x, metY, metW, 46, 6);
      ctx.fill();

      ctx.strokeStyle = m.color + "44";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, metY, metW, 46, 6);
      ctx.stroke();

      ctx.fillStyle = m.color;
      ctx.font = `700 18px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(m.value, x + metW / 2, metY + 26);

      ctx.fillStyle = "rgba(226,234,247,0.4)";
      ctx.font = `400 9px Inter, sans-serif`;
      ctx.fillText(m.label.toUpperCase(), x + metW / 2, metY + 40);
    });

    ctx.textAlign = "left";
  }

  function drawStatusDots() {
    // Animated status feed on the right side
    const feedX = W * 0.54;
    const feedY = H * 0.1;
    const feedW = W * 0.38;

    ctx.fillStyle = "rgba(15,22,35,0.6)";
    ctx.beginPath();
    ctx.roundRect(feedX - 12, feedY - 8, feedW + 24, H * 0.42, 8);
    ctx.fill();

    ctx.fillStyle = C.text;
    ctx.font = `500 10px Inter, sans-serif`;
    ctx.fillText("LIVE ACTIVITY", feedX, feedY + 4);

    const events = [
      { text: "VPN auth failure resolved", color: "#86efac", time: "0s ago" },
      { text: "BSOD escalated → human", color: "#fca5a5", time: "12s ago" },
      {
        text: "Printer fix script deployed",
        color: "#86efac",
        time: "28s ago",
      },
      { text: "Groq analysis complete", color: C.accent, time: "41s ago" },
      { text: "New ticket from Gmail", color: C.amber, time: "55s ago" },
      { text: "Slack notification sent", color: C.purple, time: "1m ago" },
      { text: "Jira issue #IT-291 created", color: C.teal, time: "2m ago" },
    ];

    events.forEach((e, i) => {
      const y = feedY + 22 + i * 26;
      const opacity = 1 - i * 0.1;
      const pulse = i === 0 ? Math.abs(Math.sin(frame * 0.08)) : 0;

      // Dot
      ctx.beginPath();
      ctx.arc(feedX + 5, y, 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle =
        e.color +
        Math.round((0.3 + pulse * 0.4) * 255)
          .toString(16)
          .padStart(2, "0");
      ctx.fill();

      ctx.beginPath();
      ctx.arc(feedX + 5, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = e.color;
      ctx.fill();

      // Text
      ctx.fillStyle = `rgba(226,234,247,${opacity * 0.8})`;
      ctx.font = `400 10px Inter, sans-serif`;
      ctx.fillText(e.text, feedX + 16, y + 4);

      // Time
      ctx.fillStyle = `rgba(77,98,128,${opacity})`;
      ctx.font = `400 9px Inter, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(e.time, feedX + feedW, y + 4);
      ctx.textAlign = "left";
    });
  }

  // ── Loop ──────────────────────────────────────────────────────────────────────
  frame = 0;
  function loop() {
    frame++;
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // ── Start ─────────────────────────────────────────────────────────────────────
  window.addEventListener("resize", resize);
  resize();
  loop();
})();

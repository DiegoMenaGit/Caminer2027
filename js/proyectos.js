(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const viewport = $("viewport");
  const canvas = $("canvas"); // capa DOM del contenido (se transforma)
  const peg = $("pegboard"); // capa <canvas> con el tablero dibujado
  const ctx = peg.getContext("2d");
  const btnIn = $("zoom-in");
  const btnOut = $("zoom-out");
  const btnRecenter = $("recenter");

  // ---- Configuración ----
  const GRID = 36; // separación entre agujeros (px de tablero)
  const BOARD_W = GRID * 220; // tamaño fijo, múltiplo de la rejilla
  const BOARD_H = GRID * 125;
  const OVERFLOW = 180; // margen que puedes salirte de los bordes
  const MAX_SCALE = 2.5;
  const TILE_SS = 4; // supersampling del azulejo del agujero
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  canvas.style.width = BOARD_W + "px";
  canvas.style.height = BOARD_H + "px";

  let scale = 1,
    panX = 0,
    panY = 0;
  let minScale = 0.1,
    vw = 0,
    vh = 0,
    dpr = 1;
  let raf = 0,
    animId = 0,
    home = null;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---- Texturas pre-renderizadas (se crean una sola vez) ----
  function makeHoleTile() {
    const s = GRID * TILE_SS,
      m = s / 2,
      r = s * 0.085;
    const t = document.createElement("canvas");
    t.width = t.height = s;
    const c = t.getContext("2d");

    // oclusión ambiental alrededor del agujero
    let g = c.createRadialGradient(m, m, r * 0.8, m, m, r * 2);
    g.addColorStop(0, "rgba(0,0,0,.65)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(m, m, r * 2, 0, Math.PI * 2);
    c.fill();

    // reborde iluminado en la parte inferior (bisel)
    c.strokeStyle = "rgba(255,255,255,.17)";
    c.lineWidth = s * 0.014;
    c.beginPath();
    c.arc(m, m, r * 1.06, 0.12 * Math.PI, 0.88 * Math.PI);
    c.stroke();

    // agujero con sombra interior
    g = c.createLinearGradient(0, m - r, 0, m + r);
    g.addColorStop(0, "#000");
    g.addColorStop(1, "#0d0d0e");
    c.fillStyle = g;
    c.beginPath();
    c.arc(m, m, r, 0, Math.PI * 2);
    c.fill();
    return t;
  }

  function makeGrainTile() {
    const n = 256;
    const t = document.createElement("canvas");
    t.width = t.height = n;
    const c = t.getContext("2d");
    const d = c.createImageData(n, n);
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255;
      d.data[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
    return t;
  }

  const holes = ctx.createPattern(makeHoleTile(), "repeat");
  const grain = ctx.createPattern(makeGrainTile(), "repeat");

  // ---- Límites ----
  function clampBoundaries() {
    const cw = BOARD_W * scale,
      ch = BOARD_H * scale;
    panX =
      cw + OVERFLOW * 2 >= vw
        ? clamp(panX, vw - cw - OVERFLOW, OVERFLOW)
        : (vw - cw) / 2;
    panY =
      ch + OVERFLOW * 2 >= vh
        ? clamp(panY, vh - ch - OVERFLOW, OVERFLOW)
        : (vh - ch) / 2;
  }

  // ---- Dibujo (1 vez por frame como máximo) ----
  function schedule() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function draw() {
    raf = 0;
    clampBoundaries();

    canvas.style.transform = `translate3d(${panX}px,${panY}px,0) scale(${scale})`;

    const x = panX,
      y = panY,
      w = BOARD_W * scale,
      h = BOARD_H * scale;
    const rad = 8 * Math.max(scale, 0.5);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, vw, vh);

    // resplandor exterior
    ctx.save();
    ctx.shadowColor = "rgba(255,115,0,.45)";
    ctx.shadowBlur = 36;
    ctx.fillStyle = "#18191b";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    ctx.fill();
    ctx.restore();

    // superficie del tablero
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    ctx.clip();

    const base = ctx.createLinearGradient(0, y, 0, y + h);
    base.addColorStop(0, "#222326");
    base.addColorStop(1, "#16171a");
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    const m = new DOMMatrix([scale, 0, 0, scale, x, y]);

    // grano de tablero de fibra
    grain.setTransform(m);
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, vw, vh);

    // agujeros (se desvanecen al alejar para evitar moiré)
    holes.setTransform(m.scale(1 / TILE_SS));
    ctx.globalAlpha = clamp((scale * GRID - 3) / 6, 0, 1);
    ctx.fillStyle = holes;
    ctx.fillRect(0, 0, vw, vh);

    // viñeta: luz cenital suave sobre el tablero
    ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(
      vw / 2,
      vh * 0.4,
      Math.min(vw, vh) * 0.2,
      vw / 2,
      vh * 0.4,
      Math.max(vw, vh) * 0.85,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();

    // borde de luz
    ctx.strokeStyle = "rgba(255,115,0,.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    ctx.stroke();

    btnIn.disabled = scale >= MAX_SCALE - 0.001;
    btnOut.disabled = scale <= minScale + 0.001;
  }

  // ---- Tamaño ----
  function resize() {
    vw = viewport.clientWidth;
    vh = viewport.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    peg.width = Math.round(vw * dpr);
    peg.height = Math.round(vh * dpr);
    // Zoom mínimo: el tablero entero cabe en pantalla (con margen). No se puede alejar más.
    minScale = Math.max(
      0.05,
      Math.min((vw - OVERFLOW) / BOARD_W, (vh - OVERFLOW) / BOARD_H),
    );
    scale = clamp(scale, minScale, MAX_SCALE);
    schedule();
  }

  // ---- Zoom / animación ----
  function zoomAt(cx, cy, next) {
    next = clamp(next, minScale, MAX_SCALE);
    if (next === scale) return;
    panX = cx - (cx - panX) * (next / scale);
    panY = cy - (cy - panY) * (next / scale);
    scale = next;
    schedule();
  }

  function animateTo(ts, px, py, ms = 450) {
    cancelAnimationFrame(animId);
    if (reduced || !ms) {
      scale = ts;
      panX = px;
      panY = py;
      return schedule();
    }
    const s0 = scale,
      x0 = panX,
      y0 = panY,
      t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      scale = s0 + (ts - s0) * e;
      panX = x0 + (px - x0) * e;
      panY = y0 + (py - y0) * e;
      schedule();
      if (t < 1) animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
  }

  function stepZoom(factor) {
    const next = clamp(scale * factor, minScale, MAX_SCALE);
    const cx = vw / 2,
      cy = vh / 2;
    animateTo(
      next,
      cx - (cx - panX) * (next / scale),
      cy - (cy - panY) * (next / scale),
      300,
    );
  }

  function recenter(ms = 450) {
    if (home) return fit(home, ms);
    const s = clamp(1, minScale, MAX_SCALE);
    animateTo(s, (vw - BOARD_W * s) / 2, (vh - BOARD_H * s) / 2, ms);
  }

  // ---- Punteros: arrastre con 1 dedo/ratón, pellizco con 2 ----
  const pts = new Map();
  let pinchDist = 0,
    downCard = null,
    moved = 0;

  viewport.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelAnimationFrame(animId);
    if (!pts.size) {
      downCard = e.target.closest("#canvas > article, #canvas > .wrapper");
      moved = 0;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add("is-dragging");
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pts.size === 1) {
      panX += dx;
      panY += dy;
      moved += Math.abs(dx) + Math.abs(dy);
      schedule();
    } else if (pts.size === 2) {
      moved = 99;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist)
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, scale * (d / pinchDist));
      pinchDist = d;
    }
  });

  const endPointer = (e) => {
    // clic (sin arrastre): abre el modal o el enlace directo
    if (e.type === "pointerup" && pts.size === 1 && moved < 6 && downCard) {
      if (downCard.querySelector(":scope > template")) openItem(downCard);
      else if (downCard.dataset.href) location.href = downCard.dataset.href;
    }
    pts.delete(e.pointerId);
    pinchDist = 0;
    if (!pts.size) viewport.classList.remove("is-dragging");
  };
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  // ---- Rueda / trackpad ----
  viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(
        e.clientX,
        e.clientY,
        scale * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)),
      );
    },
    { passive: false },
  );

  // ---- Botones y teclado ----
  btnIn.addEventListener("click", () => stepZoom(1.25));
  btnOut.addEventListener("click", () => stepZoom(0.8));
  btnRecenter.addEventListener("click", () => recenter());

  addEventListener("keydown", (e) => {
    if (dlg.open) return;
    const k = e.key,
      d = 80;
    if (k === "+" || k === "=") stepZoom(1.25);
    else if (k === "-") stepZoom(0.8);
    else if (k === "0") recenter();
    else if (k === "ArrowLeft") {
      panX += d;
      schedule();
    } else if (k === "ArrowRight") {
      panX -= d;
      schedule();
    } else if (k === "ArrowUp") {
      panY += d;
      schedule();
    } else if (k === "ArrowDown") {
      panY -= d;
      schedule();
    } else return;
    e.preventDefault();
  });

  // ---- Tarjetas: se leen del HTML, se colocan solas y sin solaparse ----
  const CARD_W = GRID * 18,
    CARD_H = GRID * 10,
    CARD_GAP = GRID * 3,
    HUB_H = GRID * 15;
  const snap = (v) => Math.round(v / GRID) * GRID; // encaja en los agujeros
  const cards = [...canvas.querySelectorAll(":scope > article")];
  const filterBtns = [...document.querySelectorAll(".filters button")];
  const labels = Object.fromEntries(
    filterBtns.map((b) => [b.dataset.filter, b.textContent.trim()]),
  );

  // Desvío "casual" pero estable: se calcula a partir del título (no cambia al filtrar ni al recargar)
  const JITTER = 28,
    TILT = 3; // px y grados máximos
  function seeded(str) {
    let a = 2166136261;
    for (const ch of str) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  cards.forEach((el, idx) => {
    const { img, title = "", category = "" } = el.dataset;
    const rnd = seeded(title || String(idx));
    if (!el.id)
      el.id =
        title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "p" + idx;
    el._jx = (rnd() * 2 - 1) * JITTER;
    el._jy = (rnd() * 2 - 1) * JITTER;
    el.style.setProperty(
      "--rot",
      `${(rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * (TILT - 0.8))}deg`,
    );
    el.style.width = CARD_W + "px";
    el.style.height = CARD_H + "px";
    if (img) {
      const i = new Image();
      i.src = img;
      i.alt = title;
      i.loading = "lazy";
      i.decoding = "async";
      i.draggable = false;
      el.append(i);
    }
    const cap = document.createElement("div");
    cap.className = "caption";
    const t = document.createElement("b");
    t.textContent = title;
    const c = document.createElement("span");
    c.textContent = category
      .split(/\s+/)
      .filter(Boolean)
      .map((k) => labels[k] || k)
      .join(" · ")
      .toUpperCase();
    if (el.dataset.year) c.textContent += "  ·  " + el.dataset.year;
    cap.append(t, c);
    el.append(cap);
  });

  function fit(b, ms = 450) {
    const pad = 140; // hueco para barra, filtros y controles
    const fitS = clamp(
      Math.min((vw - pad) / b.w, (vh - pad * 1.6) / b.h, 1),
      minScale,
      MAX_SCALE,
    );
    // Zoom por defecto: nunca más pequeño que esto, aunque haya muchas entradas
    const base = clamp(Math.min(vw / 2300, vh / 1500), 0.3, 0.75);
    const sc = clamp(Math.max(fitS, base), minScale, MAX_SCALE);
    const cx = b.cx ?? b.x + b.w / 2,
      cy = b.cy ?? b.y + b.h / 2;
    animateTo(sc, vw / 2 - cx * sc, vh / 2 - cy * sc + 30, ms);
  }

  const hub = canvas.querySelector(":scope > .wrapper");
  if (hub) {
    hub.style.width = CARD_W + "px";
    hub.style.height = HUB_H + "px";
  }

  // Anillo k alrededor del logo: 8k huecos en sentido horario desde arriba-izquierda
  function ringSlots(k) {
    const s = [];
    for (let c = -k; c < k; c++) s.push([c, -k]);
    for (let r = -k; r < k; r++) s.push([k, r]);
    for (let c = k; c > -k; c--) s.push([c, k]);
    for (let r = k; r > -k; r--) s.push([-k, r]);
    return s;
  }

  function layout(filter, ms = 450) {
    const vis = cards.filter((el) => {
      const ok =
        filter === "all" ||
        (el.dataset.category || "").split(/\s+/).includes(filter);
      el.classList.toggle("is-hidden", !ok);
      return ok;
    });
    const PX = CARD_W + CARD_GAP,
      PY = CARD_H + CARD_GAP;
    const showHub = !!hub && filter === "all"; // el logo solo aparece en "all"
    if (hub) hub.classList.toggle("is-hidden", !showHub);
    const rects = [];
    let center = null;

    if (showHub) {
      // Proyectos en anillos alrededor del logo, repartidos por cada anillo
      const hubX = snap((BOARD_W - CARD_W) / 2),
        hubY = snap((BOARD_H - HUB_H) / 2);
      hub.style.translate = `${hubX}px ${hubY}px`;
      rects.push({ x: hubX, y: hubY, w: CARD_W, h: HUB_H });
      center = { x: hubX + CARD_W / 2, y: hubY + HUB_H / 2 };
      let left = vis.length,
        i = 0;
      for (let k = 1; left > 0; k++) {
        const slots = ringSlots(k),
          m = Math.min(left, slots.length);
        for (let j = 0; j < m; j++) {
          const [c, r] = slots[Math.floor((j * slots.length) / m)];
          const x = hubX + c * PX;
          const y =
            r === 0
              ? hubY + (HUB_H - CARD_H) / 2
              : r < 0
                ? hubY + r * PY
                : hubY + HUB_H + CARD_GAP + (r - 1) * PY;
          const el = vis[i++];
          el.style.translate = `${x + el._jx}px ${y + el._jy}px`;
          rects.push({ x, y, w: CARD_W, h: CARD_H });
        }
        left -= m;
      }
    } else if (vis.length) {
      // Sin logo: cuadrícula compacta centrada (última fila centrada)
      const n = vis.length,
        cols = Math.ceil(Math.sqrt(n)),
        rows = Math.ceil(n / cols);
      const w = cols * PX - CARD_GAP,
        h = rows * PY - CARD_GAP;
      const x0 = snap((BOARD_W - w) / 2),
        y0 = snap((BOARD_H - h) / 2);
      const lastCount = n - (rows - 1) * cols;
      vis.forEach((el, i) => {
        const r = Math.floor(i / cols),
          c = i % cols;
        const shift = r === rows - 1 ? snap(((cols - lastCount) * PX) / 2) : 0;
        const x = x0 + shift + c * PX,
          y = y0 + r * PY;
        el.style.translate = `${x + el._jx}px ${y + el._jy}px`;
        rects.push({ x, y, w: CARD_W, h: CARD_H });
      });
    }
    if (!rects.length)
      rects.push({
        x: (BOARD_W - CARD_W) / 2,
        y: (BOARD_H - CARD_H) / 2,
        w: CARD_W,
        h: CARD_H,
      });

    const x0 = Math.min(...rects.map((r) => r.x)),
      y0 = Math.min(...rects.map((r) => r.y));
    const x1 = Math.max(...rects.map((r) => r.x + r.w)),
      y1 = Math.max(...rects.map((r) => r.y + r.h));
    home = {
      x: x0,
      y: y0,
      w: x1 - x0,
      h: y1 - y0,
      cx: center?.x,
      cy: center?.y,
    };
    fit(home, ms);
  }

  // ---- Modal (proyectos y "Sobre mí"): contenido = <template> de cada elemento ----
  const dlg = $("modal"),
    mBody = dlg.querySelector(".modal__body");
  let pushed = false;

  function openItem(el, push = true) {
    const t = el.querySelector(":scope > template");
    if (!t) return;
    mBody.replaceChildren(t.content.cloneNode(true));
    mBody.scrollTop = 0;
    if (!dlg.open) dlg.showModal();
    if (push && el.id && location.hash !== "#" + el.id) {
      history.pushState(null, "", "#" + el.id); // enlace compartible; "atrás" cierra
      pushed = true;
    }
  }
  dlg
    .querySelector(".modal__close")
    .addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener("close", () => {
    if (!location.hash) return;
    if (pushed) {
      pushed = false;
      history.back();
    } else history.replaceState(null, "", location.pathname + location.search);
  });
  addEventListener("popstate", () => {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (el && canvas.contains(el)) openItem(el, false);
    else if (dlg.open) {
      pushed = false;
      dlg.close();
    }
  });

  // Filter from the URL (?filter=hoteles) so cards on the home page deep-link here
  const FILTERS = filterBtns.map((b) => b.dataset.filter);
  const param = new URLSearchParams(location.search).get("filter");
  const initial = FILTERS.includes(param) ? param : "all";
  function setFilter(f, ms) {
    filterBtns.forEach((o) =>
      o.setAttribute("aria-pressed", o.dataset.filter === f),
    );
    layout(f, ms);
  }
  filterBtns.forEach((b) =>
    b.addEventListener("click", () => {
      setFilter(b.dataset.filter);
      const u = new URL(location.href);
      if (b.dataset.filter === "all") u.searchParams.delete("filter");
      else u.searchParams.set("filter", b.dataset.filter);
      history.replaceState(null, "", u);
    }),
  );

  addEventListener("resize", resize);
  resize();
  setFilter(initial, 0);
  {
    const t = location.hash && document.getElementById(location.hash.slice(1));
    if (t && canvas.contains(t)) openItem(t, false);
  }
  requestAnimationFrame(() => canvas.classList.add("ready"));
})();
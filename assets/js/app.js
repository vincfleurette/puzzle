// CONFIG — deux images :
// 1) PUZZLE_IMAGE_URL : image des pièces (photo PACS)
// 2) REVEAL_IMAGE_URL : image finale (échographie)
// 3) SHOW_NUMBERS : afficher les numéros d'aide
const PUZZLE_IMAGE_URL = 'assets/img/pacs.jpg';
const REVEAL_IMAGE_URL = 'assets/img/baby.jpg';
const SHOW_NUMBERS = true;

(function () {
  // Grille portrait : 3 colonnes × 4 lignes (12 pièces)
  const ROWS = 4, COLS = 3;

  // Réglages visuels
  const KNOB_RATIO = 0.18;     // taille des languettes
  const SNAP_RATIO = 0.24;     // tolérance de snap
  const SHUFFLE_SPREAD = 0.16; // dispersion initiale au mélange
  const PIECE_SCALE = 0.86;    // <1 = pièces plus petites que la cellule

  // Dimensions logiques (px CSS)
  let VIEW_W = 0, VIEW_H = 0;

  // DOM
  const canvas = document.getElementById('puzzle');
  const ctx = canvas.getContext('2d');
  const cfx = document.getElementById('confetti');
  const cctx = cfx.getContext('2d');
  const announceEl = document.getElementById('announce');

  // Images
  const imgPuzzle = new Image(); imgPuzzle.crossOrigin = 'anonymous'; imgPuzzle.decoding = 'async'; imgPuzzle.src = PUZZLE_IMAGE_URL;
  const imgReveal = new Image(); imgReveal.crossOrigin = 'anonymous'; imgReveal.decoding = 'async'; imgReveal.src = REVEAL_IMAGE_URL;

  // État
  let pieces = [];                      // {r,c,tabs:{t,r,b,l}, x,y, tx,ty, w,h, placed, z}
  let dragging = null, dragDx = 0, dragDy = 0;
  let placedCount = 0;
  let running = false, completed = false;

  // Utils
  function waitImage(image) { return new Promise(res => { if (image.complete && image.naturalWidth) res(); else image.onload = res; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Layout responsive (dessin en px CSS avec DPR)
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.round(rect.width);
    const cssH = Math.round(rect.width * (4 / 3)); // portrait 3:4

    VIEW_W = cssW; VIEW_H = cssH;

    canvas.width = Math.max(300, Math.round(cssW * dpr));
    canvas.height = Math.max(400, Math.round(cssH * dpr));
    cfx.width = canvas.width; cfx.height = canvas.height;

    // On dessine en unités CSS
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Géométrie des pièces
  function genTabs() {
    const tabs = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ t: 0, r: 0, b: 0, l: 0 })));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        tabs[r][c].t = (r === 0) ? 0 : (-tabs[r - 1][c].b);
        tabs[r][c].l = (c === 0) ? 0 : (-tabs[r][c - 1].r);
        tabs[r][c].b = (r === ROWS - 1) ? 0 : (Math.random() < .5 ? 1 : -1);
        tabs[r][c].r = (c === COLS - 1) ? 0 : (Math.random() < .5 ? 1 : -1);
      }
    }
    return tabs;
  }

  function buildPieces() {
    const tabs = genTabs();
    pieces = [];
    const W = VIEW_W, H = VIEW_H;
    const cellW = W / COLS, cellH = H / ROWS;
    const pw = cellW * PIECE_SCALE, ph = cellH * PIECE_SCALE;
    const insetX = (cellW - pw) / 2, insetY = (cellH - ph) / 2;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cellX = c * cellW, cellY = r * cellH;
        const tx = cellX + insetX, ty = cellY + insetY;
        pieces.push({ r, c, tabs: tabs[r][c], x: tx, y: ty, tx, ty, w: pw, h: ph, placed: false, z: 0 });
      }
    }
  }

  function piecePath(p) {
    const { x, y, w, h, tabs } = p;
    const k = Math.min(w, h) * KNOB_RATIO, crv = k * 0.6;
    ctx.beginPath();
    // top
    ctx.moveTo(x, y);
    if (tabs.t === 0) ctx.lineTo(x + w, y); else { const dir = tabs.t, mx = x + w / 2, ty = y; ctx.lineTo(mx - k, ty); ctx.bezierCurveTo(mx - k, ty - crv * dir, mx - crv, ty - k * dir, mx, ty - k * dir); ctx.bezierCurveTo(mx + crv, ty - k * dir, mx + k, ty - crv * dir, mx + k, ty); ctx.lineTo(x + w, y); }
    // right
    if (tabs.r === 0) ctx.lineTo(x + w, y + h); else { const dir = tabs.r, my = y + h / 2, rx = x + w; ctx.lineTo(rx, my - k); ctx.bezierCurveTo(rx + crv * dir, my - k, rx + k * dir, my - crv, rx + k * dir, my); ctx.bezierCurveTo(rx + k * dir, my + crv, rx + crv * dir, my + k, rx, my + k); ctx.lineTo(x + w, y + h); }
    // bottom
    if (tabs.b === 0) ctx.lineTo(x, y + h); else { const dir = tabs.b, mx = x + w / 2, by = y + h; ctx.lineTo(mx + k, by); ctx.bezierCurveTo(mx + k, by + crv * dir, mx + crv, by + k * dir, mx, by + k * dir); ctx.bezierCurveTo(mx - crv, by + k * dir, mx - k, by + crv * dir, mx - k, by); ctx.lineTo(x, y + h); }
    // left
    if (tabs.l === 0) ctx.lineTo(x, y); else { const dir = tabs.l, my = y + h / 2, lx = x; ctx.lineTo(lx, my + k); ctx.bezierCurveTo(lx - crv * dir, my + k, lx - k * dir, my + crv, lx - k * dir, my); ctx.bezierCurveTo(lx - k * dir, my - crv, lx - crv * dir, my - k, lx, my - k); ctx.lineTo(x, y); }
    ctx.closePath();
  }

  // Rendu images (mode COVER)
  function drawFullRevealImage() {
    const W = VIEW_W, H = VIEW_H;
    const iw = imgReveal.naturalWidth, ih = imgReveal.naturalHeight; if (!iw || !ih) return;
    const s = Math.max(W / iw, H / ih);
    const dw = Math.round(iw * s), dh = Math.round(ih * s);
    const dx = Math.round((W - dw) / 2), dy = Math.round((H - dh) / 2);
    ctx.drawImage(imgReveal, dx, dy, dw, dh);
  }

  function drawPieceImage(p) {
    const W = VIEW_W, H = VIEW_H;
    const iw = imgPuzzle.naturalWidth, ih = imgPuzzle.naturalHeight; if (!iw || !ih) return;
    const s = Math.max(W / iw, H / ih);
    const dw = Math.round(iw * s), dh = Math.round(ih * s);
    const dx = Math.round((W - dw) / 2), dy = Math.round((H - dh) / 2);

    ctx.save();
    piecePath(p); ctx.clip();
    ctx.drawImage(imgPuzzle, dx, dy, dw, dh);

    // contour
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    piecePath(p); ctx.stroke();

    // Numéro d'aide
    if (SHOW_NUMBERS && !completed) {
      const idx = p.r * COLS + p.c + 1;
      const padX = 8, padY = 6;
      const fontSize = Math.max(12, Math.round(Math.min(p.w, p.h) * 0.12));
      const label = String(idx);
      ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      const tw = ctx.measureText(label).width;
      const lw = Math.max(24, tw + padX * 2), lh = Math.max(18, fontSize + padY * 2);
      const lx = p.x + p.w - lw - 8, ly = p.y + p.h - lh - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, lx, ly, lw, lh, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8; roundRect(ctx, lx, ly, lw, lh, 6); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + lw / 2, ly + lh / 2 + 0.5);
    }
    ctx.restore();
  }

  // Rendu
  function draw() {
    const W = VIEW_W, H = VIEW_H;
    ctx.clearRect(0, 0, W, H);
    if (completed) { drawFullRevealImage(); return; }
    const order = pieces.map((p, i) => ({ i, z: p.z || 0 })).sort((a, b) => a.z - b.z).map(o => o.i);
    for (const i of order) drawPieceImage(pieces[i]);
  }

  // Jeu
  function shuffle() {
    const W = VIEW_W, H = VIEW_H;
    const spreadX = W * SHUFFLE_SPREAD, spreadY = H * SHUFFLE_SPREAD;
    for (const p of pieces) {
      p.x = clamp(p.tx + (Math.random() * 2 - 1) * spreadX, 0, W - p.w);
      p.y = clamp(p.ty + (Math.random() * 2 - 1) * spreadY, 0, H - p.h);
      p.placed = false; p.z = 0;
    }
    placedCount = 0; completed = false;
    document.querySelector('.board-wrap')?.classList.remove('done');
    announceEl.style.display = 'none';
    running = true; draw();
  }

  function hit(p, mx, my) {
    if (mx < p.x || mx > p.x + p.w || my < p.y || my > p.y + p.h) return false;
    ctx.save(); piecePath(p); const ok = ctx.isPointInPath(mx, my); ctx.restore(); return ok;
  }

  function onDown(x, y) {
    if (!running) return;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i]; if (p.placed) continue;
      if (hit(p, x, y)) { dragging = i; dragDx = x - p.x; dragDy = y - p.y; p.z = (p.z || 0) + 1; break; }
    }
    draw();
  }
  function onMove(x, y) {
    if (dragging != null) {
      const p = pieces[dragging];
      p.x = clamp(x - dragDx, 0, VIEW_W - p.w);
      p.y = clamp(y - dragDy, 0, VIEW_H - p.h);
      draw();
    }
  }
  function onUp() {
    if (dragging == null) return;
    const p = pieces[dragging]; dragging = null;
    const tol = Math.min(p.w, p.h) * SNAP_RATIO;
    if (Math.hypot(p.x - p.tx, p.y - p.ty) <= tol) {
      p.x = p.tx; p.y = p.ty;
      if (!p.placed) { p.placed = true; placedCount++; popConfetti(); }
      if (placedCount === ROWS * COLS) { running = false; reveal(); }
    }
    draw();
  }

  function reveal() {
    completed = true;
    document.querySelector('.board-wrap')?.classList.add('done');
    announceEl.style.display = 'block';
    let a = 0;
    const step = () => {
      const W = VIEW_W, H = VIEW_H;
      a += 0.06; if (a > 1) a = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = a; drawFullRevealImage(); ctx.globalAlpha = 1;
      if (a < 1) requestAnimationFrame(step);
    };
    step();
  }

  // Confettis
  let confetti = []; let confettiAnim = null;
  function popConfetti() {
    const W = cfx.width, H = cfx.height;
    for (let i = 0; i < 28; i++) confetti.push({ x: Math.random() * W, y: -10, vx: (Math.random() * 2 - 1) * 1.4, vy: Math.random() * 2 + 1, life: 60 + Math.random() * 40, rot: Math.random() * Math.PI });
    if (!confettiAnim) animateConfetti();
  }
  function animateConfetti() {
    confettiAnim = requestAnimationFrame(tick);
    function tick() {
      cctx.clearRect(0, 0, cfx.width, cfx.height);
      cctx.save();
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life--; p.rot += 0.1;
        if (p.life <= 0 || p.y > cfx.height + 10) confetti.splice(i, 1);
        else { cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot); cctx.fillStyle = 'rgba(255,255,255,0.9)'; cctx.fillRect(-2, -6, 4, 12); cctx.restore(); }
      }
      cctx.restore();
      if (confetti.length > 0) { confettiAnim = requestAnimationFrame(tick); } else { cancelAnimationFrame(confettiAnim); confettiAnim = null; }
    }
  }

  // Événements pointeur (coordonnées en px CSS)
  const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left), y: (e.clientY - r.top) }; };
  let pointerDown = false;
  canvas.addEventListener('mousedown', e => { const p = toCanvas(e); onDown(p.x, p.y); pointerDown = true; });
  window.addEventListener('mousemove', e => { if (!pointerDown) return; const p = toCanvas(e); onMove(p.x, p.y); });
  window.addEventListener('mouseup', () => { if (!pointerDown) return; pointerDown = false; onUp(); });

  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; const r = canvas.getBoundingClientRect(); onDown((t.clientX - r.left), (t.clientY - r.top)); e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', e => { if (dragging == null) return; const t = e.changedTouches[0]; const r = canvas.getBoundingClientRect(); onMove((t.clientX - r.left), (t.clientY - r.top)); e.preventDefault(); }, { passive: false });
  window.addEventListener('touchend', () => { onUp(); });

  // Init
  function init() { resize(); buildPieces(); shuffle(); draw(); }
  Promise.all([waitImage(imgPuzzle), waitImage(imgReveal)]).then(() => { init(); });
  window.addEventListener('resize', () => { resize(); buildPieces(); draw(); });

  // Helper rectangle arrondi (pour le badge numéroté)
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
})();
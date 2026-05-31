import { useEffect, useRef, useState, useCallback } from 'react';
import { PointField } from '../graph/pointField';
import { TOTAL, MAX_LEVEL, unrank, rank, neighborRanks } from '../graph/permIndex';
import { getUniverse, solvePath } from '../api/graphApi';

const THEME_BG = { dark: '#0d1117', light: '#f6f8fa' };

function matrixRows(state) {
  return [0, 3, 6].map((o) => [state[o], state[o + 1], state[o + 2]]);
}

export default function GlobalUniverse() {
  const containerRef   = useRef(null);
  const canvasRef      = useRef(null);
  const labelCanvasRef = useRef(null);
  const fieldRef       = useRef(null);

  // Layout arrays from the worker (kept in refs — never re-rendered as React state).
  const layoutRef = useRef(null); // { level, levelSize, levelOffset, rankByIndex, positions, rowHeight, colSpacing }
  const renderReq = useRef(false);
  const animRef    = useRef(0);    // camera fly-to animation frame id
  const journeyRef = useRef(null); // ranks along the active solve path
  const pathActiveRef = useRef(false); // mirror of pathActive for event handlers

  const [isDark, setIsDark]   = useState(() => localStorage.getItem('ia9-theme') !== 'light');
  const [loading, setLoading] = useState(true);
  const [meta, setMeta]       = useState(null);
  const [selected, setSelected] = useState(null);   // clicked node: { rank, state, level }
  const [pathActive, setPathActive] = useState(false);
  const [solving, setSolving] = useState(false);
  const [journeyStep, setJourneyStep] = useState(-1); // index along the solve path
  const [playing, setPlaying] = useState(false);
  const [status, setStatus]   = useState('Construyendo el mapa completo de 362.880 nodos…');

  const JOURNEY_SCALE = 90; // zoom level used while travelling the path

  // ── Color palette (parity = purple/red, distance = neutral gradient) ────────
  const applyColors = useCallback(() => {
    const f = fieldRef.current;
    if (!f) return;
    f.setColors({
      bg:   isDark ? THEME_BG.dark : THEME_BG.light,
      even: isDark ? '#bc8cff' : '#8250df',      // even-parity layers (purple)
      odd:  isDark ? '#ff7b72' : '#cf222e',      // odd-parity layers (red)
      top:  isDark ? '#c9d1d9' : '#6e7781',      // near target — neutral, lighten only
      bot:  isDark ? '#484f58' : '#afb8c1',      // far from target — neutral, dim only
      edge: isDark ? '#c9d1d9' : '#57606a', edgeAlpha: 0.55,
      path: '#e3b341', pathAlpha: 0.55,          // full solve path (dim yellow)
      progress: isDark ? '#39d3f5' : '#0597a7',  // travelled portion (cyan)
      highlight: isDark ? '#39d3f5' : '#0597a7', // selection frame (cyan — off the parity reds)
    });
  }, [isDark]);

  // ── LOD label overlay: draw 3×3 matrices for the few nodes visible once you
  //    zoom in past a threshold. Only viewport-visible nodes are enumerated
  //    (via the level/column index), so cost is bounded regardless of total. ──
  // Matrices fade in based on the node's on-screen size (not raw zoom), so the
  // 3×3 grid is always sized to fit inside the square node — never spilling out.
  const LOD_SIZE0 = 16; // node px where matrices begin to fade in
  const LOD_SIZE1 = 30; // node px where they're fully opaque
  const drawLabels = useCallback(() => {
    const cv = labelCanvasRef.current, f = fieldRef.current, L = layoutRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 1, h = cv.clientHeight || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!f || !L) return;

    const { scale } = f, cx = f.center.x, cy = f.center.y;
    const sizeCss = f.pointSizeCss();
    const alpha = Math.min(1, Math.max(0, (sizeCss - LOD_SIZE0) / (LOD_SIZE1 - LOD_SIZE0)));
    if (alpha <= 0) return;

    // Visible world rect → level & column ranges.
    const minWX = cx - (w / 2) / scale, maxWX = cx + (w / 2) / scale;
    const minWY = cy - (h / 2) / scale, maxWY = cy + (h / 2) / scale;
    let Llo = Math.ceil(MAX_LEVEL - maxWY / L.rowHeight);
    let Lhi = Math.floor(MAX_LEVEL - minWY / L.rowHeight);
    Llo = Math.max(0, Llo); Lhi = Math.min(MAX_LEVEL, Lhi);

    const cell = sizeCss / 3.4;            // 3 digits + margin fit the square
    const font = Math.max(6, Math.round(cell));
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${font}px "Courier New", monospace`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, font * 0.28);
    // Halo opposite to the text colour → digits stay legible over any node hue.
    ctx.strokeStyle = isDark ? 'rgba(1,4,9,0.92)' : 'rgba(255,255,255,0.95)';
    ctx.fillStyle = isDark ? '#f0f6fc' : '#0d1117';

    for (let lvl = Llo; lvl <= Lhi; lvl++) {
      const size = L.levelSize[lvl];
      if (!size) continue;
      let ilo = Math.floor(minWX / L.colSpacing + (size - 1) / 2);
      let ihi = Math.ceil(maxWX / L.colSpacing + (size - 1) / 2);
      ilo = Math.max(0, ilo); ihi = Math.min(size - 1, ihi);
      for (let i = ilo; i <= ihi; i++) {
        const r = L.rankByIndex[L.levelOffset[lvl] + i];
        const sx = w / 2 + (L.positions[r * 2] - cx) * scale;
        const sy = h / 2 - (L.positions[r * 2 + 1] - cy) * scale;
        const s = unrank(r);
        for (let rr = 0; rr < 3; rr++) {
          for (let cc = 0; cc < 3; cc++) {
            const gx = sx + (cc - 1) * cell, gy = sy + (rr - 1) * cell;
            ctx.strokeText(s[rr * 3 + cc], gx, gy);
            ctx.fillText(s[rr * 3 + cc], gx, gy);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [isDark]);

  const paint = useCallback(() => {
    fieldRef.current?.render();
    drawLabels();
  }, [drawLabels]);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const requestRender = useCallback(() => {
    if (renderReq.current) return;
    renderReq.current = true;
    requestAnimationFrame(() => {
      renderReq.current = false;
      paintRef.current();
    });
  }, []);

  const stopFly = useCallback(() => { cancelAnimationFrame(animRef.current); animRef.current = 0; }, []);

  // Animated camera move: ease center toward (wx,wy) and zoom toward targetScale.
  const flyTo = useCallback((wx, wy, targetScale, duration = 600) => {
    const f = fieldRef.current; if (!f) return;
    stopFly();
    const sC = { ...f.center }, sS = f.scale;
    const eS = targetScale ?? f.scale;
    const t0 = performance.now();
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / duration);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; // easeInOutQuad
      f.center = { x: sC.x + (wx - sC.x) * e, y: sC.y + (wy - sC.y) * e };
      f.scale = sS * Math.pow(eS / sS, e); // geometric interpolation for zoom
      paintRef.current();
      if (u < 1) animRef.current = requestAnimationFrame(tick); else animRef.current = 0;
    };
    animRef.current = requestAnimationFrame(tick);
  }, [stopFly]);

  // Move the journey to a given step: select + frame that node, light up the
  // travelled portion, and fly the camera to it.
  const goToStep = useCallback((step) => {
    const j = journeyRef.current, L = layoutRef.current, f = fieldRef.current;
    if (!j || !L || !f) return;
    const s = Math.max(0, Math.min(j.length - 1, step));
    setJourneyStep(s);
    const r = j[s];
    f.setHighlight(r);
    f.setEdges(null);
    setSelected({ rank: r, state: unrank(r), level: L.level[r] });
    if (s >= 1) {
      const strip = new Float32Array((s + 1) * 2);
      for (let k = 0; k <= s; k++) {
        const rr = j[k];
        strip[k * 2] = L.positions[rr * 2];
        strip[k * 2 + 1] = L.positions[rr * 2 + 1];
      }
      f.setProgress(strip);
    } else {
      f.setProgress(null);
    }
    flyTo(L.positions[r * 2], L.positions[r * 2 + 1], JOURNEY_SCALE);
    setStatus(s >= j.length - 1
      ? `Llegaste a 123456789 — resuelto en ${j.length - 1} pasos.`
      : `Paso ${s} / ${j.length - 1} · ${unrank(r)} (${L.level[r]} inversiones restantes)`);
  }, [flyTo]);

  // ── O(1) picking: world point -> rank (or -1) ───────────────────────────────
  // The candidate is the nearest grid cell, but it's only a hit if the click
  // lands within ~the node's *on-screen* size — so clicking the empty gap
  // between nodes (especially when zoomed in) selects nothing.
  const pickRank = useCallback((world) => {
    const L = layoutRef.current, f = fieldRef.current;
    if (!L || !f) return -1;
    const lvl = Math.round(MAX_LEVEL - world.y / L.rowHeight);
    if (lvl < 0 || lvl > MAX_LEVEL) return -1;
    const size = L.levelSize[lvl];
    if (!size) return -1;
    const i = Math.round(world.x / L.colSpacing + (size - 1) / 2);
    if (i < 0 || i >= size) return -1;
    const r = L.rankByIndex[L.levelOffset[lvl] + i];
    // Distance from the actual node, in screen pixels.
    const dxPx = (world.x - L.positions[r * 2]) * f.scale;
    const dyPx = (world.y - L.positions[r * 2 + 1]) * f.scale;
    const hitPx = Math.max(4, f.pointSizeCss() * 0.5 + 3); // ~node half-size + slack
    if (Math.abs(dxPx) > hitPx || Math.abs(dyPx) > hitPx) return -1;
    return r;
  }, []);

  const nodeAt = useCallback((r) => {
    if (r < 0) return null;
    return { rank: r, state: unrank(r), level: layoutRef.current.level[r] };
  }, []);

  // ── Neighbour edge segments for a given rank ────────────────────────────────
  const edgesFor = useCallback((r) => {
    const L = layoutRef.current;
    const state = unrank(r);
    const nb = neighborRanks(state);
    const seg = new Float32Array(nb.length * 4);
    for (let k = 0; k < nb.length; k++) {
      seg[k * 4]     = L.positions[r * 2];
      seg[k * 4 + 1] = L.positions[r * 2 + 1];
      seg[k * 4 + 2] = L.positions[nb[k] * 2];
      seg[k * 4 + 3] = L.positions[nb[k] * 2 + 1];
    }
    return seg;
  }, []);

  // ── One-time init: renderer + worker + meta ─────────────────────────────────
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    let field;
    try {
      field = new PointField(canvasRef.current);
    } catch (err) {
      setStatus(`WebGL no disponible: ${err.message}`);
      setLoading(false);
      return;
    }
    fieldRef.current = field;
    field.resize();
    applyColors();
    paintRef.current();

    getUniverse().then(setMeta).catch(() => {});

    const worker = new Worker(new URL('../graph/layoutWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const d = e.data;
      layoutRef.current = {
        positions: d.positions, level: d.level, levelSize: d.levelSize,
        levelOffset: d.levelOffset, rankByIndex: d.rankByIndex,
        rowHeight: d.rowHeight, colSpacing: d.colSpacing,
      };
      field.setData({ positions: d.positions, level: d.level, maxLevel: d.maxLevel, bounds: d.bounds });
      field.resize();
      field.fit();
      paintRef.current();
      setLoading(false);
      setStatus(`${TOTAL.toLocaleString('es')} estados · 37 capas · construido en ${d.buildMs} ms. Haz clic en un nodo para seleccionarlo.`);
      worker.terminate();
    };
    worker.postMessage('build');

    const ro = new ResizeObserver(() => { field.resize(); paintRef.current(); });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      worker.terminate();
      cancelAnimationFrame(animRef.current);
      field.destroy();
      fieldRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    applyColors();
    requestRender();
  }, [isDark, applyColors, requestRender]);

  // ── Pointer interaction (pan / zoom / click-to-select) ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false, moved = false, lastX = 0, lastY = 0;

    const toCss = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e) => { stopFly(); dragging = true; moved = false; const p = toCss(e); lastX = p.x; lastY = p.y; };

    // Pointer move only pans (while dragging). Selection is click-only — there
    // is no hover frame, so the cursor never moves the selector.
    const onMove = (e) => {
      const f = fieldRef.current; if (!f || !layoutRef.current || !dragging) return;
      const p = toCss(e);
      const dx = p.x - lastX, dy = p.y - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      f.panBy(dx, dy); lastX = p.x; lastY = p.y;
      requestRender();
    };

    // A clean click (no drag) selects a node, or cancels selection on empty space.
    const onUp = (e) => {
      const f = fieldRef.current;
      if (dragging && !moved && !pathActiveRef.current && f && layoutRef.current) {
        const p = toCss(e);
        const r = pickRank(f.screenToWorld(p.x, p.y));
        if (r >= 0) {
          f.setHighlight(r); f.setEdges(edgesFor(r));
          setSelected(nodeAt(r));            // click a node → select it
        } else {
          f.setHighlight(-1); f.setEdges(null);
          setSelected(null);                 // click empty → cancel selection
        }
        requestRender();
      }
      dragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const f = fieldRef.current; if (!f) return;
      stopFly();
      const p = toCss(e);
      f.zoomAt(Math.exp(-e.deltaY * 0.0022), p.x, p.y);
      requestRender();
    };

    // Double-click zooms straight into a node, past the LOD threshold so its
    // matrix (and its neighbours') become readable.
    const onDblClick = (e) => {
      const f = fieldRef.current; if (!f || !layoutRef.current) return;
      stopFly();
      const p = toCss(e);
      const r = pickRank(f.screenToWorld(p.x, p.y));
      if (r < 0) return;
      f.center = { x: layoutRef.current.positions[r * 2], y: layoutRef.current.positions[r * 2 + 1] };
      f.scale = Math.max(f.scale, 60);
      f.setHighlight(r); f.setEdges(edgesFor(r));
      setSelected(nodeAt(r)); // double-click also selects + frames the node
      requestRender();
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }, [pickRank, nodeAt, edgesFor, requestRender, stopFly]);

  // ── Actions ─────────────────────────────────────────────────────────────--
  const handleFit = useCallback(() => { fieldRef.current?.fit(); requestRender(); }, [requestRender]);

  const clearJourney = useCallback(() => {
    const f = fieldRef.current;
    stopFly();
    journeyRef.current = null;
    setPlaying(false);
    setJourneyStep(-1);
    setPathActive(false);
    setSelected(null);
    if (f) { f.setPath(null); f.setProgress(null); f.setHighlight(-1); f.setEdges(null); }
    requestRender();
  }, [stopFly, requestRender]);

  const handleSolve = useCallback(async () => {
    const f = fieldRef.current, L = layoutRef.current;
    if (!f || !L || !selected) return;
    if (pathActive) { clearJourney(); setStatus('Viaje terminado.'); return; }
    setSolving(true);
    setStatus(`Resolviendo ${selected.state}…`);
    try {
      const data = await solvePath(selected.state);
      const strip = new Float32Array(data.path.length * 2);
      const ranks = new Array(data.path.length);
      data.path.forEach((p, k) => {
        const r = rank(p.state);
        ranks[k] = r;
        strip[k * 2] = L.positions[r * 2];
        strip[k * 2 + 1] = L.positions[r * 2 + 1];
      });
      f.setPath(strip);
      journeyRef.current = ranks;
      setPathActive(true);
      goToStep(0); // zoom to the start node; ▶ steps toward 123456789
    } catch (err) {
      setStatus(`Error al resolver: ${err.message}`);
    } finally { setSolving(false); }
  }, [selected, pathActive, clearJourney, goToStep]);

  const journeyLen = () => (journeyRef.current ? journeyRef.current.length : 0);
  const handleNext = useCallback(() => goToStep(journeyStep + 1), [goToStep, journeyStep]);
  const handlePrev = useCallback(() => goToStep(journeyStep - 1), [goToStep, journeyStep]);
  const togglePlay = useCallback(() => {
    if (journeyStep >= journeyLen() - 1) goToStep(0); // restart if at the end
    setPlaying((p) => !p);
  }, [goToStep, journeyStep]);

  // Auto-play: advance one step at a time while "playing".
  useEffect(() => {
    if (!playing) return;
    if (journeyStep >= journeyLen() - 1) { setPlaying(false); return; }
    const id = setTimeout(() => goToStep(journeyStep + 1), 900);
    return () => clearTimeout(id);
  }, [playing, journeyStep, goToStep]);

  const handleThemeToggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('ia9-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  pathActiveRef.current = pathActive;
  const info = selected;
  const jlen = journeyRef.current ? journeyRef.current.length : 0;
  const atStart = journeyStep <= 0;
  const atEnd = journeyStep >= jlen - 1;

  return (
    <div className="explorer">
      <header className="header">
        <div className="header-left">
          <span className="logo">IA-9</span>
          <span className="subtitle">Universo — todas las permutaciones a la vez</span>
        </div>

        <div className="header-center">
          {info ? (
            <div className="node-info">
              <div className="node-matrix">
                {matrixRows(info.state).map((row, ri) => (
                  <div key={ri} className="node-matrix-row">
                    {row.map((c, ci) => <span key={ci} className="node-matrix-cell">{c}</span>)}
                  </div>
                ))}
              </div>
              <span className="badge explored">{info.level} inv</span>
              <span className="badge unexplored">{info.level % 2 ? 'impar' : 'par'}</span>
              {selected && !pathActive && (
                <button className="theme-toggle solve-btn" onClick={handleSolve} disabled={solving}>
                  {solving ? 'resolviendo…' : 'resolver'}
                </button>
              )}
              {pathActive && (
                <div className="journey-controls">
                  <button className="theme-toggle" onClick={handlePrev} disabled={atStart} title="paso anterior">←</button>
                  <button className="theme-toggle" onClick={togglePlay} title="reproducir / pausar">{playing ? '⏸' : '▶'}</button>
                  <button className="theme-toggle" onClick={handleNext} disabled={atEnd} title="paso siguiente">→</button>
                  <span className="journey-step">{journeyStep + 1}/{jlen}</span>
                  <button className="theme-toggle solve-btn active" onClick={handleSolve} title="terminar viaje">×</button>
                </div>
              )}
            </div>
          ) : (
            <span className="node-status hint">haz clic en un nodo para seleccionarlo</span>
          )}
        </div>

        <div className="header-actions">
          <button className="theme-toggle" onClick={handleThemeToggle}>{isDark ? 'claro' : 'oscuro'}</button>
        </div>
      </header>

      <div className="graph-container universe-stage" ref={containerRef}>
        <canvas ref={canvasRef} className="universe-canvas" />
        <canvas ref={labelCanvasRef} className="universe-labels" />
        {loading && (
          <div className="universe-loading">
            <div className="universe-spinner" />
            <span>Construyendo el mapa del espacio de estados…</span>
          </div>
        )}
        <div className="universe-legend">
          <div><span className="legend-axis">Y</span> inversiones = distancia a 1·2·3 / 4·5·6 / 7·8·9</div>
          <div><span className="legend-dot even" /> paridad par &nbsp; <span className="legend-dot odd" /> paridad impar</div>
          <div className="legend-hint">doble clic para acercar · selecciona un nodo y pulsa resolver para recorrer la ruta paso a paso</div>
        </div>
      </div>

      <footer className="footer">
        <div className="controls">
          <button onClick={handleFit}>Ajustar</button>
          <div className="stats">
            <span><strong>{(meta?.total ?? TOTAL).toLocaleString('es')}</strong> nodos</span>
            <span><strong>{meta?.levelCount ?? 37}</strong> capas</span>
            <span><strong>{(meta?.peakSize ?? 29228).toLocaleString('es')}</strong> pico (N{meta?.peakLevel ?? 18})</span>
          </div>
        </div>
        <div className="status-bar"><span>{status}</span></div>
      </footer>
    </div>
  );
}

/**
 * PointField — a tiny dependency-free WebGL renderer for the global universe.
 *
 * Draws all 362,880 nodes as GL points in a single draw call from flat typed
 * arrays (no per-node objects). A second tiny program draws the few highlighted
 * line segments (hovered node's 8 edges + the solve path). Camera is a simple
 * pan/zoom in CSS pixels; gl.viewport handles devicePixelRatio.
 */

const POINT_VERT = `
  attribute vec2 a_pos;
  attribute float a_level;
  uniform vec2  u_center;
  uniform float u_scale;
  uniform vec2  u_viewport;   // CSS px
  uniform float u_pointSize;  // device px
  uniform float u_maxLevel;
  uniform vec3  u_even;
  uniform vec3  u_odd;
  uniform vec3  u_top;
  uniform vec3  u_bot;
  varying vec3  v_color;
  void main() {
    vec2 rel = (a_pos - u_center) * u_scale;          // CSS px, y-up
    gl_Position = vec4(rel.x / (u_viewport.x * 0.5),
                       rel.y / (u_viewport.y * 0.5), 0.0, 1.0);
    gl_PointSize = u_pointSize;
    float parity = mod(a_level, 2.0);
    vec3 base = mix(u_even, u_odd, parity);
    float t = a_level / u_maxLevel;                   // 0 (identity) .. 1
    v_color = mix(base, mix(u_top, u_bot, t), 0.30);
  }
`;

const POINT_FRAG = `
  precision mediump float;
  varying vec3 v_color;
  void main() { gl_FragColor = vec4(v_color, 1.0); } // filled square node
`;

// Thick lines: each segment is expanded to a quad (2 triangles). The vertex
// is offset along the screen-space normal by a constant half-width in CSS px,
// so line thickness stays constant regardless of zoom (visible even at Fit).
const LINE_VERT = `
  attribute vec2 a_pos;     // this vertex's endpoint (world)
  attribute vec2 a_dir;     // segment direction B-A (world)
  attribute float a_side;   // +1 / -1
  uniform vec2  u_center;
  uniform float u_scale;
  uniform vec2  u_viewport;
  uniform float u_halfWidth; // CSS px
  void main() {
    vec2 sp = (a_pos - u_center) * u_scale;     // CSS px, y-up
    vec2 d = a_dir * u_scale;
    vec2 dirn = length(d) > 0.0 ? normalize(d) : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dirn.y, dirn.x);
    vec2 px = sp + nrm * a_side * u_halfWidth;
    gl_Position = vec4(px.x / (u_viewport.x * 0.5),
                       px.y / (u_viewport.y * 0.5), 0.0, 1.0);
  }
`;

const LINE_FRAG = `
  precision mediump float;
  uniform vec4 u_color;
  void main() { gl_FragColor = u_color; }
`;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Expand line segments [x0,y0,x1,y1,...] into triangle geometry. Each vertex
// carries (pos, dir, side); the shader offsets it along the screen normal.
// Returns interleaved Float32Array (5 floats/vertex, 6 vertices/segment).
function expandSegments(segments) {
  const segCount = segments.length / 4;
  const out = new Float32Array(segCount * 6 * 5);
  let o = 0;
  for (let s = 0; s < segCount; s++) {
    const ax = segments[s * 4], ay = segments[s * 4 + 1];
    const bx = segments[s * 4 + 2], by = segments[s * 4 + 3];
    const dx = bx - ax, dy = by - ay;
    // tri1: A+, A-, B+   tri2: B+, A-, B-
    const v = [[ax, ay, 1], [ax, ay, -1], [bx, by, 1], [bx, by, 1], [ax, ay, -1], [bx, by, -1]];
    for (const [x, y, side] of v) { out[o++] = x; out[o++] = y; out[o++] = dx; out[o++] = dy; out[o++] = side; }
  }
  return out;
}

// Turn a polyline strip [x0,y0,x1,y1,...] into segments [ax,ay,bx,by,...].
function stripToSegments(strip) {
  const pts = strip.length / 2;
  const seg = new Float32Array(Math.max(0, pts - 1) * 4);
  for (let i = 0; i < pts - 1; i++) {
    seg[i * 4] = strip[i * 2]; seg[i * 4 + 1] = strip[i * 2 + 1];
    seg[i * 4 + 2] = strip[(i + 1) * 2]; seg[i * 4 + 3] = strip[(i + 1) * 2 + 1];
  }
  return seg;
}

export class PointField {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    this.pointProgram = this._program(POINT_VERT, POINT_FRAG);
    this.lineProgram = this._program(LINE_VERT, LINE_FRAG);

    this.posBuffer = gl.createBuffer();
    this.levelBuffer = gl.createBuffer();
    this.edgeBuffer = gl.createBuffer();
    this.pathBuffer = gl.createBuffer();
    this.progressBuffer = gl.createBuffer();
    this.hlPosBuffer = gl.createBuffer();   // scratch: selection frame geometry

    this.positions = null;
    this.count = 0;
    this.maxLevel = 36;
    this.bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

    this.center = { x: 0, y: 0 };
    this.scale = 1;
    this.minScale = 0.01;
    this.maxScale = 200;

    this.colors = {
      bg: [0.05, 0.07, 0.09],
      even: hexToRgb('#388bfd'),
      odd: hexToRgb('#f0883e'),
      top: hexToRgb('#79c0ff'),
      bot: hexToRgb('#8b949e'),
      edge: [0.9, 0.9, 0.95, 0.5],
      path: [0.89, 0.70, 0.25, 0.95],
      progress: [0.22, 0.83, 0.96, 1.0], // travelled portion (cyan)
      highlight: hexToRgb('#f78166'), // selection ring (accent-red by default)
    };

    this.highlightRank = -1;
    this.edgeCount = 0;   // vertex count (triangles)
    this.pathCount = 0;   // vertex count (triangles)
    this.progressCount = 0;
    this.edgeWidth = 2.0; // CSS px, constant on screen
    this.pathWidth = 3.5;
    this.progressWidth = 4.5; // travelled portion of the solve path
    // Node size tracks zoom (kept just under the on-screen column spacing so
    // squares never overlap) and is capped to a GPU-safe point size. The LOD
    // matrix derives its cell size from this, so digits always fit the square.
    this.pointScale = 0.85;
    this.pointMin = 2.0;
    this.pointMax = 60;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _program(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = this._shader(gl.VERTEX_SHADER, vsSrc);
    const fs = this._shader(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Link error: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  _shader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader error: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  setData({ positions, level, maxLevel, bounds }) {
    const gl = this.gl;
    this.positions = positions;
    this.count = positions.length / 2;
    this.maxLevel = maxLevel;
    this.bounds = bounds;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // level is Uint8Array -> upload as float attribute for portability.
    const levelF = new Float32Array(level);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.levelBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, levelF, gl.STATIC_DRAW);
  }

  setColors(map) {
    for (const k of ['bg', 'even', 'odd', 'top', 'bot', 'highlight']) {
      if (map[k]) this.colors[k] = hexToRgb(map[k]);
    }
    if (map.edge) this.colors.edge = [...hexToRgb(map.edge), map.edgeAlpha ?? 0.5];
    if (map.path) this.colors.path = [...hexToRgb(map.path), map.pathAlpha ?? 0.95];
    if (map.progress) this.colors.progress = [...hexToRgb(map.progress), map.progressAlpha ?? 1.0];
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  _cssSize() {
    return { w: this.canvas.clientWidth || 1, h: this.canvas.clientHeight || 1 };
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = this._cssSize();
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  fit(paddingFrac = 0.06) {
    const { w, h } = this._cssSize();
    const b = this.bounds;
    const bw = Math.max(1e-6, b.maxX - b.minX);
    const bh = Math.max(1e-6, b.maxY - b.minY);
    const sx = (w * (1 - paddingFrac)) / bw;
    const sy = (h * (1 - paddingFrac)) / bh;
    this.scale = Math.max(this.minScale, Math.min(sx, sy));
    this.center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }

  screenToWorld(cssX, cssY) {
    const { w, h } = this._cssSize();
    return {
      x: this.center.x + (cssX - w / 2) / this.scale,
      y: this.center.y - (cssY - h / 2) / this.scale,
    };
  }

  panBy(dxCss, dyCss) {
    this.center.x -= dxCss / this.scale;
    this.center.y += dyCss / this.scale;
  }

  zoomAt(factor, cssX, cssY) {
    const before = this.screenToWorld(cssX, cssY);
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    const { w, h } = this._cssSize();
    this.center.x = before.x - (cssX - w / 2) / this.scale;
    this.center.y = before.y + (cssY - h / 2) / this.scale;
  }

  // Current node size in CSS px (shared by the renderer and the LOD overlay so
  // matrices are sized to fit the square exactly).
  pointSizeCss() {
    return Math.max(this.pointMin, Math.min(this.pointMax, this.scale * this.pointScale));
  }

  // ── Highlights ──────────────────────────────────────────────────────────--
  setHighlight(rank) { this.highlightRank = rank ?? -1; }

  setEdges(segments) {
    const gl = this.gl;
    if (!segments || !segments.length) { this.edgeCount = 0; return; }
    const geo = expandSegments(segments);
    this.edgeCount = geo.length / 5; // 5 floats per vertex
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo, gl.DYNAMIC_DRAW);
  }

  setPath(strip) {
    const gl = this.gl;
    if (!strip || strip.length < 4) { this.pathCount = 0; return; }
    const geo = expandSegments(stripToSegments(strip));
    this.pathCount = geo.length / 5;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pathBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo, gl.DYNAMIC_DRAW);
  }

  setProgress(strip) {
    const gl = this.gl;
    if (!strip || strip.length < 4) { this.progressCount = 0; return; }
    const geo = expandSegments(stripToSegments(strip));
    this.progressCount = geo.length / 5;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.progressBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo, gl.DYNAMIC_DRAW);
  }

  // ── Render ──────────────────────────────────────────────────────────────--
  render() {
    const gl = this.gl;
    if (!this.count) {
      gl.clearColor(...this.colors.bg, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = this._cssSize();
    const pointCss = this.pointSizeCss();

    gl.clearColor(...this.colors.bg, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // ── Points ──
    const pp = this.pointProgram;
    gl.useProgram(pp);
    this._setCamera(pp, w, h);
    gl.uniform1f(gl.getUniformLocation(pp, 'u_pointSize'), pointCss * dpr);
    gl.uniform1f(gl.getUniformLocation(pp, 'u_maxLevel'), this.maxLevel || 1);
    gl.uniform3fv(gl.getUniformLocation(pp, 'u_even'), this.colors.even);
    gl.uniform3fv(gl.getUniformLocation(pp, 'u_odd'), this.colors.odd);
    gl.uniform3fv(gl.getUniformLocation(pp, 'u_top'), this.colors.top);
    gl.uniform3fv(gl.getUniformLocation(pp, 'u_bot'), this.colors.bot);

    const aPos = gl.getAttribLocation(pp, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const aLevel = gl.getAttribLocation(pp, 'a_level');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.levelBuffer);
    gl.enableVertexAttribArray(aLevel);
    gl.vertexAttribPointer(aLevel, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, this.count);

    // ── Lines (edges, then path) — expanded quads, constant CSS-px width ──
    const lp = this.lineProgram;
    gl.useProgram(lp);
    this._setCamera(lp, w, h);
    const aLp = gl.getAttribLocation(lp, 'a_pos');
    const aLd = gl.getAttribLocation(lp, 'a_dir');
    const aLs = gl.getAttribLocation(lp, 'a_side');
    const uColor = gl.getUniformLocation(lp, 'u_color');
    const uHalf = gl.getUniformLocation(lp, 'u_halfWidth');
    const STRIDE = 5 * 4; // bytes

    const drawLines = (buffer, vertCount, color, widthCss) => {
      if (!vertCount) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(aLp);
      gl.vertexAttribPointer(aLp, 2, gl.FLOAT, false, STRIDE, 0);
      gl.enableVertexAttribArray(aLd);
      gl.vertexAttribPointer(aLd, 2, gl.FLOAT, false, STRIDE, 8);
      gl.enableVertexAttribArray(aLs);
      gl.vertexAttribPointer(aLs, 1, gl.FLOAT, false, STRIDE, 16);
      gl.uniform4fv(uColor, color);
      gl.uniform1f(uHalf, widthCss / 2);
      gl.drawArrays(gl.TRIANGLES, 0, vertCount);
    };

    drawLines(this.edgeBuffer, this.edgeCount, this.colors.edge, this.edgeWidth);
    drawLines(this.pathBuffer, this.pathCount, this.colors.path, this.pathWidth);
    drawLines(this.progressBuffer, this.progressCount, this.colors.progress, this.progressWidth);

    // ── Highlighted node: a hollow square frame (line program, screen-constant
    //    width). Hollow by nature, so it never hides the node's LOD matrix. ──
    if (this.highlightRank >= 0 && this.positions) {
      const r = this.highlightRank;
      const cx = this.positions[r * 2], cy = this.positions[r * 2 + 1];
      const hw = (Math.max(pointCss, 9) * 0.68) / this.scale; // world half-size, just outside node
      const frame = expandSegments(new Float32Array([
        cx - hw, cy - hw, cx + hw, cy - hw,
        cx + hw, cy - hw, cx + hw, cy + hw,
        cx + hw, cy + hw, cx - hw, cy + hw,
        cx - hw, cy + hw, cx - hw, cy - hw,
      ]));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.hlPosBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, frame, gl.DYNAMIC_DRAW);
      drawLines(this.hlPosBuffer, frame.length / 5, [...this.colors.highlight, 1], 2.5);
    }
  }

  _setCamera(prog, w, h) {
    const gl = this.gl;
    gl.uniform2f(gl.getUniformLocation(prog, 'u_center'), this.center.x, this.center.y);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_scale'), this.scale);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_viewport'), w, h);
  }

  destroy() {
    const gl = this.gl;
    [this.posBuffer, this.levelBuffer, this.edgeBuffer, this.pathBuffer,
      this.progressBuffer, this.hlPosBuffer].forEach((b) => gl.deleteBuffer(b));
    gl.deleteProgram(this.pointProgram);
    gl.deleteProgram(this.lineProgram);
  }
}

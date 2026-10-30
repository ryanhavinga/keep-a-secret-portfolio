/* ============================================================
   KEEP A SECRET — THE COVER STACK AS A REAL 3D SCENE (prototype)
   Plain WebGL 2, no library. Every cover is a slab standing on edge in a row, drawn with a real depth
   buffer, so what is in front hides what is behind, however the covers move. The floor shows a soft,
   blurred reflection of every cover (its artwork and its spine) fading out with height; the background
   goes slightly soft while one cover stands flat in front.
   Units: one cover is 1 wide and 1 tall. x to the right, y up, z towards you.
   ============================================================ */
(() => {
  'use strict';

  const PF = CONFIG.portfolio, base = PF.tracks;
  const N = Math.max(base.length, Math.floor(PF.fill || base.length));
  /* Switches for finding out what a given screen makes of the picture (add to the address): ?aa=0 no antialiasing · ?aniso=0 no anisotropic
     filtering · ?bias=0 no sharpening bias · ?dpr=1 draw at 1x (the default is the screen's own, up to 2x) */
  const Q = new URLSearchParams(location.search);
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl2', { antialias: Q.get('aa') !== '0', alpha: true, premultipliedAlpha: true });
  if (!gl) { document.getElementById('nogl').hidden = false; return; }

  /* ---------- the numbers that matter (as on the CSS version) ---------- */
  const BACK = .28, OUT = .2, LIFT = .09, SWIPE = .55;     // the stack steps back · how far a cover slides out · how high it stands · how far it swipes up
  const T = .047;                                          // the sleeve's thickness
  const DIST = 1.25;                                       // the viewpoint's distance from the row (CSS: perspective 1.25 w)
  const VIEW_H = 1.416;                                    // how much height the window shows at the row (a cover is 70% of it)
  const REACH = [1, .36, .1];                              // hover lift by distance along the row
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- tiny matrix helpers (column-major) ---------- */
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[r + k * 4] * b[k + c * 4]; o[r + c * 4] = s; } return o; };
  const trans = (x, y, z) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); };

  /* ---------- easing: cubic-bezier, the same curves the CSS version uses ---------- */
  const bez = (x1, y1, x2, y2) => t => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 6; i++) {
      const cx = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3 - t;
      const dx = 3 * x1 * (1 - u) ** 2 + 6 * (x2 - x1) * u * (1 - u) + 3 * (1 - x2) * u * u;
      if (Math.abs(dx) < 1e-6) break; u -= cx / dx;
    }
    u = clamp(u, 0, 1);
    return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
  };
  const EASE = { out: bez(.2, .75, .2, 1), slide: bez(.3, .6, .2, 1), turn: bez(.45, 0, .25, 1), bar: bez(.45, 0, .3, 1),
                 fadeOut: bez(.16, .84, .24, 1), fadeIn: bez(.4, 0, .6, 1), arrive: bez(.1, .72, .15, 1), sharpen: bez(.5, 0, .85, .5), soft: bez(.16, .84, .24, 1) };

  /* ---------- tweens ---------- */
  const tweens = [];
  function tween(obj, key, to, dur, ease, delay = 0) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj && tweens[i].key === key) tweens.splice(i, 1);
    tweens.push({ obj, key, to, dur: dur * 1000, ease, t0: performance.now() + delay * 1000, from: null });
  }
  const stopTweens = obj => { for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj) tweens.splice(i, 1); };    // everything a cover was still doing is given up
  function stepTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (now < tw.t0) continue;
      if (tw.from === null) tw.from = tw.obj[tw.key];
      const p = clamp((now - tw.t0) / tw.dur, 0, 1);
      tw.obj[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(p);
      if (p >= 1) tweens.splice(i, 1);
    }
  }

  /* ---------- shaders ---------- */
  const VS = `#version 300 es
  in vec3 aPos; in vec2 aUv; in float aId; in vec3 aN;
  uniform mat4 uModel, uVP; uniform float uMirror;
  out vec2 vUv; out float vId; out float vH; out vec3 vN; out vec3 vW;
  void main() {
    vec4 w = uModel * vec4(aPos, 1.0);
    vH = w.y; vW = w.xyz; vN = mat3(uModel) * aN;
    if (uMirror > 0.5) w.y = -w.y;
    vUv = aUv; vId = aId;
    gl_Position = uVP * w;
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv; in float vId; in float vH; in vec3 vN; in vec3 vW;
  uniform sampler2D uTex, uSpine;
  uniform vec3 uTint, uEye; uniform float uShade, uLod, uAlpha, uRefl, uBias, uRight; uniform vec2 uTexSize;
  out vec4 o;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 soft(sampler2D t, vec2 uv, float lod) {
    if (lod < 0.05) return texture(t, uv, uBias).rgb;                // a little under the normal mip level: crisp, like the browser's own pictures
    vec2 d = (1.0 / uTexSize) * exp2(lod) * 0.7;
    vec3 a = textureLod(t, uv, lod).rgb * 2.0;
    a += textureLod(t, uv + vec2( d.x,  d.y), lod).rgb; a += textureLod(t, uv + vec2(-d.x,  d.y), lod).rgb;
    a += textureLod(t, uv + vec2( d.x, -d.y), lod).rgb; a += textureLod(t, uv + vec2(-d.x, -d.y), lod).rgb;
    return a / 6.0;
  }
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main() {
    int id = int(vId + 0.5);
    if (id == 0) {                                   // the artwork: the picture as it is, with only the dark tuck towards its far end (as on the site)
      vec3 a = soft(uTex, vUv, uLod);
      float s = uRight > 0.5 ? 1.0 - vUv.x : vUv.x;              // measured from the spine: on a cover on the right the picture runs the other way
      float sh = s < 0.34 ? 0.0 : (s < 0.68 ? (s - 0.34) / 0.34 * 0.3 : 0.3 + (s - 0.68) / 0.32 * 0.48);   // exactly the live site's: none at the front, 30% at two thirds, 78% at the far end
      vec3 c = a * (1.0 - sh * uShade);
      if (!gl_FrontFacing) c = pow(lin(uTint) * 0.5, vec3(1.0 / 2.2));
      c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      o = vec4(c * uAlpha, uAlpha);
      return;
    }
    vec3 n = normalize(vN);
    vec3 Lp = vec3(0.0, 0.85, 0.7) - vW; float dl = length(Lp); Lp /= dl;         // one soft lamp above the middle of the row
    float att = 1.0 / (1.0 + 0.3 * dl * dl);
    float diff = max(dot(n, Lp), 0.0) * att;
    vec3 V = normalize(uEye - vW);
    vec3 albedo; float spec = 0.0; float ao = 1.0;
    if (id == 0) {                                   // the artwork
      albedo = lin(soft(uTex, vUv, uLod));
      ao *= 1.0 - 0.9 * smoothstep(0.2, 1.0, vUv.x);                      // the far end is tucked away under the next cover, in its shadow
      ao *= mix(0.5, 1.0, smoothstep(0.0, 0.22, vUv.y));                  // the foot is shaded by the floor
      ao *= mix(0.8, 1.0, smoothstep(0.0, 0.08, 1.0 - vUv.y));
      if (!gl_FrontFacing) albedo = lin(uTint) * 0.4;
    } else if (id == 2) {                            // the spine: matt card, a soft sheen down its height, edges that catch the light
      vec4 t = textureLod(uSpine, vUv, uLod * 0.6);
      vec3 base = lin(uTint) * 0.78;
      base *= 0.72 + 0.5 * sin(vUv.y * 3.14159);
      base *= mix(0.55, 1.0, smoothstep(0.0, 0.12, min(vUv.x, 1.0 - vUv.x)));
      albedo = mix(base, vec3(0.92), t.a * 0.9);
      vec3 H = normalize(Lp + V);
      spec = pow(max(dot(n, H), 0.0), 36.0) * 0.28 * (1.0 - t.a) * (0.5 + 0.5 * sin(vUv.y * 6.2832 + 1.0));
      ao = mix(0.55, 1.0, smoothstep(0.0, 0.14, vUv.y));
    } else {
      albedo = lin(uTint) * 0.45; ao = 0.7;
    }
    vec3 lit = albedo * (0.42 + 0.9 * diff) * ao + spec;
    lit += lin(uTint) * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.05;                // a thin edge of light
    lit = aces(lit * 1.12);
    vec3 plain = clamp(albedo, 0.0, 1.0);                                          // the cover standing in front is the artwork, as it is
    vec3 c = pow(mix(plain, lit, uShade), vec3(1.0 / 2.2));
    c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;                                    // a touch of dither, so no banding in the dark
    float a = uAlpha;
    if (uRefl > 0.5) a *= uRefl * pow(1.0 - clamp(vH, 0.0, 1.0), 2.4) * 0.42;
    o = vec4(c * a, a);
  }`;
  /* ---------- the floor: the same soft light as on the site — a pool of each cover's colour under it, and the reflection of its spine as a
     faint streak running on towards you, through the whole depth of the floor; nothing mirrored, nothing with an edge ---------- */
  const FVS = `#version 300 es
  in vec3 aPos; uniform mat4 uVP; out vec3 vW;
  void main() { vW = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`;
  const FFS = `#version 300 es
  precision highp float;
  in vec3 vW; out vec4 o;
  uniform int uN; uniform vec4 uA[16], uB[16], uD[16]; uniform float uT;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 16; i++) {
      if (i >= uN) break;
      vec4 A = uA[i], B = uB[i], D = uD[i];          // A: hinge x, z, turn, side · B: colour, strength · D: lift (hover), standing in front
      float rot = A.z, sg = A.w, mag = D.x;
      vec2 dir = vec2(sg * cos(rot), -sin(rot));     // along the cover's width, on the floor
      vec2 p = vW.xz - A.xy;
      // the pool of light under the cover
      vec2 q = p - dir * 0.25;
      float u = dot(q, dir) / (0.72 * (1.0 + mag * 0.25)), v = dot(q, vec2(-dir.y, dir.x)) / (0.36 * (1.0 + mag * 0.25));
      float r = clamp(sqrt(u * u + v * v), 0.0, 1.0);
      float pool = pow(1.0 - r, 1.9) * 0.34 * (1.0 - mag * 0.55);
      // the spine's reflection: straight on towards you from the foot of the spine
      float edgeOn = smoothstep(0.17, 1.35, rot) * (1.0 - D.y);
      float xs = A.x - sg * 0.0235, dz = vW.z - A.y - mag * 0.1, sx = vW.x - xs;
      float sig = 0.05 * (1.0 + mag * 0.8);
      float streak = exp(-sx * sx / (2.0 * sig * sig)) * smoothstep(0.0, 0.06, dz) * pow(clamp(1.0 - dz / 1.5, 0.0, 1.0), 1.5) * 0.30 * (1.0 - mag * 0.6) * edgeOn;
      acc += B.rgb * (pool + streak) * B.w;
    }
    acc += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * step(0.002, max(acc.r, max(acc.g, acc.b)));
    o = vec4(acc, max(acc.r, max(acc.g, acc.b)));
  }`;
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const U = n => gl.getUniformLocation(prog, n);
  const uEye = U('uEye'), uModel = U('uModel'), uVP = U('uVP'), uMirror = U('uMirror'), uTint = U('uTint'), uShade = U('uShade'), uLod = U('uLod'), uAlpha = U('uAlpha'), uRefl = U('uRefl'), uTexSize = U('uTexSize'), uRight = U('uRight');
  gl.uniform1f(U('uBias'), Q.get('bias') !== null ? +Q.get('bias') : -.5);
  gl.uniform1i(U('uTex'), 0); gl.uniform1i(U('uSpine'), 1);
  const fprog = gl.createProgram();
  gl.attachShader(fprog, compile(gl.VERTEX_SHADER, FVS)); gl.attachShader(fprog, compile(gl.FRAGMENT_SHADER, FFS));
  gl.linkProgram(fprog);
  const FU = n => gl.getUniformLocation(fprog, n);
  const fVP = FU('uVP'), fN = FU('uN'), fA = FU('uA'), fB = FU('uB'), fD = FU('uD');
  const floorVao = gl.createVertexArray(); gl.bindVertexArray(floorVao);
  { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-4,-.002,-2.2, 4,-.002,-2.2, 4,-.002,3, -4,-.002,-2.2, 4,-.002,3, -4,-.002,3]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(fprog, 'aPos'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 12, 0); }
  gl.useProgram(prog);

  /* ---------- the sleeve: a slab with an artwork face, a back, a spine cap at the hinge, and the rest ---------- */
  function slab(x0, x1, flipSpine) {                       // hinge at x = 0, thickness T behind the face (z from -T to 0)
    const v = [], quad = (id, p, uv, nrm) => { for (const k of [0, 1, 2, 0, 2, 3]) v.push(...p[k], ...uv[k], id, ...nrm); };
    const left = x1 > 0, xf = left ? x1 : x0;               // the far end
    quad(0, [[x0,0,0],[x1,0,0],[x1,1,0],[x0,1,0]], [[0,0],[1,0],[1,1],[0,1]], [0,0,1]);                          // face
    quad(1, [[x0,0,-T],[x1,0,-T],[x1,1,-T],[x0,1,-T]], [[0,0],[1,0],[1,1],[0,1]], [0,0,-1]);                     // back
    const su = flipSpine ? [1, 0] : [0, 1];
    quad(2, [[0,0,-T],[0,0,0],[0,1,0],[0,1,-T]], [[su[0],0],[su[1],0],[su[1],1],[su[0],1]], [left ? -1 : 1,0,0]); // the spine
    quad(3, [[xf,0,0],[xf,0,-T],[xf,1,-T],[xf,1,0]], [[0,0],[1,0],[1,1],[0,1]], [left ? 1 : -1,0,0]);            // far end
    quad(4, [[x0,1,0],[x1,1,0],[x1,1,-T],[x0,1,-T]], [[0,0],[1,0],[1,1],[0,1]], [0,1,0]);                        // top
    quad(5, [[x0,0,0],[x0,0,-T],[x1,0,-T],[x1,0,0]], [[0,0],[1,0],[1,1],[0,1]], [0,-1,0]);                       // bottom
    return new Float32Array(v);
  }
  function mesh(data) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = 9 * 4, loc = n => gl.getAttribLocation(prog, n);
    gl.enableVertexAttribArray(loc('aPos')); gl.vertexAttribPointer(loc('aPos'), 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc('aUv')); gl.vertexAttribPointer(loc('aUv'), 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(loc('aId')); gl.vertexAttribPointer(loc('aId'), 1, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(loc('aN')); gl.vertexAttribPointer(loc('aN'), 3, gl.FLOAT, false, stride, 24);
    return { vao, count: data.length / 9 };
  }
  const MESH = { l: mesh(slab(0, 1, false)), r: mesh(slab(-1, 0, true)) };

  /* ---------- textures ---------- */
  const ANISO = Q.get('aniso') === '0' ? null : gl.getExtension('EXT_texture_filter_anisotropic');
  function tex(unit) { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (ANISO) gl.texParameterf(gl.TEXTURE_2D, ANISO.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function upload(t, unit, source) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.generateMipmap(gl.TEXTURE_2D); }
  function hsl(h, s, l) { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
  function tintOf(hex) {
    const n = parseInt(hex.replace('#', ''), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    const yellowish = h > 30 && h < 75;
    return hsl(h, clamp(Math.round(s * 100 * .85), 38, 70), yellowish ? 40 : 34);
  }
  function hueOf(hex) {                                    // the site's own tint numbers (css: --h --s --l), for its floor
    const n = parseInt(hex.replace('#', ''), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, sat = 0;
    if (d) { sat = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return { hue: Math.round(h), sat: clamp(Math.round(sat * 100), 45, 82), lit: (h > 30 && h < 75) ? 44 : 38 };
  }
  function glowOf(hex) {                                   // the cover's own colour, lighter: what its light on the floor is made of
    const n = parseInt(hex.replace('#', ''), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, sat = 0;
    if (d) { sat = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    const c = hsl(h, clamp(Math.round(sat * 100), 45, 82), 56);
    return c.map(v => Math.pow(v, 2.2));                  // (linear, like the floor's light)
  }
  function spineCanvas(title, artist) {                    // the lettering, drawn exactly as the site draws it (js/portfolio.js, lettering()): title bold, artist thin, reading upwards, white
    const c = document.createElement('canvas'); c.width = 96; c.height = 1600;
    const x = c.getContext('2d');
    x.translate(48, 800); x.rotate(-Math.PI / 2); x.textBaseline = 'middle'; x.textAlign = 'left';
    if ('letterSpacing' in x) x.letterSpacing = '3px';
    const face = '"Helvetica Neue", Helvetica, Arial, sans-serif', gap = 26;
    /* the title is bold; a part of it in brackets, like "(Akoestisch)", is a step lighter */
    const m = title.match(/^(.*?)(\s*\([^)]*\))$/), main = m ? m[1] : title, extra = m ? m[2] : '';
    const heavy = `800 59px ${face}`, medium = `500 59px ${face}`, thin = `300 59px ${face}`;
    x.font = heavy; const wm = x.measureText(main).width;
    x.font = medium; const we = extra ? x.measureText(extra).width : 0;
    x.font = thin; const wa = x.measureText(artist).width;
    const start = -(wm + we + gap + wa) / 2;
    x.font = heavy; x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 2.2; x.lineJoin = 'round';
    x.strokeText(main, start, 0); x.fillText(main, start, 0);                          // (the same slight stroke the title always had)
    if (extra) { x.font = medium; x.lineWidth = 1; x.strokeText(extra, start + wm, 0); x.fillText(extra, start + wm, 0); }
    x.font = thin; x.fillStyle = 'rgba(255,255,255,.72)'; x.fillText(artist, start + wm + we + gap, 0);
    return c;
  }


  /* ---------- the covers ---------- */
  const covers = [];
  for (let i = 0; i < N; i++) {
    const t = base[i % base.length], row = i - (N - 1) / 2;
    const c = { i, t, slot: i, row, side: row < 0 ? 'l' : 'r', sign: row < 0 ? 1 : -1, rim: (i === 0 || i === N - 1) ? 1.6 : 0,
      x: 0, y: 0, z: 0, rot: 90, alpha: 1, lod: 0, shade: 1, mag: 0, vel: 0, inStack: true, isFront: false,
      tint: tintOf(t.color || '#444455'), glow: glowOf(t.color || '#444455'), ...hueOf(t.color || '#444455'), artTex: tex(0), spineTex: tex(1), size: [1, 1] };
    c.texKey = c.artTex;
    covers.push(c);
    const img = new Image();
    img.onload = () => { c.size = [img.naturalWidth, img.naturalHeight]; upload(c.artTex, 0, img); };
    img.src = '../' + t.artwork;
    upload(c.spineTex, 1, spineCanvas(t.title, t.artist));
  }
  /* a 1-pixel stand-in until the artwork has loaded */
  covers.forEach(c => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.artTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([c.tint[0] * 255, c.tint[1] * 255, c.tint[2] * 255, 255])); });

  /* ---------- the camera ---------- */
  let W = 1, H = 1, aspect = 1, P = 0;                      // P: the spacing of the row
  const cam = { sx: 0, sy: 0, vx: 0, vy: 0 };              // the viewpoint drifts a little with the pointer
  const tanHalf = (VIEW_H / 2) / DIST, EYE_Y = .5 + .034 * VIEW_H;
  function resize() {
    const dpr = Q.get('dpr') ? +Q.get('dpr') : Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    aspect = W / H;
    const Wv = VIEW_H * aspect;
    P = Math.min(.6, (1.1 * Wv - .06) / Math.max(1, N - 1));
    covers.forEach(c => { c.row = c.slot - (N - 1) / 2; if (!c.isFront && c.inStack) c.x = c.row * P; });
  }
  function projection() {
    const f = 1 / tanHalf, n = .1, fa = 20;
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (fa + n) / (n - fa); m[11] = -1; m[14] = 2 * fa * n / (n - fa);
    m[8] = -m[0] * cam.sx / DIST; m[9] = -m[5] * cam.sy / DIST;           // keeps the row's own plane still while the viewpoint drifts
    return m;
  }
  const stack = { z: 0, soft: 0 };
  let front = null;

  /* ---------- the floor: the site's own CSS shadows, driven from the 3D scene ---------- */
  const FLOOR_CSS = true;
  const floorEl = document.getElementById('floor');
  covers.forEach(c => {
    const fl = document.createElement('div'); fl.className = `fl cd--${c.side} no-tr`;
    fl.innerHTML = '<div class="fl__glow"></div><div class="fl__edge"></div>';
    fl.style.setProperty('--h', c.hue); fl.style.setProperty('--s', c.sat); fl.style.setProperty('--l', c.lit);
    fl.style.transition = 'none'; floorEl.appendChild(fl); c.fl = fl; c.flGlow = fl.firstChild; c.flEdge = fl.lastChild;
  });
  function updateFloor() {
    const f = 1 / tanHalf, wpx = H * .5 / (DIST * tanHalf);                      // one cover's width in pixels
    const top = H / 2 - (1 - EYE_Y) / (DIST * tanHalf) * H / 2;                   // where the row's top is on the screen
    const vpx = W / 2 + (f / aspect) * cam.sx / DIST * W / 2, vpy = H / 2 - f * cam.sy / DIST * H / 2;   // the vanishing point (it drifts with the pointer)
    floorEl.style.setProperty('--w', wpx + 'px'); floorEl.style.setProperty('--t', Math.max(16, wpx * T) + 'px');
    floorEl.style.top = top + 'px'; floorEl.style.height = wpx + 'px';
    floorEl.style.perspective = (DIST * wpx) + 'px'; floorEl.style.perspectiveOrigin = `${vpx}px ${vpy - top}px`;
    covers.forEach(c => {
      const z = ((c.inStack ? stack.z : 0) + c.z) * wpx, mag = c.isFront ? 0 : clamp(c.mag, 0, 1);
      c.fl.style.setProperty('--x', (c.x * wpx) + 'px'); c.fl.style.setProperty('--z', z + 'px');
      c.fl.style.setProperty('--rot', c.rot + 'deg'); c.fl.style.setProperty('--mag', mag.toFixed(3));
      c.fl.classList.toggle('is-front', c.isFront);
      c.flGlow.style.opacity = ((.7 - mag * .38) * clamp(c.alpha, 0, 1)).toFixed(3);
      c.flEdge.style.opacity = c.isFront ? 0 : (((1 - mag * .62) * .85) * clamp(c.alpha, 0, 1)).toFixed(3);
    });
  }

  /* ---------- drawing ---------- */
  function modelOf(c) {
    const z = (c.inStack ? stack.z : 0) + c.z;
    const y = c.y + (c.isFront ? 0 : c.mag * .1);
    return mul(mul(trans(c.x, y, z), rotY(c.sign * c.rot * Math.PI / 180)), new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]));
  }
  function drawCover(c, vp, mirror) {
    gl.uniformMatrix4fv(uModel, false, modelOf(c));
    gl.uniform1f(uMirror, mirror ? 1 : 0);
    gl.uniform3fv(uTint, c.tint);
    gl.uniform1f(uShade, c.shade);
    gl.uniform1f(uRight, c.side === 'r' ? 1 : 0);
    gl.uniform1f(uLod, c.lod + c.rim * (1 - clamp(c.mag, 0, 1)) + (mirror ? 3.1 : 0));   // the outermost two are out of focus, and sharpen as they lift under the pointer, as on the site
    gl.uniform3f(uEye, cam.sx, EYE_Y + cam.sy, DIST);
    gl.uniform1f(uAlpha, c.alpha);
    gl.uniform1f(uRefl, mirror ? (1 - clamp(c.mag, 0, 1) * .5) : 0);
    gl.uniform2f(uTexSize, c.size[0], c.size[1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.artTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, c.spineTex);
    const m = MESH[c.side]; gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.count);
  }
  function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const view = trans(-cam.sx, -(EYE_Y + cam.sy), -DIST);          // the viewpoint, DIST in front of the row
    // the world is moved so the viewpoint sits at the origin; the row's own plane (z = 0) is DIST away
    const vp = mul(projection(), view);
    gl.uniformMatrix4fv(uVP, false, vp);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    // 1. the floor's light (the site's own CSS floor is under this picture; this is the in-scene version, kept for comparison)
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    if (!FLOOR_CSS) {
    gl.useProgram(fprog); gl.uniformMatrix4fv(fVP, false, vp); gl.uniform1i(fN, covers.length);
    const A = new Float32Array(64), B = new Float32Array(64), D = new Float32Array(64);
    covers.forEach((c, k) => {
      const z = (c.inStack ? stack.z : 0) + c.z, tint = c.glow;
      A.set([c.x, z, c.rot * Math.PI / 180, c.sign], k * 4);
      B.set([tint[0], tint[1], tint[2], clamp(c.alpha, 0, 1)], k * 4);
      D.set([c.isFront ? 0 : clamp(c.mag, 0, 1), c.isFront ? 1 : 0, 0, 0], k * 4);
    });
    gl.uniform4fv(fA, A); gl.uniform4fv(fB, B); gl.uniform4fv(fD, D);
    gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.bindVertexArray(floorVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.useProgram(prog); gl.uniformMatrix4fv(uVP, false, vp);
    // 2. the covers: the solid ones first, then the see-through ones back to front
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const solid = covers.filter(c => c.alpha >= .999), fading = covers.filter(c => c.alpha < .999 && c.alpha > .004);
    solid.forEach(c => drawCover(c, vp, false));
    fading.sort((a, b) => (a.inStack ? stack.z : 0) + a.z - ((b.inStack ? stack.z : 0) + b.z)).forEach(c => {
      gl.colorMask(false, false, false, false); gl.depthMask(true);
      gl.depthFunc(gl.LEQUAL); drawCover(c, vp, false);                           // 1. only its depth: which of its own surfaces is nearest
      gl.colorMask(true, true, true, true); gl.depthMask(false); gl.depthFunc(gl.EQUAL);
      drawCover(c, vp, false);                                                    // 2. only that nearest surface is painted, see-through
      gl.depthFunc(gl.LEQUAL);
    });
    gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
  }

  /* ---------- picking: a ray from the viewpoint through the pointer, against each cover's slab ---------- */
  function rayAt(clientX, clientY) {
    const nx = clientX / W * 2 - 1, ny = 1 - clientY / H * 2, f = 1 / tanHalf;
    const px = f / aspect, py = f, p8 = -px * cam.sx / DIST, p9 = -py * cam.sy / DIST;
    const dx = (nx + p8) / px, dy = (ny + p9) / py;
    return { o: [cam.sx, EYE_Y + cam.sy, DIST], d: [dx, dy, -1] };
  }
  function hitCover(c, ray) {
    const ang = -c.sign * c.rot * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
    const tz = (c.inStack ? stack.z : 0) + c.z, ty = c.y + (c.isFront ? 0 : c.mag * .1);
    const lx = ray.o[0] - c.x, ly = ray.o[1] - ty, lz = ray.o[2] - tz;
    const o = [lx * cs + lz * sn, ly, -lx * sn + lz * cs];
    const d = [ray.d[0] * cs + ray.d[2] * sn, ray.d[1], -ray.d[0] * sn + ray.d[2] * cs];
    const lo = c.side === 'l' ? [0, 0, -T] : [-1, 0, -T], hi = c.side === 'l' ? [1, 1, 0] : [0, 1, 0];
    let t0 = 0, t1 = 1e9;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return null; continue; }
      let a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null;
    }
    return t0;
  }
  function pick(clientX, clientY) {
    const ray = rayAt(clientX, clientY); let best = null, bt = 1e9;
    covers.forEach(c => { if (c.alpha < .2) return; const t = hitCover(c, ray); if (t !== null && t < bt) { bt = t; best = c; } });
    if (best) return best;
    // in the gaps between the covers: the nearest one along the row, while the pointer is at the height of the row
    const tz = (DIST - -.5) / 1, x = ray.o[0] + ray.d[0] * tz, y = ray.o[1] + ray.d[1] * tz;
    if (y < -.15 || y > 1.2) return null;
    let near = null, nd = 1e9; covers.forEach(c => { if (c.isFront || !c.inStack || c.alpha < .2) return; const dd = Math.abs(c.x - x); if (dd < nd) { nd = dd; near = c; } });
    return near;
  }

  /* ---------- selecting and putting back ---------- */
  const np = document.querySelector('[data-np]');                   // the site's own player bar
  const $np = sel => np.querySelector(sel);
  let timers = [];
  const later = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  function select(c) {
    if (!c || c === front) return;
    const prev = front;
    timers.forEach(clearTimeout); timers = [];
    if (prev) putBack(prev, true);
    clearTimeout(c.reT); stopTweens(c);                        // (if it was still on its way back, that is given up: its fade and its swipe would otherwise carry on)
    front = c; c.isFront = true;
    c.z = (c.inStack ? stack.z : 0) + c.z; c.inStack = false; c.alpha = 1; c.lod = 0;      // (it carries on from where it is in the world, whatever it was doing)
    tween(stack, 'z', -BACK, .7, EASE.slide);
    tween(c, 'z', OUT, .6, EASE.out);                         // out of the row, spine first
    tween(c, 'shade', 0, .8, EASE.soft);
    for (const o of covers) if (o !== c) tween(o, 'lod', 0, .3, EASE.fadeIn);
    $np('[data-np-art]').src = '../' + c.t.artwork; $np('[data-np-title]').textContent = c.t.title; $np('[data-np-artist]').textContent = c.t.artist;
    np.classList.add('is-live', 'is-playing'); document.documentElement.classList.add('np-live'); pillAway();
    later(340, () => {                                         // …then round to face you, in the middle, and up a little
      tween(c, 'rot', 0, .5, EASE.turn);
      tween(c, 'x', c.side === 'l' ? -.5 : .5, .6, EASE.out);
      tween(c, 'z', .05, .6, EASE.out);
      tween(c, 'y', LIFT, .6, EASE.out);
    });
    later(950, () => { for (const o of covers) if (o !== c && o !== front) tween(o, 'lod', 1.9, 1.6, EASE.soft); });   // the rest goes soft, once the cover has settled
  }
  function putBack(c, keepStack) {
    if (!c) return;
    if (!keepStack) { timers.forEach(clearTimeout); timers = []; }          // a turn or a soft background that was still to come must not run over the swipe
    if (c === front) front = null;                             // (it keeps c.isFront until it is back in the row: no hover lift, no spine reflection under a flat cover)
    if (!keepStack) { np.classList.remove('is-live', 'is-playing'); document.documentElement.classList.remove('np-live'); pillAway(); }
    for (const o of covers) if (o !== c) tween(o, 'lod', 0, .3, EASE.fadeIn);
    tween(c, 'y', LIFT + SWIPE, .5, EASE.bar);                // swipes up as fast as the player bar sinks…
    tween(c, 'alpha', 0, .4, EASE.fadeOut, .05);              // …and fades with it
    if (!keepStack) tween(stack, 'z', 0, .7, EASE.slide, .1);
    clearTimeout(c.reT);
    c.reT = setTimeout(() => {                                 // unseen: back in its own place, far back, blurred
      c.isFront = false; c.inStack = true; c.x = c.row * P; c.rot = 90; c.y = 0; c.z = -.6; c.shade = 1; c.lod = 0; c.alpha = 0; c.mag = 0; c.vel = 0;
      tween(c, 'z', 0, .75, EASE.arrive);                      // …and glides forward out of the back, slowing right down as it arrives
      tween(c, 'alpha', 1, .4, EASE.fadeIn);
    }, 540);
  }

  /* ---------- the page pill goes out of the way over the covers or while one is selected, as on the site; the small icons come from the config ---------- */
  const pill = document.querySelector('[data-seg]');
  let ptrY = -1;
  function pillAway() {
    if (!pill) return;
    const top = H / 2 - (1 - EYE_Y) / (DIST * tanHalf) * H / 2, bottom = H / 2 + EYE_Y / (DIST * tanHalf) * H / 2;
    pill.classList.toggle('is-away', !!front || (ptrY >= top && ptrY <= bottom));
  }
  [['[data-instagram]', CONFIG.instagram && CONFIG.instagram.url], ['[data-spotify-playlist]', CONFIG.spotify && CONFIG.spotify.url]]
    .forEach(([sel, url]) => { const a = document.querySelector(sel); if (a && url) { a.href = url; a.hidden = false; } });

  /* ---------- the pointer ---------- */
  let hover = null, ptr = { x: .5 * 1000, y: 0, have: false };
  canvas.addEventListener('pointermove', ev => { ptr = { x: ev.clientX, y: ev.clientY, have: true }; ptrY = ev.clientY; pillAway(); hover = pick(ev.clientX, ev.clientY); });
  canvas.addEventListener('pointerleave', () => { hover = null; ptr.have = false; });
  canvas.addEventListener('click', ev => {
    const c = pick(ev.clientX, ev.clientY);
    if (c && c !== front) select(c); else if (!c && front) putBack(front, false);
  });
  addEventListener('keydown', ev => { if (ev.key === 'Escape' && front) putBack(front, false); });
  addEventListener('resize', resize);

  /* ---------- the loop: hover springs, the drifting viewpoint, the tweens, the picture ---------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    stepTweens(now);
    const hs = hover && !hover.isFront ? hover.slot : (hover ? hover.slot : -1);
    covers.forEach(c => {
      const dist = hs < 0 ? 9 : Math.abs(c.slot - hs);
      const target = c.isFront ? 0 : (REACH[dist] || 0);
      const w0 = target < c.mag - .0005 ? 14.5 : 20, z = .8;
      for (let k = 0; k < 4; k++) { const h = dt / 4; c.vel += (w0 * w0 * (target - c.mag) - 2 * z * w0 * c.vel) * h; c.mag += c.vel * h; }
    });
    const gx = front || !ptr.have ? 0 : clamp(ptr.x / W * 2 - 1, -1, 1) * .026 * VIEW_H * aspect;
    const gy = front || !ptr.have ? 0 : clamp(ptr.y / H * 2 - 1, -1, 1) * .013 * VIEW_H;
    cam.sx += (gx - cam.sx) * (1 - Math.exp(-5 * dt)); cam.sy += (gy - cam.sy) * (1 - Math.exp(-5 * dt));
    render();
    if (FLOOR_CSS) updateFloor();
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);

  window.stack3d = { tick: () => stepTweens(performance.now()), select: i => select(covers[i]), putBack: () => putBack(front, false), covers, get front() { return front; } };
})();

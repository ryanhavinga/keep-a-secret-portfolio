/* ============================================================
   KEEP A SECRET — THE VAULT DOOR, IN 3D (source)
   Not loaded by the page. js/vault3d.bundle.js is this file plus the
   parts of three.js it uses, built into one script (see README, "The
   Vault door in 3D"). Edit here, rebuild, commit both.

   A real model rather than a drawing: a lathe-turned steel door with
   machined steps, 120 raised ribs, a three-spoke wheel and a combination
   dial; a hinge, a frame, a wall of brushed panels, a stone floor, and a
   room of deposit boxes behind a cage gate. Lit by physically-based
   lights with shadows — so the light that leaks round the door, and the
   bars of the cage laid out across the floor once it swings, are
   computed, not painted.

   js/vault.js owns the opening sequence's timing and sound; this file
   only draws it. It exposes window.KasVault3D.
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const TAU = Math.PI * 2;
const rad = d => d * Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;

/* a CSS cubic-bezier(), so the 3D moves can borrow the exact curves the
   2D version used */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t;
  const sy = t => ((ay * t + by) * t + cy) * t;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 28; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
const prog = (t, start, dur) => Math.min(1, Math.max(0, (t - start) / dur));

/* ---------- procedural textures ------------------------------ */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function toTexture(canvas, { srgb = false, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* fine streaks along u — on a lathe that is round the circumference, the
   way a turned or spun steel face is finished */
function brushedCanvas(base = 168, strokes = 3600) {
  const c = makeCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < strokes; i++) {
    const y = Math.random() * 512, x = Math.random() * 512;
    const len = 50 + Math.random() * 330;
    const v = Math.max(0, Math.min(255, base + (Math.random() - .5) * 110)) | 0;
    g.strokeStyle = `rgba(${v},${v},${v},${.06 + Math.random() * .18})`;
    g.lineWidth = .5 + Math.random() * 1.3;
    for (const off of [0, -512]) {
      g.beginPath(); g.moveTo(x + off, y); g.lineTo(x + off + len, y + (Math.random() - .5)); g.stroke();
    }
  }
  return c;
}
function wallCanvas() {
  /* one steel panel, 3.4 × 2.6 world units; seams along its left and
     bottom edges so repeating it tiles the wall into panels */
  const W = 1024, H = 784, c = makeCanvas(W, H), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#6e757c'); grad.addColorStop(1, '#5a6066');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5200; i++) {            // vertical brushing
    const x = Math.random() * W, y = Math.random() * H, len = 40 + Math.random() * 260;
    const v = (88 + Math.random() * 70) | 0;
    g.strokeStyle = `rgba(${v},${v + 3},${v + 6},${.05 + Math.random() * .12})`;
    g.lineWidth = .5 + Math.random();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5), y + len); g.stroke();
  }
  /* the seams: a dark groove with a lit lip either side */
  const seam = (x, y, w, h) => {
    g.fillStyle = '#16181a'; g.fillRect(x, y, w, h);
  };
  seam(0, 0, 6, H); seam(0, H - 6, W, 6);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(6, 0, 2, H); g.fillRect(0, H - 8, W, 2);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-2, 0, 2, H);
  /* the screws along them */
  for (let i = 0; i < 6; i++) {
    for (const [x, y] of [[26, 60 + i * 130], [W - 26, 60 + i * 130]]) {
      const r = g.createRadialGradient(x - 2, y - 2, 1, x, y, 7);
      r.addColorStop(0, '#c8cdd2'); r.addColorStop(1, '#2a2d31');
      g.fillStyle = r; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
    }
  }
  return c;
}
function stoneCanvas() {
  /* dark polished stone: soft cloudy mottling and a fine speckle, no
     seams — a smooth floor, not a tiled one */
  const S = 1024, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = 'rgb(112,112,118)'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 190;
    const lighter = Math.random() < .5, a = .035 + Math.random() * .05;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, lighter ? `rgba(170,170,178,${a})` : `rgba(20,20,26,${a * 1.5})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 9000; i++) {
    const v = 70 + Math.random() * 90 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * .22})`;
    g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
  }
  return c;
}
function boxesCanvas({ cols = 16, rows = 8, w = 1024, h = 512, hue = 36 } = {}) {
  /* a wall of safe-deposit doors */
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#0d0c0b'; g.fillRect(0, 0, w, h);
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const x = q * cw, y = r * ch, p = 3;
    const lum = 62 + Math.random() * 16;
    const gr = g.createLinearGradient(x, y, x, y + ch);
    gr.addColorStop(0, `hsl(${hue},14%,${lum + 14}%)`);
    gr.addColorStop(1, `hsl(${hue},12%,${lum - 10}%)`);
    g.fillStyle = gr; g.fillRect(x + p, y + p, cw - p * 2, ch - p * 2);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.strokeRect(x + p + 1, y + p + 1, cw - p * 2 - 2, ch - p * 2 - 2);
    g.strokeStyle = 'rgba(255,250,235,.35)'; g.lineWidth = 1; g.strokeRect(x + p + 3, y + p + 3, cw - p * 2 - 6, ch - p * 2 - 6);
    g.fillStyle = '#17140f';                                  // keyhole
    g.beginPath(); g.arc(x + cw / 2, y + ch * .42, 3.6, 0, TAU); g.fill();
    g.fillRect(x + cw / 2 - 1.4, y + ch * .42, 2.8, 8);
    g.fillStyle = 'rgba(20,16,10,.7)'; g.fillRect(x + cw * .3, y + ch * .74, cw * .4, 5);   // number plate
  }
  return c;
}
function dialCanvas() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#0b0b0c'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.fillStyle = '#ece8df'; g.strokeStyle = '#ece8df';
  for (let i = 0; i < 100; i++) {
    const a = i / 100 * TAU, long = i % 5 === 0;
    g.lineWidth = long ? 5 : 2.5;
    g.beginPath(); g.moveTo(0, -(S / 2 - 14)); g.lineTo(0, -(S / 2 - (long ? 56 : 38))); g.stroke();
    if (long) {
      g.save(); g.rotate(0); g.font = 'bold 30px Helvetica, Arial, sans-serif'; g.textAlign = 'center';
      g.translate(0, -(S / 2 - 96)); g.fillText(String(i), 0, 10); g.restore();
    }
    g.rotate(TAU / 100);
  }
  return c;
}
function radialSprite(stops) {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => r.addColorStop(o, col));
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- the lamps the steel reflects ---------------------- */
function buildEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(34, 16, 34),
    new THREE.MeshBasicMaterial({ color: 0x0a0b0d, side: THREE.BackSide })));
  const lamp = (w, h, col, k, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); s.add(m);
  };
  lamp(14, 7, 0xdce6ff, 2.6, [-2, 7.6, 3], [Math.PI / 2, 0, 0]);          // overhead softbox
  lamp(1.6, 9, 0xfff1d8, 2.2, [-10, 1, 4], [0, Math.PI / 2, 0]);          // tall strip, left
  lamp(1.6, 9, 0xcfdfff, 1.5, [10, 1, 5], [0, -Math.PI / 2, 0]);        // tall strip, right
  lamp(16, 3.2, 0xfff4e4, 1.5, [0, 1.5, 16], [0, Math.PI, 0]);          // behind the viewer
  lamp(9, 1.2, 0xffe2b8, 1.2, [0, -3, -14], [0, 0, 0]);                 // low, warm, far end
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, .02);
  pm.dispose();
  return rt.texture;
}

/* a lathe profile as separate flat segments, so each edge stays crisp
   instead of being smoothed into its neighbours. Points run round the
   outline so that each segment's normal faces out of the steel. The
   result's axis is +z, front at +y of the profile. */
function spin(points, mats, segs = 112) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const geo = new THREE.LatheGeometry([
      new THREE.Vector2(points[i][0], points[i][1]),
      new THREE.Vector2(points[i + 1][0], points[i + 1][1])
    ], segs);
    const m = new THREE.Mesh(geo, Array.isArray(mats) ? mats[i] : mats);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  g.rotation.x = Math.PI / 2;
  return g;
}

/* ============================================================
   THE FLOOR'S REFLECTION
   Polished stone doesn't mirror: it smears. The reflection is blurred,
   pulled out along the line of sight (the way a lamp becomes a streak on
   a wet road), and fades out towards the viewer, so a lit doorway reads
   as a soft glow in the floor and not as a second, upside-down doorway.
   Same inputs as three's own ReflectorShader, so Reflector takes it as is.
   ============================================================ */
const glossyFloorShader = {
  name: 'GlossyFloorShader',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying float vAlong;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vAlong = position.y;   // the plane's own y: 20.4 at the wall, falling towards the viewer
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying float vAlong;
    #include <logdepthbuf_pars_fragment>
    float blendOverlay(float base, float blend) {
      return (base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)));
    }
    vec3 blendOverlay(vec3 base, vec3 blend) {
      return vec3(blendOverlay(base.r, blend.r), blendOverlay(base.g, blend.g), blendOverlay(base.b, blend.b));
    }
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      float far = clamp((vAlong - 8.0) / 12.0, 0.0, 1.0);          // 1 at the wall, 0 under the viewer
      float spread = mix(.012, .05, far);                          // blurrier the further it is
      vec3 sum = vec3(0.0); float wsum = 0.0;
      for (int i = -8; i <= 8; i++) {
        float f = float(i) / 8.0;
        float wf = exp(-f * f * 2.2);
        for (int j = -3; j <= 3; j++) {
          float g = float(j) / 3.0;
          float w = wf * exp(-g * g * 2.0);
          sum += texture2D(tDiffuse, uv + vec2(g * .007, f * spread)).rgb * w;
          wsum += w;
        }
      }
      vec3 base = (sum / wsum) * pow(far, 1.1);
      gl_FragColor = vec4(blendOverlay(base, color), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

/* ============================================================
   THE SCENE
   ============================================================ */
const PIVOT_X = -1.12, PIVOT_Z = .17;       // the hinge line
const DOOR_Z = .085;                        // door centre-plane, world z
const OPEN_DEG = 82;

function create(canvas, T, onOpen) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  /* ?dpr=1 forces a lower resolution — handy for profiling a slow device */
  const DPR = Math.min(Number(new URLSearchParams(location.search).get('dpr')) || window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .88;
  renderer.setClearColor(0x020203, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.Fog(0x020203, 6, 24);
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = .42;

  const camera = new THREE.PerspectiveCamera(30, 1, .05, 80);

  /* ---------- materials -------------------------------------- */
  const brushed = brushedCanvas();
  const rough = toTexture(brushed, { repeat: [5, 2] });
  const bump = toTexture(brushed, { repeat: [5, 2] });
  const steel = (color, r, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, metalness: 1, roughness: r, roughnessMap: rough, bumpMap: bump, bumpScale: .08,
    shadowSide: THREE.DoubleSide, ...extra
  });
  const M = {
    face:    steel(0x8e959c, .62),
    dark:    steel(0x3b4045, .72),
    rim:     steel(0x9aa1a8, .5),
    ribs:    new THREE.MeshPhysicalMaterial({ color: 0xb9c0c6, metalness: 1, roughness: .26, shadowSide: THREE.DoubleSide }),
    chrome:  new THREE.MeshPhysicalMaterial({ color: 0xd8dde1, metalness: 1, roughness: .12, shadowSide: THREE.DoubleSide }),
    brass:   new THREE.MeshPhysicalMaterial({ color: 0xc9a25c, metalness: 1, roughness: .3 }),
    plate:   steel(0xa4abb2, .5)
  };

  const wallCv = wallCanvas();
  const wallMap = toTexture(wallCv, { srgb: true, repeat: [1 / 3.4, 1 / 2.6] });
  const wallBump = toTexture(wallCv, { repeat: [1 / 3.4, 1 / 2.6] });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x9aa1aa, map: wallMap, bumpMap: wallBump, bumpScale: 1.4,
    metalness: .85, roughness: .52, shadowSide: THREE.DoubleSide
  });

  /* ---------- the wall ---------------------------------------- */
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-26, -1.2); wallShape.lineTo(26, -1.2); wallShape.lineTo(26, 9); wallShape.lineTo(-26, 9);
  wallShape.lineTo(-26, -1.2);
  const hole = new THREE.Path(); hole.absarc(0, 0, 1.01, 0, TAU, true);
  wallShape.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 1.6, bevelEnabled: false, curveSegments: 96 });
  wallGeo.translate(0, 0, -1.6);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.castShadow = wall.receiveShadow = true;
  scene.add(wall);

  /* polished black: a mirror that has been tinted right down. Reflector
     overlays the reflection on its colour, which keeps highlights bright
     and takes everything mid-toned to near black — a dark wall barely
     shows in it, a gold ring and a lit doorway burn. */
  const reflectScale = .85;
  const floor = new Reflector(new THREE.PlaneGeometry(60, 44), {
    textureWidth: Math.max(2, Math.round((canvas.clientWidth || innerWidth) * DPR * reflectScale)),
    textureHeight: Math.max(2, Math.round((canvas.clientHeight || innerHeight) * DPR * reflectScale)),
    color: new THREE.Color(0x2e2a28), clipBias: .003,
    shader: glossyFloorShader
  });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.2, 20.4);
  scene.add(floor);
  /* the stone itself, laid over the mirror: lit like any surface (the
     cage's shadow stripes land on it, the gold falls off across it), and
     just see-through enough that the reflection comes up through it */
  const stoneCv = stoneCanvas();
  const stoneMap = toTexture(stoneCv, { srgb: true, repeat: [1 / 7, 1 / 7] });
  const floorSkin = new THREE.Mesh(new THREE.PlaneGeometry(60, 44),
    new THREE.MeshStandardMaterial({
      map: stoneMap, roughness: .58, metalness: .05,
      transparent: true, opacity: .8, depthWrite: false
    }));
  floorSkin.rotation.x = -Math.PI / 2;
  floorSkin.position.set(0, -1.199, 20.4);
  floorSkin.receiveShadow = true;
  scene.add(floorSkin);

  /* the vault's gold lying on the floor in front of it, falling away */
  const floorGlow = new THREE.PointLight(0xffa24a, 0, 6, 1.5);
  floorGlow.position.set(0, -.8, 1.2);
  scene.add(floorGlow);

  /* ---------- the frame ring + tunnel sleeve ------------------ */
  const frameRing = spin([
    [1.38, 0], [1.38, .05], [1.36, .07], [1.24, .07], [1.22, .09], [1.22, .14],
    [1.20, .16], [1.04, .16], [1.01, .13], [1.01, 0]
  ], M.rim);
  scene.add(frameRing);

  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(1.005, 1.005, 1.6, 96, 1, true),
    steel(0x6a7279, .5, { side: THREE.BackSide }));
  sleeve.rotation.x = Math.PI / 2; sleeve.position.z = -.8;
  sleeve.receiveShadow = true; sleeve.castShadow = true;
  scene.add(sleeve);

  /* ---------- the room behind --------------------------------- */
  const boxTex = toTexture(boxesCanvas(), { srgb: true });
  const boxMat = new THREE.MeshStandardMaterial({
    map: boxTex, metalness: .55, roughness: .42,
    emissive: 0xffa84d, emissiveMap: boxTex, emissiveIntensity: .13
  });
  const ceilCanvas = makeCanvas(512, 512), cg = ceilCanvas.getContext('2d');
  cg.fillStyle = '#16130f'; cg.fillRect(0, 0, 512, 512);
  cg.fillStyle = '#fff3d6'; cg.fillRect(196, 0, 120, 512);
  const ceilTex = toTexture(ceilCanvas, { srgb: true });
  const ceilMat = new THREE.MeshStandardMaterial({
    map: ceilTex, emissive: 0xffbb66, emissiveMap: ceilTex, emissiveIntensity: .9, roughness: .6
  });
  const roomFloor = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: .28, metalness: .1 });
  const backWall = boxMat.clone(); backWall.emissiveIntensity = .16;
  const room = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 6),
    [boxMat, boxMat, ceilMat, roomFloor, backWall, backWall].map(m => { m = m.clone(); m.side = THREE.BackSide; return m; }));
  room.position.set(0, .4, -4.6);
  scene.add(room);

  /* the cage gate, just inside the sleeve */
  const gate = new THREE.Group();
  const barMat = M.chrome;
  for (let x = -.97; x <= .971; x += .0776) {
    const h = 2 * Math.sqrt(Math.max(0, 1.0 - x * x));
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.0105, .0105, h, 10), barMat);
    bar.position.x = x; bar.castShadow = true; gate.add(bar);
  }
  for (const y of [-.52, .52]) {
    const len = 2 * Math.sqrt(1 - y * y);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .028, .028), barMat);
    rail.position.set(0, y, .02); rail.castShadow = true; gate.add(rail);
  }
  const gateRing = new THREE.Mesh(new THREE.TorusGeometry(.99, .02, 12, 96), barMat);
  gateRing.castShadow = true; gate.add(gateRing);
  const gatePlate = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .03, 40), M.chrome);
  gatePlate.rotation.x = Math.PI / 2; gatePlate.position.z = .03; gatePlate.castShadow = true; gate.add(gatePlate);
  gate.position.z = -.3;
  scene.add(gate);

  /* ---------- the door ---------------------------------------- */
  const pivot = new THREE.Group();
  pivot.position.set(PIVOT_X, 0, PIVOT_Z);
  scene.add(pivot);
  const door = new THREE.Group();
  door.position.set(-PIVOT_X, 0, DOOR_Z - PIVOT_Z);
  pivot.add(door);

  const P = [   // [r, y] round the outline: back, plug, shoulder, rim, front steps, plate
    [0, -.30], [.92, -.30], [.94, -.28], [.94, -.14], [.985, -.14], [1.0, -.125], [1.0, .055],
    [.985, .075], [.935, .075], [.935, .05], [.865, .05], [.865, .082], [.80, .082], [.80, .068],
    [.31, .068], [.31, .098], [.295, .112], [.0, .112]
  ];
  const doorMats = [
    M.dark, M.dark, M.dark, M.dark, M.rim, M.rim, M.rim,
    M.rim, M.rim, M.dark, M.rim, M.rim, M.rim, M.dark, M.rim, M.rim, M.plate
  ];
  door.add(spin(P, doorMats));

  /* the raised ribs — real geometry, so each throws its own highlight */
  const RIBS = 120, r0 = .33, r1 = .785;
  const rs = new THREE.Shape();
  const wi = TAU * r0 / RIBS * .42, wo = TAU * r1 / RIBS * .42;
  rs.moveTo(-wi / 2, r0); rs.lineTo(wi / 2, r0); rs.lineTo(wo / 2, r1); rs.lineTo(-wo / 2, r1); rs.closePath();
  const ribGeo = new THREE.ExtrudeGeometry(rs, {
    depth: .024, bevelEnabled: true, bevelThickness: .004, bevelSize: .0035, bevelSegments: 1
  });
  const ribs = new THREE.InstancedMesh(ribGeo, M.ribs, RIBS);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < RIBS; i++) {
    tmp.position.set(0, 0, .068);
    tmp.rotation.set(0, 0, i / RIBS * TAU);
    tmp.updateMatrix();
    ribs.setMatrixAt(i, tmp.matrix);
  }
  ribs.castShadow = ribs.receiveShadow = true;
  door.add(ribs);

  /* the locking bolts, round the rim */
  const BOLTS = 16, bolts = [];
  const boltGeo = new THREE.CylinderGeometry(.03, .03, .14, 20);
  for (let i = 0; i < BOLTS; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = i / BOLTS * TAU + TAU / BOLTS / 2;
    arm.position.z = -.035;
    const bolt = new THREE.Mesh(boltGeo, M.chrome);
    bolt.castShadow = true;
    arm.add(bolt);
    door.add(arm);
    bolts.push(bolt);
  }

  /* the wheel */
  const wheel = new THREE.Group();
  wheel.position.z = .112;
  const hub = spin([[.15, 0], [.15, .04], [.138, .052], [.117, .052], [.105, .04], [.105, 0]], M.chrome, 64);
  wheel.add(hub);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = rad(i * 120 + 90);
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(.021, .027, .4, 24), M.chrome);
    spoke.position.set(0, .31, .03); spoke.castShadow = true;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.058, 32, 20), M.chrome);
    ball.position.set(0, .515, .03); ball.castShadow = true;
    arm.add(spoke, ball);
    wheel.add(arm);
  }
  door.add(wheel);

  /* the combination dial, in the wheel's hub */
  const dial = new THREE.Group();
  dial.position.z = .122;
  const dialDisc = new THREE.Mesh(new THREE.CircleGeometry(.092, 64),
    new THREE.MeshStandardMaterial({ map: toTexture(dialCanvas(), { srgb: true }), roughness: .5, metalness: .2 }));
  dialDisc.material.map.wrapS = dialDisc.material.map.wrapT = THREE.ClampToEdgeWrapping;
  dial.add(dialDisc);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(.038, .042, .026, 36), M.chrome);
  knob.rotation.x = Math.PI / 2; knob.position.z = .013; knob.castShadow = true;
  dial.add(knob);
  door.add(dial);
  const index = new THREE.Mesh(new THREE.ConeGeometry(.012, .026, 3), M.brass);
  index.rotation.z = Math.PI; index.position.set(0, .107, .13);
  door.add(index);

  /* hinges: barrels on the frame, leaves on the door */
  for (const y of [-.45, .45]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.052, .052, .3, 28), M.chrome);
    barrel.position.set(PIVOT_X, y, PIVOT_Z); barrel.castShadow = true;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .4, 16), M.rim);
    pin.position.copy(barrel.position);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.045, 16, 10), M.chrome);
    cap.position.set(PIVOT_X, y + .17, PIVOT_Z);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .12), M.rim);
    bracket.position.set(PIVOT_X - .1, y, .1); bracket.castShadow = true;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.24, .26, .022), M.rim);
    leaf.position.set(-1.0, y, .09); leaf.castShadow = true;
    scene.add(barrel, pin, cap, bracket);
    door.add(leaf);
  }

  /* ---------- the light --------------------------------------- */
  scene.add(new THREE.HemisphereLight(0x6f7f99, 0x0c0a08, .015));

  const key = new THREE.SpotLight(0xb3c3de, 78, 26, .34, 1, 1.7);
  key.position.set(-3.2, 5.4, 6.5);
  key.target.position.set(0, -.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 4;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xffe6c8, .02);
  fill.position.set(5, 1.5, 8);
  scene.add(fill);

  /* from inside the vault, out through the doorway: what the cage's
     shadow stripes fall from, and what leaks round a door that isn't
     quite shut */
  const INNER_LIGHT = 95;
  const inner = new THREE.SpotLight(0xffb866, INNER_LIGHT, 26, .56, .35, 1.3);
  inner.position.set(0, .2, -3.6);
  inner.target.position.set(0, -.5, 8);
  inner.castShadow = true;
  inner.shadow.mapSize.set(2048, 2048);
  inner.shadow.bias = -.0003; inner.shadow.normalBias = .015; inner.shadow.radius = 3;
  inner.shadow.camera.near = 1.2;
  scene.add(inner, inner.target);

  /* the room's warmth on the back of the door and the frame beside it —
     unshadowed, so it comes up only as the door opens */
  const spill = new THREE.PointLight(0xffb060, 0, 9, 1.4);
  spill.position.set(.6, .1, 1.1);
  scene.add(spill);

  /* the light that gets out round the edge of the door: a thin gold
     circle on the frame, with a soft halo thrown onto the steel outside
     it. It is there from the start, barely — the vault gives something
     away — and swells once the bolts are drawn. */
  const seamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uAmt: { value: .4 }, uHalo: { value: .8 } },
    vertexShader: `
      varying vec3 vPos;
      void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uAmt; uniform float uHalo;
      varying vec3 vPos;
      void main(){
        float r = length(vPos.xy);
        float d = r - 1.0125;
        float outside = step(1.003, r);
        float core = exp(-pow(d / .0042, 2.0));
        float near = exp(-max(d, 0.0) * 26.0) * outside;
        float far  = exp(-max(d, 0.0) * 5.0) * outside;
        float wide = exp(-max(d, 0.0) * 1.35) * outside;
        float v = core * 3.8 + near * .6 + far * .26 * uHalo + wide * .075 * uHalo;
        gl_FragColor = vec4(vec3(1.0, .64, .2) * v * uAmt, 1.0);
      }`
  });
  const seam = new THREE.Mesh(new THREE.RingGeometry(.9, 4.6, 192, 1), seamMat);
  seam.position.z = .172;
  scene.add(seam);

  /* the ring is light on the steel, not a thing standing there — it has
     no business being mirrored in the floor */
  const reflect = floor.onBeforeRender;
  floor.onBeforeRender = function (...args) {
    seam.visible = false;
    reflect.apply(this, args);
    seam.visible = true;
  };

  /* shafts of it in the air, once the door is open */
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uAmt: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uAmt; uniform float uTime;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float a = vUv.x * 6.2831853;
        float s = .5 + .5 * sin(a * 7.0 + uTime * .05);
        s *= .5 + .5 * sin(a * 13.0 - uTime * .04 + 1.3);
        s += .38 * (.5 + .5 * sin(a * 29.0 + 2.0 + uTime * .03));
        s = pow(clamp(s, 0.0, 1.0), 1.7);
        float along = pow(1.0 - vUv.y, 1.35);
        float f = abs(dot(normalize(vN), normalize(vV)));
        float w = .25 + .75 * (1.0 - f);
        float al = uAmt * s * along * w * .026;
        gl_FragColor = vec4(vec3(1.0, .66, .32) * al * 1.8, al);
      }`
  });
  const shafts = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 1.0, 7, 72, 1, true), shaftMat);
  shafts.rotation.x = Math.PI / 2; shafts.position.z = 3.4;
  shafts.frustumCulled = false;
  scene.add(shafts);

  /* dust, floating in it */
  const DUST = 420, dust = new Float32Array(DUST * 3), dustV = new Float32Array(DUST * 2);
  const seed = i => {
    const z = .3 + Math.random() * 6.2, rr = (1.0 + z / 6.4 * 2.3) * Math.sqrt(Math.random()) * .95, a = Math.random() * TAU;
    dust[i * 3] = Math.cos(a) * rr; dust[i * 3 + 1] = Math.sin(a) * rr - .1; dust[i * 3 + 2] = z;
  };
  for (let i = 0; i < DUST; i++) { seed(i); dustV[i * 2] = (Math.random() - .5) * .05; dustV[i * 2 + 1] = .01 + Math.random() * .03; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustMat = new THREE.PointsMaterial({
    size: .045, map: radialSprite([[0, 'rgba(255,236,200,1)'], [.4, 'rgba(255,220,170,.5)'], [1, 'rgba(255,200,140,0)']]),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  });
  const dustPts = new THREE.Points(dustGeo, dustMat);
  dustPts.frustumCulled = false;
  scene.add(dustPts);

  /* the glare of the room itself, through the doorway */
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialSprite([[0, 'rgba(255,244,222,1)'], [.35, 'rgba(255,214,150,.55)'], [1, 'rgba(255,190,120,0)']]),
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  glare.position.set(0, 0, -.55);
  glare.scale.set(4.6, 4.6, 1);
  scene.add(glare);

  /* ---------- post: a little bloom on the light --------------- */
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(DPR);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .05, .3, 2.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- sizing ------------------------------------------ */
  let aspect = 1, camDist = 7.4;
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    floor.getRenderTarget().setSize(Math.max(2, Math.round(w * DPR * reflectScale)), Math.max(2, Math.round(h * DPR * reflectScale)));
    aspect = w / h;
    camera.aspect = aspect;
    /* keep the whole frame in shot on a tall phone, not only a wide
       desktop: the door and its frame need ≈ 3.1 world units across */
    camDist = Math.max(7.4, 3.2 / (2 * Math.tan(rad(camera.fov) / 2) * aspect));
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* ---------- the sequence ------------------------------------ */
  const eWheel = bezier(.55, 0, .25, 1), eDial = bezier(.45, 0, .3, 1);
  const eBolt = bezier(.65, 0, .35, 1), eCrack = bezier(.2, .7, .3, 1);
  const eSwing = bezier(.5, 0, .2, 1), eEnter = bezier(.6, 0, .35, 1);
  const eSoft = bezier(.3, .05, .3, .95);
  const DIAL_STOPS = [250, 70, 165];
  const SWING_DUR = T.swingDur || 2500;

  const camA = new THREE.Vector3(), camB = new THREE.Vector3(0, -.04, .05);
  const lookA = new THREE.Vector3(), lookB = new THREE.Vector3(0, 0, -4);
  const look = new THREE.Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  function apply(t, now) {
    let ang = 0, prev = 0;
    DIAL_STOPS.forEach((s, i) => {
      const p = prog(t, T.dial[i], 500);
      if (p > 0) ang = prev + (s - prev) * eDial(p);
      prev = s;
    });
    dial.rotation.z = rad(ang);
    wheel.rotation.z = rad(300) * eWheel(prog(t, T.turn, T.turnDur));

    const be = eBolt(prog(t, T.unbolt, T.boltDur));
    const tip = lerp(1.05, .93, be);
    bolts.forEach(b => { b.position.y = tip - .07; });

    const crack = eCrack(prog(t, T.crack, 700)), swing = eSwing(prog(t, T.swing, SWING_DUR));
    const open = rad(7) * crack + rad(OPEN_DEG - 7) * swing;
    pivot.rotation.y = -open;

    /* shut, the vault gives nothing away: the light inside only starts to
       reach round the door as it gives */
    inner.intensity = INNER_LIGHT * (.02 + .98 * eSoft(prog(t, T.crack - 150, 1000)));

    spill.intensity = 2.2 * Math.min(1, open / rad(40));

    const leak = eSoft(prog(t, T.unbolt, 600));
    const flood = eEnter(prog(t, T.enter, 1800));
    seamMat.uniforms.uAmt.value = (.42 + .07 * Math.sin(now / 850) + .6 * leak) * (1 - Math.min(1, flood * 2.6));
    floorGlow.intensity = (.5 + 1.6 * leak + 2.2 * eSoft(prog(t, T.crack, 1500))) * (1 - Math.min(1, flood * 2.6));
    seamMat.uniforms.uHalo.value = .8 + .5 * eSoft(prog(t, T.crack, 1800));
    const beam = eSoft(prog(t, T.crack, 1600)) * .35 + eSoft(prog(t, T.swing, 2300)) * .65;
    shaftMat.uniforms.uAmt.value = beam;
    shaftMat.uniforms.uTime.value = now / 1000;
    dustMat.opacity = beam * .5;
    glare.material.opacity = Math.min(1, open / rad(30)) * .05;

    /* the camera: a little off to the left, easing in towards the opening
       once the door has swung, then straight through it */
    const e = eEnter(prog(t, T.enter, 1800));
    const driftX = -.55 + .2 * eSoft(prog(t, T.swing, SWING_DUR));
    camA.set(driftX + pointer.sx * .35, .22 + pointer.sy * .16, camDist);
    lookA.set(pointer.sx * -.08, -.18 + pointer.sy * -.04, 0);
    camera.position.lerpVectors(camA, camB, e);
    look.lerpVectors(lookA, lookB, e);
    camera.lookAt(look);
    const fov = lerp(30, 58, e);
    if (Math.abs(camera.fov - fov) > .01) {
      camera.fov = fov;
      camDist = Math.max(7.4, 3.2 / (2 * Math.tan(rad(30) / 2) * aspect));
      camera.updateProjectionMatrix();
    }
  }

  /* dust drifts for as long as the scene is up */
  function drift(dt) {
    for (let i = 0; i < DUST; i++) {
      dust[i * 3] += dustV[i * 2] * dt;
      dust[i * 3 + 1] += dustV[i * 2 + 1] * dt;
      if (dust[i * 3 + 1] > 3.4 || Math.abs(dust[i * 3]) > 3.6) seed(i);
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- pointer: hover + click on the door -------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let started = false;
  const overDoor = ev => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(door, true).length > 0;
  };
  canvas.addEventListener('pointermove', ev => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((ev.clientY - r.top) / r.height) * 2 - 1;
    if (!started) canvas.style.cursor = overDoor(ev) ? 'pointer' : '';
  });
  canvas.addEventListener('click', ev => { if (!started && overDoor(ev)) onOpen && onOpen(); });

  /* ---------- the loop ---------------------------------------- */
  let t0 = null, fixed = null, raf = 0, last = performance.now(), live = true;
  function frame(now) {
    if (!live) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2.2);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2.2);
    const t = fixed != null ? fixed : (t0 == null ? -1 : now - t0);
    apply(t, now);
    drift(dt);
    composer.render();
  }
  raf = requestAnimationFrame(frame);

  /* compile everything up front so the first frame of the sequence never
     stalls, then report ready */
  renderer.compile(scene, camera);
  apply(-1, performance.now());
  composer.render();

  return {
    /* for tuning the light live from the console: KasVault3D.debug */
    debug: { renderer, scene, camera, key, fill, inner, spill, floorGlow, bloom, glare, seam, seamMat, shaftMat, dustMat, M, wallMat, floor, floorSkin, pivot, gate, room },
    /* the closed door as a still — what css/vault.css shows for the
       instant before this scene has started up (img/vault-poster-*.jpg).
       Re-make them from the console if the look ever changes:
       copy(__vault.snapshot()) */
    snapshot(type = 'image/jpeg', quality = .82) {
      apply(-1, performance.now());
      composer.render();
      return canvas.toDataURL(type, quality);
    },
    start() { started = true; canvas.style.cursor = ''; t0 = performance.now(); },
    seek(ms) { fixed = ms; },
    dispose() {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse(o => {
        o.geometry?.dispose?.();
        [].concat(o.material || []).forEach(m => { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose(); });
      });
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}

window.KasVault3D = {
  supported() {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch (_) { return false; }
  },
  init(canvas, T, onOpen) { return create(canvas, T, onOpen); }
};

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('hero3d');
const holder = document.getElementById('heroVisual');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Must match the CSS layouts where the 3D block sits in its own box (stacked phone / landscape phone).
const stacked = matchMedia('(max-width: 900px), (orientation: landscape) and (max-height: 520px)');
const coarse = matchMedia('(pointer: coarse)').matches;
// Phones/tablets and low-core machines get a lighter material + geometry tier.
const lite = coarse || stacked.matches || (navigator.hardwareConcurrency || 8) <= 4;

// Let the page paint, reveal its copy and become scrollable before the heavy WebGL setup
// (renderer, environment map, shader compile) takes the main thread.
await new Promise(r => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 1200 }) : r()), 350));

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: lite ? 'low-power' : 'high-performance' });
let maxDpr = Math.min(devicePixelRatio || 1, lite ? 1.25 : 2);
renderer.setPixelRatio(maxDpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 14);
const VIEW_H = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

scene.add(new THREE.AmbientLight(0xe0e7ff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 6, 8); scene.add(key);
const rimC = new THREE.PointLight(0x22d3ee, 40, 30); rimC.position.set(-6, 2, 3); scene.add(rimC);
const rimP = new THREE.PointLight(0xf472b6, 40, 30); rimP.position.set(6, -4, 2); scene.add(rimP);

/* ---------- Involute-ish gear geometry ---------- */
const MODULE = 0.22;
function gearGeometry(teeth, thickness = 0.5, holeR = 0.35) {
  const r = (MODULE * teeth) / 2, ra = r + MODULE, rf = r - 1.25 * MODULE;
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [rf, a - step * 0.5], [rf, a - step * 0.28], [r, a - step * 0.2],
      [ra, a - step * 0.12], [ra, a + step * 0.12], [r, a + step * 0.2], [rf, a + step * 0.28],
    ];
    pts.forEach(([rad, ang], j) => {
      const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
      i === 0 && j === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, Math.PI * 2, true); shape.holes.push(hole);
  // lightening holes for a machined look
  const spokes = teeth > 14 ? 6 : 4, hr = (rf + holeR) / 2, hs = (rf - holeR) * 0.28;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2, p = new THREE.Path();
    p.absarc(Math.cos(a) * hr, Math.sin(a) * hr, hs, 0, Math.PI * 2, true);
    shape.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04,
    bevelSegments: lite ? 1 : 3, curveSegments: lite ? 12 : 24,
  });
  g.center();
  return { geo: g, r };
}

// Physical materials (clearcoat / iridescence / transmission) on desktop; standard PBR on lite devices.
const mats = lite ? {
  chrome: new THREE.MeshStandardMaterial({ color: 0xf8faff, metalness: 0.55, roughness: 0.18, envMapIntensity: 1.3 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x67e8f9, metalness: 0.6, roughness: 0.24 }),
  violet: new THREE.MeshStandardMaterial({ color: 0xa5b4fc, metalness: 0.6, roughness: 0.22 }),
  rose: new THREE.MeshStandardMaterial({ color: 0xf9a8d4, metalness: 0.6, roughness: 0.26 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xe0e7ff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.45 }),
} : {
  chrome: new THREE.MeshPhysicalMaterial({ color: 0xf1f5ff, metalness: 0.75, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.6, iridescenceIOR: 1.4, sheen: 1, sheenColor: 0xc7d2fe }),
  cyan: new THREE.MeshPhysicalMaterial({ color: 0x67e8f9, metalness: 0.6, roughness: 0.22, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }),
  violet: new THREE.MeshPhysicalMaterial({ color: 0xa5b4fc, metalness: 0.6, roughness: 0.2, iridescence: 0.8, clearcoat: 1 }),
  rose: new THREE.MeshPhysicalMaterial({ color: 0xf9a8d4, metalness: 0.6, roughness: 0.25, iridescence: 0.7, clearcoat: 1 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transmission: 1, thickness: 1.2, ior: 1.5, iridescence: 1, transparent: true }),
};

const rig = new THREE.Group();
scene.add(rig);

// Meshing train: centre distance = r1 + r2, speeds inverse to tooth count.
const train = [];
function addGear(teeth, mat, x, y, z, dir, phase = 0, thick = 0.5) {
  const { geo, r } = gearGeometry(teeth, thick);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.z = phase;
  rig.add(m);
  train.push({ mesh: m, teeth, dir, r });
  return r;
}
const rA = addGear(24, mats.chrome, 0, 0, 0, 1, 0, 0.6);
const rB = (MODULE * 14) / 2;
const angB = 0.5;
addGear(14, mats.cyan, Math.cos(angB) * (rA + rB), Math.sin(angB) * (rA + rB), 0, -1, Math.PI / 14);
const rC = (MODULE * 18) / 2, angC = Math.PI + 0.9;
addGear(18, mats.violet, Math.cos(angC) * (rA + rC), Math.sin(angC) * (rA + rC), 0, -1, Math.PI / 18);
const bx = Math.cos(angB) * (rA + rB), by = Math.sin(angB) * (rA + rB);
const rD = (MODULE * 10) / 2, angD = -0.9;
addGear(10, mats.rose, bx + Math.cos(angD) * (rB + rD), by + Math.sin(angD) * (rB + rD), 0, 1, 0.1);

// Glass hub + axle
const hub = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, lite ? 16 : 32, lite ? 48 : 96), mats.glass);
hub.position.z = 0.45; rig.add(hub);
const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, lite ? 24 : 48), mats.chrome);
axle.rotation.x = Math.PI / 2; rig.add(axle);

// Orbiting ring + satellite
const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.03, 8, lite ? 120 : 200), new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.5 }));
ring.rotation.x = 1.25; rig.add(ring);
const sat = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), new THREE.MeshBasicMaterial({ color: 0xec4899 }));
rig.add(sat);

// Particle dust
const P = lite ? 320 : 900, pos = new Float32Array(P * 3), col = new Float32Array(P * 3);
const palette = [new THREE.Color(0x06b6d4), new THREE.Color(0x6366f1), new THREE.Color(0xec4899), new THREE.Color(0xf59e0b)];
for (let i = 0; i < P; i++) {
  const r = 3 + Math.random() * 9, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
  pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t) * 0.6, r * Math.cos(p) * 0.5 - 2], i * 3);
  col.set(palette[i % 4].toArray(), i * 3);
}
const pg = new THREE.BufferGeometry();
pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
const dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: lite ? 0.07 : 0.05, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false }));
scene.add(dust);

/* ---------- Layout ----------
   Gear train bounding box (rig space): x −5.1…6.6, y −5.8…3.8 → centre (0.78, −1.0). */
let baseX = 3.6, baseY = 0, baseScale = 1, isStacked = stacked.matches;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const viewW = VIEW_H * camera.aspect;
  isStacked = stacked.matches;
  if (isStacked) {
    // Own block under the copy: fit the whole train, centred.
    baseScale = 0.86 * Math.min(viewW / 11.5, VIEW_H / 10.4);
    baseX = -0.75 * baseScale;
    baseY = 1.15 * baseScale;
  } else {
    // Keep the train in the right half so it never sits behind the copy.
    baseScale = Math.min(0.9, viewW / 16);   // ~0.88 at 16:10, ~0.72 at 4:3 tablets
    baseX = viewW * 0.31;
    baseY = 0;
  }
  if (!running) renderOnce();
}
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
else addEventListener('resize', resize);

let mx = 0, my = 0, sx = 0, sy = 0;
if (!lite) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

/* ---------- Render loop: runs only while visible, tab active and (on touch) not mid-scroll ---------- */
let intro = reduced ? 1 : 0, t = 0, last = 0, raf = 0, running = false, visible = true, shown = false;
const MIN_FRAME = lite ? 32 : 0;            // lite devices: ~30 fps is plenty for slow-turning gears
const TARGET = lite ? 33.4 : 16.7;          // expected ms between drawn frames
let lastDraw = 0, frames = 0, slowAcc = 0;
let touchScrolling = false, scrollIdle = 0;
if (coarse) addEventListener('scroll', () => {
  // Give the GPU to the compositor while the finger / momentum scroll is moving.
  touchScrolling = true; clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => { touchScrolling = false; last = 0; }, 140);
}, { passive: true });

function update(dt) {
  t += dt;
  intro = Math.min(intro + dt * 0.6, 1);
  const e = 1 - Math.pow(1 - intro, 4);
  const scroll = isStacked ? 0 : Math.min(scrollY / innerHeight, 1.5);
  const speed = reduced ? 0.1 : 0.55 + scroll * 1.8;

  for (const g of train) g.mesh.rotation.z += (dt * speed * g.dir * 24) / g.teeth;

  sx += (mx - sx) * 0.05; sy += (my - sy) * 0.05;
  rig.position.x = baseX + sx * 0.8;
  rig.position.y = baseY;
  rig.rotation.y = -0.45 + sx * 0.6 + (1 - e) * 1.6 + (isStacked ? Math.sin(t * 0.4) * 0.12 : 0);
  rig.rotation.x = 0.2 + sy * 0.4 + Math.sin(t * 0.5) * 0.04;
  rig.scale.setScalar(baseScale * (0.6 + e * 0.4) * (1 - scroll * 0.15));
  rig.position.z = -scroll * 3;

  sat.position.set(Math.cos(t * 0.8) * 4.6, Math.sin(t * 0.8) * 4.6 * Math.cos(1.25), Math.sin(t * 0.8) * 4.6 * Math.sin(1.25));
  hub.rotation.z = t * 0.6;
  dust.rotation.y = t * 0.03 + sx * 0.2;
  dust.rotation.x = sy * 0.1;
  rimC.position.x = -6 + Math.sin(t) * 2;
  rimP.position.y = -4 + Math.cos(t * 0.8) * 2;
}

function renderOnce() {
  renderer.render(scene, camera);
  if (!shown) { shown = true; holder.classList.remove('off'); holder.classList.add('on'); }
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  if (touchScrolling) return;
  if (now - lastDraw < MIN_FRAME) return;
  lastDraw = now;
  const gap = last ? now - last : TARGET;
  const dt = Math.min(gap / 1000, 0.05);
  last = now;
  // Adaptive quality, re-checked continuously: if drawn frames come >40% slower than the target,
  // step the pixel ratio down (to a floor of 0.75).
  frames++; slowAcc += gap;
  if (frames === 90) {
    if (slowAcc / frames > TARGET * 1.4 && maxDpr > 0.75) {
      maxDpr = Math.max(0.75, maxDpr - 0.25); renderer.setPixelRatio(maxDpr); resize();
    }
    frames = 0; slowAcc = 0;
  }
  update(dt);
  renderOnce();
}

function setRunning(on) {
  if (reduced) { if (on) { update(0); renderOnce(); } return; }
  if (on && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
  else if (!on && running) { running = false; cancelAnimationFrame(raf); }
}

// Stop once the block is mostly off screen (not just when the last pixel leaves).
new IntersectionObserver(entries => {
  visible = entries[entries.length - 1].intersectionRatio > 0.15;
  setRunning(visible && !document.hidden);
}, { threshold: [0, 0.15, 0.3] }).observe(canvas);
document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));

resize();
update(0);
if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); } catch { /* fall back to sync compile */ } }
renderOnce();
setRunning(visible && !document.hidden);

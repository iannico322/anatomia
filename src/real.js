import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { describe } from './descriptions.js';

export const LAYER_INFO = {
  skin: { name: 'Skin & surface', color: '#7f9bff' },
  muscle: { name: 'Muscles', color: '#e0524b' },
  organs: { name: 'Organs & brain', color: '#ff9b7a' },
  vessels: { name: 'Blood vessels', color: '#ff4d5e' },
  nerves: { name: 'Nervous system', color: '#ffd96a' },
  skeleton: { name: 'Skeleton', color: '#efe3c8' },
};
const VIEW = { skin: 'skin', muscle: 'muscle', skeleton: 'skeleton', vessels: 'vessels', nerves: 'nerves', brain: 'organs', heart: 'organs', organs: 'organs' };
const FILES = ['skin', 'skeleton', 'muscle', 'organs', 'heart', 'brain', 'vessels', 'nerves'];

/* ---------------- loading ---------------- */
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
async function b64ToBuf(b64) { const r = await fetch('data:application/octet-stream;base64,' + b64); return r.arrayBuffer(); }

/* ---------------- noise ---------------- */
function hash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf); const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v), l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}
const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

/* ---------------- skin shader ---------------- */
function skinMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uOp: { value: 1 }, uTime: { value: 0 }, uC1: { value: new THREE.Color(0x1d2a6b) }, uC2: { value: new THREE.Color(0xa9bcff) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; uniform float uOp; uniform float uTime; uniform vec3 uC1; uniform vec3 uC2;
      void main(){
        float f=1.-abs(dot(normalize(vN),normalize(vV)));
        float rim=pow(f,2.2);
        float band=.5+.5*sin(vW.y*260.-uTime*.6);
        float fine=.5+.5*sin(vW.y*900.+vW.x*40.);
        float diff=max(dot(normalize(vN),normalize(vec3(.35,.55,.75))),0.);
        vec3 col=mix(uC1,uC2,rim)*(.55+.45*rim)+uC2*.06*band*rim+uC2*.03*fine+uC2*diff*.2;
        float a=(.1+rim*.95)+diff*.1;
        gl_FragColor=vec4(col*a*1.5*uOp,a*uOp);
      }`,
  });
}

/* ---------------- classification & materials ---------------- */
function classify(p) {
  const n = p.name.toLowerCase(), L = p.layer;
  if (L === 'skeleton') {
    if (/cartilage|disc/.test(n)) return ['cartilage', 0xb8d4d9];
    if (/incisor|canine|molar|premolar|tooth/.test(n)) return ['tooth', 0xfaf4e6];
    return ['bone', 0xe6dac0];
  }
  if (L === 'muscle') { if (/tendon|aponeurosis|ligament|raphe|linea alba|galea/.test(n)) return ['tendon', 0xe9dcc4]; return ['muscle', 0xa8322c]; }
  if (L === 'vessels') return /vein|venous|sinus|azygos|plexus|vena/.test(n) ? ['vein', 0x3b58c9] : ['artery', 0xcc2f36];
  if (L === 'nerves') return ['nerve', 0xf0d98a];
  if (L === 'heart') return /leaflet|valve|cusp/.test(n) ? ['valve', 0xe8d9c9] : ['heart', 0xa82a35];
  if (L === 'brain') {
    if (/cornea|lens/.test(n)) return ['eyeclear', 0xdfeaf0];
    if (/iris/.test(n)) return ['iris', 0x4f7aa8];
    if (/eyeball/.test(n)) return ['eye', 0xf1efe8];
    if (/cochlea/.test(n)) return ['bone', 0xe6dac0];
    if (/falx|tentorium|dura/.test(n)) return ['dura', 0xd9c9b0];
    if (/cerebell|vermis|lobule|flocculus|culmen|declive|folium|lingula|nodule/.test(n)) return ['cerebellum', 0xcf8f8c];
    if (/pons|medulla|midbrain|peduncle|spinal cord/.test(n)) return ['brainstem', 0xd8c0b0];
    if (/callosum|caudate|lentiform|globus|fornix|hippocamp|amygdal|hypothalam/.test(n)) return ['deepbrain', 0xe8dccf];
    return ['brain', 0xe4a7a6];
  }
  if (/^uterus|fallopian|uterine tube/.test(n)) return ['uterus', 0xc8707c];
  if (/ovary/.test(n)) return ['ovary', 0xe6b79c];
  if (/^vagina/.test(n)) return ['vagina', 0xb6525f];
  if (/liver/.test(n)) return ['liver', 0x93402d];
  if (/gallbladder|bile|cystic|hepatic duct/.test(n)) return ['bile', 0x6f9a3e];
  if (/lung/.test(n)) return ['lung', 0xdca0a0];
  if (/trachea|bronch|larynx/.test(n)) return ['airway', 0xc7dde6];
  if (/stomach|oesophagus|esophagus|duodenum|jejunum|ileum|colon|caecum|appendix|rectum|pharynx|epiglottis/.test(n)) return ['gut', 0xe29c8c];
  if (/kidney|renal/.test(n)) return ['kidney', 0x86302b];
  if (/spleen/.test(n)) return ['spleen', 0x6a2b4b];
  if (/pancreas/.test(n)) return ['pancreas', 0xe0b184];
  if (/bladder/.test(n)) return ['bladder', 0xe7c39e];
  if (/tongue|palate|uvula/.test(n)) return ['tongue', 0xd2706f];
  if (/thyroid|parathyroid|suprarenal|gland|hypophysis|pineal/.test(n)) return ['gland', 0xd8886c];
  return ['organ', 0xdb9c8c];
}
const MAT_PROPS = {
  bone: { rough: .52, cc: .12 }, tooth: { rough: .25, cc: .6 }, cartilage: { rough: .35, cc: .3 },
  muscle: { rough: .48, cc: .28 }, tendon: { rough: .4, cc: .3 }, vein: { rough: .35, cc: .5 }, artery: { rough: .35, cc: .5 }, nerve: { rough: .4, cc: .4 },
  heart: { rough: .4, cc: .5 }, valve: { rough: .35, cc: .3 }, brain: { rough: .5, cc: .35 }, cerebellum: { rough: .5, cc: .35 }, brainstem: { rough: .5, cc: .3 }, deepbrain: { rough: .5, cc: .3 },
  eye: { rough: .25, cc: .8 }, eyeclear: { rough: .1, cc: 1, op: .35 }, iris: { rough: .3, cc: .6 }, dura: { rough: .6, cc: .1, op: .45 },
  uterus: { rough: .42, cc: .45 }, ovary: { rough: .5, cc: .3 }, vagina: { rough: .4, cc: .4 },
  liver: { rough: .32, cc: .7 }, bile: { rough: .35, cc: .6 }, lung: { rough: .45, cc: .35, op: .72 }, airway: { rough: .35, cc: .5 }, gut: { rough: .38, cc: .55 }, kidney: { rough: .32, cc: .7 },
  spleen: { rough: .38, cc: .6 }, pancreas: { rough: .55, cc: .2 }, bladder: { rough: .3, cc: .5, op: .85 }, tongue: { rough: .42, cc: .5 }, gland: { rough: .45, cc: .4 }, organ: { rough: .45, cc: .4 },
};
function makeMat(cls, vcol = true) {
  const pr = MAT_PROPS[cls] || MAT_PROPS.organ;
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: vcol, roughness: pr.rough, metalness: 0, clearcoat: pr.cc, clearcoatRoughness: .35, envMapIntensity: .8 });
  m.userData.k = pr.op ?? 1; if (pr.op) m.transparent = true;
  return m;
}

/* ---------------- vertex colours (jitter, noise, tendon ends) ---------------- */
const _c = new THREE.Color(), _t = new THREE.Color(0xeadfca);
function paintGeometry(geo, scale, cls, baseHex, pid) {
  const pos = geo.attributes.position; const n = pos.count; const col = new Float32Array(n * 3);
  const rj = strHash(pid) - .5, rj2 = strHash(pid + 'x') - .5;
  const base = new THREE.Color(baseHex); base.offsetHSL(rj * .018, rj2 * .06, rj2 * .07);
  // principal axis for muscles/bones (tendon / epiphysis ends)
  let ax = null, tmin = 0, tmax = 1;
  const usePca = cls === 'muscle' || cls === 'bone' || cls === 'nerve';
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { P[i * 3] = pos.getX(i) * scale; P[i * 3 + 1] = pos.getY(i) * scale; P[i * 3 + 2] = pos.getZ(i) * scale; }
  if (usePca) {
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < n; i++) { cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; } cx /= n; cy /= n; cz /= n;
    let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0;
    for (let i = 0; i < n; i++) { const x = P[i * 3] - cx, y = P[i * 3 + 1] - cy, z = P[i * 3 + 2] - cz; a += x * x; b += x * y; c += x * z; d += y * y; e += y * z; f += z * z; }
    let v = [1, .7, .4];
    for (let k = 0; k < 8; k++) { const nx = a * v[0] + b * v[1] + c * v[2], ny = b * v[0] + d * v[1] + e * v[2], nz = c * v[0] + e * v[1] + f * v[2]; const l = Math.hypot(nx, ny, nz) || 1; v = [nx / l, ny / l, nz / l]; }
    ax = v; tmin = 1e9; tmax = -1e9; const T = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = (P[i * 3] - cx) * v[0] + (P[i * 3 + 1] - cy) * v[1] + (P[i * 3 + 2] - cz) * v[2]; T[i] = t; if (t < tmin) tmin = t; if (t > tmax) tmax = t; }
    geo.userData.T = T;
  }
  const T = geo.userData.T; const span = Math.max(1e-6, tmax - tmin);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const n1 = vnoise(x * 22 + 3, y * 22, z * 22), n2 = vnoise(x * 90, y * 90 + 7, z * 90);
    let k = .86 + .22 * n1 + .1 * (n2 - .5);
    _c.copy(base).multiplyScalar(k);
    if (cls === 'muscle' || cls === 'nerve') {
      const u = Math.abs((T[i] - tmin) / span * 2 - 1);
      const w = Math.min(1, Math.max(0, (u - .78) / .22)); const ww = w * w * (3 - 2 * w) * (cls === 'muscle' ? .75 : .2);
      // fibre streaks across the belly
      const streak = Math.sin((x * 620 + z * 410 + n1 * 6)) * .04 * (1 - w);
      _c.multiplyScalar(1 + streak); _c.lerp(_t, ww);
    } else if (cls === 'bone') {
      const u = Math.abs((T[i] - tmin) / span * 2 - 1); const w = Math.min(1, Math.max(0, (u - .82) / .18));
      _c.multiplyScalar(1 - .1 * w * w).lerp(new THREE.Color(0xd9c9a4), w * w * .35);
      _c.multiplyScalar(1 + .05 * Math.sin(x * 800 + y * 700 + z * 600));
    } else if (cls === 'liver' || cls === 'kidney' || cls === 'spleen') {
      _c.multiplyScalar(.95 + .1 * vnoise(x * 40, y * 40, z * 40));
    } else if (cls === 'brain' || cls === 'cerebellum') {
      _c.multiplyScalar(.9 + .18 * vnoise(x * 150, y * 150, z * 150));
    }
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  delete geo.userData.T;
}


/* ---------------- female morph ---------------- */
const KY = [0, .6, .85, .95, 1.05, 1.12, 1.3, 1.42, 1.5, 1.8];
const KX = [.97, .97, 1.08, 1.14, .96, .86, .88, .86, .9, 1];
const KZ = [.97, .97, 1.03, 1.06, .92, .88, .95, .98, 1, 1];
function kv(K, y) { if (y <= KY[0]) return K[0]; for (let i = 1; i < KY.length; i++) if (y <= KY[i]) { const t = (y - KY[i - 1]) / (KY[i] - KY[i - 1]); return K[i - 1] + (K[i] - K[i - 1]) * t * t * (3 - 2 * t); } return K[K.length - 1]; }
const FS = .94;
export function femalePoint(x, y, z, skin, out, gen) {
  if (gen) { const t = Math.min(1, Math.max(0, (y - .78) / .08)); const lim = .052 + .026 * t; if (z > lim) z = lim; }
  let X = x * FS * kv(KX, y), Y = y * FS, Z = z * FS * kv(KZ, y);
  if (skin) {
    if (Z > .02) for (const sx of [-1, 1]) {
      const dx = (X - sx * .088) / .056, dy = (Y - 1.2) / .06, g = Math.exp(-(dx * dx + dy * dy) * .5);
      Z += .068 * g * Math.min(1, (Z - .02) / .03); X += sx * .012 * g; Y -= .006 * g;
    }
    if (Z < -.02) { const dy = (Y - .86) / .085, dx = X / .12, g = Math.exp(-(dx * dx + dy * dy) * .5); Z -= .04 * g; }
  }
  out[0] = X; out[1] = Y; out[2] = Z; return out;
}
function tubeGeo(pts, r0, r1, seg = 40, rad = 10, flat = 1) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false); const P = g.attributes.position, n = P.count;
  const per = rad + 1;
  for (let i = 0; i < n; i++) {
    const s = Math.floor(i / per) / seg; const c = curve.getPointAt(Math.min(1, s)); const r = r0 + (r1 - r0) * s;
    const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)).sub(c); v.z *= flat; v.multiplyScalar(r); P.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  g.computeVertexNormals(); return g;
}
function femaleOrganGeos(bl) {
  // bl: bladder centre in female space
  const out = [];
  const cx = 0, top = bl.y + .028;
  // uterus: lathe pear, anteverted
  const prof = [[0, .0], [.012, .002], [.024, .012], [.03, .03], [.027, .05], [.019, .064], [.012, .074], [.009, .08], [.0, .082]].map(([r, y]) => new THREE.Vector2(r, y - .04));
  const lg = new THREE.LatheGeometry(prof.reverse(), 36); lg.scale(1, 1, .55); lg.rotateX(.42); lg.translate(cx, top + .02, bl.z + .004);
  lg.computeVertexNormals(); out.push({ name: 'Uterus', side: '', geo: lg });
  // cervix + vagina
  const vg = tubeGeo([[0, top - .012, bl.z - .004], [0, top - .032, bl.z - .016], [0, top - .054, bl.z - .018], [0, top - .072, bl.z - .01], [0, top - .084, bl.z + .004]], .013, .011, 36, 12, .5);
  out.push({ name: 'Vagina', side: '', geo: vg });
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'l' : 'r';
    const tg = tubeGeo([[s * .02, top + .045, bl.z], [s * .05, top + .075, bl.z - .008], [s * .082, top + .062, bl.z - .018], [s * .092, top + .03, bl.z - .02], [s * .084, top + .005, bl.z - .018]], .0032, .0055, 30, 8);
    out.push({ name: 'Fallopian tube', side, geo: tg });
    const og = new THREE.SphereGeometry(1, 28, 20); og.scale(.017, .012, .008); og.rotateZ(s * .5); og.translate(s * .078, top - .008, bl.z - .034);
    for (let i = 0, P = og.attributes.position; i < P.count; i++) { const k = 1 + .08 * Math.sin(P.getX(i) * 700 + P.getY(i) * 500) * Math.sin(P.getZ(i) * 600); P.setXYZ(i, P.getX(i) * k, P.getY(i) * k, P.getZ(i) * k); }
    og.computeVertexNormals(); out.push({ name: 'Ovary', side, geo: og });
  }
  return out;
}

/* =============================================================== */
export async function loadRealBody(progress = () => { }) {
  await loadScript('data/manifest.js');
  const A = window.__ANATOMY; if (!A || !A.manifest) throw new Error('manifest missing');
  const M = A.manifest;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const root = new THREE.Group();
  const layerGroups = {}; Object.keys(LAYER_INFO).forEach(k => { layerGroups[k] = new THREE.Group(); layerGroups[k].name = k; root.add(layerGroups[k]); });
  const skinMat = skinMaterial();

  // index manifest by layer, in file order
  const byLayer = {}; M.parts.forEach(p => { (byLayer[p.layer] = byLayer[p.layer] || []).push(p); });
  const matSets = {}; // `${view}:${cls}` -> {base,hover,select,ghost}
  const layerMats = {}; Object.keys(LAYER_INFO).forEach(k => layerMats[k] = new Set());
  const parts = new Map(); // id -> part
  const entities = new Map();

  let done = 0;
  for (const f of FILES) {
    await loadScript(`data/${f}.js`);
    const buf = await b64ToBuf(A.models[f]); delete A.models[f];
    const gltf = await loader.parseAsync(buf, '');
    const view = f === 'skin' ? 'skin' : VIEW[f];
    gltf.scene.updateMatrixWorld(true);
    const nodes = gltf.scene.children.slice();
    for (const node of nodes) {
      const pid = node.name; // 'p123'
      const mp = M.byId[pid]; if (!mp) continue;
      let src = null; node.traverse(o => { if (o.isMesh && !src) src = o; }); if (!src) continue;
      // bake dequantised world-space Float32 geometry
      const g0 = src.geometry, P0 = g0.attributes.position, N0 = g0.attributes.normal, n = P0.count, e = src.matrixWorld.elements;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        v.set(P0.getX(i), P0.getY(i), P0.getZ(i)).applyMatrix4(src.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        if (N0) { v.set(N0.getX(i), N0.getY(i), N0.getZ(i)).normalize(); nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z; }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(g0.index.array), 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
      g0.dispose();
      const pv = (f === 'heart' && /communicating|venous plexus|cavernous sinus/i.test(mp.name)) ? 'vessels' : view;
      const [cls, hex] = classify({ name: mp.name, layer: pv === 'vessels' ? 'vessels' : mp.layer });
      const mesh = new THREE.Mesh(geo);
      if (f === 'skin') { mesh.material = skinMat; mesh.renderOrder = 5; }
      else {
        paintGeometry(geo, 1, cls, hex, pid);
        const key = `${pv}:${cls}`;
        if (!matSets[key]) {
          const base = makeMat(cls), hover = makeMat(cls), select = makeMat(cls), ghost = makeMat(cls);
          hover.emissive = new THREE.Color(0x233f9c); hover.emissiveIntensity = .55;
          select.emissive = new THREE.Color(0x5a30d0); select.emissiveIntensity = .5;
          ghost.transparent = true; ghost.userData.k = .07; ghost.depthWrite = false;
          matSets[key] = { base, hover, select, ghost }; Object.values(matSets[key]).forEach(m => layerMats[pv].add(m));
        }
        mesh.material = matSets[key].base; mesh.userData.mats = matSets[key];
      }
      mesh.userData.orig = pos.slice(); mesh.userData.skin = f === 'skin'; mesh.userData.gen = /urogenital region/i.test(mp.name); if (/^pubic hairs|^urogenital region/i.test(mp.name)) mesh.userData.sex = 'm';
      layerGroups[pv].add(mesh);
      const side = mp.side === 'l' ? 'left' : mp.side === 'r' ? 'right' : '';
      const nm = mp.name.replace(/[()*]/g, '').trim();
      const part = { id: pid, name: nm, side, layer: pv, file: f, mesh, cls };
      parts.set(pid, part); mesh.userData.part = pid;
    }
    done++; progress(done / FILES.length, f);
  }
  // Recentre using manifest shift (already applied in files). Add everything to the scene by caller.

  /* ---------- entities (selectable things) ---------- */
  const gidOf = p => {
    const n = p.name.toLowerCase();
    if (p.file === 'heart') return p.layer === 'vessels' ? null : 'Heart';
    if (p.file === 'skin') return 'Skin';
    if (/segment of liver|^liver$/.test(n)) return 'Liver';
    if (p.file === 'brain') { if (/spinal/.test(n)) return null; if (/cornea|lens|iris|eyeball|chamber|choroid/.test(n)) return 'Eyes'; if (/cochlea|falx|tentorium|dura/.test(n)) return null; return 'Brain'; }
    if (/lobe of (left|right) lung/.test(n)) return 'Lungs';
    if (/bronch/.test(n) && p.file === 'organs') return 'Bronchial tree';
    return null;
  };
  const ent = (key, name, layer, ps, nameForDesc) => {
    const d = describe(nameForDesc || name, ps[0].file === 'heart' ? 'heart' : ps[0].file);
    const e = { id: key, system: LAYER_INFO[layer].name.toLowerCase(), key, name, layer, parts: ps, meshes: ps.map(x => x.mesh), desc: d.desc, cell: d.cell, side: '' };
    entities.set(key, e); return e;
  };
  const groups = new Map();
  parts.forEach(p => { const g = gidOf(p); p.gid = g; if (g) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); } });
  groups.forEach((ps, g) => { const e = ent('g:' + g, g, ps[0].layer, ps, g); ps.forEach(p => { p.groupKey = 'g:' + g; }); e.isGroup = true; e.children = ps.map(p => p.id); });
  parts.forEach(p => { if (p.file === 'skin') return; const title = p.name + (p.side ? ` (${p.side})` : ''); const e = ent(p.id, title, p.layer, [p], p.name); e.side = p.side; e.parent = p.groupKey || null; p.mesh.userData.ent = p.groupKey || p.id; });
  // skin: one entity
  parts.forEach(p => { if (p.file === 'skin') p.mesh.userData.ent = 'g:Skin'; });

  /* ---------- female-only organs (procedural) ---------- */
  const blc = femalePoint(0, .8644, -.012, false, [0, 0, 0]);
  const femaleMeshes = [];
  femaleOrganGeos({ y: blc[1], z: blc[2] }).forEach((o, i) => {
    const pid = 'f' + i; const nm = o.name; const [cls, hex] = classify({ name: nm, layer: 'organs' });
    paintGeometry(o.geo, 1, cls, hex, pid);
    const key = `organs:${cls}`;
    if (!matSets[key]) {
      const base = makeMat(cls), hover = makeMat(cls), select = makeMat(cls), ghost = makeMat(cls);
      hover.emissive = new THREE.Color(0x233f9c); hover.emissiveIntensity = .55; select.emissive = new THREE.Color(0x5a30d0); select.emissiveIntensity = .5;
      ghost.transparent = true; ghost.userData.k = .07; ghost.depthWrite = false;
      matSets[key] = { base, hover, select, ghost }; Object.values(matSets[key]).forEach(m => layerMats.organs.add(m));
    }
    const mesh = new THREE.Mesh(o.geo, matSets[key].base); mesh.userData.mats = matSets[key]; mesh.visible = false; layerGroups.organs.add(mesh);
    const side = o.side === 'l' ? 'left' : o.side === 'r' ? 'right' : '';
    const part = { id: pid, name: nm, side, layer: 'organs', file: 'organs', mesh, cls }; parts.set(pid, part);
    const e = ent(pid, nm + (side ? ` (${side})` : ''), 'organs', [part], nm); e.side = side; e.sex = 'f'; e.hidden = true; mesh.userData.ent = pid; mesh.userData.sex = 'f';
    femaleMeshes.push(mesh);
  });
  const maleOnly = [...parts.values()].filter(p => /^urethra$/i.test(p.name)).map(p => p.mesh); maleOnly.forEach(m => { m.userData.sex = 'm'; });
  maleOnly.forEach(m => { const e = entities.get(m.userData.ent); if (e) e.sex = 'm'; });

  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const boxOf = e => { box.makeEmpty(); e.meshes.forEach(m => box.expandByObject(m)); return box.clone(); };

  /* ---------- animation pivots ---------- */
  const pivots = [];
  const mkPivot = (key, cb) => { const e = entities.get(key); if (!e) return; const b = boxOf(e); const c = b.getCenter(new THREE.Vector3()); const g = new THREE.Group(); g.position.copy(c); layerGroups.organs.add(g); g.updateMatrixWorld(true); e.meshes.forEach(m => g.attach(m)); pivots.push({ g, cb, meshes: e.meshes }); };
  mkPivot('g:Heart', (g, t) => { const ph = (t * 1.25) % 1; const k = ph < .12 ? Math.sin(ph / .12 * Math.PI) : ph > .25 && ph < .4 ? .4 * Math.sin((ph - .25) / .15 * Math.PI) : 0; g.scale.setScalar(1 + .045 * k); });
  mkPivot('g:Lungs', (g, t) => { const b = 1 + .022 * Math.sin(t * 1.1); g.scale.set(b, 1 + .018 * Math.sin(t * 1.1), b); });

  /* ---------- API ---------- */
  const setLayerOpacity = (layer, op) => {
    layerMats[layer] && layerMats[layer].forEach(m => { const o = op * (m.userData.k ?? 1); m.opacity = o; const tr = o < .995 || m.userData.k < 1; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.depthWrite = o > .6 && m.userData.k >= 1; });
    if (layer === 'skin') skinMat.uniforms.uOp.value = op;
    const vis = op > .02; layerGroups[layer].visible = vis;
  };
  const opOf = {}; // filled by setLayerOpacity callers through main (we track visibility via group)
  const pickables = (ok) => { const out = []; for (const k of Object.keys(layerGroups)) { if (k === 'skin' || !ok(k)) continue; layerGroups[k].traverse(o => { if (o.isMesh && o.visible) out.push(o); }); } return out; };
  const setStates = (sel, hov, isolate, sub) => {
    const se = sel && entities.get(sel), he = hov && entities.get(hov), ss = sub && entities.get(sub);
    const selSet = se ? new Set(se.meshes) : null, hovSet = he ? new Set(he.meshes) : null, subSet = ss ? new Set(ss.meshes) : null;
    parts.forEach(p => {
      const m = p.mesh, ms = m.userData.mats; if (!ms) return;
      let s = 'base';
      if (subSet) { if (subSet.has(m)) s = 'select'; else if (selSet && selSet.has(m)) s = hovSet && hovSet.has(m) ? 'hover' : (isolate ? 'ghost' : 'base'); else if (isolate) s = 'ghost'; else if (hovSet && hovSet.has(m)) s = 'hover'; }
      else if (selSet && selSet.has(m)) s = 'select'; else if (isolate && selSet) s = 'ghost'; else if (hovSet && hovSet.has(m)) s = 'hover';
      const want = ms[s]; if (m.material !== want) m.material = want;
    });
  };
  /* ---------- exploded view ---------- */
  let exKey = null, exT = 0, exCur = 0; const exInfo = new Map();
  const clearEx = () => { exInfo.forEach((v, m) => m.position.copy(v.base)); exInfo.clear(); exKey = null; exCur = 0; exT = 0; };
  function setExplode(key, amt) {
    if (key !== exKey) { clearEx(); if (!key) return; const e = entities.get(key); if (!e || !e.children || e.children.length < 2) return; exKey = key;
      const b = boxOf(e), gc = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()).length();
      e.meshes.forEach(m => { const c = m.geometry.boundingBox.getCenter(new THREE.Vector3()); const d = c.clone().sub(gc); const len = d.length() || 1e-6; exInfo.set(m, { base: m.position.clone(), off: d.clone().multiplyScalar(.9).addScaledVector(d.clone().divideScalar(len), sz * .08) }); }); }
    exT = amt;
  }
  const stepEx = () => { if (!exKey) return; exCur += (exT - exCur) * .15; if (Math.abs(exT - exCur) < .002) exCur = exT; exInfo.forEach((v, m) => m.position.copy(v.base).addScaledVector(v.off, exCur)); if (exT === 0 && exCur === 0) clearEx(); };
  const update = t => { pivots.forEach(p => p.cb(p.g, t)); skinMat.uniforms.uTime.value = t; stepEx(); };

  /* ---------- labels ---------- */
  const find = (re, pred) => { for (const e of entities.values()) if (!e.isGroup && re.test(e.name) && (!pred || pred(e))) return e; return null; };
  const LAB = [
    ['Brain', 'g:Brain', 'organs'], ['Heart', 'g:Heart', 'organs'], ['Lungs', /^superior lobe of right lung/i, 'organs'], ['Liver', 'g:Liver', 'organs'],
    ['Stomach', /^stomach/i, 'organs'], ['Kidney', /^kidney \(left\)/i, 'organs'], ['Small intestine', /^jejunum/i, 'organs'], ['Colon', /^ascending colon/i, 'organs'],
    ['Aorta', /^thoracic aorta/i, 'vessels'], ['Sciatic nerve', /^sciatic nerve \(left\)/i, 'nerves'],
    ['Skull', /^frontal bone/i, 'skeleton'], ['Rib cage', /^fifth rib \(right\)/i, 'skeleton'], ['Sternum', /^body of sternum/i, 'skeleton'], ['Pelvis', /^hip bone \(right\)/i, 'skeleton'],
    ['Femur', /^femur \(right\)/i, 'skeleton'], ['Humerus', /^humerus \(left\)/i, 'skeleton'], ['Vertebral column', /^vertebra L3/i, 'skeleton'],
    ['Pectoralis major', /^sternocostal head of pectoralis major.*\(right\)/i, 'muscle'], ['Biceps brachii', /^long head of biceps brachii.*\(left\)/i, 'muscle'], ['Rectus abdominis', /^rectus abdominis.*\(right\)/i, 'muscle'],
    ['Quadriceps', /^rectus femoris.*\(right\)/i, 'muscle'], ['Calf', /^medial head of gastrocnemius.*\(left\)/i, 'muscle'], ['Deltoid', /^acromial part of deltoid.*\(right\)/i, 'muscle'],
    ['Skin', 'g:Skin', 'skin'],
  ];
  const labels = [];
  for (const [text, q, layer] of LAB) {
    const e = typeof q === 'string' ? entities.get(q) : find(q);
    if (!e) continue;
    const b = boxOf(e); const c = b.getCenter(new THREE.Vector3()); c.z = Math.max(c.z, b.max.z - (b.max.z - b.min.z) * .15);
    labels.push({ id: e.key, text, pos: c, layer: e.layer });
  }
  const quick = [['Brain', 'g:Brain'], ['Heart', 'g:Heart'], ['Lungs', 'g:Lungs'], ['Liver', 'g:Liver'], ['Stomach', null, /^stomach/i], ['Femur', null, /^femur \(right\)/i], ['Biceps brachii', null, /^long head of biceps brachii.*\(left\)/i], ['Sciatic nerve', null, /^sciatic nerve \(left\)/i], ['Skull', null, /^frontal bone/i], ['Precentral gyrus', null, /^precentral gyrus \(left\)/i]]
    .map(([label, key, re]) => { const e = key ? entities.get(key) : find(re); return e ? { label, key: e.key } : null; }).filter(Boolean);


  /* ---------- sex switch ---------- */
  let sex = 'm';
  const tmp = [0, 0, 0];
  function setSex(s) {
    sex = s; clearEx();
    parts.forEach(p => {
      const m = p.mesh, o = m.userData.orig; if (!o) return;
      const P = m.geometry.attributes.position.array, sk = m.userData.skin;
      if (s === 'f') for (let i = 0; i < P.length; i += 3) { femalePoint(o[i], o[i + 1], o[i + 2], sk, tmp, m.userData.gen); P[i] = tmp[0]; P[i + 1] = tmp[1]; P[i + 2] = tmp[2]; }
      else P.set(o);
      m.geometry.attributes.position.needsUpdate = true;
      if (sk) m.geometry.computeVertexNormals();
      m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox();
    });
    pivots.forEach(pv => { const b = new THREE.Box3(); pv.meshes.forEach(m => b.union(m.geometry.boundingBox)); const c = b.getCenter(new THREE.Vector3()); pv.g.position.copy(c); pv.meshes.forEach(m => m.position.copy(c).negate()); });
    entities.forEach(e => { e.hidden = !!e.sex && e.sex !== s; });
    parts.forEach(p => { const sx = p.mesh.userData.sex; p.mesh.visible = !sx || sx === s; });
    root.updateMatrixWorld(true);
    labels.forEach(l => { const e = entities.get(l.id); if (!e) return; const b = boxOf(e); const c = b.getCenter(new THREE.Vector3()); c.z = Math.max(c.z, b.max.z - (b.max.z - b.min.z) * .15); l.pos.copy(c); l.hidden = !!e.hidden; });
  }
  labels.push(...[['Uterus', /^uterus/i], ['Ovary', /^ovary \(left\)/i]].map(([text, re]) => { const e = find(re); return e ? { id: e.key, text, pos: new THREE.Vector3(), layer: 'organs', sex: 'f', hidden: true } : null; }).filter(Boolean));
  setSex('m');

  /* ---------- quiz items ---------- */
  const QZ = [
    ['Brain', 'g:Brain', 'organs'], ['Heart', 'g:Heart', 'organs'], ['Lungs', /^superior lobe of right lung/i, 'organs'], ['Liver', 'g:Liver', 'organs'],
    ['Stomach', /^stomach$/i, 'organs'], ['Kidney', /^kidney/i, 'organs'], ['Spleen', /^spleen/i, 'organs'], ['Pancreas', /^pancreas/i, 'organs'], ['Gallbladder', /^gallbladder/i, 'organs'],
    ['Urinary bladder', /^urinary bladder/i, 'organs'], ['Duodenum', /^duodenum/i, 'organs'], ['Oesophagus', /^oesophagus/i, 'organs'], ['Trachea', /^trachea$/i, 'organs'], ['Thyroid gland', /^thyroid gland/i, 'organs'],
    ['Left ventricle', /^left ventricle/i, 'organs'], ['Right ventricle', /^right ventricle/i, 'organs'], ['Left atrium', /^left atrium/i, 'organs'], ['Right atrium', /^right atrium/i, 'organs'],
    ['Mandible', /^mandible/i, 'skeleton'], ['Sternum', /^body of sternum/i, 'skeleton'], ['Clavicle', /^clavicle/i, 'skeleton'], ['Scapula', /^scapula/i, 'skeleton'], ['Humerus', /^humerus/i, 'skeleton'], ['Radius', /^radius/i, 'skeleton'], ['Ulna', /^ulna/i, 'skeleton'],
    ['Femur', /^femur/i, 'skeleton'], ['Patella', /^patella \(/i, 'skeleton'], ['Tibia', /^tibia/i, 'skeleton'], ['Fibula', /^fibula/i, 'skeleton'], ['Sacrum', /^sacrum/i, 'skeleton'], ['Hip bone', /^hip bone/i, 'skeleton'], ['Calcaneus', /^calcaneus/i, 'skeleton'], ['Frontal bone', /^frontal bone$/i, 'skeleton'],
    ['Deltoid', /deltoid/i, 'muscle'], ['Biceps brachii', /biceps brachii/i, 'muscle'], ['Triceps brachii', /triceps brachii/i, 'muscle'], ['Pectoralis major', /pectoralis major/i, 'muscle'], ['Rectus abdominis', /^rectus abdominis/i, 'muscle'], ['Latissimus dorsi', /^latissimus dorsi/i, 'muscle'],
    ['Gluteus maximus', /^gluteus maximus/i, 'muscle'], ['Sartorius', /^sartorius/i, 'muscle'], ['Rectus femoris', /^rectus femoris/i, 'muscle'], ['Tibialis anterior', /^tibialis anterior/i, 'muscle'], ['Soleus', /^soleus/i, 'muscle'], ['Diaphragm', /^diaphragm/i, 'muscle'], ['Sternocleidomastoid', /^sternocleidomastoid/i, 'muscle'], ['Temporalis', /^temporalis/i, 'muscle'],
    ['Thoracic aorta', /^thoracic aorta/i, 'vessels'], ['Inferior vena cava', /^inferior vena cava/i, 'vessels'], ['Superior vena cava', /^superior vena cava/i, 'vessels'], ['Femoral artery', /^femoral artery/i, 'vessels'],
    ['Sciatic nerve', /^sciatic nerve/i, 'nerves'], ['Vagus nerve', /^vagus nerve/i, 'nerves'], ['Median nerve', /^median nerve/i, 'nerves'], ['Optic nerve', /^optic nerve/i, 'nerves'],
  ];
  const quizItems = QZ.map(([name, q, layer]) => { const e = typeof q === 'string' ? entities.get(q) : find(q); if (!e) return null; return typeof q === 'string' ? { name, key: q, layer } : { name, re: q, layer }; }).filter(Boolean);
  const total = M.parts.length;
  return { root, layers: layerGroups, parts: entities, labels, quick, update, skinMat, setLayerOpacity, pickables, setStates, boxOf, total, setExplode, setSex, find, quizItems, get sex() { return sex; } };
}

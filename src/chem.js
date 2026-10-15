import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ELEMENTS from './chem_elements.json';
import MOLS from './chem_molecules.json';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EL = ELEMENTS; const BYSYM = {}; EL.forEach(e => { BYSYM[e.sym] = e; e.series = e.series === 'Poor metals' ? 'Post-transition metals' : e.series; });
const fixConf = s => s ? s.replace(/(\d[spdf])(?=\s|$)/g, m => m + '1') : 'unknown';
const sup = n => String(n).replace(/[0-9+\-−]/g, c => ({ '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻' }[c]));
const subN = n => String(n).replace(/[0-9]/g, c => '₀₁₂₃₄₅₆₇₈₉'[c]);

const CAT = { 'Alkali metals': '#ff7b7b', 'Alkaline earth metals': '#ffb06b', 'Transition metals': '#ffd86b', 'Post-transition metals': '#7fd6a0', 'Metalloids': '#52d6cf', 'Nonmetals': '#6fb0ff', 'Halogens': '#9d8cff', 'Noble gases': '#e07cff', 'Lanthanides': '#ff8fc7', 'Actinides': '#ff6f9a' };
const STATEC = { solid: '#8aa4ff', liquid: '#4fe0c0', gas: '#ff9f6b', unknown: '#4a4f72' };
const BLOCKC = { s: '#ff7b7b', p: '#6fb0ff', d: '#ffd86b', f: '#ff8fc7' };
const K2C = k => Math.round(k - 273.15);

function stateAt(e, T) {
  const mp = e.mp, bp = e.bp;
  if (mp == null && bp == null) return 'unknown';
  if (bp != null && T >= bp) return 'gas';
  if (mp != null && T >= mp) return 'liquid';
  if (mp == null && bp != null && bp < 60) return 'liquid';
  return 'solid';
}
function tableCell(e) {
  if (e.z >= 57 && e.z <= 71) return [e.z - 57 + 3, 9];
  if (e.z >= 89 && e.z <= 103) return [e.z - 89 + 3, 10];
  return [e.group, e.period];
}

/* ---------- electron shells ---------- */
const CORES = { He: '1s2', Ne: '[He] 2s2 2p6', Ar: '[Ne] 3s2 3p6', Kr: '[Ar] 3d10 4s2 4p6', Xe: '[Kr] 4d10 5s2 5p6', Rn: '[Xe] 4f14 5d10 6s2 6p6' };
function shellsFromConf(conf) {
  let s = conf || ''; let g = 0; while (/\[(\w+)\]/.test(s) && g++ < 6) s = s.replace(/\[(\w+)\]/, (m, k) => CORES[k] || '');
  const sh = []; s.split(/\s+/).forEach(t => { const m = /^(\d)([spdf])(\d*)$/.exec(t); if (!m) return; const n = +m[1], c = m[3] === '' ? 1 : +m[3]; sh[n - 1] = (sh[n - 1] || 0) + c; });
  return Array.from(sh, x => x || 0);
}
const AUF = [[1, 's', 2], [2, 's', 2], [2, 'p', 6], [3, 's', 2], [3, 'p', 6], [4, 's', 2], [3, 'd', 10], [4, 'p', 6], [5, 's', 2], [4, 'd', 10], [5, 'p', 6], [6, 's', 2], [4, 'f', 14], [5, 'd', 10], [6, 'p', 6], [7, 's', 2], [5, 'f', 14], [6, 'd', 10], [7, 'p', 6]];
function shellsAufbau(e) { const sh = []; let left = e; for (const [n, , c] of AUF) { if (left <= 0) break; const k = Math.min(c, left); sh[n - 1] = (sh[n - 1] || 0) + k; left -= k; } return Array.from(sh, x => x || 0); }
const VALENCE_E = { H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8, Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8, K: 1, Ca: 2, Br: 7, I: 7, Se: 6 };
const NORMAL_VAL = { H: 1, He: 0, Li: 1, Be: 2, B: 3, C: 4, N: 3, O: 2, F: 1, Ne: 0, Na: 1, Mg: 2, Al: 3, Si: 4, P: 3, S: 2, Cl: 1, Ar: 0, K: 1, Ca: 2, Br: 1, I: 1, Se: 2 };
const MAX_VAL = { H: 1, He: 0, Li: 1, Be: 2, B: 3, C: 4, N: 4, O: 3, F: 1, Ne: 0, Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 0, K: 1, Ca: 2, Br: 5, I: 7, Se: 6 };
const maxVal = s => MAX_VAL[s] ?? 6;

const elColor = (sym) => { const c = BYSYM[sym] && BYSYM[sym].color; return c || '#ff69b4'; };
const rcov = sym => ((BYSYM[sym] && BYSYM[sym].rcov) || 120) / 100;
const rvdw = sym => ((BYSYM[sym] && BYSYM[sym].rvdw) || 200) / 100;
const MASS = sym => (BYSYM[sym] && BYSYM[sym].mass) || 0;

function hill(counts) {
  const keys = Object.keys(counts).filter(k => counts[k] > 0);
  const has = k => keys.includes(k);
  let order;
  if (has('C')) order = ['C', ...(has('H') ? ['H'] : []), ...keys.filter(k => k !== 'C' && k !== 'H').sort()]; else order = keys.sort();
  return order.map(k => k + (counts[k] > 1 ? subN(counts[k]) : '')).join('');
}
const countsOf = atoms => { const c = {}; atoms.forEach(a => { c[a.sym || a.el || a[0]] = (c[a.sym || a.el || a[0]] || 0) + 1; }); return c; };
const massOf = counts => Object.keys(counts).reduce((s, k) => s + MASS(k) * counts[k], 0);

/* ---------- graph signature (identify built molecules) ---------- */
function signature(syms, bonds) {
  const n = syms.length; const adj = Array.from({ length: n }, () => []);
  bonds.forEach(([a, b, o]) => { adj[a].push([b, o]); adj[b].push([a, o]); });
  let lab = syms.slice();
  for (let it = 0; it < 4; it++) lab = lab.map((l, i) => l + '(' + adj[i].map(([j, o]) => o + lab[j]).sort().join(',') + ')').map(s => { let h = 5381; for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) | 0; return String(h); });
  return lab.sort().join('|');
}
const LIB = MOLS.map(m => ({ ...m, counts: countsOf(m.atoms.map(a => ({ sym: a[0] }))), sig: signature(m.atoms.map(a => a[0]), m.bonds) }));

/* ---------- crystals ---------- */
function crystalNaCl() { const atoms = [], s = 1.7; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const na = (i + j + k) % 2 === 0; atoms.push([na ? 'Na' : 'Cl', i * s, j * s, k * s, na ? .5 : .82]); } return { atoms, bonds: [] }; }
function crystalDiamond() {
  const a = 3.57 * .62, P = [], basis = [[0, 0, 0], [.5, .5, 0], [.5, 0, .5], [0, .5, .5]];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) basis.forEach(b => { P.push([(i + b[0]) * a, (j + b[1]) * a, (k + b[2]) * a]); P.push([(i + b[0] + .25) * a, (j + b[1] + .25) * a, (k + b[2] + .25) * a]); });
  const uniq = []; P.forEach(p => { if (p.every(v => v <= 2 * a + 1e-6) && !uniq.some(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < .01)) uniq.push(p); });
  const c = [a, a, a]; const atoms = uniq.map(p => ['C', p[0] - c[0], p[1] - c[1], p[2] - c[2]]); const bonds = [];
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) { const d = Math.hypot(atoms[i][1] - atoms[j][1], atoms[i][2] - atoms[j][2], atoms[i][3] - atoms[j][3]); if (d < 1.54 * .62 * 1.15) bonds.push([i, j, 1]); }
  return { atoms, bonds };
}
const CRYSTALS = [
  { id: 'nacl', name: 'Sodium chloride (table salt crystal)', shape: 'Cubic lattice (rock salt)', polarity: 'Ionic', desc: 'Not a molecule: each Na⁺ ion is surrounded by six Cl⁻ ions and vice versa, held by electrostatic attraction. Dissolving in water breaks the lattice into free ions.', uses: 'Seasoning, food preservation, de-icing, chemical industry', state: 'solid', gen: crystalNaCl, crystal: true },
  { id: 'diamond', name: 'Diamond (carbon crystal)', shape: 'Tetrahedral network (diamond cubic)', polarity: 'Nonpolar', desc: 'Every carbon forms four strong covalent bonds to four neighbours, making a rigid 3D network. That is why diamond is the hardest natural material.', uses: 'Gemstones, cutting and drilling tools', state: 'solid', gen: crystalDiamond, crystal: true },
];

/* ---------- label sprites ---------- */
const spriteTex = {};
function labelSprite(text, color = '#ffffff') {
  const key = text + color; if (!spriteTex[key]) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.font = '700 70px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 64, 68); g.fillStyle = color; g.fillText(text, 64, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; spriteTex[key] = t;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex[key], depthTest: false, transparent: true })); s.renderOrder = 20; return s;
}

/* ================= molecule view ================= */
const SPH = new THREE.SphereGeometry(1, 32, 20), CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
const bondMat = new THREE.MeshPhysicalMaterial({ color: 0xd5d9ee, roughness: .35, metalness: 0, clearcoat: .5 });
class MolView {
  constructor() { this.group = new THREE.Group(); this.atoms = []; this.bonds = []; this.style = 'ball'; this.labels = true; this.mats = {}; }
  mat(sym) { if (!this.mats[sym]) this.mats[sym] = new THREE.MeshPhysicalMaterial({ color: elColor(sym), roughness: .3, metalness: 0, clearcoat: .8, clearcoatRoughness: .2 }); return this.mats[sym]; }
  radius(a) { if (a.r) return a.r; return this.style === 'space' ? rvdw(a.sym) * .62 : this.style === 'wire' ? .1 : .12 + rcov(a.sym) * .28; }
  addAtom(sym, pos, rOverride) {
    const a = { sym, pos: pos.clone(), r: rOverride || 0, id: this.atoms.length ? this.atoms[this.atoms.length - 1].id + 1 : 0 };
    a.mesh = new THREE.Mesh(SPH, this.mat(sym)); a.mesh.userData.atom = a; this.group.add(a.mesh);
    const dark = ['H', 'F', 'Cl', 'He', 'Ne'].includes(sym) || /^#(f|e|d|c)/i.test(elColor(sym)); a.label = labelSprite(sym, dark ? '#10131f' : '#ffffff'); a.label.material.depthTest = false; this.group.add(a.label);
    this.atoms.push(a); return a;
  }
  addBond(a, b, o = 1) { const bd = { a, b, o, meshes: [] }; this.bonds.push(bd); this.rebuildBond(bd); return bd; }
  rebuildBond(bd) { bd.meshes.forEach(m => this.group.remove(m)); bd.meshes = []; for (let i = 0; i < bd.o; i++) { const m = new THREE.Mesh(CYL, bondMat); this.group.add(m); bd.meshes.push(m); } }
  removeAtom(a) { this.bonds.filter(b => b.a === a || b.b === a).forEach(b => this.removeBond(b)); this.group.remove(a.mesh, a.label); a.label.material.dispose(); this.atoms.splice(this.atoms.indexOf(a), 1); }
  removeBond(b) { b.meshes.forEach(m => this.group.remove(m)); this.bonds.splice(this.bonds.indexOf(b), 1); }
  bondOf(a, b) { return this.bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); }
  degree(a) { return this.bonds.reduce((s, b) => s + ((b.a === a || b.b === a) ? b.o : 0), 0); }
  neighbors(a) { return this.bonds.filter(b => b.a === a || b.b === a).map(b => (b.a === a ? b.b : b.a)); }
  center() { const c = new THREE.Vector3(); this.atoms.forEach(a => c.add(a.pos)); return this.atoms.length ? c.divideScalar(this.atoms.length) : c; }
  extent() { let r = 1; const c = this.center(); this.atoms.forEach(a => { r = Math.max(r, a.pos.distanceTo(c) + this.radius(a)); }); return r; }
  update(camera) {
    const space = this.style === 'space', wire = this.style === 'wire';
    this.atoms.forEach(a => {
      const r = this.radius(a); a.mesh.position.copy(a.pos); a.mesh.scale.setScalar(r);
      a.label.visible = this.labels; a.label.position.copy(a.pos); if (camera) a.label.position.addScaledVector(camera.position.clone().sub(a.pos).normalize(), r * .9); a.label.scale.setScalar(Math.max(.34, r * .95));
    });
    const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), perp = new THREE.Vector3(), q = new THREE.Quaternion();
    this.bonds.forEach(bd => {
      d.copy(bd.b.pos).sub(bd.a.pos); const L = d.length() || 1e-6; d.divideScalar(L);
      perp.set(0, 0, 1); if (Math.abs(d.z) > .9) perp.set(0, 1, 0); perp.cross(d).normalize();
      q.setFromUnitVectors(up, d); const n = bd.meshes.length, off = n === 1 ? [0] : n === 2 ? [-.08, .08] : [-.13, 0, .13];
      bd.meshes.forEach((m, i) => { m.visible = !space; m.quaternion.copy(q); m.scale.set(wire ? .025 : n === 1 ? .075 : .045, L, wire ? .025 : n === 1 ? .075 : .045); m.position.copy(bd.a.pos).addScaledVector(bd.b.pos.clone().sub(bd.a.pos), .5).addScaledVector(perp, off[i]); });
    });
  }
  dispose() { this.atoms.forEach(a => a.label.material.dispose()); Object.values(this.mats).forEach(m => m.dispose()); }
  clear() { [...this.atoms].forEach(a => this.removeAtom(a)); }
  load(atoms, bonds, scale = .62) { this.clear(); const mk = atoms.map(a => this.addAtom(a[0], new THREE.Vector3(a[1] * scale, a[2] * scale, a[3] * scale), a[4])); bonds.forEach(([i, j, o]) => this.addBond(mk[i], mk[j], o)); }
}

/* ================= atom (Bohr) view ================= */
class AtomView {
  constructor() { this.group = new THREE.Group(); this.t = 0; this.items = []; }
  clear() { this.items.forEach(o => { this.group.remove(o); if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); this.items = []; this.rings = []; this.electrons = null; }
  add(o) { this.group.add(o); this.items.push(o); return o; }
  set(Z, N, shells, valenceHighlight = true) {
    this.clear(); const A = Z + N; const rng = (() => { let s = 12345 + Z * 31 + N; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const nucR = A > 0 ? Math.max(.22, Math.cbrt(A) * .15) : .01; this.nucR = nucR;
    if (A > 0) {
      const rN = Math.min(.24, nucR / Math.cbrt(A) * .62 * 1.15);
      const mesh = new THREE.InstancedMesh(SPH, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .35, clearcoat: .6 }), A); mesh.geometry.userData.shared = true;
      const kinds = Array(Z).fill(0).concat(Array(N).fill(1)); for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
      const m = new THREE.Matrix4(), c = new THREE.Color(), ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < A; i++) { const r = A === 1 ? 0 : nucR * Math.cbrt((i + .5) / A) * .86; const y = A === 1 ? 0 : 1 - 2 * (i + .5) / A, rr = Math.sqrt(Math.max(0, 1 - y * y)), th = ga * i; m.compose(new THREE.Vector3(Math.cos(th) * rr * r, y * r, Math.sin(th) * rr * r), new THREE.Quaternion(), new THREE.Vector3(rN, rN, rN)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(kinds[i] === 0 ? '#ff5a5f' : '#b4bccf')); }
      this.add(mesh); this.nucleus = mesh;
    }
    const K = shells.length; this.rings = []; this.electrons = null; const total = shells.reduce((a, b) => a + b, 0);
    this.R = nucR + .9 + .62 * Math.max(0, K - 1) + .3;
    if (total > 0) {
      const em = new THREE.InstancedMesh(SPH, new THREE.MeshPhysicalMaterial({ color: 0x66b6ff, emissive: 0x2a7bff, emissiveIntensity: .9, roughness: .2 }), total); em.geometry.userData.shared = true; em.frustumCulled = false;
      let idx = 0; const col = new THREE.Color();
      shells.forEach((cnt, k) => {
        if (!cnt) { return; } const rad = nucR + .9 + .62 * k; const tilt = new THREE.Euler(k * .5 + .3, k * .8, k * .3);
        const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad)); }
        const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a6bd0, transparent: true, opacity: .45 })); ring.rotation.copy(tilt); this.add(ring);
        const outer = k === K - 1 || (shells.slice(k + 1).every(x => !x));
        for (let i = 0; i < cnt; i++) { this.rings.push({ k, rad, tilt, a0: i / cnt * Math.PI * 2, sp: .9 / Math.pow(k + 1, 1.15), idx }); em.setColorAt(idx, col.set(outer && valenceHighlight ? '#ffd35a' : '#6ab8ff')); idx++; }
      });
      this.add(em); this.electrons = em;
    }
  }
  update(t) {
    if (this.nucleus) { this.nucleus.rotation.y = t * .25; this.nucleus.rotation.x = t * .1; }
    if (!this.electrons) return; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(.085, .085, .085);
    this.rings.forEach(e => { const a = e.a0 + t * e.sp; v.set(Math.cos(a) * e.rad, 0, Math.sin(a) * e.rad).applyEuler(e.tilt); m.compose(v, q, s); this.electrons.setMatrixAt(e.idx, m); });
    this.electrons.instanceMatrix.needsUpdate = true;
  }
}

/* ================= bulk sample view ================= */
const LATT = {
  SC: { basis: [[0, 0, 0]], rf: .5 }, BCC: { basis: [[0, 0, 0], [.5, .5, .5]], rf: Math.sqrt(3) / 4 }, FCC: { basis: [[0, 0, 0], [.5, .5, 0], [.5, 0, .5], [0, .5, .5]], rf: Math.sqrt(2) / 4 },
  DIA: { basis: [[0, 0, 0], [.5, .5, 0], [.5, 0, .5], [0, .5, .5], [.25, .25, .25], [.75, .75, .25], [.75, .25, .75], [.25, .75, .75]], rf: Math.sqrt(3) / 8 },
};
class SampleView {
  constructor() { this.group = new THREE.Group(); this.parts = []; this.mesh = null; }
  clear() { if (this.mesh) { this.group.remove(this.mesh); this.mesh.material.dispose(); this.mesh = null; } this.group.clear(); this.pos = null; }
  set(e, T) {
    this.clear(); this.e = e; this.T = T; const st = stateAt(e, T); this.state = st; const color = e.color || '#9aa4c8'; const metal = /metal|Transition|Lanth|Actin/i.test(e.series) ;
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: metal ? .28 : .4, metalness: metal ? .75 : 0, clearcoat: .5 });
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 3, 3)), new THREE.LineBasicMaterial({ color: 0x6a78c8, transparent: true, opacity: .35 })); this.group.add(box);
    if (st === 'solid' || st === 'unknown') {
      let lat = e.lat; let type = LATT[lat] ? lat : (lat === 'HEX' ? 'HEX' : 'SC'); const P = [];
      if (type === 'HEX') { const a = .62, c = a * 1.633; for (let i = -2; i < 3; i++) for (let j = -2; j < 3; j++) for (let k = -1; k < 2; k++) [[0, 0, 0], [1 / 3, 1 / 3, .5]].forEach(b => { const x = (i + b[0]) * a + (j + b[1]) * a * .5, z = (j + b[1]) * a * .866, y = (k + b[2]) * c; if (Math.abs(x) < 1.45 && Math.abs(y) < 1.45 && Math.abs(z) < 1.45) P.push([x, y, z]); }); this.r = a * .5 * .92; }
      else { const L = LATT[type], cells = 3, a = 3 / cells; for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) for (let k = 0; k < cells; k++) L.basis.forEach(b => P.push([(i + b[0]) * a - 1.5 + a * .0, (j + b[1]) * a - 1.5, (k + b[2]) * a - 1.5])); if (type === 'FCC' || type === 'BCC' || type === 'SC') { for (let i = 0; i <= cells; i++) for (let j = 0; j <= cells; j++) for (let k = 0; k <= cells; k++) if (i === cells || j === cells || k === cells) { /* far faces */ if (type !== 'BCC' || false) P.push([i * a - 1.5, j * a - 1.5, k * a - 1.5]); if (type === 'FCC') { /* face centres on far faces */ } } } this.r = L.rf * a * .92; }
      this.lattice = type; this.pos = P.map(p => new THREE.Vector3(...p)); this.base = this.pos.map(p => p.clone()); this.vel = null; this.label = (e.lat && LATT[e.lat] ? e.lat : e.lat || 'unknown') + ' lattice';
    } else {
      const n = st === 'gas' ? 36 : 70; const diat = ['H', 'N', 'O', 'F', 'Cl'].includes(e.sym) && st === 'gas'; this.pos = []; this.vel = [];
      for (let i = 0; i < n; i++) { this.pos.push(new THREE.Vector3((Math.random() - .5) * 2.6, (Math.random() - .5) * (st === 'gas' ? 2.6 : 1.4) - (st === 'gas' ? 0 : .7), (Math.random() - .5) * 2.6)); this.vel.push(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(st === 'gas' ? 1.6 : .5)); }
      this.r = st === 'gas' ? .2 : .26; this.base = null; this.label = st === 'gas' ? (diat ? 'diatomic gas molecules' : 'gas atoms') : 'liquid'; this.diat = diat;
    }
    this.mesh = new THREE.InstancedMesh(SPH, mat, this.pos.length); this.mesh.frustumCulled = false; this.group.add(this.mesh);
    const base = new THREE.Color(color); const c = new THREE.Color(); for (let i = 0; i < this.pos.length; i++) { c.copy(base).offsetHSL(0, 0, (Math.random() - .5) * .06); this.mesh.setColorAt(i, c); }
    this.mesh.material.color.set(0xffffff); this.box = box;
    if (st === 'liquid') { box.scale.set(1, .5, 1); box.position.y = -.75; }
  }
  update(dt, t) {
    if (!this.mesh || !this.pos) return; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(this.r, this.r, this.r);
    const st = this.state;
    if (this.vel) {
      const lim = st === 'gas' ? 1.4 : 1.4, ymin = st === 'gas' ? -1.4 : -1.45, ymax = st === 'gas' ? 1.4 : 0;
      for (let i = 0; i < this.pos.length; i++) { const p = this.pos[i], v = this.vel[i]; p.addScaledVector(v, dt); if (Math.abs(p.x) > lim) { p.x = Math.sign(p.x) * lim; v.x *= -1; } if (p.y > ymax) { p.y = ymax; v.y *= -1; } if (p.y < ymin) { p.y = ymin; v.y *= -1; } if (Math.abs(p.z) > lim) { p.z = Math.sign(p.z) * lim; v.z *= -1; }
        if (st === 'liquid') { v.y -= 1.2 * dt; v.x += (Math.random() - .5) * .8 * dt * 8; v.z += (Math.random() - .5) * .8 * dt * 8; v.multiplyScalar(.985); } }
      if (st === 'liquid') for (let i = 0; i < this.pos.length; i++) for (let j = i + 1; j < this.pos.length; j++) { const d = this.pos[i].distanceTo(this.pos[j]); if (d < this.r * 2 && d > 1e-4) { const push = this.pos[i].clone().sub(this.pos[j]).multiplyScalar((this.r * 2 - d) / d * .5); this.pos[i].add(push); this.pos[j].sub(push); } }
    } else if (this.base) { const amp = .012 + .035 * Math.min(1, this.T / Math.max(300, this.e.mp || 1500)); this.pos.forEach((p, i) => { const b = this.base[i]; p.set(b.x + Math.sin(t * 7 + i * 1.3) * amp, b.y + Math.sin(t * 6.1 + i * 2.1) * amp, b.z + Math.sin(t * 8.3 + i * .7) * amp); }); }
    for (let i = 0; i < this.pos.length; i++) { m.compose(this.pos[i], q, s); this.mesh.setMatrixAt(i, m); } this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ================================================================== */
export function initChem({ renderer, canvas, envTex, enterMode, exitMode }) {
  const root = $('#chem'), left = $('#chem-left'), right = $('#chem-right'), viewEl = $('#chem-view'), tabsEl = $('#chem-tabs');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a1c); scene.environment = envTex; scene.environmentIntensity = .75; scene.fog = null;
  const cam = new THREE.PerspectiveCamera(36, 1, .05, 200); cam.position.set(0, .6, 9);
  const ctrl = new OrbitControls(cam, canvas); ctrl.enabled = false; ctrl.enableDamping = true; ctrl.dampingFactor = .08; ctrl.autoRotate = true; ctrl.autoRotateSpeed = .9;
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x1a1030, .8)); const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key); const rim = new THREE.DirectionalLight(0x7a6cff, 1.8); rim.position.set(-4, 2, -3); scene.add(rim);
  const stage = new THREE.Group(); scene.add(stage);
  const atomView = new AtomView(), sampleView = new SampleView(), molView = new MolView(), labView = new MolView(); labView.labels = true;
  [atomView.group, sampleView.group, molView.group, labView.group].forEach(g => { g.visible = false; stage.add(g); });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 40), new THREE.MeshBasicMaterial({ color: 0xffd35a, side: THREE.DoubleSide, transparent: true, opacity: .95, depthTest: false })); ring.renderOrder = 15; ring.visible = false; scene.add(ring);

  const S = { tab: 'elements', z: 6, colorBy: 'category', T: 293, elView: 'atom', mol: 'h2o', style: 'ball', labels: true, spin: true, P: 6, N: 6, E: 6, selEl: 'C', labSel: null, tool: 'add', relax: true, hist: [] };
  let active = false; let t = 0;
  const frame3d = (R, ypos = 0) => { const d = Math.max(2.4, R / Math.tan(cam.fov * Math.PI / 360) * 1.25); cam.position.set(d * .25, d * .12 + ypos, d); ctrl.target.set(0, ypos, 0); cam.lookAt(0, ypos, 0); ctrl.update(); };
  const toast = (msg) => { const el = $('#chem-toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); };

  /* ---------------- tabs ---------------- */
  const TABS = [['elements', 'Periodic table'], ['molecules', 'Molecules'], ['atom', 'Build an atom'], ['lab', 'Molecule lab']];
  tabsEl.innerHTML = TABS.map(([k, n]) => `<button data-t="${k}">${n}</button>`).join('') + '<button id="chem-back" class="back">‹ Anatomy</button>';
  tabsEl.querySelectorAll('button[data-t]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.t)));
  $('#chem-back').addEventListener('click', () => exitMode());

  function setTab(k) {
    S.tab = k; root.dataset.tab = k; tabsEl.querySelectorAll('button[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === k));
    atomView.group.visible = sampleView.group.visible = molView.group.visible = labView.group.visible = false; ring.visible = false; ctrl.autoRotate = S.spin;
    if (k === 'elements') { buildElements(); } else if (k === 'molecules') { buildMolecules(); } else if (k === 'atom') { buildAtomBuilder(); } else { buildLab(); }
  }

  /* ================= ELEMENTS ================= */
  function buildElements() {
    const cells = EL.map(e => { const [c, r] = tableCell(e); return `<button class="el" data-z="${e.z}" style="grid-column:${c};grid-row:${r}"><i>${e.z}</i><b>${e.sym}</b><u>${esc(e.name)}</u></button>`; }).join('');
    const ph = (c, r, t) => `<div class="el ph" style="grid-column:${c};grid-row:${r}">${t}</div>`;
    left.innerHTML = `<div class="ct-head"><div class="seg" id="colorby"><button data-c="category">Category</button><button data-c="state">State</button><button data-c="block">Block</button></div>
      <div class="tslider" id="tslider"><span>Temperature</span><input type="range" id="temp" min="0" max="6000" step="1" value="${S.T}"><b id="tval"></b></div></div>
      <div id="legend" class="legend"></div>
      <div id="ptable" class="ptable">${cells}${ph(3, 6, '57–71')}${ph(3, 7, '89–103')}</div>
      <div class="ct-note">Click any element to see it in 3D. In <b>State</b> mode, drag the temperature to melt and boil the elements.</div>`;
    $('#colorby').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.colorBy = b.dataset.c; paintTable(); }));
    $('#temp').addEventListener('input', e => { S.T = +e.target.value; if (S.colorBy !== 'state') S.colorBy = 'state'; paintTable(); if (S.elView === 'sample') setElementView(); });
    $('#ptable').addEventListener('click', e => { const b = e.target.closest('.el[data-z]'); if (b) selectElement(+b.dataset.z); });
    $('#ptable').addEventListener('mouseover', e => { const b = e.target.closest('.el[data-z]'); if (b) hoverCat(EL[+b.dataset.z - 1]); });
    $('#ptable').addEventListener('mouseleave', () => hoverCat(null));
    paintTable(); selectElement(S.z);
  }
  let hoverKey = null;
  function hoverCat(e) { hoverKey = e ? (S.colorBy === 'category' ? e.series : S.colorBy === 'block' ? e.block : stateAt(e, S.T)) : null; applyHover(); }
  function elColorFor(e) { return S.colorBy === 'category' ? CAT[e.series] : S.colorBy === 'block' ? BLOCKC[e.block] : STATEC[stateAt(e, S.T)]; }
  function keyFor(e) { return S.colorBy === 'category' ? e.series : S.colorBy === 'block' ? e.block : stateAt(e, S.T); }
  function applyHover() { const pt = $('#ptable'); if (!pt) return; pt.querySelectorAll('.el[data-z]').forEach(b => { const e = EL[+b.dataset.z - 1]; b.classList.toggle('dim', hoverKey != null && keyFor(e) !== hoverKey); }); document.querySelectorAll('#legend button').forEach(b => b.classList.toggle('on', hoverKey != null && b.dataset.k === hoverKey)); }
  function paintTable() {
    $('#colorby').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.c === S.colorBy)); $('#tslider').classList.toggle('show', S.colorBy === 'state'); $('#tval').textContent = `${S.T} K · ${K2C(S.T)} °C`;
    $('#ptable').querySelectorAll('.el[data-z]').forEach(b => { const e = EL[+b.dataset.z - 1]; const c = elColorFor(e); b.style.setProperty('--c', c); b.classList.toggle('rad', e.rad && S.colorBy !== 'state'); });
    const items = S.colorBy === 'category' ? Object.entries(CAT) : S.colorBy === 'block' ? Object.entries(BLOCKC).map(([k, v]) => [k + '-block', v]) : Object.entries(STATEC).map(([k, v]) => [k, v]);
    const keys = S.colorBy === 'block' ? Object.keys(BLOCKC) : null;
    $('#legend').innerHTML = items.map(([k, c], i) => `<button data-k="${keys ? keys[i] : k}" style="--c:${c}"><i></i>${k}</button>`).join('');
    $('#legend').querySelectorAll('button').forEach(b => { b.addEventListener('mouseenter', () => { hoverKey = b.dataset.k; applyHover(); }); b.addEventListener('mouseleave', () => { hoverKey = null; applyHover(); }); });
  }
  function selectElement(z) {
    S.z = z; const e = EL[z - 1]; $('#ptable') && $('#ptable').querySelectorAll('.el.sel').forEach(b => b.classList.remove('sel')); const cell = $(`#ptable .el[data-z="${z}"]`); if (cell) cell.classList.add('sel');
    const st = stateAt(e, 293.15);
    const fmtT = k => k == null ? '—' : `${Math.round(k)} K (${K2C(k)} °C)`;
    const oxi = (e.oxi || []).length ? e.oxi.map(o => (o > 0 ? '+' : '') + o).join(', ') : '—';
    const iso = (e.iso || []).map(([a, ab]) => `<span title="${ab}% natural abundance"><sup>${a}</sup>${e.sym} <small>${ab < .01 ? '<0.01' : ab}%</small></span>`).join('') || '<span class="muted">no naturally occurring isotopes</span>';
    right.innerHTML = `<div class="el-hero" style="--c:${CAT[e.series]}"><div class="hero-sym"><i>${e.z}</i><b>${e.sym}</b><u>${e.mass ? (e.mass % 1 === 0 && e.rad ? '[' + e.mass + ']' : e.mass.toFixed(3)) : ''}</u></div>
        <div><h2>${esc(e.name)}</h2><div class="muted">${esc(e.series)}${e.rad ? ' · radioactive' : ''}</div><div class="chip" style="--c:${STATEC[st]}">${st === 'unknown' ? 'state unknown' : st + ' at room temperature'}</div></div></div>
      <div class="el-view-tabs seg"><button data-v="atom">Atom model</button><button data-v="sample">Sample</button></div>
      <dl class="props"><dt>Group · Period · Block</dt><dd>${e.group ?? '—'} · ${e.period} · ${e.block}</dd><dt>Electron configuration</dt><dd class="mono">${esc(fixConf(e.econf))}</dd>
      <dt>Electrons per shell</dt><dd class="mono">${shellsFromConf(e.econf).filter(x => x).join(' · ') || '—'}</dd>
      <dt>Electronegativity</dt><dd>${e.en ?? '—'}</dd><dt>Density</dt><dd>${e.dens != null ? e.dens + ' g/cm³' : '—'}</dd><dt>Melting point</dt><dd>${fmtT(e.mp)}</dd><dt>Boiling point</dt><dd>${fmtT(e.bp)}</dd>
      <dt>Common oxidation states</dt><dd>${oxi}</dd><dt>Crystal structure</dt><dd>${esc(e.lat || '—')}</dd><dt>Discovered</dt><dd>${esc(e.disc || '—')}${e.year ? ', ' + e.year : ''}</dd></dl>
      <div class="sect">Natural isotopes</div><div class="isos">${iso}</div>
      ${e.desc ? `<div class="sect">About</div><p class="desc">${esc(e.desc)}</p>` : ''}${e.uses ? `<div class="sect">Uses</div><p class="desc">${esc(e.uses)}</p>` : ''}`;
    right.querySelectorAll('.el-view-tabs button').forEach(b => b.addEventListener('click', () => { S.elView = b.dataset.v; setElementView(); }));
    setElementView();
  }
  function setElementView() {
    right.querySelectorAll('.el-view-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === S.elView));
    const e = EL[S.z - 1]; atomView.group.visible = S.elView === 'atom'; sampleView.group.visible = S.elView === 'sample';
    const hud = $('#chem-hud');
    if (S.elView === 'atom') {
      const N = bestN(e); const sh = shellsFromConf(e.econf); atomView.set(e.z, N, sh.length ? sh : shellsAufbau(e.z)); frame3d(atomView.R * 1.05);
      hud.innerHTML = `<b>${esc(e.name)}-${e.z + N}</b> · ${e.z} protons <i class="p"></i> ${N} neutrons <i class="n"></i> ${e.z} electrons <i class="e"></i><br><small>Gold electrons are in the outer (valence) shell. Sizes are not to scale.</small>`;
    } else {
      sampleView.set(e, S.T); frame3d(2.6); const st = sampleView.state;
      hud.innerHTML = `<b>${esc(e.name)} at ${S.T} K</b> · ${st === 'unknown' ? 'state not known' : st}${st === 'solid' ? ' · ' + esc(sampleView.label) : ' · ' + esc(sampleView.label || '')}<br><small>${st === 'solid' ? 'Atoms vibrate in fixed positions. Raise the temperature (State mode) to melt it.' : st === 'liquid' ? 'Atoms flow past each other but stay close.' : st === 'gas' ? 'Particles are far apart and move freely.' : ''}</small>`;
    }
  }
  function bestN(e) { const iso = (e.iso || []).slice().sort((a, b) => b[1] - a[1])[0]; if (iso) return iso[0] - e.z; return Math.max(0, Math.round((e.mass || e.z * 2.5) - e.z)); }

  /* ================= MOLECULES ================= */
  const allMols = () => [...LIB.map(m => ({ ...m })), ...CRYSTALS];
  function buildMolecules() {
    const list = allMols();
    left.innerHTML = `<input id="msearch" class="pfilter" placeholder="Search molecules…" autocomplete="off"><div class="mgrid" id="mgrid">${list.map(m => `<button class="mcard" data-id="${m.id}"><b>${m.crystal ? '' : hill(m.counts)}</b><span>${esc(m.name.replace(/ \(.*\)/, ''))}</span></button>`).join('')}</div>`;
    $('#msearch').addEventListener('input', e => { const q = e.target.value.toLowerCase(); left.querySelectorAll('.mcard').forEach(b => { const m = list.find(x => x.id === b.dataset.id); b.style.display = (m.name + (m.counts ? hill(m.counts) : '')).toLowerCase().includes(q) ? '' : 'none'; }); });
    $('#mgrid').addEventListener('click', e => { const b = e.target.closest('.mcard'); if (b) selectMol(b.dataset.id); });
    selectMol(S.mol);
  }
  function selectMol(id) {
    S.mol = id; const m = allMols().find(x => x.id === id) || allMols()[0]; left.querySelectorAll('.mcard').forEach(b => b.classList.toggle('on', b.dataset.id === m.id));
    molView.style = S.style; molView.labels = S.labels;
    if (m.crystal) { const g = m.gen(); molView.load(g.atoms, g.bonds, 1); } else molView.load(m.atoms, m.bonds);
    molView.group.position.copy(molView.center()).negate(); molView.update(cam); molView.group.visible = true; frame3d(molView.extent() * 1.15);
    const counts = m.crystal ? (m.id === 'nacl' ? { Na: 1, Cl: 1 } : { C: 1 }) : m.counts; const mass = massOf(counts); const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const rows = Object.keys(counts).sort((a, b) => (a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a.localeCompare(b))).map(k => `<tr><td><i style="background:${elColor(k)}"></i>${k}</td><td>${BYSYM[k].name}</td><td>${m.crystal ? '' : counts[k]}</td><td>${(MASS(k) * counts[k] / mass * 100).toFixed(1)}%</td></tr>`).join('');
    right.innerHTML = `<div class="eyebrow">${m.crystal ? 'Crystal' : 'Molecule'}</div><h2>${esc(m.name)}</h2><div class="formula">${m.crystal ? (m.id === 'nacl' ? 'NaCl' : 'C') : hill(counts)}</div>
      <div class="seg" id="mstyle"><button data-s="ball">Ball & stick</button><button data-s="space">Space-filling</button><button data-s="wire">Wire</button></div>
      <div class="row-btns"><label class="chk"><input type="checkbox" id="mlabels" ${S.labels ? 'checked' : ''}> Atom labels</label><label class="chk"><input type="checkbox" id="mspin" ${S.spin ? 'checked' : ''}> Spin</label></div>
      <dl class="props"><dt>${m.crystal ? 'Formula unit' : 'Molar mass'}</dt><dd>${mass.toFixed(2)} g/mol</dd><dt>${m.crystal ? 'Structure' : 'Shape'}</dt><dd>${esc(m.shape)}</dd><dt>Polarity</dt><dd>${esc(m.polarity)}</dd>${m.crystal ? '' : `<dt>Atoms · bonds</dt><dd>${m.atoms.length} atoms · ${m.bonds.length} bonds</dd>`}<dt>State at room temp</dt><dd>${esc(m.state)}</dd></dl>
      <div class="sect">Composition by mass</div><table class="comp"><tr><th></th><th>Element</th><th>Atoms</th><th>Mass</th></tr>${rows}</table>
      <div class="sect">About</div><p class="desc">${esc(m.desc)}</p><div class="sect">Uses</div><p class="desc">${esc(m.uses)}</p>
      ${m.crystal ? '' : '<button class="cta" id="open-lab">Edit in molecule lab</button>'}`;
    right.querySelectorAll('#mstyle button').forEach(b => { b.classList.toggle('on', b.dataset.s === S.style); b.addEventListener('click', () => { S.style = b.dataset.s; molView.style = S.style; right.querySelectorAll('#mstyle button').forEach(x => x.classList.toggle('on', x === b)); }); });
    $('#mlabels').addEventListener('change', e => { S.labels = e.target.checked; molView.labels = S.labels; }); $('#mspin').addEventListener('change', e => { S.spin = e.target.checked; ctrl.autoRotate = S.spin; });
    const ol = $('#open-lab'); if (ol) ol.addEventListener('click', () => { S.loadLab = m; setTab('lab'); });
    $('#chem-hud').innerHTML = `<b>${esc(m.name)}</b><br><small>Drag to rotate · scroll to zoom</small>`;
  }

  /* ================= ATOM BUILDER ================= */
  const PRESETS = [['H', 1, 0, 1], ['He', 2, 2, 2], ['C', 6, 6, 6], ['O', 8, 8, 8], ['Na', 11, 12, 11], ['Fe', 26, 30, 26], ['Au', 79, 118, 79], ['U', 92, 146, 92]];
  function buildAtomBuilder() {
    left.innerHTML = `<div class="eyebrow">Build an atom</div><h3 class="lh">Choose what is inside</h3>
      ${['P|Protons|+ charge, sets the element', 'N|Neutrons|sets the isotope', 'E|Electrons|sets the charge (ion)'].map(s => { const [k, n, h] = s.split('|'); return `<div class="stepper" data-k="${k}"><div class="sl"><i class="dot ${k}"></i><b>${n}</b><small>${h}</small></div><div class="sc"><button data-d="-1">−</button><input type="number" value="${S[k]}" min="0" max="${k === 'N' ? 190 : 130}"><button data-d="1">+</button></div></div>`; }).join('')}
      <div class="row-btns"><button class="ghost" id="ab-neutral">Make neutral</button><button class="ghost" id="ab-stable">Most stable isotope</button></div>
      <div class="sect">Try an element</div><div class="chips" id="ab-presets">${PRESETS.map(p => `<button data-p="${p[0]}">${p[0]}</button>`).join('')}</div>
      <p class="muted tip">Protons decide <b>which element</b> it is. Neutrons change the <b>isotope</b>. Electrons change the <b>charge</b>, making an ion.</p>`;
    left.querySelectorAll('.stepper').forEach(st => { const k = st.dataset.k, inp = st.querySelector('input'); const set = v => { const max = k === 'N' ? 190 : 130; S[k] = Math.max(0, Math.min(max, Math.round(+v || 0))); inp.value = S[k]; updateAtomBuilder(); }; st.querySelectorAll('button').forEach(b => b.addEventListener('click', () => set(S[k] + +b.dataset.d))); inp.addEventListener('input', () => set(inp.value)); });
    $('#ab-neutral').addEventListener('click', () => { S.E = S.P; syncInputs(); updateAtomBuilder(); });
    $('#ab-stable').addEventListener('click', () => { const e = EL[S.P - 1]; if (e) { S.N = bestN(e); syncInputs(); updateAtomBuilder(); } });
    $('#ab-presets').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const p = PRESETS.find(x => x[0] === b.dataset.p); S.P = p[1]; S.N = p[2]; S.E = p[3]; syncInputs(); updateAtomBuilder(); });
    atomView.group.visible = true; updateAtomBuilder(true);
  }
  function syncInputs() { ['P', 'N', 'E'].forEach(k => { const i = left.querySelector(`.stepper[data-k="${k}"] input`); if (i) i.value = S[k]; }); }
  let abKey = '';
  function updateAtomBuilder(force) {
    const { P, N, E } = S; const e = P > 0 ? EL[P - 1] : null; const A = P + N, q = P - E;
    const shells = E > 0 ? ((e && E === P && e.econf) ? shellsFromConf(e.econf) : shellsAufbau(E)) : [];
    const key = [P, N, E].join(','); if (key !== abKey || force) { abKey = key; atomView.set(P, N, shells); frame3d(Math.max(atomView.R, 2.2) * 1.05); }
    let status = '', cls = '';
    if (P === 0) { status = N > 0 ? 'A cluster of neutrons is not an element and is not stable. (A neutron on its own decays in about 15 minutes.)' : 'Add a proton to make hydrogen!'; cls = 'bad'; }
    else if (e) { if ((e.iso || []).some(([a]) => a === A)) { status = e.rad ? 'Radioactive isotope that occurs in nature.' : 'Stable isotope found in nature.'; cls = e.rad ? 'warn' : 'ok'; } else if (e.known && A >= e.known[0] && A <= e.known[1]) { status = 'Radioactive isotope made in laboratories. It decays.'; cls = 'warn'; } else { status = 'This combination has never been observed. Too many or too few neutrons make the nucleus fall apart.'; cls = 'bad'; } }
    const chargeTxt = q === 0 ? 'neutral atom' : q > 0 ? `cation (lost ${q} electron${q > 1 ? 's' : ''})` : `anion (gained ${-q} electron${-q > 1 ? 's' : ''})`;
    const sym = e ? e.sym : '?'; const chStr = q === 0 ? '' : sup((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '−'));
    right.innerHTML = `<div class="ab-id"><div class="ab-sym"><small>${A || ''}</small><sub>${P || '0'}</sub><b>${sym}</b><em>${chStr}</em></div><div><h2>${e ? esc(e.name) + '-' + A : 'No element'}</h2><div class="muted">${e ? esc(e.series) : ''}</div></div></div>
      <div class="status ${cls}">${status}</div>
      <dl class="props"><dt>Protons · neutrons · electrons</dt><dd>${P} · ${N} · ${E}</dd><dt>Mass number</dt><dd>${A}</dd><dt>Net charge</dt><dd>${q > 0 ? '+' : ''}${q} (${chargeTxt})</dd><dt>Atomic mass (average)</dt><dd>${e && e.mass ? e.mass + ' u' : '—'}</dd><dt>Electron shells</dt><dd class="mono">${shells.filter(x => x).join(' · ') || '—'}</dd></dl>
      ${e && E > 0 ? `<div class="sect">Valence electrons</div><p class="desc">${shells.length ? shells[shells.length - 1] : 0} electron${shells[shells.length - 1] === 1 ? '' : 's'} in the outer shell${E === P && e.group ? '. Elements in group ' + e.group + ' have similar chemistry.' : '.'}</p>` : ''}
      ${e ? '<button class="cta" id="ab-open">Show in periodic table</button>' : ''}`;
    const o = $('#ab-open'); if (o) o.addEventListener('click', () => { S.z = P; setTab('elements'); });
    $('#chem-hud').innerHTML = `<b>${e ? esc(e.name) : 'Empty'}${q ? ' ion' : ''}</b> · <i class="p"></i> protons <i class="n"></i> neutrons <i class="e"></i> electrons<br><small>Drag to rotate · scroll to zoom</small>`;
  }

  /* ================= MOLECULE LAB ================= */
  const PALETTE = ['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I', 'Na', 'K', 'Mg', 'Ca', 'Si', 'B', 'Li', 'Al'];
  function buildLab() {
    left.innerHTML = `<div class="eyebrow">Molecule lab</div><h3 class="lh">Pick an element, then click in the 3D space</h3>
      <div class="pal" id="pal">${PALETTE.map(s => `<button data-s="${s}" style="--c:${elColor(s)}"><b>${s}</b></button>`).join('')}</div>
      <select id="pal-all" class="pfilter"><option value="">More elements…</option>${EL.filter(e => e.z <= 86).map(e => `<option value="${e.sym}">${e.z} ${e.name} (${e.sym})</option>`).join('')}</select>
      <div class="sect">Tools</div><div class="chips big"><button id="lb-fill">Add hydrogens</button><button id="lb-relax" class="${S.relax ? 'on' : ''}">Auto-shape: ${S.relax ? 'on' : 'off'}</button><button id="lb-undo">Undo</button><button id="lb-del">Delete selected</button><button id="lb-clear">Clear</button><button id="lb-xyz">Export .xyz</button></div>
      <div class="sect">Examples</div><select id="lb-ex" class="pfilter"><option value="">Load a molecule…</option>${LIB.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
      <ul class="howto"><li><b>Click empty space</b>: add an atom (bonded to the selected one)</li><li><b>Click an atom</b>: select it. <b>Click another</b>: make or upgrade a bond (single, double, triple, none)</li><li><b>Drag an atom</b>: move it</li><li><b>Delete</b> key: remove selected</li></ul>`;
    $('#pal').querySelectorAll('button').forEach(b => b.addEventListener('click', () => pickEl(b.dataset.s)));
    $('#pal-all').addEventListener('change', e => { if (e.target.value) pickEl(e.target.value); e.target.value = ''; });
    $('#lb-fill').addEventListener('click', () => { pushHist(); addHydrogens(); }); $('#lb-undo').addEventListener('click', undo); $('#lb-del').addEventListener('click', delSelected);
    $('#lb-clear').addEventListener('click', () => { if (labView.atoms.length) { pushHist(); labView.clear(); S.labSel = null; } });
    $('#lb-relax').addEventListener('click', () => { S.relax = !S.relax; const b = $('#lb-relax'); b.classList.toggle('on', S.relax); b.textContent = 'Auto-shape: ' + (S.relax ? 'on' : 'off'); });
    $('#lb-xyz').addEventListener('click', exportXYZ);
    $('#lb-ex').addEventListener('change', e => { const m = LIB.find(x => x.id === e.target.value); if (m) { pushHist(); loadIntoLab(m); } e.target.value = ''; });
    pickEl(S.selEl); labView.group.visible = true; labView.group.position.set(0, 0, 0); ctrl.autoRotate = false; frame3d(2);
    if (S.loadLab) { loadIntoLab(S.loadLab); S.loadLab = null; } else if (!labView.atoms.length) { const o = labView.addAtom('O', new THREE.Vector3(0, 0, 0)); S.labSel = null; labFirstHint(); }
    refreshLabInfo();
  }
  const labFirstHint = () => toast('Tip: select O, then click empty space to add atoms. Try Add hydrogens!');
  function pickEl(s) { S.selEl = s; const p = $('#pal'); if (p) p.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.s === s)); }
  function loadIntoLab(m) { labView.clear(); labView.load(m.atoms, m.bonds); S.labSel = null; const c = labView.center(); labView.atoms.forEach(a => a.pos.sub(c)); frame3d(Math.max(labView.extent() * 1.15, 1.8)); refreshLabInfo(); }
  const snap = () => JSON.stringify({ a: labView.atoms.map(a => [a.sym, a.pos.x, a.pos.y, a.pos.z]), b: labView.bonds.map(b => [labView.atoms.indexOf(b.a), labView.atoms.indexOf(b.b), b.o]) });
  function pushHist() { S.hist.push(snap()); if (S.hist.length > 40) S.hist.shift(); }
  function undo() { const h = S.hist.pop(); if (!h) return; const d = JSON.parse(h); labView.clear(); S.labSel = null; labView.load(d.a.map(x => [x[0], x[1], x[2], x[3]]), d.b, 1); refreshLabInfo(); }
  function delSelected() { if (!S.labSel) return; pushHist(); labView.removeAtom(S.labSel); S.labSel = null; refreshLabInfo(); }
  function addHydrogens() {
    let added = 0; [...labView.atoms].forEach(a => {
      if (a.sym === 'H') return; const nv = NORMAL_VAL[a.sym]; if (nv == null) return; let free = nv - labView.degree(a);
      if (a.sym === 'S' || a.sym === 'P') { /* keep normal valence */ }
      for (; free > 0; free--) { const nb = labView.neighbors(a); const away = new THREE.Vector3(); nb.forEach(n => away.add(n.pos.clone().sub(a.pos).normalize())); let dir = away.length() > .05 ? away.negate().normalize() : new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); dir.add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.5)).normalize();
        const h = labView.addAtom('H', a.pos.clone().addScaledVector(dir, (rcov(a.sym) + rcov('H')) * .62)); labView.addBond(a, h, 1); added++; }
    });
    if (!added) toast('Every atom already has its usual number of bonds.'); refreshLabInfo();
  }
  function exportXYZ() { const n = labView.atoms.length; if (!n) return; const lines = [n, 'Built in Anatomia molecule lab', ...labView.atoms.map(a => `${a.sym} ${(a.pos.x / .62).toFixed(4)} ${(a.pos.y / .62).toFixed(4)} ${(a.pos.z / .62).toFixed(4)}`)]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'chemical/x-xyz' })); a.download = 'molecule.xyz'; a.click(); }

  /* ---- physics: bond springs + angle (VSEPR-like) springs ---- */
  function relaxStep() {
    const A = labView.atoms; if (A.length < 2) return; const F = new Map(); A.forEach(a => F.set(a, new THREE.Vector3())); const dragged = drag && drag.atom;
    const push = (a, b, k, rest) => { const d = b.pos.clone().sub(a.pos); const L = d.length() || 1e-4; const f = d.multiplyScalar(k * (L - rest) / L); F.get(a).add(f); F.get(b).sub(f); };
    labView.bonds.forEach(bd => { const rest = (rcov(bd.a.sym) + rcov(bd.b.sym)) * .62 * (bd.o === 1 ? 1 : bd.o === 2 ? .88 : .79); push(bd.a, bd.b, 9, rest); });
    const adj = new Map(); A.forEach(a => adj.set(a, [])); labView.bonds.forEach(bd => { adj.get(bd.a).push([bd.b, bd.o]); adj.get(bd.b).push([bd.a, bd.o]); });
    const bonded13 = new Set();
    A.forEach(c => { const nb = adj.get(c); if (nb.length < 2) return; const bo = nb.reduce((s, [, o]) => s + o, 0); const ve = VALENCE_E[c.sym] ?? 4; const lp = Math.max(0, Math.floor((ve - bo) / 2)); const ster = nb.length + lp; let th = ster <= 2 ? 180 : ster === 3 ? 120 : 109.5 - 2.5 * lp; if (ster >= 5) th = nb.length >= 5 ? 90 : 109.5; th = th * Math.PI / 180;
      for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) { const a = nb[i][0], b = nb[j][0]; const la = (rcov(c.sym) + rcov(a.sym)) * .62, lb = (rcov(c.sym) + rcov(b.sym)) * .62; const dab = Math.sqrt(la * la + lb * lb - 2 * la * lb * Math.cos(th)); push(a, b, 4, dab); bonded13.add(a.id + '-' + b.id); bonded13.add(b.id + '-' + a.id); } });
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const a = A[i], b = A[j]; if (labView.bondOf(a, b) || bonded13.has(a.id + '-' + b.id)) continue; const d = b.pos.clone().sub(a.pos); const L = d.length() || 1e-3; const min = (rvdw(a.sym) + rvdw(b.sym)) * .62 * .85; if (L < min) { const f = d.multiplyScalar((min - L) / L * 1.2); F.get(a).sub(f); F.get(b).add(f); } }
    const c = labView.center();
    A.forEach(a => { if (a === dragged) return; const f = F.get(a); f.multiplyScalar(.045); if (f.length() > .12) f.setLength(.12); a.pos.add(f); });
  }

  function refreshLabInfo() {
    const A = labView.atoms; const counts = countsOf(A); const mass = massOf(counts); const n = A.length;
    if (!n) { right.innerHTML = `<div class="eyebrow">Your molecule</div><h2>Empty</h2><p class="desc">Add an atom to begin.</p>`; $('#chem-hud').innerHTML = '<b>Molecule lab</b><br><small>Click in the 3D space to add atoms</small>'; return; }
    // valence report
    const issues = []; A.forEach(a => { const nv = NORMAL_VAL[a.sym]; if (nv == null) return; const d = labView.degree(a); if (d < nv && a.sym !== 'H' || (a.sym === 'H' && d < 1)) issues.push(`${a.sym} has ${nv - d} open bond${nv - d > 1 ? 's' : ''}`); else if (d > nv && d > maxVal(a.sym)) issues.push(`${a.sym} has too many bonds`); });
    // connectivity
    const comps = (() => { const seen = new Set(); let c = 0; A.forEach(a => { if (seen.has(a)) return; c++; const st = [a]; while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); labView.neighbors(x).forEach(y => st.push(y)); } }); return c; })();
    const syms = A.map(a => a.sym); const bonds = labView.bonds.map(b => [A.indexOf(b.a), A.indexOf(b.b), b.o]); const sig = signature(syms, bonds);
    const match = comps === 1 ? LIB.find(m => m.sig === sig && Object.keys(m.counts).length === Object.keys(counts).length) : null;
    const iso = !match && comps === 1 ? LIB.filter(m => hill(m.counts) === hill(counts)) : [];
    const formula = hill(counts);
    const rows = Object.keys(counts).sort().map(k => `<tr><td><i style="background:${elColor(k)}"></i>${k}</td><td>${BYSYM[k].name}</td><td>${counts[k]}</td><td>${(MASS(k) * counts[k] / mass * 100).toFixed(1)}%</td></tr>`).join('');
    const sel = S.labSel;
    right.innerHTML = `<div class="eyebrow">Your molecule</div><h2>${match ? esc(match.name) : formula}</h2>${match ? `<div class="formula">${formula}</div>` : ''}
      ${match ? `<div class="status ok">You built <b>${esc(match.name)}</b>! ${esc(match.desc.split('. ')[0])}.</div>` : comps > 1 ? `<div class="status warn">${comps} separate pieces. Bond them to make one molecule.</div>` : iso.length ? `<div class="status warn">Same formula as ${esc(iso.map(m => m.name).join(', '))}, but a different arrangement (an isomer).</div>` : issues.length ? '' : n > 1 ? '<div class="status ok">All valences satisfied. This is a new combination!</div>' : ''}
      ${issues.length ? `<div class="status ${match ? 'warn' : 'bad'}">${issues.slice(0, 4).map(esc).join(' · ')}${issues.length > 4 ? ' …' : ''}<br><small>Use “Add hydrogens” to fill open bonds.</small></div>` : ''}
      <dl class="props"><dt>Molar mass</dt><dd>${mass.toFixed(3)} g/mol</dd><dt>Atoms · bonds</dt><dd>${n} · ${labView.bonds.length}</dd></dl>
      <div class="sect">Composition by mass</div><table class="comp"><tr><th></th><th>Element</th><th>Atoms</th><th>Mass</th></tr>${rows}</table>
      ${sel ? `<div class="sect">Selected atom</div><p class="desc"><b>${BYSYM[sel.sym].name} (${sel.sym})</b>: ${labView.degree(sel)} bond${labView.degree(sel) === 1 ? '' : 's'}, usually forms ${NORMAL_VAL[sel.sym] ?? '?'}. Electronegativity ${BYSYM[sel.sym].en ?? '—'}.</p>` : ''}`;
    $('#chem-hud').innerHTML = `<b>${formula}</b> · ${mass.toFixed(2)} g/mol<br><small>${S.labSel ? 'Click empty space to add a bonded ' + S.selEl : 'Click an atom to select it, or empty space to add ' + S.selEl}</small>`;
  }

  /* ---- lab pointer interaction ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let drag = null;
  const rectOf = () => viewEl.getBoundingClientRect();
  function setRay(e) { const r = rectOf(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); }
  const inView = e => { const r = rectOf(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  const planeAt = p => new THREE.Plane().setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()).negate(), p);
  function pickAtom() { const hits = ray.intersectObjects(labView.atoms.map(a => a.mesh), false); return hits.length ? hits[0].object.userData.atom : null; }
  canvas.addEventListener('pointerdown', e => {
    if (!active || S.tab !== 'lab' || !inView(e) || e.button !== 0) return; setRay(e); const a = pickAtom();
    drag = { x: e.clientX, y: e.clientY, atom: a, moved: false, hist: false, plane: a ? planeAt(a.pos) : null };
    if (a) { ctrl.enabled = false; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!active || S.tab !== 'lab' || !drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    if (drag.atom && drag.moved) { if (!drag.hist) { pushHist(); drag.hist = true; } setRay(e); const p = new THREE.Vector3(); if (ray.ray.intersectPlane(drag.plane, p)) drag.atom.pos.copy(p); }
  });
  canvas.addEventListener('pointerup', e => {
    if (!active || S.tab !== 'lab' || !drag) return; const d = drag; drag = null; ctrl.enabled = true;
    if (d.moved) { if (d.atom) refreshLabInfo(); return; }
    setRay(e); const a = pickAtom();
    if (a) { if (S.labSel && S.labSel !== a) { bondToggle(S.labSel, a); } else S.labSel = S.labSel === a ? null : a; refreshLabInfo(); return; }
    // empty space: add atom
    const sel = S.labSel; const anchor = sel ? sel.pos : labView.center(); const pl = planeAt(anchor); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(pl, p)) return;
    if (sel) { if (labView.degree(sel) >= maxVal(sel.sym) || (NORMAL_VAL[sel.sym] === 0)) { toast(`${BYSYM[sel.sym].name} can't take another bond`); return; } if (maxVal(S.selEl) === 0) { toast(`${BYSYM[S.selEl].name} is a noble gas and doesn't bond`); return; } }
    pushHist(); let pos = p;
    if (sel) { let dir = p.clone().sub(sel.pos); if (dir.length() < .2) dir = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5); pos = sel.pos.clone().addScaledVector(dir.normalize(), (rcov(sel.sym) + rcov(S.selEl)) * .62); }
    const na = labView.addAtom(S.selEl, pos); if (sel) { labView.addBond(sel, na, 1); } S.labSel = na; refreshLabInfo();
  });
  canvas.addEventListener('contextmenu', e => { if (active && S.tab === 'lab' && inView(e)) { e.preventDefault(); setRay(e); const a = pickAtom(); if (a) { pushHist(); labView.removeAtom(a); if (S.labSel === a) S.labSel = null; refreshLabInfo(); } } });
  function bondToggle(a, b) {
    const ex = labView.bondOf(a, b); pushHist();
    if (!ex) { if (labView.degree(a) >= maxVal(a.sym)) { toast(`${a.sym} already has its maximum bonds`); S.hist.pop(); return; } if (labView.degree(b) >= maxVal(b.sym)) { toast(`${b.sym} already has its maximum bonds`); S.hist.pop(); return; } labView.addBond(a, b, 1); }
    else if (ex.o < 3 && labView.degree(a) < maxVal(a.sym) && labView.degree(b) < maxVal(b.sym) && a.sym !== 'H' && b.sym !== 'H') { ex.o++; labView.rebuildBond(ex); }
    else { labView.removeBond(ex); }
    S.labSel = b;
  }
  document.addEventListener('keydown', e => { if (!active || S.tab !== 'lab') return; if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.key === 'Delete' || e.key === 'Backspace') { delSelected(); } else if (e.key === 'Escape') { S.labSel = null; refreshLabInfo(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } });

  /* ================= frame / render ================= */
  function resize() { }
  function frame(dt, tt) {
    if (!active) return; t = tt;
    if (S.tab === 'elements') { if (S.elView === 'atom') atomView.update(t); else sampleView.update(dt, t); }
    else if (S.tab === 'atom') atomView.update(t);
    else if (S.tab === 'molecules') { molView.update(cam); }
    else if (S.tab === 'lab') { if (S.relax) for (let i = 0; i < 3; i++) relaxStep(); labView.update(cam); const s = S.labSel; ring.visible = !!s; if (s) { ring.position.copy(s.pos); ring.scale.setScalar(labView.radius(s) * 1.35); ring.quaternion.copy(cam.quaternion); } }
    ctrl.update();
    const W = canvas.clientWidth, H = canvas.clientHeight; const r = viewEl.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.setClearColor(0x05060e, 1); renderer.clear();
    const x = Math.max(0, r.left - cr.left), w = Math.min(W - x, r.width), h = r.height, y = H - (r.top - cr.top) - h;
    if (w < 10 || h < 10) return; cam.aspect = w / h; cam.updateProjectionMatrix();
    renderer.setScissorTest(true); renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.render(scene, cam); renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  }
  function enter() { active = true; ctrl.enabled = true; root.classList.add('on'); if (!enter.done) { enter.done = true; } setTab(S.tab); }
  function exit() { active = false; ctrl.enabled = false; root.classList.remove('on'); renderer.setScissorTest(false); }
  return { enter, exit, frame, resize, get active() { return active; } };
}

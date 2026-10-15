import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
let _s = 12345; const rnd = () => (_s = (_s * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();
const seed = n => { _s = n; };

/* ---------- materials & helpers ---------- */
const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .5, metalness: 0 }, o));
const glass = (color, op = .3, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .25, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }, o));
const glow = (color, e = .6, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, emissive: color, emissiveIntensity: e, roughness: .4 }, o));
const CUT = [new THREE.Plane(V(-1, 0, 0), 0), new THREE.Plane(V(0, -1, 0), 0), new THREE.Plane(V(0, 0, -1), 0)];
const cut = m => { m.clippingPlanes = CUT; m.clipIntersection = true; return m; };
const inOct = p => p.x > -.05 && p.y > -.05 && p.z > -.05;

function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const sarcTex = (rep, base = ['#ee8a92', '#b8404f', '#cf6571']) => canvasTex(32, 256, (g, w, h) => {
  g.fillStyle = base[0]; g.fillRect(0, 0, w, h);
  g.fillStyle = base[1]; g.fillRect(0, h * .24, w, h * .52);
  g.fillStyle = base[2]; g.fillRect(0, h * .42, w, h * .16);
  g.fillStyle = 'rgba(60,10,25,.55)'; g.fillRect(0, h * .495, w, h * .012);
  g.fillStyle = '#4a1020'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
}, [1, rep]);
const dotsTex = (bg = '#d9707a', fg = '#8a2a3c') => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) { g.fillStyle = fg; g.beginPath(); g.arc(18 + x * 16 + (y % 2) * 8, 18 + y * 15, 4.2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,200,200,.35)'; g.beginPath(); g.arc(18 + x * 16 + (y % 2) * 8 - 1, 17 + y * 15, 1.4, 0, TAU); g.fill(); }
});
const tub = (pts, r, m, seg, rad = 8) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg || Math.max(8, pts.length * 8), r, rad, false), m);
const sph = (r, m, p, sc, seg = 20) => { const g = new THREE.SphereGeometry(r, seg, Math.round(seg * .75)); if (sc) g.scale(sc[0], sc[1], sc[2]); const me = new THREE.Mesh(g, m); if (p) me.position.copy(p); return me; };
const place = (m, o) => { if (o.position) m.position.copy(o.position); if (o.rotation) m.rotation.copy(o.rotation); return m; };
const randDir = () => { const u = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - u * u); return V(s * Math.cos(a), u, s * Math.sin(a)); };

function dust(n, spread, color = 0xaab8ff, size = .035) {
  const p = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p[i] = (rnd() - .5) * spread;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: .45, depthWrite: false }));
  return { obj: pts, update: t => { pts.rotation.y = t * .01; pts.position.y = Math.sin(t * .2) * .1; } };
}

/* ---------- shared organelles ---------- */
function mitochondrion(len = .6, r = .17) {
  const g = new THREE.Group();
  const cap = new THREE.CapsuleGeometry(r, len, 8, 16); cap.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(cap, glass(0xff8a3d, .32, { emissive: 0x6a2200, emissiveIntensity: .5 })));
  const inner = new THREE.CapsuleGeometry(r * .8, len * .98, 6, 12); inner.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(inner, glass(0xffb15c, .35)));
  const cm = mat(0xff7a2a, { emissive: 0x7a2a00, emissiveIntensity: .35, side: THREE.DoubleSide });
  const n = Math.max(3, Math.round(len / .1));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + .5) * (len / n);
    const c = new THREE.SphereGeometry(1, 10, 8); c.scale(.012, r * .72, r * .5);
    const m = new THREE.Mesh(c, cm); m.position.set(x, (i % 2 ? 1 : -1) * r * .22, 0); g.add(m);
  }
  return g;
}
function golgi(R = .5) {
  const g = new THREE.Group(); const m = glass(0xffd35c, .65, { emissive: 0x6a4a00, emissiveIntensity: .4 });
  for (let i = 0; i < 6; i++) {
    const sg = new THREE.SphereGeometry(1, 24, 10, 0, TAU, 0, Math.PI * .46); sg.scale(R * (1 - i * .06), R * .2, R * .62 * (1 - i * .06));
    const me = new THREE.Mesh(sg, m); me.position.y = -i * .07; g.add(me);
  }
  for (let i = 0; i < 9; i++) { const v = sph(.035, glass(0xffe08a, .8), V(rr(-R, R), rr(-.4, .1), rr(-R * .6, R * .6) * 1.1), null, 8); g.add(v); }
  return g;
}
function nucleus(R, withClip, tint = 0x7b6cff) {
  const g = new THREE.Group();
  const nm = glass(tint, .3, { emissive: tint, emissiveIntensity: .1 }); if (withClip) cut(nm);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(R, 40, 30), nm));
  const nu = mat(0xff9d5c, { emissive: 0x6a2a00, emissiveIntensity: .5 }); if (withClip) cut(nu);
  g.add(sph(R * .32, nu, V(R * .12, -R * .05, R * .1)));
  const cm = mat(0xb06bff, { emissive: 0x4a2288, emissiveIntensity: .5 }); if (withClip) cut(cm);
  for (let k = 0; k < 14; k++) {
    const pts = []; let p = randDir().multiplyScalar(R * rr(.2, .75));
    for (let i = 0; i < 7; i++) { pts.push(p.clone()); p.add(randDir().multiplyScalar(R * .3)); if (p.length() > R * .88) p.setLength(R * .86); }
    g.add(tub(pts, R * .02, cm, 30, 5));
  }
  const pm = mat(0x23244a); if (withClip) cut(pm);
  const pores = new THREE.InstancedMesh(new THREE.TorusGeometry(R * .045, R * .012, 6, 10), pm, 70);
  const o = new THREE.Object3D();
  for (let i = 0; i < 70; i++) { const d = randDir(); o.position.copy(d).multiplyScalar(R * 1.002); o.lookAt(d.clone().multiplyScalar(3)); o.updateMatrix(); pores.setMatrixAt(i, o.matrix); }
  g.add(pores);
  return g;
}
function erSheets(nR, clip = true) {
  const g = new THREE.Group(); const m = glass(0x3fc9c2, .5, { emissive: 0x0b4a48, emissiveIntensity: .4 }); if (clip) cut(m);
  const dotsPos = [];
  for (let s = 0; s < 8; s++) {
    let c = randDir(); let tries = 0; while (inOct(c) && tries++ < 20) c = randDir();
    const t1 = V(0, 1, 0).cross(c).normalize(); const t2 = c.clone().cross(t1).normalize();
    const w = rr(.45, .7), h = rr(.3, .45), ph = rnd() * 6;
    for (let layer = 0; layer < 2; layer++) {
      const pg = new THREE.PlaneGeometry(1, 1, 40, 24); const pa = pg.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const u = pa.getX(i) * w * 2, v = pa.getY(i) * h * 2;
        const d = c.clone().addScaledVector(t1, u).addScaledVector(t2, v).normalize();
        const rad = nR * (1.22 + layer * .13) + .045 * Math.sin(u * 22 + ph) + .03 * Math.sin(v * 17 + ph * 2);
        pa.setXYZ(i, d.x * rad, d.y * rad, d.z * rad);
        if (layer === 1 && rnd() < .015) dotsPos.push(d.clone().multiplyScalar(rad + .02));
      }
      pg.computeVertexNormals(); g.add(new THREE.Mesh(pg, m));
    }
  }
  const rm = mat(0x1a2a6a); if (clip) cut(rm);
  const rib = new THREE.InstancedMesh(new THREE.SphereGeometry(.022, 6, 5), rm, dotsPos.length);
  const o = new THREE.Object3D(); dotsPos.forEach((p, i) => { o.position.copy(p); o.updateMatrix(); rib.setMatrixAt(i, o.matrix); }); g.add(rib);
  return g;
}

/* =============================================================== */
/*                        GENERIC CELL                            */
/* =============================================================== */
function organelleScene(type) {
  seed(77);
  const group = new THREE.Group(), labels = [], upd = [];
  const R = 3.2;
  const tintMap = { muscle: 0xff9aa5, cardiac: 0xff8a95, bone: 0xdcd0ff, liver: 0xffc59a, neuron: 0x9ab2ff, blood: 0xffb0b0, lung: 0xffc0d0, epithelium: 0xbfe0ff };
  const tint = tintMap[type] || 0x9fd0ff;
  const mem = glass(tint, .2, { emissive: tint, emissiveIntensity: .12 }); cut(mem);
  group.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), mem));
  const cyto = glass(tint, .05); cut(cyto);
  group.add(new THREE.Mesh(new THREE.SphereGeometry(R * .985, 40, 30), cyto));
  // phospholipid hint: tiny beads on surface
  const bead = new THREE.InstancedMesh(new THREE.SphereGeometry(.028, 6, 5), cut(mat(0xe4f2ff, { emissive: 0x3a5a88, emissiveIntensity: .5 })), 650);
  { const o = new THREE.Object3D(); for (let i = 0; i < 650; i++) { o.position.copy(randDir()).multiplyScalar(R * 1.005); o.updateMatrix(); bead.setMatrixAt(i, o.matrix); } group.add(bead); }

  const nuc = nucleus(1.15, true); nuc.position.set(-.1, 0, 0); group.add(nuc);
  const er = erSheets(1.15, true); er.position.copy(nuc.position); group.add(er);

  const mitoCount = { muscle: 16, cardiac: 24, liver: 16 }[type] || 9;
  const mitos = [];
  for (let i = 0; i < mitoCount; i++) {
    let p; let t = 0; do { p = randDir().multiplyScalar(rr(1.9, 2.8)); } while (inOct(p) && t++ < 30);
    const m = mitochondrion(rr(.5, .8), .17); m.position.copy(p); m.quaternion.setFromUnitVectors(V(1, 0, 0), randDir()); group.add(m); mitos.push(m);
  }
  // golgi
  const gg = golgi(.55); gg.position.set(1.3, -1.45, 1.2); gg.rotation.set(.3, .6, -.2); group.add(gg);
  // lysosomes / vesicles
  const lyM = mat(0x6fd86f, { emissive: 0x1b5a1b, emissiveIntensity: .5 }); cut(lyM);
  const lys = []; for (let i = 0; i < 7; i++) { let p; let t = 0; do { p = randDir().multiplyScalar(rr(1.9, 2.8)); } while (inOct(p) && t++ < 30); const l = sph(.13, lyM, p, null, 14); group.add(l); lys.push(l);
    const dm = mat(0x1c3d1c); cut(dm); for (let k = 0; k < 4; k++) l.add(sph(.025, dm, randDir().multiplyScalar(.06), null, 6)); }
  const veM = glass(0xfff0c0, .75); cut(veM);
  for (let i = 0; i < 24; i++) { let p; let t = 0; do { p = randDir().multiplyScalar(rr(1.6, 2.9)); } while (inOct(p) && t++ < 30); group.add(sph(.05, veM, p, null, 8)); }
  // centrioles + microtubules
  const cen = new THREE.Group(); const cm = mat(0xffe066, { emissive: 0x5a4a00, emissiveIntensity: .5 });
  const c1 = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .32, 12), cm); const c2 = c1.clone(); c2.rotation.z = Math.PI / 2; c2.position.set(.15, -.2, 0); cen.add(c1, c2);
  cen.position.set(1.0, -.6, -1.5); group.add(cen);
  const mt = glow(0xf5ff7a, .5);
  for (let i = 0; i < 16; i++) {
    const end = randDir().multiplyScalar(R * .94); if (inOct(end)) { i--; continue; }
    const mid = cen.position.clone().lerp(end, .5).add(randDir().multiplyScalar(.35));
    group.add(tub([cen.position.clone(), mid, end], .012, cut(mt.clone()), 20, 5));
  }
  // smooth ER tubules
  const ser = glass(0x66e0c8, .55); cut(ser);
  for (let i = 0; i < 6; i++) { let p = randDir().multiplyScalar(2.0); const pts = [p.clone()]; for (let k = 0; k < 6; k++) { p = p.clone().add(randDir().multiplyScalar(.35)); pts.push(p.clone()); } group.add(tub(pts, .03, ser, 24, 6)); }

  // labels (clear of the cut-away octant)
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-.9, .9, .3), 'Nucleus', 'The control centre. Holds ~2 m of DNA wound around histones into chromatin. Surrounded by a double membrane studded with nuclear pores.');
  L(V(-.1, -.12, .5), 'Nucleolus', 'A dense region inside the nucleus where ribosomal RNA is made and ribosome subunits are assembled.');
  L(V(-.9, -1.0, 1.7), 'Rough ER', 'Folded membrane sheets covered in ribosomes. Proteins for export or membranes are made here and folded.');
  L(V(1.3, -1.15, 1.2), 'Golgi apparatus', 'Stacked cisternae that modify, sort and package proteins and lipids into vesicles for delivery.');
  L(mitos[0].position.clone(), 'Mitochondrion', 'The power plant. Folded inner membranes (cristae) host the electron-transport chain that makes most of the cell\'s ATP.');
  L(lys[0].position.clone(), 'Lysosome', 'An acid-filled recycling sac containing ~50 digestive enzymes that break down worn-out parts and invaders.');
  L(cen.position.clone().add(V(0, .3, 0)), 'Centrioles', 'A perpendicular pair of microtubule cylinders that organise the cytoskeleton and the spindle during division.');
  L(V(-2.8, .5, 1.3), 'Plasma membrane', 'A phospholipid bilayer ~7 nm thick. Controls what enters and leaves with channels, pumps and receptors.');
  L(V(-2.0, -1.2, -1.4), 'Smooth ER / cytoskeleton', 'Smooth ER makes lipids and stores calcium; microtubules form tracks along which motors haul cargo.');
  const mitoT = type;
  upd.push((t) => { mitos.forEach((m, i) => { m.position.y += Math.sin(t * .6 + i) * .0007; }); gg.rotation.y = .6 + Math.sin(t * .3) * .1; });
  const dd = dust(180, 14); group.add(dd.obj); upd.push(dd.update);
  return { group, labels, update: (t, dt) => upd.forEach(f => f(t, dt)), cam: { pos: V(6.4, 4.4, 7.4), target: V(0, 0, 0) } };
}

/* =============================================================== */
/*                          MUSCLE                                  */
/* =============================================================== */
function muscleTissue() {
  seed(5);
  const group = new THREE.Group(), labels = [], upd = [];
  const sT = sarcTex(34), side = mat(0xffffff, { map: sT, roughness: .45 });
  const capT = dotsTex(); const capM = mat(0xffffff, { map: capT, roughness: .6 });
  const nm = mat(0x5b3f9a, { emissive: 0x2a1a55, emissiveIntensity: .4 });
  const sp = 1.0; const cells = [];
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) { if (Math.abs(q + r) > 3) continue; cells.push([q, r]); }
  const len = 9;
  cells.forEach(([q, r], i) => {
    const x = sp * (q + r / 2), y = sp * r * .866; const rad = rr(.43, .48); const L = len + rr(-.4, .4), z0 = rr(-.3, .5);
    const g = new THREE.CylinderGeometry(rad, rad, L, 28, 1, false); g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, [side, capM, capM]); m.position.set(x, y, z0); group.add(m);
    if (rnd() < .5) { const a = rnd() * TAU; const n = sph(1, nm, V(x + Math.cos(a) * rad * .96, y + Math.sin(a) * rad * .96, z0 + rr(-3, 2.5)), [.07, .07, .48], 10); n.rotation.z = a; group.add(n); }
  });
  const capM2 = mat(0xff4a5a, { emissive: 0x6a0a14, emissiveIntensity: .5, roughness: .3 });
  [[0, 0], [1, 1], [-1, 0], [2, -1], [-2, 2], [1, -2]].forEach(([q, r]) => {
    const x = sp * (q + r / 2) + .5, y = sp * r * .866 + .29; group.add(tub([V(x, y, -4.7), V(x, y, 4.7)], .07, capM2, 12, 8));
  });
  const wrap = glass(0xf4e7e0, .1); const sheath = new THREE.Mesh(new THREE.CylinderGeometry(3.75, 3.75, len + .5, 48, 1, true), wrap); sheath.rotation.x = Math.PI / 2; group.add(sheath);
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(.4, 3.9, 1.0), 'Muscle fibre = one cell', 'Each fibre is a single giant cell, 10–100 µm wide and up to ~30 cm long, formed by hundreds of fused precursor cells.');
  L(V(-.6, -.9, 4.7), 'Myofibril cross-sections', 'Looking down the end of the fibre: every dot is a thick-and-thin filament bundle (myofibril) in a hexagonal lattice.');
  L(V(3.3, .5, 2.6), 'Nuclei at the edge', 'Skeletal fibres are multinucleate. Hundreds of nuclei are pushed to the periphery by the contractile machinery.');
  L(V(1.5, .56, 4.7), 'Capillary', 'Each fibre touches several capillaries delivering oxygen and glucose; hard-working muscle has more.');
  L(V(-3.7, -1.8, 2.5), 'Perimysium (sheath)', 'Connective tissue wrapping a bundle (fascicle) of fibres. Tendon is the continuation of these wraps.');
  group.add(dust(160, 16).obj);
  return { group, labels, update: () => { }, cam: { pos: V(6.5, 5.5, 11), target: V(0, .5, 0) } };
}
function cutFibre({ len = 8, R = 1.35, nuc = 'edge', mitoN = 40, nFib = 1, branch = false }) {
  seed(21);
  const group = new THREE.Group(), labels = [], upd = [];
  const sT = sarcTex(len * 3.3), fm = mat(0xffffff, { map: sT, roughness: .4 });
  const capM = mat(0xffffff, { map: dotsTex(), roughness: .6 });
  const nucPos = nuc === 'center' ? [V(0, 0, 0)] : [V(-2.5, R * .86, .5), V(.5, -R * .78, .6), V(2.8, R * .5, -.3)];
  const spacing = .245, fr = .108;
  for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
    const y = b * spacing * .866, z = a * spacing + (b % 2) * spacing / 2; if (Math.hypot(y, z) > R * .86) continue;
    if (nuc === 'center' && Math.hypot(y, z) < .5 && Math.abs(0) < 1) continue;
    const g = new THREE.CylinderGeometry(fr, fr, len, 12, 1, false); g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, [fm, capM, capM]); m.position.set(0, y, z); group.add(m);
  }
  // sarcolemma, open toward camera
  const sl = glass(0xff8a8a, .2, { emissive: 0x551010, emissiveIntensity: .25 }); sl.clippingPlanes = [new THREE.Plane(V(0, 0, -1), -.2)];
  const sg = new THREE.CylinderGeometry(R, R, len, 48, 1, true); sg.rotateZ(Math.PI / 2); group.add(new THREE.Mesh(sg, sl));
  // mitochondria between fibrils
  for (let i = 0; i < mitoN; i++) {
    const a = rnd() * TAU, rad = R * rr(.55, .93); const m = mitochondrion(rr(.35, .55), .075);
    m.position.set(rr(-len / 2 + .5, len / 2 - .5), Math.sin(a) * rad, Math.cos(a) * rad); m.rotation.x = rr(-.2, .2); group.add(m);
  }
  const nm = mat(0x6a4cc0, { emissive: 0x2a1a66, emissiveIntensity: .4, roughness: .4 });
  nucPos.forEach(p => {
    const n = sph(1, nm, p, nuc === 'center' ? [.85, .5, .5] : [.85, .2, .22], 20); if (nuc !== 'center') n.lookAt(0, 0, 0); group.add(n);
    const nu = sph(.1, mat(0xffa060), p.clone().add(V(0, 0, nuc === 'center' ? .3 : 0)), null, 10); group.add(nu);
  });
  // sarcoplasmic reticulum / t-tubule rings
  const ring = mat(0x39d6c8, { emissive: 0x0b5a54, emissiveIntensity: .5 });
  for (let i = -4; i <= 4; i++) { const t = new THREE.TorusGeometry(R * .9, .012, 6, 40); t.rotateY(Math.PI / 2); const m = new THREE.Mesh(t, ring); m.position.x = i * (len / 9) + .1; group.add(m); }
  // end cap
  const ec = new THREE.Mesh(new THREE.CircleGeometry(R * .9, 40), capM); ec.rotation.y = Math.PI / 2; ec.position.x = len / 2 + .005; group.add(ec);
  group.add(dust(140, 16).obj);
  return { group, labels };
}
function muscleCell() {
  const { group, labels } = cutFibre({ len: 8, R: 1.35, nuc: 'edge', mitoN: 46 });
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-2.0, 1.05, 1.1), 'Myofibril', 'A rod-like bundle of contractile filaments, ~1 µm across, that runs the full length of the cell. Hundreds fill each fibre.');
  L(V(-3.5, 0, .9), 'Sarcomere (Z-disc to Z-disc)', 'The contractile unit (~2.5 µm). Thin actin and thick myosin filaments slide past each other, shortening it. Dark A bands and light I bands give the striped look.');
  L(V(-2.5, 1.35, .5), 'Nucleus (periphery)', 'Multiple flattened nuclei hug the inner membrane to leave room for contractile proteins.');
  L(V(2.2, -.75, 1.1), 'Mitochondria', 'Packed between myofibrils to supply ATP for the myosin heads. Endurance training greatly increases their number.');
  L(V(.2, 1.3, 1.5), 'Sarcolemma (cell membrane)', 'The plasma membrane (shown peeled back). Its T-tubules dive inward to spread the contraction signal.');
  L(V(1.4, 1.25, 0), 'T-tubule / SR', 'The sarcoplasmic reticulum stores calcium. When released, Ca²⁺ lets actin and myosin bind and the fibre contracts.');
  return { group, labels, update: () => { }, cam: { pos: V(2, 4.5, 10), target: V(0, 0, 0) } };
}

/* =============================================================== */
/*                           BONE                                   */
/* =============================================================== */
function boneTissue() {
  seed(9);
  const group = new THREE.Group(), labels = [];
  const slabTop = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#d6c7a2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(150,125,85,${.1 + rnd() * .12})`; g.lineWidth = 2; g.beginPath(); const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 120; g.arc(x, y, r, rnd() * TAU, rnd() * TAU + 1.5); g.stroke(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(70,50,35,.75)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6, 3, rnd() * 3, 0, TAU); g.fill(); }
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 10), [mat(0xcdbd96), mat(0xcdbd96), mat(0xffffff, { map: slabTop, roughness: .85 }), mat(0xbfae88), mat(0xcdbd96), mat(0xcdbd96)]);
  slab.position.y = -.6; group.add(slab);
  const ringTex = (n) => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d8c9a4'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2; const rings = 7;
    for (let k = rings; k >= 1; k--) { g.fillStyle = k % 2 ? '#e8dcbc' : '#c8b78c'; g.beginPath(); g.arc(cx, cy, 40 + k * (cx - 44) / rings, 0, TAU); g.fill(); }
    for (let k = 1; k <= rings; k++) { const R0 = 40 + (k - .5) * (cx - 44) / rings; const cnt = 4 + k * 3; for (let i = 0; i < cnt; i++) { const a = i / cnt * TAU + k; const x = cx + Math.cos(a) * R0, y = cy + Math.sin(a) * R0; g.fillStyle = '#3d2a22'; g.beginPath(); g.ellipse(x, y, 7, 3.6, a + Math.PI / 2, 0, TAU); g.fill(); g.strokeStyle = 'rgba(60,40,30,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(cx + Math.cos(a) * (R0 - 24), cy + Math.sin(a) * (R0 - 24)); g.moveTo(x, y); g.lineTo(cx + Math.cos(a) * (R0 + 24), cy + Math.sin(a) * (R0 + 24)); g.stroke(); } }
    g.fillStyle = '#7c1626'; g.beginPath(); g.arc(cx, cy, 34, 0, TAU); g.fill(); g.fillStyle = '#ff6a78'; g.beginPath(); g.arc(cx - 6, cy - 6, 12, 0, TAU); g.fill();
  });
  const sideTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#d4c49c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(110,90,55,${.15 + rnd() * .2})`; g.fillRect(rnd() * w, 0, 1 + rnd() * 2, h); } }, [3, 1]);
  const pos = [[-4.2, -1.6, 1.6], [-.2, -2.6, 1.5], [3.8, -.8, 1.4], [-3.0, 2.2, 1.3], [1.3, 1.7, 1.45], [4.4, 3.0, 1.0], [-5.4, .2, .9]];
  const vm = mat(0xff4a5a, { emissive: 0x7a0a18, emissiveIntensity: .5, roughness: .3 });
  pos.forEach(([x, z, r], i) => {
    const h = 3; const tx = ringTex(); const g = new THREE.CylinderGeometry(r, r, h, 40);
    const m = new THREE.Mesh(g, [mat(0xffffff, { map: sideTex, roughness: .8 }), mat(0xffffff, { map: tx, roughness: .7 }), mat(0xc8b78c)]);
    m.position.set(x, .95 + (i % 3) * .08, z); group.add(m);
    const cl = tub([V(x, .95 + h / 2, z), V(x + rr(-.2, .2), 3.4 + (i % 2) * .4, z + rr(-.3, .3)), V(x + rr(.4, 1), 4.2, z + rr(-.6, .6))], .1 * r, vm, 20, 8); group.add(cl);
  });
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-4.2, 2.4, 1.6), 'Osteon (Haversian system)', 'The basic unit of compact bone: ~20 concentric lamellae of mineralised collagen wrapped around a central canal, like tree rings.');
  L(V(-.2, 3.0, 1.5), 'Haversian canal', 'Central channel holding a blood vessel and nerve that feed the osteocytes, strong yet living tissue.');
  L(V(-3.0, 4.4, 1.3), 'Blood vessel', 'Vessels run along the canals and link through transverse Volkmann canals to the marrow cavity.');
  L(V(1.3, 1.4, 4.0), 'Lamellae', 'Layers of collagen fibres arranged at alternating angles, a plywood design that resists twisting and bending.');
  L(V(1.9, .1, 5.0), 'Osteocytes in lacunae', 'The dark spots are osteocytes: mature bone cells living in tiny chambers and linked by canaliculi that pass nutrients and mechanical signals.');
  group.add(dust(140, 20, 0xffe9b0).obj);
  return { group, labels, update: () => { }, cam: { pos: V(9, 10.5, 15), target: V(0, 1, 0) } };
}
function boneCell() {
  seed(33);
  const group = new THREE.Group(), labels = [], upd = [];
  // matrix lamellae layers (concentric cylinders)
  const bm = glass(0xe6d7b2, .09);
  for (let i = 0; i < 4; i++) { const g = new THREE.CylinderGeometry(4 + i * .8, 4 + i * .8, 10, 48, 1, true); g.rotateX(Math.PI / 2); group.add(new THREE.Mesh(g, glass(i % 2 ? 0xe9dcc0 : 0xcdb98c, .05 + i * .015))); }
  // lacuna
  const lac = glass(0xb7a37c, .22, { emissive: 0x3a2a10, emissiveIntensity: .3 });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1.35, 40, 30).scale(1, .75, .9), lac));
  // cell body
  const cm = glass(0xc58bff, .55, { emissive: 0x3a1a66, emissiveIntensity: .5, roughness: .3 });
  const body = new THREE.SphereGeometry(1.12, 40, 30); body.scale(1, .72, .82); group.add(new THREE.Mesh(body, cm));
  const nu = mat(0x5a35b0, { emissive: 0x24104a, emissiveIntensity: .5 }); group.add(sph(.55, nu, V(.1, 0, 0), [1.25, .85, .85], 24));
  group.add(sph(.15, mat(0xffa060, { emissive: 0x6a2a00, emissiveIntensity: .5 }), V(.15, 0, .26), null, 12));
  group.add(mitochondrion(.3, .08)); group.children[group.children.length - 1].position.set(-.7, .2, .25);
  // canaliculi: branching processes
  const pm = glass(0xe0b6ff, .6, { emissive: 0x4a2a77, emissiveIntensity: .5 });
  const branch = (p, d, len, r, depth, geos) => {
    const mid = p.clone().addScaledVector(d, len * .5).add(randDir().multiplyScalar(len * .12)); const q = p.clone().addScaledVector(d, len);
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, mid, q]), 12, r, 6, false));
    if (depth > 0) { const n = 2; for (let k = 0; k < n; k++) branch(q, d.clone().add(randDir().multiplyScalar(.7)).normalize(), len * .7, r * .7, depth - 1, geos); }
  };
  const geos = []; for (let i = 0; i < 18; i++) { const d = randDir(); const p0 = d.clone().multiplyScalar(1.0); p0.y *= .7; branch(p0, d, 1.7, .055, 2, geos); }
  group.add(new THREE.Mesh(mergeGeometries(geos), pm));
  // neighbouring osteocytes as ghosts
  [[-6, 1, -2], [6, -1, 1], [0, 4, -4], [-1, -4.5, 2]].forEach(p => { const g = sph(.8, glass(0xc58bff, .22), V(...p), [1, .7, .85], 20); group.add(g); });
  // blood vessel
  group.add(tub([V(-9, -5, -3), V(-3, -5.5, -3.5), V(4, -5, -3), V(10, -5.4, -3)], .45, glass(0xff6070, .35, { emissive: 0x551010, emissiveIntensity: .3 }), 40, 14));
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(.2, .2, .9), 'Osteocyte', 'The most abundant bone cell (>90%). Trapped in the mineral it built, it senses mechanical load and directs bone remodelling.');
  L(V(.1, -.1, -.1), 'Nucleus', 'Contains the cell\'s DNA. Osteocytes live for decades, sometimes 25+ years.');
  L(V(-1.3, 1.0, 1.0), 'Lacuna', 'The tiny fluid-filled chamber (~20 µm) that holds the osteocyte inside mineralised matrix.');
  L(V(2.4, 1.0, 1.0), 'Canaliculi (processes)', 'Hundreds of thin channels carry the cell\'s processes to neighbours, linking osteocytes into a sensing network through gap junctions.');
  L(V(-5.2, -2.8, -2), 'Lamellae', 'Concentric layers of collagen and hydroxyapatite crystals that give bone both toughness and stiffness.');
  L(V(-1.8, -4.6, -3.2), 'Blood vessel', 'Feeds the network. No osteocyte sits more than ~0.2 mm from a blood supply.');
  upd.push(t => { group.children[5] && 0; });
  group.add(dust(120, 16, 0xe9d3ff).obj);
  return { group, labels, update: () => { }, cam: { pos: V(2, 3, 7.5), target: V(0, 0, 0) } };
}

/* =============================================================== */
/*                           LIVER                                  */
/* =============================================================== */
function liverTissue() {
  seed(14);
  const group = new THREE.Group(), labels = [];
  const hexR = 3.6;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(hexR, hexR, .3, 6), glass(0x8a2030, .45, { emissive: 0x2a0408, emissiveIntensity: .5 })); floor.rotation.y = Math.PI / 6; floor.position.y = -.15; group.add(floor);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(hexR, hexR, 2.2, 6)), new THREE.LineBasicMaterial({ color: 0xffb0a0, transparent: true, opacity: .45 })); edge.rotation.y = Math.PI / 6; edge.position.y = .85; group.add(edge);
  const cv = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 2.4, 24, 1, true), glass(0x7a6cff, .5, { emissive: 0x241a77, emissiveIntensity: .6 })); cv.position.y = .9; group.add(cv);
  const cellG = new THREE.DodecahedronGeometry(1, 0);
  const cm = new THREE.MeshStandardMaterial({ color: 0xd99a74, roughness: .55, flatShading: true });
  const N = 20 * 8 * 2; const cells = new THREE.InstancedMesh(cellG, cm, N); const nuc = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat(0x5a35a0, { emissive: 0x24104a, emissiveIntensity: .4 }), N);
  const o = new THREE.Object3D(); let idx = 0;
  const col = new THREE.Color();
  for (let k = 0; k < 20; k++) {
    const a = k / 20 * TAU; for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 8; i++) {
        const r = .75 + i * .34; const s = rr(.15, .19);
        if (r > hexR * .87 * (1 / Math.cos(((a % (Math.PI / 3)) - Math.PI / 6)) ) * .88) continue;
        o.position.set(Math.cos(a) * r, .3 + layer * .36, Math.sin(a) * r); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); o.scale.set(s * 1.1, s, s); o.updateMatrix(); cells.setMatrixAt(idx, o.matrix);
        col.setHSL(.07 + rr(-.015, .015), .5, .6 + rr(-.06, .06)); cells.setColorAt(idx, col);
        o.position.y += .08; o.position.x += Math.cos(a) * .0; o.scale.setScalar(s * .5); o.updateMatrix(); nuc.setMatrixAt(idx, o.matrix); idx++;
      }
    }
  }
  cells.count = idx; nuc.count = idx; group.add(cells, nuc);
  const sm = glass(0xff4a5a, .5, { emissive: 0x6a0a14, emissiveIntensity: .5 });
  for (let k = 0; k < 20; k++) { const a = (k + .5) / 20 * TAU; const g = tub([V(Math.cos(a) * 3.1, .52, Math.sin(a) * 3.1), V(Math.cos(a) * .4, .52, Math.sin(a) * .4)], .05, sm, 8, 6); group.add(g); }
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU; const x = Math.cos(a) * hexR * .96, z = Math.sin(a) * hexR * .96;
    const trio = [[0x5a6cff, .16, [0, 0]], [0xff4a4a, .09, [.22, .1]], [0x6fd86f, .1, [-.2, .18]]];
    trio.forEach(([c, r, [dx, dz]]) => group.add(place(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.5, 14), glass(c, .75, { emissive: c, emissiveIntensity: .25 })), { position: V(x + dx, .75, z + dz) })));
  }
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(0, 2.3, 0), 'Central vein', 'Collects blood after it has passed the hepatocytes and drains it to the hepatic vein and then the heart.');
  L(V(-3.0, 1.9, -1.8), 'Portal triad', 'At each corner of the lobule: a portal vein branch (nutrient-rich blood from the gut), a hepatic artery branch (oxygen) and a bile duct (green).');
  L(V(1.6, 1.0, 1.1), 'Hepatocyte cords', 'Plates one to two cells thick radiate from centre to edge. Hepatocytes (80% of liver cells) do almost all the metabolic work.');
  L(V(1.2, .75, 2.2), 'Sinusoid', 'Leaky capillaries between the cords let blood plasma bathe the hepatocytes directly, so large molecules like albumin are exchanged.');
  L(V(3.6, .3, 0), 'Lobule (hexagon)', 'The liver is built of ~1 million hexagonal lobules about 1–2 mm wide. Blood flows from the corners to the centre.');
  group.add(dust(160, 16, 0xffc6aa).obj);
  return { group, labels, update: () => { }, cam: { pos: V(2.5, 7.5, 7.5), target: V(0, .3, 0) } };
}
function liverCell() {
  seed(40);
  const group = new THREE.Group(), labels = [], upd = [];
  const poly = new THREE.IcosahedronGeometry(2.7, 1);
  const pm = new THREE.MeshStandardMaterial({ color: 0xe8a77e, transparent: true, opacity: .22, roughness: .3, flatShading: true, side: THREE.DoubleSide, depthWrite: false }); cut(pm);
  group.add(new THREE.Mesh(poly, pm));
  const em = new THREE.LineBasicMaterial({ color: 0xffd0b0, transparent: true, opacity: .55 }); em.clippingPlanes = CUT; em.clipIntersection = true;
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(poly), em));
  const nA = nucleus(.95, true, 0x7f6cff); nA.position.set(-.8, .1, -.3); group.add(nA);
  const nB = nucleus(.7, true, 0x8a7cff); nB.position.set(1.0, -.5, -.9); group.add(nB);
  const er = erSheets(.95, true); er.position.copy(nA.position); group.add(er);
  const mitos = []; for (let i = 0; i < 18; i++) { let p, t = 0; do { p = randDir().multiplyScalar(rr(1.4, 2.4)); } while ((inOct(p) || p.distanceTo(nA.position) < 1.5 || p.distanceTo(nB.position) < 1.1) && t++ < 50); const m = mitochondrion(rr(.5, .8), .17); m.position.copy(p); m.quaternion.setFromUnitVectors(V(1, 0, 0), randDir()); group.add(m); mitos.push(m); }
  const gm = mat(0xfff1c0, { emissive: 0x6a5a30, emissiveIntensity: .5 }); cut(gm);
  const gly = new THREE.InstancedMesh(new THREE.SphereGeometry(.045, 8, 6), gm, 520); { const o = new THREE.Object3D(); let n = 0; for (let c = 0; c < 6; c++) { let ctr, t = 0; do { ctr = randDir().multiplyScalar(rr(1.2, 2.1)); } while (inOct(ctr) && t++ < 40); for (let i = 0; i < 86; i++) { o.position.copy(ctr).add(randDir().multiplyScalar(rnd() * .32)); o.updateMatrix(); gly.setMatrixAt(n++, o.matrix); } } group.add(gly); }
  const lip = glass(0xfff3a8, .6); cut(lip);
  [[0, -1.9, 1.3, .38], [-1.5, -1.0, 1.7, .3], [.2, 1.5, -1.6, .34], [1.9, .5, -1.0, .28]].forEach(([x, y, z, r]) => group.add(sph(r, lip, V(x, y, z), null, 18)));
  const gg = golgi(.5); gg.position.set(1.0, -1.7, .9); gg.rotation.set(.3, .6, -.2); group.add(gg);
  // bile canaliculus (green) along one face + sinusoidal microvilli face
  const bile = glass(0x58e06a, .6, { emissive: 0x0a4a14, emissiveIntensity: .6 });
  group.add(tub([V(-2.5, -1.2, 1.1), V(-1.9, -1.5, 1.8), V(-.9, -2.0, 1.9), V(.4, -2.4, 1.2)], .1, bile, 30, 8));
  const mv = new THREE.InstancedMesh(new THREE.CylinderGeometry(.012, .012, .26, 5), mat(0xffcba0), 420); { const o = new THREE.Object3D(); for (let i = 0; i < 420; i++) { const p = V(-2.65 + rnd() * .1, rr(-1.2, 1.2), rr(-1.6, 1.6)); o.position.copy(p); o.rotation.set(0, 0, Math.PI / 2 + rr(-.3, .3)); o.updateMatrix(); mv.setMatrixAt(i, o.matrix); } group.add(mv); }
  group.add(place(new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 5.5, 20, 1, true), glass(0xff4a5a, .3, { emissive: 0x6a0a14, emissiveIntensity: .35 })), { position: V(-3.6, 0, .3), rotation: new THREE.Euler(0, 0, 0) }));
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-.8, 1.0, 0), 'Nucleus (often two)', 'Roughly 25% of hepatocytes are binucleate. Some are polyploid, giving the liver extra capacity to regenerate.');
  L(V(-1.2, -1.3, 1.5), 'Rough ER', 'Makes the plasma proteins the liver secretes: albumin, clotting factors and many more.');
  L(V(.2, 1.5, -1.6), 'Lipid droplet', 'Stores fat. Excess storage is what builds up in fatty liver disease.');
  L(mitos[0].position.clone(), 'Mitochondria', 'A hepatocyte has ~1,000–2,000 of them. They burn fatty acids and handle the urea cycle that detoxifies ammonia.');
  L(V(-1.0, -2.2, 1.5), 'Bile canaliculus', 'A tiny channel between neighbouring hepatocytes into which bile is secreted, flowing opposite to the blood.');
  L(V(-2.8, 1.5, 1.0), 'Sinusoid face', 'The microvilli-covered side bathed in blood; nutrients and toxins are taken up here.');
  L(V(1.6, -.1, 1.3), 'Glycogen granules', 'Glucose stored as rosettes of glycogen, released to keep blood sugar steady between meals.');
  upd.push(t => { mitos.forEach((m, i) => { m.position.y += Math.sin(t * .6 + i) * .0007; }); });
  group.add(dust(160, 16, 0xffc6aa).obj);
  return { group, labels, update: (t) => upd.forEach(f => f(t)), cam: { pos: V(6.5, 4.5, 7.5), target: V(0, 0, 0) } };
}

/* =============================================================== */
/*                          NEURONS                                 */
/* =============================================================== */
function neuronGeo(origin, scale, depthD, geos, outCurves) {
  const nd = 5 + Math.floor(rnd() * 3);
  const branch = (p, d, len, r, depth) => {
    const mid = p.clone().addScaledVector(d, len * .5).add(randDir().multiplyScalar(len * .12)); const q = p.clone().addScaledVector(d, len);
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, mid, q]), 8, r, 6, false)); geos.push(new THREE.SphereGeometry(r * 1.05, 6, 5).translate(q.x, q.y, q.z));
    if (depth > 0) { const n = rnd() < .35 ? 3 : 2; for (let k = 0; k < n; k++) branch(q, d.clone().add(randDir().multiplyScalar(.9)).normalize(), len * .72, r * .72, depth - 1); }
  };
  for (let i = 0; i < nd; i++) { const d = randDir(); d.y = Math.abs(d.y) * .6 + .1; d.normalize(); branch(origin.clone().addScaledVector(d, .3 * scale), d, 1.1 * scale, .05 * scale, depthD); }
  const soma = new THREE.SphereGeometry(.34 * scale, 14, 10).translate(origin.x, origin.y, origin.z); geos.push(soma);
}
function neuronTissue() {
  seed(101);
  const group = new THREE.Group(), labels = [], pulses = [];
  const nm = glow(0x6f7dff, .5, { transparent: true, opacity: .92 }); const am = glow(0x9ad7ff, .6);
  const somas = [];
  for (let i = 0; i < 12; i++) {
    const o = V(rr(-5, 5), rr(-2.5, 2.5), rr(-3, 3)); somas.push(o);
    const geos = []; neuronGeo(o, 1, 3, geos); group.add(new THREE.Mesh(mergeGeometries(geos), nm));
  }
  // axons
  for (let i = 0; i < somas.length; i++) {
    const a = somas[i], b = somas[(i + 3 + Math.floor(rnd() * 5)) % somas.length];
    const c = new THREE.CatmullRomCurve3([a.clone(), a.clone().lerp(b, .35).add(randDir().multiplyScalar(1.2)), a.clone().lerp(b, .7).add(randDir().multiplyScalar(1.2)), b.clone()]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 40, .035, 6, false), am));
    const p = sph(.1, glow(0xffffff, 2), null, null, 10); group.add(p); pulses.push({ p, c, s: rr(.06, .14), o: rnd() });
  }
  // glia
  const gm = glow(0x59e0a8, .25, { transparent: true, opacity: .8 });
  for (let i = 0; i < 7; i++) { const o = V(rr(-5, 5), rr(-3, 3), rr(-3, 3)); const geos = []; const nd = 6; for (let k = 0; k < nd; k++) { const d = randDir(); geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([o, o.clone().addScaledVector(d, .5), o.clone().addScaledVector(d, 1)]), 6, .04, 5, false)); } geos.push(new THREE.SphereGeometry(.2, 10, 8).translate(o.x, o.y, o.z)); group.add(new THREE.Mesh(mergeGeometries(geos), gm)); }
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(somas[0].clone().add(V(0, .6, 0)), 'Neuron cell body (soma)', 'Contains the nucleus and most organelles. The cortex alone holds ~16 billion neurons, each making thousands of connections.');
  L(somas[3].clone().add(V(.5, 1.2, 0)), 'Dendritic tree', 'Branching receivers that collect inputs from thousands of other neurons.');
  L(somas[5].clone().add(V(1.5, -.9, .5)), 'Axon', 'A single output cable carrying electrical impulses (action potentials), sometimes over a metre in length.');
  L(V(4.5, -2.6, 3), 'Astrocyte (glia)', 'A star-shaped support cell that feeds neurons, buffers ions and shapes the blood–brain barrier.');
  L(V(0, 3.4, 0), 'Impulse', 'Bright pulses show signals travelling along axons at up to 120 m/s.');
  group.add(dust(260, 18, 0x8aa0ff).obj);
  return { group, labels, update: (t, dt) => { pulses.forEach(q => { const u = (t * q.s + q.o) % 1; q.p.position.copy(q.c.getPointAt(u)); }); }, cam: { pos: V(0, 2, 15), target: V(0, 0, 0) } };
}
function neuronCell() {
  seed(55);
  const group = new THREE.Group(), labels = [], upd = [];
  const nm = glass(0x6f7dff, .65, { emissive: 0x2a3aaa, emissiveIntensity: .5, roughness: .3 });
  group.add(sph(1.25, nm, V(-4, 0, 0), null, 40));
  group.add(sph(.55, mat(0x2a2a88, { emissive: 0x14143a, emissiveIntensity: .5 }), V(-4.1, .05, 0), null, 24));
  group.add(sph(.14, mat(0xffa060, { emissive: 0x6a2a00, emissiveIntensity: .5 }), V(-4.1, .05, .45), null, 10));
  for (let i = 0; i < 8; i++) { const m = mitochondrion(.3, .06); m.position.copy(V(-4, 0, 0).add(randDir().multiplyScalar(rr(.7, 1.0)))); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); group.add(m); }
  const geos = []; const branch = (p, d, len, r, depth) => { const mid = p.clone().addScaledVector(d, len * .5).add(randDir().multiplyScalar(len * .12)); const q = p.clone().addScaledVector(d, len); geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, mid, q]), 10, r, 7, false)); geos.push(new THREE.SphereGeometry(r, 7, 6).translate(q.x, q.y, q.z)); if (depth > 0) for (let k = 0; k < 2; k++) branch(q, d.clone().add(randDir().multiplyScalar(.85)).normalize(), len * .75, r * .72, depth - 1); };
  for (let i = 0; i < 6; i++) { const d = V(rr(-1, -.1), rr(-.8, .8), rr(-.8, .8)).normalize(); branch(V(-4, 0, 0).addScaledVector(d, 1.1), d, 1.3, .17, 3); }
  group.add(new THREE.Mesh(mergeGeometries(geos), nm));
  const axonC = new THREE.CatmullRomCurve3([V(-2.8, 0, 0), V(-1.5, -.4, .3), V(1.0, .5, -.2), V(3.5, -.2, .1), V(5.5, .3, 0)]);
  group.add(place(new THREE.Mesh(new THREE.ConeGeometry(.5, 1.0, 20), nm), { position: V(-3.2, 0, 0), rotation: new THREE.Euler(0, 0, Math.PI / 2) }));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(axonC, 80, .09, 8, false), glow(0x9ad7ff, .5)));
  const my = glass(0xfff0c8, .9, { emissive: 0x8a6a30, emissiveIntensity: .35, roughness: .3 });
  const segs = 7; for (let i = 0; i < segs; i++) {
    const u0 = .12 + i * .115, u1 = u0 + .085; const a = axonC.getPointAt(u0), b = axonC.getPointAt(u1); const len = a.distanceTo(b);
    const g = new THREE.CapsuleGeometry(.24, len - .48, 8, 16); const m = new THREE.Mesh(g, my); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); group.add(m);
  }
  // terminal
  const end = axonC.getPointAt(1); const tgeo = []; for (let i = 0; i < 5; i++) { const d = V(1, rr(-.7, .7), rr(-.7, .7)).normalize(); const q = end.clone().addScaledVector(d, rr(.6, 1)); tgeo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([end, end.clone().addScaledVector(d, .4), q]), 8, .06, 6, false)); tgeo.push(new THREE.SphereGeometry(.21, 14, 10).translate(q.x, q.y, q.z)); }
  group.add(new THREE.Mesh(mergeGeometries(tgeo), nm));
  const vm = glow(0xffd36a, .8); const ves = new THREE.InstancedMesh(new THREE.SphereGeometry(.04, 6, 5), vm, 60); { const o = new THREE.Object3D(); for (let i = 0; i < 60; i++) { o.position.copy(end).add(V(rr(.5, 1.4), rr(-.5, .5), rr(-.4, .4))); o.updateMatrix(); ves.setMatrixAt(i, o.matrix); } group.add(ves); }
  // postsynaptic cell
  group.add(sph(1.1, glass(0x59e0a8, .35, { emissive: 0x0a4a30, emissiveIntensity: .4 }), V(8.0, -.2, 0), [1.2, 1, 1], 36));
  const pulse = sph(.2, glow(0xffffff, 3), null, null, 12); group.add(pulse);
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-4, 1.5, .4), 'Soma (cell body)', 'Integrates thousands of excitatory and inhibitory inputs. If the sum crosses a threshold (~ −55 mV) the neuron fires.');
  L(V(-5.3, 1.1, 1.0), 'Dendrites', 'Branches studded with tiny spines, each receiving a synapse. Learning physically reshapes these spines.');
  L(V(-3.1, .6, .4), 'Axon hillock', 'The trigger zone where the action potential is initiated.');
  L(V(.5, 1.0, 0), 'Myelin sheath', 'Fatty insulation made by oligodendrocytes (brain) or Schwann cells (nerves). It makes signals jump up to 100× faster.');
  L(axonC.getPointAt(.35 + .01).add(V(0, -.5, 0)), 'Node of Ranvier', 'Gaps between myelin segments where ion channels cluster, so the impulse leaps from node to node.');
  L(end.clone().add(V(.8, 1.0, 0)), 'Axon terminal & vesicles', 'Vesicles packed with neurotransmitter fuse with the membrane and release it across the ~20 nm synaptic cleft.');
  L(V(8, 1.4, 0), 'Postsynaptic cell', 'Receptors on the next cell bind the transmitter and open ion channels, passing the message on.');
  upd.push(t => { const u = (t * .12) % 1; if (u < .8) { pulse.visible = true; pulse.position.copy(axonC.getPointAt(Math.min(1, u / .8))); } else pulse.visible = false; });
  group.add(dust(220, 22, 0x8aa0ff).obj);
  return { group, labels, update: (t, dt) => upd.forEach(f => f(t, dt)), cam: { pos: V(2, 4, 19), target: V(1.5, 0, 0) } };
}

/* =============================================================== */
/*                           HEART                                  */
/* =============================================================== */
function cardiacTissue() {
  seed(61);
  const group = new THREE.Group(), labels = [];
  const sT = sarcTex(6, ['#f28d8d', '#c04650', '#d96a74']); const side = mat(0xffffff, { map: sT, roughness: .45 });
  const dm = mat(0x3a1020, { roughness: .6 }); const nm = mat(0x6a4cc0, { emissive: 0x2a1a66, emissiveIntensity: .4 });
  const nodes = [];
  for (let j = -3; j <= 3; j++) for (let k = -2; k <= 2; k++) {
    let x = -5.5 + rr(-.3, .3); const y = j * .72 + (k % 2) * .36, z = k * .75;
    while (x < 5.5) {
      const L = rr(1.9, 2.6); const r = rr(.27, .33); const g = new THREE.CylinderGeometry(r, r * .96, L, 14); g.rotateZ(Math.PI / 2);
      const tilt = rr(-.08, .08); const m = new THREE.Mesh(g, side); m.position.set(x + L / 2, y + Math.sin(x) * .06, z); m.rotation.z = tilt; group.add(m);
      if (rnd() < .6) group.add(sph(1, nm, V(x + L / 2, y + Math.sin(x) * .06, z + r * .6), [.5, .2, .2], 10));
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, .06, 14), dm); disc.rotation.z = Math.PI / 2; disc.position.set(x + L, y + Math.sin(x + L) * .06, z); group.add(disc);
      x += L + .03;
    }
  }
  const cap = mat(0xff4a5a, { emissive: 0x6a0a14, emissiveIntensity: .5 });
  [[0, 0], [1.3, .5], [-1.6, 1.0], [2, -1.2], [-2.2, -1.0]].forEach(([a, b]) => group.add(tub([V(-6.5, a, b + 1.6), V(0, a + .15, b + 1.7), V(6.5, a - .1, b + 1.6)], .09, cap, 20, 8)));
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-4.5, 2.7, 1.9), 'Cardiomyocyte', 'A heart muscle cell: 100 µm long, striated, usually with one central nucleus. About 2–3 billion of them beat in unison.');
  L(V(.6, -2.4, 1.9), 'Intercalated disc', 'The dark bars are specialised junctions. Desmosomes lock cells together and gap junctions pass the electrical signal so the heart contracts as one.');
  L(V(1.9, 2.5, 1.9), 'Nucleus', 'Unlike skeletal muscle, a cardiomyocyte typically has one (sometimes two) nuclei, near the centre.');
  L(V(-6.0, .3, 1.8), 'Capillary', 'The heart is dense with capillaries, roughly one per fibre; it extracts ~75% of the oxygen delivered.');
  group.add(dust(160, 18, 0xffa0b0).obj);
  return { group, labels, update: () => { }, cam: { pos: V(3, 4.5, 17), target: V(0, 0, .8) } };
}
function cardiacCell() {
  const { group, labels } = cutFibre({ len: 7, R: 1.15, nuc: 'center', mitoN: 90 });
  const dm = mat(0x2a0a18, { roughness: .6, emissive: 0x30101a, emissiveIntensity: .4 });
  const id = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .1, 30), dm); id.rotation.z = Math.PI / 2; id.position.x = -3.62; group.add(id);
  const id2 = id.clone(); id2.position.x = 3.62; group.add(id2);
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(0, .2, .9), 'Central nucleus', 'One large nucleus sits in the middle, surrounded by mitochondria and glycogen.');
  L(V(-1.8, .9, 1.2), 'Mitochondria (30–40% of volume)', 'The heart never rests, so mitochondria occupy about a third of the cell, far more than skeletal muscle, and supply ~6 kg of ATP a day.');
  L(V(-3.62, 1.3, 0), 'Intercalated disc', 'A folded end-plate with gap junctions and desmosomes that couples neighbours mechanically and electrically.');
  L(V(1.6, 1.1, 1.0), 'Myofibrils & sarcomeres', 'Striated bundles of actin and myosin, same machinery as skeletal muscle.');
  L(V(2.4, -1.0, .8), 'T-tubules / SR', 'Rings of membrane that bring the electrical signal inside, triggering Ca²⁺ release from the SR on every beat.');
  return { group, labels, update: () => { }, cam: { pos: V(2, 4.5, 9.5), target: V(0, 0, 0) } };
}

/* =============================================================== */
/*                           BLOOD                                  */
/* =============================================================== */
function rbcGeo() {
  const pts = []; const C0 = .2072, C1 = 2.0026, C2 = -1.1228; const N = 20;
  for (let i = 0; i <= N; i++) { const p = i / N; const z = .5 * Math.sqrt(Math.max(0, 1 - p * p)) * (C0 + C1 * p * p + C2 * p ** 4); pts.push(new THREE.Vector2(p, -z)); }
  for (let i = N - 1; i >= 0; i--) { const p = i / N; const z = .5 * Math.sqrt(Math.max(0, 1 - p * p)) * (C0 + C1 * p * p + C2 * p ** 4); pts.push(new THREE.Vector2(p, z)); }
  return new THREE.LatheGeometry(pts, 24);
}
function bloodTissue() {
  seed(81);
  const group = new THREE.Group(), labels = [], upd = [];
  const R = 2.5, Lh = 8;
  const vm = glass(0xff8d9a, .16, { emissive: 0x5a1020, emissiveIntensity: .3 }); vm.clippingPlanes = [new THREE.Plane(V(0, 0, -1), -.5)];
  const tg = new THREE.CylinderGeometry(R, R, Lh * 2, 48, 1, true); tg.rotateZ(Math.PI / 2); group.add(new THREE.Mesh(tg, vm));
  // endothelial cell outlines
  const endo = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, Lh * 2, 32, 10, true), new THREE.MeshBasicMaterial({ color: 0xffb0bc, wireframe: true, transparent: true, opacity: .12, clippingPlanes: vm.clippingPlanes })); endo.rotation.z = Math.PI / 2; group.add(endo);
  const N = 170; const rbc = new THREE.InstancedMesh(rbcGeo(), new THREE.MeshStandardMaterial({ color: 0xd8222f, roughness: .35, emissive: 0x4a0408, emissiveIntensity: .5, side: THREE.DoubleSide }), N);
  const st = []; for (let i = 0; i < N; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * (R - .5); st.push({ x: rr(-Lh, Lh), y: Math.sin(a) * r, z: Math.cos(a) * r, r, rot: V(rnd() * 3, rnd() * 3, rnd() * 3), sp: V(rr(-.8, .8), rr(-.8, .8), rr(-.8, .8)) }); }
  const o = new THREE.Object3D();
  const wbc = []; for (let i = 0; i < 3; i++) { const g = new THREE.IcosahedronGeometry(.62, 3); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const v = V(p.getX(k), p.getY(k), p.getZ(k)); v.multiplyScalar(1 + rr(-.03, .03)); p.setXYZ(k, v.x, v.y, v.z); } g.computeVertexNormals(); const m = new THREE.Mesh(g, glass(0xe8e0ff, .75, { emissive: 0x3a3a66, emissiveIntensity: .3 })); m.add(sph(.34, mat(0x5a35b0, { emissive: 0x24104a, emissiveIntensity: .5 }), V(0, 0, 0), [1, .8, .8], 16)); const s = { m, x: rr(-Lh, Lh), a: rnd() * TAU }; wbc.push(s); group.add(m); }
  const plt = new THREE.InstancedMesh(new THREE.SphereGeometry(.14, 10, 8), mat(0xc58bff, { emissive: 0x3a1a66, emissiveIntensity: .5 }), 40); const ps = []; for (let i = 0; i < 40; i++) ps.push({ x: rr(-Lh, Lh), y: rr(-R + .3, R - .3), z: rr(-R + .3, R - .3) });
  plt.geometry.scale(1, .5, 1); group.add(rbc, plt);
  upd.push((t, dt) => {
    st.forEach((s, i) => {
      const sp = (1 - (s.r / R) ** 2) * 1.6 + .3; s.x += sp * dt; if (s.x > Lh) s.x -= Lh * 2;
      o.position.set(s.x, s.y, s.z); o.rotation.set(s.rot.x + t * s.sp.x * .4, s.rot.y + t * s.sp.y * .4, s.rot.z + t * s.sp.z * .4); o.scale.setScalar(.5); o.updateMatrix(); rbc.setMatrixAt(i, o.matrix);
    }); rbc.instanceMatrix.needsUpdate = true;
    ps.forEach((s, i) => { s.x += (1 - (Math.hypot(s.y, s.z) / R) ** 2) * 1.5 * dt + .1 * dt; if (s.x > Lh) s.x -= Lh * 2; o.position.set(s.x, s.y, s.z); o.rotation.set(t, 0, 0); o.scale.setScalar(1); o.updateMatrix(); plt.setMatrixAt(i, o.matrix); }); plt.instanceMatrix.needsUpdate = true;
    wbc.forEach(w => { w.x += .5 * dt; if (w.x > Lh) w.x -= Lh * 2; w.m.position.set(w.x, Math.sin(w.a) * (R - .8), Math.cos(w.a) * (R - .8)); w.m.rotation.y += dt * .3; });
  });
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-2, .6, 1.5), 'Red blood cell (erythrocyte)', 'A biconcave disc 7–8 µm wide with no nucleus. ~25 trillion in the body, ~2.4 million made per second.');
  L(V(1, -2, 1.7), 'White blood cell (leukocyte)', 'Immune patrol cells; the large lobed nucleus is visible. Neutrophils squeeze through vessel walls toward infection.');
  L(V(4.5, 1.2, 1.2), 'Platelets', 'Tiny cell fragments that plug breaks in vessels and start clotting.');
  L(V(-5.5, 3.0, 0), 'Endothelium', 'A single layer of flat cells lines every vessel, controlling traffic between blood and tissues.');
  L(V(0, 3.2, 0), 'Plasma', 'The straw-coloured fluid (55% of blood) carrying proteins, hormones, nutrients and wastes.');
  group.add(dust(200, 18, 0xffb0bc).obj);
  return { group, labels, update: (t, dt) => upd.forEach(f => f(t, dt)), cam: { pos: V(1, 4, 14), target: V(0, 0, 0) } };
}
function bloodCell() {
  seed(91);
  const group = new THREE.Group(), labels = [], upd = [];
  const g = rbcGeo(); g.scale(3.2, 3.2, 3.2);
  const m = new THREE.MeshStandardMaterial({ color: 0xd8222f, roughness: .3, emissive: 0x4a0408, emissiveIntensity: .5, side: THREE.DoubleSide, clippingPlanes: [new THREE.Plane(V(0, 0, -1), 0)] });
  const rb = new THREE.Mesh(g, m); rb.rotation.x = -Math.PI / 2 + .55; group.add(rb);
  const rg = new THREE.Mesh(g.clone().scale(.985, .985, .985), glass(0xff6a7a, .25, { clippingPlanes: m.clippingPlanes })); rg.rotation.copy(rb.rotation); group.add(rg);
  // hemoglobin molecules inside the cut half
  const hm = [mat(0xff3a3a, { emissive: 0x6a0a0a, emissiveIntensity: .6 }), mat(0x3a7aff, { emissive: 0x0a2a6a, emissiveIntensity: .6 }), mat(0xffd23a, { emissive: 0x6a4a0a, emissiveIntensity: .6 }), mat(0x3aff9a, { emissive: 0x0a6a3a, emissiveIntensity: .6 })];
  const hbs = [];
  for (let i = 0; i < 34; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * 2.55; const p = V(Math.cos(a) * r, rr(-.2, .75) * (1 - (r / 3.2) ** 2) * 1.2, -Math.sin(a) * r + .5 * 0);
    const hb = new THREE.Group(); [[.09, .09], [-.09, .09], [.09, -.09], [-.09, -.09]].forEach(([x, y], k) => { hb.add(sph(.075, hm[k % 4], V(x, y, 0), null, 8)); }); hb.add(sph(.03, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }), V(0, 0, 0), null, 6));
    hb.position.copy(p).applyEuler(rb.rotation); hb.position.z = Math.abs(hb.position.z) * -1 * 0 + rr(-.9, .1); hb.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); hb.scale.setScalar(1.35); group.add(hb); hbs.push(hb);
  }
  const o2 = []; for (let i = 0; i < 14; i++) { const p = sph(.07, glow(0x9ad7ff, 1.2), null, null, 8); group.add(p); o2.push({ p, a: rnd() * TAU, r: rr(3.6, 5.5), s: rr(.1, .3), y: rr(-2, 2) }); }
  upd.push((t) => { hbs.forEach((h, i) => { h.rotation.x += .004; h.rotation.y += .006; }); o2.forEach(q => { const a = q.a + t * q.s; q.p.position.set(Math.cos(a) * q.r, q.y + Math.sin(t + q.a) * .4, Math.sin(a) * q.r * .7 + 1); }); });
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(2.9, -.2, 0), 'Biconcave shape', 'The disc shape maximises surface area for gas exchange and lets the cell fold through capillaries narrower than itself.');
  L(V(-.6, 1.0, -.4), 'Haemoglobin', 'Each cell holds ~270 million haemoglobin molecules; each carries four oxygen atoms bound to iron-containing haem groups.');
  L(V(0, -1.2, 0), 'No nucleus', 'Mature red cells eject their nucleus and organelles to make more room for haemoglobin. They live ~120 days.');
  L(V(3.6, 1.6, 1), 'Oxygen', 'Picked up in the lungs and released in tissues where pO₂ is low.');
  group.add(dust(150, 18, 0xffb0bc).obj);
  return { group, labels, update: (t, dt) => upd.forEach(f => f(t, dt)), cam: { pos: V(0, 5.5, 8.5), target: V(0, 0, 0) } };
}

/* =============================================================== */
/*                            LUNG                                  */
/* =============================================================== */
function lungTissue() {
  seed(121);
  const group = new THREE.Group(), labels = [], upd = [];
  const wall = glass(0xffa8b8, .2, { emissive: 0x5a2030, emissiveIntensity: .35 });
  const capM = mat(0xff3a4a, { emissive: 0x6a0a14, emissiveIntensity: .5, roughness: .3 });
  const sites = []; const center = V(0, 0, 0);
  for (let i = 0; i < 12; i++) { const d = randDir(); const r = rr(1.25, 1.55); sites.push({ p: d.clone().multiplyScalar(rr(2.2, 3.0)), r }); }
  sites.forEach(({ p, r }) => {
    const sg = new THREE.SphereGeometry(r, 36, 28); group.add(place(new THREE.Mesh(sg, wall), { position: p }));
    for (let k = 0; k < 4; k++) {
      let q = randDir(); const pts = []; for (let s = 0; s < 14; s++) { pts.push(p.clone().addScaledVector(q, r * 1.005)); q = q.clone().add(randDir().multiplyScalar(.35)).normalize(); }
      group.add(tub(pts, .035, capM, 40, 6));
    }
  });
  const bm = glass(0xcfe8ff, .45, { emissive: 0x1a3a5a, emissiveIntensity: .3 }); group.add(tub([V(0, 5.5, 0), V(0, 2.5, 0), V(0, 0, 0)], .38, bm, 20, 14));
  group.add(sph(.4, bm, V(0, 0, 0), null, 16));
  const air = new THREE.InstancedMesh(new THREE.SphereGeometry(.05, 6, 5), glow(0x9ad7ff, 1), 120); const as = []; for (let i = 0; i < 120; i++) { const s = sites[i % sites.length]; as.push({ s, d: randDir().multiplyScalar(s.r * .8 * Math.cbrt(rnd())), ph: rnd() * TAU }); }
  const o = new THREE.Object3D(); group.add(air);
  upd.push(t => { as.forEach((a, i) => { o.position.copy(a.s.p).addScaledVector(a.d, 1 + .12 * Math.sin(t * 1.5 + a.ph)); o.updateMatrix(); air.setMatrixAt(i, o.matrix); }); air.instanceMatrix.needsUpdate = true; });
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(0, 5.8, 0), 'Bronchiole', 'Tiny airways (<1 mm) lead the air to the alveoli, the end of the 23-step branching tree from the trachea.');
  L(sites[0].p.clone().add(V(0, sites[0].r + .5, 0)), 'Alveolus', 'A balloon-like air sac ~200 µm wide. The lung holds ~480 million of them, giving the surface area of half a tennis court.');
  L(sites[3].p.clone().add(V(.5, 0, sites[3].r + .2)), 'Capillary net', 'A mesh of capillaries wraps each alveolus so blood passes within ~0.5 µm of the air.');
  L(sites[5].p.clone().add(V(-.8, 0, sites[5].r)), 'Air', 'Each breath brings ~21% oxygen into the sacs.');
  group.add(dust(180, 18, 0xffc8d0).obj);
  return { group, labels, update: (t, dt) => upd.forEach(f => f(t, dt)), cam: { pos: V(6, 3, 10), target: V(0, 1, 0) } };
}
function lungCell() {
  seed(133);
  const group = new THREE.Group(), labels = [], upd = [];
  const R = 3.4;
  const wallM = glass(0xff9aae, .22, { emissive: 0x5a2030, emissiveIntensity: .3 }); wallM.clippingPlanes = [new THREE.Plane(V(0, 0, -1), 0)];
  group.add(new THREE.Mesh(new THREE.SphereGeometry(R, 56, 40), wallM));
  const t1 = glass(0xffc6d4, .6, { clippingPlanes: wallM.clippingPlanes }); const o = new THREE.Object3D();
  const plates = new THREE.InstancedMesh(new THREE.CylinderGeometry(.36, .36, .03, 7), t1, 140); let n = 0;
  for (let i = 0; i < 140; i++) { const d = randDir(); o.position.copy(d).multiplyScalar(R - .06); o.lookAt(d.clone().multiplyScalar(5)); o.rotateX(Math.PI / 2); o.rotateY(rnd() * 3); o.updateMatrix(); plates.setMatrixAt(n++, o.matrix); }
  group.add(plates);
  // type II cells
  const t2m = mat(0xb68cff, { emissive: 0x3a1a77, emissiveIntensity: .4, clippingPlanes: wallM.clippingPlanes });
  const lm = mat(0xfff0c0, { emissive: 0x6a5a30, emissiveIntensity: .5, clippingPlanes: wallM.clippingPlanes });
  const t2 = []; for (let i = 0; i < 4; i++) { const d = V(Math.cos(i * 1.7 + .3), Math.sin(i * 2.3) * .7, -Math.abs(Math.sin(i * 1.3 + 1)) * .2 - .3).normalize(); d.z = -Math.abs(d.z); const g = new THREE.Group(); g.position.copy(d).multiplyScalar(R - .3); const body = sph(.55, t2m, null, [1, 1, .8], 20); g.add(body); g.add(sph(.2, mat(0x2a1a77), V(0, 0, 0), null, 10)); for (let k = 0; k < 5; k++) g.add(sph(.08, lm, randDir().multiplyScalar(.35).add(V(0, 0, .0)), null, 8)); g.lookAt(0, 0, 0); group.add(g); t2.push(g); }
  // capillary around the outside (ring)
  const rng = new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => { const a = i / 24 * TAU; return V(Math.cos(a) * (R + .15), Math.sin(a) * (R + .15) * .3 + Math.sin(a * 2) * .4, Math.sin(a) * (R + .15)); }), true);
  const capm = glass(0xff4a5a, .35, { emissive: 0x6a0a14, emissiveIntensity: .4, clippingPlanes: wallM.clippingPlanes });
  group.add(new THREE.Mesh(new THREE.TubeGeometry(rng, 120, .34, 14, true), capm));
  const rb = new THREE.InstancedMesh(rbcGeo(), new THREE.MeshStandardMaterial({ color: 0xd8222f, roughness: .35, side: THREE.DoubleSide, clippingPlanes: wallM.clippingPlanes }), 20);
  upd.push((t) => { for (let i = 0; i < 20; i++) { const u = (i / 20 + t * .015) % 1; const p = rng.getPointAt(u), tg = rng.getTangentAt(u); o.position.copy(p); o.quaternion.setFromUnitVectors(V(0, 1, 0), tg); o.rotateY(t); o.scale.setScalar(.2); o.updateMatrix(); rb.setMatrixAt(i, o.matrix); } rb.instanceMatrix.needsUpdate = true; });
  group.add(rb);
  // macrophage
  const mac = new THREE.Group(); mac.add(sph(.55, glass(0xffd0e0, .8, { emissive: 0x6a3040, emissiveIntensity: .3 }), null, null, 20)); mac.add(sph(.22, mat(0x6a35b0), null, [1, .8, .8], 12)); for (let i = 0; i < 6; i++) { const d = randDir(); mac.add(tub([V(0, 0, 0), d.clone().multiplyScalar(.7), d.clone().multiplyScalar(1.0).add(randDir().multiplyScalar(.2))], .07, glass(0xffd0e0, .8), 10, 6)); } group.add(mac);
  upd.push(t => { mac.position.set(Math.cos(t * .1) * 1.5, -1.3 + Math.sin(t * .15) * .2, Math.sin(t * .1) * 1.5 - .5); mac.rotation.y = t * .1; });
  // gases
  const O = new THREE.InstancedMesh(new THREE.SphereGeometry(.06, 8, 6), glow(0x9ad7ff, 1.4), 40), C = new THREE.InstancedMesh(new THREE.SphereGeometry(.06, 8, 6), glow(0xffa04a, 1.2), 30); group.add(O, C);
  const od = Array.from({ length: 40 }, () => ({ d: randDir(), ph: rnd() })), cd = Array.from({ length: 30 }, () => ({ d: randDir(), ph: rnd() }));
  upd.push(t => { od.forEach((q, i) => { const u = (t * .12 + q.ph) % 1; o.position.copy(q.d).multiplyScalar(.7 + u * 2.7); o.scale.setScalar(1); o.rotation.set(0, 0, 0); o.updateMatrix(); O.setMatrixAt(i, o.matrix); }); O.instanceMatrix.needsUpdate = true; cd.forEach((q, i) => { const u = (t * .1 + q.ph) % 1; o.position.copy(q.d).multiplyScalar(3.8 - u * 2.7); o.updateMatrix(); C.setMatrixAt(i, o.matrix); }); C.instanceMatrix.needsUpdate = true; });
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(.6, 1.7, .6), 'Type I pneumocyte', 'Ultra-thin squamous cells (~0.1–0.2 µm) covering ~95% of the alveolar surface, thin enough for gases to diffuse straight through.');
  L(t2[0].position.clone().multiplyScalar(1.1), 'Type II pneumocyte', 'Cuboidal cells that make surfactant (stored in lamellar bodies), which stops alveoli collapsing, and can regenerate type I cells.');
  L(mac.position.clone().add(V(0, .9, 0)), 'Alveolar macrophage', 'The lung\'s own cleaner: engulfs dust, bacteria and debris that reaches the alveoli.');
  L(V(3.5, 1.3, 1.5), 'Capillary + red blood cells', 'Blood in the capillary is separated from air by just the two thin cell layers (~0.5 µm), the air–blood barrier.');
  L(V(-1.5, .7, 1.8), 'O₂ in, CO₂ out', 'Oxygen (blue) diffuses into the blood and CO₂ (orange) diffuses into the air, driven by concentration gradients.');
  group.add(dust(140, 18, 0xffc8d0).obj);
  return { group, labels, update: (t, dt) => upd.forEach(f => f(t, dt)), cam: { pos: V(1.5, 3.5, 10), target: V(0, 0, 0) } };
}

/* =============================================================== */
/*                         EPITHELIUM                               */
/* =============================================================== */
function epiTissue() {
  seed(151);
  const group = new THREE.Group(), labels = [], upd = [];
  const bm = mat(0xd6b8a0, { roughness: .8 }); const base = new THREE.Mesh(new THREE.BoxGeometry(11, .8, 8), bm); base.position.y = -.4; group.add(base);
  const cm = glass(0xffc2b0, .55, { emissive: 0x5a2a20, emissiveIntensity: .25 }); cm.side = THREE.FrontSide;
  const nm = mat(0x6a4cc0, { emissive: 0x2a1a66, emissiveIntensity: .4 }); const gobl = glass(0x8ad0ff, .6, { emissive: 0x1a4a7a, emissiveIntensity: .4 });
  const mvM = mat(0xffe0d0, { emissive: 0x5a4030, emissiveIntensity: .3 });
  const mv = new THREE.InstancedMesh(new THREE.CylinderGeometry(.012, .016, .22, 5), mvM, 12 * 8 * 22); let n = 0; const o = new THREE.Object3D();
  for (let x = -5; x <= 5; x++) for (let z = -3; z <= 3; z++) {
    const px = x * .9 + (z % 2) * .45, pz = z * 1.0; if (Math.abs(px) > 5) continue;
    const isG = rnd() < .13; const h = rr(1.9, 2.15);
    const g = new THREE.CylinderGeometry(isG ? .38 : .4, .4, h, 6); const c = new THREE.Mesh(g, isG ? gobl : cm); c.position.set(px, h / 2, pz); c.rotation.y = rnd(); group.add(c);
    if (!isG) {
      group.add(sph(1, nm, V(px, .55, pz), [.26, .38, .26], 12));
      for (let k = 0; k < 20 && n < mv.count; k++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * .33; o.position.set(px + Math.cos(a) * r, h + .1, pz + Math.sin(a) * r); o.updateMatrix(); mv.setMatrixAt(n++, o.matrix); }
    } else group.add(sph(.28, glass(0xd0f0ff, .8), V(px, h - .55, pz), [1, 1.5, 1], 14));
  }
  mv.count = n; group.add(mv);
  const vm = mat(0xff4a5a, { emissive: 0x6a0a14, emissiveIntensity: .5 }); [-2, 0, 2.2].forEach(z => group.add(tub([V(-6, -.45, z), V(0, -.4, z + .3), V(6, -.45, z)], .13, vm, 20, 8)));
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(-1.5, 2.6, 0), 'Epithelial cells', 'Sheets of tightly joined cells line the skin, airways and gut. They form barriers, absorb nutrients or secrete mucus; they are replaced constantly.');
  L(V(.2, 2.6, 1.0), 'Microvilli (brush border)', 'Finger-like projections (1 µm tall) that expand the absorbing surface ~20×.');
  L(V(1.6, .8, 3.5), 'Goblet cell', 'A mucus-secreting cell; the mucus lubricates and protects the lining from acid and microbes.');
  L(V(-3.1, .55, 3.7), 'Nucleus', 'Columnar cells keep the nucleus near their base.');
  L(V(4.7, -.4, 3.8), 'Basement membrane & capillaries', 'A thin mat of collagen anchors the epithelium. Capillaries below take up absorbed nutrients.');
  group.add(dust(160, 18, 0xffe0d0).obj);
  return { group, labels, update: () => { }, cam: { pos: V(5, 6, 10), target: V(0, 1, 0) } };
}
function epiCell() {
  seed(171);
  const group = new THREE.Group(), labels = [], upd = [];
  const hexM = glass(0xffc2b0, .22, { emissive: 0x5a2a20, emissiveIntensity: .25 }); hexM.clippingPlanes = CUT; hexM.clipIntersection = true;
  const cg = new THREE.CylinderGeometry(1.9, 1.9, 7, 6); const cell = new THREE.Mesh(cg, hexM); cell.position.y = 3.5; group.add(cell);
  const em = new THREE.LineBasicMaterial({ color: 0xffd8c8, transparent: true, opacity: .5, clippingPlanes: CUT, clipIntersection: true });
  const eg = new THREE.LineSegments(new THREE.EdgesGeometry(cg), em); eg.position.y = 3.5; group.add(eg);
  const nu = nucleus(1.1, true); nu.scale.set(1, 1.2, 1); nu.position.set(0, 1.9, 0); group.add(nu);
  const er = erSheets(1.1, true); er.position.copy(nu.position); er.scale.set(1, 1.2, 1); group.add(er);
  const gg = golgi(.8); gg.position.set(.2, 4.1, .4); gg.rotation.set(.1, .6, 0); group.add(gg);
  for (let i = 0; i < 22; i++) { let p, t = 0; do { p = V(rr(-1.5, 1.5), rr(.5, 6.2), rr(-1.5, 1.5)); } while ((inOct(p.clone().sub(V(0, 3.5, 0))) || p.distanceTo(nu.position) < 1.6) && t++ < 50); const m = mitochondrion(rr(.45, .7), .15); m.position.copy(p); m.rotation.z = Math.PI / 2 + rr(-.4, .4); m.rotation.y = rnd() * 3; group.add(m); }
  const mvm = mat(0xffd8c0, { emissive: 0x5a4030, emissiveIntensity: .4 }); mvm.clippingPlanes = CUT; mvm.clipIntersection = true;
  const mv = new THREE.InstancedMesh(new THREE.CylinderGeometry(.03, .04, .75, 6), mvm, 260); const o = new THREE.Object3D();
  for (let i = 0; i < 260; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * 1.55; o.position.set(Math.cos(a) * r, 7.35, Math.sin(a) * r); o.updateMatrix(); mv.setMatrixAt(i, o.matrix); } group.add(mv);
  const tj = mat(0xffb0a0, { emissive: 0x6a2a20, emissiveIntensity: .6 }); const belt = new THREE.Mesh(new THREE.TorusGeometry(1.88, .05, 6, 6), tj); belt.rotation.x = Math.PI / 2; belt.rotation.z = Math.PI / 6 * 0; belt.position.y = 6.75; belt.scale.set(1, 1, 1); group.add(belt);
  group.add(place(new THREE.Mesh(new THREE.BoxGeometry(8, .5, 8), mat(0xd6b8a0, { roughness: .8 })), { position: V(0, -.25, 0) }));
  // neighbours
  [[3.3, 0], [-1.65, 2.85], [-1.65, -2.85]].forEach(([x, z]) => { const nb = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 7, 6), glass(0xffc2b0, .1)); nb.position.set(x, 3.5, z); group.add(nb); });
  const L = (pos, text, desc) => labels.push({ pos, text, desc });
  L(V(.2, 7.7, 0), 'Microvilli', 'Hundreds of actin-supported projections that form the brush border where nutrients are absorbed.');
  L(V(1.5, 6.8, 1.5), 'Tight junction', 'A belt of sealing proteins that stops leaks between cells and keeps the top and bottom of the cell different.');
  L(V(-1.0, 2.5, 1.0), 'Nucleus', 'Oval and basal; polarity runs from the nucleus-containing base to the absorptive top.');
  L(gg.position.clone().add(V(0, .6, 0)), 'Golgi', 'Sits above the nucleus (supranuclear) packaging proteins and mucus for secretion.');
  L(V(0, -.1, 2.5), 'Basement membrane', 'The cell is anchored by hemidesmosomes to this collagen-rich mat.');
  upd.push(t => { });
  group.add(dust(160, 20, 0xffe0d0).obj);
  return { group, labels, update: () => { }, cam: { pos: V(8, 6.5, 10.5), target: V(0, 3.2, 0) } };
}

/* =============================================================== */
const BUILD = {
  muscle: { tissue: muscleTissue, cell: muscleCell },
  bone: { tissue: boneTissue, cell: boneCell },
  liver: { tissue: liverTissue, cell: liverCell },
  neuron: { tissue: neuronTissue, cell: neuronCell },
  cardiac: { tissue: cardiacTissue, cell: cardiacCell },
  blood: { tissue: bloodTissue, cell: bloodCell },
  lung: { tissue: lungTissue, cell: lungCell },
  epithelium: { tissue: epiTissue, cell: epiCell },
};

export const CELL_INFO = {
  muscle: { label: 'Skeletal muscle', tissue: ['Muscle fascicle', '≈ 1 mm bundle'], cell: ['Muscle fibre (myocyte)', '50–100 µm wide, up to 30 cm long'], organelle: ['Inside a muscle cell', '≈ 1–10 µm structures'], blurb: 'Skeletal muscle is bundles of giant multinucleate cells packed with contractile myofibrils.' },
  cardiac: { label: 'Cardiac muscle', tissue: ['Heart muscle tissue', '≈ 500 µm field'], cell: ['Cardiomyocyte', '≈ 100 × 25 µm'], organelle: ['Inside a cardiomyocyte', '≈ 1–10 µm structures'], blurb: 'Branching, striated cells joined end-to-end by intercalated discs so the heart beats as one.' },
  bone: { label: 'Compact bone', tissue: ['Compact bone (osteons)', '≈ 0.5 mm field'], cell: ['Osteocyte', '≈ 20 µm cell in a lacuna'], organelle: ['Inside an osteocyte', '≈ 1–10 µm structures'], blurb: 'Concentric lamellae (osteons) house living osteocytes connected by a web of canaliculi.' },
  liver: { label: 'Liver tissue', tissue: ['Liver lobule', '≈ 1–2 mm hexagon'], cell: ['Hepatocyte', '≈ 25 µm cell'], organelle: ['Inside a hepatocyte', '≈ 1–10 µm structures'], blurb: 'Hexagonal lobules of hepatocyte plates, with blood flowing through sinusoids to a central vein.' },
  neuron: { label: 'Nervous tissue', tissue: ['Neural network', '≈ 100 µm field'], cell: ['Neuron', 'soma ≈ 20 µm, axon up to 1 m'], organelle: ['Inside a neuron', '≈ 1–10 µm structures'], blurb: 'Neurons wire up through dendrites and axons, with glial cells supporting them.' },
  blood: { label: 'Blood', tissue: ['Blood flowing in a vessel', '≈ 50 µm vessel'], cell: ['Red blood cell', '≈ 7.5 µm disc'], organelle: ['Inside a blood cell', '≈ nanometre molecules'], blurb: 'Red cells, white cells and platelets suspended in plasma and lined by endothelium.' },
  lung: { label: 'Lung tissue', tissue: ['Alveolar sacs', '≈ 200 µm each'], cell: ['Alveolus & its cells', '≈ 200 µm sac'], organelle: ['Inside a lung cell', '≈ 1–10 µm structures'], blurb: 'Clusters of thin-walled air sacs wrapped by capillaries for gas exchange.' },
  epithelium: { label: 'Epithelium', tissue: ['Epithelial sheet', '≈ 100 µm field'], cell: ['Columnar epithelial cell', '≈ 10 × 25 µm'], organelle: ['Inside an epithelial cell', '≈ 1–10 µm structures'], blurb: 'Tightly joined sheets of cells that form barriers and absorb or secrete.' },
};

export function buildCell(type, level) {
  const t = BUILD[type] ? type : 'epithelium';
  let r;
  if (level === 'organelle') r = organelleScene(t);
  else r = BUILD[t][level]();
  r.type = t; r.level = level;
  return r;
}

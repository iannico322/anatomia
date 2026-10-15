import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Yax = V(0, 1, 0);

/* ---------- noise ---------- */
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z) => vnoise(x, y, z) * .6 + vnoise(x * 2.1, y * 2.1, z * 2.1) * .3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * .1;

function blobGeo(detail, [sx, sy, sz], amp, freq, seed = 0, fn) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let r = 1 + amp * (fbm(v.x * freq + seed, v.y * freq + seed, v.z * freq + seed) - .5) * 2;
    if (fn) r = fn(v, r);
    p.setXYZ(i, v.x * r * sx, v.y * r * sy, v.z * r * sz);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- geometry helpers ---------- */
function orient(mesh, a, b) {
  const d = b.clone().sub(a); const len = d.length();
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(Yax, d.normalize());
  return len;
}
function boneGeo(len, rEnd, rShaft, endFrac = .14, seg = 28) {
  const pts = [new THREE.Vector2(0, -len / 2)];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const e = Math.exp(-Math.pow(t / endFrac, 2)) + Math.exp(-Math.pow((1 - t) / endFrac, 2));
    pts.push(new THREE.Vector2(rShaft + (rEnd - rShaft) * Math.min(1, e), -len / 2 + t * len));
  }
  pts.push(new THREE.Vector2(0, len / 2));
  return new THREE.LatheGeometry(pts, 16);
}
function muscleGeo(len, r, { belly = .5, pw = .75, wx = 1, wz = 1, tw = 0 } = {}) {
  const k = Math.log(.5) / Math.log(belly); const pts = []; const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N; const prof = Math.sin(Math.PI * Math.pow(t, k));
    pts.push(new THREE.Vector2(Math.max(.0016, r * Math.pow(Math.max(prof, 0), pw)), -len / 2 + t * len));
  }
  const g = new THREE.LatheGeometry(pts, 20); g.rotateY(tw); g.scale(wx, 1, wz); return g;
}
function tubeVar(curve, segs, radial, rfn) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs; const c = curve.getPointAt(u); const r = rfn(u);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2; const s = Math.sin(a), co = Math.cos(a);
      const n = frames.normals[i], b = frames.binormals[i];
      pos.push(c.x + (co * n.x + s * b.x) * r, c.y + (co * n.y + s * b.y) * r, c.z + (co * n.z + s * b.z) * r);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const crv = (pts, closed = false) => new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', .5);

/* ---------- materials ---------- */
function fiberTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#b8413a'; g.fillRect(0, 0, 256, 64);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 256; i++) { g.fillStyle = `rgba(${50 + rnd() * 60 | 0},8,12,${.1 + rnd() * .3})`; g.fillRect(i, 0, 1 + rnd() * 1.6, 64); }
  for (let i = 0; i < 100; i++) { g.fillStyle = `rgba(255,175,150,${rnd() * .14})`; g.fillRect(rnd() * 256, 0, 1, 64); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: 0 }, o));
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: .35, metalness: 0, clearcoat: .6, clearcoatRoughness: .35 }, o));

export const LAYER_INFO = {
  skin: { name: 'Skin & surface', color: '#7f9bff' },
  muscle: { name: 'Muscles', color: '#e0524b' },
  organs: { name: 'Organs', color: '#ff9b7a' },
  vessels: { name: 'Blood vessels', color: '#ff4d5e' },
  nerves: { name: 'Nervous system', color: '#ffd96a' },
  skeleton: { name: 'Skeleton', color: '#efe3c8' },
};

/* ---------- skin shader ---------- */
function skinMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uOp: { value: 1 }, uTime: { value: 0 }, uC1: { value: new THREE.Color(0x1d2a6b) }, uC2: { value: new THREE.Color(0xa9bcff) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; uniform float uOp; uniform float uTime; uniform vec3 uC1; uniform vec3 uC2;
      void main(){
        float f=1.-abs(dot(normalize(vN),normalize(vV)));
        float rim=pow(f,2.4);
        float band=.5+.5*sin(vW.y*260.-uTime*.6);
        float fine=.5+.5*sin(vW.y*900.+vW.x*40.);
        vec3 col=mix(uC1,uC2,rim)*(.55+.45*rim)+uC2*.05*band*rim+uC2*.03*fine;
        float a=(.09+rim*.95);
        gl_FragColor=vec4(col*a*1.5*uOp,a*uOp);
      }`,
  });
  return m;
}

function loftGeo(secsIn, n = 90, radial = 40) {
  // secs: {x,y,z,rx,rzf,rzb,e}
  const C = crv(secsIn.map(s => V(s.x, s.y, s.z)));
  const R = crv(secsIn.map(s => V(s.rx, s.rzf, s.rzb)));
  const E = secsIn.map(s => s.e || 2.2);
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const c = C.getPoint(t), r = R.getPoint(t);
    const ef = t * (E.length - 1); const e0 = Math.floor(ef), e1 = Math.min(E.length - 1, e0 + 1); const e = E[e0] + (E[e1] - E[e0]) * (ef - e0);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2; const co = Math.cos(a), sn = Math.sin(a);
      const px = Math.sign(co) * Math.pow(Math.abs(co), 2 / e), pz = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e);
      pos.push(c.x + px * r.x, c.y, c.z + pz * (sn > 0 ? r.y : r.z));
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const S = (y, x, z, rx, rzf, rzb, e) => ({ x, y, z, rx, rzf, rzb: rzb ?? rzf, e });

/* =============================================================== */
export function buildBody() {
  const root = new THREE.Group();
  const layers = {};
  for (const k of Object.keys(LAYER_INFO)) { layers[k] = new THREE.Group(); layers[k].name = k; root.add(layers[k]); }
  const parts = new Map();
  const updaters = [];

  const reg = (id, name, system, desc, cell) => { if (!parts.has(id)) parts.set(id, { id, name, system, desc, cell, meshes: [], mats: {}, layer: null }); };

  const base = {
    bone: std(0xe8dcc3, { roughness: .5 }),
    boneDark: std(0x2a2420, { roughness: .8 }),
    cart: std(0xb9d4d8, { roughness: .35 }),
    tendon: std(0xe9e0cf, { roughness: .4 }),
    muscle: std(0xffffff, { roughness: .55, map: fiberTex(), bumpMap: fiberTex(), bumpScale: .8 }),
    brain: std(0xe9aeb3, { roughness: .6 }),
    heart: phys(0xb3202e, { roughness: .4 }),
    aorta: std(0xd23a3a, { roughness: .4 }),
    vein: std(0x4668e8, { roughness: .4 }),
    lung: phys(0xe79a9a, { roughness: .5, transparent: true, opacity: .62 }),
    liver: phys(0xa5432f, { roughness: .32, clearcoat: .8 }),
    green: phys(0x6fa04a, { roughness: .4 }),
    stomach: phys(0xe7a091, { roughness: .4 }),
    sint: phys(0xeaa3a3, { roughness: .35 }),
    lint: phys(0xcf8b6a, { roughness: .45 }),
    pancreas: std(0xe5b783, { roughness: .6 }),
    kidney: phys(0x8e2f28, { roughness: .35 }),
    spleen: phys(0x7d3358, { roughness: .4 }),
    bladder: phys(0xe6c3a0, { roughness: .3, transparent: true, opacity: .85 }),
    nerve: std(0xffdc7a, { roughness: .4, emissive: 0x6a4a00 }),
    eye: phys(0xf3f3f0, { roughness: .2 }),
    trachea: std(0xcfe3ea, { roughness: .4 }),
    thyroid: std(0xd7776e, { roughness: .5 }),
  };
  for (const k of ['lung', 'bladder']) base[k].userData.baseOp = base[k].opacity;

  function add(layer, id, geo, key, setup) {
    const p = parts.get(id); if (!p) throw new Error('unregistered ' + id);
    if (!p.mats[key]) {
      const m = base[key].clone(); m.userData = { ...base[key].userData };
      if (key === 'muscle') { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; m.color.setHSL(.0 + (h % 17) / 17 * .02 - .008, .55 + (h % 7) / 70, .66 + (h % 11) / 11 * .1 - .05); }
      p.mats[key] = m;
    }
    const mesh = new THREE.Mesh(geo, p.mats[key]);
    mesh.userData.part = id; p.meshes.push(mesh); p.layer = layer; layers[layer].add(mesh);
    if (setup) setup(mesh);
    return mesh;
  }
  const ell = (layer, id, key, p, [rx, ry, rz], setup, seg = 20) => {
    const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .75)); g.scale(rx, ry, rz);
    return add(layer, id, g, key, m => { m.position.copy(p); if (setup) setup(m); });
  };
  const tube = (layer, id, key, pts, r, setup, seg) => {
    const c = crv(pts); const g = new THREE.TubeGeometry(c, seg || Math.max(12, pts.length * 8), r, 8, false);
    return add(layer, id, g, key, setup);
  };
  const sym = f => { f(1); f(-1); };

  /* ---------- part registry ---------- */
  const R = (s) => s.trim().split('\n').forEach(l => { const [id, name, sys, cell, desc] = l.split('|').map(x => x.trim()); reg(id, name, sys, desc, cell); });
  R(`
skin|Skin (epidermis & dermis)|skin|epithelium|The body's largest organ: about 1.5–2 m² and 15% of body weight. A waterproof barrier that regulates temperature, senses touch and makes vitamin D.
brain|Brain|organs|neuron|About 86 billion neurons and as many support cells in roughly 1.4 kg of tissue. Uses about 20% of the body's energy while being 2% of its mass.
cerebellum|Cerebellum|organs|neuron|Holds more than half of the brain's neurons. Fine-tunes movement, balance and coordination.
heart|Heart|organs|cardiac|A four-chambered muscular pump that beats about 100,000 times a day, moving around 7,500 litres of blood.
lungs|Lungs|organs|lung|Around 480 million alveoli give a gas-exchange surface of ~70 m². Right lung has three lobes, left has two to make room for the heart.
trachea|Trachea & bronchi|organs|lung|A ~11 cm cartilage-ringed airway that splits into bronchi and ~23 generations of ever-smaller branches.
liver|Liver|organs|liver|The largest internal organ (~1.5 kg). Filters blood from the gut, makes bile, stores glycogen and performs 500+ metabolic functions.
gallbladder|Gallbladder|organs|liver|Stores and concentrates bile made by the liver, releasing it into the small intestine to digest fats.
stomach|Stomach|organs|epithelium|A J-shaped muscular sac that churns food with acid (pH 1.5–2) and enzymes. Its lining renews every 3–5 days.
spleen|Spleen|organs|blood|Filters old red blood cells and stores immune cells and platelets.
pancreas|Pancreas|organs|epithelium|Makes digestive enzymes and the hormones insulin and glucagon that control blood sugar.
kidneys|Kidneys|organs|epithelium|Each holds ~1 million nephrons that filter ~180 L of blood plasma a day, producing about 1.5 L of urine.
sintestine|Small intestine|organs|epithelium|About 6 m long. Finger-like villi and microvilli expand the absorptive surface to roughly a tennis court.
lintestine|Large intestine|organs|epithelium|Absorbs water and salts, and hosts trillions of gut bacteria that make vitamins and train the immune system.
bladder|Bladder|organs|epithelium|A stretchy muscular bag that stores ~400–600 mL of urine.
esophagus|Esophagus|organs|epithelium|A 25 cm muscular tube that pushes food to the stomach with waves of contraction called peristalsis.
thyroid|Thyroid gland|organs|epithelium|A butterfly-shaped gland that releases hormones controlling metabolism.
eyes|Eyes|organs|neuron|Each retina holds ~120 million rods and 6 million cones that turn light into nerve signals.
aorta|Aorta & arteries|vessels|blood|The body's main artery, ~2.5 cm wide at the heart. Pressure waves from each heartbeat travel along it to every organ.
vena|Veins|vessels|blood|Thin-walled vessels with one-way valves that return oxygen-poor blood to the heart.
carotid|Carotid arteries|vessels|blood|Supply the brain and face with about 80% of the blood the brain needs.
brachial|Arm arteries|vessels|blood|Carry blood to the arm and hand; the pulse is felt at the radial artery of the wrist.
femoral|Leg arteries|vessels|blood|The femoral artery is the main blood supply to the leg, as wide as a finger.
cord|Spinal cord|nerves|neuron|A ~45 cm bundle of nerve fibres protected by the vertebrae. Relays signals between brain and body and runs reflex arcs.
plexus|Brachial plexus & arm nerves|nerves|neuron|A network of nerves from the lower neck that controls every muscle in the arm and hand.
sciatic|Sciatic nerve|nerves|neuron|The longest and thickest nerve in the body, up to 2 cm wide at its start, running from the lower back to the foot.
skull|Skull (cranium)|skeleton|bone|22 bones fused into a protective helmet for the brain. The thickest part is ~7 mm.
mandible|Mandible (jaw)|skeleton|bone|The only movable skull bone and the strongest of the face; it anchors the teeth and chewing muscles.
cervical|Cervical vertebrae|skeleton|bone|Seven small vertebrae that support the head and allow it to nod and turn.
thoracic|Thoracic vertebrae|skeleton|bone|Twelve vertebrae that each carry a pair of ribs, forming the back of the rib cage.
lumbar|Lumbar vertebrae|skeleton|bone|Five large vertebrae that carry most of the upper body's weight.
discs|Intervertebral discs|skeleton|bone|Gel-filled fibrocartilage cushions that absorb shock between vertebrae.
sacrum|Sacrum & coccyx|skeleton|bone|Five fused vertebrae that wedge between the hip bones, locking spine to pelvis.
ribs|Ribs|skeleton|bone|Twelve pairs of curved bones that shield the heart and lungs and move with every breath.
costal|Costal cartilage|skeleton|bone|Flexible cartilage that joins ribs to the sternum so the chest can expand.
sternum|Sternum|skeleton|bone|The breastbone, a flat bone filled with red marrow where blood cells are made.
clavicle|Clavicle (collarbone)|skeleton|bone|The only bony strut linking the arm to the trunk; the most commonly broken bone.
scapula|Scapula (shoulder blade)|skeleton|bone|A flat triangular bone that glides on the back of the rib cage and holds the shoulder socket.
humerus|Humerus|skeleton|bone|The long bone of the upper arm. The radial nerve winds in a groove along its shaft.
radius|Radius|skeleton|bone|Thumb-side forearm bone; it rotates around the ulna to turn the palm.
ulna|Ulna|skeleton|bone|Little-finger-side forearm bone forming the elbow's hinge.
carpals|Carpals|skeleton|bone|Eight small wrist bones in two rows, giving the wrist its flexibility.
hand|Metacarpals & phalanges|skeleton|bone|27 bones in each hand: 5 metacarpals, 14 finger bones and 8 wrist bones.
pelvis|Pelvis (hip bones)|skeleton|bone|A bony basin that supports the spine, protects pelvic organs and takes the hips' sockets.
femur|Femur|skeleton|bone|The thigh bone: the longest, strongest bone in the body. It can bear up to 30× body weight in some activities.
patella|Patella (kneecap)|skeleton|bone|A sesamoid bone embedded in the quadriceps tendon that boosts knee leverage.
tibia|Tibia|skeleton|bone|The shin bone; carries nearly all the body's weight below the knee.
fibula|Fibula|skeleton|bone|The slim lateral leg bone; mostly an anchor for muscles and a stabiliser for the ankle.
foot|Foot bones|skeleton|bone|26 bones per foot, arranged as arches that spring and absorb shock.
pectoralis|Pectoralis major|muscle|muscle|The large fan-shaped chest muscle that pulls the arm across the body and rotates it inward.
deltoid|Deltoid|muscle|muscle|The rounded shoulder cap that lifts the arm in every direction.
biceps|Biceps brachii|muscle|muscle|Two-headed muscle that bends the elbow and rotates the forearm (turning a screwdriver).
triceps|Triceps brachii|muscle|muscle|Three-headed muscle on the back of the arm that straightens the elbow.
brachioradialis|Brachioradialis|muscle|muscle|A forearm muscle that assists elbow flexion, especially in hammer-curl positions.
flexors|Forearm flexors|muscle|muscle|Group that bends the wrist and fingers: the grip muscles.
extensors|Forearm extensors|muscle|muscle|Group that straightens the wrist and fingers.
rectus|Rectus abdominis (abs)|muscle|muscle|The 'six-pack': a paired strap muscle separated by tendinous bands that flexes the trunk.
obliques|External obliques|muscle|muscle|Sheets on the flanks that twist and bend the trunk and compress the abdomen.
serratus|Serratus anterior|muscle|muscle|Finger-like muscle on the ribs that keeps the shoulder blade pinned to the chest.
trapezius|Trapezius|muscle|muscle|Diamond-shaped muscle of the upper back and neck that moves and stabilises the shoulder blade.
lats|Latissimus dorsi|muscle|muscle|The widest muscle of the back; pulls the arm down and back (pull-ups).
erector|Erector spinae|muscle|muscle|Columns along the spine that keep you upright and extend the back.
scm|Sternocleidomastoid|muscle|muscle|Neck muscle that turns and tilts the head.
facial|Facial & scalp muscles|muscle|muscle|Dozens of thin muscles move the face (43 in all) and give us expressions; the scalp muscle raises the brow.
neckm|Neck muscles|muscle|muscle|Deep and superficial muscles that hold the head upright (about 5 kg) and move it in every direction.
masseter|Masseter|muscle|muscle|Powerful chewing muscle; pound for pound one of the strongest in the body.
gluteus|Gluteus maximus|muscle|muscle|The largest muscle in the body; extends the hip to stand, climb and run.
glutmed|Gluteus medius|muscle|muscle|Stabilises the pelvis when you stand on one leg.
rectusfem|Rectus femoris (quadriceps)|muscle|muscle|Part of the quadriceps; flexes the hip and extends the knee.
vastus|Vastus lateralis (quadriceps)|muscle|muscle|The largest quadriceps head; extends the knee.
vastusmed|Vastus medialis (quadriceps)|muscle|muscle|Teardrop-shaped quadriceps head that stabilises the kneecap.
hamstrings|Hamstrings (back of thigh)|muscle|muscle|Back-of-thigh group that bends the knee and extends the hip.
sartorius|Sartorius|muscle|muscle|The longest muscle in the body, crossing the thigh diagonally ('tailor's muscle').
adductors|Adductors|muscle|muscle|Inner-thigh group that pulls the legs together.
gastroc|Gastrocnemius (calf)|muscle|muscle|The main calf muscle; plantar-flexes the foot for walking, running and jumping.
soleus|Soleus|muscle|muscle|A deep calf muscle rich in slow-twitch fibres that keeps you standing for hours.
tibialis|Tibialis anterior|muscle|muscle|Lifts the front of the foot to clear the ground when you step.
achilles|Achilles tendon|muscle|muscle|The body's thickest tendon, linking the calf to the heel bone.
`);

  /* ===================== SKIN ===================== */
  const skinMat = skinMaterial();
  {
    const bodySecs = [
      S(1.757, 0, 0, .012, .012, .012), S(1.745, 0, .0, .055, .066), S(1.715, 0, -.004, .076, .088), S(1.67, 0, -.006, .082, .098),
      S(1.625, 0, 0, .076, .096), S(1.585, 0, .012, .062, .084), S(1.555, 0, .02, .05, .064), S(1.525, 0, -.004, .046, .05),
      S(1.49, 0, -.01, .05, .054), S(1.46, 0, -.008, .09, .06), S(1.435, 0, 0, .165, .075, .072),
      S(1.385, 0, 0, .172, .092, .078), S(1.325, 0, 0, .166, .106, .08), S(1.255, 0, 0, .154, .1, .08),
      S(1.175, 0, 0, .14, .092, .077), S(1.095, 0, 0, .13, .088, .075), S(1.02, 0, 0, .14, .09, .085),
      S(.96, 0, -.005, .16, .092, .1), S(.9, 0, -.008, .165, .09, .106), S(.84, 0, -.005, .16, .085, .1), S(.79, 0, 0, .13, .07, .08),
    ];
    const g = loftGeo(bodySecs, 110, 44);
    add('skin', 'skin', g, 'bone', m => { m.material = skinMat; });
    parts.get('skin').mats.skin = skinMat;
    sym(s => {
      const arm = [
        S(1.465, s * .15, 0, .07, .066), S(1.41, s * .205, 0, .058, .06), S(1.3, s * .25, 0, .047, .05), S(1.2, s * .277, 0, .041, .044),
        S(1.13, s * .296, 0, .036, .038), S(1.03, s * .33, .005, .039, .041), S(.93, s * .355, .01, .029, .029), S(.88, s * .363, .012, .024, .02),
        S(.82, s * .376, .018, .03, .015), S(.74, s * .39, .02, .028, .012), S(.68, s * .4, .02, .016, .01), S(.655, s * .405, .02, .004, .004),
      ];
      add('skin', 'skin', loftGeo(arm, 70, 28), 'bone', m => { m.material = skinMat; });
      const leg = [
        S(.97, s * .09, 0, .1, .098), S(.9, s * .095, 0, .094, .092), S(.8, s * .098, .004, .09, .09), S(.7, s * .1, .006, .08, .082),
        S(.6, s * .1, .008, .068, .07), S(.5, s * .102, .004, .055, .058), S(.42, s * .105, -.002, .053, .056),
        S(.32, s * .108, -.012, .047, .052), S(.22, s * .108, -.012, .036, .04), S(.12, s * .11, -.01, .027, .028), S(.07, s * .11, -.01, .027, .029), S(.045, s * .11, -.008, .024, .026),
      ];
      add('skin', 'skin', loftGeo(leg, 70, 28), 'bone', m => { m.material = skinMat; });
      const fg = new THREE.SphereGeometry(1, 20, 14); fg.scale(.04, .032, .115);
      add('skin', 'skin', fg, 'bone', m => { m.material = skinMat; m.position.set(s * .11, .032, .05); });
    });
  }

  /* ===================== SKELETON ===================== */
  const J = s => ({
    sho: V(s * .19, 1.40, 0), elb: V(s * .296, 1.129, 0), wri: V(s * .363, .878, .012), hand: V(s * .40, .70, .02),
    hip: V(s * .085, .92, 0), knee: V(s * .10, .50, .012), ank: V(s * .11, .085, -.01),
  });
  const bone = (id, a, b, re, rs, ef = .14, key = 'bone') => {
    const g = boneGeo(a.distanceTo(b), re, rs, ef); return add('skeleton', id, g, key, m => orient(m, a, b));
  };
  const SK = 'skeleton';
  // skull
  ell(SK, 'skull', 'bone', V(0, 1.668, -.004), [.077, .088, .097], null, 28);
  ell(SK, 'skull', 'bone', V(0, 1.605, .06), [.052, .05, .042], null, 18);
  ell(SK, 'skull', 'bone', V(0, 1.595, .084), [.02, .024, .012], m => { }, 12);
  sym(s => {
    ell(SK, 'skull', 'boneDark', V(s * .034, 1.632, .08), [.019, .017, .012], null, 12);
    ell(SK, 'skull', 'bone', V(s * .072, 1.6, .0), [.012, .03, .03], null, 10); // zygomatic hint
    ell(SK, 'skull', 'boneDark', V(s * .075, 1.65, -.005), [.004, .012, .012], null, 8);
  });
  ell(SK, 'skull', 'boneDark', V(0, 1.582, .09), [.012, .01, .006], null, 8);
  {
    const jaw = crv([V(-.066, 1.655, -.012), V(-.062, 1.61, .0), V(-.05, 1.578, .035), V(-.022, 1.558, .068), V(0, 1.553, .076), V(.022, 1.558, .068), V(.05, 1.578, .035), V(.062, 1.61, .0), V(.066, 1.655, -.012)]);
    add(SK, 'mandible', new THREE.TubeGeometry(jaw, 40, .0075, 8, false), 'bone');
    const teeth = crv([V(-.03, 1.585, .066), V(-.015, 1.58, .08), V(0, 1.578, .084), V(.015, 1.58, .08), V(.03, 1.585, .066)]);
    add(SK, 'mandible', new THREE.TubeGeometry(teeth, 20, .0055, 6, false), 'cart', m => m.material = m.material);
  }
  // spine
  const spineKeys = [[1.56, -.012], [1.47, -.036], [1.40, -.058], [1.28, -.077], [1.17, -.068], [1.07, -.046], [1.0, -.05], [.92, -.077]];
  const spineZ = y => {
    for (let i = 0; i < spineKeys.length - 1; i++) {
      const [y0, z0] = spineKeys[i], [y1, z1] = spineKeys[i + 1];
      if (y <= y0 && y >= y1) { const t = (y0 - y) / (y0 - y1); const k = (1 - Math.cos(t * Math.PI)) / 2; return z0 + (z1 - z0) * k; }
    }
    return -.06;
  };
  const vert = [];
  { let y = 1.545;
    for (let i = 0; i < 24; i++) {
      const region = i < 7 ? 'cervical' : i < 19 ? 'thoracic' : 'lumbar';
      const h = region === 'cervical' ? .017 : region === 'thoracic' ? .0245 : .0265; y -= (i === 0 ? 0 : h);
      vert.push({ y, z: spineZ(y), region, i, h });
    } }
  vert.forEach(v => {
    const r = v.region === 'cervical' ? .0125 : v.region === 'thoracic' ? .0165 : .0235;
    const bh = v.h * .72;
    const g = new THREE.CylinderGeometry(r, r * 1.04, bh, 14); g.scale(1, 1, .85);
    add(SK, v.region, g, 'bone', m => m.position.set(0, v.y, v.z));
    const dg = new THREE.CylinderGeometry(r * .92, r * .92, v.h * .28, 14); dg.scale(1, 1, .85);
    add(SK, 'discs', dg, 'cart', m => m.position.set(0, v.y - v.h * .5, v.z));
    const sp = new THREE.ConeGeometry(r * .32, r * (v.region === 'thoracic' ? 3 : 2.3), 6); sp.rotateX(-Math.PI / 2 - (v.region === 'thoracic' ? .5 : .12));
    add(SK, v.region, sp, 'bone', m => m.position.set(0, v.y - (v.region === 'thoracic' ? .006 : 0), v.z - r * 1.9));
    const tg = new THREE.CylinderGeometry(.0042, .0042, r * (v.region === 'cervical' ? 4 : v.region === 'thoracic' ? 4.6 : 5.5), 6); tg.rotateZ(Math.PI / 2);
    add(SK, v.region, tg, 'bone', m => m.position.set(0, v.y, v.z - r * 1.2));
    const arch = new THREE.TorusGeometry(r * .8, .0032, 6, 14, Math.PI); arch.rotateZ(Math.PI); arch.rotateX(Math.PI / 2);
    add(SK, v.region, arch, 'bone', m => m.position.set(0, v.y, v.z - r * .9));
  });
  // sacrum / coccyx
  { const g = new THREE.ConeGeometry(.046, .11, 12); g.rotateX(Math.PI); g.scale(1.1, 1, .45);
    add(SK, 'sacrum', g, 'bone', m => { m.position.set(0, .93, -.075); m.rotation.x = .25; });
    const c = new THREE.ConeGeometry(.013, .04, 8); c.rotateX(Math.PI);
    add(SK, 'sacrum', c, 'bone', m => { m.position.set(0, .865, -.07); m.rotation.x = -.2; }); }
  // ribs
  {
    const aW = [.06, .085, .105, .12, .13, .14, .145, .145, .14, .13, .11, .1];
    const zF = [.075, .082, .086, .088, .09, .092, .092, .092, .088, .08, .06, .04];
    for (let i = 0; i < 12; i++) {
      const v = vert[7 + i]; const phiMax = i < 7 ? 1 : i < 10 ? .86 : .52; const drop = .032 + .0105 * i;
      sym(s => {
        const pts = [];
        for (let k = 0; k <= 36; k++) {
          const phi = k / 36 * phiMax; const th = Math.PI * phi;
          const x = s * (.026 * (1 - phi) + .02 * phi + (aW[i] - .026) * Math.sin(th));
          const z = (v.z - .003) + (zF[i] - (v.z - .003)) * (1 - Math.cos(th)) / 2;
          const y = v.y + .004 - drop * Math.pow(phi, 1.25);
          pts.push(V(x, y, z));
        }
        const split = i < 10 ? Math.round(36 * (i < 7 ? .78 : .8)) : 36;
        const bonePts = pts.slice(0, split + 1);
        add(SK, 'ribs', new THREE.TubeGeometry(crv(bonePts), 40, .0058, 8, false), 'bone');
        if (split < 36) add(SK, 'costal', new THREE.TubeGeometry(crv(pts.slice(split)), 14, .0052, 8, false), 'cart');
      });
    }
    // sternum
    const man = new THREE.BoxGeometry(.055, .045, .013); add(SK, 'sternum', man, 'bone', m => { m.position.set(0, 1.388, .093); m.rotation.x = -.12; });
    const bd = new THREE.BoxGeometry(.036, .11, .011); add(SK, 'sternum', bd, 'bone', m => { m.position.set(0, 1.305, .097); m.rotation.x = -.1; });
    const xi = new THREE.ConeGeometry(.011, .03, 4); xi.rotateX(Math.PI); add(SK, 'sternum', xi, 'bone', m => m.position.set(0, 1.228, .098));
  }
  // clavicle, scapula, arm
  sym(s => {
    const j = J(s);
    const cl = crv([V(s * .016, 1.41, .068), V(s * .06, 1.425, .075), V(s * .12, 1.438, .04), V(s * .175, 1.438, .0)]);
    add(SK, 'clavicle', new THREE.TubeGeometry(cl, 24, .0072, 8, false), 'bone');
    const sh = new THREE.Shape();
    const L = [[-.045, .062], [.012, .075], [.052, .062], [.058, .028], [.036, -.03], [-.02, -.09], [-.047, -.07], [-.04, 0]];
    L.forEach(([l, v], k) => { const x = -s * l; k ? sh.lineTo(x, v) : sh.moveTo(x, v); });
    const sg = new THREE.ExtrudeGeometry(sh, { depth: .005, bevelEnabled: true, bevelSize: .004, bevelThickness: .003, bevelSegments: 2 });
    add(SK, 'scapula', sg, 'bone', m => { m.position.set(s * .105, 1.335, -.098); m.lookAt(V(s * .105 + s * .45, 1.335, -.098 - 1)); });
    const gl = new THREE.SphereGeometry(.013, 10, 8); add(SK, 'scapula', gl, 'bone', m => m.position.set(s * .165, 1.395, -.015));
    // humerus
    ell(SK, 'humerus', 'bone', j.sho.clone().add(V(s * -.002, .0, 0)), [.02, .02, .02], null, 14);
    bone('humerus', j.sho.clone().add(V(0, -.012, 0)), j.elb.clone().add(V(0, .006, 0)), .017, .0105, .12);
    // forearm
    bone('ulna', j.elb.clone().add(V(s * -.004, 0, -.012)), j.wri.clone().add(V(s * -.008, .004, -.01)), .012, .0068, .12);
    bone('radius', j.elb.clone().add(V(s * .006, -.012, .012)), j.wri.clone().add(V(s * .007, .008, .008)), .0072, .0085, .1);
    // carpals + hand
    const d = j.hand.clone().sub(j.wri).normalize();
    const nrm = V(-s, 0, 0); const lat = V(0, 0, 1);
    const P = (al, sd, dp) => j.wri.clone().addScaledVector(d, al).addScaledVector(lat, sd).addScaledVector(nrm, dp);
    ell(SK, 'carpals', 'bone', P(.016, 0, 0), [.028, .02, .014], m => m.quaternion.setFromUnitVectors(Yax, d), 12);
    const fingers = [[.017, .062, [.032, .02, .016], 0], [.006, .066, [.036, .022, .017], 0], [-.006, .06, [.033, .021, .017], 0], [-.017, .054, [.026, .016, .014], 0]];
    fingers.forEach(([sd, mc, ph]) => {
      let a = P(.03, sd * .8, 0), b = P(.03 + mc, sd * 1.15, 0); bone('hand', a, b, .0062, .0042, .2);
      let al = .03 + mc;
      ph.forEach((len, k) => { const a2 = P(al + .002, sd * 1.15, -.004 * k - .001), b2 = P(al + len, sd * 1.2, -.004 * k - .004); bone('hand', a2, b2, .0048 - k * .0004, .0035 - k * .0003, .2); al += len; });
    });
    { const a = P(.012, .022, .006), b = P(.05, .042, .014); bone('hand', a, b, .0075, .0052, .2);
      const a2 = P(.052, .044, .015), b2 = P(.085, .052, .018); bone('hand', a2, b2, .0058, .004, .2);
      const a3 = P(.087, .053, .018), b3 = P(.112, .052, .016); bone('hand', a3, b3, .0052, .0036, .2); }
    // pelvis
    const n = V(s * .8, .05, .45).normalize();
    const il = new THREE.SphereGeometry(1, 22, 16); il.scale(.082, .072, .017);
    add(SK, 'pelvis', il, 'bone', m => { m.position.set(s * .115, .985, -.012); m.lookAt(m.position.clone().add(n)); });
    tube(SK, 'pelvis', 'bone', [V(s * .085, .925, .0), V(s * .1, .96, -.005), V(s * .115, .99, -.01)], .017);
    tube(SK, 'pelvis', 'bone', [V(s * .015, .862, .064), V(s * .04, .84, .048), V(s * .062, .828, -.005), V(s * .07, .868, -.05), V(s * .08, .9, -.02)], .0095);
    tube(SK, 'pelvis', 'bone', [V(s * .085, .925, .0), V(s * .06, .9, .035), V(s * .02, .87, .062)], .0095);
    const ac = new THREE.SphereGeometry(.03, 14, 10); ac.scale(.6, 1, 1); add(SK, 'pelvis', ac, 'bone', m => m.position.set(s * .098, .92, -.003));
    // leg
    const fh = new THREE.SphereGeometry(.022, 14, 10); add(SK, 'femur', fh, 'bone', m => m.position.copy(j.hip));
    tube(SK, 'femur', 'bone', [j.hip.clone(), V(s * .105, .9, .0), V(s * .125, .875, .004)], .0105);
    ell(SK, 'femur', 'bone', V(s * .13, .872, .0), [.013, .018, .016], null, 10);
    bone('femur', V(s * .122, .868, .004), V(s * .104, .512, .012), .027, .0145, .13);
    ell(SK, 'patella', 'bone', V(s * .104, .505, .045), [.016, .02, .01], null, 12);
    bone('tibia', V(s * .1, .488, .012), V(s * .108, .09, -.01), .025, .0125, .12);
    bone('fibula', V(s * .138, .47, -.004), V(s * .139, .082, -.018), .0098, .0058, .1);
    // foot
    ell(SK, 'foot', 'bone', V(s * .11, .042, -.04), [.019, .024, .036], null, 12);
    ell(SK, 'foot', 'bone', V(s * .11, .078, -.012), [.02, .016, .022], null, 12);
    ell(SK, 'foot', 'bone', V(s * .11, .035, .03), [.03, .016, .03], null, 12);
    for (let k = 0; k < 5; k++) {
      const x = s * (.092 + k * .0105 + (k > 0 ? 0 : 0)); const z1 = .06, z2 = .14 + (k === 0 ? .01 : k === 1 ? .018 : .01 - k * .005);
      bone('foot', V(x, .022, z1), V(x + s * .004, .012, z2), .0062, .0042, .2);
      bone('foot', V(x + s * .004, .011, z2 + .002), V(x + s * .006, .009, z2 + .028 - k * .003), .0045, .0034, .2);
    }
  });

  /* ===================== MUSCLES ===================== */
  const MU = (id, a, b, r, o) => { const g = muscleGeo(a.distanceTo(b), r, o); return add('muscle', id, g, 'muscle', m => orient(m, a, b)); };
  const patch = (id, c, nrm, w, h, t, tw = 0) => {
    const g = new THREE.SphereGeometry(1, 28, 20); g.scale(w, h, t);
    return add('muscle', id, g, 'muscle', m => { m.position.copy(c); m.lookAt(c.clone().add(nrm)); m.rotateZ(tw); });
  };
  ell('muscle', 'facial', 'muscle', V(0, 1.662, -.004), [.079, .09, .098], null, 28);
  ell('muscle', 'facial', 'muscle', V(0, 1.6, .03), [.058, .05, .06], null, 18);
  ell('muscle', 'neckm', 'muscle', V(0, 1.488, -.012), [.047, .075, .05], null, 18);
  sym(s => {
    const j = J(s);
    // arm
    MU('deltoid', V(s * .17, 1.445, .0), V(s * .245, 1.27, .004), .046, { belly: .3, wx: 1, wz: 1.08 });
    MU('biceps', V(s * .205, 1.34, .042), V(s * .29, 1.17, .028), .026, { belly: .42 });
    MU('triceps', V(s * .215, 1.35, -.03), V(s * .293, 1.15, -.02), .03, { belly: .38, wz: .9, wx: 1.15 });
    MU('brachioradialis', V(s * .292, 1.16, .02), V(s * .35, .93, .02), .02, { belly: .2 });
    MU('flexors', V(s * .285, 1.14, .008), V(s * .357, .905, .018), .026, { belly: .22, wx: 1.1, wz: .85 });
    MU('extensors', V(s * .31, 1.14, -.015), V(s * .365, .9, -.0), .024, { belly: .25 });
    // torso
    patch('pectoralis', V(s * .072, 1.335, .098), V(s * .25, -.1, 1), .075, .055, .02);
    patch('pectoralis', V(s * .15, 1.355, .06), V(s * .8, .1, .7), .045, .03, .018);
    patch('obliques', V(s * .13, 1.12, .04), V(s * .85, 0, .5), .07, .1, .018, 0);
    patch('serratus', V(s * .15, 1.24, .038), V(s * .92, 0, .35), .04, .06, .014);
    patch('lats', V(s * .1, 1.19, -.085), V(s * .25, 0, -1), .085, .13, .022);
    patch('trapezius', V(s * .055, 1.38, -.09), V(s * .1, .15, -1), .075, .11, .024);
    MU('trapezius', V(s * .02, 1.5, -.03), V(s * .165, 1.445, -.01), .02, { belly: .5, wz: 1.3 });
    MU('erector', V(s * .035, 1.34, -.098), V(s * .04, .99, -.098), .02, { belly: .5, wx: 1.1 });
    MU('scm', V(s * .018, 1.408, .062), V(s * .052, 1.62, -.03), .0125, { belly: .5 });
    MU('masseter', V(s * .066, 1.628, .015), V(s * .056, 1.582, .03), .01, { belly: .5, wx: 1.5 });
    patch('gluteus', V(s * .085, .925, -.095), V(s * .15, -.1, -1), .075, .075, .035);
    patch('glutmed', V(s * .125, .99, -.06), V(s * .5, .1, -.8), .06, .045, .02);
    // rectus abdominis segments
    for (let r = 0; r < 4; r++) {
      const g = new THREE.SphereGeometry(1, 14, 10); g.scale(.026, .021, .012);
      add('muscle', 'rectus', g, 'muscle', m => m.position.set(s * .0285, 1.185 - r * .047, .086 - (r > 1 ? .0 : 0)));
    }
    const g2 = new THREE.SphereGeometry(1, 14, 10); g2.scale(.024, .02, .011); add('muscle', 'rectus', g2, 'muscle', m => m.position.set(s * .028, .995, .09));
    // leg
    MU('rectusfem', V(s * .104, .88, .06), V(s * .106, .56, .056), .034, { belly: .45, wz: .85 });
    MU('vastus', V(s * .145, .85, .01), V(s * .128, .54, .036), .04, { belly: .45, wz: .9 });
    MU('vastusmed', V(s * .075, .66, .05), V(s * .095, .53, .045), .03, { belly: .3 });
    MU('hamstrings', V(s * .124, .88, -.055), V(s * .118, .52, -.04), .032, { belly: .42 });
    MU('hamstrings', V(s * .078, .87, -.052), V(s * .088, .52, -.042), .03, { belly: .4 });
    MU('sartorius', V(s * .145, .94, .042), V(s * .072, .5, .03), .0125, { belly: .5 });
    MU('adductors', V(s * .055, .86, .03), V(s * .08, .6, .02), .029, { belly: .3, wz: .9 });
    MU('gastroc', V(s * .12, .5, -.04), V(s * .112, .19, -.036), .035, { belly: .28 });
    MU('gastroc', V(s * .084, .5, -.04), V(s * .105, .19, -.036), .035, { belly: .28 });
    MU('soleus', V(s * .113, .4, -.024), V(s * .112, .14, -.03), .029, { belly: .35, wz: .9 });
    MU('tibialis', V(s * .124, .46, .03), V(s * .106, .13, .03), .021, { belly: .3 });
    add('muscle', 'achilles', new THREE.CylinderGeometry(.0075, .0095, .12, 8), 'tendon', m => orient(m, V(s * .11, .19, -.036), V(s * .11, .07, -.038)));
  });

  /* ===================== ORGANS ===================== */
  // Brain
  {
    const mk = (sx, sy, sz, amp, fq, seed, fn) => blobGeo(5, [sx, sy, sz], amp, fq, seed, fn);
    const gyri = (v, r) => {
      let rr = r; const ridge = 1 - Math.abs(vnoise(v.x * 11 + 3, v.y * 11, v.z * 11) * 2 - 1);
      rr += (ridge - .6) * .1; if (Math.abs(v.x) < .09) rr -= (.09 - Math.abs(v.x)) * 1.4; if (v.y < -.3) rr -= .04; return rr;
    };
    const g = mk(.066, .058, .08, .0, 1, 0, gyri);
    add('organs', 'brain', g, 'brain', m => m.position.set(0, 1.682, -.006));
    const cb = mk(.04, .024, .03, .06, 6, 5, (v, r) => r + (1 - Math.abs(vnoise(v.x * 24, v.y * 24, v.z * 24) * 2 - 1)) * .06 - .03);
    add('organs', 'cerebellum', cb, 'brain', m => { m.position.set(0, 1.63, -.058); m.material.color.setHex(0xd79a9f); });
    parts.get('cerebellum').mats.brain.color.setHex(0xd8959b);
    add('organs', 'brain', new THREE.CylinderGeometry(.011, .008, .06, 10), 'brain', m => { m.position.set(0, 1.612, -.025); m.rotation.x = -.25; });
  }
  // Eyes + thyroid + esophagus
  sym(s => { ell('organs', 'eyes', 'eye', V(s * .034, 1.632, .082), [.0125, .0125, .0125], null, 14); });
  sym(s => { ell('organs', 'thyroid', 'thyroid', V(s * .014, 1.486, .038), [.01, .02, .008], m => m.rotation.z = s * .15, 10); });
  tube('organs', 'esophagus', 'sint', [V(0, 1.52, -.012), V(0, 1.4, -.03), V(.005, 1.28, -.035), V(.03, 1.2, -.01), V(.05, 1.16, .02)], .0085);
  // Heart group
  const heartGroup = new THREE.Group(); heartGroup.position.set(.026, 1.268, .046); layers.organs.add(heartGroup);
  {
    const addH = (geo, key, setup) => { const m = add('organs', 'heart', geo, key); layers.organs.remove(m); heartGroup.add(m); if (setup) setup(m); return m; };
    const vg = blobGeo(4, [.044, .062, .042], .04, 3, 2, (v, r) => r * (v.y < -.3 ? 1 - (-.3 - v.y) * .35 : 1)); vg.rotateZ(.55);
    addH(vg, 'heart');
    const ra = blobGeo(3, [.026, .03, .028], .04, 4, 3); addH(ra, 'heart', m => m.position.set(-.032, .026, .0));
    const la = blobGeo(3, [.02, .022, .022], .03, 4, 5); addH(la, 'heart', m => m.position.set(.03, .045, -.018));
    const mkT = (pts, r, key) => addH(new THREE.TubeGeometry(crv(pts), 24, r, 10, false), key);
    mkT([V(-.005, .045, .0), V(-.004, .075, .003), V(.012, .095, -.004), V(.03, .085, -.02), V(.036, .04, -.03), V(.034, -.02, -.035)], .0115, 'aorta');
    mkT([V(.012, .035, .022), V(.02, .062, .028), V(.045, .078, .0)], .0085, 'vein');
    mkT([V(-.04, .02, -.01), V(-.042, .065, -.015), V(-.038, .105, -.012)], .0085, 'vein');
    mkT([V(-.04, -.02, -.012), V(-.04, -.07, -.02), V(-.03, -.1, -.03)], .0085, 'vein');
    parts.get('heart').meshes.forEach(m => { m.userData.heart = true; });
    updaters.push(t => { const b = t * 1.25; const ph = (b % 1); const k = ph < .12 ? Math.sin(ph / .12 * Math.PI) : ph > .25 && ph < .4 ? .4 * Math.sin((ph - .25) / .15 * Math.PI) : 0; heartGroup.scale.setScalar(1 + .06 * k); });
  }
  // Lungs
  const lungGroup = new THREE.Group(); layers.organs.add(lungGroup);
  {
    sym(s => {
      const g = blobGeo(4, [s > 0 ? .058 : .066, .105, .066], .05, 2.5, s, (v, r) => { if (s > 0 && v.x < -.2 && v.y < .1) r -= (-.2 - v.x) * .35 * Math.max(0, 1 - Math.abs(v.y + .1) * 2); return r; });
      g.translate(0, 0, 0);
      const m = add('organs', 'lungs', g, 'lung', mm => mm.position.set(s * .088, 1.3, -.006));
      layers.organs.remove(m); lungGroup.add(m); m.userData.breath = true;
    });
    const trach = add('organs', 'trachea', new THREE.CylinderGeometry(.0085, .0085, .16, 14), 'trachea', m => orient(m, V(0, 1.535, -.001), V(0, 1.38, -.015)));
    sym(s => {
      const rnd = ((seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(11 + (s > 0 ? 3 : 0));
      const branch = (p, dir, len, r, depth) => {
        const q = p.clone().addScaledVector(dir, len);
        const g = new THREE.CylinderGeometry(r * .8, r, len, 6); const m = add('organs', 'trachea', g, 'trachea', mm => orient(mm, p, q));
        layers.organs.remove(m); lungGroup.add(m);
        if (depth > 0) for (let k = 0; k < 2; k++) {
          const d2 = dir.clone().add(V((rnd() - .5) * 1.1, (rnd() - .5) * 1.0 - .1, (rnd() - .5) * 1.1)).normalize();
          branch(q, d2, len * .72, r * .72, depth - 1);
        }
      };
      branch(V(s * .003, 1.382, -.015), V(s * .85, -.35, 0).normalize(), .06, .0058, 3);
      lungGroup.children.forEach(c => { });
    });
    lungGroup.children.forEach(m => { if (!m.userData.breath) m.userData.bronch = true; });
    // bronchi are in world space; breathing scales the lung meshes only
    const lungs = parts.get('lungs').meshes;
    updaters.push(t => { const b = 1 + .025 * Math.sin(t * 1.1); lungs.forEach(m => { m.scale.set(b, 1 + .02 * Math.sin(t * 1.1), b); }); });
  }
  // Liver
  {
    const lg = blobGeo(5, [.108, .055, .078], .03, 3, 1, (v, r) => (v.y < 0 ? r * (1 + v.y * .25) : r));
    lg.rotateZ(-.18); lg.rotateX(.1);
    add('organs', 'liver', lg, 'liver', m => m.position.set(-.052, 1.168, .03));
    const ll = blobGeo(4, [.062, .035, .05], .03, 3, 4); ll.rotateZ(.15);
    add('organs', 'liver', ll, 'liver', m => m.position.set(.055, 1.145, .045));
    ell('organs', 'gallbladder', 'green', V(-.03, 1.128, .062), [.011, .022, .011], m => m.rotation.z = .5, 12);
  }
  // stomach, spleen, pancreas, kidneys, bladder
  add('organs', 'stomach', blobGeo(4, [.044, .066, .04], .05, 3, 2, (v, r) => r * (v.y < -.4 ? .86 : 1)), 'stomach', m => { m.position.set(.062, 1.125, .052); m.rotation.z = .85; });
  ell('organs', 'spleen', 'spleen', V(.122, 1.16, -.048), [.019, .045, .026], m => m.rotation.z = -.2, 16);
  add('organs', 'pancreas', tubeVar(crv([V(-.025, 1.092, .005), V(0, 1.1, .01), V(.045, 1.112, -.005), V(.1, 1.14, -.034)]), 40, 10, u => .015 * (1 - u * .45) * (1 + .1 * Math.sin(u * 40))), 'pancreas');
  sym(s => {
    const g = blobGeo(4, [.022, .04, .02], .02, 4, 7, (v, r) => { const med = -s * v.x; return med > 0 ? r * (1 - .38 * Math.exp(-(v.y * v.y + v.z * v.z) / .12) * med) : r; });
    add('organs', 'kidneys', g, 'kidney', m => { m.position.set(s * .06, 1.09, -.062); m.rotation.z = s * .22; });
    ell('organs', 'kidneys', 'pancreas', V(s * .056, 1.135, -.062), [.012, .006, .01], null, 8);
  });
  ell('organs', 'bladder', 'bladder', V(0, .87, .05), [.032, .03, .03], null, 16);
  // intestines
  {
    const pts = []; let dir = 1;
    for (let r = 0; r < 7; r++) {
      const y = 1.0 - r * .018;
      for (let k = 0; k <= 8; k++) { const t = k / 8; const x = (dir > 0 ? -.085 + .17 * t : .085 - .17 * t); pts.push(V(x * .92, y + Math.sin(t * Math.PI * 3 + r) * .009, .045 + Math.sin(t * Math.PI * 2 + r * 1.7) * .014)); }
      dir = -dir;
    }
    const c = crv(pts);
    add('organs', 'sintestine', tubeVar(c, 400, 10, u => .0105 * (1 + .12 * Math.sin(u * 220)) * Math.min(1, u * 40, (1 - u) * 40 + .2)), 'sint');
    const lc = crv([V(-.095, .915, .035), V(-.105, .98, .04), V(-.1, 1.05, .04), V(-.06, 1.082, .07), V(0, 1.07, .08), V(.06, 1.082, .07), V(.1, 1.05, .042), V(.108, .98, .036), V(.1, .92, .03), V(.06, .875, .04), V(.025, .875, .03), V(0, .845, -.03)]);
    add('organs', 'lintestine', tubeVar(lc, 300, 12, u => .0165 * (1 + .16 * Math.sin(u * 140)) * (u > .93 ? .75 : 1)), 'lint');
  }

  /* ===================== VESSELS ===================== */
  {
    const art = (id, pts, r, key = 'aorta') => tube('vessels', id, key, pts, r);
    art('aorta', [V(.021, 1.34, .04), V(.035, 1.4, .02), V(.045, 1.385, -.01), V(.035, 1.33, -.04), V(.022, 1.2, -.042), V(.015, 1.08, -.04), V(.01, .98, -.03)], .0105);
    art('vena', [V(-.026, 1.34, .04), V(-.028, 1.2, -.0), V(-.03, 1.08, -.03), V(-.015, .98, -.03)], .0105, 'vein');
    art('carotid', [V(.032, 1.4, .02), V(.034, 1.5, .01), V(.04, 1.6, .0), V(.025, 1.67, -.02)], .0045);
    art('carotid', [V(-.032, 1.4, .02), V(-.034, 1.5, .01), V(-.04, 1.6, .0), V(-.025, 1.67, -.02)], .0045, 'vein');
    sym(s => {
      art('brachial', [V(s * .04, 1.385, .0), V(s * .12, 1.43, .02), V(s * .2, 1.38, .02), V(s * .26, 1.26, .025), V(s * .29, 1.13, .02), V(s * .33, .99, .025), V(s * .362, .88, .022), V(s * .385, .74, .03)], .0045);
      art('brachial', [V(s * .05, 1.37, -.005), V(s * .12, 1.41, .01), V(s * .21, 1.36, .0), V(s * .272, 1.24, .008), V(s * .3, 1.12, .004), V(s * .345, .98, .008), V(s * .366, .88, .006)], .0042, 'vein');
      art('femoral', [V(s * .012, .985, -.03), V(s * .05, .94, -.01), V(s * .08, .88, .025), V(s * .078, .78, .035), V(s * .088, .62, .03), V(s * .098, .5, -.012), V(s * .102, .35, -.03), V(s * .11, .2, -.012), V(s * .112, .09, .02), V(s * .115, .03, .1)], .0042);
      art('femoral', [V(s * -.01, .985, -.03), V(s * .04, .94, -.005), V(s * .068, .88, .02), V(s * .066, .78, .03), V(s * .078, .62, .022), V(s * .09, .5, -.022), V(s * .093, .35, -.038), V(s * .1, .2, -.02), V(s * .104, .09, .015)], .0044, 'vein');
    });
  }
  /* ===================== NERVES ===================== */
  {
    const cc = []; for (let y = 1.58; y >= 1.12; y -= .04) cc.push(V(0, y, spineZ(y) - .03));
    tube('nerves', 'cord', 'nerve', cc, .0058, null, 50);
    for (let k = 0; k < 8; k++) { const y = 1.12 - k * .007; sym(s => tube('nerves', 'cord', 'nerve', [V(0, y, spineZ(1.12) - .03), V(s * .006, y - .06 - k * .004, spineZ(1.0) - .05), V(s * .012 * (k + 1) * .4, .98 - k * .01, -.075)], .0012)); }
    sym(s => {
      tube('nerves', 'plexus', 'nerve', [V(s * .01, 1.455, -.07), V(s * .06, 1.455, -.05), V(s * .13, 1.43, -.03), V(s * .19, 1.37, -.018), V(s * .26, 1.2, -.032), V(s * .298, 1.11, -.034), V(s * .335, .98, -.012), V(s * .364, .88, .0), V(s * .385, .73, .012)], .0032);
      tube('nerves', 'plexus', 'nerve', [V(s * .13, 1.43, -.03), V(s * .2, 1.4, .03), V(s * .27, 1.24, .03), V(s * .292, 1.135, .015), V(s * .35, .95, .02)], .0022);
      tube('nerves', 'sciatic', 'nerve', [V(s * .012, .995, -.095), V(s * .07, .93, -.085), V(s * .105, .83, -.06), V(s * .108, .66, -.052), V(s * .11, .52, -.042), V(s * .12, .33, -.015), V(s * .125, .18, .0), V(s * .118, .08, .05), V(s * .11, .03, .12)], .0042);
      tube('nerves', 'sciatic', 'nerve', [V(s * .11, .52, -.042), V(s * .09, .4, -.03), V(s * .1, .2, -.012), V(s * .095, .09, .02)], .0026);
      // intercostal hint
      for (let i = 2; i < 9; i++) { const v = vert[7 + i]; tube('nerves', 'cord', 'nerve', [V(s * .006, v.y, v.z - .035), V(s * .05, v.y - .006, v.z - .02), V(s * .1, v.y - .02, -.01), V(s * .13, v.y - .03, .04)], .0011); }
    });
  }

  /* ---------- label anchors ---------- */
  const labels = [
    { id: 'brain', text: 'Brain', pos: V(.0, 1.76, 0), layer: 'organs' },
    { id: 'heart', text: 'Heart & vessels', pos: V(.07, 1.29, .07), layer: 'organs' },
    { id: 'lungs', text: 'Lungs', pos: V(-.15, 1.36, .02), layer: 'organs' },
    { id: 'liver', text: 'Liver', pos: V(-.12, 1.17, .06), layer: 'organs' },
    { id: 'stomach', text: 'Stomach', pos: V(.11, 1.12, .07), layer: 'organs' },
    { id: 'kidneys', text: 'Kidneys', pos: V(-.07, 1.09, -.07), layer: 'organs' },
    { id: 'sintestine', text: 'Gut', pos: V(.06, .96, .07), layer: 'organs' },
    { id: 'cord', text: 'Spinal cord', pos: V(0, 1.35, -.11), layer: 'nerves' },
    { id: 'skull', text: 'Skull', pos: V(.1, 1.68, 0), layer: 'skeleton' },
    { id: 'ribs', text: 'Rib cage', pos: V(-.15, 1.25, .06), layer: 'skeleton' },
    { id: 'pelvis', text: 'Pelvis', pos: V(-.15, .97, .02), layer: 'skeleton' },
    { id: 'femur', text: 'Femur', pos: V(-.13, .72, .02), layer: 'skeleton' },
    { id: 'humerus', text: 'Humerus', pos: V(.26, 1.25, .02), layer: 'skeleton' },
    { id: 'pectoralis', text: 'Pectoralis', pos: V(-.13, 1.34, .1), layer: 'muscle' },
    { id: 'biceps', text: 'Biceps', pos: V(.3, 1.24, .05), layer: 'muscle' },
    { id: 'rectus', text: 'Rectus abdominis', pos: V(.0, 1.1, .12), layer: 'muscle' },
    { id: 'rectusfem', text: 'Quadriceps', pos: V(-.14, .72, .07), layer: 'muscle' },
    { id: 'gastroc', text: 'Calf', pos: V(.17, .33, -.04), layer: 'muscle' },
    { id: 'skin', text: 'Skin', pos: V(.17, 1.6, .06), layer: 'skin' },
  ];

  const update = (t) => { updaters.forEach(f => f(t)); skinMat.uniforms.uTime.value = t; };
  return { root, layers, parts, labels, update, skinMat };
}

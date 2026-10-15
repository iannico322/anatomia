import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadRealBody, LAYER_INFO } from './real.js';
import { buildCell, CELL_INFO } from './cells.js';
import { initLearn } from './learn.js';
import { initChem } from './chem.js';

const $ = s => document.querySelector(s);
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), .04).texture;

/* ============ BODY SCENE ============ */
const bodyScene = new THREE.Scene();
bodyScene.background = new THREE.Color(0x05060e);
bodyScene.fog = new THREE.Fog(0x05060e, 5, 12);
bodyScene.environment = envTex; bodyScene.environmentIntensity = .35;
const camBody = new THREE.PerspectiveCamera(32, 1, .02, 60);
const BODY_HOME = { pos: new THREE.Vector3(0, 1.12, 3.5), tgt: new THREE.Vector3(0, .93, 0) };
camBody.position.copy(BODY_HOME.pos);
const ctrl = new OrbitControls(camBody, canvas);
ctrl.target.copy(BODY_HOME.tgt); ctrl.enableDamping = true; ctrl.dampingFactor = .08; ctrl.minDistance = .3; ctrl.maxDistance = 6.5;
ctrl.autoRotate = true; ctrl.autoRotateSpeed = .8; ctrl.screenSpacePanning = true;

bodyScene.add(new THREE.HemisphereLight(0xbfd0ff, 0x1a0a22, .9));
const key = new THREE.DirectionalLight(0xfff0e0, 2.1); key.position.set(2.5, 4, 3.5); bodyScene.add(key);
const rimA = new THREE.DirectionalLight(0x7a6cff, 2.2); rimA.position.set(-3, 2, -3); bodyScene.add(rimA);
const rimB = new THREE.DirectionalLight(0xff6a9a, 1.4); rimB.position.set(3, 1, -2.5); bodyScene.add(rimB);
const fill = new THREE.PointLight(0xffffff, 1.2, 0, 2); camBody.add(fill); bodyScene.add(camBody);

function boot(body) {
bodyScene.add(body.root);
const { parts } = body;

// floor glow + rings (like a holographic stage)
{
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(120,110,255,.55)'); gr.addColorStop(.5, 'rgba(70,60,200,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -.002; bodyScene.add(disc);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x8f86ff, transparent: true, opacity: .55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  [[.62, .004], [.9, .002], [1.25, .0015]].forEach(([r, w], i) => { const m = new THREE.Mesh(new THREE.RingGeometry(r, r + w, 128), ringMat.clone()); m.material.opacity = .6 - i * .17; m.rotation.x = -Math.PI / 2; m.position.y = .003; bodyScene.add(m); });
  const orbit = new THREE.Mesh(new THREE.RingGeometry(.85, .853, 160), new THREE.MeshBasicMaterial({ color: 0xff8a5c, transparent: true, opacity: .55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  orbit.position.set(0, 1.2, 0); orbit.rotation.x = Math.PI / 2 - .05; orbit.scale.set(1, .55, 1); orbit.name = 'orbit'; bodyScene.add(orbit);
  const orbit2 = orbit.clone(); orbit2.material = orbit.material.clone(); orbit2.material.color.set(0x8f86ff); orbit2.scale.set(.75, .75, 1); orbit2.position.y = 1.15; orbit2.rotation.set(Math.PI / 2 + .3, 0, .6); bodyScene.add(orbit2);
  body.rings = [orbit, orbit2];
  // starfield
  const n = 500; const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 5 + Math.random() * 5, a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1; const s = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = u * r * .6 + 1.5; p[i * 3 + 2] = Math.sin(a) * s * r; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  bodyScene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9aa8ff, size: .02, transparent: true, opacity: .6, depthWrite: false })));
}

/* ============ CELL SCENE ============ */
const cellScene = new THREE.Scene();
cellScene.background = new THREE.Color(0x060818);
cellScene.fog = new THREE.FogExp2(0x060818, .022);
cellScene.environment = envTex; cellScene.environmentIntensity = .25;
const camCell = new THREE.PerspectiveCamera(40, 1, .05, 200);
const ctrlCell = new OrbitControls(camCell, canvas);
ctrlCell.enableDamping = true; ctrlCell.dampingFactor = .07; ctrlCell.enabled = false; ctrlCell.minDistance = 1.5; ctrlCell.maxDistance = 40;
ctrlCell.autoRotate = true; ctrlCell.autoRotateSpeed = .5;
cellScene.add(new THREE.HemisphereLight(0xaabbff, 0x201030, .45));
const ck = new THREE.DirectionalLight(0xffffff, 1.25); ck.position.set(5, 8, 6); cellScene.add(ck);
const cp1 = new THREE.PointLight(0xff7ad9, 35, 0, 2); cp1.position.set(-6, 2, 4); cellScene.add(cp1);
const cp2 = new THREE.PointLight(0x6ad1ff, 35, 0, 2); cp2.position.set(6, -3, -4); cellScene.add(cp2);
cellScene.add(camCell);
const cfill = new THREE.PointLight(0xffffff, 14, 0, 2); camCell.add(cfill);

/* ============ STATE ============ */
let mode = 'body';
let selected = null, hoverId = null, sub = null, subHover = null, lastPickPart = null, explode = 0;
const learn = { quiz: false, onPick: null };
let cellCur = null, cellHolder = null;
let showLabels = true, isolate = false;
const LAYER_KEYS = Object.keys(LAYER_INFO);
const lstate = {}; LAYER_KEYS.forEach(k => lstate[k] = { lock: null, value: 1 });
let peel = 0;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function peelValues(p) {
  const org = (p < .2 ? 1 - smooth(.06, .2, p) : smooth(.34, .46, p) * (1 - .85 * smooth(.75, .95, p)));
  return {
    skin: 1 - smooth(.1, .26, p),
    muscle: smooth(.12, .28, p) * (1 - smooth(.34, .46, p)),
    organs: org,
    vessels: org,
    nerves: smooth(.6, .8, p) * (1 - .7 * smooth(.9, 1, p)),
    skeleton: smooth(.45, .8, p),
  };
}
const effective = k => lstate[k].lock !== null ? lstate[k].lock : lstate[k].value;

function applyOpacity() {
  const pv = peelValues(peel);
  LAYER_KEYS.forEach(k => { lstate[k].value = pv[k]; body.setLayerOpacity(k, effective(k)); });
  body.setStates(selected, subHover || hoverId, isolate, sub);
  pickCache = body.pickables(k => effective(k) > .3);
  syncLayerUI();
}
let pickCache = [];
function refreshHighlights() { body.setStates(selected, subHover || hoverId, isolate, sub); }

/* ---------- picking ---------- */
const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
function pickAt(cx, cy) {
  const r = canvas.getBoundingClientRect(); mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camBody);
  const hits = ray.intersectObjects(pickCache, false);
  lastPickPart = hits.length ? hits[0].object.userData.part : null;
  return hits.length ? hits[0].object.userData.ent : null;
}
let lastMove = 0, downAt = null;
canvas.addEventListener('pointermove', e => {
  if (mode !== 'body' || chemOn) return; const now = performance.now(); if (now - lastMove < 40) return; lastMove = now;
  if (e.buttons) return;
  if (learn.quiz) { hoverTip.style.opacity = 0; return; }
  let id = pickAt(e.clientX, e.clientY); if (id && id === selected && parts.get(id).children) id = lastPickPart; if (id !== hoverId) { hoverId = id; refreshHighlights(); canvas.style.cursor = id ? 'pointer' : 'grab'; showHover(id, e); }
  moveHover(e);
});
canvas.addEventListener('pointerleave', () => { hoverTip.style.opacity = 0; });
canvas.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; ctrl.autoRotate = false; $('#opt-rotate').checked = false; });
canvas.addEventListener('pointerup', e => {
  if (!downAt || mode !== 'body' || chemOn) return; const d = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y), dt = performance.now() - downAt.t; downAt = null;
  if (d < 5 && dt < 500) { const id = pickAt(e.clientX, e.clientY); if (learn.quiz) { if (learn.onPick) learn.onPick(id, lastPickPart, e.clientX, e.clientY); return; } if (id && id === selected && parts.get(id).children && lastPickPart) selectSub(lastPickPart); else if (id) selectPart(id); else if (selected) deselect(); }
});
const hoverTip = $('#hovertip');
function showHover(id) { if (!id) { hoverTip.style.opacity = 0; return; } const p = parts.get(id); hoverTip.textContent = p.name + (p.parent ? " · " + parts.get(p.parent).name : ""); hoverTip.style.opacity = 1; }
function moveHover(e) { hoverTip.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 12}px)`; }

/* ---------- camera tween ---------- */
let tween = null;
function flyTo(pos, tgt, dur = 900, cam = camBody, ctl = ctrl) {
  tween = { t0: performance.now(), dur, p0: cam.position.clone(), t0v: ctl.target.clone(), p1: pos.clone(), t1v: tgt.clone(), cam, ctl };
}
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function stepTween() {
  if (!tween) return; const k = Math.min(1, (performance.now() - tween.t0) / tween.dur); const e = ease(k);
  tween.cam.position.lerpVectors(tween.p0, tween.p1, e); tween.ctl.target.lerpVectors(tween.t0v, tween.t1v, e); if (k >= 1) tween = null;
}
function partBox(p) { const b = new THREE.Box3(); p.meshes.forEach(m => { m.updateWorldMatrix(true, false); b.expandByObject(m); }); return b; }

/* ---------- selection ---------- */
function revealLayer(layer) {
  if (effective(layer) <= .35) lstate[layer].lock = 1;
  if (layer !== 'muscle' && layer !== 'skin') { if (effective('muscle') > .2) lstate.muscle.lock = 0; }
  if (layer === 'skeleton') { if (effective('organs') > .3) lstate.organs.lock = .15; if (effective('vessels') > .3) lstate.vessels.lock = .15; }
  if (layer === 'nerves' || layer === 'vessels') { if (effective('skeleton') > .5) lstate.skeleton.lock = .25; }
  if (layer === 'organs') { if (effective('skeleton') > .5) lstate.skeleton.lock = .25; }
  if (layer === 'muscle') { if (effective('organs') > .3) lstate.organs.lock = 0; }
}
function selectPart(id, focus = true) {
  if (mode !== 'body') return;
  const p = parts.get(id); if (!p) return; selected = id; sub = null; subHover = null; setExplodeAmt(0); revealLayer(p.layer); applyOpacity(); refreshHighlights(); showInfo(p);
  if (focus && p.id !== 'g:Skin') {
    const b = partBox(p); const c = b.getCenter(new THREE.Vector3()); const s = b.getSize(new THREE.Vector3()); const size = Math.max(s.x, s.y, s.z * 1.2);
    const dist = Math.min(4, Math.max(.55, size * 2.4 + .35));
    const dir = camBody.position.clone().sub(ctrl.target).normalize(); if (dir.z < .2 && Math.abs(c.x) < .01) dir.z = .5;
    const dirF = dir.clone(); dirF.y = Math.max(-.2, Math.min(.5, dirF.y));
    flyTo(c.clone().addScaledVector(dirF.normalize(), dist), c, 1000);
  } else if (p.id === 'g:Skin') flyTo(BODY_HOME.pos, BODY_HOME.tgt, 900);
  ctrl.autoRotate = false; $('#opt-rotate').checked = false;
}
function setExplodeAmt(v) { explode = v; body.setExplode(v > 0 || explode > 0 ? selected : null, v); }
function selectSub(key) {
  const e = parts.get(key); if (!e || !selected) return; sub = key;
  refreshHighlights(); showInfo(parts.get(selected));
  const b = partBox(e); const c = b.getCenter(new THREE.Vector3()); const sz = b.getSize(new THREE.Vector3()); const size = Math.max(sz.x, sz.y, sz.z * 1.2);
  const dir = camBody.position.clone().sub(ctrl.target).normalize(); dir.y = Math.max(-.2, Math.min(.5, dir.y));
  flyTo(c.clone().addScaledVector(dir.normalize(), Math.min(2.2, Math.max(.3, size * 2.6 + .25))), c, 800);
}
function openEntity(key) { const e = parts.get(key); if (!e) return; if (e.parent && parts.get(e.parent)) { selectPart(e.parent, false); selectSub(key); } else selectPart(key); }
function deselect() { selected = null; sub = null; subHover = null; setExplodeAmt(0); applyOpacity(); refreshHighlights(); showInfo(null); }

/* ---------- labels ---------- */
const tagsEl = $('#tags'); let tagEls = [];
function buildTags(list, isCell) {
  tagsEl.innerHTML = ''; tagEls = [];
  list.forEach((l, i) => {
    const b = document.createElement('button'); b.className = 'tag' + (isCell ? ' cell' : ''); b.innerHTML = `<i></i><span>${l.text}</span>`;
    b.addEventListener('click', ev => { ev.stopPropagation(); if (isCell) selectCellLabel(i); else selectPart(l.id); });
    tagsEl.appendChild(b); tagEls.push({ el: b, l, v: new THREE.Vector3() });
  });
}
const marker = $('#marker');
function updateTags() {
  const cam = mode === 'body' ? camBody : camCell; const W = canvas.clientWidth, H = canvas.clientHeight;
  tagEls.forEach(t => {
    const l = t.l; let vis = showLabels && !l.hidden;
    if (mode === 'body') vis = vis && effective(l.layer) > .4 && !(isolate && selected && l.id !== selected);
    if (!vis) { t.el.style.display = 'none'; return; }
    t.v.copy(l.pos).project(cam);
    if (t.v.z > 1 || t.v.z < -1) { t.el.style.display = 'none'; return; }
    t.el.style.display = ''; t.el.style.transform = `translate(${(t.v.x * .5 + .5) * W}px,${(-t.v.y * .5 + .5) * H}px) translate(-12px,-50%)`;
    t.el.classList.toggle('on', mode === 'body' ? l.id === selected : l.idx === activeCellLabel);
  });
  // selection marker
  if (mode === 'body' && selected && selected !== 'g:Skin' && markerPos) {
    const v = markerPos.clone().project(camBody); marker.style.display = 'block'; marker.style.transform = `translate(${(v.x * .5 + .5) * W}px,${(-v.y * .5 + .5) * H}px)`;
  } else marker.style.display = 'none';
}
let markerPos = null;

/* ---------- UI: layers ---------- */
const layersEl = $('#layers');
LAYER_KEYS.forEach(k => {
  const row = document.createElement('div'); row.className = 'lrow'; row.dataset.k = k;
  row.innerHTML = `<button class="eye" title="Toggle layer"><span style="--c:${LAYER_INFO[k].color}"></span></button><label>${LAYER_INFO[k].name}</label><input type="range" min="0" max="100" value="100" aria-label="${LAYER_INFO[k].name} opacity">`;
  row.querySelector('.eye').addEventListener('click', () => { lstate[k].lock = effective(k) > .3 ? 0 : 1; applyOpacity(); });
  row.querySelector('input').addEventListener('input', e => { lstate[k].lock = e.target.value / 100; applyOpacity(); });
  layersEl.appendChild(row);
});
function syncLayerUI() {
  LAYER_KEYS.forEach(k => { const row = layersEl.querySelector(`[data-k=${k}]`); const v = effective(k); row.querySelector('input').value = Math.round(v * 100); row.classList.toggle('off', v < .05); row.classList.toggle('locked', lstate[k].lock !== null); });
}
const peelEl = $('#peel');
function setPeel(v, resetLocks = true) { peel = v; if (resetLocks) LAYER_KEYS.forEach(k => lstate[k].lock = null); peelEl.value = Math.round(v * 1000); applyOpacity(); updateStage(); }
peelEl.addEventListener('input', () => { setPeel(peelEl.value / 1000); });
function updateStage() {
  const stages = [[0, 'Surface'], [.27, 'Muscle'], [.6, 'Organs'], [1, 'Skeleton']];
  let best = 0, bd = 9; stages.forEach(([v], i) => { const d = Math.abs(peel - v); if (d < bd) { bd = d; best = i; } });
  document.querySelectorAll('#stages button').forEach((b, i) => b.classList.toggle('on', i === best));
}
let peelAnim = null;
document.querySelectorAll('#stages button').forEach((b, i) => b.addEventListener('click', () => {
  const to = [0, .27, .6, 1][i]; const from = peel; const t0 = performance.now(); cancelAnimationFrame(peelAnim);
  const f = () => { const k = Math.min(1, (performance.now() - t0) / 900); setPeel(from + (to - from) * ease(k)); if (k < 1) peelAnim = requestAnimationFrame(f); }; f();
}));
$('#opt-labels').addEventListener('change', e => { showLabels = e.target.checked; });
$('#opt-rotate').addEventListener('change', e => { ctrl.autoRotate = e.target.checked; ctrlCell.autoRotate = e.target.checked; });
$('#btn-reset').addEventListener('click', () => { if (mode === 'body') { deselect(); flyTo(BODY_HOME.pos, BODY_HOME.tgt, 900); } else if (cellCur) flyTo(cellCur.cam.pos, cellCur.cam.target, 900, camCell, ctrlCell); });

/* ---------- UI: search ---------- */
const searchEl = $('#search'), resEl = $('#results');
const partList = [...parts.values()].filter(p => p.id !== 'g:Skin').sort((a, b) => a.name.localeCompare(b.name));
function renderResults(q) {
  resEl.innerHTML = ''; if (!q) { resEl.style.display = 'none'; return; }
  const ql = q.toLowerCase(); const PL = partList.filter(p => !p.hidden); const m = [...PL.filter(p => p.name.toLowerCase().includes(ql) || p.system.includes(ql)), ...PL.filter(p => !p.name.toLowerCase().includes(ql) && !p.system.includes(ql) && p.desc.toLowerCase().includes(ql))].slice(0, 9);
  m.forEach(p => { const b = document.createElement('button'); b.innerHTML = `<i style="background:${LAYER_INFO[p.layer].color}"></i>${p.name}<small>${LAYER_INFO[p.layer].name}</small>`; b.addEventListener('click', () => { if (mode !== 'body') exitCell(() => openEntity(p.id)); else openEntity(p.id); searchEl.value = ''; renderResults(''); }); resEl.appendChild(b); });
  resEl.style.display = m.length ? 'block' : 'none';
}
searchEl.addEventListener('input', () => renderResults(searchEl.value.trim()));
searchEl.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = resEl.querySelector('button'); if (f) f.click(); } });
document.addEventListener('click', e => { if (!e.target.closest('.search')) resEl.style.display = 'none'; });

/* ---------- UI: info card ---------- */
const infoEl = $('#info');
const QUICK = body.quick;
function showInfo(p) {
  if (!p && learn.quiz) { markerPos = null; infoEl.innerHTML = `<div class="eyebrow">Quiz mode</div><h2>Test yourself</h2><p class="desc">Labels, hover names and the structure list are hidden. Click in the 3D view to answer.</p>`; return; }
  if (!p) {
    markerPos = null;
    infoEl.innerHTML = `<div class="eyebrow">Explore</div><h2>Click any structure</h2>
      <p class="desc">Peel the body from skin to muscle, organs and bone, then pick a structure and zoom all the way down to its cells.</p>
      <div class="quick-h">Jump to</div><div class="quick">${QUICK.map(q => `<button data-id="${q.key}">${q.label}</button>`).join('')}</div>
      <div class="ladder"><div class="quick-h">Scales you can visit</div><div class="steps">${['Body', 'Organ', 'Tissue', 'Cell', 'Organelle'].map((s, i) => `<span class="${i === 0 ? 'on' : ''}">${s}</span>`).join('<b>›</b>')}</div></div>`;
    infoEl.querySelectorAll('.quick button').forEach(b => b.addEventListener('click', () => openEntity(b.dataset.id)));
    return;
  }
  const ci = CELL_INFO[p.cell] || CELL_INFO.epithelium; const L = LAYER_INFO[p.layer];
  markerPos = partBox(sub && parts.get(sub) ? parts.get(sub) : p).getCenter(new THREE.Vector3());
  const sp = sub ? parts.get(sub) : null; const shown = sp || p;
  let partsHtml = '';
  if (p.children) {
    const kids = p.children.map(k => parts.get(k)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    partsHtml = `<div class="parts"><div class="quick-h">Parts of ${p.name} <span class="cnt">${kids.length}</span></div>
      ${kids.length > 12 ? '<input id="pfilter" class="pfilter" placeholder="Filter parts…" autocomplete="off">' : ''}
      ${kids.length > 1 ? `<div class="expl"><span>Explode</span><input id="explode" type="range" min="0" max="100" value="${Math.round(explode * 100)}" aria-label="Explode parts"></div>` : ''}
      <div class="plist" id="plist">${kids.map(k => `<button data-k="${k.id}" class="${k.id === sub ? 'on' : ''}">${k.name.replace(/ \((left|right)\)$/, '')}${k.side ? `<small>${k.side}</small>` : ''}</button>`).join('')}</div></div>`;
  }
  infoEl.innerHTML = `<div class="eyebrow"><i style="background:${L.color}"></i>${L.name}${sp ? ` · <a href="#" id="backorg">‹ ${p.name}</a>` : ''}</div><h2>${shown.name}</h2><p class="desc">${shown.desc}</p>${partsHtml}
    <div class="cellcard"><div class="quick-h">Goes down to</div><div class="cc-name">${ci.label}</div><div class="cc-sub">${ci.blurb}</div>
      <div class="ladder"><div class="steps"><span class="on">Body</span><b>›</b><button data-l="tissue">Tissue</button><b>›</b><button data-l="cell">Cell</button><b>›</b><button data-l="organelle">Organelle</button></div></div>
      <button class="cta" data-l="tissue">Explore at cell level <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
    <div class="row-btns"><label class="chk"><input type="checkbox" id="opt-iso" ${isolate ? 'checked' : ''}> Isolate</label><button id="btn-desel" class="ghost">Clear selection</button></div>`;
  infoEl.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', () => enterCell((sp && sp.cell) || p.cell || 'epithelium', b.dataset.l)));
  const pl = $('#plist');
  if (pl) {
    pl.querySelectorAll('button').forEach(b => { b.addEventListener('click', () => selectSub(b.dataset.k)); b.addEventListener('mouseenter', () => { subHover = b.dataset.k; refreshHighlights(); }); b.addEventListener('mouseleave', () => { subHover = null; refreshHighlights(); }); });
    const pf = $('#pfilter'); if (pf) pf.addEventListener('input', () => { const q = pf.value.toLowerCase(); pl.querySelectorAll('button').forEach(b => { b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none'; }); });
    const ex = $('#explode'); if (ex) ex.addEventListener('input', () => setExplodeAmt(ex.value / 100));
    const bk = $('#backorg'); if (bk) bk.addEventListener('click', ev => { ev.preventDefault(); sub = null; refreshHighlights(); showInfo(parts.get(selected)); });
    const act = pl.querySelector('button.on'); if (act) act.scrollIntoView({ block: 'nearest' });
  }
  $('#opt-iso').addEventListener('change', e => { isolate = e.target.checked; applyOpacity(); });
  $('#btn-desel').addEventListener('click', deselect);
}

/* =============== CELL MODE =============== */
let activeCellLabel = -1; let savedBody = null;
const fx = $('#fx');
function zoomTransition(fn, dir = 'in') {
  fx.classList.add('on'); canvas.style.transition = 'transform .55s cubic-bezier(.6,0,.9,.4), filter .55s'; canvas.style.transform = dir === 'in' ? 'scale(1.5)' : 'scale(.7)'; canvas.style.filter = 'blur(8px) brightness(1.6)';
  setTimeout(() => {
    fn(); canvas.style.transition = 'none'; canvas.style.transform = dir === 'in' ? 'scale(.72)' : 'scale(1.4)';
    void canvas.offsetWidth;
    canvas.style.transition = 'transform .8s cubic-bezier(.1,.7,.2,1), filter .8s'; canvas.style.transform = 'scale(1)'; canvas.style.filter = 'none'; fx.classList.remove('on');
    setTimeout(() => { canvas.style.filter = 'none'; canvas.style.transform = 'none'; canvas.style.transition = 'none'; }, 950);
  }, 560);
}
function loadCell(type, level) {
  if (cellHolder) { cellScene.remove(cellHolder); cellHolder.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  cellCur = buildCell(type, level); cellHolder = cellCur.group; cellScene.add(cellHolder);
  camCell.position.copy(cellCur.cam.pos); ctrlCell.target.copy(cellCur.cam.target); ctrlCell.update();
  cellCur.labels.forEach((l, i) => l.idx = i);
  buildTags(cellCur.labels.map((l, i) => ({ ...l, idx: i })), true); activeCellLabel = -1;
  showCellInfo(); updateHud();
}
function enterCell(type, level = 'tissue') {
  if (mode === 'body') {
    hoverId = null; hoverTip.style.opacity = 0; refreshHighlights();
    savedBody = { pos: camBody.position.clone(), tgt: ctrl.target.clone() };
    document.body.classList.add('cellmode');
    flyTo(ctrl.target.clone().add(camBody.position.clone().sub(ctrl.target).multiplyScalar(.45)), ctrl.target, 500);
    zoomTransition(() => { mode = 'cell'; ctrl.enabled = false; ctrlCell.enabled = true; loadCell(type, level); }, 'in');
  } else zoomTransition(() => loadCell(type, level), level === 'tissue' ? 'out' : 'in');
}
function exitCell(after) {
  document.body.classList.remove('cellmode');
  zoomTransition(() => { mode = 'body'; ctrlCell.enabled = false; ctrl.enabled = true; buildTags(body.labels, false); cellCur = null; tween = null; if (savedBody) { camBody.position.copy(savedBody.pos); ctrl.target.copy(savedBody.tgt); ctrl.update(); } showInfo(selected ? parts.get(selected) : null); updateHud(); if (after) after(); }, 'out');
}
const LEVELS = ['tissue', 'cell', 'organelle'];
const LEVEL_NAMES = { tissue: 'Tissue', cell: 'Cell', organelle: 'Organelles' };
function updateHud() {
  const crumbs = $('#crumbs');
  if (mode === 'body') { crumbs.innerHTML = `<span class="on">Whole body</span>`; return; }
  const ci = CELL_INFO[cellCur.type];
  crumbs.innerHTML = `<button id="cr-body">Whole body</button><b>›</b><span>${ci.label}</span><b>›</b><span class="on">${LEVEL_NAMES[cellCur.level]}</span>`;
  $('#cr-body').addEventListener('click', () => exitCell());
  document.querySelectorAll('#ladder button').forEach(b => b.classList.toggle('on', b.dataset.l === cellCur.level));
  $('#cellsel').value = cellCur.type;
  const sc = ci[cellCur.level]; $('#scalebar').innerHTML = `<b>${sc[0]}</b><span>${sc[1]}</span>`;
}
function showCellInfo() {
  const ci = CELL_INFO[cellCur.type]; const lvl = cellCur.level; const sc = ci[lvl];
  const blurbs = { tissue: ci.blurb, cell: `A single ${sc[0].toLowerCase()}, the basic living unit of this tissue.`, organelle: 'The machinery inside every cell: nucleus, ER, Golgi, mitochondria and more. Click the labels to learn what each part does.' };
  infoEl.innerHTML = `<div class="eyebrow"><i style="background:#8b7bff"></i>${LEVEL_NAMES[lvl]} level</div><h2>${sc[0]}</h2><p class="desc">${blurbs[lvl]}</p>
    <div class="quick-h">Structures · click to learn</div><div class="quick" id="hot">${cellCur.labels.map((l, i) => `<button data-i="${i}">${l.text}</button>`).join('')}</div><div id="hotdesc" class="hotdesc"></div>`;
  infoEl.querySelectorAll('#hot button').forEach(b => b.addEventListener('click', () => selectCellLabel(+b.dataset.i)));
}
function selectCellLabel(i) {
  activeCellLabel = i; const l = cellCur.labels[i];
  $('#hotdesc').innerHTML = `<b>${l.text}</b><p>${l.desc}</p>`; document.querySelectorAll('#hot button').forEach((b, k) => b.classList.toggle('on', k === i));
  const t = l.pos.clone(); const dir = camCell.position.clone().sub(t).normalize(); const dist = Math.max(3.5, camCell.position.distanceTo(ctrlCell.target) * .7);
  flyTo(t.clone().addScaledVector(dir, dist), t, 900, camCell, ctrlCell);
}
document.querySelectorAll('#ladder button').forEach(b => b.addEventListener('click', () => { if (cellCur && b.dataset.l !== cellCur.level) enterCell(cellCur.type, b.dataset.l); }));
$('#btn-back').addEventListener('click', () => exitCell());
const sel = $('#cellsel'); Object.entries(CELL_INFO).forEach(([k, v]) => { const o = document.createElement('option'); o.value = k; o.textContent = v.label; sel.appendChild(o); });
sel.addEventListener('change', () => enterCell(sel.value, cellCur.level));
document.addEventListener('keydown', e => {
  if (chemOn) return;
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (e.key === 'Escape') { if (mode === 'cell') exitCell(); else if (selected) deselect(); }
  if (e.key.toLowerCase() === 'g' && mode === 'body') applySex(body.sex === 'm' ? 'f' : 'm');
  if (e.key.toLowerCase() === 'l') { showLabels = !showLabels; $('#opt-labels').checked = showLabels; }
  if (e.key.toLowerCase() === 'r') $('#btn-reset').click();
});

/* ---------- resize / loop ---------- */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false);
  camBody.aspect = camCell.aspect = w / h; camBody.updateProjectionMatrix(); camCell.updateProjectionMatrix();
  // keep the body framed on narrow screens
  camBody.fov = w / h < .9 ? 46 : 32; camBody.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
let chemOn = false, chem = null; const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  if (chemOn) { chem.frame(dt, t); requestAnimationFrame(frame); return; }
  stepTween();
  if (mode === 'body') {
    body.update(t); body.rings[0].rotation.z += dt * .25; body.rings[1].rotation.z -= dt * .18;
    ctrl.update(); renderer.render(bodyScene, camBody);
  } else if (cellCur) { cellCur.update(t, dt); ctrlCell.update(); renderer.render(cellScene, camCell); }
  updateTags();
  requestAnimationFrame(frame);
}


/* ---------- UI: sex ---------- */
function applySex(sx, animate) {
  if (body.sex === sx) return;
  if (selected && selected !== 'g:Skin') { const e = parts.get(selected); if (e && e.sex && e.sex !== sx) { selected = null; showInfo(null); } }
  body.setSex(sx); applyOpacity(); refreshHighlights();
  document.querySelectorAll('#sex button').forEach(b => { const on = b.dataset.s === sx; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  buildTags(body.labels, false); if (selected) showInfo(parts.get(selected)); else showInfo(null);
  try { localStorage.setItem('anatomia.sex', sx); } catch (e) { }
}
document.querySelectorAll('#sex button').forEach(b => b.addEventListener('click', () => { if (mode !== 'body') exitCell(() => applySex(b.dataset.s)); else applySex(b.dataset.s); }));

/* ---------- boot ---------- */
resize();
buildTags(body.labels, false);
setPeel(0); showInfo(null); updateHud(); refreshHighlights();
try { const sv = localStorage.getItem('anatomia.sex'); if (sv === 'f') applySex('f'); } catch (e) { }
initLearn({ renderer, bodyScene, body, parts, learn, lstate, camBody, ctrl, mode: () => mode, exitCell, enterCell, setPeel, peel: () => peel, applyOpacity, flyTo, BODY_HOME, deselect, selectPart, showInfo, canvas, renderBody: () => renderer.render(bodyScene, camBody), effective, LAYER_INFO, sex: () => body.sex, getLabels: () => showLabels, setLabels: v => { showLabels = v; $('#opt-labels').checked = v; }, setInfoHtml: h => { infoEl.innerHTML = h; markerPos = null; } });
chem = initChem({ renderer, canvas, envTex, exitMode: () => setMode('anat') });
let saved = null;
function setMode(m) {
  const want = m === 'chem'; if (want === chemOn) return;
  if (want) { saved = [ctrl.enabled, ctrlCell.enabled]; ctrl.enabled = ctrlCell.enabled = false; chemOn = true; document.body.classList.add('chemmode'); chem.enter(); }
  else { chem.exit(); chemOn = false; document.body.classList.remove('chemmode'); if (saved) { ctrl.enabled = saved[0]; ctrlCell.enabled = saved[1]; } }
  document.querySelectorAll('#modesw button').forEach(b => b.classList.toggle('on', (b.dataset.m === 'chem') === chemOn));
  document.title = chemOn ? 'Anatomia · Chemistry Lab' : 'Anatomia · 3D Human Atlas';
}
document.querySelectorAll('#modesw button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
window.__setMode = setMode;
$('#loading').classList.add('gone');
frame();
window.__app = { selectPart, enterCell, exitCell, setPeel, camBody, ctrl, get mode() { return mode; }, parts, flyTo, lstate, body, applySex, learn };
}

/* ---------- load ---------- */
const loadMsg = $('#loading small') || $('#loading');
loadRealBody((k, f) => { try { loadMsg.dataset.p = Math.round(k * 100); const bar = $('#loadbar'); if (bar) bar.style.width = (k * 100) + '%'; const t = $('#loadtxt'); if (t) t.textContent = 'Loading ' + f + '…'; } catch (e) { } })
  .then(boot).catch(err => { console.error(err); const t = $('#loadtxt'); if (t) t.textContent = 'Could not load anatomy models: ' + err.message; });

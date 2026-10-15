import * as THREE from 'three';

const $ = s => document.querySelector(s);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initLearn(ctx) {
  const { body, parts, learn, lstate, camBody, ctrl } = ctx;
  const bar = $('#learnbar');
  let active = null; // 'tour' | 'quiz'
  const show = html => { bar.innerHTML = html; bar.classList.add('on'); };
  const hide = () => { bar.classList.remove('on'); bar.innerHTML = ''; };
  const needBody = fn => { if (ctx.mode() !== 'body') ctx.exitCell(fn); else fn(); };
  const setLocks = o => { ctx.setPeel(ctx.peel(), true); Object.keys(lstate).forEach(k => { lstate[k].lock = o[k] ?? 0; }); ctx.applyOpacity(); };
  const flyAt = (c, dist, dir = [0.25, 0.1, 1]) => { const d = new THREE.Vector3(...dir).normalize(); ctx.flyTo(c.clone().addScaledVector(d, dist), c, 1000); };
  const bodyHome = () => ctx.flyTo(ctx.BODY_HOME.pos, ctx.BODY_HOME.tgt, 1000);
  const keyOf = re => { const e = body.find(re); return e ? e.key : null; };

  /* ======================= GUIDED TOUR ======================= */
  const STEPS = [
    { t: 'The surface', x: 'Start with the skin: your largest organ (about 2 m²). It is a waterproof barrier, a thermostat and a sensor in one. Everything you are about to see lies underneath it.', go: () => { ctx.deselect(); ctx.setPeel(0); bodyHome(); } },
    { t: 'Muscle: the engine', x: 'Around 600 skeletal muscles pull on bones through tendons. Look at the fibre direction: muscles pull along their length. Click any muscle later to learn its name and job.', go: () => { ctx.deselect(); ctx.setPeel(.2); flyAt(new THREE.Vector3(0, 1.05, 0), 3, [0.2, .05, 1]); } },
    { t: 'Skeleton: the frame', x: '206 bones protect organs, anchor muscles, store calcium and make blood cells in the marrow. The ribcage shields the heart and lungs; the skull shields the brain.', go: () => { ctx.deselect(); ctx.setPeel(.88); flyAt(new THREE.Vector3(0, 1.0, 0), 3.2, [0.3, .05, 1]); } },
    { t: 'Heart: the pump', x: 'Four chambers and four valves keep blood flowing one way, about 100,000 beats a day. Use the parts list on the right, and drag the Explode slider to pull the heart apart.', go: () => { ctx.setPeel(.5); ctx.selectPart('g:Heart'); } },
    { t: 'Lungs: gas exchange', x: 'Three lobes on the right, two on the left (the heart takes up the space). About 480 million tiny alveoli give a gas-exchange surface of around 70 m².', go: () => { ctx.setPeel(.5); ctx.selectPart('g:Lungs'); } },
    { t: 'Digestion', x: 'Food travels oesophagus, stomach, small intestine, colon. The liver and pancreas add bile and enzymes. Try selecting the liver and opening its segments.', go: () => { ctx.setPeel(.5); const k = keyOf(/^stomach$/i); if (k) ctx.selectPart(k); } },
    { t: 'Brain and nerves', x: 'The brain has about 86 billion neurons. Nerves branch from the spinal cord to every part of the body, carrying signals at up to 120 m/s.', go: () => { ctx.setPeel(.5); ctx.selectPart('g:Brain'); lstate.nerves.lock = 1; lstate.vessels.lock = .2; ctx.applyOpacity(); } },
    { t: 'Blood vessels', x: 'Red arteries carry oxygen-rich blood away from the heart; blue veins bring it back. Laid end to end, the vessels would stretch roughly 100,000 km.', go: () => { ctx.deselect(); setLocks({ vessels: 1, organs: .35, skin: .1 }); flyAt(new THREE.Vector3(0, 1.0, 0), 3.2, [0.2, .05, 1]); } },
    { t: 'Down to the cell', x: 'Every organ is built of tissue, tissue of cells, cells of organelles. Heart muscle cells are joined end to end by intercalated discs so they beat as one. Click the labels to explore.', go: () => { ctx.enterCell('cardiac', 'tissue'); } },
  ];
  let ti = 0;
  function tourRender() {
    const s = STEPS[ti];
    show(`<div class="lb-top"><span class="lb-badge">Guided tour · ${ti + 1}/${STEPS.length}</span><div class="lb-dots">${STEPS.map((_, i) => `<i class="${i === ti ? 'on' : i < ti ? 'done' : ''}"></i>`).join('')}</div></div>
      <h3>${s.t}</h3><p>${s.x}</p>
      <div class="lb-btns"><button class="ghost" id="t-back" ${ti === 0 ? 'disabled' : ''}>‹ Back</button><button class="ghost" id="t-exit">Exit tour</button><button class="cta sm" id="t-next">${ti === STEPS.length - 1 ? 'Finish' : 'Next ›'}</button></div>`);
    $('#t-back').onclick = () => tourGo(ti - 1); $('#t-next').onclick = () => (ti === STEPS.length - 1 ? tourStop() : tourGo(ti + 1)); $('#t-exit').onclick = tourStop;
  }
  function tourGo(i) { ti = Math.max(0, Math.min(STEPS.length - 1, i)); const run = () => { STEPS[ti].go(); tourRender(); }; needBody(run); tourRender(); }
  function tourStart() { stop(); active = 'tour'; ctx.deselect(); ti = 0; tourGo(0); }
  function tourStop() { active = null; hide(); needBody(() => { ctx.deselect(); ctx.setPeel(0); bodyHome(); ctx.showInfo(null); }); }

  /* ======================= QUIZ ======================= */
  const CATS = [['all', 'Everything'], ['organs', 'Organs'], ['skeleton', 'Bones'], ['muscle', 'Muscles'], ['vessels+nerves', 'Vessels & nerves']];
  let Q = null; let savedLabels = true;
  function quizMenu() {
    show(`<div class="lb-top"><span class="lb-badge">Quiz</span></div><h3>Find the structure</h3><p>You will be asked to click structures in the 3D body. Names and labels are hidden. 10 questions.</p>
      <div class="lb-cats">${CATS.map(([k, n], i) => `<button class="${i === 0 ? 'on' : ''}" data-c="${k}">${n}</button>`).join('')}</div>
      <div class="lb-btns"><button class="ghost" id="q-exit">Cancel</button><button class="cta sm" id="q-start">Start quiz ›</button></div>`);
    let cat = 'all'; bar.querySelectorAll('.lb-cats button').forEach(b => b.onclick = () => { cat = b.dataset.c; bar.querySelectorAll('.lb-cats button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#q-exit').onclick = quizStop; $('#q-start').onclick = () => quizBegin(cat);
  }
  function quizStart() { stop(); active = 'quiz'; ctx.deselect(); savedLabels = ctx.getLabels(); ctx.setLabels(false); learn.quiz = true; learn.onPick = onPick; ctx.setInfoHtml(`<div class="eyebrow">Quiz mode</div><h2>Test yourself</h2><p class="desc">Hover tips, labels and the structure list are hidden. Click in the 3D view to answer.</p>`); needBody(() => { ctx.setPeel(0); bodyHome(); }); quizMenu(); }
  function quizBegin(cat) {
    const cats = cat === 'all' ? null : cat.split('+');
    const pool = body.quizItems.filter(q => !cats || cats.includes(q.layer));
    Q = { items: shuffle(pool).slice(0, 10), i: 0, score: 0, tries: 0, done: false, missed: [], locked: false };
    quizAsk();
  }
  const isMatch = (item, entKey, partKey) => { if (!entKey) return false; if (item.key) return entKey === item.key; const pe = parts.get(partKey || entKey); return !!pe && item.re.test(pe.name); };
  const targetEntity = item => item.key ? parts.get(item.key) : body.find(item.re);
  function quizAsk() {
    const item = Q.items[Q.i]; Q.tries = 0; Q.locked = false;
    const L = item.layer;
    ctx.deselect(); ctx.setPeel(0);
    const lk = { skin: .1, skeleton: L === 'skeleton' ? 1 : .15, muscle: L === 'muscle' ? 1 : 0, organs: L === 'organs' ? 1 : (L === 'vessels' || L === 'nerves' ? .3 : 0), vessels: L === 'vessels' ? 1 : 0, nerves: L === 'nerves' ? 1 : 0 };
    if (L === 'nerves') lk.skeleton = .15;
    Object.keys(lk).forEach(k => { lstate[k].lock = lk[k]; }); ctx.applyOpacity(); body.setStates(null, null, false, null);
    const e = targetEntity(item); const par = e && e.parent ? parts.get(e.parent) : null;
    if (par) { const b = body.boxOf(par); flyAt(b.getCenter(new THREE.Vector3()), 1.0); } else bodyHome();
    quizRender();
  }
  function quizRender(msg = '', cls = '') {
    const item = Q.items[Q.i];
    show(`<div class="lb-top"><span class="lb-badge">Quiz · ${Q.i + 1}/${Q.items.length}</span><span class="lb-score">Score ${Q.score % 1 ? Q.score.toFixed(1) : Q.score}</span></div>
      <h3>Click the <b>${esc(item.name)}</b></h3><p class="lb-msg ${cls}">${msg || (item.layer === 'muscle' ? 'Muscles are shown. Hint: they are paired left and right.' : item.layer === 'skeleton' ? 'Bones are shown, the other layers are faded.' : item.layer === 'organs' ? 'Organs are shown, with vessels faded in the background.' : 'Find it in the body.')}</p>
      <div class="lb-btns"><button class="ghost" id="q-exit">Exit</button><button class="ghost" id="q-hint" ${Q.locked ? 'disabled' : ''}>Hint (−½)</button><button class="ghost" id="q-skip" ${Q.locked ? 'disabled' : ''}>Skip</button>${Q.locked ? `<button class="cta sm" id="q-next">${Q.i === Q.items.length - 1 ? 'See results' : 'Next ›'}</button>` : ''}</div>`);
    $('#q-exit').onclick = quizStop;
    if (!Q.locked) { $('#q-hint').onclick = quizHint; $('#q-skip').onclick = () => reveal(false); } else $('#q-next').onclick = quizNext;
  }
  function highlightTarget(item) { const e = targetEntity(item); if (!e) return; const k = e.parent || e.key; const par = e.parent ? parts.get(k) : null; body.setStates(par ? k : e.key, null, false, par ? e.key : null); }
  function quizHint() { Q.hinted = true; const item = Q.items[Q.i]; const e = targetEntity(item); if (!e) return; body.setStates(null, e.key, false, null); setTimeout(() => { if (!Q.locked) body.setStates(null, null, false, null); }, 1600); Q.tries = Math.max(Q.tries, 1); }
  function reveal(ok) { Q.locked = true; const item = Q.items[Q.i]; if (!ok) Q.missed.push(item.name); highlightTarget(item); const e = targetEntity(item); if (e) { const b = body.boxOf(e); const c = b.getCenter(new THREE.Vector3()); flyAt(c, Math.max(.7, b.getSize(new THREE.Vector3()).length() * 1.8 + .3)); } quizRender(ok ? '' : 'This is the structure you were looking for.', ok ? 'ok' : 'bad'); }
  function onPick(entKey, partKey) {
    if (!Q || Q.locked || !entKey) return;
    const item = Q.items[Q.i];
    if (isMatch(item, entKey, partKey)) { Q.score += Q.tries === 0 ? 1 : .5; reveal(true); bar.querySelector('.lb-msg').textContent = Q.tries === 0 ? 'Correct!' : 'Correct, on the second try.'; bar.querySelector('.lb-msg').className = 'lb-msg ok'; return; }
    Q.tries++;
    const pe = parts.get(partKey || entKey); const nm = pe ? (pe.parent ? parts.get(pe.parent).name : pe.name) : 'something else';
    if (Q.tries >= 2) { reveal(false); bar.querySelector('.lb-msg').textContent = `Not quite. You clicked: ${nm}. Here is the ${item.name}.`; } else quizRender(`Not quite. That was the ${nm}. Try once more.`, 'bad');
  }
  function quizNext() { if (Q.i >= Q.items.length - 1) return quizResults(); Q.i++; quizAsk(); }
  function quizResults() {
    const n = Q.items.length, pct = Math.round(Q.score / n * 100);
    show(`<div class="lb-top"><span class="lb-badge">Results</span></div><h3>${Q.score % 1 ? Q.score.toFixed(1) : Q.score} / ${n} <small>${pct}%</small></h3>
      <p>${pct >= 90 ? 'Outstanding anatomy knowledge!' : pct >= 70 ? 'Nice work. A little more practice and you will have it.' : 'Good start. Try the guided tour, then quiz again.'}</p>
      ${Q.missed.length ? `<p class="lb-missed">Review: ${Q.missed.map(esc).join(', ')}</p>` : ''}
      <div class="lb-btns"><button class="ghost" id="q-exit">Close</button><button class="cta sm" id="q-again">Play again ›</button></div>`);
    ctx.deselect(); body.setStates(null, null, false, null); ctx.setPeel(0); bodyHome();
    $('#q-exit').onclick = quizStop; $('#q-again').onclick = quizMenu;
  }
  function quizStop() { active = null; learn.quiz = false; learn.onPick = null; Q = null; ctx.setLabels(savedLabels); hide(); ctx.deselect(); ctx.setPeel(0); bodyHome(); ctx.showInfo(null); }

  function stop() { if (active === 'quiz') { learn.quiz = false; learn.onPick = null; Q = null; ctx.setLabels(savedLabels); } active = null; hide(); }

  /* ======================= PRINTABLE SHEET ======================= */
  function printSheet() {
    needBody(() => setTimeout(doPrint, ctx.mode() === 'body' ? 0 : 900));
  }
  function doPrint() {
    const cand = body.labels.filter(l => !l.hidden && ctx.effective(l.layer) > .4);
    if (!cand.length) { alert('Nothing to label in this view. Peel to a layer with labels first.'); return; }
    // frame the labelled region with a temporary camera and render at print resolution
    const bb = new THREE.Box3(); cand.forEach(l => bb.expandByPoint(l.pos)); const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const IW = 900, IH = 1100, asp = IW / IH; const cam = camBody.clone(); cam.aspect = asp; cam.fov = 32;
    const need = Math.max(sz.y * 1.35 + .25, (sz.x * 1.35 + .25) / asp); const dist = Math.max(1.1, Math.min(4.2, (need / 2) / Math.tan(cam.fov * Math.PI / 360)));
    cam.position.copy(c).add(new THREE.Vector3(0, .04, 1).normalize().multiplyScalar(dist)); cam.lookAt(c); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const r = ctx.renderer, pr = r.getPixelRatio(), W0 = ctx.canvas.clientWidth, H0 = ctx.canvas.clientHeight;
    r.setPixelRatio(1); r.setSize(IW, IH, false); r.render(ctx.bodyScene, cam); const url = ctx.canvas.toDataURL('image/jpeg', .92);
    r.setPixelRatio(pr); r.setSize(W0, H0, false);
    const items = [];
    cand.forEach(l => { const v = l.pos.clone().project(cam); if (v.z > 1) return; const px = v.x * .5 + .5, py = -v.y * .5 + .5; if (px < .03 || px > .97 || py < .02 || py > .98) return; items.push({ n: 0, text: l.text, px, py, desc: (parts.get(l.id) || {}).desc || '' }); });
    for (let it = 0; it < 40; it++) for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const A = items[i], B = items[j]; let dx = (B.px - A.px) * IW, dy = (B.py - A.py) * IH; const d = Math.hypot(dx, dy) || .01, m = 30; if (d < m) { const k = (m - d) / 2 / d; if (Math.abs(dx) < .5 && Math.abs(dy) < .5) dx = 1; A.px -= dx * k / IW; A.py -= dy * k / IH; B.px += dx * k / IW; B.py += dy * k / IH; } }
    items.sort((a, b) => a.py - b.py); items.forEach((it, i) => it.n = i + 1);
    if (!items.length) { alert('Nothing to label in this view. Peel to a layer with labels first.'); return; }
    const L2 = Object.keys(ctx.LAYER_INFO).filter(k => ctx.effective(k) > .4).map(k => ctx.LAYER_INFO[k].name).join(', ');
    const aspect = (900 / 1100).toFixed(4);
    const marks = (key) => items.map(it => `<span class="mk" style="left:${(it.px * 100).toFixed(2)}%;top:${(it.py * 100).toFixed(2)}%">${it.n}</span>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Anatomia label sheet</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0;background:#eee}
      .page{background:#fff;width:210mm;min-height:297mm;margin:10px auto;padding:12mm;page-break-after:always}h1{font-size:20px;margin:0 0 2px}.sub{color:#555;margin:0 0 10px;font-size:12px}
      .row{display:flex;gap:14px;align-items:flex-start}.fig{position:relative;width:96mm;aspect-ratio:${aspect};border-radius:8px;overflow:hidden;background:#05060e;flex:none}.fig img{width:100%;height:100%;display:block}
      .mk{position:absolute;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#fff;color:#111;border:2px solid #e0305a;font:700 10px/14px system-ui;text-align:center}
      ol.lines{margin:0;padding:0;list-style:none;flex:1}ol.lines li{display:flex;gap:8px;align-items:flex-end;margin:0 0 9px;font-size:13px}ol.lines b{width:22px;height:22px;border-radius:50%;background:#e0305a;color:#fff;text-align:center;line-height:22px;font-size:11px;flex:none}ol.lines i{flex:1;border-bottom:1px solid #444;height:20px}
      ol.key{padding-left:0;list-style:none;margin:0}ol.key li{margin:0 0 7px;font-size:12.5px}ol.key strong{display:inline-block;min-width:22px}ol.key span{color:#444}
      .nm{display:flex;gap:30px;margin:0 0 12px;font-size:13px}.nm span{border-bottom:1px solid #444;flex:1;height:18px}.foot{margin-top:14px;font-size:10px;color:#666}
      .bar{position:sticky;top:0;background:#222;color:#fff;padding:8px 14px;display:flex;gap:10px;align-items:center}.bar button{padding:6px 14px;border-radius:6px;border:0;background:#8b7bff;color:#fff;font-weight:600;cursor:pointer}
      @media print{body{background:#fff}.page{margin:0;padding:0;width:auto;min-height:0}.bar{display:none}}
    </style></head><body><div class="bar"><button onclick="window.print()">Print</button><span>Page 1: worksheet · Page 2: answer key</span></div>
    <section class="page"><h1>Label the diagram</h1><p class="sub">View: ${esc(L2)}${ctx.sex() === 'f' ? ' · female model' : ''}</p><div class="nm"><div style="flex:1">Name <span></span></div><div style="flex:1">Date <span></span></div></div>
      <div class="row"><div class="fig"><img src="${url}" alt="">${marks()}</div><ol class="lines">${items.map(it => `<li><b>${it.n}</b><i></i></li>`).join('')}</ol></div>
      <p class="foot">Generated with Anatomia. Models: Z-Anatomy / BodyParts3D, CC BY-SA 4.0.</p></section>
    <section class="page"><h1>Answer key</h1><p class="sub">View: ${esc(L2)}</p><div class="row"><div class="fig"><img src="${url}" alt="">${marks()}</div>
      <ol class="key">${items.map(it => `<li><strong>${it.n}.</strong> <b>${esc(it.text)}</b><br><span>${esc(it.desc)}</span></li>`).join('')}</ol></div>
      <p class="foot">Generated with Anatomia. Models: Z-Anatomy / BodyParts3D, CC BY-SA 4.0.</p></section></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'anatomia-label-sheet.html'; a.click(); }
  }

  $('#btn-tour').addEventListener('click', tourStart);
  $('#btn-quiz').addEventListener('click', quizStart);
  $('#btn-print').addEventListener('click', printSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && active === 'tour') tourStop(); });
}

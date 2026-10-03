// Lógica de la guía: módulos, animaciones en cascada, perspectivas, tarjetas y examen.
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const LETTERS = 'ABCD';
  const EXAM_SIZE = 15;

  const state = {
    m: 0, sel: 0, flip: {}, t: 0,  // módulo, rama elegida, tarjetas volteadas, paso de animación
    pp: 0, sc: 0, ln: null,        // perspectiva, situación, columna destacada
    qp: 'start', qi: 0, qa: {},    // fase del examen, pregunta actual, respuestas
  };
  let timer = null;
  let quiz = QB.slice(0, EXAM_SIZE);
  let lastPct = 0;
  const used = new Set();

  // Toma 4, 4, 4 y 3 preguntas por módulo, primero las no vistas, y baraja las opciones.
  function pickExam() {
    const counts = [4, 4, 4, 3], out = [];
    const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
    counts.forEach((n, m) => {
      const pool = QB.map((q, i) => ({ q, i })).filter(x => x.q.m === m);
      let fresh = pool.filter(x => !used.has(x.i));
      if (fresh.length < n) { pool.forEach(x => used.delete(x.i)); fresh = pool; }
      shuffle(fresh).slice(0, n).forEach(x => {
        used.add(x.i);
        const idx = shuffle([0, 1, 2, 3]);
        out.push({ ...x.q, o: idx.map(j => x.q.o[j]), a: idx.indexOf(x.q.a) });
      });
    });
    return out;
  }

  // — Animación: las ramas y luego las letras aparecen una a una cada 330 ms —
  function startAnimation() {
    clearInterval(timer);
    state.t = 0;
    timer = setInterval(() => {
      if (state.t >= 30) return clearInterval(timer);
      state.t++;
      applyAnimation();
    }, 330);
  }
  function applyAnimation() {
    const n = DATA[state.m].branches.length;
    [...$('map-branches').children].forEach((el, i) => el.classList.toggle('in', state.t > i));
    [...$('tiles').children].forEach((el, i) => el.classList.toggle('in', state.t > n + i));
  }

  // — Módulo —
  function goModule(m, scroll) {
    state.m = m; state.sel = 0; state.flip = {};
    renderModule();
    startAnimation();
    if (scroll) window.scrollTo(0, 0);
  }

  function renderModule() {
    const d = DATA[state.m], m = state.m;

    $('tabs').innerHTML = DATA.map((x, i) =>
      `<button class="tab${i === m ? ' on' : ''}" data-action="tab" data-i="${i}"><div class="tab-n">Módulo ${x.n}</div><div class="tab-name">${esc(x.name)}</div></button>`).join('');

    $('map-center').textContent = d.center;
    $('map-branches').innerHTML = d.branches.map((b, i) =>
      `<div class="map-branch"><div class="map-twig"></div><button class="map-node" data-action="branch" data-i="${i}">${esc(b[0])}</button></div>`).join('');
    renderDetail();

    $('m2-only').hidden = m !== 1;
    if (m === 1) { renderPerspective(); renderScenes(); }

    $('mn-title').textContent = d.mn.title;
    $('tiles').innerHTML = d.mn.tiles.map(x =>
      `<div class="tile"><div class="tile-l">${esc(x[0])}</div><div class="tile-w">${esc(x[1])}</div><div class="tile-d">${esc(x[2])}</div></div>`).join('');
    $('mn-tip').textContent = d.mn.tip;

    $('points').innerHTML = SUM[m].points.map((p, i) => `<div class="point"><b>${i + 1}</b><div>${esc(p)}</div></div>`).join('');
    $('tips').innerHTML = SUM[m].tips.map(p => `<div class="tip">${esc(p)}</div>`).join('');

    $('cards').innerHTML = d.cards.concat(EXTRA[m]).map((c, i) =>
      `<button class="card" data-action="card" data-i="${i}"><div class="card-tag"></div><div class="card-text"></div></button>`).join('');
    [...$('cards').children].forEach(updateCard);

    $('next-mod').hidden = m >= 3;
    if (m < 3) $('next-name').textContent = `Módulo ${m + 2}: ${DATA[m + 1].name}`;

    $('exam').hidden = m !== 3;
    if (m === 3) renderQuiz();
  }

  // — Mapa mental: detalle de la rama elegida —
  function renderDetail() {
    const d = DATA[state.m], n = d.branches.length, i = Math.min(state.sel, n - 1), b = d.branches[i];
    [...$('map-branches').querySelectorAll('.map-node')].forEach((el, j) => el.classList.toggle('on', j === i));
    const bullets = b[1].split(/(?<=\.)\s+/).filter(Boolean);
    $('map-detail').innerHTML = `
      <div class="label">Concepto ${i + 1} de ${n}</div>
      <div class="map-title">${esc(b[0])}</div>
      <div>
        <div class="label muted" style="margin-bottom:4px">Puntos clave</div>
        ${bullets.map(t => `<div class="bullet"><b>■</b><div>${esc(t)}</div></div>`).join('')}
      </div>
      <div class="ruled"><div class="label muted">Ejemplo</div><div class="body">${esc(b[2])}</div></div>
      <div class="remember"><div class="label on-dark">Recuerde</div><div class="body">${esc(MORE[state.m][i])}</div></div>
      <div class="btn-row">
        <button class="btn" data-action="branch-step" data-d="-1">← Anterior</button>
        <button class="btn dark" data-action="branch-step" data-d="1">Siguiente →</button>
      </div>`;
  }

  // — Módulo 2: las cinco perspectivas —
  function renderPerspective() {
    const p = PERS[state.pp];
    $('ptabs').innerHTML = PERS.map((x, i) =>
      `<button class="ptab${i === state.pp ? ' on' : ''}" data-action="persp" data-i="${i}">${esc(x[0])}</button>`).join('');
    $('persp').innerHTML = `
      <div class="phero">
        <div class="phero-n">Perspectiva ${state.pp + 1} de 5</div>
        <div><div class="phero-name">${esc(p[0])}</div><div class="phero-tag">${esc(p[1])}</div></div>
      </div>
      <div class="pbody">
        <div><div class="label">Idea central</div><div class="body">${esc(p[2])}</div></div>
        <div><div class="label">Pregunta que se hace</div><div class="body" style="font-weight:600">${esc(p[3])}</div></div>
        <div><div class="label">Se enfoca en</div><div class="body">${esc(p[4])}</div></div>
        <div class="ruled"><div class="label">Personas asociadas</div><div class="pwho">${esc(p[5])}</div></div>
        <div class="btn-row">
          <button class="btn" data-action="persp-step" data-d="-1">← Anterior</button>
          <button class="btn dark" data-action="persp-step" data-d="1">Siguiente →</button>
        </div>
      </div>`;
  }

  // — Módulo 2: comparación por situación (las columnas se actualizan en su lugar para animar) —
  function renderScenes() {
    $('scenes').innerHTML = SCENES.map((s, i) =>
      `<button class="toggle scene${i === state.sc ? ' on' : ''}" data-action="scene" data-i="${i}">${esc(s.label)}</button>`).join('');
    if (!$('lens').children.length) {
      $('lens').innerHTML = LENS.map((l, i) =>
        `<button class="lens" data-action="lens" data-i="${i}"><div class="lens-name">${esc(l[0])}</div><div class="lens-focus">${esc(l[1])}</div><div class="lens-text"></div></button>`).join('');
    }
    [...$('lens').children].forEach((el, i) => {
      el.querySelector('.lens-text').textContent = SCENES[state.sc].t[i];
      el.classList.toggle('on', state.ln === i);
      el.classList.toggle('dim', state.ln != null && state.ln !== i);
    });
  }

  // — Tarjetas de repaso —
  function updateCard(el) {
    const i = +el.dataset.i, c = DATA[state.m].cards.concat(EXTRA[state.m])[i], f = !!state.flip[i];
    el.classList.toggle('flipped', f);
    el.querySelector('.card-tag').textContent = f ? 'Respuesta' : c[0];
    el.querySelector('.card-text').textContent = f ? c[2] : c[1];
  }

  // — Examen —
  function renderQuiz() {
    const box = $('exam-body'), { qp, qi, qa } = state;
    if (qp === 'start') {
      box.innerHTML = `<div class="panel exam-start"><div>Responda sin consultar la guía. No hay retroalimentación hasta terminar.</div><button class="btn-accent" data-action="q-begin">Comenzar examen →</button></div>`;
    } else if (qp === 'q') {
      const q = quiz[qi], answered = qa[qi] != null, pct = (qi + (answered ? 1 : 0)) / EXAM_SIZE * 100;
      box.innerHTML = `
        <div class="panel">
          <div class="progress"><div style="width:${lastPct}%"></div></div>
          <div class="q-body">
            <div class="label">Pregunta ${qi + 1} de ${EXAM_SIZE} · Módulo ${q.m + 1}</div>
            <div class="q-text">${esc(q.q)}</div>
            <div class="q-opts">${q.o.map((t, j) =>
              `<button class="toggle q-opt${qa[qi] === j ? ' on' : ''}" data-action="q-pick" data-i="${j}"><b>${LETTERS[j]}</b><span>${esc(t)}</span></button>`).join('')}</div>
            <div class="q-nav">
              <button class="btn${qi ? '' : ' faded'}" data-action="q-prev">← Anterior</button>
              <button class="btn dark${answered ? '' : ' faded'}" data-action="q-next">${qi >= EXAM_SIZE - 1 ? 'Ver resultados' : 'Siguiente →'}</button>
            </div>
          </div>
        </div>`;
      const bar = box.querySelector('.progress div');
      bar.getBoundingClientRect();
      bar.style.width = pct + '%';
      lastPct = pct;
    } else {
      box.innerHTML = renderResults();
    }
  }

  function renderResults() {
    const { qa } = state;
    const score = quiz.filter((q, i) => qa[i] === q.a).length, pct = Math.round(score / EXAM_SIZE * 100);
    const level = pct >= 85 ? 'Excelente' : pct >= 70 ? 'Bien' : pct >= 50 ? 'En progreso' : 'Necesita repaso';
    const msg = pct >= 85 ? 'Dominio sólido del capítulo.' : pct >= 70 ? 'Buen manejo; repase las áreas marcadas.'
      : pct >= 50 ? 'Comprende lo básico; refuerce las áreas marcadas.' : 'Vuelva a los mapas y mnemotecnias de cada módulo antes de repetir.';
    const mods = [0, 1, 2, 3].map(m => {
      const qs = quiz.map((q, i) => ({ q, i })).filter(x => x.q.m === m);
      const ok = qs.filter(x => qa[x.i] === x.q.a).length, p = Math.round(ok / qs.length * 100);
      return `<div class="mod-row">
        <div class="mod-head"><span>Módulo ${m + 1}: ${esc(MODN[m])}</span><span>${ok}/${qs.length}</span></div>
        <div class="mod-bar"><div style="width:${p}%;background:${p >= 75 ? 'var(--color-text)' : 'var(--color-accent)'}"></div></div>
        <div class="mod-tag">${p >= 75 ? 'Dominado' : p >= 50 ? 'Reforzar' : 'Repasar a fondo'}</div>
      </div>`;
    }).join('');
    const weak = quiz.filter((q, i) => qa[i] !== q.a);
    const rows = quiz.map((q, i) => {
      const ok = qa[i] === q.a;
      return `<div class="review">
        <div class="review-mark${ok ? '' : ' wrong'}">${ok ? '✓' : '✗'}</div>
        <div class="review-body">
          <div class="q">${i + 1}. ${esc(q.q)}</div>
          <div>Su respuesta: ${esc(qa[i] != null ? q.o[qa[i]] : 'Sin responder')}</div>
          <div>Correcta: ${esc(q.o[q.a])}</div>
          <div class="why">${esc(q.e)}</div>
        </div>
      </div>`;
    }).join('');
    return `
      <div class="panel">
        <div class="res-grid">
          <div class="res-score">
            <div class="phero-n">Su puntuación</div>
            <div class="res-num">${score}<span> / ${EXAM_SIZE}</span></div>
            <div class="res-level">${pct}% · ${level}</div>
            <div class="res-msg">${msg}</div>
          </div>
          <div class="res-mods"><div class="label">Resultado por módulo</div>${mods}</div>
        </div>
        <div class="res-block">
          <div class="label">Áreas para reforzar o repasar</div>
          ${weak.length ? '' : '<div style="line-height:1.5;padding:8px 0">Respondió correctamente todas las preguntas. Repase las tarjetas de cada módulo para mantener lo aprendido.</div>'}
          ${weak.map(q => `<div class="weak">
            <div><div class="weak-area">${esc(q.area)}</div><div class="weak-mod">Módulo ${q.m + 1} · ${esc(MODN[q.m])}</div></div>
            <button class="btn" data-action="review-mod" data-i="${q.m}">Repasar módulo ${q.m + 1} ↑</button>
          </div>`).join('')}
        </div>
        <div class="res-block"><div class="label">Revisión de respuestas</div>${rows}</div>
        <div class="res-foot"><button class="btn-accent" data-action="q-begin">↻ Repetir examen</button></div>
      </div>`;
  }

  // — Eventos —
  const actions = {
    'tab': i => goModule(i, false),
    'next-mod': () => goModule(state.m + 1, true),
    'review-mod': i => goModule(i, true),
    'branch': i => { state.sel = i; renderDetail(); },
    'branch-step': d => { const n = DATA[state.m].branches.length; state.sel = (state.sel + d + n) % n; renderDetail(); },
    'persp': i => { state.pp = i; renderPerspective(); },
    'persp-step': d => { state.pp = (state.pp + d + 5) % 5; renderPerspective(); },
    'scene': i => { state.sc = i; renderScenes(); },
    'lens': i => { state.ln = state.ln === i ? null : i; renderScenes(); },
    'card': (i, el) => { state.flip[i] = !state.flip[i]; updateCard(el); },
    'q-begin': () => { quiz = pickExam(); lastPct = 0; Object.assign(state, { qp: 'q', qi: 0, qa: {} }); renderQuiz(); },
    'q-pick': j => { state.qa = { ...state.qa, [state.qi]: j }; renderQuiz(); },
    'q-prev': () => { state.qi = Math.max(0, state.qi - 1); renderQuiz(); },
    'q-next': () => {
      if (state.qa[state.qi] == null) return;
      if (state.qi >= EXAM_SIZE - 1) state.qp = 'end'; else state.qi++;
      renderQuiz();
    },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const arg = el.dataset.i != null ? +el.dataset.i : el.dataset.d != null ? +el.dataset.d : undefined;
    actions[el.dataset.action](arg, el);
  });

  goModule(0, false);
})();

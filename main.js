(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const wide = matchMedia('(min-width: 1001px)');
  const cssProgress = CSS.supports && CSS.supports('animation-timeline: scroll()');

  // Touch-scroll flag shared by the canvas loops: skip drawing while the finger/momentum is moving.
  let touchScrolling = false, scrollIdle = 0;
  if (coarse) addEventListener('scroll', () => {
    touchScrolling = true; clearTimeout(scrollIdle);
    scrollIdle = setTimeout(() => { touchScrolling = false; }, 140);
  }, { passive: true });

  /* ---------- Company facts (registry: incorporated 04 Oct 2011) ---------- */
  const now = new Date();
  let age = now.getFullYear() - 2011;
  if (now.getMonth() < 9 || (now.getMonth() === 9 && now.getDate() < 4)) age--;
  $$('[data-age]').forEach(el => { el.textContent = age; });
  $$('[data-age-count]').forEach(el => { el.dataset.count = age; el.textContent = age + (el.dataset.suffix || ''); });
  $('#year').textContent = now.getFullYear();
  $('#nowYear').textContent = now.getFullYear();

  /* ---------- Loader: release as soon as fonts are in (never wait on 3D / map / CDN) ---------- */
  const root = document.documentElement, loader = $('#loader');
  root.classList.add('loading');
  let loaded = false;
  const finishLoad = () => {
    if (loaded) return; loaded = true;
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 700); // stop its animations & hit-testing for good
    root.classList.remove('loading');
    document.body.classList.add('ready');
    $$('.hero .reveal').forEach((el, i) => setTimeout(() => el.classList.add('in'), 150 + i * 110));
  };
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 900))]).then(() => setTimeout(finishLoad, 200));

  /* ---------- Scroll: nav, progress, timeline (one rAF per frame max) ---------- */
  const nav = $('#nav'), progress = $('#progress');
  let maxScroll = 1, ticking = false;
  const measure = () => { maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  const update = () => {
    ticking = false;
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 30);
    if (!cssProgress) progress.style.transform = `scaleX(${Math.min(y / maxScroll, 1)})`;
    if (wide.matches) drawTimeline();
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);

  /* ---------- Mobile menu ---------- */
  const burger = $('#burger'), links = $('#links');
  const setMenu = open => {
    burger.classList.toggle('open', open); links.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', e => { e.stopPropagation(); setMenu(!links.classList.contains('open')); });
  $$('#links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => { if (links.classList.contains('open') && !nav.contains(e.target)) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Active nav link ---------- */
  const navMap = new Map($$('#links a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const a = navMap.get(e.target.id);
      if (a && e.isIntersecting) { navMap.forEach(l => l.classList.remove('active')); a.classList.add('active'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navMap.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

  /* ---------- Reveal on scroll (staggered within each group) ---------- */
  $$('.cards, .stats, .steps, .board, .sector-grid, .dash, .profile-grid').forEach(group => {
    $$(':scope > .reveal', group).forEach((el, i) => el.style.setProperty('--d', `${Math.min(i, 5) * 70}ms`));
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      const c = el.querySelector('[data-count]');
      if (c) countUp(c);
      if (el.classList.contains('card')) setTimeout(() => el.classList.add('settled'), 900 + (parseFloat(el.style.getPropertyValue('--d')) || 0));
      io.unobserve(el);
    });
  // threshold 0: tall blocks (facts table, dashboard) start revealing as soon as their top enters,
  // so the visitor never scrolls through an empty area waiting for 12% of a 1200px block.
  }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').filter(el => !el.closest('.hero')).forEach(el => io.observe(el));

  function countUp(el) {
    const end = +el.dataset.count, from = +(el.dataset.from || 0), suf = el.dataset.suffix || '';
    if (reduced) { el.textContent = end + suf; return; }
    const dur = 1400, t0 = performance.now();
    const step = t => {
      const p = Math.min((t - t0) / dur, 1), v = Math.round(from + (end - from) * (1 - Math.pow(1 - p, 4)));
      el.textContent = v + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = from + suf;
    requestAnimationFrame(step);
  }

  /* ---------- Pause decorative CSS loops while off-screen ---------- */
  const pauser = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('paused', !e.isIntersecting)), { rootMargin: '100px' });
  $$('.hero, .marquee, .about-visual, .map-wrap, .live, .credit').forEach(el => pauser.observe(el));

  /* ---------- Map: never let the Google Maps iframe trap touch scrolling ---------- */
  const mapWrap = $('#mapWrap'), mapFrame = $('#mapWrap iframe'), mapShield = $('#mapShield');
  const loadMap = () => { if (!mapFrame.src) mapFrame.src = mapFrame.dataset.src; };
  if (coarse) {
    mapWrap.classList.add('touch');
    mapShield.addEventListener('click', () => { loadMap(); mapWrap.classList.add('loaded', 'active'); });
    // Re-arm the shield once the map leaves the screen, so coming back never lands a swipe on it.
    new IntersectionObserver(entries => {
      if (!entries[entries.length - 1].isIntersecting) mapWrap.classList.remove('active');
    }).observe(mapWrap);
  } else {
    loadMap(); // desktop: native lazy-loading handles it
  }

  /* ---------- 3D hero fallback: if WebGL / the CDN fails, don't leave an empty block ---------- */
  setTimeout(() => { const hv = $('#heroVisual'); if (!hv.classList.contains('on')) hv.classList.add('off'); }, 9000);

  /* ---------- Cursor glow + magnetic + tilt (desktop pointer only) ---------- */
  if (fine && !reduced) {
    const glow = $('#cursorGlow');
    let gx = -600, gy = -600, tx = gx, ty = gy, raf = 0;
    const follow = () => {
      gx += (tx - gx) * .14; gy += (ty - gy) * .14;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      raf = Math.abs(tx - gx) + Math.abs(ty - gy) > .5 ? requestAnimationFrame(follow) : 0;
    };
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (!raf) raf = requestAnimationFrame(follow); }, { passive: true });

    $$('.magnetic').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .2}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });

    $$('.tilt').forEach(card => {
      let pending = null;
      card.addEventListener('pointermove', e => {
        if (!card.classList.contains('settled')) return;
        const first = !pending;
        pending = e;
        if (!first) return;
        requestAnimationFrame(() => {
          const ev = pending; pending = null;
          const r = card.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
          card.style.transform = `rotateX(${(.5 - py) * 10}deg) rotateY(${(px - .5) * 12}deg) translateY(-6px)`;
          card.style.setProperty('--mx', px * 100 + '%');
          card.style.setProperty('--my', py * 100 + '%');
        });
      });
      card.addEventListener('pointerleave', () => { pending = null; card.style.transform = ''; });
    });
  }

  /* ---------- Timeline path draws with scroll (desktop layout only) ---------- */
  const tlPath = $('#tlPath'), timeline = $('#timeline');
  const tlLen = tlPath.getTotalLength();
  tlPath.style.strokeDasharray = tlLen;
  tlPath.style.strokeDashoffset = tlLen;
  function drawTimeline() {
    const r = timeline.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;
    const p = Math.min(Math.max((innerHeight * .85 - r.top) / (r.height + innerHeight * .3), 0), 1);
    tlPath.style.strokeDashoffset = tlLen * (1 - p);
  }

  /* ---------- Real-time clock & plant status (IST) ---------- */
  // Public listing: closes 5 PM. Assumed Mon–Sat, 9:00–17:00.
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', hour12: false });
  const heroClock = $('#heroClock'), heroStatus = $('#heroStatus'), bigClock = $('#bigClock'),
        statusText = $('#statusText'), statusDot = $('#statusDot'), contactStatus = $('#contactStatus');
  let lastOpen = null;
  function tick() {
    const d = new Date(), t = fmt.format(d);
    heroClock.textContent = 'IST ' + t;
    bigClock.textContent = t;
    const parts = Object.fromEntries(partsFmt.formatToParts(d).map(p => [p.type, p.value]));
    const h = +parts.hour % 24, open = parts.weekday !== 'Sun' && h >= 9 && h < 17;
    if (open === lastOpen) return;
    lastOpen = open;
    heroStatus.textContent = open ? 'Operational' : 'Closed for the day';
    statusText.textContent = open ? 'Operational · closes 5 PM' : 'Closed · opens 9 AM';
    contactStatus.textContent = open ? 'open now' : 'closed now';
    statusDot.classList.toggle('on', open);
  }
  tick(); setInterval(tick, 1000);

  /* ---------- CIN copy ---------- */
  const copyBtn = $('#copyCin');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#cin').textContent.trim()); copyBtn.textContent = 'Copied'; }
    catch { copyBtn.textContent = 'Select'; getSelection().selectAllChildren($('#cin')); }
    copyBtn.classList.add('done');
    setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('done'); }, 1800);
  });

  /* ---------- Simulated telemetry (only runs while the Live section is on screen) ---------- */
  const machines = [
    { name: 'CNC Turning Cell', color: '#06b6d4' },
    { name: 'VMC Milling Cell', color: '#6366f1' },
    { name: 'Press & Bending', color: '#ec4899' },
    { name: 'Welding Bay', color: '#f59e0b' },
    { name: 'Sub-assembly Line', color: '#10b981' },
    { name: 'QA Inspection', color: '#8b5cf6' },
  ].map(m => ({ ...m, v: 70 + Math.random() * 25 }));
  $('#machines').innerHTML = machines.map((m, i) => `
    <li><span class="m-dot" style="background:${m.color};box-shadow:0 0 10px ${m.color}"></span>
    <span>${m.name}</span><span class="val" id="mv${i}">--</span>
    <span class="bar"><i id="mb${i}"></i></span></li>`).join('');
  const mVals = machines.map((_, i) => $('#mv' + i)), mBars = machines.map((_, i) => $('#mb' + i));

  const gaugeArc = $('#gaugeArc'), gaugeVal = $('#gaugeVal');
  function updateMachines() {
    let sum = 0;
    machines.forEach((m, i) => {
      m.v = Math.min(99, Math.max(62, m.v + (Math.random() - .5) * 8));
      sum += m.v;
      mVals[i].textContent = m.v.toFixed(1) + '%';
      mBars[i].style.transform = `scaleX(${m.v / 100})`;
    });
    const oee = sum / machines.length;
    gaugeArc.style.strokeDashoffset = 252 * (1 - oee / 100);
    gaugeVal.textContent = oee.toFixed(1) + '%';
  }

  // Smooth streaming area chart
  const cv = $('#chart'), ctx = cv.getContext('2d');
  const N = 60, a = [], b = [];
  for (let i = 0; i < N; i++) { a.push(60 + Math.sin(i / 5) * 12 + Math.random() * 6); b.push(40 + Math.cos(i / 7) * 10 + Math.random() * 6); }
  let offset = 0, last = 0, cw = 0, ch = 0, chartRaf = 0, machineTimer = 0, liveVisible = false;
  function sizeChart() {
    const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
    cw = cv.clientWidth; ch = cv.clientHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeChart();
  if ('ResizeObserver' in window) new ResizeObserver(() => { sizeChart(); if (!chartRaf) drawFrame(performance.now()); }).observe(cv);

  const gradCache = {};
  function series(data, c1, c2) {
    const step = cw / (N - 2);
    const pts = data.map((v, i) => [i * step - offset * step, ch - (v / 100) * ch]);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
    }
    const key = c1 + cw + 'x' + ch;
    if (!gradCache[key]) {
      const s = ctx.createLinearGradient(0, 0, cw, 0); s.addColorStop(0, c1); s.addColorStop(1, c2);
      const f = ctx.createLinearGradient(0, 0, 0, ch); f.addColorStop(0, c1 + '40'); f.addColorStop(1, c1 + '00');
      gradCache[key] = [s, f];
    }
    const [stroke, fill] = gradCache[key];
    ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke();
    ctx.lineTo(cw, ch); ctx.lineTo(0, ch); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    const lp = pts[pts.length - 2];
    ctx.beginPath(); ctx.arc(lp[0], lp[1], 5, 0, Math.PI * 2); ctx.fillStyle = c2; ctx.fill();
    ctx.beginPath(); ctx.arc(lp[0], lp[1], 10 + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2); ctx.fillStyle = c2 + '33'; ctx.fill();
  }
  function drawFrame(t) {
    const dt = last ? Math.min((t - last) / 1000, .1) : 0; last = t;
    offset += dt * 1.2;
    while (offset >= 1) {
      offset -= 1;
      a.shift(); a.push(Math.min(95, Math.max(30, a[a.length - 1] + (Math.random() - .5) * 14)));
      b.shift(); b.push(Math.min(80, Math.max(15, b[b.length - 1] + (Math.random() - .5) * 12)));
    }
    ctx.clearRect(0, 0, cw, ch);
    ctx.strokeStyle = 'rgba(99,102,241,.08)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y <= 4; y++) { ctx.moveTo(0, (ch / 4) * y); ctx.lineTo(cw, (ch / 4) * y); }
    ctx.stroke();
    series(b, '#ec4899', '#f59e0b');
    series(a, '#06b6d4', '#6366f1');
  }
  // Phones: 30 fps cap and no drawing during an active touch scroll (frees the GPU for scrolling).
  const chartMinFrame = coarse ? 32 : 0;
  let chartLastDraw = 0;
  const loop = t => {
    chartRaf = requestAnimationFrame(loop);
    if (touchScrolling) { last = 0; return; }
    if (t - chartLastDraw < chartMinFrame) return;
    chartLastDraw = t;
    drawFrame(t);
  };
  function setLive(on) {
    if (on && !chartRaf && !reduced) { last = 0; chartRaf = requestAnimationFrame(loop); }
    if (on && !machineTimer) { updateMachines(); machineTimer = setInterval(updateMachines, 2200); }
    if (!on) { cancelAnimationFrame(chartRaf); chartRaf = 0; clearInterval(machineTimer); machineTimer = 0; }
  }
  drawFrame(performance.now());
  new IntersectionObserver(entries => { liveVisible = entries[entries.length - 1].isIntersecting; setLive(liveVisible && !document.hidden); }, { rootMargin: '150px' }).observe($('#live'));
  document.addEventListener('visibilitychange', () => setLive(liveVisible && !document.hidden));

  measure();
  update();
})();

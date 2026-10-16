(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  /* ---------- Loader ---------- */
  document.body.classList.add('loading');
  const finishLoad = () => {
    $('#loader').classList.add('done');
    document.body.classList.remove('loading');
    document.body.classList.add('ready');
    $$('.hero .reveal').forEach((el, i) => setTimeout(() => el.classList.add('in'), 300 + i * 120));
  };
  window.addEventListener('load', () => setTimeout(finishLoad, 900));
  setTimeout(finishLoad, 4000); // safety net if a CDN is slow

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Scroll: nav, progress ---------- */
  const nav = $('#nav'), progress = $('#progress');
  const onScroll = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    nav.classList.toggle('scrolled', y > 30);
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    drawTimeline();
  };
  addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const burger = $('#burger'), links = $('#links');
  burger.addEventListener('click', () => { burger.classList.toggle('open'); links.classList.toggle('open'); });
  $$('#links a').forEach(a => a.addEventListener('click', () => { burger.classList.remove('open'); links.classList.remove('open'); }));

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      const c = e.target.querySelector('[data-count]');
      if (c) countUp(c);
      io.unobserve(e.target);
    });
  }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').filter(el => !el.closest('.hero')).forEach(el => io.observe(el));

  function countUp(el) {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', dur = 1600, t0 = performance.now();
    const step = t => {
      const p = Math.min((t - t0) / dur, 1), v = Math.round(end * (1 - Math.pow(1 - p, 4)));
      el.textContent = v + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Cursor glow + magnetic + tilt ---------- */
  if (fine && !reduced) {
    const glow = $('#cursorGlow');
    let gx = -500, gy = -500, tx = gx, ty = gy;
    addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      gx += (tx - gx) * .12; gy += (ty - gy) * .12;
      glow.style.left = gx + 'px'; glow.style.top = gy + 'px';
      requestAnimationFrame(loop);
    })();

    $$('.magnetic').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });

    $$('.tilt').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.transform = `rotateX(${(.5 - py) * 12}deg) rotateY(${(px - .5) * 14}deg) translateY(-6px)`;
        card.style.setProperty('--mx', px * 100 + '%');
        card.style.setProperty('--my', py * 100 + '%');
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Timeline path draws with scroll ---------- */
  const tlPath = $('#tlPath'), timeline = $('#timeline');
  const tlLen = tlPath.getTotalLength();
  tlPath.style.strokeDasharray = tlLen;
  tlPath.style.strokeDashoffset = tlLen;
  function drawTimeline() {
    const r = timeline.getBoundingClientRect();
    const p = Math.min(Math.max((innerHeight * .85 - r.top) / (r.height + innerHeight * .3), 0), 1);
    tlPath.style.strokeDashoffset = tlLen * (1 - p);
  }

  /* ---------- Real-time clock & plant status (IST) ---------- */
  // Business hours from the public listing: closes 5 PM. Assumed Mon–Sat, 9:00–17:00.
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', hour12: false });
  function tick() {
    const now = new Date(), t = fmt.format(now);
    const parts = Object.fromEntries(partsFmt.formatToParts(now).map(p => [p.type, p.value]));
    const h = +parts.hour % 24, open = parts.weekday !== 'Sun' && h >= 9 && h < 17;
    const label = open ? 'Operational · closes 5 PM' : 'Closed · opens 9 AM';
    $('#heroClock').textContent = 'IST ' + t;
    $('#heroStatus').textContent = open ? 'Operational' : 'Offline for the day';
    $('#bigClock').textContent = t;
    $('#statusText').textContent = label;
    $('#statusDot').classList.toggle('on', open);
  }
  tick(); setInterval(tick, 1000);

  /* ---------- Simulated telemetry ---------- */
  const machines = [
    { name: 'CNC Turning Cell', color: '#06b6d4' },
    { name: 'VMC Milling Cell', color: '#6366f1' },
    { name: 'Press & Bending', color: '#ec4899' },
    { name: 'Welding Bay', color: '#f59e0b' },
    { name: 'Assembly Line', color: '#10b981' },
    { name: 'QA Inspection', color: '#8b5cf6' },
  ].map(m => ({ ...m, v: 70 + Math.random() * 25 }));
  const list = $('#machines');
  list.innerHTML = machines.map((m, i) => `
    <li><span class="m-dot" style="background:${m.color};box-shadow:0 0 10px ${m.color}"></span>
    <span>${m.name}</span><span class="val" id="mv${i}">--</span>
    <span class="bar"><i id="mb${i}" style="width:0"></i></span></li>`).join('');

  const gaugeArc = $('#gaugeArc'), gaugeVal = $('#gaugeVal');
  function updateMachines() {
    let sum = 0;
    machines.forEach((m, i) => {
      m.v = Math.min(99, Math.max(62, m.v + (Math.random() - .5) * 8));
      sum += m.v;
      $('#mv' + i).textContent = m.v.toFixed(1) + '%';
      $('#mb' + i).style.width = m.v + '%';
    });
    const oee = sum / machines.length;
    gaugeArc.style.strokeDashoffset = 252 * (1 - oee / 100);
    gaugeVal.textContent = oee.toFixed(1) + '%';
  }
  updateMachines(); setInterval(updateMachines, 2200);

  // Smooth streaming area chart
  const cv = $('#chart'), ctx = cv.getContext('2d');
  const N = 60, a = [], b = [];
  for (let i = 0; i < N; i++) { a.push(60 + Math.sin(i / 5) * 12 + Math.random() * 6); b.push(40 + Math.cos(i / 7) * 10 + Math.random() * 6); }
  let offset = 0, last = performance.now();
  function sizeChart() {
    const dpr = Math.min(devicePixelRatio, 2), w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeChart(); addEventListener('resize', sizeChart);
  function series(data, color1, color2, w, h) {
    const step = w / (N - 2);
    const pts = data.map((v, i) => [i * step - offset * step, h - (v / 100) * h]);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
    }
    const stroke = ctx.createLinearGradient(0, 0, w, 0);
    stroke.addColorStop(0, color1); stroke.addColorStop(1, color2);
    ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, color1 + '40'); fill.addColorStop(1, color1 + '00');
    ctx.fillStyle = fill; ctx.fill();
    const lp = pts[pts.length - 2];
    ctx.beginPath(); ctx.arc(lp[0], lp[1], 5, 0, Math.PI * 2); ctx.fillStyle = color2; ctx.fill();
    ctx.beginPath(); ctx.arc(lp[0], lp[1], 10 + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2); ctx.fillStyle = color2 + '33'; ctx.fill();
  }
  function drawChart(t) {
    const w = cv.clientWidth, h = cv.clientHeight, dt = (t - last) / 1000; last = t;
    offset += dt * 1.2;
    if (offset >= 1) {
      offset -= 1;
      a.shift(); a.push(Math.min(95, Math.max(30, a[a.length - 1] + (Math.random() - .5) * 14)));
      b.shift(); b.push(Math.min(80, Math.max(15, b[b.length - 1] + (Math.random() - .5) * 12)));
    }
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(99,102,241,.08)'; ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y++) { ctx.beginPath(); ctx.moveTo(0, (h / 4) * y); ctx.lineTo(w, (h / 4) * y); ctx.stroke(); }
    series(b, '#ec4899', '#f59e0b', w, h);
    series(a, '#06b6d4', '#6366f1', w, h);
    requestAnimationFrame(drawChart);
  }
  requestAnimationFrame(drawChart);

  onScroll();
})();

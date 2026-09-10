/* TaDa public site — vanilla JS, no build step.
   Data: data/talks.json (static, committed) + optional live programme from Firestore
   (public/programme document, written by the organizers' committee app). */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var CFG = window.TADA_CONFIG || {};
  var LINKS = {
    join: CFG.joinUrl || "mailto:nicolai.berk@gess.ethz.ch?subject=Subscribe%20to%20the%20TaDa%20Speaker%20Series&body=Hi%2C%20please%20add%20me%20to%20the%20TaDa%20mailing%20list.",
    propose: CFG.proposeUrl || "mailto:nicolai.berk@gess.ethz.ch?subject=TaDa%3A%20talk%20proposal",
    bluesky: CFG.blueskyUrl || "https://bsky.app/search?q=%23TextAsData",
    linkedin: CFG.linkedinUrl || "https://www.linkedin.com/search/results/content/?keywords=TADA%20Speaker%20Series"
  };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function fmtDate(iso, long) {
    var p = iso.split("-"); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    var s = DAYS[d.getUTCDay()] + " " + (+p[2]) + " " + MONTHS[+p[1] - 1];
    return long ? s + " " + p[0] : s;
  }
  /* Berlin UTC offset (hours) on a given date: 2 during summer time, else 1 */
  function berlinOffset(iso) {
    try {
      var d = new Date(iso + "T12:00:00Z");
      var f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" });
      var tz = f.formatToParts(d).filter(function (x) { return x.type === "timeZoneName"; })[0].value; // "GMT+02:00"
      return /\+02/.test(tz) ? 2 : 1;
    } catch (e) { return 1; }
  }
  function tzLabel(iso) { return berlinOffset(iso) === 2 ? "CEST" : "CET"; }
  /* instant (Date) of hh:mm Berlin time on iso date */
  function berlinInstant(iso, time) {
    var p = iso.split("-"); var t = (time || "17:00").split(":");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], +t[0] - berlinOffset(iso), +t[1] || 0));
  }
  function localHint(iso, time) {
    try {
      var viewerTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!viewerTZ || /Berlin|Zurich|Vienna|Amsterdam|Paris|Rome|Madrid|Brussels|Copenhagen|Stockholm|Oslo|Prague|Warsaw|Budapest/.test(viewerTZ)) return "";
      var inst = berlinInstant(iso, time);
      var s = inst.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
      return "That is " + s + " where you are.";
    } catch (e) { return ""; }
  }
  function icsFor(s) {
    var p = s.date.split("-"); var t = (s.time || "17:00").split(":");
    var start = p.join("") + "T" + pad(+t[0]) + pad(+t[1] || 0) + "00";
    var end = p.join("") + "T" + pad(+t[0] + 1) + pad(+t[1] || 0) + "00";
    var title = "TaDa: " + (s.speaker || "Speaker series") + (s.title ? " – " + s.title : "");
    var desc = (s.title ? s.title + "\\n" : "") + (s.affiliation ? s.affiliation + "\\n" : "") + "Zoom link is sent to subscribers on the day. https://tada.cool";
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TaDa//Speaker Series//EN", "BEGIN:VEVENT",
      "UID:tada-" + s.date + "@tada.cool", "DTSTAMP:" + p.join("") + "T120000Z",
      "DTSTART;TZID=Europe/Berlin:" + start, "DTEND;TZID=Europe/Berlin:" + end,
      "SUMMARY:" + title.replace(/,/g, "\\,"), "DESCRIPTION:" + desc.replace(/,/g, "\\,"), "LOCATION:Zoom (online)",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  }

  /* ---------- wire links ---------- */
  $$("[data-join]").forEach(function (a) { a.href = LINKS.join; });
  $$("[data-propose]").forEach(function (a) { a.href = LINKS.propose; });
  $$("[data-bluesky]").forEach(function (a) { a.href = LINKS.bluesky; a.rel = "noopener"; a.target = "_blank"; });
  $$("[data-linkedin]").forEach(function (a) { a.href = LINKS.linkedin; a.rel = "noopener"; a.target = "_blank"; });
  $$(".email[data-email]").forEach(function (el) {
    var v = el.getAttribute("data-email").split("|"); var addr = v[0] + "@" + v[1];
    var a = document.createElement("a"); a.href = "mailto:" + addr; a.textContent = addr; el.appendChild(a);
  });
  var yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- header + mobile nav ---------- */
  var top = $(".topbar"), nav = $("#sitenav"), burger = $(".nav-burger");
  function onScroll() { if (top) top.classList.toggle("scrolled", window.scrollY > 24); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) burger.click(); });
  }

  /* ---------- reveal on scroll ---------- */
  var reveals = $$("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) { reveals.forEach(function (el) { el.classList.add("is-in"); }); }
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- data ---------- */
  var TALKS = [];
  var TODAY = todayISO();
  function isUpcoming(s) { return s.date >= TODAY; }
  function sortByDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }

  function renderNext(list) {
    var card = $("#next-card"); if (!card) return;
    var up = list.filter(isUpcoming).sort(sortByDate);
    var s = up.filter(function (x) { return x.speaker; })[0] || up[0];
    if (!s) { card.innerHTML = '<p class="card-label">Next session</p><p class="card-speaker">New term in preparation</p><p class="card-title">Subscribe to hear first.</p>'; return; }
    var tba = !s.speaker;
    var html = '<p class="card-label">Next session</p>' +
      '<p class="card-date"><span class="d">' + esc(fmtDate(s.date, true)) + '</span><span class="t">' + esc((s.time || "17:00") + " " + tzLabel(s.date)) + '</span></p>' +
      '<p class="card-speaker">' + (tba ? "Speaker to be announced" : esc(s.speaker)) + '</p>' +
      (s.affiliation ? '<p class="card-aff">' + esc(s.affiliation) + '</p>' : "") +
      (s.title ? '<p class="card-title">' + esc(s.title) + '</p>' : (tba ? '<p class="card-title">' + esc(CFG.termTheme || "AI Tools for Social Scientists") + '</p>' : "")) +
      '<div class="card-actions"><a class="btn btn-primary btn-small" href="' + esc(LINKS.join) + '">Get the Zoom link</a>' +
      '<a class="btn btn-ghost btn-small" href="#" data-ics>Add to calendar</a></div>' +
      (localHint(s.date, s.time) ? '<p class="local">' + esc(localHint(s.date, s.time)) + '</p>' : "");
    card.innerHTML = html;
    var ics = $("[data-ics]", card);
    ics.addEventListener("click", function (e) {
      e.preventDefault();
      var blob = new Blob([icsFor(s)], { type: "text/calendar" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tada-" + s.date + ".ics"; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
  }

  function renderProgramme(list) {
    var ol = $("#programme-list"); if (!ol) return;
    var up = list.filter(isUpcoming).sort(sortByDate);
    var term = (up.filter(function (x) { return x.term; })[0] || {}).term;
    if (term) { var eb = $("#programme-eyebrow"); if (eb) eb.textContent = term + (CFG.termTheme ? " · " + CFG.termTheme : " · AI Tools for Social Scientists"); }
    if (!up.length) { ol.innerHTML = '<li class="prog-empty">The next term is being prepared. Subscribe to be the first to know.</li>'; return; }
    ol.innerHTML = up.map(function (s) {
      var tba = !s.speaker;
      var sp = tba ? "To be announced" : (s.url ? '<a href="' + esc(s.url) + '" rel="noopener">' + esc(s.speaker) + '</a>' : esc(s.speaker));
      var title = s.title ? (s.paper ? '<a href="' + esc(s.paper) + '" rel="noopener">' + esc(s.title) + '</a>' : esc(s.title)) : (tba ? "" : "Title to follow");
      return '<li class="prog' + (tba ? " is-tba" : "") + '">' +
        '<div class="p-date">' + esc(fmtDate(s.date, true)) + '<small>' + esc((s.time || "17:00") + " " + tzLabel(s.date)) + '</small></div>' +
        '<div class="p-speaker">' + sp + (s.affiliation ? '<span class="p-aff">' + esc(s.affiliation) + '</span>' : "") + '</div>' +
        '<div class="p-title">' + title + '</div>' +
        '<span class="pill ' + (tba ? "tba" : "ok") + '">' + (tba ? "Open slot" : "Confirmed") + '</span></li>';
    }).join("");
    var hint = $("#tz-hint"); if (hint) hint.textContent = localHint(up[0].date, up[0].time);
  }

  var F = { year: "all", type: "all", q: "" };
  function renderArchive(list) {
    var box = $("#archive-list"); if (!box) return;
    var past = list.filter(function (s) { return !isUpcoming(s) && s.speaker; }).sort(function (a, b) { return sortByDate(b, a); });
    var count = $("#archive-count"); if (count) count.textContent = past.length;
    var fc = $("#fact-count"); if (fc) fc.textContent = past.length;
    var years = []; past.forEach(function (s) { var y = s.date.slice(0, 4); if (years.indexOf(y) < 0) years.push(y); });
    var yc = $("#year-chips");
    if (yc && !yc.children.length) {
      yc.innerHTML = '<button class="chip is-on" data-year="all" type="button">All years</button>' + years.map(function (y) { return '<button class="chip" data-year="' + y + '" type="button">' + y + '</button>'; }).join("");
      yc.addEventListener("click", function (e) { var b = e.target.closest("[data-year]"); if (!b) return; F.year = b.getAttribute("data-year"); $$(".chip", yc).forEach(function (c) { c.classList.toggle("is-on", c === b); }); renderArchive(TALKS); });
    }
    var q = F.q.trim().toLowerCase();
    var rows = past.filter(function (s) {
      if (F.year !== "all" && s.date.slice(0, 4) !== F.year) return false;
      if (F.type !== "all" && s.type !== F.type) return false;
      if (q && (s.speaker + " " + s.title + " " + (s.affiliation || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (!rows.length) { box.innerHTML = '<p class="archive-empty">Nothing matches. Try another year or a shorter search.</p>'; return; }
    var groups = {}; var order = [];
    rows.forEach(function (s) { var y = s.date.slice(0, 4); if (!groups[y]) { groups[y] = []; order.push(y); } groups[y].push(s); });
    box.innerHTML = order.map(function (y) {
      return '<div class="yr-group"><div class="yr-head"><h3>' + y + '</h3><span>' + groups[y].length + ' session' + (groups[y].length === 1 ? "" : "s") + '</span></div>' +
        groups[y].map(function (s) {
          var sp = s.url ? '<a href="' + esc(s.url) + '" rel="noopener">' + esc(s.speaker) + '</a>' : esc(s.speaker);
          var title = s.paper ? '<a href="' + esc(s.paper) + '" rel="noopener">' + esc(s.title) + '</a>' : esc(s.title);
          return '<div class="row"><div class="p-date">' + esc(fmtDate(s.date)) + '</div>' +
            '<div class="p-speaker">' + sp + (s.affiliation ? '<span class="p-aff">' + esc(s.affiliation) + '</span>' : "") + '</div>' +
            '<div class="p-title">' + title + '</div><span class="tag">' + esc(s.type === "Reading Group" ? "Reading group" : "Talk") + '</span></div>';
        }).join("") + '</div>';
    }).join("");
  }
  var tc = $("#type-chips");
  if (tc) tc.addEventListener("click", function (e) { var b = e.target.closest("[data-type]"); if (!b) return; F.type = b.getAttribute("data-type"); $$(".chip", tc).forEach(function (c) { c.classList.toggle("is-on", c === b); }); renderArchive(TALKS); });
  var si = $("#archive-search");
  if (si) si.addEventListener("input", function () { F.q = si.value; renderArchive(TALKS); });

  function renderAll() { renderNext(TALKS); renderProgramme(TALKS); renderArchive(TALKS); }

  fetch("data/talks.json").then(function (r) { return r.json(); }).then(function (rows) {
    TALKS = rows; renderAll(); loadLiveProgramme();
  }).catch(function () {
    var ol = $("#programme-list"); if (ol) ol.innerHTML = '<li class="prog-empty">Programme could not be loaded.</li>';
  });

  /* ---------- optional: live programme from Firestore (written by the committee app) ---------- */
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function loadLiveProgramme() {
    if (!CFG.firebase || CFG.livePublic === false) return;
    var v = CFG.firebaseVersion || "12.4.0";
    loadScript("https://www.gstatic.com/firebasejs/" + v + "/firebase-app-compat.js")
      .then(function () { return loadScript("https://www.gstatic.com/firebasejs/" + v + "/firebase-firestore-compat.js"); })
      .then(function () {
        var app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(CFG.firebase);
        return app.firestore().collection("public").doc("programme").get();
      })
      .then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data() || {}; var live = (d.sessions || []).filter(function (s) { return s && s.date; });
        if (!live.length) return;
        var liveDates = {}; live.forEach(function (s) { liveDates[s.date] = true; });
        /* replace upcoming static rows by the live ones; keep the static archive */
        TALKS = TALKS.filter(function (s) { return !isUpcoming(s) && !liveDates[s.date]; }).concat(live.map(function (s) {
          return { date: s.date, time: s.time || "17:00", speaker: s.speaker || "", affiliation: s.affiliation || "", url: s.url || "", title: s.title || "", paper: s.paper || "", type: "Speaker Series", term: s.term || d.term || "" };
        }));
        if (d.theme) CFG.termTheme = d.theme;
        renderAll();
      })
      .catch(function () { /* stay on the static programme */ });
  }

  /* ---------- token field (hero canvas): drifting "documents" with nearest-neighbour links ---------- */
  var canvas = $("#tokens");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d"), W = 0, H = 0, pts = [], raf = null, running = false, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function colors() {
      var cs = getComputedStyle(document.documentElement);
      return [cs.getPropertyValue("--accent").trim(), cs.getPropertyValue("--accent-soft").trim(), cs.getPropertyValue("--mark-ink").trim()];
    }
    function resize() {
      var r = canvas.parentNode.getBoundingClientRect(); W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(150, Math.max(60, W * H / 9000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        var c = i % 3; var cx = [W * 0.22, W * 0.62, W * 0.86][c], cy = [H * 0.35, H * 0.7, H * 0.25][c];
        pts.push({ x: cx + (Math.random() - .5) * W * .5, y: cy + (Math.random() - .5) * H * .8, vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18, c: c, r: 1.3 + Math.random() * 1.7 });
      }
      draw(true);
    }
    function draw(still) {
      var col = colors();
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (!still) { p.x += p.vx; p.y += p.vy; if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10; }
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < 5200) { ctx.globalAlpha = (1 - d2 / 5200) * .22; ctx.strokeStyle = col[p.c]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
      }
      for (var k = 0; k < pts.length; k++) { var s = pts[k]; ctx.globalAlpha = .5; ctx.fillStyle = col[s.c]; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    function loop() { if (!running) return; draw(false); raf = requestAnimationFrame(loop); }
    function start() { if (reduce || running) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); }
    resize();
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { en.forEach(function (e) { e.isIntersecting ? start() : stop(); }); }, { threshold: 0.05 }).observe(canvas);
    } else start();
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });
  }
})();

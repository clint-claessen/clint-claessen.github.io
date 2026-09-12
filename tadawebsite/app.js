/* TaDa public site — vanilla JS. Data: data/talks.json (static) + optional live programme from Firestore (public/programme). */
(function () {
  "use strict";
  var CFG = window.TADA_CONFIG || {};
  var LINKS = {
    join: CFG.joinUrl || "",
    propose: CFG.proposeUrl || "mailto:nicolai.berk@gess.ethz.ch?subject=TaDa%3A%20talk%20proposal",
    bluesky: CFG.blueskyUrl || "https://bsky.app/search?q=%23TextAsData",
    linkedin: CFG.linkedinUrl || "https://www.linkedin.com/search/results/content/?keywords=TADA%20Speaker%20Series",
    subscribeMail: "nicolai.berk@gess.ethz.ch"
  };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function parts(iso) { var p = iso.split("-"); return { y: +p[0], m: +p[1], d: +p[2], dow: new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).getUTCDay() }; }
  function fmtDate(iso, withYear) { var p = parts(iso); return DAYS[p.dow] + " " + p.d + " " + MONTHS[p.m - 1] + (withYear ? " " + p.y : ""); }
  function berlinOffset(iso) {
    try { var d = new Date(iso + "T12:00:00Z"); var tz = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" }).formatToParts(d).filter(function (x) { return x.type === "timeZoneName"; })[0].value; return /\+02/.test(tz) ? 2 : 1; } catch (e) { return 1; }
  }
  function tzLabel(iso) { return berlinOffset(iso) === 2 ? "CEST (UTC+2)" : "CET (UTC+1)"; }
  function berlinInstant(iso, time) { var p = iso.split("-"); var t = (time || "17:00").split(":"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], +t[0] - berlinOffset(iso), +t[1] || 0)); }
  function localHint(iso, time) {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      var inst = berlinInstant(iso, time);
      var s = inst.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
      if (/Europe\/(Berlin|Zurich|Vienna|Amsterdam|Paris|Rome|Madrid|Brussels|Copenhagen|Stockholm|Oslo|Prague|Warsaw|Budapest)/.test(tz)) return "";
      return "That is " + s + " in your time zone";
    } catch (e) { return ""; }
  }
  function icsFor(s) {
    var p = s.date.split("-"); var t = (s.time || "17:00").split(":");
    var start = p.join("") + "T" + pad(+t[0]) + pad(+t[1] || 0) + "00", end = p.join("") + "T" + pad(+t[0] + 1) + pad(+t[1] || 0) + "00";
    var title = "TaDa: " + (s.speaker || "Speaker series") + (s.title ? " – " + s.title : "");
    var desc = (s.title ? s.title + "\\n" : "") + (s.affiliation ? s.affiliation + "\\n" : "") + "Zoom link is sent to subscribers on the day. https://tada.cool";
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TaDa//Speaker Series//EN", "BEGIN:VEVENT", "UID:tada-" + s.date + "@tada.cool", "DTSTAMP:" + p.join("") + "T120000Z",
      "DTSTART;TZID=Europe/Berlin:" + start, "DTEND;TZID=Europe/Berlin:" + end, "SUMMARY:" + title.replace(/,/g, "\\,"), "DESCRIPTION:" + desc.replace(/,/g, "\\,"), "LOCATION:Zoom (online)", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  }
  function downloadICS(s) {
    var blob = new Blob([icsFor(s)], { type: "text/calendar" }); var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "tada-" + s.date + ".ics"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------- links, header, misc ---------- */
  $$("[data-join]").forEach(function (a) { if (LINKS.join) a.href = LINKS.join; });
  $$("[data-propose]").forEach(function (a) { a.href = LINKS.propose; });
  $$("[data-bluesky]").forEach(function (a) { a.href = LINKS.bluesky; });
  $$("[data-linkedin]").forEach(function (a) { a.href = LINKS.linkedin; });
  $$(".email[data-email]").forEach(function (el) { var v = el.getAttribute("data-email").split("|"); var addr = v[0] + "@" + v[1]; var a = document.createElement("a"); a.href = "mailto:" + addr; a.className = "text-primary hover:underline"; a.textContent = addr; el.appendChild(a); });
  var yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();
  var mb = $("#menu-btn"), mn = $("#mobile-nav");
  if (mb && mn) {
    mb.addEventListener("click", function () { var open = mn.hidden; mn.hidden = !open; mb.setAttribute("aria-expanded", open ? "true" : "false"); });
    $$("a", mn).forEach(function (a) { a.addEventListener("click", function () { mn.hidden = true; mb.setAttribute("aria-expanded", "false"); }); });
  }
  var sf = $("#subscribe-form");
  if (sf) sf.addEventListener("submit", function (e) {
    e.preventDefault(); var em = $("#sub-email").value.trim();
    if (LINKS.join) { window.location.href = LINKS.join; return; }
    window.location.href = "mailto:" + LINKS.subscribeMail + "?subject=" + encodeURIComponent("Subscribe to the TaDa Speaker Series") + "&body=" + encodeURIComponent("Please add " + em + " to the TaDa mailing list.");
  });

  /* ---------- data + rendering ---------- */
  var TALKS = [], TODAY = todayISO();
  function isUpcoming(s) { return s.date >= TODAY; }
  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }
  function initials(n) { return (n || "").split(/[\s&,]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  /* Speaker portrait (from the original site or the committee app) with an initials fallback. */
  function avatar(s, tba, size, quiet) {
    if (s.photo) return '<img class="' + size + ' rounded-pill object-cover shrink-0 bg-surface-container-high shadow-sm" src="' + esc(s.photo) + '" alt="" loading="lazy" data-initials="' + esc(initials(s.speaker)) + '" />';
    return '<span class="' + size + ' rounded-pill shrink-0 inline-flex items-center justify-center select-none ' + (quiet ? "bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm" : "bg-primary-container text-on-primary font-headline-sm text-headline-sm") + '">' + (tba ? "?" : esc(initials(s.speaker))) + '</span>';
  }
  /* A portrait that fails to load falls back to the initials badge. */
  document.addEventListener("error", function (e) {
    var img = e.target; if (!img || img.tagName !== "IMG" || !img.hasAttribute("data-initials")) return;
    var sp = document.createElement("span"); sp.className = img.className.replace("object-cover", "") + " inline-flex items-center justify-center bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm"; sp.textContent = img.getAttribute("data-initials"); img.replaceWith(sp);
  }, true);
  function photoFor(live, statics) {
    var key = function (n) { return (n || "").toLowerCase().replace(/[^a-z]/g, ""); }, byDate = {}, byName = {};
    statics.forEach(function (r) { if (r.photo) { byDate[r.date] = r; byName[key(r.speaker)] = r.photo; } });
    var same = byDate[live.date] && key(byDate[live.date].speaker) === key(live.speaker) ? byDate[live.date].photo : "";
    return live.photo || same || byName[key(live.speaker)] || "";
  }

  function renderNext(list) {
    var card = $("#next-card"); if (!card) return;
    var up = list.filter(isUpcoming).sort(byDate);
    var s = up.filter(function (x) { return x.speaker; })[0] || up[0];
    if (!s) { card.innerHTML = '<div class="flex items-center gap-space-xs pb-space-md"><span class="w-2.5 h-2.5 rounded-full bg-secondary"></span><span class="font-code-sm text-code-sm text-secondary uppercase font-semibold tracking-wider">Next session</span></div><h2 class="font-headline-md text-headline-md text-on-surface">New term in preparation</h2><p class="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">Subscribe to hear first.</p>'; return; }
    var tba = !s.speaker, hint = localHint(s.date, s.time);
    card.innerHTML =
      '<div class="flex items-center justify-between gap-space-sm pb-space-md"><div class="flex items-center gap-space-xs"><span class="w-2.5 h-2.5 rounded-full bg-secondary"></span><span class="font-code-sm text-code-sm text-secondary uppercase font-semibold tracking-wider">Next session</span></div>' +
      (s.term ? '<span class="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-code-sm text-code-sm">' + esc(s.term) + '</span>' : '') + '</div>' +
      '<div class="flex flex-col gap-space-xs"><div class="font-code-md text-code-md text-on-surface-variant">' + esc(fmtDate(s.date, true)) + ' · ' + esc(s.time || "17:00") + ' Berlin time</div>' + (hint ? '<div class="font-body-sm text-body-sm text-tertiary">' + esc(hint) + '</div>' : '') + '</div>' +
      '<div class="my-space-md p-space-md rounded bg-surface-container-low flex flex-col gap-space-xs">' +
      '<div class="flex items-center gap-space-sm">' + avatar(s, tba, "w-14 h-14") + '<div class="flex flex-col min-w-0"><span class="font-headline-sm text-headline-sm text-on-surface truncate">' + (tba ? "Speaker to be announced" : esc(s.speaker)) + '</span>' + (s.affiliation ? '<span class="font-code-sm text-code-sm text-tertiary truncate">' + esc(s.affiliation) + '</span>' : '') + '</div></div>' +
      (s.title ? '<h2 class="font-headline-md text-headline-md text-on-surface mt-space-xs tracking-tight">“' + esc(s.title) + '”</h2>' : (tba ? '<h2 class="font-headline-md text-headline-md text-on-surface mt-space-xs tracking-tight">' + esc(CFG.termTheme || "AI Tools for Social Scientists") + '</h2>' : '')) +
      (s.abstract ? '<p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-3 mt-space-xs">' + esc(s.abstract) + '</p>' : '') + '</div>' +
      '<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm">' +
      '<a class="flex-1 inline-flex items-center justify-center h-10 px-space-md rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md transition-colors gap-2" href="' + esc(LINKS.join || "#subscribe") + '"><span class="material-symbols-outlined text-[18px]">videocam</span>Get the Zoom link</a>' +
      '<button class="inline-flex items-center justify-center h-10 px-space-md rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-label-md transition-colors gap-1.5" type="button" data-ics><span class="material-symbols-outlined text-[18px]">event</span>Add to calendar (.ics)</button></div>';
    $("[data-ics]", card).addEventListener("click", function () { downloadICS(s); });
  }

  function renderProgramme(list) {
    var body = $("#programme-body"); if (!body) return;
    var up = list.filter(isUpcoming).sort(byDate);
    var term = (up.filter(function (x) { return x.term; })[0] || {}).term;
    var eb = $("#programme-eyebrow"); if (eb && term) eb.textContent = term + " · " + (CFG.termTheme || "AI Tools for Social Scientists");
    if (!up.length) { body.innerHTML = '<tr><td colspan="4" class="py-space-lg px-space-md text-on-surface-variant italic">The next term is being prepared. Subscribe to be the first to know.</td></tr>'; return; }
    body.innerHTML = up.map(function (s) {
      var tba = !s.speaker;
      return '<tr class="hover:bg-surface-container-low transition-colors">' +
        '<td class="py-space-md px-space-md align-top"><div class="font-headline-sm text-headline-sm text-on-surface">' + esc(fmtDate(s.date, true)) + '</div><div class="font-code-sm text-code-sm text-tertiary mt-0.5">' + esc((s.time || "17:00") + " " + tzLabel(s.date)) + '</div></td>' +
        '<td class="py-space-md px-space-md align-top">' + (tba ? '<div class="font-headline-sm text-headline-sm text-tertiary italic">To be announced</div><div class="font-body-sm text-body-sm text-outline-variant mt-0.5">Invitations out</div>' :
          '<div class="flex items-start gap-space-sm">' + avatar(s, false, "w-11 h-11") + '<div class="min-w-0"><div class="font-headline-sm text-headline-sm text-on-surface">' + (s.url ? '<a class="hover:text-primary" href="' + esc(s.url) + '" rel="noopener">' + esc(s.speaker) + '</a>' : esc(s.speaker)) + '</div>' + (s.affiliation ? '<div class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">' + esc(s.affiliation) + '</div>' : '') + '</div></div>') + '</td>' +
        '<td class="py-space-md px-space-md align-top">' + (s.title ? '<div class="font-body-lg text-body-lg text-on-surface font-medium">' + (s.paper ? '<a class="hover:text-primary" href="' + esc(s.paper) + '" rel="noopener">“' + esc(s.title) + '”</a>' : '“' + esc(s.title) + '”') + '</div>' : '<div class="font-body-lg text-body-lg text-tertiary italic">' + (tba ? "To be announced" : "Title to follow") + '</div>') + '</td>' +
        '<td class="py-space-md px-space-md align-top text-right"><span class="pill ' + (tba ? "pill-slate" : "pill-ok") + '">' + (tba ? "Open slot" : "Confirmed") + '</span></td></tr>';
    }).join("");
    var hint = $("#tz-hint"); var lh = localHint(up[0].date, up[0].time); if (hint && lh) hint.textContent = lh;
  }

  var F = { year: "all", type: "all", q: "" };
  function chipOn(el, on) { el.classList.toggle("bg-primary", on); el.classList.toggle("text-on-primary", on); el.classList.toggle("bg-surface-container-low", !on); el.classList.toggle("text-on-surface-variant", !on); }
  function renderArchive(list) {
    var box = $("#archive-list"); if (!box) return;
    var past = list.filter(function (s) { return !isUpcoming(s) && s.speaker; }).sort(function (a, b) { return byDate(b, a); });
    var c = $("#archive-count"); if (c) c.textContent = past.length; var fc = $("#fact-count"); if (fc) fc.textContent = past.length;
    var yc = $("#year-chips");
    if (yc && !yc.children.length) {
      var years = []; past.forEach(function (s) { var y = s.date.slice(0, 4); if (years.indexOf(y) < 0) years.push(y); });
      yc.innerHTML = '<button class="year-chip px-2.5 py-1 rounded text-label-sm font-label-sm bg-primary text-on-primary" data-year="all" type="button">All</button>' + years.map(function (y) { return '<button class="year-chip px-2.5 py-1 rounded text-label-sm font-label-sm bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high" data-year="' + y + '" type="button">' + y + '</button>'; }).join("");
      yc.addEventListener("click", function (e) { var b = e.target.closest("[data-year]"); if (!b) return; F.year = b.getAttribute("data-year"); $$(".year-chip", yc).forEach(function (x) { chipOn(x, x === b); }); renderArchive(TALKS); });
    }
    var q = F.q.trim().toLowerCase();
    var rows = past.filter(function (s) { return (F.year === "all" || s.date.slice(0, 4) === F.year) && (F.type === "all" || s.type === F.type) && (!q || (s.speaker + " " + s.title + " " + (s.affiliation || "")).toLowerCase().indexOf(q) >= 0); });
    if (!rows.length) { box.innerHTML = '<p class="p-space-md text-on-surface-variant italic">Nothing matches. Try another year or a shorter search.</p>'; return; }
    box.innerHTML = rows.map(function (s) {
      var rg = s.type === "Reading Group";
      return '<div class="p-space-md rounded bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-space-sm">' +
        '<div class="flex items-center gap-space-sm md:gap-space-md min-w-0"><span class="hidden md:inline font-code-md text-code-md text-tertiary w-32 shrink-0 tabular">' + esc(fmtDate(s.date, true)) + '</span>' + avatar(s, false, "w-10 h-10", true) +
        '<div class="flex flex-col min-w-0"><span class="md:hidden font-code-sm text-code-sm text-tertiary tabular">' + esc(fmtDate(s.date, true)) + '</span><div class="flex items-center gap-space-xs flex-wrap"><span class="font-headline-sm text-headline-sm text-on-surface">' + (s.url ? '<a class="hover:text-primary" href="' + esc(s.url) + '" rel="noopener">' + esc(s.speaker) + '</a>' : esc(s.speaker)) + '</span>' + (s.affiliation ? '<span class="font-body-sm text-body-sm text-on-surface-variant">· ' + esc(s.affiliation) + '</span>' : '') + '</div>' +
        (s.title ? '<div class="font-body-md text-body-md text-primary italic mt-0.5">' + (s.paper ? '<a class="hover:underline" href="' + esc(s.paper) + '" rel="noopener">“' + esc(s.title) + '”</a>' : '“' + esc(s.title) + '”') + '</div>' : '') + '</div></div>' +
        '<div class="flex items-center gap-space-sm shrink-0"><span class="px-2 py-0.5 rounded-full ' + (rg ? "bg-secondary-fixed text-on-secondary-fixed" : "bg-surface-container-high text-on-surface") + ' font-code-sm text-code-sm uppercase">' + (rg ? "Reading group" : "Speaker series") + '</span>' + (s.paper ? '<a class="p-1 text-tertiary hover:text-primary transition-colors" href="' + esc(s.paper) + '" rel="noopener" title="Paper"><span class="material-symbols-outlined text-[18px]">description</span></a>' : '') + '</div></div>';
    }).join("");
  }
  var tc = $("#type-chips");
  if (tc) tc.addEventListener("click", function (e) { var b = e.target.closest("[data-type]"); if (!b) return; F.type = b.getAttribute("data-type"); $$(".type-chip", tc).forEach(function (x) { chipOn(x, x === b); }); renderArchive(TALKS); });
  var si = $("#archive-search"); if (si) si.addEventListener("input", function () { F.q = si.value; renderArchive(TALKS); });

  function renderAll() { renderNext(TALKS); renderProgramme(TALKS); renderArchive(TALKS); }

  fetch("data/talks.json").then(function (r) { return r.json(); }).then(function (rows) { TALKS = rows; renderAll(); loadLive(); })
    .catch(function () { var b = $("#programme-body"); if (b) b.innerHTML = '<tr><td colspan="4" class="p-space-md text-on-surface-variant">Programme could not be loaded.</td></tr>'; });

  /* ---------- live programme from Firestore (public/programme, written by the committee app) ---------- */
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function loadLive() {
    if (!CFG.firebase || CFG.livePublic === false) return;
    var v = CFG.firebaseVersion || "12.4.0";
    loadScript("https://www.gstatic.com/firebasejs/" + v + "/firebase-app-compat.js").then(function () { return loadScript("https://www.gstatic.com/firebasejs/" + v + "/firebase-firestore-compat.js"); })
      .then(function () { var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CFG.firebase); return app.firestore().collection("public").doc("programme").get(); })
      .then(function (doc) {
        if (!doc.exists) return; var d = doc.data() || {}; var live = (d.sessions || []).filter(function (s) { return s && s.date; }); if (!live.length) return;
        var dates = {}; live.forEach(function (s) { dates[s.date] = true; });
        var statics = TALKS;
        TALKS = TALKS.filter(function (s) { return !isUpcoming(s) && !dates[s.date]; }).concat(live.map(function (s) { return { date: s.date, time: s.time || "17:00", speaker: s.speaker || "", affiliation: s.affiliation || "", url: s.url || "", title: s.title || "", abstract: s.abstract || "", paper: s.paper || "", photo: photoFor(s, statics), type: "Speaker Series", term: s.term || d.term || "" }; }));
        if (d.theme) CFG.termTheme = d.theme; renderAll();
      }).catch(function () { });
  }
})();

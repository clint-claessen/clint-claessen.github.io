/* TaDa speaker form: reads open dates from public/programme, writes a document to /responses. */
(function () {
  "use strict";
  var CFG = window.TADA_CONFIG || {};
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function fmt(iso) { var p = iso.split("-"); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)); return DAYS[d.getUTCDay()] + " " + (+p[2]) + " " + MONTHS[+p[1] - 1] + " " + p[0]; }
  function berlinOffset(iso) { try { var tz = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" }).formatToParts(new Date(iso + "T12:00:00Z")).filter(function (x) { return x.type === "timeZoneName"; })[0].value; return /\+02/.test(tz) ? 2 : 1; } catch (e) { return 1; } }
  function usOffset(iso) { try { var tz = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" }).formatToParts(new Date(iso + "T12:00:00Z")).filter(function (x) { return x.type === "timeZoneName"; })[0].value; return /-04/.test(tz) ? -4 : -5; } catch (e) { return -5; } }
  function zones(iso, time) {
    var t = (time || "17:00").split(":"); var h = +t[0]; var utc = h - berlinOffset(iso); var ny = utc + usOffset(iso); var la = ny - 3; var lon = utc + (berlinOffset(iso) === 2 ? 1 : 0);
    function hh(x) { return (x < 10 ? "0" : "") + x + ":" + (t[1] || "00"); }
    return hh(h) + " " + (berlinOffset(iso) === 2 ? "CEST" : "CET") + " (Berlin) · " + hh(lon) + " London · " + hh(ny) + " New York · " + hh(la) + " Los Angeles";
  }
  var today = new Date().toISOString().slice(0, 10);
  var db = null;
  if (CFG.firebase && window.firebase) { firebase.initializeApp(CFG.firebase); db = firebase.firestore(); }

  function renderDates(list, term, theme) {
    var box = $("#dates");
    if (term) $("#term-tag").textContent = term; if (theme) $("#theme-tag").textContent = theme;
    var open = list.filter(function (s) { return s.date >= today && !s.speaker; });
    if (!open.length) { box.innerHTML = '<p class="font-body-sm text-body-sm text-tertiary">No open dates are listed right now; tick "none of these" and we will get in touch.</p>'; return; }
    box.innerHTML = open.map(function (s, i) {
      return '<label class="group relative flex items-center justify-between p-space-md rounded-lg bg-surface hover:bg-surface-container transition-all cursor-pointer shadow-sm"><div class="flex items-center gap-space-md"><input class="w-4 h-4 rounded" name="dates" type="checkbox" value="' + esc(s.date) + '" /><div class="flex flex-col"><span class="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">' + esc(fmt(s.date)) + '</span><span class="font-body-sm text-body-sm text-on-surface-variant">' + esc(zones(s.date, s.time)) + '</span></div></div><span class="font-code-sm text-code-sm text-secondary bg-surface-container-lowest px-space-xs py-0.5 rounded shadow-sm">Slot ' + String.fromCharCode(65 + i) + '</span></label>';
    }).join("");
  }
  function loadDates() {
    var fallback = function () { fetch("../data/talks.json").then(function (r) { return r.json(); }).then(function (rows) { renderDates(rows, (rows.filter(function (x) { return x.term && x.date >= today; })[0] || {}).term, CFG.termTheme); }).catch(function () { renderDates([]); }); };
    if (!db) return fallback();
    db.collection("public").doc("programme").get().then(function (doc) { if (doc.exists && (doc.data().sessions || []).length) renderDates(doc.data().sessions, doc.data().term, doc.data().theme); else fallback(); }).catch(fallback);
  }
  loadDates();

  var ab = $("#abstract"), wc = $("#wc");
  ab.addEventListener("input", function () { var n = ab.value.trim() ? ab.value.trim().split(/\s+/).length : 0; wc.textContent = n + " / 200 words"; wc.className = "font-code-sm text-code-sm " + (n > 200 ? "text-error font-semibold" : "text-tertiary"); });
  $("#none").addEventListener("change", function () { document.querySelectorAll('input[name="dates"]').forEach(function (cb) { if ($("#none").checked) cb.checked = false; cb.disabled = $("#none").checked; }); });

  function showError(msg) { $("#error").hidden = false; $("#error-text").textContent = msg; window.scrollTo({ top: 0, behavior: "smooth" }); }
  $("#speaker-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#error").hidden = true;
    var dates = Array.prototype.map.call(document.querySelectorAll('input[name="dates"]:checked'), function (cb) { return cb.value; });
    var none = $("#none").checked;
    var v = { name: $("#name").value.trim(), email: $("#email").value.trim(), affiliation: $("#affiliation").value.trim(), url: $("#url").value.trim(), bluesky: $("#bluesky").value.trim(), linkedin: $("#linkedin").value.trim(), title: $("#title").value.trim(), abstract: $("#abstract").value.trim(), paper: $("#paper").value.trim(), dates: dates, noneOfThese: none, recording: (document.querySelector('input[name="rec"]:checked') || {}).value || "public", notes: $("#notes").value.trim() };
    if (!v.name || !v.email || !v.affiliation || !v.title || !v.abstract) return showError("Please fill in name, e-mail, affiliation, title and abstract.");
    if (!dates.length && !none) return showError("Please tick at least one date, or 'none of these work for me'.");
    if (!db) return showError("The form is not connected yet. Please e-mail your details to nicolai.berk@gess.ethz.ch.");
    var btn = $("#submit"); btn.disabled = true;
    v.handled = false; v.createdAt = firebase.firestore.FieldValue.serverTimestamp(); v.ua = navigator.userAgent.slice(0, 120);
    db.collection("responses").add(v).then(function () { $("#success").hidden = false; $("#speaker-form").hidden = true; window.scrollTo({ top: 0, behavior: "smooth" }); })
      .catch(function (err) { btn.disabled = false; showError("Submission failed (" + (err && err.code ? err.code : "network") + "). Please try again or e-mail us."); });
  });
})();

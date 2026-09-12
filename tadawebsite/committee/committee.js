/* TaDa Executive Committee — organizer-only app on Firebase (Auth + Firestore), no build step.
   Collections: members/{uid}, sessions/{date}, candidates/{id}, responses/{id}, messages/{id},
   settings/{pinned|allowlist|term-*}, public/programme */
(function () {
  "use strict";
  var CFG = window.TADA_CONFIG || {};
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function dparts(iso) { var p = iso.split("-"); return { y: +p[0], m: +p[1], d: +p[2], dow: new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)).getUTCDay() }; }
  function fmtShort(iso) { if (!iso) return ""; var p = dparts(iso); return DAYS[p.dow] + " " + p.d + " " + MONTHS[p.m - 1]; }
  function fmtLong(iso) { if (!iso) return ""; var p = dparts(iso); return DAYS_LONG[p.dow] + ", " + p.d + " " + MONTHS_LONG[p.m - 1] + " " + p.y; }
  function fmtMid(iso) { if (!iso) return ""; var p = dparts(iso); return DAYS_LONG[p.dow] + " " + p.d + " " + MONTHS[p.m - 1] + " " + p.y; }
  function berlinOffset(iso) { try { var tzn = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" }).formatToParts(new Date(iso + "T12:00:00Z")).filter(function (x) { return x.type === "timeZoneName"; })[0].value; return /\+02/.test(tzn) ? 2 : 1; } catch (e) { return 1; } }
  function tz(iso) { return berlinOffset(iso) === 2 ? "CEST" : "CET"; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function isoOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function nowLabel() { var d = new Date(); return isoOf(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function firstName(n) { return (n || "").trim().split(/\s+/)[0] || ""; }
  function initialsOf(n) { return (n || "").split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join("").slice(0, 3).toUpperCase() || "??"; }
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2600); }
  function copyText(s) { return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { toast("Copied"); }, function () { toast("Copy failed: select the text and copy manually"); }); }
  function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  function friendly(err) {
    var c = (err && err.code) || "";
    if (/wrong-password|invalid-credential|invalid-login-credentials/.test(c)) return "E-mail or password is wrong.";
    if (/user-not-found/.test(c)) return "No account with this e-mail. Accounts are created in the Firebase console.";
    if (/too-many-requests/.test(c)) return "Too many attempts. Wait a few minutes or reset your password.";
    if (/requires-recent-login/.test(c)) return "Please sign out and in again, then retry.";
    if (/permission-denied/.test(c)) return "Not allowed: check the Firestore rules or the organizer allow-list.";
    if (/email-already-in-use/.test(c)) return "That e-mail already belongs to another account.";
    if (/weak-password/.test(c)) return "Password too weak (min. 8 characters).";
    if (/network-request-failed/.test(c)) return "Network problem. Try again.";
    return (err && err.message) || "Something went wrong.";
  }
  var AV_COLORS = ["bg-primary-container text-on-primary", "bg-secondary text-on-secondary", "bg-tertiary-container text-on-tertiary-container", "bg-primary text-on-primary", "bg-secondary-container text-on-secondary-container"];
  function avColor(uid) { var h = 0; for (var i = 0; i < (uid || "").length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
  /* Photo links are stored as entered; site-relative paths (assets/...) are resolved from the site root, one level up from committee/. */
  function photoSrc(p) { return /^(https?:|\/|data:|\.\.\/)/i.test(p) ? p : "../" + p.replace(/^\.\//, ""); }
  document.addEventListener("error", function (e) { var img = e.target; if (!img || img.tagName !== "IMG" || !img.hasAttribute("data-initials")) return; var sp = document.createElement("span"); sp.textContent = img.getAttribute("data-initials"); img.replaceWith(sp); }, true);
  function pillClass(kind, v) {
    var M = { session: { open: "slate", invited: "amber", confirmed: "ok", declined: "rose", done: "sky", cancelled: "rose" }, inv: { none: "slate", draft: "amber", sent: "sky", replied: "amber", confirmed: "ok", declined: "rose" }, promo: { todo: "slate", draft: "amber", scheduled: "sky", done: "ok" }, cand: { idea: "slate", invited: "sky", replied: "amber", confirmed: "ok", declined: "rose", waitlist: "amber" } };
    return (M[kind] || {})[v] || "slate";
  }

  var loginView = $("#view-login"), appView = $("#view-app");
  if (!CFG.firebase || !window.firebase) { loginView.hidden = false; $("#setup-help").hidden = false; $("#login-form button[type=submit]").disabled = true; return; }
  firebase.initializeApp(CFG.firebase);
  var auth = firebase.auth(), db = firebase.firestore();
  try { db.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) { }
  var TS = function () { return firebase.firestore.FieldValue.serverTimestamp(); };
  var FP = firebase.firestore.FieldPath;
  var FORM_URL = location.origin + location.pathname.replace(/committee\/[^/]*$/, "speak/");

  var me = null, user = null, members = {}, sessions = [], candidates = [], responses = [], messages = [], termSettings = {}, currentTerm = null, unsub = [];
  var view = "series", chan = "general", threadRoot = null, selectedCand = null, editing = null;
  var CHANNELS = [{ id: "general", name: "general", desc: "Everything about the series that has no better home." }, { id: "speakers", name: "speakers", desc: "Invitations, replies, scheduling." }, { id: "promo", name: "promo", desc: "Newsletter, LinkedIn, Bluesky, website." }, { id: "random", name: "random", desc: "Off-topic, conferences, papers." }];

  /* ---------- navigation ---------- */
  var CRUMB = { series: "Series", responses: "Speaker responses", candidates: "Candidates", messages: "Messages", profile: "Profile & settings" };
  function go(v) {
    view = v; $$(".nav-item").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-view") === v); });
    $$(".view").forEach(function (p) { p.hidden = p.id !== "v-" + v; });
    $("#crumb").textContent = CRUMB[v]; closeSidebar();
    if (v === "messages") { markRead(chan); scrollMsgs(); setTimeout(function () { $("#msg-input").focus(); }, 50); }
    if (v === "responses") renderResponses();
  }
  $("#nav").addEventListener("click", function (e) { var b = e.target.closest("[data-view]"); if (b) go(b.getAttribute("data-view")); });
  function closeSidebar() { $("#sidebar").classList.remove("open"); $("#sb-backdrop").hidden = true; }
  $("#sb-toggle").addEventListener("click", function () { var sb = $("#sidebar"); sb.classList.toggle("open"); $("#sb-backdrop").hidden = !sb.classList.contains("open"); });
  $("#sb-backdrop").addEventListener("click", closeSidebar);

  /* ---------- auth ---------- */
  function showLogin() { appView.hidden = true; loginView.hidden = false; unsub.forEach(function (u) { u(); }); unsub = []; }
  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#login-error").textContent = "";
    auth.signInWithEmailAndPassword($("#login-email").value.trim(), $("#login-password").value).catch(function (err) { $("#login-error").textContent = friendly(err); });
  });
  $("#login-reset").addEventListener("click", function () {
    var em = $("#login-email").value.trim(); if (!em) { $("#login-error").textContent = "Enter your e-mail first, then click “Forgot password?”."; return; }
    auth.sendPasswordResetEmail(em).then(function () { $("#login-error").textContent = "Reset link sent to " + em + "."; }, function (err) { $("#login-error").textContent = friendly(err); });
  });
  $("#sign-out").addEventListener("click", function () { auth.signOut(); });
  auth.onAuthStateChanged(function (u) {
    user = u; if (!u) { showLogin(); return; }
    ensureMember(u).then(function (m) { me = m; loginView.hidden = true; appView.hidden = false; start(); })
      .catch(function (err) { loginView.hidden = false; $("#login-error").textContent = friendly(err); auth.signOut(); });
  });
  function ensureMember(u) {
    var ref = db.collection("members").doc(u.uid);
    return ref.get().then(function (snap) {
      if (snap.exists) {
        var m = snap.data();
        if (m.email !== u.email) { var old = (m.email || "").toLowerCase(), nw = (u.email || "").toLowerCase(); return ref.update({ email: u.email, updatedAt: TS() }).then(function () { return swapAllowlist(old, nw); }).then(function () { m.email = u.email; return m; }); }
        return m;
      }
      var name = u.displayName || (u.email || "").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var m0 = { name: name, username: (u.email || "").split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase(), initials: initialsOf(name), intro: "", email: u.email, reads: {}, createdAt: TS(), updatedAt: TS() };
      return ref.set(m0).then(function () { return m0; });
    });
  }
  function swapAllowlist(oldE, newE) {
    var ref = db.collection("settings").doc("allowlist");
    return ref.get().then(function (s) { if (!s.exists) return; var emails = (s.data().emails || []).map(function (e) { return String(e).toLowerCase(); }); if (emails.indexOf(newE) < 0) emails.push(newE); emails = emails.filter(function (e) { return e !== oldE; }); return ref.set({ emails: emails, updatedAt: TS() }, { merge: true }); }).catch(function () { });
  }

  /* ---------- live data ---------- */
  function start() {
    unsub.forEach(function (u) { u(); }); unsub = [];
    paintMe(); fillProfile(); $("#form-link").textContent = FORM_URL; $("#pf-form-link").textContent = FORM_URL; $("#pf-form-link").href = FORM_URL;
    unsub.push(db.collection("members").onSnapshot(function (qs) {
      members = {}; qs.forEach(function (d) { members[d.id] = d.data(); });
      if (members[user.uid]) { me = members[user.uid]; paintMe(); }
      renderMembers(); fillPeopleSelects(); renderChannels(); renderSessions(); renderMessages();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("sessions").onSnapshot(function (qs) {
      sessions = []; qs.forEach(function (d) { var x = d.data(); x.id = d.id; sessions.push(x); });
      sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      renderTerms(); renderSessions(); fillSlotSelect(); renderResponses();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("candidates").onSnapshot(function (qs) {
      candidates = []; qs.forEach(function (d) { var x = d.data(); x.id = d.id; candidates.push(x); });
      candidates.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
      renderCandidates();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("responses").onSnapshot(function (qs) {
      responses = []; qs.forEach(function (d) { var x = d.data(); x.id = d.id; responses.push(x); });
      responses.sort(function (a, b) { return ms(b) - ms(a); });
      var n = responses.filter(function (r) { return !r.handled; }).length; var b = $("#resp-badge"); b.hidden = !n; b.textContent = n + " new";
      renderResponses();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("messages").orderBy("createdAt", "asc").limitToLast(800).onSnapshot(function (qs) {
      messages = []; qs.forEach(function (d) { var x = d.data(); x.id = d.id; messages.push(x); });
      renderChannels(); renderMessages(); if (threadRoot) renderThread();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("settings").onSnapshot(function (qs) {
      termSettings = {}; qs.forEach(function (d) {
        var x = d.data();
        if (d.id === "pinned") { if (document.activeElement !== $("#pinned")) $("#pinned").value = x.text || ""; $("#pinned-hint").textContent = x.updatedBy ? "Last saved by " + x.updatedBy + " · " + (x.updatedAtLabel || "") : ""; $("#pin-toggle").classList.toggle("text-amber-ink", !!(x.text || "").trim()); }
        else if (d.id === "allowlist") { if (document.activeElement !== $("#allow-emails")) $("#allow-emails").value = (x.emails || []).join("\n"); }
        else if (d.id.indexOf("term-") === 0) termSettings[d.id.slice(5)] = x;
      });
      renderTermHead();
    }, function (err) { toast(friendly(err)); }));
  }
  function paintMe() { $("#user-initials").textContent = me.initials || initialsOf(me.name); $("#user-name").textContent = me.name || ""; $("#user-initials").className = "w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md font-semibold " + avColor(user.uid); }
  function memberList() { return Object.keys(members).map(function (uid) { var m = members[uid]; m.uid = uid; return m; }).sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); }); }
  function fillPeopleSelects() {
    var opts = '<option value="">—</option>' + memberList().map(function (m) { return '<option value="' + esc(m.initials) + '">' + esc(m.initials + " · " + m.name) + '</option>'; }).join("");
    ["sd-chair", "cd-proposedBy", "cd-owner"].forEach(function (id) { var s = $("#" + id), v = s.value; s.innerHTML = opts; s.value = v; });
  }

  /* ---------- terms ---------- */
  function termOf(s) { return s.term || "Unassigned"; }
  function termList() { var map = {}; sessions.forEach(function (s) { var t = termOf(s); if (!map[t] || s.date < map[t]) map[t] = s.date; }); return Object.keys(map).sort(function (a, b) { return map[a] < map[b] ? 1 : -1; }); }
  function renderTerms() {
    var sel = $("#term-select"), terms = termList();
    if (!currentTerm || terms.indexOf(currentTerm) < 0) { var today = todayISO(), up = sessions.filter(function (s) { return s.date >= today; })[0]; currentTerm = up ? termOf(up) : (terms[0] || null); }
    sel.innerHTML = terms.length ? terms.map(function (t) { return '<option value="' + esc(t) + '"' + (t === currentTerm ? " selected" : "") + '>' + esc(t) + '</option>'; }).join("") : '<option value="">No term yet</option>';
    renderTermHead();
  }
  $("#term-select").addEventListener("change", function () { currentTerm = this.value; renderTermHead(); renderSessions(); fillSlotSelect(); });
  function renderTermHead() {
    var ts = termSettings[currentTerm] || {};
    $("#crumb-term-name").textContent = currentTerm || "—";
    $("#series-theme").textContent = currentTerm ? "Theme: " + (ts.theme || CFG.termTheme || "—") + (ts.formUrl ? " · custom speaker form link set" : "") : "Create a term to start.";
    $("#publish-hint").textContent = ts.publishedAtLabel ? "Live: " + ts.publishedAtLabel + " by " + (ts.publishedBy || "?") : "Not published yet";
  }
  $("#edit-term").addEventListener("click", function () {
    if (!currentTerm) { toast("Create a term first"); return; }
    var ts = termSettings[currentTerm] || {}; $("#td-title").textContent = currentTerm; $("#td-theme").value = ts.theme || CFG.termTheme || ""; $("#td-form").value = ts.formUrl || ""; $("#term-dlg").showModal();
  });
  $("#term-form").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value !== "save") return;
    db.collection("settings").doc("term-" + currentTerm).set({ theme: $("#td-theme").value.trim(), formUrl: $("#td-form").value.trim(), updatedAt: TS(), updatedBy: me.initials }, { merge: true }).then(function () { toast("Term settings saved"); }, function (err) { toast(friendly(err)); });
  });
  $("#new-term").addEventListener("click", function () { $("#nt-name").value = ""; $("#nt-theme").value = ""; $("#nt-dates").value = ""; $("#nt-first").value = ""; $("#newterm-dlg").showModal(); });
  $("#nt-fill").addEventListener("click", function () {
    var f = $("#nt-first").value, n = +$("#nt-count").value || 6, every = +$("#nt-every").value || 2; if (!f) { toast("Pick the first Wednesday"); return; }
    var p = f.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]), out = [];
    for (var i = 0; i < n; i++) { out.push(isoOf(d)); d.setDate(d.getDate() + 7 * every); }
    $("#nt-dates").value = out.join("\n");
  });
  $("#newterm-form").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value !== "create") return;
    var name = $("#nt-name").value.trim(), list = $("#nt-dates").value.split(/[\s,]+/).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
    if (!name || !list.length) { e.preventDefault(); toast("Name and at least one date are required"); return; }
    var batch = db.batch();
    list.forEach(function (d) { batch.set(db.collection("sessions").doc(d), blankSession(name, d), { merge: true }); });
    var theme = $("#nt-theme").value.trim(); if (theme) batch.set(db.collection("settings").doc("term-" + name), { theme: theme, updatedAt: TS(), updatedBy: me.initials }, { merge: true });
    batch.commit().then(function () { currentTerm = name; toast("Term created with " + list.length + " sessions"); }, function (err) { toast(friendly(err)); });
  });
  function blankSession(term, d) { return { term: term, date: d, time: "17:00", speaker: "", affiliation: "", url: "", title: "", status: "open", chair: "", invitation: { status: "none", draft: "" }, promo: { newsletter: { status: "todo", draft: "" }, linkedin: { status: "todo", draft: "" }, bluesky: { status: "todo", draft: "" }, website: { status: "todo" } }, createdAt: TS(), updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() }; }
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", function () { b.closest("dialog").close(); }); });
  $("#seed-btn").addEventListener("click", function () {
    fetch("seed.json").then(function (r) { return r.json(); }).then(function (S) {
      var batch = db.batch();
      S.sessions.forEach(function (s) { batch.set(db.collection("sessions").doc(s.date), Object.assign(blankSession(S.term, s.date), s, { invitation: { status: s.status === "confirmed" ? "confirmed" : "none", draft: "" } }), { merge: true }); });
      S.candidates.forEach(function (c) { batch.set(db.collection("candidates").doc(), Object.assign({ draft: "", createdAt: TS(), updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() }, c)); });
      batch.set(db.collection("settings").doc("term-" + S.term), { theme: S.theme, updatedAt: TS(), updatedBy: me.initials }, { merge: true });
      return batch.commit();
    }).then(function () { currentTerm = "Fall 2026"; toast("Imported Fall 2026"); }, function (err) { toast(friendly(err)); });
  });

  /* ---------- sessions table ---------- */
  var SF = { status: "all", q: "" };
  function sessionsOfTerm() { return sessions.filter(function (s) { return termOf(s) === currentTerm; }); }
  function pillSel(field, kind, value, opts) { return '<select class="pill-select ' + pillClass(kind, value) + '" data-field="' + field + '">' + opts.map(function (o) { return '<option value="' + o + '"' + (o === value ? " selected" : "") + '>' + o + '</option>'; }).join("") + '</select>'; }
  var PROMO = ["todo", "draft", "scheduled", "done"], INV = ["none", "draft", "sent", "replied", "confirmed", "declined"], STATUS = ["open", "invited", "confirmed", "declined", "done", "cancelled"];
  function promoCell(k, letter, st) { return '<span class="promo-cell ' + esc(st) + '" data-promo="' + k + '" title="' + k + ": " + esc(st) + '">' + letter + '</span>'; }
  function renderSessions() {
    var q = SF.q.toLowerCase(), rows = sessionsOfTerm().filter(function (s) {
      var st = s.status || "open"; if (SF.status === "off" && !(st === "declined" || st === "cancelled")) return false; if (SF.status !== "all" && SF.status !== "off" && st !== SF.status) return false;
      return !q || ((s.speaker || "") + " " + (s.title || "") + " " + (s.affiliation || "")).toLowerCase().indexOf(q) >= 0;
    });
    $("#sessions-empty").hidden = rows.length > 0; $("#seed-btn").hidden = sessions.length > 0;
    $("#sessions-body").innerHTML = rows.map(function (s) {
      var inv = (s.invitation || {}).status || "none", pr = s.promo || {}, chairM = memberList().filter(function (m) { return m.initials === s.chair; })[0];
      return '<tr data-id="' + esc(s.id) + '" class="cursor-pointer">' +
        '<td><div class="font-headline-sm text-headline-sm tabular">' + esc(fmtShort(s.date)) + ' <span class="text-tertiary font-normal">' + esc(s.date.slice(0, 4)) + '</span></div><div class="font-code-sm text-code-sm text-tertiary mt-0.5">' + esc((s.time || "17:00") + " " + tz(s.date)) + '</div></td>' +
        '<td class="max-w-[360px]">' + (s.speaker ? '<div class="font-headline-sm text-headline-sm truncate">' + esc(s.speaker) + '</div>' + (s.affiliation ? '<div class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(s.affiliation) + '</div>' : "") + (s.title ? '<div class="font-body-sm text-body-sm text-primary italic truncate">“' + esc(s.title) + '”</div>' : "") : '<div class="font-headline-sm text-headline-sm text-tertiary italic">Open slot</div><div class="font-body-sm text-body-sm text-outline">' + (s.notes ? esc(s.notes.slice(0, 80)) + (s.notes.length > 80 ? "…" : "") : "No speaker yet") + '</div>') + '</td>' +
        '<td>' + pillSel("status", "session", s.status || "open", STATUS) + '</td>' +
        '<td>' + (s.chair ? '<span class="avatar w-7 h-7 text-[10px] ' + (chairM ? avColor(chairM.uid) : "bg-surface-container-high text-on-surface") + '" title="' + esc(chairM ? chairM.name : s.chair) + '">' + esc(s.chair) + '</span>' : '<span class="text-outline">—</span>') + '</td>' +
        '<td>' + pillSel("invitation.status", "inv", inv, INV) + (s.invitation && s.invitation.sentBy ? '<div class="hint mt-1">' + esc(s.invitation.sentBy + " · " + (s.invitation.sentAt || "").slice(0, 10)) + '</div>' : "") + '</td>' +
        '<td><span class="promo-grid">' + promoCell("newsletter", "N", (pr.newsletter || {}).status || "todo") + promoCell("linkedin", "L", (pr.linkedin || {}).status || "todo") + promoCell("bluesky", "B", (pr.bluesky || {}).status || "todo") + promoCell("website", "W", (pr.website || {}).status || "todo") + '</span></td>' +
        '<td><span class="hint">' + esc(s.updatedBy ? s.updatedBy + " · " + (s.updatedAtLabel || "") : "") + '</span></td>' +
        '<td><button class="btn btn-ghost" type="button" data-open title="Open"><span class="material-symbols-outlined text-[18px]">open_in_full</span></button></td></tr>';
    }).join("");
  }
  $("#status-chips").addEventListener("click", function (e) { var b = e.target.closest("[data-status]"); if (!b) return; SF.status = b.getAttribute("data-status"); $$(".filter-chip", this).forEach(function (x) { x.classList.toggle("is-on", x === b); }); renderSessions(); });
  $("#session-search").addEventListener("input", function () { SF.q = this.value.trim(); renderSessions(); });
  function sessionById(id) { return sessions.filter(function (x) { return x.id === id; })[0]; }
  function patchSession(id, upd) { upd.updatedAt = TS(); upd.updatedBy = me.initials; upd.updatedAtLabel = nowLabel(); return db.collection("sessions").doc(id).update(upd).then(function () { toast("Saved"); }, function (err) { toast(friendly(err)); }); }
  $("#sessions-body").addEventListener("change", function (e) {
    var sel = e.target.closest("select.pill-select"); if (!sel) return;
    var id = sel.closest("tr").getAttribute("data-id"), field = sel.getAttribute("data-field"), upd = {}; upd[field] = sel.value;
    if (field === "invitation.status" && sel.value === "sent") { upd["invitation.sentBy"] = me.initials; upd["invitation.sentAt"] = nowLabel(); }
    patchSession(id, upd);
  });
  $("#sessions-body").addEventListener("click", function (e) {
    if (e.target.closest("select")) return;
    var pc = e.target.closest("[data-promo]");
    if (pc) { var id0 = pc.closest("tr").getAttribute("data-id"), k = pc.getAttribute("data-promo"), s0 = sessionById(id0), cur = ((s0.promo || {})[k] || {}).status || "todo", list = k === "website" ? ["todo", "done"] : PROMO, upd = {}; upd["promo." + k + ".status"] = list[(list.indexOf(cur) + 1) % list.length]; patchSession(id0, upd); return; }
    var tr = e.target.closest("tr[data-id]"); if (!tr) return; var s = sessionById(tr.getAttribute("data-id")); if (s) openSession(s);
  });
  $("#new-session").addEventListener("click", function () { openSession(null); });

  /* ---------- publish ---------- */
  $("#publish-programme").addEventListener("click", function () {
    if (!currentTerm) { toast("No term selected"); return; }
    var ts = termSettings[currentTerm] || {};
    var pub = sessionsOfTerm().filter(function (s) { return s.status !== "cancelled"; }).map(function (s) { var show = s.status === "confirmed" || s.status === "done"; return { date: s.date, time: s.time || "17:00", term: currentTerm, speaker: show ? (s.speaker || "") : "", affiliation: show ? (s.affiliation || "") : "", url: show ? (s.url || "") : "", photo: show ? (s.photo || "") : "", title: show ? (s.title || "") : "", paper: show ? (s.paper || "") : "", abstract: show ? (s.abstract || "") : "" }; });
    if (!confirm("Publish " + pub.length + " session(s) of " + currentTerm + " to the public website?\nSpeakers are shown only when their status is confirmed or done; other slots appear as open.")) return;
    var label = nowLabel();
    db.collection("public").doc("programme").set({ term: currentTerm, theme: ts.theme || CFG.termTheme || "", sessions: pub, updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: label })
      .then(function () { return db.collection("settings").doc("term-" + currentTerm).set({ publishedAtLabel: label, publishedBy: me.initials }, { merge: true }); })
      .then(function () { return db.batch(); }).then(function (b) { sessionsOfTerm().forEach(function (s) { if (s.status === "confirmed" || s.status === "done") b.update(db.collection("sessions").doc(s.id), { "promo.website.status": "done" }); }); return b.commit(); })
      .then(function () { toast("Published to the website"); }, function (err) { toast(friendly(err)); });
  });

  /* ---------- session drawer ---------- */
  var drawer = $("#drawer"), sform = $("#session-form");
  var F = ["date", "time", "term", "status", "speaker", "affiliation", "email", "url", "photo", "chair", "bsky", "linkedin", "talktitle", "abstract", "paper", "zoom", "recording", "notes"];
  function sd(k) { return $("#sd-" + k); }
  function openDrawer() { drawer.classList.add("open"); $("#drawer-backdrop").hidden = false; document.body.style.overflow = "hidden"; }
  function closeDrawer() { drawer.classList.remove("open"); $("#drawer-backdrop").hidden = true; document.body.style.overflow = ""; editing = null; }
  $("#drawer-close").addEventListener("click", closeDrawer); $("#drawer-cancel").addEventListener("click", closeDrawer); $("#drawer-backdrop").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (drawer.classList.contains("open")) closeDrawer(); else if (!$("#thread").hidden) closeThread(); } });
  function openSession(s) {
    editing = s; fillPeopleSelects();
    $("#sd-title").textContent = s ? (s.speaker || "Open slot") + " · " + fmtShort(s.date) + " " + s.date.slice(0, 4) : "New session";
    $("#sd-av").innerHTML = s && s.photo ? '<img class="w-9 h-9 rounded-pill object-cover" src="' + esc(photoSrc(s.photo)) + '" alt="" data-initials="' + esc(initialsOf(s.speaker || "").slice(0, 2)) + '" />' : esc(s && s.speaker ? initialsOf(s.speaker).slice(0, 2) : "+");
    F.forEach(function (k) { var key = k === "talktitle" ? "title" : k; sd(k).value = s ? (s[key] || (k === "time" ? "17:00" : "")) : (k === "time" ? "17:00" : k === "term" ? (currentTerm || "") : k === "status" ? "open" : ""); });
    var inv = (s && s.invitation) || {}, pr = (s && s.promo) || {};
    $("#sd-inv-status").value = inv.status || "none"; $("#sd-inv-draft").value = inv.draft || "";
    $("#sd-inv-meta").textContent = inv.sentBy ? "Sent by " + inv.sentBy + " on " + (inv.sentAt || "") + (inv.to ? " to " + inv.to : "") : "";
    ["newsletter", "linkedin", "bluesky"].forEach(function (k) { $("#sd-p-" + k).value = (pr[k] || {}).status || "todo"; $("#sd-d-" + k).value = (pr[k] || {}).draft || ""; });
    $("#sd-p-website").value = (pr.website || {}).status || "todo";
    $("#sd-hint").textContent = $("#sd-hint2").textContent = s && s.updatedBy ? "Last change " + s.updatedBy + " · " + (s.updatedAtLabel || "") : "";
    $("[data-delete-session]").hidden = !s; bskyCount(); recolorPills(); openDrawer(); sform.scrollTop = 0;
  }
  function recolorPills() { $$("select.pill-select", drawer).forEach(function (s) { var kind = s.id === "sd-inv-status" ? "inv" : "promo"; s.className = "pill-select " + pillClass(kind, s.value); }); }
  drawer.addEventListener("change", function (e) { if (e.target.matches("select.pill-select")) recolorPills(); });
  function sessionFromForm() {
    var o = {}; F.forEach(function (k) { o[k === "talktitle" ? "title" : k] = sd(k).value.trim(); });
    o.invitation = { status: $("#sd-inv-status").value, draft: $("#sd-inv-draft").value, sentBy: (editing && editing.invitation && editing.invitation.sentBy) || "", sentAt: (editing && editing.invitation && editing.invitation.sentAt) || "", to: o.email };
    o.promo = { newsletter: { status: $("#sd-p-newsletter").value, draft: $("#sd-d-newsletter").value }, linkedin: { status: $("#sd-p-linkedin").value, draft: $("#sd-d-linkedin").value }, bluesky: { status: $("#sd-p-bluesky").value, draft: $("#sd-d-bluesky").value }, website: { status: $("#sd-p-website").value } };
    return o;
  }
  sform.addEventListener("submit", function (e) {
    e.preventDefault(); var o = sessionFromForm(); if (!o.date) { $("#sd-hint").textContent = "Date is required."; sd("date").focus(); return; }
    o.updatedAt = TS(); o.updatedBy = me.initials; o.updatedAtLabel = nowLabel();
    var p;
    if (editing && editing.id !== o.date) p = db.collection("sessions").doc(o.date).set(Object.assign({ createdAt: TS() }, editing, o, { id: undefined })).then(function () { return db.collection("sessions").doc(editing.id).delete(); });
    else p = db.collection("sessions").doc(editing ? editing.id : o.date).set(Object.assign(editing ? {} : { createdAt: TS() }, o), { merge: true });
    p.then(function () { toast("Session saved"); closeDrawer(); }, function (err) { $("#sd-hint").textContent = friendly(err); toast(friendly(err)); });
  });
  $("[data-delete-session]").addEventListener("click", function () { if (!editing || !confirm("Delete this session? This cannot be undone.")) return; db.collection("sessions").doc(editing.id).delete().then(function () { toast("Deleted"); closeDrawer(); }, function (err) { toast(friendly(err)); }); });
  $("[data-mark-sent]").addEventListener("click", function () {
    $("#sd-inv-status").value = "sent"; recolorPills();
    if (!editing) { toast("Save the session first"); return; }
    var upd = { "invitation.status": "sent", "invitation.sentBy": me.initials, "invitation.sentAt": nowLabel(), "invitation.to": sd("email").value.trim(), "invitation.draft": $("#sd-inv-draft").value, status: editing.status === "open" ? "invited" : editing.status };
    patchSession(editing.id, upd).then(function () { $("#sd-inv-meta").textContent = "Sent by " + me.initials + " on " + upd["invitation.sentAt"]; sd("status").value = upd.status; });
  });
  function bskyCount() { var n = $("#sd-d-bluesky").value.length, c = $("#bsky-count"); c.textContent = n + "/300"; c.classList.toggle("over", n > 300); }
  $("#sd-d-bluesky").addEventListener("input", bskyCount);

  /* ---------- drafts: generate / copy / mailto ---------- */
  document.addEventListener("click", function (e) {
    var g = e.target.closest("[data-gen]"); if (g) { generate(g.getAttribute("data-gen")); return; }
    var c = e.target.closest("[data-copy]"); if (c) { copyText($("#" + c.getAttribute("data-copy")).value); return; }
    var m = e.target.closest("[data-mailto]"); if (m) mailto(m.getAttribute("data-mailto"));
  });
  function others() { return memberList().filter(function (m) { return m.uid !== user.uid; }); }
  function joinNames(a) { return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function openDates() { return sessionsOfTerm().filter(function (s) { return s.status === "open" && !s.speaker; }).map(function (s) { return s.date; }); }
  function datesSentence(ds) { if (!ds.length) return "one of our sessions this term"; var parts = ds.map(function (d) { var p = dparts(d); return p.d + " " + MONTHS_LONG[p.m - 1]; }); return "one of our sessions on " + joinNames(parts) + " " + dparts(ds[ds.length - 1]).y + " (Wednesdays, 17:00 Berlin time)"; }
  function T() { var ts = termSettings[currentTerm] || {}; return { term: currentTerm || "", theme: ts.theme || CFG.termTheme || "", form: ts.formUrl || FORM_URL }; }
  function invitationText(p) {
    var t = T(), intro = me.intro ? me.intro.replace(/^\s*(I am|I'm)\s+/i, "") : "[your position and institution]";
    var hook = (p.notes || "").trim(); var hookSentence = hook ? (/[.!?]$/.test(hook) ? hook : hook + ".") + " I think this work would be a great fit for this term." : "Given your work in this area, I think it would be a great fit for this term.";
    return "Dear " + (p.name || "[name]") + ",\n\n" +
      "My name is " + me.name + ", I am " + intro + ", as well as one of the co-organizers of the online TaDa Reading Group/Speaker Series (together with " + joinNames(others().map(function (m) { return m.name; })) + ", all in cc). This online series invites experts from the intersection of computational linguistics and the social sciences to present and discuss their work with early-career researchers.\n\n" +
      "The " + (t.term.toLowerCase().indexOf("spring") === 0 ? "spring" : "fall") + " term of our Speaker Series will be all about " + (t.theme || "[theme]") + ". " + hookSentence + " More generally, given your expertise and impact on the text-as-data field, it would be a particular honour to host you.\n\n" +
      "We would like to invite you for " + datesSentence(openDates()) + "; you can select your preferred date and send us a title and abstract in this short form: " + t.form + ". If the times of the sessions are inconvenient, we are more than happy to accommodate an alternative date or time that works for you. The online session lasts about 60 minutes, with a 20–30-minute presentation followed by discussion (this is flexible).\n\n" +
      "Looking forward to your response and with best regards,\n" + firstName(me.name) + " & the TaDa organizing team";
  }
  function newsletterText(s) {
    var t = T();
    return "Subject: TaDa Speaker Series: " + (s.speaker || "[speaker]") + " — " + fmtMid(s.date) + ", " + (s.time || "17:00") + " " + tz(s.date) + "\n\nDear all,\n\nNext up in the TaDa Speaker Series" + (t.term ? " (" + t.term + (t.theme ? ": " + t.theme : "") + ")" : "") + ":\n\n" +
      (s.speaker || "[speaker]") + (s.affiliation ? " (" + s.affiliation + ")" : "") + "\n“" + (s.title || "[title]") + "”\n" + fmtLong(s.date) + ", " + (s.time || "17:00") + " " + tz(s.date) + " (Berlin time), online on Zoom\n\n" + (s.abstract ? s.abstract + "\n\n" : "") +
      "Zoom: " + (s.zoom || "the link follows in the reminder on the morning of the session") + "\n" + (s.paper ? "Paper: " + s.paper + "\n" : "") + "\nWe hope to see many of you there!\n" + firstName(me.name) + " & the TaDa team\ntada.cool";
  }
  function linkedinText(s) {
    var p = dparts(s.date);
    return "🥁 We're excited to announce the next session in our TADA Speaker Series 🌱 ⬇️\n\nWe're delighted to welcome " + (s.speaker || "[speaker]") + (s.affiliation ? " (" + s.affiliation + ")" : "") + " for a talk on:\n“" + (s.title || "[title]") + "”\n" + (s.paper ? "🔗 " + s.paper + "\n" : "") +
      "\n📅 When? " + DAYS_LONG[p.dow] + ", " + MONTHS_LONG[p.m - 1] + " " + p.d + ", " + (s.time || "17:00") + " (Berlin time)\n📍 Where? Zoom\n\n👉 Want to join? Subscribe at tada.cool to receive the Zoom link.\n\nWe're looking forward to a great discussion and hope to see many of you there!\n\n#TextAsData #CompSocSci #NLP";
  }
  function blueskyText(s) {
    var p = dparts(s.date), who = (s.speaker || "[speaker]") + (s.bsky ? " (" + s.bsky + ")" : "") + (s.affiliation ? ", " + s.affiliation : "");
    var base = "🌱 Next in the TaDa Speaker Series: " + who + " on “{T}” — " + DAYS[p.dow] + " " + p.d + " " + MONTHS[p.m - 1] + ", " + (s.time || "17:00") + " Berlin time, on Zoom. Subscribe for the link: tada.cool #TextAsData #CompSocSci";
    var title = s.title || "[title]", room = 300 - (base.length - 3); if (title.length > room) title = title.slice(0, Math.max(room - 1, 10)).replace(/\s+\S*$/, "") + "…";
    return base.replace("{T}", title);
  }
  function generate(kind) {
    if (kind === "cand-invitation") { $("#cd-draft").value = invitationText({ name: $("#cd-name").value.trim(), notes: $("#cd-notes").value.trim() }); return; }
    var s = sessionFromForm(); s.date = s.date || todayISO();
    if (kind === "invitation") $("#sd-inv-draft").value = invitationText({ name: s.speaker, notes: s.notes });
    if (kind === "newsletter") $("#sd-d-newsletter").value = newsletterText(s);
    if (kind === "linkedin") $("#sd-d-linkedin").value = linkedinText(s);
    if (kind === "bluesky") { $("#sd-d-bluesky").value = blueskyText(s); bskyCount(); }
  }
  function mailto(kind) {
    var to = "", subject = "", body = "", cc = others().map(function (m) { return m.email; }).filter(Boolean).join(",");
    if (kind === "invitation") { to = sd("email").value.trim(); subject = "Invitation: TaDa Speaker Series " + (currentTerm || ""); body = $("#sd-inv-draft").value; }
    if (kind === "cand-invitation") { to = $("#cd-email").value.trim(); subject = "Invitation: TaDa Speaker Series " + (currentTerm || ""); body = $("#cd-draft").value; }
    if (kind === "newsletter") { var txt = $("#sd-d-newsletter").value, m = txt.match(/^Subject:\s*(.*)$/m); subject = m ? m[1] : "TaDa Speaker Series"; body = txt.replace(/^Subject:.*\n\n?/, ""); cc = ""; }
    var url = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subject) + (cc ? "&cc=" + encodeURIComponent(cc) : "") + "&body=" + encodeURIComponent(body);
    if (url.length > 7000) { copyText(body); toast("Text copied (too long for a mail link): paste it into your e-mail"); }
    window.location.href = url;
  }

  /* ---------- speaker responses ---------- */
  var RF = "new";
  function ms(x) { return x && x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now(); }
  function whenLabel(x) { var d = x.createdAt && x.createdAt.toDate ? x.createdAt.toDate() : null; return d ? isoOf(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : "just now"; }
  $("#resp-chips").addEventListener("click", function (e) { var b = e.target.closest("[data-resp]"); if (!b) return; RF = b.getAttribute("data-resp"); $$(".filter-chip", this).forEach(function (x) { x.classList.toggle("is-on", x === b); }); renderResponses(); });
  $("#copy-form-link").addEventListener("click", function () { copyText(FORM_URL); });
  function openSlots() { return sessions.filter(function (s) { return !s.speaker && s.status !== "cancelled" && s.status !== "done" && s.date >= todayISO(); }); }
  function renderResponses() {
    if (view !== "responses") return;
    var rows = responses.filter(function (r) { return RF === "all" || (RF === "handled" ? r.handled : !r.handled); });
    $("#resp-empty").hidden = rows.length > 0;
    var slots = openSlots();
    $("#resp-list").innerHTML = rows.map(function (r) {
      var picked = r.dates || [];
      var slotOpts = slots.map(function (s) { var hit = picked.indexOf(s.date) >= 0; return '<option value="' + esc(s.id) + '"' + (hit && !r.handled ? "" : "") + '>' + esc(fmtShort(s.date) + " " + s.date.slice(0, 4) + " · " + termOf(s)) + (hit ? " ✓" : "") + '</option>'; }).join("");
      return '<article class="rounded-lg bg-surface-container-lowest shadow-sm p-space-md flex flex-col gap-space-sm' + (r.handled ? " opacity-75" : "") + '" data-id="' + esc(r.id) + '">' +
        '<div class="flex flex-wrap items-start justify-between gap-space-sm"><div class="flex items-center gap-space-sm min-w-0"><span class="avatar w-9 h-9 text-[11px] bg-secondary text-on-secondary">' + esc(initialsOf(r.name).slice(0, 2)) + '</span><div class="flex flex-col min-w-0"><span class="font-headline-sm text-headline-sm truncate">' + esc(r.name) + '</span><span class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(r.affiliation || "") + (r.email ? ' · <a class="text-primary hover:underline" href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>' : "") + '</span></div></div>' +
        '<div class="flex items-center gap-space-xs"><span class="pill ' + (r.handled ? "pill-ok" : "pill-sky") + '">' + (r.handled ? "handled" : "new") + '</span><span class="hint">' + esc(whenLabel(r)) + '</span></div></div>' +
        '<div class="font-body-lg text-body-lg font-medium">“' + esc(r.title || "") + '”</div>' + (r.abstract ? '<p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-3" title="' + esc(r.abstract) + '">' + esc(r.abstract) + '</p>' : "") +
        '<div class="flex flex-wrap items-center gap-1">' + (r.noneOfThese ? '<span class="pill pill-rose">none of the dates</span>' : picked.map(function (d) { return '<span class="pill pill-slate">' + esc(fmtShort(d)) + '</span>'; }).join("")) + '<span class="pill ' + (r.recording === "no" ? "pill-rose" : "pill-ok") + '">rec: ' + esc(r.recording || "?") + '</span>' + (r.url ? '<a class="pill pill-sky" href="' + esc(r.url) + '" target="_blank" rel="noopener">web</a>' : "") + (r.paper ? '<a class="pill pill-sky" href="' + esc(r.paper) + '" target="_blank" rel="noopener">paper</a>' : "") + (r.bluesky ? '<span class="pill pill-slate">' + esc(r.bluesky) + '</span>' : "") + (r.linkedin ? '<a class="pill pill-sky" href="' + esc(r.linkedin) + '" target="_blank" rel="noopener">linkedin</a>' : "") + '</div>' +
        (r.notes ? '<p class="font-body-sm text-body-sm"><span class="hint">Notes:</span> ' + esc(r.notes) + '</p>' : "") +
        '<div class="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs"><div class="flex items-center gap-space-xs"><select class="field w-auto h-8" data-slot><option value="">Choose an open slot…</option>' + slotOpts + '</select><button class="btn btn-primary" type="button" data-assign><span class="material-symbols-outlined text-[16px]">event_available</span>Assign to slot</button></div>' +
        '<div class="flex items-center gap-space-xs"><button class="btn btn-secondary" type="button" data-handled>' + (r.handled ? "Reopen" : "Mark handled") + '</button><button class="btn btn-danger" type="button" data-del-resp><span class="material-symbols-outlined text-[16px]">delete</span></button></div></div></article>';
    }).join("");
    $$("select[data-slot]", $("#resp-list")).forEach(function (sel) { var r = responses.filter(function (x) { return x.id === sel.closest("article").getAttribute("data-id"); })[0]; var first = slots.filter(function (s) { return (r.dates || []).indexOf(s.date) >= 0; })[0]; if (first) sel.value = first.id; });
  }
  $("#resp-list").addEventListener("click", function (e) {
    var art = e.target.closest("article[data-id]"); if (!art) return; var r = responses.filter(function (x) { return x.id === art.getAttribute("data-id"); })[0]; if (!r) return;
    if (e.target.closest("[data-del-resp]")) { if (confirm("Delete this response?")) db.collection("responses").doc(r.id).delete().catch(function (err) { toast(friendly(err)); }); return; }
    if (e.target.closest("[data-handled]")) { db.collection("responses").doc(r.id).update({ handled: !r.handled, handledBy: me.initials, handledAt: nowLabel() }).catch(function (err) { toast(friendly(err)); }); return; }
    if (e.target.closest("[data-assign]")) {
      var slot = $("select[data-slot]", art).value; if (!slot) { toast("Choose a slot first"); return; }
      var s = sessionById(slot); if (!confirm("Put " + r.name + " into the slot on " + fmtShort(slot) + " " + slot.slice(0, 4) + " as confirmed?")) return;
      db.collection("sessions").doc(slot).set({ speaker: r.name, affiliation: r.affiliation || "", email: r.email || "", url: r.url || "", photo: r.photo || "", bsky: r.bluesky || "", linkedin: r.linkedin || "", title: r.title || "", abstract: r.abstract || "", paper: r.paper || "", recording: r.recording || "", notes: ((s && s.notes) ? s.notes + "\n" : "") + (r.notes || ""), status: "confirmed", invitation: Object.assign({}, (s && s.invitation) || {}, { status: "confirmed" }), updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() }, { merge: true })
        .then(function () { return db.collection("responses").doc(r.id).update({ handled: true, handledBy: me.initials, handledAt: nowLabel(), sessionDate: slot }); })
        .then(function () { var c = candidates.filter(function (x) { return (x.email && r.email && x.email.toLowerCase() === r.email.toLowerCase()) || x.name === r.name; })[0]; if (c) return db.collection("candidates").doc(c.id).update({ status: "confirmed", sessionDate: slot, updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() }); })
        .then(function () { toast("Assigned to " + fmtShort(slot) + ". Now publish the website."); }, function (err) { toast(friendly(err)); });
    }
  });

  /* ---------- candidates ---------- */
  var CF = { f: "active", q: "" }, CFIELDS = ["name", "affiliation", "email", "url", "proposedBy", "owner", "status", "notes"];
  function renderCandidates() {
    var q = CF.q.toLowerCase(), rows = candidates.filter(function (c) {
      var st = c.status || "idea";
      if (CF.f === "active" && ["idea", "invited", "replied"].indexOf(st) < 0) return false;
      if (CF.f === "declined" && st !== "declined" && st !== "waitlist") return false;
      if (["all", "active", "declined"].indexOf(CF.f) < 0 && st !== CF.f) return false;
      return !q || ((c.name || "") + " " + (c.affiliation || "") + " " + (c.notes || "")).toLowerCase().indexOf(q) >= 0;
    });
    $("#cand-empty").hidden = rows.length > 0;
    $("#cand-body").innerHTML = rows.map(function (c) {
      var st = c.status || "idea";
      return '<tr data-id="' + esc(c.id) + '" class="cursor-pointer' + (selectedCand && selectedCand.id === c.id ? " is-sel" : "") + '">' +
        '<td class="max-w-[320px]"><div class="font-headline-sm text-headline-sm truncate">' + esc(c.name) + '</div><div class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(c.affiliation || "") + '</div>' + (c.notes ? '<div class="font-body-sm text-body-sm text-tertiary truncate">' + esc(c.notes) + '</div>' : "") + '</td>' +
        '<td class="mono text-[11px] text-on-surface-variant">' + esc(c.proposedBy || "—") + '</td><td class="mono text-[11px] text-on-surface-variant">' + esc(c.owner || "—") + '</td>' +
        '<td><span class="pill pill-' + pillClass("cand", st) + '">' + esc(st) + '</span></td>' +
        '<td><span class="hint">' + esc(c.invitedBy ? "sent by " + c.invitedBy + " · " + (c.invitedAt || "").slice(0, 10) : (c.draft ? "draft ready" : "—")) + '</span>' + (c.sessionDate ? '<div class="hint">→ ' + esc(fmtShort(c.sessionDate)) + '</div>' : "") + '</td>' +
        '<td><span class="hint">' + esc(c.updatedBy ? c.updatedBy + " · " + (c.updatedAtLabel || "") : "") + '</span></td></tr>';
    }).join("");
    if (selectedCand) { var fresh = candidates.filter(function (x) { return x.id === selectedCand.id; })[0]; if (!fresh) { selectedCand = null; showCand(null); } }
  }
  $("#cand-chips").addEventListener("click", function (e) { var b = e.target.closest("[data-cf]"); if (!b) return; CF.f = b.getAttribute("data-cf"); $$(".filter-chip", this).forEach(function (x) { x.classList.toggle("is-on", x === b); }); renderCandidates(); });
  $("#cand-search").addEventListener("input", function () { CF.q = this.value.trim(); renderCandidates(); });
  $("#cand-body").addEventListener("click", function (e) { var tr = e.target.closest("tr[data-id]"); if (!tr) return; var c = candidates.filter(function (x) { return x.id === tr.getAttribute("data-id"); })[0]; if (c) selectCand(c); });
  $("#new-candidate").addEventListener("click", function () { selectCand({ id: null, status: "idea", proposedBy: me.initials, owner: me.initials }); $("#cd-name").focus(); });
  $("#cd-close").addEventListener("click", function () { selectedCand = null; showCand(null); renderCandidates(); });
  function fillSlotSelect() {
    var sel = $("#cd-slot"), cur = sel.value;
    sel.innerHTML = '<option value="">— keep in pipeline —</option>' + sessions.filter(function (s) { return !s.speaker && s.status !== "cancelled" && s.status !== "done"; }).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(fmtShort(s.date) + " " + s.date.slice(0, 4) + " · " + termOf(s)) + '</option>'; }).join("");
    sel.value = cur;
  }
  function showCand(c) { $("#cand-none").hidden = !!c; $("#cand-form").hidden = !c; }
  function selectCand(c) {
    selectedCand = c; fillPeopleSelects(); fillSlotSelect(); showCand(c);
    $("#cd-title").textContent = c.id ? c.name : "New candidate"; $("#cd-av").textContent = c.name ? initialsOf(c.name).slice(0, 2) : "+";
    CFIELDS.forEach(function (k) { $("#cd-" + k).value = c[k] || (k === "status" ? "idea" : ""); });
    $("#cd-draft").value = c.draft || ""; $("#cd-slot").value = c.sessionDate && !sessionById(c.sessionDate) ? "" : "";
    $("#cd-meta").textContent = c.invitedBy ? "Invitation sent by " + c.invitedBy + " on " + (c.invitedAt || "") : ""; $("#cd-hint").textContent = c.updatedBy ? "Last change " + c.updatedBy + " · " + (c.updatedAtLabel || "") : "";
    $("[data-delete-cand]").hidden = !c.id; renderCandidates();
    if (window.innerWidth < 1280) $("#cand-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#cand-form").addEventListener("submit", function (e) {
    e.preventDefault(); var o = {}; CFIELDS.forEach(function (k) { o[k] = $("#cd-" + k).value.trim(); });
    if (!o.name) { $("#cd-hint").textContent = "Name is required."; return; }
    o.draft = $("#cd-draft").value; o.updatedAt = TS(); o.updatedBy = me.initials; o.updatedAtLabel = nowLabel();
    var slot = $("#cd-slot").value, ref = selectedCand && selectedCand.id ? db.collection("candidates").doc(selectedCand.id) : db.collection("candidates").doc();
    var p = ref.set(Object.assign(selectedCand && selectedCand.id ? {} : { createdAt: TS() }, o), { merge: true });
    if (slot) {
      var st = o.status === "confirmed" ? "confirmed" : "invited", sc = selectedCand || {};
      p = p.then(function () { return db.collection("sessions").doc(slot).set({ speaker: o.name, affiliation: o.affiliation, email: o.email, url: o.url, status: st, notes: o.notes, invitation: { status: sc.invitedBy ? "sent" : (o.draft ? "draft" : "none"), draft: o.draft, sentBy: sc.invitedBy || "", sentAt: sc.invitedAt || "", to: o.email }, updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() }, { merge: true }); })
        .then(function () { return ref.set({ sessionDate: slot, status: st === "confirmed" ? "confirmed" : (o.status === "idea" ? "invited" : o.status) }, { merge: true }); });
    }
    p.then(function () { toast(slot ? "Saved and moved into " + fmtShort(slot) : "Candidate saved"); selectedCand = { id: ref.id }; }, function (err) { $("#cd-hint").textContent = friendly(err); toast(friendly(err)); });
  });
  $("[data-delete-cand]").addEventListener("click", function () { if (!selectedCand || !selectedCand.id || !confirm("Delete this candidate?")) return; db.collection("candidates").doc(selectedCand.id).delete().then(function () { toast("Deleted"); selectedCand = null; showCand(null); }, function (err) { toast(friendly(err)); }); });
  $("[data-cand-sent]").addEventListener("click", function () {
    if (!selectedCand || !selectedCand.id) { toast("Save the candidate first"); return; }
    var upd = { invitedBy: me.initials, invitedAt: nowLabel(), status: "invited", draft: $("#cd-draft").value, updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() };
    db.collection("candidates").doc(selectedCand.id).update(upd).then(function () { $("#cd-status").value = "invited"; $("#cd-meta").textContent = "Invitation sent by " + me.initials + " on " + upd.invitedAt; toast("Marked as invited"); }, function (err) { toast(friendly(err)); });
  });

  /* ---------- messages ---------- */
  function dmId(a, b) { return "dm_" + [a, b].sort().join("_"); }
  function chanOf(m) { return m.channel || "general"; }
  function chanLabel(id) { if (id.indexOf("dm_") === 0) { var other = id.slice(3).split("_").filter(function (u) { return u !== user.uid; })[0]; return (members[other] || {}).name || "Direct message"; } return "#" + id; }
  function chanDesc(id) { var c = CHANNELS.filter(function (x) { return x.id === id; })[0]; return c ? c.desc : "Private conversation, only the two of you can read it."; }
  function unreadFor(id) { var last = (me.reads || {})[id], t = last && last.toMillis ? last.toMillis() : 0; return messages.filter(function (m) { return chanOf(m) === id && !m.parentId && m.uid !== user.uid && ms(m) > t; }).length; }
  function canSee(m) { var c = chanOf(m); return c.indexOf("dm_") !== 0 || c.indexOf(user.uid) >= 0; }
  var readTimer = null;
  function markRead(id) {
    if (view !== "messages" || document.hidden) return;
    if (!unreadFor(id) && (me.reads || {})[id]) return;
    clearTimeout(readTimer); readTimer = setTimeout(function () { var upd = {}; upd["reads." + id] = TS(); db.collection("members").doc(user.uid).update(upd).catch(function () { }); }, 400);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && view === "messages") markRead(chan); });
  function renderChannels() {
    if (!user) return;
    var total = 0;
    $("#chan-list").innerHTML = CHANNELS.map(function (c) { var n = unreadFor(c.id); total += n; return '<button class="chan-btn' + (chan === c.id ? " is-on" : "") + (n ? " has-unread" : "") + '" data-chan="' + c.id + '" type="button"><span><span class="text-outline mr-1">#</span>' + esc(c.name) + '</span>' + (n ? '<span class="badge badge-unread">' + n + '</span>' : "") + '</button>'; }).join("");
    $("#dm-list").innerHTML = others().map(function (m) { var id = dmId(user.uid, m.uid), n = unreadFor(id); total += n; return '<button class="chan-btn' + (chan === id ? " is-on" : "") + (n ? " has-unread" : "") + '" data-chan="' + id + '" type="button"><span class="flex items-center gap-2"><span class="avatar w-5 h-5 text-[8px] ' + avColor(m.uid) + '">' + esc(m.initials) + '</span>' + esc(m.name) + '</span>' + (n ? '<span class="badge badge-unread">' + n + '</span>' : "") + '</button>'; }).join("");
    var sel = $("#chan-select"); sel.innerHTML = CHANNELS.map(function (c) { return '<option value="' + c.id + '">#' + esc(c.name) + '</option>'; }).join("") + others().map(function (m) { return '<option value="' + dmId(user.uid, m.uid) + '">' + esc(m.name) + '</option>'; }).join(""); sel.value = chan;
    var b = $("#msg-badge"); b.hidden = !total; b.textContent = total;
    document.title = (total ? "(" + total + ") " : "") + "TaDa Executive Committee";
  }
  document.addEventListener("click", function (e) { var b = e.target.closest("[data-chan]"); if (b) switchChan(b.getAttribute("data-chan")); });
  $("#chan-select").addEventListener("change", function () { switchChan(this.value); });
  function switchChan(id) { chan = id; closeThread(); $("#msg-input").placeholder = "Message " + chanLabel(id); renderChannels(); renderMessages(); scrollMsgs(); markRead(id); $("#msg-input").focus(); }
  function dayKey(d) { return isoOf(d); }
  function dayLabel(iso) { var t = todayISO(); if (iso === t) return "Today"; var y = new Date(); y.setDate(y.getDate() - 1); if (iso === isoOf(y)) return "Yesterday"; return fmtShort(iso) + " " + iso.slice(0, 4); }
  function mentionRe() { var names = memberList().map(function (m) { return [m.username, firstName(m.name), (m.name || "").replace(/\s+/g, "")]; }).reduce(function (a, b) { return a.concat(b); }, []).filter(Boolean).map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }); return names.length ? new RegExp("@(" + names.join("|") + ")\\b", "gi") : null; }
  function mentionsMe(text) { var t = text.toLowerCase(); return [me.username, firstName(me.name), (me.name || "").replace(/\s+/g, "")].filter(Boolean).some(function (n) { return t.indexOf("@" + n.toLowerCase()) >= 0; }) || t.indexOf("@channel") >= 0 || t.indexOf("@all") >= 0; }
  function renderText(t) { var h = linkify(t), re = mentionRe(); if (re) h = h.replace(re, '<span class="at">@$1</span>'); return h.replace(/@(channel|all)\b/g, '<span class="at">@$1</span>'); }
  var REACTS = ["👍", "✅", "🎉", "👀", "❤️", "😂"];
  function msgHTML(m, inThread) {
    var d = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : new Date(), mine = m.uid === user.uid, mem = members[m.uid] || {};
    var reacts = m.reactions || {}, rk = Object.keys(reacts).filter(function (k) { return (reacts[k] || []).length; });
    var replies = inThread ? [] : messages.filter(function (x) { return x.parentId === m.id; });
    return '<div class="msg' + (mentionsMe(m.text || "") && !mine ? " mention" : "") + '" data-id="' + esc(m.id) + '" tabindex="0">' +
      '<div class="av ' + avColor(m.uid) + '">' + esc(m.initials || mem.initials || "?") + '</div><div class="min-w-0">' +
      '<div class="who"><b>' + esc(mem.name || m.name || "?") + '</b><time>' + pad(d.getHours()) + ":" + pad(d.getMinutes()) + (m.editedAt ? " · edited" : "") + '</time></div>' +
      '<div class="txt" data-text>' + renderText(m.text || "") + '</div>' +
      (rk.length ? '<div class="reacts">' + rk.map(function (k) { return '<button class="react' + (reacts[k].indexOf(user.uid) >= 0 ? " mine" : "") + '" type="button" data-react="' + esc(k) + '" title="' + esc(reacts[k].map(function (u) { return (members[u] || {}).name || "?"; }).join(", ")) + '">' + k + ' ' + reacts[k].length + '</button>'; }).join("") + '</div>' : "") +
      (replies.length ? '<button class="replies-link" type="button" data-thread><span class="material-symbols-outlined text-[16px]">forum</span>' + replies.length + (replies.length === 1 ? " reply" : " replies") + ' · last ' + esc(whenLabel(replies[replies.length - 1]).slice(5)) + '</button>' : "") +
      '</div><div class="actions">' + REACTS.map(function (k) { return '<button type="button" data-react="' + k + '" title="React">' + k + '</button>'; }).join("") + (inThread ? "" : '<button type="button" data-thread title="Reply in thread"><span class="material-symbols-outlined">forum</span></button>') + (mine ? '<button type="button" data-edit title="Edit"><span class="material-symbols-outlined">edit</span></button><button type="button" data-del title="Delete"><span class="material-symbols-outlined">delete</span></button>' : "") + '</div></div>';
  }
  function renderMessages() {
    if (!user) return;
    var box = $("#msg-list"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    $("#chan-title").textContent = chanLabel(chan); $("#chan-desc").textContent = chanDesc(chan); $("#msg-input").placeholder = "Message " + chanLabel(chan);
    var list = messages.filter(function (m) { return chanOf(m) === chan && !m.parentId && canSee(m); }), out = "", lastDay = "";
    $("#chan-count").textContent = list.length ? list.length + " messages" : "";
    if (!list.length) out = '<div class="flex flex-col items-center justify-center gap-space-sm py-space-xl text-center"><span class="material-symbols-outlined text-[32px] text-outline">waving_hand</span><p class="font-body-md text-body-md text-on-surface-variant">This is the start of ' + esc(chanLabel(chan)) + '. ' + esc(chanDesc(chan)) + '</p></div>';
    list.forEach(function (m) { var d = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : new Date(), k = dayKey(d); if (k !== lastDay) { out += '<div class="day-sep"><span>' + esc(dayLabel(k)) + '</span></div>'; lastDay = k; } out += msgHTML(m, false); });
    box.innerHTML = out;
    if (atBottom || view === "messages") scrollMsgs();
    if (view === "messages") markRead(chan);
  }
  function scrollMsgs() { var l = $("#msg-list"); l.scrollTop = l.scrollHeight; }
  function sendMessage(text, parentId) {
    var doc = { uid: user.uid, name: me.name, initials: me.initials, text: text, channel: chan, parentId: parentId || null, reactions: {}, createdAt: TS() };
    return db.collection("messages").add(doc).catch(function (err) { toast(friendly(err)); throw err; });
  }
  $("#msg-form").addEventListener("submit", function (e) { e.preventDefault(); var ta = $("#msg-input"), text = ta.value.trim(); if (!text) return; ta.value = ""; autosize(ta); hideMention(); sendMessage(text).catch(function () { ta.value = text; }); });
  $("#thread-form").addEventListener("submit", function (e) { e.preventDefault(); var ta = $("#thread-input"), text = ta.value.trim(); if (!text || !threadRoot) return; ta.value = ""; autosize(ta); sendMessage(text, threadRoot).catch(function () { ta.value = text; }); });
  function autosize(ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px"; }
  [$("#msg-input"), $("#thread-input")].forEach(function (ta) {
    ta.addEventListener("input", function () { autosize(ta); if (ta.id === "msg-input") mentionCheck(ta); });
    ta.addEventListener("keydown", function (e) {
      if (!$("#mention-pop").hidden && ta.id === "msg-input") { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moveMention(e.key === "ArrowDown" ? 1 : -1); return; } if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(); return; } if (e.key === "Escape") { hideMention(); return; } }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); }
    });
  });
  document.addEventListener("click", function (e) {
    var el = e.target.closest(".msg"); if (!el) return; var id = el.getAttribute("data-id"), m = messages.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    var r = e.target.closest("[data-react]");
    if (r) { var k = r.getAttribute("data-react"), has = ((m.reactions || {})[k] || []).indexOf(user.uid) >= 0; db.collection("messages").doc(id).update(new FP("reactions", k), has ? firebase.firestore.FieldValue.arrayRemove(user.uid) : firebase.firestore.FieldValue.arrayUnion(user.uid)).catch(function (err) { toast(friendly(err)); }); return; }
    if (e.target.closest("[data-thread]")) { openThread(id); return; }
    if (e.target.closest("[data-del]")) { if (confirm("Delete this message?")) { var b = db.batch(); b.delete(db.collection("messages").doc(id)); messages.filter(function (x) { return x.parentId === id && x.uid === user.uid; }).forEach(function (x) { b.delete(db.collection("messages").doc(x.id)); }); b.commit().catch(function (err) { toast(friendly(err)); }); } return; }
    if (e.target.closest("[data-edit]")) {
      var txt = $("[data-text]", el); if ($("textarea", txt)) return;
      txt.innerHTML = '<textarea class="field text-[14px]" rows="2">' + esc(m.text) + '</textarea><div class="flex gap-1 mt-1"><button class="btn btn-primary" type="button" data-edit-save>Save</button><button class="btn btn-ghost" type="button" data-edit-cancel>Cancel</button></div>';
      var ta = $("textarea", txt); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("[data-edit-save]", txt).click(); } if (ev.key === "Escape") $("[data-edit-cancel]", txt).click(); });
      return;
    }
    if (e.target.closest("[data-edit-save]")) { var nt = $("textarea", el).value.trim(); if (!nt) return; db.collection("messages").doc(id).update({ text: nt, editedAt: TS() }).catch(function (err) { toast(friendly(err)); }); return; }
    if (e.target.closest("[data-edit-cancel]")) { renderMessages(); if (threadRoot) renderThread(); }
  });
  function openThread(id) { threadRoot = id; $("#thread").hidden = false; $("#thread").classList.add("flex"); renderThread(); setTimeout(function () { $("#thread-input").focus(); }, 50); }
  function closeThread() { threadRoot = null; $("#thread").hidden = true; $("#thread").classList.remove("flex"); }
  $("#thread-close").addEventListener("click", closeThread);
  function renderThread() {
    var root = messages.filter(function (x) { return x.id === threadRoot; })[0]; if (!root) { closeThread(); return; }
    var replies = messages.filter(function (x) { return x.parentId === threadRoot; });
    $("#thread-sub").textContent = chanLabel(chanOf(root)) + " · " + replies.length + (replies.length === 1 ? " reply" : " replies");
    var box = $("#thread-list"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = msgHTML(root, true) + '<div class="day-sep"><span>' + (replies.length ? replies.length + (replies.length === 1 ? " reply" : " replies") : "No replies yet") + '</span></div>' + replies.map(function (m) { return msgHTML(m, true); }).join("");
    if (atBottom) box.scrollTop = box.scrollHeight;
  }
  /* mention autocomplete */
  var mentionIdx = 0, mentionHits = [];
  function mentionCheck(ta) {
    var pos = ta.selectionStart, before = ta.value.slice(0, pos), m = before.match(/(?:^|\s)@([\w.-]*)$/);
    if (!m) { hideMention(); return; }
    var q = m[1].toLowerCase(); mentionHits = memberList().filter(function (x) { return x.uid !== user.uid && ((x.username || "").toLowerCase().indexOf(q) === 0 || (x.name || "").toLowerCase().indexOf(q) === 0); }).map(function (x) { return { key: x.username || firstName(x.name), name: x.name, initials: x.initials, uid: x.uid }; });
    if ("channel".indexOf(q) === 0) mentionHits.push({ key: "channel", name: "Notify everyone", initials: "@", uid: "" });
    if (!mentionHits.length) { hideMention(); return; }
    mentionIdx = 0; paintMention();
  }
  function paintMention() { var pop = $("#mention-pop"); pop.hidden = false; pop.innerHTML = mentionHits.map(function (h, i) { return '<button type="button" class="' + (i === mentionIdx ? "is-on" : "") + '" data-mi="' + i + '"><span class="avatar w-5 h-5 text-[8px] ' + (h.uid ? avColor(h.uid) : "bg-surface-container-high") + '">' + esc(h.initials) + '</span><span>' + esc(h.name) + '</span><small>@' + esc(h.key) + '</small></button>'; }).join(""); }
  function moveMention(d) { mentionIdx = (mentionIdx + d + mentionHits.length) % mentionHits.length; paintMention(); }
  function pickMention() { var h = mentionHits[mentionIdx]; if (!h) return; var ta = $("#msg-input"), pos = ta.selectionStart, before = ta.value.slice(0, pos).replace(/@[\w.-]*$/, "@" + h.key + " "), after = ta.value.slice(pos); ta.value = before + after; ta.setSelectionRange(before.length, before.length); hideMention(); ta.focus(); }
  function hideMention() { $("#mention-pop").hidden = true; mentionHits = []; }
  $("#mention-pop").addEventListener("mousedown", function (e) { var b = e.target.closest("[data-mi]"); if (!b) return; e.preventDefault(); mentionIdx = +b.getAttribute("data-mi"); pickMention(); });
  /* pinned note */
  $("#pin-toggle").addEventListener("click", function () { $("#pin-bar").hidden = !$("#pin-bar").hidden; });
  $("#pinned-save").addEventListener("click", function () { db.collection("settings").doc("pinned").set({ text: $("#pinned").value, updatedBy: me.initials, updatedAt: TS(), updatedAtLabel: nowLabel() }).then(function () { toast("Pinned note saved"); }, function (err) { toast(friendly(err)); }); });

  /* ---------- profile ---------- */
  function renderMembers() {
    var list = memberList(); $("#team-count").textContent = list.length + (list.length === 1 ? " organizer" : " organizers");
    $("#member-list").innerHTML = list.map(function (m) { return '<li class="flex items-center gap-space-sm py-2"><span class="avatar w-8 h-8 text-[10px] ' + avColor(m.uid) + '">' + esc(m.initials || initialsOf(m.name)) + '</span><div class="flex flex-col min-w-0"><span class="font-label-md text-label-md font-semibold truncate">' + esc(m.name) + (m.username ? ' <span class="hint">@' + esc(m.username) + '</span>' : "") + '</span><span class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(m.email || "") + (m.intro ? " · " + esc(m.intro) : "") + '</span></div></li>'; }).join("");
  }
  function fillProfile() { $("#pf-name").value = me.name || ""; $("#pf-username").value = me.username || ""; $("#pf-initials").value = me.initials || ""; $("#pf-intro").value = me.intro || ""; $("#cur-email").textContent = user.email || ""; }
  $("#profile-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#pf-error").textContent = "";
    var upd = { name: $("#pf-name").value.trim(), username: $("#pf-username").value.trim().replace(/^@/, "").toLowerCase(), initials: ($("#pf-initials").value.trim() || initialsOf($("#pf-name").value)).toUpperCase().slice(0, 3), intro: $("#pf-intro").value.trim(), updatedAt: TS() };
    if (!upd.name) { $("#pf-error").textContent = "Display name is required."; return; }
    db.collection("members").doc(user.uid).update(upd).then(function () { return user.updateProfile({ displayName: upd.name }); }).then(function () { $("#pf-hint").textContent = "Saved " + nowLabel(); toast("Profile saved"); }, function (err) { $("#pf-error").textContent = friendly(err); });
  });
  function reauth(pw) { return user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, pw)); }
  $("#email-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#email-error").textContent = ""; var nw = $("#new-email").value.trim(), pw = $("#email-pw").value;
    if (!nw || !pw) { $("#email-error").textContent = "Enter the new e-mail and your current password."; return; }
    reauth(pw).then(function () { return user.verifyBeforeUpdateEmail(nw); }).then(function () { $("#email-error").textContent = "Verification link sent to " + nw + ". After you click it, sign in with the new address; profile and allow-list update automatically."; $("#new-email").value = ""; $("#email-pw").value = ""; }).catch(function (err) { $("#email-error").textContent = friendly(err); });
  });
  $("#pw-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#pw-error").textContent = ""; var old = $("#pw-old").value, nw = $("#pw-new").value;
    if (nw.length < 8) { $("#pw-error").textContent = "New password needs at least 8 characters."; return; }
    reauth(old).then(function () { return user.updatePassword(nw); }).then(function () { $("#pw-error").textContent = "Password changed."; $("#pw-old").value = ""; $("#pw-new").value = ""; toast("Password changed"); }).catch(function (err) { $("#pw-error").textContent = friendly(err); });
  });
  $("#allow-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var emails = $("#allow-emails").value.split(/[\n,;\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return /@/.test(x); });
    emails = emails.filter(function (x, i) { return emails.indexOf(x) === i; });
    if (emails.length && emails.indexOf((user.email || "").toLowerCase()) < 0) emails.push((user.email || "").toLowerCase());
    db.collection("settings").doc("allowlist").set({ emails: emails, updatedAt: TS(), updatedBy: me.initials }).then(function () { $("#allow-hint").textContent = "Saved (" + emails.length + ")"; toast("Allow-list saved"); }, function (err) { $("#allow-hint").textContent = friendly(err); });
  });
})();

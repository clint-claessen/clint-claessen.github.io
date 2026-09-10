/* TaDa Executive Committee — organizer-only app on Firebase (Auth + Firestore), no build step.
   Collections: members/{uid}, sessions/{date}, candidates/{id}, messages/{id}, settings/{pinned|allowlist|term-*}, public/programme */
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
  function berlinOffset(iso) {
    try { var d = new Date(iso + "T12:00:00Z"); var tz = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" }).formatToParts(d).filter(function (x) { return x.type === "timeZoneName"; })[0].value; return /\+02/.test(tz) ? 2 : 1; } catch (e) { return 1; }
  }
  function tz(iso) { return berlinOffset(iso) === 2 ? "CEST" : "CET"; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function nowLabel() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function firstName(n) { return (n || "").trim().split(/\s+/)[0] || ""; }
  function initialsOf(n) { return (n || "").split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join("").slice(0, 3).toUpperCase() || "??"; }
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2600); }
  function copyText(s) { return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { toast("Copied"); }, function () { toast("Copy failed: select the text and copy manually"); }); }
  function friendly(err) {
    var c = (err && err.code) || "";
    if (/wrong-password|invalid-credential|invalid-login-credentials/.test(c)) return "E-mail or password is wrong.";
    if (/user-not-found/.test(c)) return "No account with this e-mail. Accounts are created in the Firebase console.";
    if (/too-many-requests/.test(c)) return "Too many attempts. Wait a few minutes or reset your password.";
    if (/requires-recent-login/.test(c)) return "Please sign out and in again, then retry.";
    if (/permission-denied/.test(c)) return "Not allowed: your e-mail is not on the organizer allow-list.";
    if (/email-already-in-use/.test(c)) return "That e-mail already belongs to another account.";
    if (/weak-password/.test(c)) return "Password too weak (min. 8 characters).";
    if (/network-request-failed/.test(c)) return "Network problem. Try again.";
    return (err && err.message) || "Something went wrong.";
  }

  var loginView = $("#view-login"), appView = $("#view-app");
  if (!CFG.firebase || !window.firebase) {
    loginView.hidden = false; $("#setup-help").hidden = false;
    $("#login-form button[type=submit]").disabled = true;
    return;
  }
  firebase.initializeApp(CFG.firebase);
  var auth = firebase.auth(), db = firebase.firestore();
  try { db.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) { /* settings can only be set once */ }
  var TS = function () { return firebase.firestore.FieldValue.serverTimestamp(); };

  var me = null, user = null, members = {}, sessions = [], candidates = [], termSettings = {}, currentTerm = null, unsub = [];
  var msgSeen = 0, currentTab = "series";

  /* ---------- tabs ---------- */
  $$(".tab").forEach(function (b) {
    b.addEventListener("click", function () {
      currentTab = b.getAttribute("data-tab");
      $$(".tab").forEach(function (x) { x.classList.toggle("is-on", x === b); });
      $$(".panel").forEach(function (p) { p.hidden = p.id !== "tab-" + currentTab; });
      if (currentTab === "messages") { msgSeen = lastMsgCount; $("#msg-badge").hidden = true; scrollMsgs(); }
    });
  });

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
    user = u;
    if (!u) { showLogin(); return; }
    ensureMember(u).then(function (m) { me = m; loginView.hidden = true; appView.hidden = false; start(); })
      .catch(function (err) { $("#login-error").textContent = friendly(err); auth.signOut(); });
  });

  function ensureMember(u) {
    var ref = db.collection("members").doc(u.uid);
    return ref.get().then(function (snap) {
      if (snap.exists) {
        var m = snap.data();
        if (m.email !== u.email) { /* e-mail was changed and verified: sync profile + allow-list */
          var old = (m.email || "").toLowerCase(), nw = (u.email || "").toLowerCase();
          return ref.update({ email: u.email, updatedAt: TS() }).then(function () { return swapAllowlist(old, nw); }).then(function () { m.email = u.email; return m; });
        }
        return m;
      }
      var name = u.displayName || (u.email || "").split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var m0 = { name: name, username: (u.email || "").split("@")[0], initials: initialsOf(name), intro: "", email: u.email, createdAt: TS(), updatedAt: TS() };
      return ref.set(m0).then(function () { return m0; });
    });
  }
  function swapAllowlist(oldE, newE) {
    var ref = db.collection("settings").doc("allowlist");
    return ref.get().then(function (s) {
      if (!s.exists) return; var emails = (s.data().emails || []).map(function (e) { return String(e).toLowerCase(); });
      if (emails.indexOf(newE) < 0) emails.push(newE);
      emails = emails.filter(function (e) { return e !== oldE; });
      return ref.set({ emails: emails, updatedAt: TS() }, { merge: true });
    }).catch(function () { /* non-fatal */ });
  }

  /* ---------- live data ---------- */
  var lastMsgCount = 0;
  function start() {
    unsub.forEach(function (u) { u(); }); unsub = [];
    $("#user-initials").textContent = me.initials || initialsOf(me.name);
    fillProfile();
    unsub.push(db.collection("members").onSnapshot(function (qs) {
      members = {}; qs.forEach(function (d) { members[d.id] = d.data(); }); if (members[user.uid]) { me = members[user.uid]; $("#user-initials").textContent = me.initials || initialsOf(me.name); }
      renderMembers();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("sessions").onSnapshot(function (qs) {
      sessions = []; qs.forEach(function (d) { var x = d.data(); x.id = d.id; sessions.push(x); });
      sessions.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      renderTerms(); renderSessions(); fillSlotSelect();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("candidates").onSnapshot(function (qs) {
      candidates = []; qs.forEach(function (d) { var x = d.data(); x.id = d.id; candidates.push(x); });
      candidates.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
      renderCandidates();
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("messages").orderBy("createdAt", "asc").limitToLast(400).onSnapshot(function (qs) {
      var list = []; qs.forEach(function (d) { var x = d.data(); x.id = d.id; list.push(x); });
      renderMessages(list);
    }, function (err) { toast(friendly(err)); }));
    unsub.push(db.collection("settings").onSnapshot(function (qs) {
      termSettings = {}; qs.forEach(function (d) {
        var x = d.data();
        if (d.id === "pinned") { if (document.activeElement !== $("#pinned")) $("#pinned").value = x.text || ""; $("#pinned-hint").textContent = x.updatedBy ? "Last saved by " + x.updatedBy + " · " + (x.updatedAtLabel || "") : ""; }
        else if (d.id === "allowlist") { if (document.activeElement !== $("#allow-emails")) $("#allow-emails").value = (x.emails || []).join("\n"); }
        else if (d.id.indexOf("term-") === 0) termSettings[d.id.slice(5)] = x;
      });
      renderTermHead();
    }, function (err) { toast(friendly(err)); }));
  }

  /* ---------- terms + sessions ---------- */
  function termOf(s) { return s.term || "Unassigned"; }
  function termList() {
    var map = {}; sessions.forEach(function (s) { var t = termOf(s); if (!map[t] || s.date < map[t]) map[t] = s.date; });
    return Object.keys(map).sort(function (a, b) { return map[a] < map[b] ? 1 : -1; });
  }
  function renderTerms() {
    var sel = $("#term-select"), terms = termList();
    if (!currentTerm || terms.indexOf(currentTerm) < 0) {
      var today = todayISO(), up = sessions.filter(function (s) { return s.date >= today; })[0];
      currentTerm = up ? termOf(up) : (terms[0] || null);
    }
    sel.innerHTML = terms.map(function (t) { return '<option value="' + esc(t) + '"' + (t === currentTerm ? " selected" : "") + '>' + esc(t) + '</option>'; }).join("");
    renderTermHead();
  }
  $("#term-select").addEventListener("change", function () { currentTerm = this.value; renderTermHead(); renderSessions(); fillSlotSelect(); });
  function renderTermHead() {
    $("#series-title").textContent = currentTerm || "No term yet";
    var ts = termSettings[currentTerm] || {};
    $("#series-theme").innerHTML = currentTerm ? 'Theme: <b>' + esc(ts.theme || "—") + '</b> · Speaker form: ' + (ts.formUrl ? '<a href="' + esc(ts.formUrl) + '" target="_blank" rel="noopener">link</a>' : "—") + ' · <button class="btn-text" type="button" id="edit-term">Edit theme / form link</button>' : "";
    var eb = $("#edit-term"); if (eb) eb.addEventListener("click", editTermSettings);
    var pub = termSettings["public"] || {};
    $("#publish-hint").textContent = ts.publishedAtLabel ? "Website programme last published " + ts.publishedAtLabel + " by " + (ts.publishedBy || "?") + "." : "The public website still shows the static programme. Publish when the term is ready.";
  }
  function editTermSettings() {
    if (!currentTerm) return;
    var ts = termSettings[currentTerm] || {};
    var theme = prompt("Theme of " + currentTerm + ":", ts.theme || CFG.termTheme || ""); if (theme === null) return;
    var form = prompt("Google Form link speakers use to pick a date (leave empty if none):", ts.formUrl || ""); if (form === null) return;
    db.collection("settings").doc("term-" + currentTerm).set({ theme: theme.trim(), formUrl: form.trim(), updatedAt: TS(), updatedBy: me.initials }, { merge: true }).then(function () { toast("Term settings saved"); }, function (e) { toast(friendly(e)); });
  }
  $("#new-term").addEventListener("click", function () {
    var name = prompt("Name of the new term (e.g. Spring 2027):"); if (!name) return;
    var dates = prompt("Session dates, comma-separated, YYYY-MM-DD (Wednesdays, biweekly):", ""); if (dates === null) return;
    var list = dates.split(/[,\s]+/).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
    if (!list.length) { toast("No valid dates entered"); return; }
    var batch = db.batch();
    list.forEach(function (d) { batch.set(db.collection("sessions").doc(d), { term: name.trim(), date: d, time: "17:00", speaker: "", affiliation: "", url: "", title: "", status: "open", chair: "", invitation: { status: "none", draft: "" }, promo: { newsletter: { status: "todo", draft: "" }, linkedin: { status: "todo", draft: "" }, bluesky: { status: "todo", draft: "" }, website: { status: "todo" } }, createdAt: TS(), updatedAt: TS(), updatedBy: me.initials }, { merge: true }); });
    batch.commit().then(function () { currentTerm = name.trim(); toast("Term created with " + list.length + " sessions"); }, function (e) { toast(friendly(e)); });
  });
  $("#new-session").addEventListener("click", function () { openSession(null); });
  $("#seed-btn").addEventListener("click", seed);

  function seed() {
    fetch("seed.json").then(function (r) { return r.json(); }).then(function (S) {
      var batch = db.batch();
      S.sessions.forEach(function (s) {
        batch.set(db.collection("sessions").doc(s.date), Object.assign({ term: S.term, invitation: { status: s.status === "confirmed" ? "confirmed" : "none", draft: "" }, promo: { newsletter: { status: "todo", draft: "" }, linkedin: { status: "todo", draft: "" }, bluesky: { status: "todo", draft: "" }, website: { status: "todo" } }, createdAt: TS(), updatedAt: TS(), updatedBy: me.initials }, s), { merge: true });
      });
      S.candidates.forEach(function (c) { batch.set(db.collection("candidates").doc(), Object.assign({ draft: "", createdAt: TS(), updatedAt: TS(), updatedBy: me.initials }, c)); });
      batch.set(db.collection("settings").doc("term-" + S.term), { theme: S.theme, updatedAt: TS(), updatedBy: me.initials }, { merge: true });
      return batch.commit();
    }).then(function () { currentTerm = "Fall 2026"; toast("Imported Fall 2026"); }, function (e) { toast(friendly(e)); });
  }

  function sessionsOfTerm() { return sessions.filter(function (s) { return termOf(s) === currentTerm; }); }
  function selInline(field, value, opts, cls) {
    return '<select class="inline st-' + esc(value) + '" data-field="' + field + '">' + opts.map(function (o) { return '<option value="' + o + '"' + (o === value ? " selected" : "") + '>' + o + '</option>'; }).join("") + '</select>';
  }
  var PROMO = ["todo", "draft", "scheduled", "done"], INV = ["none", "draft", "sent", "replied", "confirmed", "declined"], STATUS = ["open", "invited", "confirmed", "declined", "done", "cancelled"];
  function renderSessions() {
    var rows = sessionsOfTerm(), body = $("#sessions-body");
    $("#sessions-empty").hidden = rows.length > 0 || !sessions.length ? rows.length > 0 : true;
    $("#sessions-empty").hidden = rows.length > 0; $("#seed-btn").hidden = sessions.length > 0;
    body.innerHTML = rows.map(function (s) {
      var inv = (s.invitation || {}).status || "none", pr = s.promo || {};
      return '<tr data-id="' + esc(s.id) + '">' +
        '<td class="date">' + esc(fmtShort(s.date)) + ' ' + esc(s.date.slice(0, 4)) + '<small>' + esc((s.time || "17:00") + " " + tz(s.date)) + '</small></td>' +
        '<td class="who"><b>' + (s.speaker ? esc(s.speaker) : '<span class="st st-open">open slot</span>') + '</b>' + (s.title ? '<span>' + esc(s.title) + '</span>' : "") + (s.affiliation ? '<i>' + esc(s.affiliation) + '</i>' : "") + '</td>' +
        '<td>' + selInline("status", s.status || "open", STATUS) + '</td>' +
        '<td class="chair">' + esc(s.chair || "—") + '</td>' +
        '<td>' + selInline("invitation.status", inv, INV) + (s.invitation && s.invitation.sentBy ? '<div class="hint">' + esc(s.invitation.sentBy + " · " + (s.invitation.sentAt || "")) + '</div>' : "") + '</td>' +
        '<td>' + selInline("promo.newsletter.status", (pr.newsletter || {}).status || "todo", PROMO) + '</td>' +
        '<td>' + selInline("promo.linkedin.status", (pr.linkedin || {}).status || "todo", PROMO) + '</td>' +
        '<td>' + selInline("promo.bluesky.status", (pr.bluesky || {}).status || "todo", PROMO) + '</td>' +
        '<td>' + selInline("promo.website.status", (pr.website || {}).status || "todo", ["todo", "done"]) + '</td>' +
        '<td class="meta">' + esc(s.updatedBy ? s.updatedBy + " · " + (s.updatedAtLabel || "") : "") + '</td></tr>';
    }).join("");
  }
  $("#sessions-body").addEventListener("change", function (e) {
    var sel = e.target.closest("select.inline"); if (!sel) return;
    var id = sel.closest("tr").getAttribute("data-id"), field = sel.getAttribute("data-field"), upd = {};
    upd[field] = sel.value; upd.updatedAt = TS(); upd.updatedBy = me.initials; upd.updatedAtLabel = nowLabel();
    if (field === "invitation.status" && sel.value === "sent") { upd["invitation.sentBy"] = me.initials; upd["invitation.sentAt"] = nowLabel(); }
    db.collection("sessions").doc(id).update(upd).then(function () { toast("Saved"); }, function (err) { toast(friendly(err)); });
  });
  $("#sessions-body").addEventListener("click", function (e) {
    if (e.target.closest("select")) return;
    var tr = e.target.closest("tr[data-id]"); if (!tr) return;
    var s = sessions.filter(function (x) { return x.id === tr.getAttribute("data-id"); })[0]; if (s) openSession(s);
  });

  /* ---------- publish to website ---------- */
  $("#publish-programme").addEventListener("click", function () {
    if (!currentTerm) return;
    var ts = termSettings[currentTerm] || {};
    var pub = sessionsOfTerm().filter(function (s) { return s.status !== "cancelled"; }).map(function (s) {
      var show = s.status === "confirmed" || s.status === "done";
      return { date: s.date, time: s.time || "17:00", term: currentTerm, speaker: show ? (s.speaker || "") : "", affiliation: show ? (s.affiliation || "") : "", url: show ? (s.url || "") : "", title: show ? (s.title || "") : "", paper: show ? (s.paper || "") : "", abstract: show ? (s.abstract || "") : "" };
    });
    if (!confirm("Publish " + pub.length + " session(s) of " + currentTerm + " to the public website? Speakers are shown only when their status is confirmed or done.")) return;
    var label = nowLabel();
    db.collection("public").doc("programme").set({ term: currentTerm, theme: ts.theme || CFG.termTheme || "", sessions: pub, updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: label })
      .then(function () { return db.collection("settings").doc("term-" + currentTerm).set({ publishedAtLabel: label, publishedBy: me.initials }, { merge: true }); })
      .then(function () { toast("Published to the website"); }, function (e) { toast(friendly(e)); });
  });

  /* ---------- session dialog ---------- */
  var sdlg = $("#session-dlg"), sform = $("#session-form"), editing = null;
  var F = ["date", "time", "term", "status", "speaker", "affiliation", "email", "url", "chair", "bsky", "talktitle", "abstract", "paper", "zoom", "recording", "notes"];
  function sdField(k) { return $("#sd-" + k); }
  function openSession(s) {
    editing = s;
    $("#sd-title").textContent = s ? (s.speaker || "Open slot") + " · " + fmtShort(s.date) : "New session";
    F.forEach(function (k) { var el = sdField(k); var key = k === "talktitle" ? "title" : k; el.value = s ? (s[key] || (k === "time" ? "17:00" : "")) : (k === "time" ? "17:00" : k === "term" ? (currentTerm || "") : k === "status" ? "open" : ""); });
    var inv = (s && s.invitation) || {}, pr = (s && s.promo) || {};
    $("#sd-inv-status").value = inv.status || "none"; $("#sd-inv-draft").value = inv.draft || "";
    $("#sd-inv-meta").textContent = inv.sentBy ? "Sent by " + inv.sentBy + " on " + (inv.sentAt || "") + (inv.to ? " to " + inv.to : "") : "";
    ["newsletter", "linkedin", "bluesky"].forEach(function (k) { $("#sd-p-" + k).value = (pr[k] || {}).status || "todo"; $("#sd-d-" + k).value = (pr[k] || {}).draft || ""; });
    $("#sd-p-website").value = (pr.website || {}).status || "todo";
    $("#sd-hint").textContent = s && s.updatedBy ? "Last change: " + s.updatedBy + " · " + (s.updatedAtLabel || "") : "";
    $("[data-delete-session]").hidden = !s;
    bskyCount(); sdlg.showModal();
  }
  function sessionFromForm() {
    var o = {}; F.forEach(function (k) { o[k === "talktitle" ? "title" : k] = sdField(k).value.trim(); });
    o.invitation = { status: $("#sd-inv-status").value, draft: $("#sd-inv-draft").value, sentBy: (editing && editing.invitation && editing.invitation.sentBy) || "", sentAt: (editing && editing.invitation && editing.invitation.sentAt) || "", to: o.email };
    o.promo = { newsletter: { status: $("#sd-p-newsletter").value, draft: $("#sd-d-newsletter").value }, linkedin: { status: $("#sd-p-linkedin").value, draft: $("#sd-d-linkedin").value }, bluesky: { status: $("#sd-p-bluesky").value, draft: $("#sd-d-bluesky").value }, website: { status: $("#sd-p-website").value } };
    return o;
  }
  sform.addEventListener("submit", function (e) {
    e.preventDefault();
    var o = sessionFromForm(); if (!o.date) { $("#sd-hint").textContent = "Date is required."; return; }
    o.updatedAt = TS(); o.updatedBy = me.initials; o.updatedAtLabel = nowLabel();
    var id = editing ? editing.id : o.date;
    var p = db.collection("sessions").doc(id).set(o, { merge: true });
    if (editing && editing.id !== o.date) { /* date changed: move document */
      p = db.collection("sessions").doc(o.date).set(Object.assign({ createdAt: TS() }, editing, o)).then(function () { return db.collection("sessions").doc(editing.id).delete(); });
    }
    p.then(function () { toast("Session saved"); sdlg.close(); }, function (err) { $("#sd-hint").textContent = friendly(err); });
  });
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", function () { b.closest("dialog").close(); }); });
  $("[data-delete-session]").addEventListener("click", function () {
    if (!editing || !confirm("Delete this session? This cannot be undone.")) return;
    db.collection("sessions").doc(editing.id).delete().then(function () { toast("Deleted"); sdlg.close(); }, function (e) { toast(friendly(e)); });
  });
  $("[data-mark-sent]").addEventListener("click", function () {
    $("#sd-inv-status").value = "sent";
    if (!editing) { toast("Save the session first"); return; }
    var upd = { "invitation.status": "sent", "invitation.sentBy": me.initials, "invitation.sentAt": nowLabel(), "invitation.to": sdField("email").value.trim(), "invitation.draft": $("#sd-inv-draft").value, status: (editing.status === "open" ? "invited" : editing.status), updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() };
    db.collection("sessions").doc(editing.id).update(upd).then(function () { $("#sd-inv-meta").textContent = "Sent by " + me.initials + " on " + upd["invitation.sentAt"]; sdField("status").value = upd.status; toast("Marked as sent"); }, function (e) { toast(friendly(e)); });
  });
  function bskyCount() { var n = $("#sd-d-bluesky").value.length; var c = $("#bsky-count"); c.textContent = n + "/300"; c.classList.toggle("over", n > 300); }
  $("#sd-d-bluesky").addEventListener("input", bskyCount);

  /* generate + copy + mailto (both dialogs) */
  document.addEventListener("click", function (e) {
    var g = e.target.closest("[data-gen]"); if (g) { generate(g.getAttribute("data-gen")); return; }
    var c = e.target.closest("[data-copy]"); if (c) { copyText($("#" + c.getAttribute("data-copy")).value); return; }
    var m = e.target.closest("[data-mailto]"); if (m) { mailto(m.getAttribute("data-mailto")); }
  });
  function ccList() { return Object.keys(members).filter(function (uid) { return uid !== user.uid; }).map(function (uid) { return members[uid].email; }).filter(Boolean); }
  function otherNames() { return Object.keys(members).filter(function (uid) { return uid !== user.uid; }).map(function (uid) { return members[uid].name; }).filter(Boolean); }
  function joinNames(a) { return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function openDates() {
    var ds = sessionsOfTerm().filter(function (s) { return s.status === "open" && !s.speaker; }).map(function (s) { return s.date; });
    return ds;
  }
  function datesSentence(ds) {
    if (!ds.length) return "one of our sessions this term";
    var parts = ds.map(function (d) { var p = dparts(d); return p.d + " " + MONTHS_LONG[p.m - 1]; });
    return "one of our sessions on " + joinNames(parts) + " " + dparts(ds[ds.length - 1]).y + " (Wednesdays, 17:00 Berlin time)";
  }
  function T() {
    var ts = termSettings[currentTerm] || {};
    return { term: currentTerm || "", theme: ts.theme || CFG.termTheme || "", form: ts.formUrl || "[link to the Google Form]" };
  }
  function invitationText(p) {
    var t = T(), intro = me.intro ? me.intro.replace(/^\s*(I am|I'm)\s+/i, "") : "[your position and institution]";
    var hook = p.notes ? p.notes.trim().replace(/\s+$/, "") : "";
    var hookSentence = hook ? (/[.!?]$/.test(hook) ? hook : hook + ".") + " I think this work would be a great fit for this term." : "Given your work in this area, I think it would be a great fit for this term.";
    return "Dear " + (p.name || "[name]") + ",\n\n" +
      "My name is " + me.name + ", I am " + intro + ", as well as one of the co-organizers of the online TaDa Reading Group/Speaker Series (together with " + joinNames(otherNames()) + ", all in cc). This online series invites experts from the intersection of computational linguistics and the social sciences to present and discuss their work with early-career researchers.\n\n" +
      "The " + (t.term.toLowerCase().indexOf("spring") === 0 ? "spring" : "fall") + " term of our Speaker Series will be all about " + (t.theme || "[theme]") + ". " + hookSentence + " More generally, given your expertise and impact on the text-as-data field, it would be a particular honour to host you.\n\n" +
      "We would like to invite you for " + datesSentence(openDates()) + "; you can select your preferred date in this short form: " + t.form + ". If the times of the sessions are inconvenient, we are more than happy to accommodate an alternative date or time that works for you. The online session lasts about 60 minutes, with a 20–30-minute presentation followed by discussion (this is flexible).\n\n" +
      "Looking forward to your response and with best regards,\n" + firstName(me.name) + " & the TaDa organizing team";
  }
  function newsletterText(s) {
    var t = T();
    return "Subject: TaDa Speaker Series: " + (s.speaker || "[speaker]") + " — " + fmtMid(s.date) + ", " + (s.time || "17:00") + " " + tz(s.date) + "\n\n" +
      "Dear all,\n\nNext up in the TaDa Speaker Series" + (t.term ? " (" + t.term + (t.theme ? ": " + t.theme : "") + ")" : "") + ":\n\n" +
      (s.speaker || "[speaker]") + (s.affiliation ? " (" + s.affiliation + ")" : "") + "\n“" + (s.title || "[title]") + "”\n" + fmtLong(s.date) + ", " + (s.time || "17:00") + " " + tz(s.date) + " (Berlin time), online on Zoom\n\n" +
      (s.abstract ? s.abstract + "\n\n" : "") +
      "Zoom: " + (s.zoom || "the link follows in the reminder on the morning of the session") + "\n" + (s.paper ? "Paper: " + s.paper + "\n" : "") +
      "\nWe hope to see many of you there!\n" + firstName(me.name) + " & the TaDa team\ntada.cool";
  }
  function linkedinText(s) {
    var p = dparts(s.date);
    return "🥁 We're excited to announce the next session in our TADA Speaker Series 🌱 " + (s.speaker ? "" : "") + "⬇️\n\n" +
      "We're delighted to welcome " + (s.speaker || "[speaker]") + (s.affiliation ? " (" + s.affiliation + ")" : "") + " for a talk on:\n“" + (s.title || "[title]") + "”\n" + (s.paper ? "🔗 " + s.paper + "\n" : "") +
      "\n📅 When? " + DAYS_LONG[p.dow] + ", " + MONTHS_LONG[p.m - 1] + " " + p.d + ", " + (s.time || "17:00") + " (Berlin time)\n📍 Where? Zoom\n\n" +
      "👉 Want to join? Subscribe at tada.cool to receive the Zoom link.\n\nWe're looking forward to a great discussion and hope to see many of you there!\n\n#TextAsData #CompSocSci #NLP";
  }
  function blueskyText(s) {
    var p = dparts(s.date), who = (s.speaker || "[speaker]") + (s.bsky ? " (" + s.bsky + ")" : "") + (s.affiliation ? ", " + s.affiliation : "");
    var base = "🌱 Next in the TaDa Speaker Series: " + who + " on “{T}” — " + DAYS[p.dow] + " " + p.d + " " + MONTHS[p.m - 1] + ", " + (s.time || "17:00") + " Berlin time, on Zoom. Subscribe for the link: tada.cool #TextAsData #CompSocSci";
    var title = s.title || "[title]", room = 300 - (base.length - 3);
    if (title.length > room) title = title.slice(0, Math.max(room - 1, 10)).replace(/\s+\S*$/, "") + "…";
    return base.replace("{T}", title);
  }
  function generate(kind) {
    if (kind === "cand-invitation") {
      var c = { name: $("#cd-name").value.trim(), notes: $("#cd-notes").value.trim() };
      $("#cd-draft").value = invitationText(c); return;
    }
    var s = sessionFromForm(); s.date = s.date || todayISO();
    if (kind === "invitation") $("#sd-inv-draft").value = invitationText({ name: s.speaker, notes: s.notes });
    if (kind === "newsletter") $("#sd-d-newsletter").value = newsletterText(s);
    if (kind === "linkedin") $("#sd-d-linkedin").value = linkedinText(s);
    if (kind === "bluesky") { $("#sd-d-bluesky").value = blueskyText(s); bskyCount(); }
  }
  function mailto(kind) {
    var to = "", subject = "", body = "", cc = "";
    if (kind === "invitation") { to = sdField("email").value.trim(); subject = "Invitation: TaDa Speaker Series " + (currentTerm || ""); body = $("#sd-inv-draft").value; cc = ccList().join(","); }
    if (kind === "cand-invitation") { to = $("#cd-email").value.trim(); subject = "Invitation: TaDa Speaker Series " + (currentTerm || ""); body = $("#cd-draft").value; cc = ccList().join(","); }
    if (kind === "newsletter") { var txt = $("#sd-d-newsletter").value; var m = txt.match(/^Subject:\s*(.*)$/m); subject = m ? m[1] : "TaDa Speaker Series"; body = txt.replace(/^Subject:.*\n\n?/, ""); }
    var url = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subject) + (cc ? "&cc=" + encodeURIComponent(cc) : "") + "&body=" + encodeURIComponent(body);
    if (url.length > 7000) { copyText(body); toast("Text copied (too long for a mail link) — paste it into your e-mail"); }
    window.location.href = url;
  }

  /* ---------- candidates ---------- */
  var cdlg = $("#cand-dlg"), cform = $("#cand-form"), editingC = null;
  var CF = ["name", "affiliation", "email", "url", "proposedBy", "owner", "status", "notes"];
  function renderCandidates() {
    var f = $("#cand-filter").value, rows = candidates.filter(function (c) {
      if (f === "all") return true; if (f === "active") return ["idea", "invited", "replied"].indexOf(c.status || "idea") >= 0;
      if (f === "declined") return c.status === "declined" || c.status === "waitlist"; return (c.status || "idea") === f;
    });
    $("#cand-empty").hidden = rows.length > 0;
    $("#cand-body").innerHTML = rows.map(function (c) {
      return '<tr data-id="' + esc(c.id) + '"><td class="who"><b>' + esc(c.name) + '</b>' + (c.notes ? '<span>' + esc(c.notes.slice(0, 90)) + (c.notes.length > 90 ? "…" : "") + '</span>' : "") + '</td>' +
        '<td>' + esc(c.affiliation || "") + '</td><td class="chair">' + esc(c.proposedBy || "—") + '</td><td class="chair">' + esc(c.owner || "—") + '</td>' +
        '<td><span class="st st-' + esc(c.status || "idea") + '">' + esc(c.status || "idea") + '</span></td>' +
        '<td class="meta">' + esc(c.invitedBy ? "sent by " + c.invitedBy + " · " + (c.invitedAt || "") : (c.draft ? "draft ready" : "—")) + '</td>' +
        '<td class="meta">' + esc(c.updatedBy ? c.updatedBy + " · " + (c.updatedAtLabel || "") : "") + '</td></tr>';
    }).join("");
  }
  $("#cand-filter").addEventListener("change", renderCandidates);
  $("#new-candidate").addEventListener("click", function () { openCandidate(null); });
  $("#cand-body").addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]"); if (!tr) return;
    var c = candidates.filter(function (x) { return x.id === tr.getAttribute("data-id"); })[0]; if (c) openCandidate(c);
  });
  function fillSlotSelect() {
    var sel = $("#cd-slot"), cur = sel.value;
    var opts = sessions.filter(function (s) { return !s.speaker && s.status !== "cancelled" && s.status !== "done"; });
    sel.innerHTML = '<option value="">— keep in pipeline —</option>' + opts.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(fmtShort(s.date) + " " + s.date.slice(0, 4) + " · " + termOf(s)) + '</option>'; }).join("");
    sel.value = cur;
  }
  function openCandidate(c) {
    editingC = c; $("#cd-title").textContent = c ? c.name : "New candidate";
    CF.forEach(function (k) { $("#cd-" + k).value = c ? (c[k] || (k === "status" ? "idea" : "")) : (k === "status" ? "idea" : k === "proposedBy" ? me.initials : ""); });
    $("#cd-draft").value = (c && c.draft) || ""; $("#cd-slot").value = "";
    $("#cd-meta").textContent = c && c.invitedBy ? "Invitation sent by " + c.invitedBy + " on " + (c.invitedAt || "") : "";
    $("#cd-hint").textContent = c && c.updatedBy ? "Last change: " + c.updatedBy + " · " + (c.updatedAtLabel || "") : "";
    $("[data-delete-cand]").hidden = !c; fillSlotSelect(); cdlg.showModal();
  }
  cform.addEventListener("submit", function (e) {
    e.preventDefault();
    var o = {}; CF.forEach(function (k) { o[k] = $("#cd-" + k).value.trim(); });
    if (!o.name) { $("#cd-hint").textContent = "Name is required."; return; }
    o.draft = $("#cd-draft").value; o.updatedAt = TS(); o.updatedBy = me.initials; o.updatedAtLabel = nowLabel();
    var slot = $("#cd-slot").value, ref = editingC ? db.collection("candidates").doc(editingC.id) : db.collection("candidates").doc();
    var p = ref.set(Object.assign(editingC ? {} : { createdAt: TS() }, o), { merge: true });
    if (slot) {
      var st = o.status === "confirmed" ? "confirmed" : "invited";
      p = p.then(function () {
        return db.collection("sessions").doc(slot).set({ speaker: o.name, affiliation: o.affiliation, email: o.email, url: o.url, status: st, notes: o.notes, invitation: { status: editingC && editingC.invitedBy ? "sent" : (o.draft ? "draft" : "none"), draft: o.draft, sentBy: (editingC && editingC.invitedBy) || "", sentAt: (editingC && editingC.invitedAt) || "", to: o.email }, updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() }, { merge: true });
      }).then(function () { return ref.set({ sessionDate: slot, status: st === "confirmed" ? "confirmed" : (o.status === "idea" ? "invited" : o.status) }, { merge: true }); });
    }
    p.then(function () { toast(slot ? "Saved and moved into " + fmtShort(slot) : "Candidate saved"); cdlg.close(); }, function (err) { $("#cd-hint").textContent = friendly(err); });
  });
  $("[data-delete-cand]").addEventListener("click", function () {
    if (!editingC || !confirm("Delete this candidate?")) return;
    db.collection("candidates").doc(editingC.id).delete().then(function () { toast("Deleted"); cdlg.close(); }, function (e) { toast(friendly(e)); });
  });
  $("[data-cand-sent]").addEventListener("click", function () {
    if (!editingC) { toast("Save the candidate first"); return; }
    var upd = { invitedBy: me.initials, invitedAt: nowLabel(), status: "invited", draft: $("#cd-draft").value, updatedAt: TS(), updatedBy: me.initials, updatedAtLabel: nowLabel() };
    db.collection("candidates").doc(editingC.id).update(upd).then(function () { $("#cd-status").value = "invited"; $("#cd-meta").textContent = "Invitation sent by " + me.initials + " on " + upd.invitedAt; toast("Marked as invited"); }, function (e) { toast(friendly(e)); });
  });

  /* ---------- messages ---------- */
  function scrollMsgs() { var l = $("#msg-list"); l.scrollTop = l.scrollHeight; }
  function renderMessages(list) {
    var box = $("#msg-list"), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = list.map(function (m) {
      var d = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : null;
      var when = d ? (pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes())) : "sending…";
      var mine = m.uid === user.uid;
      return '<div class="msg' + (mine ? " me" : "") + '" data-id="' + esc(m.id) + '"><div class="who"><span>' + esc(m.name || "?") + '</span><span>' + esc(when) + '</span>' + (mine ? '<button class="btn-text danger" type="button" data-del-msg>delete</button>' : "") + '</div><p class="txt">' + esc(m.text) + '</p></div>';
    }).join("");
    if (currentTab === "messages") { msgSeen = list.length; $("#msg-badge").hidden = true; }
    else if (lastMsgCount && list.length > msgSeen) { var b = $("#msg-badge"); b.textContent = list.length - msgSeen; b.hidden = false; }
    if (!lastMsgCount) msgSeen = list.length;
    lastMsgCount = list.length;
    if (atBottom || currentTab === "messages") scrollMsgs();
  }
  $("#msg-form").addEventListener("submit", function (e) {
    e.preventDefault(); var ta = $("#msg-input"), text = ta.value.trim(); if (!text) return;
    ta.value = "";
    db.collection("messages").add({ uid: user.uid, name: me.name, initials: me.initials, text: text, createdAt: TS() }).catch(function (err) { toast(friendly(err)); ta.value = text; });
  });
  $("#msg-input").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#msg-form").requestSubmit(); } });
  $("#msg-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del-msg]"); if (!b) return;
    var id = b.closest(".msg").getAttribute("data-id");
    if (confirm("Delete this message?")) db.collection("messages").doc(id).delete().catch(function (err) { toast(friendly(err)); });
  });
  $("#pinned-save").addEventListener("click", function () {
    db.collection("settings").doc("pinned").set({ text: $("#pinned").value, updatedBy: me.initials, updatedAt: TS(), updatedAtLabel: nowLabel() }).then(function () { toast("Pinned saved"); }, function (e) { toast(friendly(e)); });
  });
  function renderMembers() {
    $("#member-list").innerHTML = Object.keys(members).map(function (uid) {
      var m = members[uid];
      return '<li><span class="mono-badge">' + esc(m.initials || initialsOf(m.name)) + '</span><div>' + esc(m.name) + (m.username ? ' <small>@' + esc(m.username) + '</small>' : "") + '<small>' + esc(m.email || "") + '</small></div></li>';
    }).join("");
  }

  /* ---------- profile ---------- */
  function fillProfile() {
    $("#pf-name").value = me.name || ""; $("#pf-username").value = me.username || ""; $("#pf-initials").value = me.initials || ""; $("#pf-intro").value = me.intro || "";
    $("#cur-email").textContent = user.email || "";
  }
  $("#profile-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#pf-error").textContent = "";
    var upd = { name: $("#pf-name").value.trim(), username: $("#pf-username").value.trim().replace(/^@/, ""), initials: ($("#pf-initials").value.trim() || initialsOf($("#pf-name").value)).toUpperCase().slice(0, 3), intro: $("#pf-intro").value.trim(), updatedAt: TS() };
    if (!upd.name) { $("#pf-error").textContent = "Display name is required."; return; }
    db.collection("members").doc(user.uid).update(upd).then(function () { return user.updateProfile({ displayName: upd.name }); })
      .then(function () { $("#pf-hint").textContent = "Saved"; toast("Profile saved"); }, function (err) { $("#pf-error").textContent = friendly(err); });
  });
  function reauth(pw) { return user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, pw)); }
  $("#email-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#email-error").textContent = "";
    var nw = $("#new-email").value.trim(), pw = $("#email-pw").value;
    if (!nw || !pw) { $("#email-error").textContent = "Enter the new e-mail and your current password."; return; }
    reauth(pw).then(function () { return user.verifyBeforeUpdateEmail(nw); })
      .then(function () { $("#email-error").textContent = "Verification link sent to " + nw + ". After you click it, sign in with the new address; your profile and the allow-list update automatically."; $("#new-email").value = ""; $("#email-pw").value = ""; })
      .catch(function (err) { $("#email-error").textContent = friendly(err); });
  });
  $("#pw-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#pw-error").textContent = "";
    var old = $("#pw-old").value, nw = $("#pw-new").value;
    if (nw.length < 8) { $("#pw-error").textContent = "New password needs at least 8 characters."; return; }
    reauth(old).then(function () { return user.updatePassword(nw); })
      .then(function () { $("#pw-error").textContent = "Password changed."; $("#pw-old").value = ""; $("#pw-new").value = ""; toast("Password changed"); })
      .catch(function (err) { $("#pw-error").textContent = friendly(err); });
  });
  $("#allow-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var emails = $("#allow-emails").value.split(/[\n,;\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return /@/.test(x); });
    emails = emails.filter(function (x, i) { return emails.indexOf(x) === i; });
    if (emails.length && emails.indexOf((user.email || "").toLowerCase()) < 0) emails.push((user.email || "").toLowerCase());
    db.collection("settings").doc("allowlist").set({ emails: emails, updatedAt: TS(), updatedBy: me.initials }).then(function () { $("#allow-hint").textContent = "Saved (" + emails.length + ")"; toast("Allow-list saved"); }, function (err) { $("#allow-hint").textContent = friendly(err); });
  });
})();

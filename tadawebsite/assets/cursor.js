/* TaDa pointer: a navy arrow cursor that leaves short, falling columns of binary digits in the logo's
   blues, plus a small burst of digits on click. Decorative only: real mouse pointers only (no touch),
   off for prefers-reduced-motion and forced colours (high-contrast themes), nothing runs while the
   mouse is still. Visitors who ask for more contrast keep their own system pointer. No dependencies. */
(function () {
  "use strict";
  var mm = window.matchMedia;
  if (!mm) return;
  var rm = mm("(prefers-reduced-motion: reduce)");   /* .matches is live: re-checked on every event */
  if (!mm("(hover: hover) and (pointer: fine)").matches || rm.matches || mm("(forced-colors: active)").matches) return;
  if (!document.body || !document.body.animate) return;

  var NAVY = "#274387", BLUE = "#0167d4", LIGHT = "#3ab8ef", PALE = "#e6f4fc";
  var arrow = "%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M4 3 L4 22 L9.2 17.4 L12.6 24.6 L15.9 23.1 L12.5 16 L19.5 16 Z' fill='%23274387' stroke='%233ab8ef' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E";
  function grad(head) { return "linear-gradient(to top," + head + " 0," + head + " 20%," + LIGHT + " 58%,rgba(58,184,239,0) 100%)"; }
  var st = document.createElement("style");
  /* arrow only: links, buttons and text fields keep their native hand / I-beam */
  st.textContent = (mm("(prefers-contrast: more)").matches ? "" : "html,body{cursor:url(\"data:image/svg+xml," + arrow + "\") 4 3,auto}") +
    ".tada-rain{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:9999;contain:strict;-webkit-user-select:none;user-select:none}" +
    ".tada-rain span{position:absolute;left:0;top:0;white-space:pre;text-align:center;font:600 12px/1.08 'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;will-change:transform,opacity;" +
    "color:" + LIGHT + ";background:" + grad(BLUE) + ";-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}" +
    ".tada-rain span.d{background-image:" + grad(PALE) + "}" +   /* over dark backgrounds: pale head */
    ".tada-rain span.b{background:none;-webkit-text-fill-color:currentColor}";
  document.head.appendChild(st);

  var layer = document.createElement("div");
  layer.className = "tada-rain";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  /* is the background under the pointer dark? (first opaque background up the tree; cached per element) */
  var seen = typeof WeakMap === "function" ? new WeakMap() : null;
  function isDark(el) {
    if (!el || el.nodeType !== 1) return false;
    if (seen && seen.has(el)) return seen.get(el);
    var dark = false, n = el, m;
    while (n && n.nodeType === 1) {
      m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,\/]\s*([\d.]+))?/.exec(getComputedStyle(n).backgroundColor);
      if (m && (m[4] === undefined || +m[4] > 0.5)) { dark = 0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3] < 120; break; }
      n = n.parentElement;
    }
    if (seen) seen.set(el, dark);
    return dark;
  }

  var GRID = 13, STEP = 24, GAP = 28, MAX = 44, live = [];
  function bit() { return Math.random() < 0.5 ? "0" : "1"; }
  function drop(el) {
    var i = live.indexOf(el); if (i > -1) live.splice(i, 1);
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  function add(text, cls, size, frames, ms) {
    if (live.length >= MAX) drop(live[0]);             /* oldest goes first, the trail never stalls */
    var el = document.createElement("span");
    if (cls) el.className = cls;
    if (size) el.style.fontSize = size + "px";
    el.textContent = text;
    layer.appendChild(el); live.push(el);
    el.animate(frames, { duration: ms, easing: "linear", fill: "forwards" }).onfinish = function () { drop(el); };
  }
  /* a column of 3 to 6 digits: head at the bottom, tail fading out upwards; it falls and fades */
  function stream(x, y, dark) {
    var n = 3 + ((Math.random() * 4) | 0), s = [], size = 11 + ((Math.random() * 4) | 0), i;
    for (i = 0; i < n; i++) s.push(bit());
    var px = Math.round((x + 16 + (Math.random() * 26 - 13)) / GRID) * GRID - 4;
    var py = y + 14 - (n - 1) * size * 1.08 + Math.random() * 10, fall = 38 + Math.random() * 46;
    add(s.join("\n"), dark ? "d" : "", size, [
      { transform: "translate(" + px + "px," + py + "px)", opacity: 0 },
      { transform: "translate(" + px + "px," + (py + fall * 0.16) + "px)", opacity: 1, offset: 0.16 },
      { transform: "translate(" + px + "px," + (py + fall * 0.6) + "px)", opacity: 0.75, offset: 0.6 },
      { transform: "translate(" + px + "px," + (py + fall) + "px)", opacity: 0 }
    ], 700 + Math.random() * 500);
  }
  /* click: eight single digits fly outwards */
  function burst(x, y, dark) {
    var cols = dark ? [PALE, LIGHT, "#ffffff"] : [NAVY, BLUE, LIGHT];
    for (var i = 0; i < 8; i++) {
      var ang = (i / 8) * Math.PI * 2 + Math.random() * 0.5, d = 28 + Math.random() * 24, col = cols[i % 3];
      add(bit(), "b", 13, [
        { transform: "translate(" + (x - 4) + "px," + (y - 7) + "px) scale(.7)", opacity: 1, color: col },
        { transform: "translate(" + (x - 4 + Math.cos(ang) * d) + "px," + (y - 7 + Math.sin(ang) * d) + "px) scale(1.2)", opacity: 0, color: col }
      ], 520);
    }
  }

  var lastX = null, lastY = null, acc = 0, lastT = 0;
  window.addEventListener("pointermove", function (e) {
    if (rm.matches || (e.pointerType && e.pointerType !== "mouse")) return;
    var x = e.clientX, y = e.clientY;
    if (lastX === null) { lastX = x; lastY = y; return; }
    var dx = x - lastX, dy = y - lastY;
    acc += Math.sqrt(dx * dx + dy * dy); lastX = x; lastY = y;
    if (acc < STEP) return;
    var now = e.timeStamp || Date.now();
    if (now - lastT < GAP) return;                       /* at most ~35 columns a second */
    lastT = now; acc = 0;
    stream(x, y, isDark(e.target));
  }, { passive: true });
  window.addEventListener("pointerdown", function (e) {
    if (rm.matches || (e.pointerType && e.pointerType !== "mouse")) return;
    if (e.button === 0) burst(e.clientX, e.clientY, isDark(e.target));
  }, { passive: true });
})();

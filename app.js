(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---- year ---- */
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- scroll progress ---- */
  var prog = document.querySelector(".scroll-progress");
  function onScroll() {
    var top = document.querySelector(".topbar");
    if (top) top.classList.toggle("scrolled", window.scrollY > 24);
    if (prog) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- reveal on scroll ---- */
  var reveals = document.querySelectorAll("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- count up ---- */
  var counters = document.querySelectorAll("[data-count]");
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var dec = (el.getAttribute("data-count").split(".")[1] || "").length;
    if (reduce) { el.textContent = target.toFixed(dec); return; }
    var start = null, dur = 1500;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(dec);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(animateCount);
  }

  /* ---- mobile menu: accessible button toggle ---- */
  var burger = document.querySelector(".nav-burger");
  function closeMenu() {
    document.body.classList.remove("nav-open");
    if (burger) burger.setAttribute("aria-expanded", "false");
  }
  if (burger) {
    burger.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        closeMenu();
        burger.focus();
      }
    });
  }

  /* ---- marquee: pause/play control (touch & keyboard users can't hover) ---- */
  var mq = document.querySelector(".marquee");
  if (mq) {
    var mbtn = document.createElement("button");
    mbtn.className = "marquee-toggle";
    mbtn.setAttribute("aria-label", "Pause animation");
    mbtn.setAttribute("aria-pressed", "false");
    mbtn.innerHTML = "&#10074;&#10074;";
    mq.appendChild(mbtn);
    mbtn.addEventListener("click", function () {
      var paused = mq.classList.toggle("paused");
      mbtn.setAttribute("aria-pressed", paused ? "true" : "false");
      mbtn.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
      mbtn.innerHTML = paused ? "&#9654;" : "&#10074;&#10074;";
    });
  }

  /* ---- custom cursor: viewfinder corner-bracket frame ---- */
  if (fine && !reduce) {
    var frame = document.createElement("div");
    frame.className = "cursor-frame";
    frame.innerHTML = "<i></i><i></i><i></i><i></i>";
    document.body.appendChild(frame);
    var mx = -100, my = -100, fx = -100, fy = -100, raf = null;
    function loop() {
      fx += (mx - fx) * 0.4; fy += (my - fy) * 0.4;
      frame.style.left = fx + "px"; frame.style.top = fy + "px";
      if (Math.abs(mx - fx) > 0.3 || Math.abs(my - fy) > 0.3) raf = requestAnimationFrame(loop);
      else raf = null;
    }
    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (raf === null) raf = requestAnimationFrame(loop);
    });
    document.addEventListener("mousedown", function () { frame.classList.add("down"); });
    document.addEventListener("mouseup", function () { frame.classList.remove("down"); });
    var hot = "a, button, .btn, .pillar, .pub-list li, .timeline li, .photo-card, .contact-card, .nav-burger, [data-cursor]";
    document.querySelectorAll(hot).forEach(function (el) {
      el.addEventListener("mouseenter", function () { frame.classList.add("hover"); });
      el.addEventListener("mouseleave", function () { frame.classList.remove("hover"); });
    });
    document.addEventListener("mouseleave", function () { frame.style.opacity = 0; });
    document.addEventListener("mouseenter", function () { frame.style.opacity = ""; });
  }
})();

/*! Artfinity embed v2 · theartfinity.com/developers */
// <div data-artfinity-artist="handle">, data-artfinity-collection="handle/slug", data-artfinity-art="slug":
//   an iframe of /embed/artist|collection|art that grows to fit its content (the page posts its height).
//   Options: data-layout, data-columns, data-count (or data-limit), data-theme, data-accent, data-prices, data-header.
// <div data-artfinity-buy="slug">, data-artfinity-links="handle": small inline buttons in a shadow root.
// Plain <iframe src=".../embed/..."> tags on the same page resize too. Call window.Artfinity.scan() after adding divs.
(function (w, d) {
  if (w.Artfinity && w.Artfinity.scan) return w.Artfinity.scan();
  var s = d.currentScript || d.querySelector('script[src*="/embed.js"]');
  var B = s ? new URL(s.src, location.href).origin : "https://theartfinity.com";
  var A = B + "/api/public/v1/";
  var KINDS = ["artist", "collection", "art", "buy", "links"];
  var SEL = KINDS.map(function (k) { return "[data-artfinity-" + k + "]"; }).join(",");
  var OPTS = ["layout", "columns", "count", "limit", "theme", "accent", "prices", "header"];
  var C = {};
  function get(p) {
    return C[p] || (C[p] = fetch(A + p).then(function (r) { if (!r.ok) throw r.status; return r.json(); }));
  }
  function e(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function u(x) { return /^https?:\/\//.test(x || "") ? e(x) : "#"; }
  var M = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><rect x="7" y="7" width="10" height="10" rx="1.5" fill="#8b2a4b"/></svg>';
  var CSS =
    ":host{all:initial;display:block;--bg:#fff;--fg:#15161b;--ac:#8b2a4b}:host([data-theme=dark]){--bg:#15161b;--fg:#f2f3ec;--ac:#f0c3cc}" +
    ".r{font:14px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--fg)}*{box-sizing:border-box;margin:0}a{color:inherit;text-decoration:none}" +
    "iframe{display:block;width:100%;border:0;color-scheme:normal;transition:height .15s}.m{color:#5a5d6b;font-size:12.5px}.v{color:var(--ac);font-weight:700}" +
    ".b{font-weight:700;cursor:pointer;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#8b2a4b;color:#fff;padding:9px 16px;font-size:14px}.b:hover{filter:brightness(1.12)}" +
    "a:focus-visible{outline:3px solid var(--ac);outline-offset:2px}" +
    ".l{display:inline-flex;align-items:center;gap:10px;background:var(--bg);color:var(--fg);border:2px solid var(--fg);border-radius:999px;padding:6px 16px 6px 6px;font-weight:700}.l img{width:32px;height:32px;border-radius:50%;object-fit:cover}";

  function root(el) { return el.shadowRoot || el.attachShadow({ mode: "open" }); }
  function paint(el, html) {
    root(el).innerHTML = "<style>" + CSS + '</style><div class="r">' + html + "</div>";
  }
  function fail(el) { paint(el, '<div class="m">Art could not load. <a class="v" href="' + B + '" target="_blank" rel="noopener">Artfinity</a></div>'); }

  // ---------------- iframes ----------------
  var frames = [];
  function query(el, extra) {
    var q = [];
    OPTS.forEach(function (k) {
      var v = el.getAttribute("data-" + k);
      if (v != null && v !== "") q.push(k + "=" + encodeURIComponent(v.trim()));
    });
    return "?" + q.concat(extra || []).join("&");
  }
  function frame(el, path, title, h, max) {
    var f = d.createElement("iframe");
    f.src = B + path + query(el, ["autosize=1"]);
    f.title = title;
    f.loading = "lazy";
    f.style.height = h + "px";
    if (max) f.style.maxWidth = max + "px";
    paint(el, "");
    root(el).querySelector(".r").appendChild(f);
    frames = frames.filter(function (x) { return x.isConnected; }).concat(f);
  }
  function seg(x) { return encodeURIComponent(x); }
  function clean(v) { return (v || "").trim().replace(/^@/, ""); }

  // The embed pages post { type: "artfinity:resize", height } to their parent. Only frames we made, or plain
  // iframes pointing at our /embed/ pages, are resized; anything else posting the same message is ignored.
  function ours(f) { return frames.indexOf(f) >= 0 || (f.src || "").indexOf(B + "/embed/") === 0; }
  w.addEventListener("message", function (ev) {
    var m = ev.data;
    if (ev.origin !== B || !m || m.type !== "artfinity:resize" || typeof m.height !== "number") return;
    var all = frames.concat([].slice.call(d.getElementsByTagName("iframe")));
    for (var i = 0; i < all.length; i++) {
      var f = all[i];
      if (f.contentWindow === ev.source && ours(f)) {
        f.style.height = Math.max(40, Math.min(Math.ceil(m.height), 20000)) + "px";
        return;
      }
    }
  });

  // ---------------- inline buttons ----------------
  function buy(el, sl) {
    get("artworks/" + sl).then(function (r) {
      var a = r.artwork;
      paint(el, '<a class="b" href="' + u(a.url) + '" target="_blank" rel="noopener" aria-label="Buy a print of ' + e(a.title) + '">' + M.replace("#8b2a4b", "#ffd43b").replace('"currentColor"', '"#fff"') + " Buy a print · from " + e(a.fromPrice.display) + "</a>");
    }, function () { // API down: no handle known, and the old /art/<slug> link redirects
      paint(el, '<a class="b" href="' + B + "/art/" + sl + '" target="_blank" rel="noopener">Buy a print</a>'); });
  }
  function links(el, h) {
    get("artists/" + h).then(function (r) {
      var p = r.artist;
      paint(el, '<a class="l" href="' + u(p.linksUrl) + '" target="_blank" rel="noopener">' + (p.avatar ? '<img src="' + u(p.avatar) + '" alt="">' : M) + e(p.name) + " on Artfinity</a>");
    }, function () { fail(el); });
  }

  function scan(rootNode) {
    (rootNode || d).querySelectorAll(SEL).forEach(function (el) {
      var key = KINDS.map(function (k) { return el.getAttribute("data-artfinity-" + k); }).concat(OPTS.map(function (k) { return el.getAttribute("data-" + k); })).join("|");
      if (el._af === key) return;
      el._af = key;
      var g = function (k) { return clean(el.getAttribute("data-artfinity-" + k)); };
      if (el.hasAttribute("data-artfinity-artist")) {
        frame(el, "/embed/artist/" + seg(g("artist")), "Art by " + g("artist") + " on Artfinity", 520);
      } else if (el.hasAttribute("data-artfinity-collection")) {
        var p = g("collection").split("/");
        frame(el, "/embed/collection/" + seg(clean(p[0])) + "/" + seg(p[1] || ""), "A collection on Artfinity", 520);
      } else if (el.hasAttribute("data-artfinity-art")) {
        frame(el, "/embed/art/" + seg(g("art")), "Artwork on Artfinity", 560, 480);
      } else if (el.hasAttribute("data-artfinity-buy")) buy(el, seg(g("buy")));
      else links(el, seg(g("links")));
    });
  }
  w.Artfinity = { scan: scan, base: B };
  d.readyState == "loading" ? d.addEventListener("DOMContentLoaded", function () { scan(); }) : scan();
})(window, document);

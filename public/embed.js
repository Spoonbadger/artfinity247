/*! Artfinity embed v1 · theartfinity.com/developers */
(function (w, d) {
  if (w.Artfinity && w.Artfinity.scan) return w.Artfinity.scan();
  var s = d.currentScript || d.querySelector('script[src*="/embed.js"]');
  var B = s ? new URL(s.src, location.href).origin : "https://theartfinity.com";
  var A = B + "/api/public/v1/";
  var SEL = "[data-artfinity-artist],[data-artfinity-art],[data-artfinity-buy],[data-artfinity-links]";
  var C = {};
  function get(p) {
    return C[p] || (C[p] = fetch(A + p).then(function (r) { if (!r.ok) throw r.status; return r.json(); }));
  }
  function e(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function u(x) { return /^https?:\/\//.test(x || "") ? e(x) : "#"; }
  var M = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><rect x="7" y="7" width="10" height="10" rx="1.5" fill="#2b37f0"/></svg>';
  var CSS =
    ":host{all:initial;display:block;--bg:#fff;--fg:#15161b;--mu:#5a5d6b;--ln:#e1e2da;--im:#e9e6df}.r{font:14px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--fg);font-variant-numeric:tabular-nums;letter-spacing:normal;text-transform:none;text-align:left}" +
    ":host([data-theme=dark]){--bg:#15161b;--fg:#f2f3ec;--mu:#a3a6b3;--ln:#30323b;--im:#24262e}" +
    "*{box-sizing:border-box;margin:0}a{color:inherit;text-decoration:none}" +
    ".w{background:var(--bg);border:1px solid var(--ln);border-radius:16px;padding:14px;display:grid;gap:12px;container-type:inline-size}" +
    ".h{display:flex;align-items:center;gap:10px}.h img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--im)}.h b{font-size:16px}" +
    ".m{color:var(--mu);font-size:12.5px}.v{color:#2b37f0;font-weight:700}" +
    ".g{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(112px,1fr))}@container (min-width:640px){.g{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}}" +
    ".k{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}.k .c{flex:0 0 min(72%,220px);scroll-snap-align:start}" +
    ".c{display:flex;flex-direction:column;gap:6px;min-width:0}.c>.b{margin-top:auto}.c .t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".i{position:relative;overflow:hidden;border-radius:10px;background:var(--im);aspect-ratio:4/5}.i img{display:block;width:100%;height:100%;object-fit:cover;transition:filter .2s}" +
    ".s img{filter:blur(18px);transform:scale(1.15)}.o{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:6px;color:#fff;font-size:12px;text-align:center;background:rgba(21,22,27,.25)}" +
    "button,.b{font:inherit;font-weight:700;cursor:pointer;border-radius:999px;border:0;display:inline-flex;align-items:center;justify-content:center;gap:6px}" +
    ".o button{background:#fff;color:#15161b;padding:5px 14px}" +
    ".b{background:#2b37f0;color:#fff;padding:9px 16px;font-size:14px}.b:hover{filter:brightness(1.12)}.c .b{padding:7px 12px;font-size:13px}" +
    "a:focus-visible,button:focus-visible{outline:3px solid #2b37f0;outline-offset:2px}" +
    ".x{display:grid;gap:14px}.x .i{aspect-ratio:auto;max-height:520px}.x .i img{height:auto;max-height:520px;object-fit:contain}.x .t{font-size:18px;white-space:normal}" +
    ".f{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.f a{display:inline-flex;align-items:center;gap:6px}" +
    ".l{display:inline-flex;align-items:center;gap:10px;background:var(--bg);color:var(--fg);border:2px solid var(--fg);border-radius:999px;padding:6px 16px 6px 6px;font-weight:700}.l img{width:32px;height:32px;border-radius:50%;object-fit:cover}";

  function img(a) {
    var sn = a.sensitive && a.sensitive.length;
    return '<div class="i' + (sn ? " s" : "") + '"><a href="' + u(a.url) + '" target="_blank" rel="noopener" tabindex="-1"><img src="' + u(a.image.url) + '" alt="' + e(a.title) + '" loading="lazy"></a>' +
      (sn ? '<div class="o"><span>' + e(a.sensitive.join(", ")) + '</span><button type="button">Show</button></div>' : "") + "</div>";
  }
  function ed(a, l) { var x = a.edition; return x ? (x.soldOut ? "Edition sold out" : (l ? "Limited edition of " + x.size + " · " : "") + x.remaining + " of " + x.size + " left") : ""; }
  function card(a) {
    return '<div class="c">' + img(a) + '<span class="t">' + e(a.title) + '</span><span class="m">From ' + e(a.fromPrice.display) + (a.edition ? " · " + e(ed(a)) : "") +
      '</span><a class="b" href="' + u(a.url) + '" target="_blank" rel="noopener">Buy a print</a></div>';
  }
  function big(a) {
    return '<div class="c x">' + img(a) + '<div><div class="t">' + e(a.title) + '</div><div class="m">' + e(a.artist.name) + " · From " + e(a.fromPrice.display) +
      (a.edition ? " · " + e(ed(a, 1)) : "") + '</div></div><a class="b" href="' + u(a.url) + '" target="_blank" rel="noopener">Buy a print</a></div>';
  }
  function foot(href, txt) {
    return '<div class="f m"><a href="' + u(href) + '" target="_blank" rel="noopener">' + e(txt) + ' →</a><a href="' + B + '" target="_blank" rel="noopener">' + M + "Prints by Artfinity</a></div>";
  }
  function paint(el, html) {
    var r = el.shadowRoot || el.attachShadow({ mode: "open" });
    r.innerHTML = "<style>" + CSS + '</style><div class="r">' + html + "</div>";
    r.querySelectorAll(".o button").forEach(function (b) {
      b.onclick = function () { var i = b.closest(".i"); i.classList.remove("s"); b.parentNode.remove(); };
    });
  }
  function fail(el) { paint(el, '<div class="w m" style="display:block">Art could not load. <a class="v" href="' + B + '" target="_blank" rel="noopener">Artfinity</a></div>'); }

  function artist(el, h) {
    var n = Math.min(+el.getAttribute("data-limit") || 6, 50), L = el.getAttribute("data-layout") || "grid";
    Promise.all([get("artists/" + h), get("artists/" + h + "/artworks?limit=" + (L == "single" ? 1 : n))]).then(function (r) {
      var p = r[0].artist, list = r[1].artworks, loc = p.location.city ? p.location.city + (p.location.region ? ", " + p.location.region : "") : "";
      var head = '<a class="h" href="' + u(p.url) + '" target="_blank" rel="noopener">' + (p.avatar ? '<img src="' + u(p.avatar) + '" alt="">' : "") + "<span><b>" + e(p.name) + "</b>" +
        (p.verified ? ' <span class="v" title="Verified by Artfinity">✓</span>' : "") + '<br><span class="m">' + e([loc, p.medal && p.medal.label].filter(Boolean).join(" · ")) + "</span></span></a>";
      var body = L == "single" ? (list[0] ? big(list[0]) : "") : '<div class="' + (L == "carousel" ? "k" : "g") + '">' + list.map(card).join("") + "</div>";
      paint(el, '<div class="w">' + head + body + foot(p.url, "See all " + p.artworkCount) + "</div>");
    }, function () { fail(el); });
  }
  function art(el, sl) {
    get("artworks/" + sl).then(function (r) { paint(el, '<div class="w">' + big(r.artwork) + foot(r.artwork.artist.url, "More by " + r.artwork.artist.name) + "</div>"); }, function () { fail(el); });
  }
  function buy(el, sl) {
    get("artworks/" + sl).then(function (r) {
      var a = r.artwork;
      paint(el, '<a class="b" href="' + u(a.url) + '" target="_blank" rel="noopener" aria-label="Buy a print of ' + e(a.title) + '">' + M.replace("#2b37f0", "#ffd43b").replace('"currentColor"', '"#fff"') + " Buy a print · from " + e(a.fromPrice.display) + "</a>");
    }, function () { // API down: no handle known, and the old /art/<slug> link redirects
      paint(el, '<a class="b" href="' + B + "/art/" + encodeURIComponent(sl) + '" target="_blank" rel="noopener">Buy a print</a>'); });
  }
  function links(el, h) {
    get("artists/" + h).then(function (r) {
      var p = r.artist;
      paint(el, '<a class="l" href="' + u(p.linksUrl) + '" target="_blank" rel="noopener">' + (p.avatar ? '<img src="' + u(p.avatar) + '" alt="">' : M) + e(p.name) + " on Artfinity</a>");
    }, function () { fail(el); });
  }
  function scan(root) {
    (root || d).querySelectorAll(SEL).forEach(function (el) {
      var key = (SEL + ",[data-layout],[data-limit]").split(",").map(function (q) { return el.getAttribute(q.slice(1, -1)); }).join("|");
      if (el._af === key) return;
      el._af = key;
      var g = function (k) { return encodeURIComponent((el.getAttribute("data-artfinity-" + k) || "").trim().replace(/^@/, "")); };
      if (el.hasAttribute("data-artfinity-artist")) artist(el, g("artist"));
      else if (el.hasAttribute("data-artfinity-art")) art(el, g("art"));
      else if (el.hasAttribute("data-artfinity-buy")) buy(el, g("buy"));
      else links(el, g("links"));
    });
  }
  w.Artfinity = { scan: scan, base: B };
  d.readyState == "loading" ? d.addEventListener("DOMContentLoaded", function () { scan(); }) : scan();
})(window, document);

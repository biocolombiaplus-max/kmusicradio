/* Kmusic Radio · landing. Todo el contenido viene de la configuración:
   1) /api/config (lo que se guarda en el panel /admin)
   2) /config.default.json (datos de ejemplo si aún no se ha guardado nada)
   Con ?preview=1 la página escucha los cambios del panel en vivo. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => { u = String(u || "").trim(); return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u) ? u : ""; };
const PALETTES = [["#3d5bff","#ff7a00"],["#ff3d5a","#ffa914"],["#7b2cff","#21d4b8"],["#0fa968","#3d5bff"],["#ff7a00","#7b2cff"],["#1b1f6b","#ff3d5a"],["#21d4b8","#3d5bff"],["#ffa914","#ff3d5a"]];
const ic = (n, pause) => pause
  ? `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`
  : `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>`;
const initials = (n) => String(n || "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const pad = (n) => String(n).padStart(2, "0");
const WEEK = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];

/* Imagen o arte generado si no hay imagen */
function art(i, url, label = "", cls = "", extra = "") {
  const [a, b] = PALETTES[Math.abs(i) % PALETTES.length];
  const u = safeUrl(url);
  return `<div class="art ${cls}" style="--c1:${a};--c2:${b}">${extra}${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ""}${label ? `<span class="art-k">${esc(label)}</span>` : ""}</div>`;
}

/* YouTube, Vimeo, MP4 o enlace */
function parseVideo(url) {
  const u = safeUrl(url);
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { type: "yt", id: m[1], embed: `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, url: u };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { type: "vimeo", embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, url: u };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { type: "file", src: u, url: u };
  return { type: "link", url: u };
}

function deepMerge(base, over) {
  if (Array.isArray(over)) return over;
  if (over && typeof over === "object" && base && typeof base === "object" && !Array.isArray(base)) {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}

const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function onAirNow(s, d = new Date()) {
  if (!s.start || !s.end) return false;
  const days = Array.isArray(s.days) && s.days.length ? s.days : [0,1,2,3,4,5,6];
  const now = d.getHours() * 60 + d.getMinutes();
  const st = toMin(s.start); let en = toMin(s.end); if (en <= st) en += 1440;
  return days.includes(d.getDay()) && now >= st && now < en;
}

let C = null;               // configuración actual
let selDay = new Date().getDay();
let liveMeta = null;        // metadatos del stream (si hay nowPlayingUrl)

/* ================= RENDER ================= */
function render() {
  const S = C.sections || {};
  const root = document.documentElement.style;
  if (C.brand?.accent) root.setProperty("--amber", C.brand.accent);
  if (C.brand?.accent2) root.setProperty("--blue", C.brand.accent2);
  document.title = C.seo?.title || C.brand?.name || "Radio";
  const md = $('meta[name="description"]'); if (md && C.seo?.description) md.content = C.seo.description;
  const logo = safeUrl(C.brand?.logo) || "/assets/logo-dark.png";
  $("#navLogo").src = logo; $("#navLogo").alt = C.brand?.name || "";

  const nav = [
    ["programacion","Programación",S.schedule],["top","Top 10",S.top],["en-vivo","En video",S.live && C.stream?.liveVideoUrl],
    ["videos","Videos",S.videos],["eventos","Eventos",S.events],["noticias","Noticias",S.news],["pauta","Anúnciate",S.ads]
  ].filter((x) => x[2]);
  $("#navLinks").innerHTML = nav.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join("");

  const h = C.hero || {};
  const bgVid = safeUrl(h.bgVideo), bgImg = safeUrl(h.bgImage);
  const np = currentTrack();
  const name = C.brand?.name || "Radio";
  const shows = C.schedule || [];
  const curShow = shows.find((s) => onAirNow(s));

  let html = `
<section class="hero" id="inicio">
  ${bgVid || bgImg ? `<div class="hero-bg">${bgVid ? `<video src="${esc(bgVid)}" autoplay muted loop playsinline ${bgImg ? `poster="${esc(bgImg)}"` : ""}></video>` : `<img src="${esc(bgImg)}" alt="">`}</div>` : ""}
  <canvas id="waves" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      <p class="eyebrow">${esc(h.eyebrow)}</p>
      <h1>${esc(h.title)} <span class="outline">${esc(h.highlight)}</span><span class="k">.</span></h1>
      <p class="hero-lead">${esc(h.lead)}</p>
      <div class="hero-cta">
        <button class="btn btn-amber" data-play type="button">${ic(18)} ${esc(h.ctaText || "Escuchar en vivo")}</button>
        ${S.schedule ? `<a class="btn btn-ghost" href="#programacion">Ver programación</a>` : ""}
      </div>
      <div class="hero-stats">${(h.stats || []).map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>
    </div>
    <aside class="np" aria-label="Sonando ahora">
      <div class="np-top"><span>● SONANDO AHORA</span><span id="clock">--:--</span></div>
      ${art(1, np.cover, np.cover ? "" : np.title, "np-cover", "")}
      <div class="np-title" id="npTitle">${esc(np.title)}</div>
      <div class="np-artist" id="npArtist">${esc(np.artist)}</div>
      <div class="np-row">
        <button class="play-big" data-play type="button" aria-label="Reproducir en vivo"></button>
        <div class="np-next"><b>${curShow ? "Al aire" : "A continuación"}</b>${esc(curShow ? `${curShow.name} · ${curShow.host}` : (C.nowPlaying?.next || ""))}</div>
      </div>
    </aside>
  </div>
</section>`;

  if ((C.ticker || []).length) {
    const t = C.ticker.map((x) => `<span>${esc(x.text)}</span>`).join("");
    html += `<div class="ticker" aria-hidden="true"><div class="ticker-track">${t}${t}</div></div>`;
  }

  if (S.schedule) html += `
<section class="sec" id="programacion"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Programación</p><h2>Tu día suena así</h2></div>
  <p>El programa marcado está al aire en este momento, según tu hora local.</p></div>
  <div class="days" id="days" role="group" aria-label="Día de la semana"></div>
  <div class="schedule" id="schedule"></div>
</div></section>`;

  if (S.banners && (C.banners || []).length) html += `<div class="wrap banner-slot" id="bannerSlot"></div>`;

  if (S.top) {
    const top = C.top || {};
    html += `
<section class="sec" id="top" style="background:linear-gradient(180deg,var(--ink),var(--surface) 60%,var(--ink))"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">${esc(top.week)}</p><h2>K-Top 10</h2></div>
  ${safeUrl(top.voteUrl) ? `<a class="link-more" href="${esc(safeUrl(top.voteUrl))}" target="_blank" rel="noopener">Vota por tu canción →</a>` : ""}</div>
  <div class="top-grid">${(top.items || []).map((t, i) => {
    const tr = { up: ["up","▲ Sube"], down: ["down","▼ Baja"], new: ["new","NUEVO"], same: ["", "= Igual"] }[t.trend] || ["",""];
    const link = safeUrl(t.link);
    return `<div class="track"><span class="pos">${i + 1}</span>${art(i, t.cover)}
      <div style="min-width:0"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div>
      <div class="track-meta"><span class="trend ${tr[0]}">${tr[1]}</span>
      ${link ? `<a class="mini-play" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Escuchar ${esc(t.title)}">${ic(16)}</a>` : `<button class="mini-play" type="button" data-noaudio aria-label="Escuchar ${esc(t.title)}">${ic(16)}</button>`}</div></div>`;
  }).join("")}</div>
</div></section>`;
  }

  if (S.live && C.stream?.liveVideoUrl) {
    const v = parseVideo(C.stream.liveVideoUrl);
    html += `
<section class="sec" id="en-vivo"><div class="wrap live-box">
  <div class="live-frame" id="liveFrame">
    ${art(5, v?.thumb, "", "")}
    <span class="live-pill live-badge"><span class="dot"></span>EN VIVO</span>
    <button class="vplay" type="button" data-video="${esc(C.stream.liveVideoUrl)}" aria-label="Ver transmisión en video">${ic(30)}</button>
  </div>
  <div><p class="eyebrow">Cabina en video</p><h2>Míranos mientras nos escuchas</h2>
  <p>La transmisión en video desde la cabina: entrevistas, invitados y sesiones en vivo.</p></div>
</div></section>`;
  }

  if (S.videos) {
    const vids = C.videos?.items || [];
    html += `
<section class="sec" id="videos"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">K-TV</p><h2>Videos, sesiones y entrevistas</h2></div>
  ${safeUrl(C.videos?.channelUrl) ? `<a class="link-more" href="${esc(safeUrl(C.videos.channelUrl))}" target="_blank" rel="noopener">Ir al canal →</a>` : ""}</div>
  <div class="videos">${vids.map((v, i) => {
    const p = parseVideo(v.url);
    const cover = safeUrl(v.cover) || p?.thumb || "";
    return `<button class="video${i === 0 ? " feature" : ""}" type="button" data-video="${esc(v.url || "")}">
      ${art(i + 3, cover)}<div class="shade"></div>
      ${v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ""}
      <span class="vplay">${ic(26)}</span>
      <div class="vinfo">${v.tag ? `<span class="vtag">${esc(v.tag)}</span>` : ""}<h3>${esc(v.title)}</h3></div></button>`;
  }).join("")}</div>
</div></section>`;
  }

  if (S.hosts) html += `
<section class="sec" id="locutores" style="padding-top:0"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">El equipo</p><h2>Las voces de ${esc(name.split(" ")[0])}</h2></div>
  <p>Ellos te acompañan desde la mañana hasta la madrugada.</p></div>
  <div class="hosts">${(C.hosts || []).map((x, i) => `<article class="host-card">${art(i + 2, x.photo, initials(x.name))}
    <div class="hc-body"><h3>${esc(x.name)}</h3><p>${esc(x.program)}</p>
    ${safeUrl(x.instagram) ? `<a class="ig" href="${esc(safeUrl(x.instagram))}" target="_blank" rel="noopener">Instagram →</a>` : ""}</div></article>`).join("")}</div>
</div></section>`;

  if (S.app) {
    const a = C.app || {}, so = C.social || {};
    const SOC = [["instagram","Instagram"],["tiktok","TikTok"],["youtube","YouTube"],["facebook","Facebook"],["spotify","Spotify"],["whatsapp","WhatsApp"],["x","X"]].filter(([k]) => safeUrl(so[k]));
    html += `
<section class="band"><div class="wrap">
  <div><p class="eyebrow">Llévala contigo</p><h2>${esc(a.title)}</h2><p>${esc(a.text)}</p>
    <div class="stores">
      ${safeUrl(so.appstore) ? `<a class="store" href="${esc(safeUrl(so.appstore))}" target="_blank" rel="noopener"><small>Descárgala en</small><b>App Store</b></a>` : ""}
      ${safeUrl(so.googleplay) ? `<a class="store" href="${esc(safeUrl(so.googleplay))}" target="_blank" rel="noopener"><small>Disponible en</small><b>Google Play</b></a>` : ""}
      <button class="store" type="button" data-play style="border:0;cursor:pointer;text-align:left"><small>Escucha ya</small><b>Web Player</b></button>
    </div></div>
  <div class="band-side">
    ${safeUrl(a.image) ? `<div class="band-media"><img src="${esc(safeUrl(a.image))}" alt="" loading="lazy"></div>` : ""}
    <div class="socials">${SOC.map(([k, n]) => `<a class="social" href="${esc(safeUrl(so[k]))}" target="_blank" rel="noopener"><b>${n}</b><span>Síguenos</span></a>`).join("")}</div>
  </div>
</div></section>`;
  }

  if (S.events && (C.events || []).length) html += `
<section class="sec" id="eventos"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Agenda</p><h2>Próximos eventos</h2></div><p>Conciertos, fiestas y activaciones donde nos vemos en persona.</p></div>
  <div class="events">${C.events.map((e, i) => {
    const d = e.date ? new Date(e.date + "T12:00:00") : null;
    const badge = d && !isNaN(d) ? `<div class="ev-date"><b>${pad(d.getDate())}</b><span>${MONTHS[d.getMonth()]}</span></div>` : "";
    return `<article class="event">${art(i + 6, e.image, e.image ? "" : e.title, "", badge)}
      <div class="ev-body"><h3>${esc(e.title)}</h3><span class="place">${esc(e.place)}</span>
      ${safeUrl(e.link) ? `<a class="btn btn-amber" href="${esc(safeUrl(e.link))}" target="_blank" rel="noopener">Comprar entradas</a>` : ""}</div></article>`;
  }).join("")}</div>
</div></section>`;

  if (S.news) html += `
<section class="sec" id="noticias"><div class="wrap">
  <div class="sec-head"><div><p class="eyebrow">Noticias</p><h2>Lo que se mueve en la música</h2></div></div>
  <div class="news">${(C.news || []).map((n, i) => {
    const d = n.date ? new Date(n.date + "T12:00:00") : null;
    const ds = d && !isNaN(d) ? `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()}` : "";
    const u = safeUrl(n.url);
    return `<a class="news-card" ${u ? `href="${esc(u)}" target="_blank" rel="noopener"` : `href="#noticias"`}>${art(i + 4, n.image, n.image ? "" : n.category)}
      <span class="cat">${esc(n.category)}</span><h3>${esc(n.title)}</h3><time>${ds}</time></a>`;
  }).join("")}</div>
</div></section>`;

  if (S.sponsors && (C.sponsors || []).length) html += `
<section class="sec" style="padding-block:56px"><div class="wrap">
  <p class="eyebrow" style="justify-content:center;margin-bottom:22px">Marcas aliadas</p>
  <div class="sponsors">${C.sponsors.map((s) => {
    const u = safeUrl(s.link), l = safeUrl(s.logo);
    const inner = l ? `<img src="${esc(l)}" alt="${esc(s.name)}" loading="lazy">` : esc(s.name);
    return u ? `<a class="sponsor" href="${esc(u)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="sponsor">${inner}</div>`;
  }).join("")}</div>
</div></section>`;

  if (S.ads) {
    const a = C.ads || {};
    const wa = waLink("Hola, quiero información de pauta en " + name);
    html += `
<section class="sec" id="pauta" style="background:var(--surface);border-block:1px solid var(--line)"><div class="wrap ads">
  <div><p class="eyebrow">Pauta publicitaria</p>
    <h2 style="font-size:clamp(28px,4.4vw,48px);margin-top:12px">${esc(a.title)}</h2>
    <ul>${(a.bullets || []).map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul>
    ${wa ? `<a class="btn btn-amber" href="${esc(wa)}" target="_blank" rel="noopener">${esc(a.ctaText || "Contáctanos")}</a>` : ""}</div>
  <div><div class="ads-stats">${(a.stats || []).map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>
  ${a.note ? `<p class="note">${esc(a.note)}</p>` : ""}</div>
</div></section>`;
  }

  $("#app").innerHTML = html;
  renderFooter();
  if (S.schedule) { renderDays(); renderSchedule(); }
  renderBanners();
  setPlaying(playing);
  clock();
  sizeCanvases();
}

function waLink(text) {
  const n = String(C.contact?.whatsapp || "").replace(/\D/g, "");
  if (n) return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  return safeUrl(C.social?.whatsapp);
}

function renderFooter() {
  const so = C.social || {}, co = C.contact || {};
  const SOC = [["instagram","Instagram"],["tiktok","TikTok"],["youtube","YouTube"],["facebook","Facebook"],["spotify","Spotify"],["whatsapp","WhatsApp"],["x","X"]].filter(([k]) => safeUrl(so[k]));
  $("#footer").innerHTML = `<div class="wrap"><div class="foot">
    <div><img src="${esc(safeUrl(C.brand?.logo) || "/assets/logo-dark.png")}" alt="${esc(C.brand?.name)}"><p>${esc(C.brand?.slogan)}</p></div>
    <div><h4>Emisora</h4><ul>${$$("#navLinks a").map((a) => `<li><a href="${a.getAttribute("href")}">${a.textContent}</a></li>`).join("")}</ul></div>
    <div><h4>Síguenos</h4><ul>${SOC.map(([k, n]) => `<li><a href="${esc(safeUrl(so[k]))}" target="_blank" rel="noopener">${n}</a></li>`).join("")}</ul></div>
    <div><h4>Contacto</h4>
      ${co.whatsapp ? `<p class="contact-line">WhatsApp: <b>${esc(co.whatsapp)}</b></p>` : ""}
      ${co.phone ? `<p class="contact-line">Teléfono: <b>${esc(co.phone)}</b></p>` : ""}
      ${co.email ? `<p class="contact-line">Correo: <b>${esc(co.email)}</b></p>` : ""}
      ${co.address ? `<p class="contact-line">${esc(co.address)}</p>` : ""}
      <form class="newsletter" id="newsForm" style="margin-top:16px">
        <label for="newsEmail" style="position:absolute;left:-9999px">Correo electrónico</label>
        <input id="newsEmail" type="email" placeholder="tu@correo.com" required>
        <button class="btn btn-amber" type="submit">Suscribirme</button>
      </form></div>
  </div><div class="copy"><span>${esc(C.footer?.copyright)}</span><span>${esc(C.footer?.tagline)}</span></div></div>`;
}

function renderDays() {
  const today = new Date().getDay();
  $("#days").innerHTML = [1,2,3,4,5,6,0].map((d) => `<button type="button" aria-pressed="${d === selDay}" data-day="${d}">${d === today ? "Hoy" : WEEK[d]}</button>`).join("");
}
function renderSchedule() {
  const today = new Date().getDay();
  const list = (C.schedule || []).map((s, i) => ({ ...s, i }))
    .filter((s) => (Array.isArray(s.days) && s.days.length ? s.days : [0,1,2,3,4,5,6]).includes(selDay))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
  if (!list.length) { $("#schedule").innerHTML = `<p class="empty">No hay programas cargados para este día.</p>`; return; }
  $("#schedule").innerHTML = list.map((x) => {
    const on = selDay === today && onAirNow(x);
    const [a, b] = PALETTES[x.i % PALETTES.length];
    return `<article class="show${on ? " on" : ""}"${on ? ' data-on' : ""}>${art(x.i, x.image, x.image ? "" : x.name)}
      <div class="show-body"><div class="time"><span>${esc(x.start)} – ${esc(x.end)}</span>${on ? '<span class="badge-on">AL AIRE</span>' : ""}</div>
      <h3>${esc(x.name)}</h3><p style="color:var(--muted);font-size:14px">${esc(x.description)}</p>
      <div class="host"><span class="avatar" style="background:linear-gradient(135deg,${a},${b})">${esc(initials(x.host))}</span>${esc(x.host)}</div></div></article>`;
  }).join("");
  const on = $("#schedule [data-on]");
  if (on) $("#schedule").scrollLeft = on.offsetLeft - $("#schedule").offsetLeft;
}

let bannerIdx = 0, bannerTimer;
function renderBanners() {
  const slot = $("#bannerSlot"); clearInterval(bannerTimer);
  if (!slot) return;
  const list = C.banners || [];
  const draw = () => {
    const b = list[bannerIdx % list.length], img = safeUrl(b.image), u = safeUrl(b.link);
    const inner = `<span class="adtag">PUBLICIDAD</span>${img ? `<img src="${esc(img)}" alt="${esc(b.alt || "")}">` : `<div class="ph"><b>Tu marca aquí</b><span>Banner 1600 × 400 px · Anúnciate en ${esc(C.brand?.name)}</span></div>`}`;
    slot.innerHTML = (u ? `<a class="banner" href="${esc(u)}" target="_blank" rel="noopener sponsored">${inner}</a>` : `<a class="banner" href="#pauta">${inner}</a>`)
      + (list.length > 1 ? `<div class="banner-dots">${list.map((_, i) => `<button type="button" aria-label="Banner ${i + 1}" aria-current="${i === bannerIdx % list.length}" data-banner="${i}"></button>`).join("")}</div>` : "");
  };
  draw();
  if (list.length > 1) bannerTimer = setInterval(() => { bannerIdx++; draw(); }, 7000);
  slot.onclick = (e) => { const d = e.target.closest("[data-banner]"); if (d) { bannerIdx = +d.dataset.banner; draw(); } };
}

function currentTrack() {
  if (liveMeta?.title) return liveMeta;
  return { title: C.nowPlaying?.title || C.brand?.name, artist: C.nowPlaying?.artist || "", cover: C.nowPlaying?.cover || "" };
}

/* ================= INTERACCIÓN ================= */
let tt;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 3400); }

function openVideo(url) {
  const v = parseVideo(url);
  if (!v) { toast("Este video aún no tiene link. Agrégalo desde el panel."); return; }
  if (v.type === "link") { window.open(v.url, "_blank", "noopener"); return; }
  if (playing) { audio.pause(); setPlaying(false); }
  $("#lbInner").innerHTML = v.type === "file"
    ? `<video src="${esc(v.src)}" controls autoplay playsinline></video>`
    : `<iframe src="${esc(v.embed)}" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  $("#lightbox").hidden = false;
  $("#lbClose").focus();
}
function closeVideo() { $("#lightbox").hidden = true; $("#lbInner").innerHTML = ""; }
$("#lbClose").addEventListener("click", closeVideo);
$("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeVideo(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#lightbox").hidden) closeVideo(); });

const audio = new Audio(); audio.preload = "none";
let playing = false;
$("#vol").addEventListener("input", (e) => (audio.volume = +e.target.value));
function setPlaying(p) {
  playing = p; document.body.classList.toggle("playing", p);
  $$(".p-btn,.play-big").forEach((b) => { b.innerHTML = ic(24, p); b.setAttribute("aria-label", p ? "Pausar" : "Reproducir en vivo"); });
  const t = currentTrack(), cur = (C?.schedule || []).find((s) => onAirNow(s));
  $("#pTitle").textContent = p ? `${t.title}${t.artist ? " · " + t.artist : ""}` : `${C?.brand?.name || ""} · En vivo`;
  $("#pSub").textContent = p ? `En vivo ahora${cur ? " · " + cur.name : ""}` : "Toca play para escuchar la señal";
  $("#pArt").innerHTML = safeUrl(t.cover) ? `<img src="${esc(safeUrl(t.cover))}" alt="">` : "";
}

document.addEventListener("click", (e) => {
  const play = e.target.closest("[data-play]");
  if (play) {
    if (playing) { audio.pause(); setPlaying(false); return; }
    const url = safeUrl(C.stream?.url);
    if (url) {
      audio.src = url;
      audio.play().then(() => setPlaying(true)).catch(() => toast("No pudimos conectar la señal. Intenta de nuevo en un momento."));
    } else { setPlaying(true); toast("Modo demostración: falta agregar el link de la señal en vivo en el panel."); }
    return;
  }
  const vid = e.target.closest("[data-video]");
  if (vid) { openVideo(vid.dataset.video); return; }
  const day = e.target.closest("[data-day]");
  if (day) { selDay = +day.dataset.day; renderDays(); renderSchedule(); return; }
  if (e.target.closest("[data-noaudio]")) { toast("Agrega el link de Spotify o YouTube de esta canción en el panel."); return; }
  if (e.target.closest("#navLinks a")) { $("#navLinks").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false"); }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "newsForm") { e.preventDefault(); toast("Listo, quedaste suscrito al boletín."); e.target.reset(); }
});
$("#menuBtn").addEventListener("click", () => { const o = $("#navLinks").classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", o); });

function clock() { const c = $("#clock"); if (c) { const d = new Date(); c.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()); } }
setInterval(clock, 15000);

/* Metadatos de "sonando ahora" (AzuraCast, Icecast, Radio.co o JSON {title, artist, art}) */
async function pollMeta() {
  const u = safeUrl(C?.stream?.nowPlayingUrl);
  if (!u) return;
  try {
    const d = await (await fetch(u, { cache: "no-store" })).json();
    const x = Array.isArray(d) ? d[0] : d;
    let title, artist, cover;
    if (x?.now_playing?.song) ({ title, artist, art: cover } = x.now_playing.song);
    else if (x?.icestats) { const src = [].concat(x.icestats.source)[0] || {}; [artist, title] = String(src.title || "").split(" - "); if (!title) { title = artist; artist = ""; } }
    else if (x?.current_track) { [artist, title] = String(x.current_track.title || "").split(" - "); cover = x.current_track.artwork_url_large; }
    else { title = x?.title || x?.song; artist = x?.artist; cover = x?.art || x?.cover || x?.artwork; }
    if (title && title !== liveMeta?.title) {
      liveMeta = { title, artist: artist || "", cover: cover || "" };
      const t = $("#npTitle"), a = $("#npArtist");
      if (t) t.textContent = title; if (a) a.textContent = artist || "";
      const cov = $(".np-cover");
      if (cov && cover) { cov.querySelector("img")?.remove(); cov.querySelector(".art-k")?.remove(); cov.insertAdjacentHTML("afterbegin", `<img src="${esc(safeUrl(cover))}" alt="">`); }
      setPlaying(playing);
    }
  } catch { /* el servidor del stream no permite leer los datos: se queda lo configurado */ }
}
setInterval(pollMeta, 20000);

/* Ondas del fondo y ecualizador */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let viz, wv;
function sizeCanvases() {
  wv = $("#waves");
  const cover = $(".np-cover");
  if (cover && !cover.querySelector("canvas")) cover.insertAdjacentHTML("beforeend", '<canvas id="viz" aria-hidden="true"></canvas>');
  viz = $("#viz");
  [wv, viz].forEach((c) => { if (!c) return; const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); c.width = r.width * dpr; c.height = r.height * dpr; c.dpr = dpr; });
}
addEventListener("resize", sizeCanvases);
function frame(t) {
  if (viz?.isConnected) {
    const vx = viz.getContext("2d"), W = viz.width, H = viz.height, N = 32, bw = W / N; vx.clearRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      const amp = playing ? .35 + .65 * Math.abs(Math.sin(t / 260 + i * .7) * Math.cos(t / 410 + i * .3)) : .08 + .04 * Math.sin(t / 900 + i);
      vx.fillStyle = "rgba(255,255,255,.85)"; vx.fillRect(i * bw + bw * .2, H - amp * H, bw * .6, amp * H);
    }
  }
  if (wv?.isConnected) {
    const wx = wv.getContext("2d"), w = wv.width, h = wv.height, d = wv.dpr || 1, sp = playing ? 1 : .4;
    const cs = getComputedStyle(document.documentElement);
    wx.clearRect(0, 0, w, h); wx.lineWidth = 3 * d;
    [[cs.getPropertyValue("--blue").trim() || "#3d5bff", 0], [cs.getPropertyValue("--amber").trim() || "#ffa914", 1]].forEach(([col, k]) => {
      wx.strokeStyle = col;
      for (let s = 0; s < 3; s++) {
        wx.globalAlpha = .55 - s * .12; wx.beginPath();
        const base = h * (k ? .8 : .66) + s * 10 * d;
        for (let x = 0; x <= w; x += 8 * d) {
          const y = base + Math.sin(x / (170 * d) + t / 1600 * sp + k * 2) * (playing ? 46 : 28) * d + Math.sin(x / (70 * d) + t / 900 * sp) * 8 * d;
          x ? wx.lineTo(x, y) : wx.moveTo(x, y);
        }
        wx.stroke();
      }
    });
    wx.globalAlpha = 1;
  }
  if (!reduce) requestAnimationFrame(frame);
}

/* ================= ARRANQUE ================= */
async function boot() {
  let def = {};
  try { def = await (await fetch("/config.default.json", { cache: "no-store" })).json(); } catch {}
  let saved = null;
  try { const r = await fetch("/api/config"); if (r.ok) saved = (await r.json()).config; } catch {}
  C = deepMerge(def, saved || {});
  const preview = new URLSearchParams(location.search).has("preview");
  if (preview) {
    try { const d = JSON.parse(localStorage.getItem("kmusic-draft") || "null"); if (d) C = deepMerge(def, d); } catch {}
    document.body.insertAdjacentHTML("beforeend", '<div class="preview-flag">VISTA PREVIA · sin publicar</div>');
    addEventListener("message", (e) => {
      if (e.origin !== location.origin || e.data?.type !== "kmusic-config") return;
      const y = scrollY; C = deepMerge(def, e.data.config); render(); scrollTo(0, y);
      if (e.data.scrollTo) document.getElementById(e.data.scrollTo)?.scrollIntoView({ behavior: "smooth" });
    });
    parent !== window && parent.postMessage({ type: "kmusic-ready" }, location.origin);
  }
  render();
  pollMeta();
  requestAnimationFrame(frame);
}
boot();
})();

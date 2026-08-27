// ================= Datos =================
const ICONS = [
  { id: "social", cls: "iconoir-community", label: "Redes" },
  { id: "movie", cls: "iconoir-movie", label: "Películas" },
  { id: "gamepad", cls: "iconoir-gamepad", label: "Juegos" },
  { id: "bank", cls: "iconoir-bank", label: "Banco" },
  { id: "card", cls: "iconoir-credit-card", label: "Tarjeta" },
  { id: "dollar", cls: "iconoir-dollar", label: "Dinero" },
  { id: "systems", cls: "iconoir-globe", label: "Sistemas" },
  { id: "mail", cls: "iconoir-mail", label: "Correo" },
  { id: "work", cls: "iconoir-suitcase", label: "Trabajo" },
  { id: "home", cls: "iconoir-home-simple", label: "Casa" },
  { id: "wifi", cls: "iconoir-wifi", label: "WiFi" },
  { id: "phone", cls: "iconoir-smartphone-device", label: "Celular" },
  { id: "laptop", cls: "iconoir-laptop", label: "PC" },
  { id: "shopping", cls: "iconoir-shopping-bag", label: "Compras" },
  { id: "heart", cls: "iconoir-heart", label: "Salud" },
];

const iconClass = (id) => (ICONS.find((i) => i.id === id) || ICONS[0]).cls;

const refItem = (id) => items.find((i) => i.id === id);
const itemUser = (it) => {
  if (!it.special) return it.user;
  return it.userRef ? refItem(it.userRef)?.user ?? it.userVal ?? "—" : it.userVal ?? "—";
};
const itemPass = (it) => {
  if (!it.special) return it.pass || "";
  return it.passRef ? refItem(it.passRef)?.pass ?? it.passVal ?? "" : it.passVal ?? "";
};
const itemIconCls = (it) => (it.special ? "iconoir-sparks" : iconClass(it.icon));

const STORE_KEY = "onepass.items";
let items = load();
let editingId = null;

// Guardia de sesión: sin usuario logueado, volvemos al login.
const sessionUser = DB.currentUser();
if (!sessionUser) {
  window.location.replace("../index.html");
}

function load() {
  const u = DB.currentUser();
  return u && Array.isArray(u.items) ? u.items : [];
}
function persist() {
  DB.saveItems(items);
}

// ================= Helpers DOM =================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ================= Carrusel =================
const carousel = $("#carousel");
const countBadge = $("#countBadge");
let searchQuery = "";

function renderCards() {
  countBadge.textContent =
    items.length === 1 ? "1 contraseña" : `${items.length} contraseñas`;
  const savedWord = $("#savedWord");
  if (savedWord) savedWord.textContent = items.length === 1 ? "guardada" : "guardadas";

  if (!items.length) {
    carousel.innerHTML = `
      <div class="card-empty">
        <i class="iconoir-lock"></i>
        <b>Aún no tienes contraseñas</b>
        <p>Pulsa "Nueva contraseña" para guardar la primera.</p>
      </div>`;
    return;
  }

  const q = searchQuery.trim().toLowerCase();
  const visible = q
    ? items.filter(
        (it) =>
          (it.title || "").toLowerCase().includes(q) ||
          (itemUser(it) || "").toLowerCase().includes(q)
      )
    : items;

  if (!visible.length) {
    carousel.innerHTML = `
      <div class="card-empty">
        <i class="iconoir-search"></i>
        <b>Sin resultados</b>
        <p>No hay contraseñas que coincidan con "${escapeHtml(searchQuery.trim())}".</p>
      </div>`;
    return;
  }

  carousel.innerHTML = visible
    .map(
      (it) => `
      <article class="pw-card" data-id="${it.id}">
        ${it.special ? `<span class="c-tag"><i class="iconoir-sparks"></i> Especial</span>` : ""}
        <div class="c-icon"><i class="${itemIconCls(it)}"></i></div>
        <h3>${escapeHtml(it.title)}</h3>
        <div class="c-user"><i class="iconoir-user"></i> ${escapeHtml(itemUser(it) || "—")}</div>
        <div class="c-pass"><i class="iconoir-lock"></i> ••••••••</div>
      </article>`
    )
    .join("");
}

carousel.addEventListener("click", (e) => {
  const card = e.target.closest(".pw-card");
  if (card) openDetail(card.dataset.id);
});

// ================= Búsqueda de cards =================
const searchInput = $("#searchInput");
const searchClear = $("#searchClear");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    if (searchClear) searchClear.hidden = !searchQuery;
    renderCards();
  });
}
if (searchClear) {
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    searchClear.hidden = true;
    searchInput.focus();
    renderCards();
  });
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ================= Modal crear =================
const createOverlay = $("#createOverlay");
const stepsBar = $("#stepsBar");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const finalActions = $("#finalActions");
const TOTAL_STEPS = 5;
let step = 1;

const form = {
  title: $("#fTitle"),
  icon: null,
  user: $("#fUser"),
  pass: $("#fPass"),
  note: $("#fNote"),
};

// grid de iconos
const iconGrid = $("#iconGrid");
iconGrid.innerHTML = ICONS.map(
  (i) => `<button type="button" class="icon-cell" data-icon="${i.id}" title="${i.label}">
      <i class="${i.cls}"></i>
    </button>`
).join("");

iconGrid.addEventListener("click", (e) => {
  const cell = e.target.closest(".icon-cell");
  if (!cell) return;
  $$(".icon-cell").forEach((c) => c.classList.remove("selected"));
  cell.classList.add("selected");
  form.icon = cell.dataset.icon;
});

function resetForm() {
  form.title.value = "";
  form.user.value = "";
  form.pass.value = "";
  form.pass.type = "password";
  form.note.value = "";
  form.icon = null;
  $$(".icon-cell").forEach((c) => c.classList.remove("selected"));
  $("#togglePass i").className = "iconoir-eye";
  $$("#createOverlay .field-msg").forEach((m) => m.classList.remove("show"));
  editingId = null;
}

function openCreate() {
  resetForm();
  step = 1;
  showStep();
  openOverlay(createOverlay);
  setTimeout(() => form.title.focus(), 350);
}

function showStep() {
  $$(".pane").forEach((p) => {
    p.hidden = Number(p.dataset.pane) !== step;
  });

  // timeline
  $$(".step-node").forEach((n) => {
    const s = Number(n.dataset.step);
    n.classList.toggle("active", s === step);
    n.classList.toggle("done", s < step);
  });

  const isFinal = step === TOTAL_STEPS;
  prevBtn.hidden = step === 1 || isFinal;
  nextBtn.hidden = isFinal;
  finalActions.hidden = !isFinal;
}

function validateStep() {
  if (step === 1 && !form.title.value.trim()) {
    flash(form.title.closest(".g-field"));
    return false;
  }
  if (step === 2 && !form.icon) {
    iconGrid.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 250 }
    );
    return false;
  }
  if (step === 3 && (!form.user.value.trim() || !form.pass.value.trim())) {
    if (!form.user.value.trim()) flash(form.user.closest(".g-field"));
    if (!form.pass.value.trim()) flash(form.pass.closest(".g-field"));
    return false;
  }
  return true;
}

function flash(el) {
  if (!el) return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-7px)" },
      { transform: "translateX(7px)" },
      { transform: "translateX(-5px)" },
      { transform: "translateX(5px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 300, easing: "ease" }
  );
  let msg = el.querySelector(".field-msg");
  if (!msg) {
    msg = document.createElement("small");
    msg.className = "field-msg";
    msg.innerHTML =
      '<i class="iconoir-warning-triangle"></i> Completa este campo obligatorio';
    el.appendChild(msg);
  }
  msg.classList.add("show");
}

// Oculta el aviso de campo obligatorio cuando el usuario empieza a escribir.
createOverlay.addEventListener("input", (e) => {
  const msg = e.target.closest(".g-field")?.querySelector(".field-msg");
  if (msg) msg.classList.remove("show");
});

nextBtn.addEventListener("click", () => {
  if (!validateStep()) return;
  if (step < TOTAL_STEPS) {
    step++;
    showStep();
  }
});

prevBtn.addEventListener("click", () => {
  if (step > 1) {
    step--;
    showStep();
  }
});

// mostrar/ocultar contraseña
$("#togglePass").addEventListener("click", () => {
  const isPass = form.pass.type === "password";
  form.pass.type = isPass ? "text" : "password";
  $("#togglePass i").className = isPass ? "iconoir-eye-closed" : "iconoir-eye";
});

// Guardar
$("#saveBtn").addEventListener("click", () => {
  saveItem();
  closeOverlay(createOverlay);
});

// Descargar (abre vista previa)
$("#downloadBtn").addEventListener("click", () => openPreview(currentData()));

$("#openCreate").addEventListener("click", openCreate);
$("#closeCreate").addEventListener("click", () => closeOverlay(createOverlay));

function currentData() {
  return {
    title: form.title.value.trim(),
    icon: form.icon || "home",
    user: form.user.value.trim(),
    pass: form.pass.value,
    note: form.note.value.trim(),
  };
}

function saveItem() {
  const data = currentData();
  if (!data.title) return;
  if (editingId) {
    const idx = items.findIndex((i) => i.id === editingId);
    if (idx > -1) items[idx] = { ...items[idx], ...data };
  } else {
    items.unshift({ id: Date.now().toString(36), ...data });
  }
  persist();
  renderCards();
}

// ================= Reporte / descarga =================
const previewOverlay = $("#previewOverlay");
const reportCard = $("#reportCard");

// SVG inline por icono (html2canvas no renderiza la fuente de iconos externa).
const svgWrap = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const REPORT_SVGS = {
  gamepad: '<rect x="3.5" y="8.5" width="17" height="9" rx="4.5"/><path d="M7.5 11.5v3M6 13h3"/><circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none"/><circle cx="17.5" cy="14" r="0.9" fill="currentColor" stroke="none"/>',
  dollar: '<path d="M12 3.5v17"/><path d="M15.5 7c-.7-1.1-2-1.7-3.5-1.7-2 0-3.6 1-3.6 2.7 0 3.7 7.2 1.9 7.2 5.7 0 1.8-1.7 2.9-3.6 2.9-1.6 0-3-.7-3.6-1.9"/>',
  bank: '<path d="M4 9.5l8-5 8 5"/><path d="M5.5 10v7.5M9.5 10v7.5M14.5 10v7.5M18.5 10v7.5"/><path d="M3.5 20.5h17"/>',
  home: '<path d="M4 10.5L12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.4"/><circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" stroke="none"/>',
  shopping: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8.5V6.8a3 3 0 0 1 6 0V8.5"/>',
  wifi: '<path d="M4 9c4.5-3.4 11.5-3.4 16 0"/><path d="M7 12.4c3-2.2 7-2.2 10 0"/><path d="M10 15.8c1.2-.9 2.8-.9 4 0"/><circle cx="12" cy="18.6" r="0.9" fill="currentColor" stroke="none"/>',
  car: '<path d="M5 16v-3l1.8-4.2A2 2 0 0 1 8.7 7.5h6.6a2 2 0 0 1 1.9 1.3L19 13v3"/><path d="M4 16h16"/><circle cx="8" cy="16.5" r="1.4"/><circle cx="16" cy="16.5" r="1.4"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.2C5 8.1 6.8 6.5 9 6.5c1.4 0 2.6.7 3 1.8.4-1.1 1.6-1.8 3-1.8 2.2 0 4 1.6 4 4.3C19 15.6 12 20 12 20z"/>',
  work: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8"/><path d="M4 12.5h16"/>',
  laptop: '<rect x="5" y="6" width="14" height="9" rx="1.5"/><path d="M3 18h18"/>',
  social: '<circle cx="9" cy="9" r="2.6"/><path d="M4 18c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6"/><circle cx="16.5" cy="10" r="2.1"/><path d="M14.8 14.3c2.5-.2 4.7 1.4 4.7 3.9"/>',
  movie: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="6.4" r="1.1"/><circle cx="12" cy="17.6" r="1.1"/><circle cx="6.4" cy="12" r="1.1"/><circle cx="17.6" cy="12" r="1.1"/>',
  card: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 10h17"/><path d="M6.5 14.5h4"/>',
  systems: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4"/><path d="M12 3.8c2.3 2.2 3.5 5.1 3.5 8.2S14.3 18 12 20.2C9.7 18 8.5 15.1 8.5 12S9.7 6 12 3.8z"/>',
  phone: '<rect x="7" y="3.5" width="10" height="17" rx="2.6"/><path d="M10.5 17.6h3"/>',
  sparks: '<path d="M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4L12 4z"/><path d="M18 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/>',
};

function reportSvg(iconId) {
  return svgWrap(REPORT_SVGS[iconId] || REPORT_SVGS.home);
}

function fillReport(data) {
  const a = ACCENTS[currentAccent] || ACCENTS.blue;
  reportCard.style.setProperty("--rc", a.main);
  reportCard.style.setProperty("--rc-2", a.d2);
  reportCard.style.setProperty("--rc-soft", hexToRgba(a.main, 0.14));
  $("#rIcon").innerHTML = reportSvg(data.icon);
  $("#rTitle").textContent = data.title || "Sin título";
  $("#rUser").textContent = data.user || "—";
  $("#rPass").textContent = data.pass || "—";
  $("#rNote").textContent = data.note || "Sin detalle.";
  const now = new Date();
  $("#rDate").textContent = `${now.toLocaleDateString("es-ES")} · ${now.toLocaleTimeString(
    "es-ES",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
}

// Datos del reporte que se está previsualizando (form o item de una card).
let previewData = null;

function reportDataFromItem(it) {
  let note = it.note || "";
  if (it.special) {
    const uSrc = it.userRef ? `“${refItem(it.userRef)?.title || "?"}”` : "un valor escrito";
    const pSrc = it.passRef ? `“${refItem(it.passRef)?.title || "?"}”` : "un valor escrito";
    note = `Usuario desde ${uSrc} y contraseña desde ${pSrc}.\n\n${it.note || ""}`.trim();
  }
  return {
    title: it.title,
    icon: it.special ? "sparks" : it.icon,
    user: itemUser(it),
    pass: itemPass(it),
    note,
  };
}

function openPreview(data) {
  previewData = data || currentData();
  fillReport(previewData);
  openOverlay(previewOverlay);
}

function reportFilename(ext) {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `OnePass_${slug((previewData || currentData()).title)}_${stamp}.${ext}`;
}

async function renderReportCanvas() {
  // html2canvas necesita tamaño y color explícitos en cada SVG (no resuelve
  // currentColor ni el tamaño por CSS al rasterizar).
  const meta = [...reportCard.querySelectorAll("svg")].map((s) => {
    const r = s.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), color: getComputedStyle(s).color };
  });
  return html2canvas(reportCard, {
    scale: 2,
    backgroundColor: null,
    useCORS: true,
    onclone: (doc) => {
      const svgs = [...doc.getElementById("reportCard").querySelectorAll("svg")];
      svgs.forEach((s, i) => {
        const m = meta[i];
        if (!m) return;
        s.setAttribute("width", m.w);
        s.setAttribute("height", m.h);
        s.setAttribute("stroke", m.color);
        s.style.width = m.w + "px";
        s.style.height = m.h + "px";
        s.style.color = m.color;
      });
    },
  });
}

// Deshabilita el botón mientras se genera el archivo.
async function withBusy(btn, fn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.style.opacity = "0.7";
  try {
    await fn();
  } catch (e) {
    toast("No se pudo generar el archivo.");
  } finally {
    btn.disabled = false;
    btn.style.opacity = "";
    btn.innerHTML = original;
  }
}

$("#dlImage").addEventListener("click", (e) =>
  withBusy(e.currentTarget, async () => {
    const canvas = await renderReportCanvas();
    const link = document.createElement("a");
    link.download = reportFilename("png");
    link.href = canvas.toDataURL("image/png");
    link.click();
  })
);

$("#dlPdf").addEventListener("click", (e) =>
  withBusy(e.currentTarget, async () => {
    const canvas = await renderReportCanvas();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    // Ajusta a la página conservando la proporción (que no se corte abajo).
    let w = maxW;
    let h = (w * canvas.height) / canvas.width;
    if (h > maxH) {
      h = maxH;
      w = (h * canvas.width) / canvas.height;
    }
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, w, h);
    pdf.save(reportFilename("pdf"));
  })
);

$("#closePreview").addEventListener("click", () => closeOverlay(previewOverlay));

const pad = (n) => String(n).padStart(2, "0");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "contrasena";

// ================= Modal detalle =================
const detailOverlay = $("#detailOverlay");
let currentDetailId = null;

function openDetail(id) {
  const it = items.find((i) => i.id === id);
  if (!it) return;
  currentDetailId = id;
  $("#dIcon").innerHTML = `<i class="${itemIconCls(it)}"></i>`;
  $("#dTitle").textContent = it.title;
  $("#dUser").textContent = itemUser(it) || "—";
  const passEl = $("#dPass");
  passEl.textContent = "••••••••";
  passEl.dataset.real = itemPass(it) || "";
  passEl.dataset.shown = "0";
  $("#dToggle i").className = "iconoir-eye";
  let note = it.note || "Sin detalle.";
  if (it.special) {
    const uSrc = it.userRef ? `“${refItem(it.userRef)?.title || "?"}”` : "un valor escrito";
    const pSrc = it.passRef ? `“${refItem(it.passRef)?.title || "?"}”` : "un valor escrito";
    note = `Usuario desde ${uSrc} y contraseña desde ${pSrc}.\n\n${it.note || ""}`.trim();
  }
  $("#dNote").textContent = note;
  openOverlay(detailOverlay);
}

$("#dToggle").addEventListener("click", () => {
  const el = $("#dPass");
  const shown = el.dataset.shown === "1";
  el.textContent = shown ? "••••••••" : el.dataset.real || "—";
  el.dataset.shown = shown ? "0" : "1";
  $("#dToggle i").className = shown ? "iconoir-eye" : "iconoir-eye-closed";
});

$("#closeDetail").addEventListener("click", () => closeOverlay(detailOverlay));

$("#detailDownloadBtn").addEventListener("click", () => {
  const it = items.find((i) => i.id === currentDetailId);
  if (it) openPreview(reportDataFromItem(it));
});

const confirmOverlay = $("#confirmOverlay");
$("#deleteBtn").addEventListener("click", () => {
  if (!currentDetailId) return;
  openOverlay(confirmOverlay);
});
$("#confirmCancel").addEventListener("click", () => closeOverlay(confirmOverlay));
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeOverlay(confirmOverlay);
});
$("#confirmDelete").addEventListener("click", () => {
  if (!currentDetailId) return;
  items = items.filter((i) => i.id !== currentDetailId);
  persist();
  renderCards();
  closeOverlay(confirmOverlay);
  closeOverlay(detailOverlay);
});

$("#editBtn").addEventListener("click", () => {
  const it = items.find((i) => i.id === currentDetailId);
  if (!it) return;
  closeOverlay(detailOverlay);
  if (it.special) {
    setTimeout(() => openSpecial(it.id), 250);
    return;
  }
  setTimeout(() => {
    resetForm();
    editingId = it.id;
    form.title.value = it.title;
    form.user.value = it.user;
    form.pass.value = it.pass;
    form.note.value = it.note;
    form.icon = it.icon;
    $$(".icon-cell").forEach((c) =>
      c.classList.toggle("selected", c.dataset.icon === it.icon)
    );
    step = 1;
    showStep();
    openOverlay(createOverlay);
  }, 250);
});

// ================= Overlay util =================
function openOverlay(ov) {
  ov.classList.add("open");
  ov.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeOverlay(ov) {
  ov.classList.remove("open");
  ov.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

const specialOverlay = $("#specialOverlay");
[createOverlay, detailOverlay, specialOverlay, previewOverlay, $("#manageOverlay")].forEach((ov) => {
  ov.addEventListener("click", (e) => {
    if (e.target === ov) closeOverlay(ov);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeOverlay(createOverlay);
    closeOverlay(detailOverlay);
    closeOverlay(specialOverlay);
    closeOverlay(previewOverlay);
    closeOverlay($("#confirmOverlay"));
    closeOverlay($("#manageOverlay"));
    closeMenu();
  }
});

// ================= Menú de usuario (avatar) =================
const avatarBtn = $("#avatarBtn");
const avatarMenu = $("#avatarMenu");

function openMenu() {
  avatarMenu.hidden = false;
  avatarBtn.setAttribute("aria-expanded", "true");
}
function closeMenu() {
  avatarMenu.hidden = true;
  avatarBtn.setAttribute("aria-expanded", "false");
}

avatarBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  avatarMenu.hidden ? openMenu() : closeMenu();
});

document.addEventListener("click", (e) => {
  if (!avatarMenu.hidden && !e.target.closest(".avatar-wrap")) closeMenu();
});

function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

// Exporta todas las contraseñas del usuario a un archivo .json descargable.
function exportData() {
  const payload = {
    app: "OnePass",
    version: 1,
    exportedAt: new Date().toISOString(),
    user: sessionUser ? sessionUser.username : "",
    count: items.length,
    items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `onepass-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const importFile = $("#importFile");

$("#importBtn").addEventListener("click", () => {
  closeMenu();
  importFile.click();
});

importFile.addEventListener("change", async () => {
  const file = importFile.files && importFile.files[0];
  importFile.value = ""; // permite volver a elegir el mismo archivo
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(incoming)) {
      toast("El archivo no tiene el formato correcto.");
      return;
    }
    // Conservamos los id originales para no romper las contraseñas especiales
    // (que referencian a otras por id) y evitar duplicados al reimportar.
    const existingIds = new Set(items.map((i) => i.id));
    let added = 0;
    incoming.forEach((raw) => {
      if (!raw || typeof raw !== "object" || !raw.id || !raw.title) return;
      if (existingIds.has(raw.id)) return;
      existingIds.add(raw.id);
      items.unshift(raw);
      added++;
    });
    persist();
    renderCards();
    toast(
      added
        ? `Se importaron ${added} contraseña${added === 1 ? "" : "s"}.`
        : "No había contraseñas nuevas para importar."
    );
  } catch {
    toast("No se pudo leer el archivo.");
  }
});

$("#exportBtn").addEventListener("click", () => {
  closeMenu();
  if (!items.length) {
    toast("Aún no tienes contraseñas para exportar.");
    return;
  }
  exportData();
  toast("Copia de seguridad descargada.");
});
$("#manageBtn").addEventListener("click", () => {
  closeMenu();
  openManage();
});
$("#logoutBtn").addEventListener("click", () => {
  closeMenu();
  toast("Cerrando sesión…");
  DB.clearSession();
  setTimeout(() => (window.location.href = "../index.html"), 700);
});

// ================= Modal administrar cuenta =================
const manageOverlay = $("#manageOverlay");
const mUser = $("#mUser");
const mCode = $("#mCode");
const mSelects = Array.from(document.querySelectorAll("#manageOverlay .m-select"));
const mAnswers = Array.from(document.querySelectorAll("#manageOverlay .m-answer"));

// Rellena los selects evitando repetir la pregunta elegida en otro.
function fillManageSelects() {
  mSelects.forEach((sel, idx) => {
    const chosenElsewhere = mSelects
      .filter((_, j) => j !== idx)
      .map((s) => s.value)
      .filter(Boolean);
    const current = sel.value;
    sel.innerHTML = DB.QUESTIONS.map((q) => {
      const used = chosenElsewhere.includes(q) && q !== current;
      return `<option value="${q}" ${q === current ? "selected" : ""} ${used ? "disabled" : ""}>${q}</option>`;
    }).join("");
  });
}

mSelects.forEach((sel) => sel.addEventListener("change", fillManageSelects));

function openManage() {
  const u = DB.currentUser();
  if (!u) return;
  mUser.value = u.username;
  mCode.value = "";
  const qs = (u.security || []).map((s) => s.q);
  // Primero poblamos las opciones para poder fijar la pregunta guardada.
  mSelects.forEach((sel, i) => {
    sel.innerHTML = DB.QUESTIONS.map((q) => `<option value="${q}">${q}</option>`).join("");
    sel.value = qs[i] || DB.QUESTIONS[i];
  });
  fillManageSelects();
  mAnswers.forEach((a) => (a.value = ""));
  openOverlay(manageOverlay);
}

$("#closeManage").addEventListener("click", () => closeOverlay(manageOverlay));

$("#mCodeToggle").addEventListener("click", () => {
  const hidden = mCode.type === "password";
  mCode.type = hidden ? "text" : "password";
  $("#mCodeToggle i").className = hidden ? "iconoir-eye-closed" : "iconoir-eye";
});

$("#saveManage").addEventListener("click", () => {
  const answers = mAnswers.map((a) => a.value.trim());
  const anyAnswer = answers.some((a) => a);
  const allAnswers = answers.every((a) => a);

  let security = null;
  if (anyAnswer) {
    if (!allAnswers) {
      toast("Completa las 3 respuestas o déjalas todas vacías.");
      return;
    }
    security = mSelects.map((sel, i) => ({ q: sel.value, a: answers[i] }));
  }

  const res = DB.updateAccount({
    username: mUser.value.trim(),
    code: mCode.value.trim(),
    security,
  });
  if (!res.ok) {
    toast(res.error);
    return;
  }
  const nameEl = document.querySelector(".hello .name");
  if (nameEl) nameEl.textContent = res.user.username + "!";
  closeOverlay(manageOverlay);
  toast("Cuenta actualizada.");
});

// ================= Modal contraseña especial =================
const sUser = $("#sUser");
const sPass = $("#sPass");
const sNote = $("#sNote");
let editingSpecialId = null;

// Rellena y filtra la lista desplegable de un combo.
function renderComboList(listEl, filter = "") {
  const f = filter.trim().toLowerCase();
  const opts = items
    .filter((i) => !i.special)
    .filter((i) => !f || i.title.toLowerCase().includes(f));
  listEl.innerHTML = opts.length
    ? opts
        .map(
          (i) =>
            `<li class="combo-opt" data-val="${escapeHtml(i.title)}"><i class="${iconClass(
              i.icon
            )}"></i><span>${escapeHtml(i.title)}</span></li>`
        )
        .join("")
    : `<li class="combo-empty">Escribe un valor propio</li>`;
}

function openComboList(input, listEl) {
  document.querySelectorAll(".combo-list").forEach((l) => {
    if (l !== listEl) l.hidden = true;
  });
  renderComboList(listEl, input.value);
  listEl.hidden = false;
}

// Conecta un input con su lista para poder escribir o seleccionar.
function setupCombo(input, listEl) {
  const open = () => openComboList(input, listEl);
  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("input", () => openComboList(input, listEl));
  input.parentElement
    .querySelector(".sel-arrow")
    ?.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (listEl.hidden) {
        input.focus();
        open();
      } else {
        listEl.hidden = true;
      }
    });
  listEl.addEventListener("mousedown", (e) => {
    const opt = e.target.closest(".combo-opt");
    if (!opt) return;
    e.preventDefault();
    input.value = opt.dataset.val;
    listEl.hidden = true;
  });
}

// Devuelve el título guardado si el texto coincide con una cuenta existente.
function matchTitle(text) {
  const t = text.trim().toLowerCase();
  return items.find((i) => !i.special && i.title.toLowerCase() === t) || null;
}

function openSpecial(id = null) {
  editingSpecialId = id;
  const existing = id ? items.find((i) => i.id === id) : null;
  sUser.value = existing
    ? existing.userRef
      ? refItem(existing.userRef)?.title || existing.userVal || ""
      : existing.userVal || ""
    : "";
  sPass.value = existing
    ? existing.passRef
      ? refItem(existing.passRef)?.title || existing.passVal || ""
      : existing.passVal || ""
    : "";
  sNote.value = existing?.note || "";
  openOverlay(specialOverlay);
}

$("#openSpecial").addEventListener("click", () => openSpecial());
$("#closeSpecial").addEventListener("click", () => closeOverlay(specialOverlay));

setupCombo(sUser, $("#usersList"));
setupCombo(sPass, $("#passList"));
document.addEventListener("click", (e) => {
  if (!e.target.closest(".combo-field"))
    document.querySelectorAll(".combo-list").forEach((l) => (l.hidden = true));
});

$("#saveSpecial").addEventListener("click", () => {
  const uText = sUser.value.trim();
  const pText = sPass.value.trim();
  if (!uText || !pText) return;

  const uMatch = matchTitle(uText);
  const pMatch = matchTitle(pText);

  const data = {
    special: true,
    icon: "sparks",
    title: uText === pText ? uText : `${uText} / ${pText}`,
    userRef: uMatch ? uMatch.id : null,
    userVal: uMatch ? null : uText,
    passRef: pMatch ? pMatch.id : null,
    passVal: pMatch ? null : pText,
    note: sNote.value.trim(),
  };
  if (editingSpecialId) {
    const idx = items.findIndex((i) => i.id === editingSpecialId);
    if (idx > -1) items[idx] = { ...items[idx], ...data };
  } else {
    items.unshift({ id: Date.now().toString(36), ...data });
  }
  persist();
  renderCards();
  closeOverlay(specialOverlay);
});

// ================= Tema claro / oscuro + color de acento =================
const themeBtn = $("#themeBtn");

const ACCENTS = {
  blue: { main: "#3b6fd6", d2: "#2f57ab", softDark: "#1a2540", softLight: "#e2e9fb" },
  orange: { main: "#ffb066", d2: "#ff9445", softDark: "#3a2b18", softLight: "#ffeeda" },
  pink: { main: "#ec4f8f", d2: "#d63b78", softDark: "#3a1a2a", softLight: "#fce0ec" },
  green: { main: "#2fb673", d2: "#26955e", softDark: "#153020", softLight: "#d9f2e4" },
  yellow: { main: "#f2c14e", d2: "#e0a92f", softDark: "#332a12", softLight: "#fbf1d6" },
};

const hexToRgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

let currentTheme = localStorage.getItem("onepass.theme") || "dark";
let currentAccent = localStorage.getItem("onepass.accent") || "blue";

function applyAppearance() {
  const light = currentTheme === "light";
  document.body.classList.toggle("light", light);
  themeBtn.querySelector("i").className = light
    ? "iconoir-sun-light"
    : "iconoir-half-moon";

  const a = ACCENTS[currentAccent] || ACCENTS.blue;
  document.body.style.setProperty("--purple", a.main);
  document.body.style.setProperty("--purple-2", a.d2);
  document.body.style.setProperty("--purple-soft", light ? a.softLight : a.softDark);
  document.body.style.setProperty("--glow", hexToRgba(a.main, light ? 0.4 : 0.5));

  document
    .querySelectorAll(".color-dot")
    .forEach((d) => d.classList.toggle("active", d.dataset.accent === currentAccent));
}
applyAppearance();

themeBtn.addEventListener("click", () => {
  currentTheme = currentTheme === "light" ? "dark" : "light";
  localStorage.setItem("onepass.theme", currentTheme);
  applyAppearance();
});

$("#colorRow").addEventListener("click", (e) => {
  const dot = e.target.closest(".color-dot");
  if (!dot) return;
  currentAccent = dot.dataset.accent;
  localStorage.setItem("onepass.accent", currentAccent);
  applyAppearance();
});

// ================= Init =================
if (sessionUser) {
  const nameEl = document.querySelector(".hello .name");
  if (nameEl) nameEl.textContent = sessionUser.username + "!";
}
renderCards();

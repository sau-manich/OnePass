// ================= OnePass — Login / Registro / Recuperación =================
// Todo funciona con HTML/CSS/JS puro apoyándose en DB (js/db.js + localStorage).

// ---- Tema claro / oscuro (compartido con el tablero) ----
const themeBtn = document.getElementById("themeBtn");

function applyTheme() {
  const light = localStorage.getItem("onepass.theme") === "light";
  document.body.classList.toggle("light", light);
  themeBtn.querySelector("i").className = light
    ? "iconoir-sun-light"
    : "iconoir-half-moon";
}
applyTheme();

themeBtn.addEventListener("click", () => {
  const next =
    localStorage.getItem("onepass.theme") === "light" ? "dark" : "light";
  localStorage.setItem("onepass.theme", next);
  applyTheme();
});

// Si ya hay sesión iniciada, ir directo al tablero.
if (DB.currentUser()) {
  window.location.replace("html/tablero.html");
}

// ---- Utilidad: conecta un grupo de 4 casillas tipo OTP ----
function wireOtp(container) {
  const inputs = Array.from(container.querySelectorAll(".otp-digit"));
  inputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 1);
      input.classList.toggle("filled", input.value !== "");
      if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) {
        inputs[i - 1].focus();
        inputs[i - 1].value = "";
        inputs[i - 1].classList.remove("filled");
      }
    });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData("text") || "")
        .replace(/\D/g, "")
        .slice(0, inputs.length);
      digits.split("").forEach((d, k) => {
        inputs[k].value = d;
        inputs[k].classList.add("filled");
      });
      (inputs[digits.length] || inputs[inputs.length - 1]).focus();
    });
  });
  return {
    inputs,
    value: () => inputs.map((i) => i.value).join(""),
    clear: () => inputs.forEach((i) => { i.value = ""; i.classList.remove("filled"); }),
    focus: () => inputs[0].focus(),
  };
}

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.color = "var(--danger)";
  el.hidden = false;
  if (navigator.vibrate) navigator.vibrate([28, 22, 28]);
}
function showHint(el, msg) {
  el.textContent = msg;
  el.style.color = "var(--ink-soft)";
  el.hidden = false;
}

// ============================================================
//  Iniciar sesión
// ============================================================
const form = document.getElementById("otpForm");
const errorMsg = document.getElementById("otpError");
const otpInputs = document.getElementById("otpInputs");
const loginOtp = wireOtp(otpInputs);

otpInputs.addEventListener("input", () => (errorMsg.hidden = true));

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = loginOtp.value();

  if (code.length !== 4) {
    showError(errorMsg, "Completa tu código de 4 dígitos.");
    shake(otpInputs);
    return;
  }

  const res = DB.loginByCode(code);
  if (res.ok) {
    window.location.href = "html/tablero.html";
  } else {
    showError(errorMsg, res.error);
    shake(otpInputs);
    loginOtp.clear();
    loginOtp.focus();
  }
});

// ============================================================
//  Crear cuenta (asistente de 4 pasos)
// ============================================================
const registerOverlay = document.getElementById("registerOverlay");
const regUser = document.getElementById("regUser");
const regError = document.getElementById("regError");
const regDots = document.querySelectorAll("#regDots .auth-dot");
const regPrev = document.getElementById("regPrev");
const regNext = document.getElementById("regNext");
const regSave = document.getElementById("regSave");
const regSelects = Array.from(document.querySelectorAll("#registerOverlay .auth-select"));
const regAnswers = Array.from(document.querySelectorAll("#registerOverlay .auth-answer"));
const regCode = wireOtp(document.getElementById("regCodeInputs"));
const REG_STEPS = 4;
let regStep = 1;

// Rellena cada select evitando que se repita la pregunta ya elegida.
function fillQuestionSelects() {
  regSelects.forEach((sel, idx) => {
    const chosenElsewhere = regSelects
      .filter((_, j) => j !== idx)
      .map((s) => s.value)
      .filter(Boolean);
    const current = sel.value;
    sel.innerHTML =
      `<option value="" disabled ${current ? "" : "selected"}>Selecciona…</option>` +
      DB.QUESTIONS.map((q) => {
        const used = chosenElsewhere.includes(q) && q !== current;
        return `<option value="${q}" ${q === current ? "selected" : ""} ${used ? "disabled" : ""}>${q}</option>`;
      }).join("");
  });
}

regSelects.forEach((sel) =>
  sel.addEventListener("change", () => {
    regError.hidden = true;
    fillQuestionSelects();
  })
);

// Reemplaza el desplegable nativo por uno propio que se expande dentro de la
// tarjeta (el <select> nativo abre un popup del sistema que se sale de los
// márgenes). El <select> queda oculto como fuente de datos.
function enhanceSelect(select) {
  const picker = document.createElement("div");
  picker.className = "picker";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "picker-toggle";
  toggle.innerHTML =
    '<span class="picker-text"></span><i class="picker-arrow iconoir-nav-arrow-down"></i>';
  const list = document.createElement("ul");
  list.className = "picker-list";
  list.hidden = true;
  select.parentNode.insertBefore(picker, select);
  picker.append(toggle, list, select);
  const textEl = toggle.querySelector(".picker-text");

  const render = () => {
    const opts = Array.from(select.options);
    const cur = select.options[select.selectedIndex];
    const isPlaceholder = !cur || cur.value === "";
    textEl.textContent = cur ? cur.textContent : "Selecciona…";
    textEl.classList.toggle("placeholder", isPlaceholder);
    list.innerHTML = opts
      .filter((o) => o.value !== "")
      .map((o) => {
        const cls =
          "picker-opt" +
          (o.disabled ? " disabled" : "") +
          (o.selected ? " selected" : "");
        const v = o.value.replace(/"/g, "&quot;");
        return `<li class="${cls}" data-value="${v}">${o.textContent}</li>`;
      })
      .join("");
  };

  const close = () => {
    list.hidden = true;
    picker.classList.remove("open");
  };
  const open = () => {
    document.querySelectorAll(".picker.open").forEach((p) => {
      if (p !== picker) {
        p.classList.remove("open");
        p.querySelector(".picker-list").hidden = true;
      }
    });
    render();
    list.hidden = false;
    picker.classList.add("open");
  };

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (list.hidden) open();
    else close();
  });
  list.addEventListener("click", (e) => {
    const li = e.target.closest(".picker-opt");
    if (!li || li.classList.contains("disabled")) return;
    select.value = li.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  });
  new MutationObserver(render).observe(select, { childList: true });
  select.addEventListener("change", render);
  render();
}

regSelects.forEach(enhanceSelect);

document.addEventListener("click", (e) => {
  if (!e.target.closest(".picker")) {
    document.querySelectorAll(".picker.open").forEach((p) => {
      p.classList.remove("open");
      p.querySelector(".picker-list").hidden = true;
    });
  }
});

function showRegStep() {
  document.querySelectorAll("#registerOverlay .auth-pane").forEach((p) => {
    p.hidden = Number(p.dataset.rpane) !== regStep;
  });
  regDots.forEach((d, i) => {
    d.classList.toggle("active", i + 1 === regStep);
    d.classList.toggle("done", i + 1 < regStep);
  });
  const last = regStep === REG_STEPS;
  regPrev.hidden = regStep === 1;
  regNext.hidden = last;
  regSave.hidden = !last;
}

function openRegister() {
  regStep = 1;
  regUser.value = "";
  regCode.clear();
  regSelects.forEach((s) => (s.value = ""));
  regAnswers.forEach((a) => (a.value = ""));
  fillQuestionSelects();
  regError.hidden = true;
  showRegStep();
  registerOverlay.classList.add("open");
  registerOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => regUser.focus(), 300);
}

function closeRegister() {
  registerOverlay.classList.remove("open");
  registerOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function validateRegStep() {
  regError.hidden = true;
  if (regStep === 1) {
    if (!regUser.value.trim()) {
      showError(regError, "Escribe un nombre de usuario.");
      return false;
    }
    if (DB.findByUsername(regUser.value.trim())) {
      showError(regError, "Ese nombre de usuario ya existe.");
      return false;
    }
    if (regCode.value().length !== 4) {
      showError(regError, "Completa tu código de 4 dígitos.");
      return false;
    }
  } else {
    const idx = regStep - 2; // pasos 2,3,4 -> preguntas 0,1,2
    if (!regSelects[idx].value) {
      showError(regError, "Elige una pregunta.");
      return false;
    }
    if (!regAnswers[idx].value.trim()) {
      showError(regError, "Escribe tu respuesta.");
      return false;
    }
  }
  return true;
}

regNext.addEventListener("click", () => {
  if (!validateRegStep()) return;
  if (regStep < REG_STEPS) {
    regStep++;
    showRegStep();
  }
});
regPrev.addEventListener("click", () => {
  if (regStep > 1) {
    regStep--;
    showRegStep();
  }
});

regSave.addEventListener("click", () => {
  if (!validateRegStep()) return;
  const security = regSelects.map((sel, i) => ({
    q: sel.value,
    a: regAnswers[i].value.trim(),
  }));
  const res = DB.register({
    username: regUser.value.trim(),
    code: regCode.value(),
    security,
  });
  if (res.ok) {
    window.location.href = "html/tablero.html";
  } else {
    showError(regError, res.error);
  }
});

document.getElementById("createAccount").addEventListener("click", (e) => {
  e.preventDefault();
  openRegister();
});
document.getElementById("regClose").addEventListener("click", closeRegister);
registerOverlay.addEventListener("click", (e) => {
  if (e.target === registerOverlay) closeRegister();
});

// ============================================================
//  Recuperar código con preguntas de seguridad
// ============================================================
const recoverOverlay = document.getElementById("recoverOverlay");
const recError = document.getElementById("recError");
const recQuestions = document.getElementById("recQuestions");
const recSave = document.getElementById("recSave");
const recCode = wireOtp(document.getElementById("recCodeInputs"));

function openRecover() {
  recCode.clear();
  recQuestions.innerHTML = "";
  recError.hidden = true;

  const res = DB.recoverQuestions();
  if (!res.ok) {
    recQuestions.innerHTML = "";
    showError(recError, res.error);
    recSave.hidden = true;
  } else {
    recSave.hidden = false;
    recQuestions.innerHTML = res.questions
      .map(
        (q, i) => `
        <div class="auth-field">
          <label>${q}</label>
          <div class="auth-input-wrap">
            <i class="iconoir-chat-bubble-question"></i>
            <input type="text" class="rec-answer" data-ri="${i}" placeholder="Tu respuesta" />
          </div>
        </div>`
      )
      .join("");
  }

  recoverOverlay.classList.add("open");
  recoverOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeRecover() {
  recoverOverlay.classList.remove("open");
  recoverOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

recSave.addEventListener("click", () => {
  recError.hidden = true;
  const answers = Array.from(recoverOverlay.querySelectorAll(".rec-answer")).map(
    (i) => i.value.trim()
  );
  const res = DB.recoverReset(answers, recCode.value());
  if (res.ok) {
    closeRecover();
    showHint(errorMsg, "Código actualizado. Ya puedes ingresar.");
    loginOtp.focus();
  } else {
    showError(recError, res.error);
  }
});

document.getElementById("forgotCode").addEventListener("click", (e) => {
  e.preventDefault();
  openRecover();
});
document.getElementById("recClose").addEventListener("click", closeRecover);
recoverOverlay.addEventListener("click", (e) => {
  if (e.target === recoverOverlay) closeRecover();
});

// Cerrar modales con Escape.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeRegister();
    closeRecover();
  }
});

loginOtp.focus();

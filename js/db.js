// ============================================================
//  OnePass — "Base de datos" en JSON usando localStorage
//  (HTML/CSS/JS puro, sin servidor ni PHP)
//
//  Todo se guarda dentro del navegador en la clave "onepass.db":
//    { "users": [ { id, username, code, security, items, createdAt } ] }
//
//  Cada usuario solo puede ver y editar SUS propias contraseñas:
//  el tablero siempre lee/escribe los "items" del usuario de la sesión.
//
//  Nota: al ser solo del lado del cliente, los datos viven en el
//  navegador de cada equipo (no se comparten entre dispositivos).
// ============================================================

const DB = (() => {
  const KEY = "onepass.db";
  const SESSION_KEY = "onepass.session";

  // Preguntas de seguridad disponibles al crear la cuenta.
  const QUESTIONS = [
    "¿En qué año naciste?",
    "¿Cómo se llama tu perro?",
    "¿Cómo se llama tu gato?",
    "¿Cuál es tu película favorita?",
    "¿Qué deporte te gusta más?",
    "¿Cuál es tu comida favorita?",
  ];

  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

  function read() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      return d && Array.isArray(d.users) ? d : { users: [] };
    } catch {
      return { users: [] };
    }
  }

  function write(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function publicUser(u) {
    return { id: u.id, username: u.username };
  }

  function newId() {
    return "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function findByUsername(username) {
    return read().users.find((u) => norm(u.username) === norm(username)) || null;
  }

  // ---- Sesión ----
  function setSession(id) {
    localStorage.setItem(SESSION_KEY, id);
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }
  function currentUser() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return read().users.find((u) => u.id === id) || null;
  }

  // ---- Crear cuenta ----
  function register({ username, code, security }) {
    username = (username || "").trim();
    if (!username || username.length > 40)
      return { ok: false, error: "Escribe un nombre de usuario válido." };
    if (!/^\d{4}$/.test(code))
      return { ok: false, error: "El código debe tener 4 dígitos." };
    if (
      !Array.isArray(security) ||
      security.length !== 3 ||
      security.some((s) => !s.q || !norm(s.a))
    )
      return { ok: false, error: "Responde las 3 preguntas de seguridad." };

    const db = read();
    if (db.users.some((u) => norm(u.username) === norm(username)))
      return { ok: false, error: "Ese nombre de usuario ya existe." };

    const user = {
      id: newId(),
      username,
      code, // app local familiar: se guarda tal cual en el navegador
      security: security.map((s) => ({ q: s.q, a: norm(s.a) })),
      items: [],
      createdAt: Date.now(),
    };
    db.users.push(user);
    write(db);
    setSession(user.id);
    return { ok: true, user: publicUser(user) };
  }

  // ---- Iniciar sesión (solo con el código; 1 cuenta por dispositivo) ----
  function loginByCode(code) {
    if (!/^\d{4}$/.test(code))
      return { ok: false, error: "Completa tu código de 4 dígitos." };
    const matches = read().users.filter((u) => u.code === code);
    if (matches.length === 1) {
      setSession(matches[0].id);
      return { ok: true, user: publicUser(matches[0]) };
    }
    if (matches.length === 0)
      return { ok: false, error: "Código incorrecto." };
    return {
      ok: false,
      error: "Hay varias cuentas con ese código en este dispositivo.",
    };
  }

  // ---- Guardar las contraseñas del usuario de la sesión ----
  function saveItems(items) {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return { ok: false, error: "Sin sesión." };
    const db = read();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx < 0) return { ok: false, error: "Sin sesión." };
    db.users[idx].items = Array.isArray(items) ? items : [];
    write(db);
    return { ok: true };
  }

  // ---- Administrar cuenta: cambiar nombre, código y/o preguntas ----
  //  code vacío/nulo   -> se conserva el actual.
  //  security nulo     -> se conservan las preguntas actuales.
  function updateAccount({ username, code, security }) {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return { ok: false, error: "Sin sesión." };
    const db = read();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx < 0) return { ok: false, error: "Sin sesión." };

    username = (username || "").trim();
    if (!username || username.length > 40)
      return { ok: false, error: "Escribe un nombre de usuario válido." };
    if (db.users.some((u) => u.id !== id && norm(u.username) === norm(username)))
      return { ok: false, error: "Ese nombre de usuario ya existe." };

    if (code) {
      if (!/^\d{4}$/.test(code))
        return { ok: false, error: "El código debe tener 4 dígitos." };
      db.users[idx].code = code;
    }

    if (security) {
      if (
        !Array.isArray(security) ||
        security.length !== 3 ||
        security.some((s) => !s.q || !norm(s.a))
      )
        return { ok: false, error: "Responde las 3 preguntas de seguridad." };
      db.users[idx].security = security.map((s) => ({ q: s.q, a: norm(s.a) }));
    }

    db.users[idx].username = username;
    write(db);
    return { ok: true, user: publicUser(db.users[idx]) };
  }

  // ---- Recuperar código: paso 1 (preguntas de la cuenta del dispositivo) ----
  function recoverQuestions() {
    const users = read().users;
    if (users.length === 0)
      return { ok: false, error: "No hay ninguna cuenta en este dispositivo." };
    if (users.length > 1)
      return { ok: false, error: "Hay varias cuentas en este dispositivo." };
    return { ok: true, questions: users[0].security.map((s) => s.q) };
  }

  // ---- Recuperar código: paso 2 (verificar respuestas y cambiar código) ----
  function recoverReset(answers, code) {
    const users = read().users;
    if (users.length !== 1)
      return { ok: false, error: "No se puede recuperar automáticamente." };
    const u = users[0];
    if (!/^\d{4}$/.test(code))
      return { ok: false, error: "El nuevo código debe tener 4 dígitos." };
    if (!Array.isArray(answers) || answers.length !== u.security.length)
      return { ok: false, error: "Responde todas las preguntas." };
    const todasOk = u.security.every((s, i) => norm(answers[i]) === s.a);
    if (!todasOk) return { ok: false, error: "Las respuestas no coinciden." };

    const db = read();
    const idx = db.users.findIndex((x) => x.id === u.id);
    db.users[idx].code = code;
    write(db);
    return { ok: true };
  }

  return {
    QUESTIONS,
    register,
    loginByCode,
    currentUser,
    clearSession,
    saveItems,
    updateAccount,
    recoverQuestions,
    recoverReset,
    findByUsername,
  };
})();

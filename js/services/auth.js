import { auth } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ADMIN_SESSION_KEY = "mesa_facil_admin_logado";

const LOGIN_PATH = "/login.html";
const ADMIN_PATH = "/admin/index.html";

/* ==========================================================
   AGUARDAR FIREBASE RESTAURAR A SESSÃO
========================================================== */

function aguardarUsuario() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const cancelar = onAuthStateChanged(auth, (usuario) => {
      cancelar();
      resolve(usuario);
    });
  });
}

/* ==========================================================
   LOGIN ADMIN
========================================================== */

export async function login(email, senha) {
  const emailLimpo = String(email || "").trim();
  const senhaLimpa = String(senha || "").trim();

  if (!emailLimpo || !senhaLimpa) {
    throw new Error("LOGIN_INVALIDO");
  }

  const resultado = await signInWithEmailAndPassword(
    auth,
    emailLimpo,
    senhaLimpa,
  );

  const usuario = resultado.user;

  /*
   * Força o Firebase a buscar o token atualizado,
   * incluindo o custom claim admin: true.
   */
  await usuario.getIdToken(true);

  const tokenResult = await usuario.getIdTokenResult();

  if (tokenResult.claims.admin !== true) {
    await signOut(auth);

    throw new Error("USUARIO_NAO_E_ADMIN");
  }

  localStorage.setItem(ADMIN_SESSION_KEY, "true");

  return true;
}

/* ==========================================================
   SESSÃO ADMIN
========================================================== */

export async function adminEstaLogado() {
  const usuario = await aguardarUsuario();

  if (!usuario) {
    return false;
  }

  try {
    const tokenResult = await usuario.getIdTokenResult();

    return tokenResult.claims.admin === true;
  } catch (erro) {
    console.error("Erro ao verificar administrador:", erro);

    return false;
  }
}

/* ==========================================================
   LOGOUT ADMIN
========================================================== */

export async function logoutAdmin() {
  try {
    await signOut(auth);
  } finally {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

/* ==========================================================
   VERIFICAR USUÁRIO ADMIN
========================================================== */

export async function usuarioEhAdmin() {
  const usuario = await aguardarUsuario();

  if (!usuario) {
    return false;
  }

  try {
    const tokenResult = await usuario.getIdTokenResult();

    return tokenResult.claims.admin === true;
  } catch (erro) {
    console.error("Erro ao verificar administrador:", erro);

    return false;
  }
}

/* ==========================================================
   REDIRECIONAR SE JÁ ESTIVER LOGADO
========================================================== */

export async function redirecionarSeAdminLogado() {
  const usuario = await aguardarUsuario();

  if (!usuario) {
    return false;
  }

  const admin = await usuarioEhAdmin();

  if (!admin) {
    await signOut(auth);
    localStorage.removeItem(ADMIN_SESSION_KEY);

    return false;
  }

  window.location.replace(ADMIN_PATH);

  return true;
}

/* ==========================================================
   PROTEÇÃO DAS PÁGINAS ADMIN
========================================================== */

export async function protegerPaginaAdmin() {
  const usuario = await aguardarUsuario();

  if (!usuario) {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.replace(LOGIN_PATH);
    return false;
  }

  const admin = await usuarioEhAdmin();

  if (!admin) {
    await signOut(auth);
    localStorage.removeItem(ADMIN_SESSION_KEY);

    window.location.replace(LOGIN_PATH);

    return false;
  }

  localStorage.setItem(ADMIN_SESSION_KEY, "true");

  return true;
}
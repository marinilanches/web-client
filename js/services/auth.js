const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "marini@2026";
const ADMIN_SESSION_KEY = "mesa_facil_admin_logado";

/* ==========================================================
   LOGIN ADMIN
========================================================== */

export async function login(login, senha) {
    const loginLimpo = String(login || "").trim();
    const senhaLimpa = String(senha || "").trim();

    if (loginLimpo === ADMIN_LOGIN && senhaLimpa === ADMIN_PASSWORD) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
        return true;
    }

    throw new Error("LOGIN_INVALIDO");
}

/* ==========================================================
   SESSÃO ADMIN
========================================================== */

export function adminEstaLogado() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

export function logoutAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

/* ==========================================================
   PROTEÇÃO DAS PÁGINAS ADMIN
========================================================== */

export function protegerPaginaAdmin() {
    if (!adminEstaLogado()) {
        window.location.href = "../login.html";
        return false;
    }

    return true;
}
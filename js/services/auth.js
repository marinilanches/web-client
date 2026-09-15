const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "marini@2026";
const ADMIN_SESSION_KEY = "mesa_facil_admin_logado";

const LOGIN_PATH = "/login.html";
const ADMIN_PATH = "/admin/index.html";

/* ==========================================================
   LOGIN ADMIN
========================================================== */

export async function login(login, senha) {
    const loginLimpo = String(login || "").trim();
    const senhaLimpa = String(senha || "").trim();

    if (loginLimpo === ADMIN_LOGIN && senhaLimpa === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_SESSION_KEY, "true");
        return true;
    }

    throw new Error("LOGIN_INVALIDO");
}

/* ==========================================================
   SESSÃO ADMIN
========================================================== */

export function adminEstaLogado() {
    return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

export function logoutAdmin() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
}

/* ==========================================================
   REDIRECIONAR SE JÁ ESTIVER LOGADO
========================================================== */

export function redirecionarSeAdminLogado() {
    if (adminEstaLogado()) {
        window.location.replace(ADMIN_PATH);
        return true;
    }

    return false;
}

/* ==========================================================
   PROTEÇÃO DAS PÁGINAS ADMIN
========================================================== */

export function protegerPaginaAdmin() {
    if (!adminEstaLogado()) {
        window.location.replace(LOGIN_PATH);
        return false;
    }

    return true;
}
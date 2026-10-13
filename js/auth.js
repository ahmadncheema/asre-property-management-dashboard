// ================================================================
// ASRE Property Management Dashboard
// Auth — Login, Logout, Session Management
// ================================================================

import { supabase } from "./supabase.js";

const SESSION_KEY = "asre_session";

// ── Save session after login ──────────────────────────────────────
export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

// ── Get current session ───────────────────────────────────────────
export function getSession() {
  const data = localStorage.getItem(SESSION_KEY);
  return data ? JSON.parse(data) : null;
}

// ── Clear session on logout ───────────────────────────────────────
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ── Roles ─────────────────────────────────────────────────────────
// admin    – everything, including the Admin Panel
// team     – everything except the Admin Panel
// ceo      – same pages as team, but view only (and the CEO Panel)
// finance  – finance pages only
// landlord – only their own buildings (Landlord Portal), view only
export const ROLE_LABELS = {
  admin: "Admin",
  team: "Team",
  ceo: "CEO",
  finance: "Finance",
  landlord: "Landlord",
};
export const ROLE_HOME = {
  admin: "/dashboard.html",
  team: "/dashboard.html",
  ceo: "/ceo.html",
  finance: "/finance.html",
  landlord: "/landlord.html",
};

// Older accounts have no role saved: they were all admins
export function roleOf(session) {
  const r = session && session.role;
  return ROLE_HOME[r] ? r : "admin";
}

export function canAccess(role, path) {
  const file = ((path || "").split("/").pop() || "index.html").toLowerCase();
  if (file === "index.html") return true;
  if (role === "admin") return true;
  if (role === "finance") return /^finance(-[a-z]+)?\.html$/.test(file);
  if (role === "landlord") return file === "landlord.html";
  // team and ceo
  return file !== "admin.html" && file !== "landlord.html";
}

export function isViewOnly(session = getSession()) {
  const r = roleOf(session);
  return r === "ceo" || r === "landlord";
}

// ── Check if user is admin ────────────────────────────────────────
export function isAdmin() {
  return roleOf(getSession()) === "admin";
}

// ── Check if user is finance ──────────────────────────────────────
export function isFinance() {
  return roleOf(getSession()) === "finance";
}

// ── Require login — call at top of every protected page ───────────
// Also sends people away from pages their role may not open.
export function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = "/index.html";
    return null;
  }
  const role = roleOf(session);
  if (!canAccess(role, window.location.pathname)) {
    window.location.href = ROLE_HOME[role];
    return null;
  }
  return session;
}

// ── Require admin role ────────────────────────────────────────────
export function requireAdmin() {
  return requireAuth();
}

// ── Finance pages: finance, admin, team and CEO may open them ─────
export function requireFinanceOrAdmin() {
  return requireAuth();
}

// ── Login ─────────────────────────────────────────────────────────
export async function login(username, password) {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      return { success: false, message: "Invalid username or password." };
    }

    const user = users[0];

    if (password !== user.password_hash) {
      return { success: false, message: "Invalid username or password." };
    }

    saveSession({
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      role: user.role,
    });

    return { success: true, user };
  } catch (err) {
    console.error("Login error:", err);
    return {
      success: false,
      message: "Something went wrong. Please try again.",
    };
  }
}

// ── Logout ────────────────────────────────────────────────────────
export function logout() {
  clearSession();
  window.location.href = "/index.html";
}

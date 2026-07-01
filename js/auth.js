// ================================================================
// ASRE Property Management Dashboard
// Auth — Login, Logout, Session Management
// ================================================================

import { supabase } from './supabase.js';

const SESSION_KEY = 'asre_session';

// ── Save session after login ──────────────────────────────────────
export function saveSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

// ── Get current session ───────────────────────────────────────────
export function getSession() {
  const data = sessionStorage.getItem(SESSION_KEY);
  return data ? JSON.parse(data) : null;
}

// ── Clear session on logout ───────────────────────────────────────
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Require login — call this at top of every protected page ──────
export function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = '/index.html';
    return null;
  }
  return session;
}

// ── Login function ────────────────────────────────────────────────
export async function login(username, password) {
  try {
    // Fetch user by username
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      return { success: false, message: 'Invalid username or password.' };
    }

    const user = users[0];

    // Verify password using bcrypt via API
    const match = await verifyPassword(password, user.password_hash);
    if (!match) {
      return { success: false, message: 'Invalid username or password.' };
    }

    // Save session
    saveSession({
      id:        user.id,
      full_name: user.full_name,
      username:  user.username
    });

    return { success: true, user };

  } catch (err) {
    console.error('Login error:', err);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
}

// ── Logout ────────────────────────────────────────────────────────
export function logout() {
  clearSession();
  window.location.href = '/index.html';
}

// ── Verify bcrypt password client-side ────────────────────────────
// We use bcryptjs loaded via CDN in each page's script
async function verifyPassword(password, hash) {
  // bcrypt is loaded globally via CDN script tag in HTML pages
  return await bcrypt.compare(password, hash);
}
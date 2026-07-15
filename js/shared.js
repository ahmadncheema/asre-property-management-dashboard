// ================================================================
// ASRE Property Management Dashboard
// Shared Utilities — used across all pages
// ================================================================

import { supabase } from "./supabase.js";
import { getSession, logout } from "./auth.js";

// ── Format currency ───────────────────────────────────────────────
export function formatCurrency(amount) {
  if (!amount && amount !== 0) return "AED 0.00";
  return (
    "AED " +
    parseFloat(amount).toLocaleString("en-AE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// ── Format date ───────────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Days between today and a date ────────────────────────────────
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

// ── Get reminder stage based on days until expiry ────────────────
export function getReminderStage(endDate) {
  const days = daysUntil(endDate);
  if (days === null) return null;
  if (days <= 30) return "30d";
  if (days <= 60) return "60d";
  if (days <= 90) return "90d";
  return null;
}

// ── Show toast notification ───────────────────────────────────────
export function showToast(message, type = "success") {
  const existing = document.getElementById("asre-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "asre-toast";
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("toast-show"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Show confirmation dialog ──────────────────────────────────────
export function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-box">
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn-confirm-yes">Confirm</button>
          <button class="btn-confirm-no">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".btn-confirm-yes").onclick = () => {
      overlay.remove();
      resolve(true);
    };
    overlay.querySelector(".btn-confirm-no").onclick = () => {
      overlay.remove();
      resolve(false);
    };
  });
}

// ── Render navigation bar ─────────────────────────────────────────
export function renderNav(activePage) {
  const session = getSession();
  const nav = document.getElementById("main-nav");
  if (!nav || !session) return;

  const isAdminRole = session.role === "admin";
  const isFinanceRole = session.role === "finance";

  // Admin links
  const adminLinks = [
    { href: "/dashboard.html", label: "Dashboard", key: "dashboard" },
    { href: "/properties.html", label: "Properties", key: "properties" },
    { href: "/vacancy.html", label: "Vacancy", key: "vacancy" },
    { href: "/upcoming.html", label: "Upcoming", key: "upcoming" },
    { href: "/bounce.html", label: "Bounce Check", key: "bounce" },
    { href: "/maintenance.html", label: "Maintenance", key: "maintenance" },
    { href: "/invoices.html", label: "Invoices", key: "invoices" },
    { href: "/emails.html", label: "Emails", key: "emails" },
    {
      href: "/announcements.html",
      label: "Announcements",
      key: "announcements",
    },
    { href: "/finance.html", label: "Finance", key: "finance" },
    { href: "/admin.html", label: "Admin", key: "admin" },
  ];

  // Finance links
  const financeLinks = [
    { href: "/finance.html", label: "Dashboard", key: "finance" },
    { href: "/finance-income.html", label: "Income", key: "finance-income" },
    {
      href: "/finance-invoices.html",
      label: "Invoices",
      key: "finance-invoices",
    },
    { href: "/finance-cheques.html", label: "Cheques", key: "finance-cheques" },
    {
      href: "/finance-deposits.html",
      label: "Deposits",
      key: "finance-deposits",
    },
    { href: "/finance-reports.html", label: "Reports", key: "finance-reports" },
  ];

  const links = isFinanceRole ? financeLinks : adminLinks;

  nav.innerHTML = `
    <div class="nav-brand" onclick="window.location.href='${isFinanceRole ? "/finance.html" : "/dashboard.html"}'"
      style="cursor:pointer">
      <img src="assets/logo/logo-small.png" alt="ASRE"
        style="height:36px; width:auto; object-fit:contain;" />
      <span class="nav-title">${isFinanceRole ? "Finance" : "Property Management"}</span>
    </div>
    <div class="nav-links" id="nav-links-desktop">
      ${links
        .map(
          (l) => `
        <a href="${l.href}" class="nav-link ${activePage === l.key ? "active" : ""}">
          ${l.label}
        </a>
      `,
        )
        .join("")}
    </div>
    <div class="nav-user">
      <span class="nav-username">👤 ${session.full_name}</span>
      <button class="nav-logout" onclick="handleLogout()">Logout</button>
      <button class="nav-hamburger" id="nav-hamburger" onclick="toggleMobileMenu()">
        ☰
      </button>
    </div>

    <!-- Mobile Menu -->
    <div class="mobile-menu" id="mobile-menu">
      ${links
        .map(
          (l) => `
        <a href="${l.href}" class="mobile-menu-link ${activePage === l.key ? "active" : ""}">
          ${l.label}
        </a>
      `,
        )
        .join("")}
      <div class="mobile-menu-footer">
        <span>👤 ${session.full_name}</span>
        <button class="nav-logout" onclick="handleLogout()">Logout</button>
      </div>
    </div>
  `;

  // Close mobile menu when clicking outside
  document.addEventListener("click", function (e) {
    const menu = document.getElementById("mobile-menu");
    const hamburger = document.getElementById("nav-hamburger");
    if (
      menu &&
      hamburger &&
      !menu.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      menu.classList.remove("open");
    }
  });
}

// ── Toggle Mobile Menu ────────────────────────────────────────────
window.toggleMobileMenu = function () {
  const menu = document.getElementById("mobile-menu");
  if (menu) menu.classList.toggle("open");
};

// ── Logout handler (called from nav) ─────────────────────────────
window.handleLogout = function () {
  logout();
};

// ── Fetch all buildings ───────────────────────────────────────────
export async function fetchBuildings() {
  const { data, error } = await supabase
    .from("buildings")
    .select("*")
    .order("name");
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

// ── Fetch floors for a building ───────────────────────────────────
export async function fetchFloors(buildingId) {
  const { data, error } = await supabase
    .from("floors")
    .select("*")
    .eq("building_id", buildingId)
    .order("sort_order");
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

// ── Fetch units for a floor ───────────────────────────────────────
export async function fetchUnits(floorId) {
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .eq("floor_id", floorId)
    .order("unit_number");
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

// ── Fetch all units for a building ───────────────────────────────
export async function fetchBuildingUnits(buildingId) {
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .eq("building_id", buildingId);
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

// ── Log Activity ──────────────────────────────────────────────────
export async function logActivity(action, module) {
  const session = getSession();
  if (!session) return;
  try {
    await supabase.from("activity_log").insert({
      user_name: session.full_name,
      action,
      module,
    });
  } catch (err) {
    console.error("Activity log error:", err);
  }
}

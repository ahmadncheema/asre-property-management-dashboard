// ================================================================
// ASRE Property Management Dashboard
// Supabase Client — shared across all pages
// ================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://oebafaigfoqiaotkrnuw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lYmFmYWlnZm9xaWFvdGtybnV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4OTM1MjgsImV4cCI6MjA5ODQ2OTUyOH0.s2qzle-N9S25UBcukJtI12Wz-5fgcQ2ydsg4ChbGTwg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── View-only accounts (CEO, Landlord) ────────────────────────────
// Any attempt to add, change or delete something is stopped here, so no
// page needs its own check. (Real protection comes with the security
// work: this keeps honest users from changing things by mistake.)
function viewOnly() {
  try {
    const s = JSON.parse(localStorage.getItem("asre_session") || "null");
    return !!s && (s.role === "ceo" || s.role === "landlord");
  } catch (e) {
    return false;
  }
}

function viewOnlyNotice() {
  try {
    let el = document.getElementById("view-only-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "view-only-notice";
      el.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#161f2e;color:#fff;border:1px solid #f0a500;padding:10px 18px;border-radius:10px;z-index:99999;font-size:0.9rem;box-shadow:0 4px 24px rgba(0,0,0,.4)";
      document.body.appendChild(el);
    }
    el.textContent = "👁 View-only account: changes are not allowed.";
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 3500);
  } catch (e) {}
}

// A stand-in answer for blocked changes: it accepts any chained call
// (.eq, .select ...) and finally resolves with an error.
function blockedQuery() {
  const result = { data: null, error: { message: "View-only account" } };
  const p = new Proxy(function () {}, {
    get(_, prop) {
      if (prop === "then") return (res) => Promise.resolve(result).then(res);
      return () => p;
    },
    apply() {
      return p;
    },
  });
  return p;
}

if (viewOnly()) {
  const realFrom = supabase.from.bind(supabase);
  supabase.from = (table) => {
    const q = realFrom(table);
    ["insert", "update", "delete", "upsert"].forEach((m) => {
      q[m] = () => {
        viewOnlyNotice();
        return blockedQuery();
      };
    });
    return q;
  };

  // Emails, uploads and deletes on the server are changes too
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts) => {
    const method = ((opts && opts.method) || "GET").toUpperCase();
    if (method !== "GET" && String(url).startsWith("/api/")) {
      viewOnlyNotice();
      return Promise.resolve(
        new Response(JSON.stringify({ error: "View-only account" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return realFetch(url, opts);
  };
}

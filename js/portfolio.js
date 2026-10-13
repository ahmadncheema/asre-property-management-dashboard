// ================================================================
// ASRE Property Management Dashboard
// Portfolio overview — shared by the CEO Panel and the Landlord Portal
// Read-only: loads the numbers and draws the overview.
// ================================================================

import { supabase } from "./supabase.js";

const pad = (n) => String(n).padStart(2, "0");
const num = (v) => parseFloat(v) || 0;
const sum = (rows, f) => rows.reduce((s, r) => s + num(f(r)), 0);
const money = (n) => "AED " + Math.round(n).toLocaleString("en-US");
const day = (s) => (s || "").slice(0, 10);
const isOcc = (u) => !!(u.tenant_name && u.tenant_name.trim());
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const byNum = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true });

function daysLeft(s) {
  const [y, m, d] = day(s).split("-").map(Number);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - t) / 86400000);
}
function fmtDate(s) {
  if (!s) return "-";
  const [y, m, d] = day(s).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Load ──────────────────────────────────────────────────────────
// buildings: the building rows to show (already chosen by the page)
export async function loadPortfolio(buildings) {
  const ids = buildings.map((b) => b.id);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const first = `${y}-${pad(m)}-01`;
  const last = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;

  if (!ids.length) {
    return { buildings, units: [], cheques: [], bounces: [], maint: [] };
  }
  const get = async (q) => {
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };
  const [units, cheques, bounces, maint] = await Promise.all([
    get(
      supabase
        .from("units")
        .select("id, building_id, unit_number, tenant_name, rent, end_date")
        .in("building_id", ids),
    ),
    get(
      supabase
        .from("cheques")
        .select("building_id, status, amount, cheque_date")
        .in("building_id", ids)
        .gte("cheque_date", first)
        .lte("cheque_date", last),
    ),
    get(
      supabase
        .from("bounce_checks")
        .select("building_id, status")
        .in("building_id", ids),
    ),
    get(
      supabase
        .from("maintenance_requests")
        .select("building_id, status")
        .in("building_id", ids),
    ),
  ]);
  return { buildings, units, cheques, bounces, maint };
}

// ── Work out the figures ──────────────────────────────────────────
export function analysePortfolio(d) {
  const rows = d.buildings.map((b) => {
    const units = d.units.filter((u) => u.building_id === b.id);
    const occ = units.filter(isOcc);
    const expiring = occ.filter((u) => {
      if (!u.end_date) return false;
      const n = daysLeft(u.end_date);
      return n >= 0 && n <= 90;
    });
    return {
      b,
      units,
      occupied: occ.length,
      occupancy: units.length ? Math.round((occ.length / units.length) * 100) : 0,
      monthlyRent: Math.round(sum(occ, (u) => u.rent) / 12),
      annualRent: Math.round(sum(occ, (u) => u.rent)),
      expiring: expiring.length,
      bounced: d.bounces.filter(
        (x) => x.building_id === b.id && x.status === "active",
      ).length,
      openMaint: d.maint.filter(
        (x) => x.building_id === b.id && x.status === "open",
      ).length,
    };
  });

  const occAll = d.units.filter(isOcc);
  const expiringList = occAll
    .filter((u) => {
      if (!u.end_date) return false;
      const n = daysLeft(u.end_date);
      return n >= 0 && n <= 90;
    })
    .sort((a, c) => day(a.end_date).localeCompare(day(c.end_date)));

  return {
    rows,
    buildings: d.buildings.length,
    units: d.units.length,
    occupied: occAll.length,
    occupancy: d.units.length
      ? Math.round((occAll.length / d.units.length) * 100)
      : 0,
    monthlyRent: Math.round(sum(occAll, (u) => u.rent) / 12),
    annualRent: Math.round(sum(occAll, (u) => u.rent)),
    collected: sum(
      d.cheques.filter((c) => c.status === "deposited"),
      (c) => c.amount,
    ),
    awaiting: sum(
      d.cheques.filter((c) => c.status === "held"),
      (c) => c.amount,
    ),
    bounced: d.bounces.filter((x) => x.status === "active").length,
    openMaint: d.maint.filter((x) => x.status === "open").length,
    expiringList,
    bName: Object.fromEntries(d.buildings.map((b) => [b.id, b.name])),
  };
}

// ── Draw ──────────────────────────────────────────────────────────
const CSS = `
.pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-bottom:24px}
.pf-kpi{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.pf-kpi .v{font-size:1.5rem;font-weight:700;color:var(--white)}
.pf-kpi .l{font-size:.8rem;color:var(--text-muted);margin-top:2px}
.pf-kpi .s{font-size:.75rem;color:var(--text-muted);margin-top:6px}
.pf-kpi.warn .v{color:#f0c060}.pf-kpi.bad .v{color:#f08080}.pf-kpi.good .v{color:var(--green-light)}
.pf-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:20px}
.pf-card h3{font-size:1rem;color:var(--white);margin-bottom:12px}
.pf-card table{width:100%;border-collapse:collapse;font-size:.88rem}
.pf-card th{text-align:left;color:var(--text-muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--border);white-space:nowrap}
.pf-card td{padding:8px 10px;border-bottom:1px solid var(--border);color:var(--text)}
.pf-card .r{text-align:right}
.pf-scroll{overflow-x:auto}
.pf-card details{border-top:1px solid var(--border);padding:10px 0}
.pf-card summary{cursor:pointer;font-weight:600;color:var(--white)}
.pf-empty{color:var(--text-muted);padding:12px 0}
@media(max-width:600px){.pf-grid{grid-template-columns:1fr 1fr}.pf-kpi .v{font-size:1.25rem}}
`;

const kpi = (v, l, s, cls = "") =>
  `<div class="pf-kpi ${cls}"><div class="v">${v}</div><div class="l">${l}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;

const dayBadge = (n) =>
  `<span class="badge ${n <= 30 ? "badge-red" : "badge-orange"}">${n} day${n === 1 ? "" : "s"}</span>`;

// opts.unitDetail: add a unit-by-unit list under each building
export function renderPortfolio(el, d, a, opts = {}) {
  if (!document.getElementById("pf-css")) {
    const st = document.createElement("style");
    st.id = "pf-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  if (!a.buildings) {
    el.innerHTML = `<div class="pf-card"><div class="pf-empty">${esc(opts.emptyText || "No buildings to show yet.")}</div></div>`;
    return;
  }

  const kpis = [
    kpi(a.buildings, "Buildings", `${a.units} units`),
    kpi(
      a.occupancy + "%",
      "Occupancy",
      `${a.occupied} occupied · ${a.units - a.occupied} vacant`,
      a.occupancy >= 90 ? "good" : a.occupancy >= 75 ? "" : "warn",
    ),
    kpi(
      money(a.monthlyRent),
      "Rent per month",
      `${money(a.annualRent)} per year`,
    ),
    kpi(money(a.collected), "Cheques deposited this month", "", "good"),
    kpi(money(a.awaiting), "Cheques awaiting deposit this month"),
    kpi(a.bounced, "Active bounced cheques", "", a.bounced ? "bad" : ""),
    kpi(a.openMaint, "Open maintenance requests", "", a.openMaint ? "warn" : ""),
    kpi(
      a.expiringList.length,
      "Leases ending in 90 days",
      "",
      a.expiringList.length ? "warn" : "",
    ),
  ].join("");

  const bRows = a.rows
    .map(
      (r) => `<tr>
      <td><b style="color:var(--white)">${esc(r.b.name)}</b></td>
      <td class="r">${r.units.length}</td>
      <td class="r">${r.occupied}</td>
      <td class="r">${r.occupancy}%</td>
      <td class="r">${money(r.monthlyRent)}</td>
      <td class="r">${r.expiring}</td>
      <td class="r">${r.bounced}</td>
      <td class="r">${r.openMaint}</td>
    </tr>`,
    )
    .join("");

  const exp = a.expiringList.length
    ? `<div class="pf-scroll"><table><thead><tr><th>Building</th><th>Unit</th><th>Tenant</th><th>Lease ends</th><th>Left</th></tr></thead><tbody>${a.expiringList
        .slice(0, 25)
        .map(
          (u) => `<tr><td>${esc(a.bName[u.building_id])}</td><td>${esc(u.unit_number)}</td><td>${esc(u.tenant_name)}</td><td>${fmtDate(u.end_date)}</td><td>${dayBadge(daysLeft(u.end_date))}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : `<div class="pf-empty">No leases ending in the next 90 days.</div>`;

  const detail = opts.unitDetail
    ? `<div class="pf-card"><h3>Units</h3>${a.rows
        .map((r) => {
          const list = [...r.units].sort((x, y) => byNum(x.unit_number, y.unit_number));
          return `<details><summary>${esc(r.b.name)} — ${r.occupied}/${r.units.length} occupied</summary>
          <div class="pf-scroll"><table><thead><tr><th>Unit</th><th>Tenant</th><th class="r">Rent / year</th><th>Lease ends</th></tr></thead><tbody>${list
            .map(
              (u) => `<tr><td>${esc(u.unit_number)}</td><td>${isOcc(u) ? esc(u.tenant_name) : '<span class="badge badge-grey">Vacant</span>'}</td><td class="r">${isOcc(u) ? money(u.rent) : "-"}</td><td>${isOcc(u) ? fmtDate(u.end_date) : "-"}</td></tr>`,
            )
            .join("")}</tbody></table></div></details>`;
        })
        .join("")}</div>`
    : "";

  el.innerHTML = `
    <div class="pf-grid">${kpis}</div>
    <div class="pf-card"><h3>By building</h3><div class="pf-scroll"><table>
      <thead><tr><th>Building</th><th class="r">Units</th><th class="r">Occupied</th><th class="r">Occupancy</th><th class="r">Rent / month</th><th class="r">Ending ≤90d</th><th class="r">Bounced</th><th class="r">Open maint.</th></tr></thead>
      <tbody>${bRows}</tbody></table></div></div>
    <div class="pf-card"><h3>Leases ending in the next 90 days</h3>${exp}</div>
    ${detail}`;
}

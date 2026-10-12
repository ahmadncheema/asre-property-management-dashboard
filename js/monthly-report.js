// ================================================================
// ASRE Property Management Dashboard
// Monthly Report — builds a branded PDF for one or more buildings.
// Needs jsPDF loaded on the page (window.jspdf).
// Reusable: the landlord view can call generateMonthlyReport() too.
// ================================================================

import { supabase } from "./supabase.js";

// ── Look & layout (matches the invoice PDF) ───────────────────────
const BLUE = [42, 85, 144];
const GREEN = [62, 173, 130];
const GREY = [120, 120, 120];
const LIGHT = [220, 220, 220];
const BLACK = [30, 30, 30];
const WHITE = [255, 255, 255];
const RED = [200, 60, 60];
const PALE = [245, 247, 250];

const W = 210; // page width (mm)
const M = 18; // side margin
const CW = W - M * 2; // content width
const TOP = 40; // below the header artwork
const BOTTOM = 262; // above the footer line

// ── Small helpers ─────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const num = (v) => parseFloat(v) || 0;
const sum = (rows, f) => rows.reduce((s, r) => s + num(f(r)), 0);
const money = (n) => "AED " + Math.round(n).toLocaleString("en-US");
const day = (s) => (s || "").slice(0, 10);
const isOccupied = (u) => !!(u.tenant_name && u.tenant_name.trim());
const byNumber = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true });

function parseDay(s) {
  const [y, m, d] = day(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(s) {
  if (!s) return "-";
  return parseDay(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function daysFromToday(s) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((parseDay(s) - t) / 86400000);
}
function monthLabel(y, m) {
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}
function pct(a, b) {
  return b ? Math.round((a / b) * 1000) / 10 : 0;
}

// ── Load everything needed (one query per table) ──────────────────
async function load(buildingIds, y, m) {
  const mm = `${y}-${pad(m)}`;
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const prevFirst = `${prevY}-${pad(prevM)}-01`;
  const last = `${mm}-${pad(new Date(y, m, 0).getDate())}`; // no UTC shift

  // A missing table/column must not stop the whole report
  const get = async (label, query) => {
    const { data, error } = await query;
    if (error) {
      console.warn("Monthly report: could not load " + label, error);
      return [];
    }
    return data || [];
  };

  const ids = buildingIds;
  const [
    buildings,
    floors,
    units,
    cheques,
    bounces,
    maint,
    expenses,
    invoices,
    payments,
  ] = await Promise.all([
    get("buildings", supabase.from("buildings").select("*").in("id", ids)),
    get("floors", supabase.from("floors").select("*").in("building_id", ids)),
    get("units", supabase.from("units").select("*").in("building_id", ids)),
    get(
      "cheques",
      supabase
        .from("cheques")
        .select("*")
        .in("building_id", ids)
        .gte("cheque_date", prevFirst)
        .lte("cheque_date", last),
    ),
    get(
      "bounce_checks",
      supabase.from("bounce_checks").select("*").in("building_id", ids),
    ),
    get(
      "maintenance_requests",
      supabase
        .from("maintenance_requests")
        .select("*, units(unit_number)")
        .in("building_id", ids),
    ),
    get(
      "expenses",
      supabase
        .from("expenses")
        .select("*")
        .in("building_id", ids)
        .gte("expense_date", prevFirst)
        .lte("expense_date", last),
    ),
    get(
      "invoices",
      supabase
        .from("invoices")
        .select("*")
        .in("building_id", ids)
        .neq("type", "maintenance") // quotations are not invoices
        .gte("created_at", prevFirst)
        .lte("created_at", last + "T23:59:59"),
    ),
    get(
      "payment_log",
      supabase
        .from("payment_log")
        .select("*")
        .in("building_id", ids)
        .gte("payment_date", prevFirst)
        .lte("payment_date", last),
    ),
  ]);

  return {
    mm,
    pm: `${prevY}-${pad(prevM)}`,
    buildings,
    floors,
    units,
    cheques,
    bounces,
    maint,
    expenses,
    invoices,
    payments,
  };
}

// ── Work out the figures for one building ─────────────────────────
function analyse(b, d) {
  const mine = (rows) => rows.filter((r) => r.building_id === b.id);
  const floors = mine(d.floors).sort(
    (a, c) => (a.sort_order ?? 0) - (c.sort_order ?? 0),
  );
  const floorName = Object.fromEntries(floors.map((f) => [f.id, f.name]));

  const units = mine(d.units);
  const occupied = units.filter(isOccupied);
  const vacant = units.filter((u) => !isOccupied(u));

  // Same rule as the dashboard: rent is yearly, so monthly = yearly / 12
  const monthlyRent = Math.round(sum(occupied, (u) => u.rent) / 12);
  const mgmtFee = Math.round(monthlyRent * 0.01);

  const chq = mine(d.cheques);
  const chqNow = chq.filter((c) => day(c.cheque_date).startsWith(d.mm));
  const chqPrev = chq.filter((c) => day(c.cheque_date).startsWith(d.pm));
  const byStatus = (rows, s) => rows.filter((c) => c.status === s);
  const deposited = byStatus(chqNow, "deposited");
  const held = byStatus(chqNow, "held");
  const bouncedChq = byStatus(chqNow, "bounced");
  const depositedPrev = sum(byStatus(chqPrev, "deposited"), (c) => c.amount);

  const bounceRecs = mine(d.bounces);
  const bouncesThisMonth = bounceRecs.filter((x) =>
    day(x.date_of_bounce).startsWith(d.mm),
  );
  const bouncesActive = bounceRecs.filter((x) => x.status === "active");

  const maint = mine(d.maint);
  const opened = maint.filter((r) => day(r.created_at).startsWith(d.mm));
  const openedPrev = maint.filter((r) => day(r.created_at).startsWith(d.pm));
  const completed = maint.filter((r) => day(r.completed_at).startsWith(d.mm));
  const stillOpen = maint.filter((r) => r.status === "open");
  const maintCost = sum(opened, (r) => r.cost);

  const exp = mine(d.expenses);
  const expNow = exp.filter((e) => day(e.expense_date).startsWith(d.mm));
  const expPrev = exp.filter((e) => day(e.expense_date).startsWith(d.pm));
  const expTotal = sum(expNow, (e) => e.amount);
  const expByCat = {};
  expNow.forEach((e) => {
    const k = e.category || "Other";
    expByCat[k] = (expByCat[k] || 0) + num(e.amount);
  });

  const inv = mine(d.invoices);
  const invNow = inv.filter((i) => day(i.created_at).startsWith(d.mm));

  const pay = mine(d.payments);
  const payNow = pay.filter((p) => day(p.payment_date).startsWith(d.mm));

  const startingNow = occupied.filter((u) =>
    day(u.start_date).startsWith(d.mm),
  );
  const endingNow = occupied.filter((u) => day(u.end_date).startsWith(d.mm));
  const expiring = occupied
    .filter((u) => {
      if (!u.end_date) return false;
      const n = daysFromToday(u.end_date);
      return n >= 0 && n <= 90;
    })
    .sort((a, c) => day(a.end_date).localeCompare(day(c.end_date)));

  return {
    b,
    floors,
    floorName,
    units,
    occupied,
    vacant,
    occupancy: pct(occupied.length, units.length),
    monthlyRent,
    mgmtFee,
    chqNow,
    deposited,
    held,
    bouncedChq,
    depositedAmt: sum(deposited, (c) => c.amount),
    heldAmt: sum(held, (c) => c.amount),
    bouncedAmt: sum(bouncedChq, (c) => c.amount),
    totalChqAmt: sum(chqNow, (c) => c.amount),
    depositedPrev,
    bouncesThisMonth,
    bouncesActive,
    opened,
    openedPrev,
    completed,
    stillOpen,
    maintCost,
    expTotal,
    expPrevTotal: sum(expPrev, (e) => e.amount),
    expByCat,
    invCount: invNow.length,
    invTotal: sum(invNow, (i) => i.total),
    invVat: sum(invNow, (i) => i.vat_amount),
    paymentsTotal: sum(payNow, (p) => p.amount),
    startingNow,
    endingNow,
    expiring,
    net: monthlyRent - mgmtFee - expTotal,
  };
}

// ── PDF writer (tiny layout engine: sections, tables, page breaks) ─
function makeWriter(doc, bg) {
  let y = TOP;

  const drawBg = () => {
    if (bg) doc.addImage(bg, "PNG", 0, 0, 210, 297);
  };
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);

  const w = {
    get y() {
      return y;
    },
    set y(v) {
      y = v;
    },
    newPage() {
      doc.addPage();
      drawBg();
      y = TOP;
    },
    ensure(h) {
      if (y + h > BOTTOM) w.newPage();
    },
    gap(h = 4) {
      y += h;
    },

    text(
      str,
      x,
      yy,
      {
        size = 9,
        bold = false,
        color = BLACK,
        align = "left",
        italic = false,
      } = {},
    ) {
      doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
      doc.setFontSize(size);
      setText(color);
      doc.text(String(str), x, yy, { align });
    },

    // Blue section bar
    heading(title) {
      w.ensure(16);
      setFill(BLUE);
      doc.rect(M, y, CW, 7, "F");
      w.text(title.toUpperCase(), M + 3, y + 5, {
        size: 8.5,
        bold: true,
        color: WHITE,
      });
      y += 11;
    },

    // One wrapped paragraph
    para(str, opts = {}) {
      const size = opts.size || 8.5;
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(String(str), CW);
      // A bold caption introduces a table: keep it on the same page
      if (opts.bold) {
        w.ensure(5 + 7 + 6.4 * 2);
        y += 1.5;
      }
      lines.forEach((ln) => {
        w.ensure(5);
        w.text(ln, M, y + 3.5, {
          size,
          color: opts.color || GREY,
          bold: opts.bold,
        });
        y += 4.6;
      });
    },

    // Label ........ value rows
    rows(list, { labelW = 100 } = {}) {
      list.forEach(([label, value, color, bold]) => {
        w.ensure(6);
        w.text(label, M + 2, y + 4, { size: 9, color: GREY });
        w.text(value, M + labelW, y + 4, {
          size: 9,
          bold: bold !== false,
          color: color || BLACK,
          align: "right",
        });
        setDraw(LIGHT);
        doc.setLineWidth(0.1);
        doc.line(M, y + 6, M + labelW + 2, y + 6);
        y += 6.5;
      });
    },

    // KPI tiles across the page
    tiles(list) {
      w.ensure(24);
      const gapX = 4;
      const tw = (CW - gapX * (list.length - 1)) / list.length;
      list.forEach((t, i) => {
        const x = M + i * (tw + gapX);
        setFill(PALE);
        setDraw(LIGHT);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, tw, 20, 2, 2, "FD");
        w.text(t.label.toUpperCase(), x + tw / 2, y + 5.5, {
          size: 6.8,
          bold: true,
          color: GREY,
          align: "center",
        });
        w.text(t.value, x + tw / 2, y + 12.5, {
          size: 12.5,
          bold: true,
          color: t.color || BLUE,
          align: "center",
        });
        if (t.sub)
          w.text(t.sub, x + tw / 2, y + 17.2, {
            size: 6.8,
            color: GREY,
            align: "center",
          });
      });
      y += 25;
    },

    // Table with repeating header and automatic page breaks
    table(headers, widths, aligns, data, { boldLast = false } = {}) {
      const rowH = 6.4;
      const drawHeader = () => {
        setFill(BLUE);
        doc.rect(M, y, CW, 7, "F");
        let x = M;
        headers.forEach((h, i) => {
          const tx = aligns[i] === "right" ? x + widths[i] - 2 : x + 2;
          w.text(h, tx, y + 4.8, {
            size: 7.5,
            bold: true,
            color: WHITE,
            align: aligns[i] === "right" ? "right" : "left",
          });
          x += widths[i];
        });
        y += 7;
      };
      w.ensure(7 + rowH * 2);
      drawHeader();
      data.forEach((row, r) => {
        if (y + rowH > BOTTOM) {
          w.newPage();
          drawHeader();
        }
        const isLast = boldLast && r === data.length - 1;
        setFill(isLast ? [225, 232, 242] : r % 2 === 0 ? PALE : WHITE);
        doc.rect(M, y, CW, rowH, "F");
        let x = M;
        row.forEach((cell, i) => {
          const c =
            typeof cell === "object" && cell !== null ? cell : { v: cell };
          doc.setFont("helvetica", isLast || c.bold ? "bold" : "normal");
          doc.setFontSize(8);
          const fit =
            doc.splitTextToSize(String(c.v ?? "-"), widths[i] - 4)[0] || "";
          const tx = aligns[i] === "right" ? x + widths[i] - 2 : x + 2;
          w.text(fit, tx, y + 4.4, {
            size: 8,
            bold: isLast || c.bold,
            color: c.color || BLACK,
            align: aligns[i] === "right" ? "right" : "left",
          });
          x += widths[i];
        });
        y += rowH;
      });
      setDraw(BLUE);
      doc.setLineWidth(0.3);
      doc.line(M, y, M + CW, y);
      y += 5;
    },
  };
  w.drawBg = drawBg;
  return w;
}

// ── Page: portfolio summary (only when several buildings) ─────────
function portfolioPage(w, all, y, m) {
  w.text("MONTHLY PORTFOLIO SUMMARY", M, w.y, {
    size: 15,
    bold: true,
    color: BLUE,
  });
  w.text(monthLabel(y, m), W - M, w.y, {
    size: 11,
    bold: true,
    color: GREEN,
    align: "right",
  });
  w.gap(8);
  w.para(
    `${all.length} buildings. Figures are estimates built from the data entered in the dashboard.`,
  );
  w.gap(2);

  const tot = (f) => all.reduce((s, a) => s + f(a), 0);
  const unitsTotal = tot((a) => a.units.length);
  const occTotal = tot((a) => a.occupied.length);

  w.tiles([
    { label: "Buildings", value: String(all.length) },
    {
      label: "Occupancy",
      value: `${pct(occTotal, unitsTotal)}%`,
      sub: `${occTotal} of ${unitsTotal} units`,
      color: GREEN,
    },
    { label: "Monthly rent (est.)", value: money(tot((a) => a.monthlyRent)) },
    { label: "Net to owners", value: money(tot((a) => a.net)), color: GREEN },
  ]);

  w.heading("By building");
  const rows = all.map((a) => [
    { v: a.b.name, bold: true },
    a.units.length,
    a.occupied.length,
    `${a.occupancy}%`,
    money(a.monthlyRent),
    money(a.mgmtFee),
    money(a.expTotal),
    { v: money(a.net), color: a.net < 0 ? RED : BLACK, bold: true },
  ]);
  rows.push([
    "TOTAL",
    unitsTotal,
    occTotal,
    `${pct(occTotal, unitsTotal)}%`,
    money(tot((a) => a.monthlyRent)),
    money(tot((a) => a.mgmtFee)),
    money(tot((a) => a.expTotal)),
    money(tot((a) => a.net)),
  ]);
  w.table(
    [
      "Building",
      "Units",
      "Occ.",
      "Occ. %",
      "Rent / month",
      "Mgmt fee",
      "Expenses",
      "Net",
    ],
    [38, 13, 13, 15, 27, 21, 22, 25],
    ["left", "right", "right", "right", "right", "right", "right", "right"],
    rows,
    { boldLast: true },
  );

  w.heading("Needs attention");
  const attention = [];
  all.forEach((a) => {
    const bits = [];
    if (a.vacant.length) bits.push(`${a.vacant.length} vacant`);
    if (a.bouncedChq.length)
      bits.push(`${a.bouncedChq.length} bounced cheque(s) this month`);
    if (a.bouncesActive.length)
      bits.push(`${a.bouncesActive.length} bounce record(s) still active`);
    if (a.stillOpen.length)
      bits.push(`${a.stillOpen.length} open maintenance request(s)`);
    if (a.expiring.length)
      bits.push(`${a.expiring.length} lease(s) ending within 90 days`);
    attention.push([
      a.b.name,
      bits.length ? bits.join("  |  ") : "Nothing to flag",
    ]);
  });
  attention.forEach(([name, txt]) => {
    w.ensure(9);
    w.text(name, M + 2, w.y + 4, { size: 9, bold: true });
    w.y += 5;
    w.para(txt);
    w.gap(1);
  });
}

// ── Pages: one building ───────────────────────────────────────────
function buildingPages(w, a, y, m, d) {
  const b = a.b;

  // Title block
  w.text(b.name, M, w.y, { size: 15, bold: true, color: BLUE });
  w.text(monthLabel(y, m), W - M, w.y, {
    size: 11,
    bold: true,
    color: GREEN,
    align: "right",
  });
  w.gap(5);
  if (b.address) w.text(b.address, M, w.y, { size: 8.5, color: GREY });
  w.gap(6);

  // Headline numbers
  w.tiles([
    {
      label: "Occupancy",
      value: `${a.occupancy}%`,
      sub: `${a.occupied.length} of ${a.units.length} units`,
      color: GREEN,
    },
    { label: "Monthly rent (est.)", value: money(a.monthlyRent) },
    { label: "Mgmt fee (1%)", value: money(a.mgmtFee) },
    {
      label: "Net to owner",
      value: money(a.net),
      color: a.net < 0 ? RED : GREEN,
    },
  ]);

  // 1. Occupancy
  w.heading("1. Occupancy");
  w.rows([
    ["Total units", String(a.units.length)],
    ["Occupied", String(a.occupied.length)],
    ["Vacant", String(a.vacant.length), a.vacant.length ? RED : BLACK],
  ]);
  if (a.vacant.length) {
    const names = a.vacant
      .map((u) => u.unit_number)
      .sort(byNumber)
      .join(", ");
    w.para("Vacant units: " + names);
  }
  w.gap(3);

  // 2. Rent & cheques
  w.heading("2. Rent and cheques (cheques dated this month)");
  const prevNote =
    a.depositedPrev > 0
      ? `${money(a.depositedPrev)} last month`
      : "no deposits last month";
  w.rows(
    [
      ["Monthly rent estimate (yearly rent / 12)", money(a.monthlyRent)],
      [
        "Cheques dated this month",
        `${a.chqNow.length}  /  ${money(a.totalChqAmt)}`,
      ],
      [
        "   Deposited",
        `${a.deposited.length}  /  ${money(a.depositedAmt)}`,
        GREEN,
      ],
      [
        "   Held (not yet deposited)",
        `${a.held.length}  /  ${money(a.heldAmt)}`,
      ],
      [
        "   Bounced",
        `${a.bouncedChq.length}  /  ${money(a.bouncedAmt)}`,
        a.bouncedChq.length ? RED : BLACK,
      ],
      [
        "Collected so far (deposited / dated this month)",
        `${pct(a.depositedAmt, a.totalChqAmt)}%`,
      ],
      ["Deposited last month, for comparison", prevNote, GREY, false],
      ["Manual payments recorded this month", money(a.paymentsTotal)],
    ],
    { labelW: 150 },
  );
  w.gap(3);

  // 3. Bounced cheques
  w.heading("3. Bounced cheques");
  if (!a.bouncesThisMonth.length && !a.bouncesActive.length) {
    w.para("No bounced cheques recorded.");
  } else {
    const unitNo = Object.fromEntries(
      a.units.map((u) => [u.id, u.unit_number]),
    );
    const list = [...a.bouncesThisMonth];
    a.bouncesActive.forEach((x) => {
      if (!list.includes(x)) list.push(x);
    });
    w.table(
      ["Unit", "Tenant", "Bounce date", "Rent (AED)", "Status"],
      [20, 62, 32, 32, 28],
      ["left", "left", "left", "right", "left"],
      list.map((x) => [
        unitNo[x.unit_id] || "-",
        x.tenant_name || "-",
        fmtDate(x.date_of_bounce),
        Math.round(num(x.rent)).toLocaleString("en-US"),
        {
          v: x.status === "active" ? "Active" : "Resolved",
          color: x.status === "active" ? RED : GREEN,
          bold: true,
        },
      ]),
    );
  }

  // 4. Lease activity
  w.heading("4. Lease activity");
  const leaseRow = (u) => [
    u.unit_number,
    u.tenant_name,
    fmtDate(u.start_date),
    fmtDate(u.end_date),
  ];
  w.rows(
    [
      ["New leases starting this month", String(a.startingNow.length)],
      ["Leases ending this month", String(a.endingNow.length)],
      [
        `Leases ending in the next 90 days (as of ${fmtDate(new Date().toISOString())})`,
        String(a.expiring.length),
        a.expiring.length ? RED : BLACK,
      ],
    ],
    { labelW: 150 },
  );
  if (a.startingNow.length) {
    w.para("Leases starting this month:", { bold: true, color: BLACK });
    w.table(
      ["Unit", "Tenant", "Start", "End"],
      [22, 80, 36, 36],
      ["left", "left", "left", "left"],
      a.startingNow
        .sort((p, q) => byNumber(p.unit_number, q.unit_number))
        .map(leaseRow),
    );
  }
  if (a.endingNow.length) {
    w.para("Leases ending this month:", { bold: true, color: BLACK });
    w.table(
      ["Unit", "Tenant", "Start", "End"],
      [22, 80, 36, 36],
      ["left", "left", "left", "left"],
      a.endingNow
        .sort((p, q) => byNumber(p.unit_number, q.unit_number))
        .map(leaseRow),
    );
  }
  if (a.expiring.length) {
    w.para("Expiring within 90 days:", { bold: true, color: BLACK });
    w.table(
      ["Unit", "Tenant", "Lease end", "Days left", "Rent (AED / yr)"],
      [20, 66, 32, 22, 34],
      ["left", "left", "left", "right", "right"],
      a.expiring.map((u) => {
        const n = daysFromToday(u.end_date);
        return [
          u.unit_number,
          u.tenant_name,
          fmtDate(u.end_date),
          { v: String(n), color: n <= 30 ? RED : BLACK, bold: true },
          Math.round(num(u.rent)).toLocaleString("en-US"),
        ];
      }),
    );
  }
  w.gap(2);

  // 5. Maintenance
  w.heading("5. Maintenance");
  w.rows(
    [
      [
        "Requests opened this month",
        `${a.opened.length}  (last month ${a.openedPrev.length})`,
      ],
      ["Requests completed this month", String(a.completed.length)],
      [
        "Still open (all time)",
        String(a.stillOpen.length),
        a.stillOpen.length ? RED : BLACK,
      ],
      [
        "Cost logged on this month's requests",
        a.maintCost > 0 ? money(a.maintCost) : "Not recorded",
      ],
    ],
    { labelW: 150 },
  );
  if (a.opened.length) {
    w.para("Opened this month:", { bold: true, color: BLACK });
    const shown = a.opened.slice(0, 15);
    w.table(
      ["Unit", "Category", "Complaint", "Status"],
      [20, 34, 92, 28],
      ["left", "left", "left", "left"],
      shown.map((r) => [
        r.units?.unit_number || "-",
        r.category || "-",
        r.complaint || "-",
        {
          v: r.status === "open" ? "Open" : "Completed",
          color: r.status === "open" ? RED : GREEN,
          bold: true,
        },
      ]),
    );
    if (a.opened.length > shown.length)
      w.para(`...and ${a.opened.length - shown.length} more.`);
  }
  w.gap(2);

  // 6. Finance
  w.heading("6. Income, expenses and net to owner");
  const expDiff = a.expTotal - a.expPrevTotal;
  w.rows(
    [
      ["Monthly rent estimate", money(a.monthlyRent)],
      ["Management fee (1% of rent)", "- " + money(a.mgmtFee), RED],
      ["Expenses logged this month", "- " + money(a.expTotal), RED],
      ["Net to owner (estimate)", money(a.net), a.net < 0 ? RED : GREEN],
      [
        "Expenses last month, for comparison",
        money(a.expPrevTotal) +
          (a.expPrevTotal || a.expTotal
            ? `  (${expDiff >= 0 ? "+" : "-"}${money(Math.abs(expDiff))})`
            : ""),
        GREY,
        false,
      ],
      ["Invoices issued this month", `${a.invCount}  /  ${money(a.invTotal)}`],
      ["VAT on those invoices", money(a.invVat)],
    ],
    { labelW: 150 },
  );
  const cats = Object.entries(a.expByCat).sort((p, q) => q[1] - p[1]);
  if (cats.length) {
    w.para("Expenses by category:", { bold: true, color: BLACK });
    w.table(
      ["Category", "Amount (AED)"],
      [124, 50],
      ["left", "right"],
      cats.map(([k, v]) => [k, Math.round(v).toLocaleString("en-US")]),
    );
  }
  w.para(
    "Net to owner = estimated monthly rent - management fee - expenses logged in Finance. Maintenance costs count only when also logged as an expense.",
    { size: 7.5 },
  );
  w.gap(2);

  // 7. Unit by unit
  w.heading("7. Unit by unit");
  const floorsInOrder = [...a.floors];
  const known = new Set(floorsInOrder.map((f) => f.id));
  const orphan = a.units.filter((u) => !known.has(u.floor_id));
  floorsInOrder.forEach((f) => {
    const list = a.units
      .filter((u) => u.floor_id === f.id)
      .sort((p, q) => byNumber(p.unit_number, q.unit_number));
    if (!list.length) return;
    w.para("Floor: " + f.name, { bold: true, color: BLACK });
    w.table(
      ["Unit", "Tenant", "Size", "Rent (AED / yr)", "Lease end", "Status"],
      [18, 56, 22, 30, 24, 24],
      ["left", "left", "left", "right", "left", "left"],
      list.map(unitRow),
    );
  });
  if (orphan.length) {
    w.para("Other units", { bold: true, color: BLACK });
    w.table(
      ["Unit", "Tenant", "Size", "Rent (AED / yr)", "Lease end", "Status"],
      [18, 56, 22, 30, 24, 24],
      ["left", "left", "left", "right", "left", "left"],
      orphan
        .sort((p, q) => byNumber(p.unit_number, q.unit_number))
        .map(unitRow),
    );
  }
}

function unitRow(u) {
  const occ = isOccupied(u);
  let status = { v: "Vacant", color: RED, bold: true };
  if (occ) {
    const n = u.end_date ? daysFromToday(u.end_date) : null;
    status =
      n !== null && n < 0
        ? { v: "Expired", color: RED, bold: true }
        : n !== null && n <= 90
          ? { v: "Ending soon", color: [200, 130, 0], bold: true }
          : { v: "Occupied", color: GREEN, bold: true };
  }
  return [
    u.unit_number,
    occ ? u.tenant_name : "-",
    u.size || "-",
    occ ? Math.round(num(u.rent)).toLocaleString("en-US") : "-",
    occ ? fmtDate(u.end_date) : "-",
    status,
  ];
}

// ── Public: build and download the PDF ────────────────────────────
// buildingIds: array of building ids. year: 2026. month: 1-12.
export async function generateMonthlyReport({ buildingIds, year, month }) {
  if (!window.jspdf) throw new Error("PDF library not loaded");
  if (!buildingIds?.length) throw new Error("Select at least one building");

  const d = await load(buildingIds, year, month);
  if (!d.buildings.length) throw new Error("No buildings found");

  const all = d.buildings
    .slice()
    .sort((p, q) => byNumber(p.name, q.name))
    .map((b) => analyse(b, d));

  // Branded background (same artwork as the invoices)
  const bg = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "assets/logo/invoice-bg.png";
  });

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = makeWriter(doc, bg);
  w.drawBg();

  if (all.length > 1) {
    portfolioPage(w, all, year, month);
    all.forEach((a) => {
      w.newPage();
      buildingPages(w, a, year, month, d);
    });
  } else {
    buildingPages(w, all[0], year, month, d);
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.setLineWidth(0.2);
    doc.line(M, 269, W - M, 269);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.2);
    doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    doc.text(
      `Computer generated report - ${stamp}. Figures are estimates based on data entered in the dashboard. E&OE.`,
      M,
      272,
    );
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${pages}`, W - M, 272, { align: "right" });
  }

  const label =
    all.length === 1
      ? all[0].b.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")
      : "Multiple_Buildings";
  const filename = `ASRE_Monthly_Report_${label}_${year}-${pad(month)}.pdf`;
  doc.save(filename);
  return filename;
}

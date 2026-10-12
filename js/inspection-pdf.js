// ================================================================
// ASRE Property Management Dashboard
// Inspection report PDF (Move-In / Move-Out). Needs jsPDF on the page.
// ================================================================

const BLUE = [42, 85, 144];
const GREEN = [62, 173, 130];
const GREY = [120, 120, 120];
const LIGHT = [220, 220, 220];
const BLACK = [30, 30, 30];
const WHITE = [255, 255, 255];
const RED = [200, 60, 60];
const AMBER = [200, 130, 0];
const PALE = [245, 247, 250];

const W = 210,
  M = 18,
  CW = W - M * 2,
  TOP = 40,
  BOTTOM = 262;

export const CONDITIONS = ["Good", "Fair", "Damaged", "Missing"];
export const rank = (c) => Math.max(0, CONDITIONS.indexOf(c));
const condColor = (c) => (c === "Good" ? GREEN : c === "Fair" ? AMBER : RED);

function fmtDate(s) {
  if (!s) return "-";
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Load a photo (server URL or data URL) shrunk for the PDF
export async function smallPhoto(src, max = 700, q = 0.65) {
  let url = src,
    revoke = null;
  if (!src.startsWith("data:")) {
    const r = await fetch(src);
    if (!r.ok) throw new Error("photo not found");
    url = revoke = URL.createObjectURL(await r.blob());
  }
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  if (revoke) URL.revokeObjectURL(revoke);
  return { data: c.toDataURL("image/jpeg", q), w: c.width, h: c.height };
}

function loadBg() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "assets/logo/invoice-bg.png";
  });
}

// insp: the inspection row. ctx: { buildingName, unitNumber, baseline }
// baseline = the unit's move-in inspection (only used for move-out reports)
export async function buildInspectionPdf(insp, ctx) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const bg = await loadBg();
  const isOut = insp.type === "move_out";
  const base = isOut ? ctx.baseline : null;
  let y = TOP;

  const drawBg = () => bg && doc.addImage(bg, "PNG", 0, 0, 210, 297);
  const col = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const txt = (s, x, yy, o = {}) => {
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size || 9);
    col(o.color || BLACK);
    doc.text(String(s), x, yy, { align: o.align || "left" });
  };
  const ensure = (h) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      drawBg();
      y = TOP;
    }
  };
  const heading = (t) => {
    ensure(18);
    fill(BLUE);
    doc.rect(M, y, CW, 7, "F");
    txt(t.toUpperCase(), M + 3, y + 5, { size: 8.5, bold: true, color: WHITE });
    y += 10;
  };
  const wrap = (s, w, size = 8) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(String(s || ""), w);
  };

  drawBg();

  // ── Title block ────────────────────────────────────────────────
  txt(
    isOut ? "MOVE-OUT INSPECTION REPORT" : "MOVE-IN INSPECTION REPORT",
    M,
    y,
    { size: 15, bold: true, color: BLUE },
  );
  txt(fmtDate(insp.inspection_date), W - M, y, {
    size: 11,
    bold: true,
    color: GREEN,
    align: "right",
  });
  y += 8;

  const details = [
    ["Building", ctx.buildingName],
    ["Unit", ctx.unitNumber],
    ["Tenant", insp.tenant_name || "-"],
    ["Inspector", insp.inspector || "-"],
    ["Electricity meter", insp.electricity_meter || "-"],
    ["Water meter", insp.water_meter || "-"],
    ["Keys / access cards", insp.keys_count || "-"],
    ["Report type", isOut ? "Move-Out" : "Move-In"],
  ];
  for (let i = 0; i < details.length; i += 2) {
    [0, 1].forEach((k) => {
      const [l, v] = details[i + k];
      const x = M + k * (CW / 2);
      txt(l, x + 2, y + 4, { size: 8, color: GREY });
      txt(wrap(v, CW / 2 - 40, 9)[0] || "-", x + 36, y + 4, {
        size: 9,
        bold: true,
      });
    });
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.setLineWidth(0.1);
    doc.line(M, y + 6, M + CW, y + 6);
    y += 6.5;
  }
  y += 4;

  // ── Move-out: what changed since move-in ───────────────────────
  const baseMap = {};
  if (base)
    base.rooms.forEach((r) =>
      r.items.forEach((it) => (baseMap[r.name + "|" + it.name] = it)),
    );
  if (isOut) {
    heading("Changes since move-in");
    if (!base) {
      txt(
        "No move-in inspection was found for this unit, so no comparison is possible.",
        M,
        y + 3,
        { size: 8.5, color: GREY },
      );
      y += 8;
    } else {
      txt("Move-in report dated " + fmtDate(base.inspection_date), M, y + 3, {
        size: 8,
        color: GREY,
      });
      y += 6;
      const diffs = [];
      insp.rooms.forEach((r) =>
        r.items.forEach((it) => {
          const b = baseMap[r.name + "|" + it.name];
          if (b && rank(it.cond) > rank(b.cond))
            diffs.push([r.name, it.name, b.cond, it.cond, it.note || ""]);
        }),
      );
      if (!diffs.length) {
        txt("No items are in worse condition than at move-in.", M, y + 3, {
          size: 9,
          bold: true,
          color: GREEN,
        });
        y += 8;
      } else {
        tableHeader(
          ["Room", "Item", "Move-in", "Move-out", "Notes"],
          [34, 40, 22, 22, 56],
        );
        diffs.forEach((d) =>
          row(
            [
              d[0],
              d[1],
              { v: d[2], c: condColor(d[2]) },
              { v: d[3], c: condColor(d[3]) },
              d[4],
            ],
            [34, 40, 22, 22, 56],
          ),
        );
        y += 4;
      }
    }
  }

  // ── Table helpers (closures so they share y / doc) ─────────────
  function tableHeader(h, w) {
    ensure(7 + 7);
    fill(PALE);
    doc.rect(M, y, CW, 6, "F");
    let x = M;
    h.forEach((t, i) => {
      txt(t, x + 2, y + 4.2, { size: 7.5, bold: true, color: GREY });
      x += w[i];
    });
    y += 6;
  }
  function row(cells, w) {
    const lines = cells.map((c, i) =>
      wrap(typeof c === "object" ? c.v : c, w[i] - 3),
    );
    const h = Math.max(6, Math.max(...lines.map((l) => l.length)) * 3.8 + 2.4);
    if (y + h > BOTTOM) {
      doc.addPage();
      drawBg();
      y = TOP;
    }
    let x = M;
    cells.forEach((c, i) => {
      const o = typeof c === "object" ? c : { v: c };
      lines[i].forEach((ln, k) =>
        txt(ln, x + 2, y + 4 + k * 3.8, {
          size: 8,
          bold: !!o.c,
          color: o.c || BLACK,
        }),
      );
      x += w[i];
    });
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.setLineWidth(0.1);
    doc.line(M, y + h, M + CW, y + h);
    y += h;
  }

  // ── Rooms ──────────────────────────────────────────────────────
  for (const r of insp.rooms) {
    heading(r.name);
    const w = base ? [42, 24, 24, 84] : [52, 26, 96];
    tableHeader(
      base
        ? ["Item", "Move-in", "Move-out", "Notes"]
        : ["Item", "Condition", "Notes"],
      w,
    );
    r.items.forEach((it) => {
      const cells = [it.name];
      if (base) {
        const b = baseMap[r.name + "|" + it.name];
        cells.push(b ? { v: b.cond, c: condColor(b.cond) } : "-");
      }
      cells.push({ v: it.cond, c: condColor(it.cond) });
      cells.push(it.note || "");
      row(cells, w);
    });
    if (r.note) {
      y += 1.5;
      wrap("Room notes: " + r.note, CW - 4).forEach((ln) => {
        ensure(5);
        txt(ln, M + 2, y + 3, { size: 8, color: GREY });
        y += 4;
      });
    }
    // Photos, 3 per row
    const photos = [];
    for (const p of r.photos || []) {
      try {
        photos.push(await smallPhoto(p.url || p.data));
      } catch (e) {
        /* skip a missing photo */
      }
    }
    if (photos.length) {
      y += 3;
      const pw = (CW - 8) / 3,
        ph = pw * 0.75;
      for (let i = 0; i < photos.length; i += 3) {
        ensure(ph + 3);
        for (let k = 0; k < 3 && i + k < photos.length; k++) {
          const p = photos[i + k];
          const s = Math.min(pw / p.w, ph / p.h);
          const iw = p.w * s,
            ih = p.h * s;
          doc.addImage(
            p.data,
            "JPEG",
            M + k * (pw + 4) + (pw - iw) / 2,
            y + (ph - ih) / 2,
            iw,
            ih,
          );
        }
        y += ph + 3;
      }
    }
    y += 5;
  }

  // ── Notes + signatures ─────────────────────────────────────────
  if (insp.general_notes) {
    heading("General notes");
    wrap(insp.general_notes, CW - 4, 9).forEach((ln) => {
      ensure(5);
      txt(ln, M + 2, y + 3, { size: 9 });
      y += 4.6;
    });
    y += 4;
  }
  heading("Confirmation");
  ensure(52);
  wrap(
    "The tenant confirms that this report fairly records the condition of the apartment on the date above.",
    CW,
    8.5,
  ).forEach((ln) => {
    txt(ln, M, y + 3, { size: 8.5, color: GREY });
    y += 4.4;
  });
  y += 4;
  doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.roundedRect(M, y, CW / 2 - 3, 34, 2, 2);
  doc.roundedRect(M + CW / 2 + 3, y, CW / 2 - 3, 34, 2, 2);
  txt("TENANT SIGNATURE", M + 3, y + 5, { size: 7, bold: true, color: GREY });
  txt("INSPECTOR", M + CW / 2 + 6, y + 5, { size: 7, bold: true, color: GREY });
  if (insp.tenant_signature) {
    try {
      doc.addImage(insp.tenant_signature, "PNG", M + 4, y + 7, 60, 20);
    } catch (e) {
      /* ignore */
    }
  }
  txt(
    (insp.tenant_name || "") +
      (insp.signed_at ? "  -  " + fmtDate(insp.signed_at) : ""),
    M + 3,
    y + 31,
    { size: 8 },
  );
  txt(insp.inspector || "-", M + CW / 2 + 6, y + 20, { size: 10, bold: true });
  txt(fmtDate(insp.inspection_date), M + CW / 2 + 6, y + 31, { size: 8 });

  // ── Footer on every page ───────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.setLineWidth(0.2);
    doc.line(M, 269, W - M, 269);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.2);
    col(GREY);
    doc.text("Computer generated inspection report. E&OE.", M, 272);
    doc.setFont("helvetica", "normal");
    doc.text("Page " + i + " of " + pages, W - M, 272, { align: "right" });
  }
  return doc;
}

export function inspectionFilename(insp, ctx) {
  const clean = (s) =>
    String(s || "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return `ASRE_${insp.type === "move_out" ? "MoveOut" : "MoveIn"}_${clean(ctx.buildingName)}_Unit_${clean(ctx.unitNumber)}_${String(insp.inspection_date).slice(0, 10)}.pdf`;
}

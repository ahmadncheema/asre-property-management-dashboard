// ================================================================
// ASRE Property Management Dashboard
// Tenant Move-In / Move-Out Inspection Form: data defaults + PDF.
// One form per tenancy: Move-In columns first, Move-Out columns later.
// Needs jsPDF on the page (window.jspdf).
// ================================================================

const BLUE = [42, 85, 144];
const GREEN = [62, 173, 130];
const GREY = [120, 120, 120];
const LIGHT = [200, 205, 212];
const BLACK = [30, 30, 30];
const WHITE = [255, 255, 255];
const RED = [200, 60, 60];
const AMBER = [200, 130, 0];
const PALE = [238, 241, 246];

const W = 210,
  M = 18,
  CW = W - M * 2,
  TOP = 40,
  BOTTOM = 262;

// ── Shared labels (the page uses these too) ───────────────────────
export const COND = { G: "Good", F: "Fair", P: "Poor", NA: "N/A" };
export const YN = { Y: "Yes", N: "No", NA: "N/A" };

// ── Default content, copied from the paper form ───────────────────
export const KEY_ITEMS = [
  "Main Entrance Door Key(s)",
  "Bedroom Door Key(s)",
  "Mailbox Key",
  "Building / Lobby Access Card(s)",
  "Parking Remote / Access Card",
  "Garage / Gate Remote",
  "Storage Room Key",
];
export const UTILITY_ITEMS = [
  "DEWA (Electricity & Water)",
  "District Cooling / Chiller",
  "Etisalat / du (Internet)",
  "Gas (if applicable)",
];
export const APPLIANCE_ITEMS = [
  "Air Conditioning Unit(s)",
  "Water Heater",
  "Kitchen Appliances (Hob / Oven / Hood)",
  "Refrigerator",
  "Washing Machine",
  "Built-in Wardrobes",
  "Light Fixtures",
  "Curtains / Blinds",
];
export const DOCUMENT_ITEMS = [
  "Copy of Emirates ID",
  "Copy of Passport & Residence Visa",
  "Signed Tenancy Contract & Addendum",
  "Security Deposit (Cheque / Transfer Receipt)",
  "Rent Cheques (as per agreed schedule)",
  "Car Parking Space Undertaking Form",
];

export function emptyArea(name) {
  return {
    id: crypto.randomUUID(),
    name,
    in_cond: "",
    in_rem: "",
    out_cond: "",
    out_rem: "",
    photos: [],
  };
}
export function defaultAreas(bedrooms = 1, bathrooms = 1, balcony = true) {
  const a = [emptyArea("Living / Dining")];
  if (bedrooms === 0) a.push(emptyArea("Studio Room"));
  for (let i = 1; i <= bedrooms; i++)
    a.push(emptyArea(i === 1 ? "Master Bedroom" : "Bedroom " + i));
  a.push(emptyArea("Kitchen"));
  for (let i = 1; i <= bathrooms; i++) a.push(emptyArea("Bathroom " + i));
  if (balcony) a.push(emptyArea("Balcony"));
  a.push(emptyArea("Entrance / Hallway"));
  return a;
}
export function emptyForm() {
  return {
    id: crypto.randomUUID(),
    isNew: true,
    building_id: "",
    unit_id: "",
    location: "",
    landlord_name: "",
    landlord_eid: "",
    landlord_tel: "",
    landlord_email: "",
    tenant_name: "",
    contract_no: "",
    ejari_no: "",
    contract_from: "",
    contract_to: "",
    annual_rent: "",
    security_deposit: "",
    move_in_date: "",
    move_out_date: "",
    tenant_mobile: "",
    tenant_email: "",
    emirates_id: "",
    nationality: "",
    passport_no: "",
    forwarding_address: "",
    inspector: "",
    insp_in_date: "",
    insp_out_date: "",
    occupants: [1, 2, 3, 4].map(() => ({
      name: "",
      relationship: "",
      id_no: "",
    })),
    utilities: UTILITY_ITEMS.map((n) => ({
      name: n,
      account: "",
      read_in: "",
      read_out: "",
    })),
    keys: KEY_ITEMS.map((n) => ({
      item: n,
      qty_in: "",
      conf_in: false,
      qty_out: "",
      conf_out: false,
    })),
    areas: defaultAreas(),
    remarks_in: [""],
    remarks_out: [""],
    appliances: APPLIANCE_ITEMS.map((n) => ({
      name: n,
      w_in: "",
      w_out: "",
      remarks: "",
    })),
    documents: DOCUMENT_ITEMS.map((n) => ({ name: n, status: "" })),
  };
}

// ── Helpers ───────────────────────────────────────────────────────
function fmtDate(s) {
  if (!s) return "";
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!y) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
const money = (v) =>
  v === "" || v == null ? "" : Number(v).toLocaleString("en-US");
const condColor = (c) =>
  c === "G" ? GREEN : c === "F" ? AMBER : c === "P" ? RED : GREY;

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

// ── The PDF ───────────────────────────────────────────────────────
// f: the form. ctx: { buildingName, unitNumber }
export async function buildInspectionPdf(f, ctx) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const bg = await loadBg();
  let y = TOP;

  const drawBg = () => bg && doc.addImage(bg, "PNG", 0, 0, 210, 297);
  const col = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const line = (c, w = 0.2) => {
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(w);
  };
  const txt = (s, x, yy, o = {}) => {
    doc.setFont("helvetica", o.bold ? "bold" : o.italic ? "italic" : "normal");
    doc.setFontSize(o.size || 8.5);
    col(o.color || BLACK);
    doc.text(String(s), x, yy, { align: o.align || "left" });
  };
  const wrap = (s, w, size = 8.5, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    return String(s ?? "")
      .split("\n")
      .flatMap((p) => (p === "" ? [""] : doc.splitTextToSize(p, w)));
  };
  const ensure = (h) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      drawBg();
      y = TOP;
    }
  };
  const heading = (t) => {
    ensure(22);
    fill(BLUE);
    doc.rect(M, y, CW, 6.5, "F");
    txt(t.toUpperCase(), M + 2.5, y + 4.6, {
      size: 8.5,
      bold: true,
      color: WHITE,
    });
    y += 6.5;
  };

  // Table: cols [{h, w, align}], rows [[cell]] where cell = text | {v, c, bold}
  const table = (cols, rows, minH = 6.4) => {
    const header = () => {
      ensure(minH + 7 + 6);
      fill(BLACK.map((v) => v + 8)); // dark header, like the paper form
      doc.rect(M, y, CW, 7, "F");
      let x = M;
      cols.forEach((c) => {
        const lines = wrap(c.h, c.w - 3, 7.2, true);
        lines
          .slice(0, 2)
          .forEach((ln, k) =>
            txt(ln, x + 1.8, y + (lines.length > 1 ? 3 + k * 2.9 : 4.6), {
              size: 7.2,
              bold: true,
              color: WHITE,
            }),
          );
        x += c.w;
      });
      y += 7;
    };
    header();
    rows.forEach((r) => {
      const cells = r.map((c) =>
        typeof c === "object" && c !== null ? c : { v: c },
      );
      const lines = cells.map((c, i) =>
        wrap(c.v, cols[i].w - 3.6, 8, !!c.bold),
      );
      const h = Math.max(
        minH,
        Math.max(...lines.map((l) => l.length)) * 3.8 + 2.6,
      );
      if (y + h > BOTTOM) {
        doc.addPage();
        drawBg();
        y = TOP;
        header();
      }
      let x = M;
      cells.forEach((c, i) => {
        if (c.fillc) {
          fill(c.fillc);
          doc.rect(x, y, cols[i].w, h, "F");
        }
        line(LIGHT, 0.2);
        doc.rect(x, y, cols[i].w, h);
        lines[i].forEach((ln, k) => {
          const tx = cols[i].align === "center" ? x + cols[i].w / 2 : x + 1.8;
          txt(ln, tx, y + 4.3 + k * 3.8, {
            size: 8,
            bold: !!c.bold,
            color: c.c || BLACK,
            align: cols[i].align === "center" ? "center" : "left",
          });
        });
        x += cols[i].w;
      });
      y += h;
    });
    y += 5;
  };

  // Label/value grid (like sections 1 and 2 of the paper form)
  const grid = (rows) => {
    rows.forEach((r) => {
      const four = r.length === 4;
      const ws = four ? [38, 49, 38, 49] : [38, 136];
      const lines = r.map((c, i) => wrap(c, ws[i] - 3.6, 8, i % 2 === 0));
      const h = Math.max(
        6.4,
        Math.max(...lines.map((l) => l.length)) * 3.8 + 2.6,
      );
      ensure(h);
      let x = M;
      r.forEach((c, i) => {
        const isLabel = i % 2 === 0;
        if (isLabel) {
          fill(PALE);
          doc.rect(x, y, ws[i], h, "F");
        }
        line(LIGHT, 0.2);
        doc.rect(x, y, ws[i], h);
        lines[i].forEach((ln, k) =>
          txt(ln, x + 1.8, y + 4.3 + k * 3.8, {
            size: 8,
            bold: isLabel,
            color: isLabel ? GREY : BLACK,
          }),
        );
        x += ws[i];
      });
      y += h;
    });
    y += 5;
  };

  drawBg();

  // ── Title ──────────────────────────────────────────────────────
  txt("TENANT MOVE-IN / MOVE-OUT INSPECTION FORM", W / 2, y, {
    size: 13.5,
    bold: true,
    color: BLUE,
    align: "center",
  });
  y += 5;
  txt("Property Handover & Unit Condition Report", W / 2, y, {
    size: 9,
    italic: true,
    color: GREY,
    align: "center",
  });
  y += 5;
  wrap(
    "This single form is used at both the start and the end of the tenancy. The left-hand (Move-In) columns are completed when the Tenant takes possession of the unit. The form is then retained and the right-hand (Move-Out) columns are completed at the same inspection points when the Tenant vacates, so that conditions can be compared fairly.",
    CW,
    7.2,
  ).forEach((ln) => {
    txt(ln, M, y + 2.5, { size: 7.2, italic: true, color: GREY });
    y += 3.3;
  });
  y += 3;

  // Move-In / Move-Out boxes
  const box = (x, label, date) => {
    line(LIGHT, 0.3);
    doc.rect(x, y, CW / 2, 10);
    line(BLACK, 0.4);
    doc.rect(x + 2.5, y + 2.6, 4, 4);
    if (date) {
      doc.line(x + 3, y + 3.1, x + 6, y + 6.1);
      doc.line(x + 6, y + 3.1, x + 3, y + 6.1);
    }
    txt(label, x + 9, y + 5.6, { size: 8.5, bold: true });
    txt("Date: " + fmtDate(date), x + 9, y + 9, { size: 7.5, color: GREY });
  };
  box(M, "MOVE-IN INSPECTION", f.insp_in_date);
  box(M + CW / 2, "MOVE-OUT INSPECTION", f.insp_out_date);
  y += 14;

  // ── 1. Property & tenancy ──────────────────────────────────────
  heading("1. Property & Tenancy Details");
  const landlord = [
    f.landlord_name,
    [
      f.landlord_eid && "EID: " + f.landlord_eid,
      f.landlord_tel && "Tel: " + f.landlord_tel,
    ]
      .filter(Boolean)
      .join("  |  "),
    f.landlord_email && "Email: " + f.landlord_email,
  ]
    .filter(Boolean)
    .join("\n");
  grid([
    ["Property / Building Name", ctx.buildingName || ""],
    ["Unit No.", ctx.unitNumber || ""],
    ["Location / Community", f.location],
    ["Landlord Name", landlord],
    ["Tenant Name", f.tenant_name],
    ["Tenancy Contract No.", f.contract_no],
    ["Ejari Registration No.", f.ejari_no],
  ]);
  grid([
    [
      "Contract Period (From)",
      fmtDate(f.contract_from),
      "Contract Period (To)",
      fmtDate(f.contract_to),
    ],
    [
      "Annual Rent (AED)",
      money(f.annual_rent),
      "Security Deposit (AED)",
      money(f.security_deposit),
    ],
    [
      "Move-In Date",
      fmtDate(f.move_in_date),
      "Move-Out Date",
      fmtDate(f.move_out_date),
    ],
  ]);

  // ── 2. Tenant contact ──────────────────────────────────────────
  heading("2. Tenant Contact Information");
  grid([
    ["Mobile Number", f.tenant_mobile, "Email Address", f.tenant_email],
    ["Emirates ID No.", f.emirates_id, "Nationality", f.nationality],
    [
      "Passport No.",
      f.passport_no,
      "Forwarding Address (Move-Out)",
      f.forwarding_address,
    ],
  ]);

  // ── 3. Occupants ───────────────────────────────────────────────
  heading("3. Occupants Residing in the Unit");
  txt(
    "In accordance with the Tenancy Contract Addendum, occupancy is limited to the registered Tenant and immediate family members only.",
    M,
    y + 3.5,
    { size: 7.2, italic: true, color: GREY },
  );
  y += 6;
  table(
    [
      { h: "#", w: 10, align: "center" },
      { h: "Full Name", w: 64 },
      { h: "Relationship to Tenant", w: 50 },
      { h: "Emirates ID / Passport No.", w: 50 },
    ],
    f.occupants.map((o, i) => [String(i + 1), o.name, o.relationship, o.id_no]),
  );

  // ── 4. Utilities ───────────────────────────────────────────────
  heading("4. Utility Accounts & Meter Readings");
  txt(
    "The Tenant is responsible for transferring utility accounts into their own name at move-in, and for disconnecting / settling final bills at move-out.",
    M,
    y + 3.5,
    { size: 7.2, italic: true, color: GREY },
  );
  y += 6;
  table(
    [
      { h: "Utility / Service", w: 56 },
      { h: "Account No.", w: 36 },
      { h: "Reading at Move-In", w: 41 },
      { h: "Reading at Move-Out", w: 41 },
    ],
    f.utilities.map((u) => [u.name, u.account, u.read_in, u.read_out]),
  );

  // ── 5. Keys ────────────────────────────────────────────────────
  heading("5. Keys & Access Devices");
  table(
    [
      { h: "Item", w: 54 },
      { h: "Qty Issued (Move-In)", w: 30 },
      { h: "Confirmed (Move-In)", w: 30 },
      { h: "Qty Returned (Move-Out)", w: 30 },
      { h: "Confirmed (Move-Out)", w: 30 },
    ],
    f.keys.map((k) => [
      k.item,
      k.qty_in,
      k.conf_in ? "Yes" : "",
      k.qty_out,
      k.conf_out ? "Yes" : "",
    ]),
  );

  // ── 6. Unit condition ──────────────────────────────────────────
  heading("6. Unit Condition Inspection");
  txt("Condition key: G = Good  |  F = Fair  |  P = Poor.", M, y + 3.5, {
    size: 7.2,
    italic: true,
    color: GREY,
  });
  y += 6;
  const cc = (c) =>
    c ? { v: COND[c].toUpperCase(), c: condColor(c), bold: true } : "";
  table(
    [
      { h: "Area", w: 36 },
      { h: "Move-In Condition", w: 24 },
      { h: "Move-In Remarks", w: 48 },
      { h: "Move-Out Condition", w: 24 },
      { h: "Move-Out Remarks", w: 42 },
    ],
    f.areas.map((a) => [
      { v: a.name, bold: true },
      cc(a.in_cond),
      a.in_rem,
      cc(a.out_cond),
      a.out_rem,
    ]),
  );
  const remarks = (title, list) => {
    const items = (list || []).filter((t) => t && t.trim());
    table(
      [
        { h: "#", w: 10, align: "center" },
        { h: title, w: 164 },
      ],
      items.length ? items.map((t, i) => [String(i + 1), t]) : [["", ""]],
      6,
    );
  };
  remarks("MOVE-IN REMARKS (RECORDED PRIOR TO HANDOVER)", f.remarks_in);
  if (f.insp_out_date || (f.remarks_out || []).some((t) => t && t.trim()))
    remarks("MOVE-OUT REMARKS", f.remarks_out);

  // ── 7. Appliances ──────────────────────────────────────────────
  heading("7. Appliances & Fixtures (if furnished / semi-furnished)");
  const yn = (v) =>
    v
      ? { v: YN[v], c: v === "Y" ? GREEN : v === "N" ? RED : GREY, bold: true }
      : "";
  table(
    [
      { h: "Appliance / Fixture", w: 58 },
      { h: "Move-In Working (Y/N)", w: 30 },
      { h: "Move-Out Working (Y/N)", w: 30 },
      { h: "Remarks", w: 56 },
    ],
    f.appliances.map((a) => [a.name, yn(a.w_in), yn(a.w_out), a.remarks]),
  );

  // ── 8. Documents ───────────────────────────────────────────────
  heading("8. Documents Collected From Tenant (Move-In)");
  table(
    [
      { h: "#", w: 10, align: "center" },
      { h: "Document / Item", w: 114 },
      { h: "Received", w: 25, align: "center" },
      { h: "N/A", w: 25, align: "center" },
    ],
    f.documents.map((d, i) => [
      String(i + 1),
      d.name,
      d.status === "Y" ? { v: "YES", c: GREEN, bold: true } : "",
      d.status === "NA" ? { v: "N/A", c: GREY, bold: true } : "",
    ]),
  );

  // ── Photos ─────────────────────────────────────────────────────
  const withPhotos = f.areas.filter((a) => (a.photos || []).length);
  if (withPhotos.length) {
    doc.addPage();
    drawBg();
    y = TOP;
    heading("Photos");
    const pw = (CW - 8) / 3,
      ph = pw * 0.75;
    for (const a of withPhotos) {
      const loaded = [];
      for (const p of a.photos) {
        try {
          loaded.push({
            ...(await smallPhoto(p.url || p.data)),
            phase: p.phase,
          });
        } catch (e) {
          /* skip a missing photo */
        }
      }
      if (!loaded.length) continue;
      ensure(ph + 14);
      txt(a.name, M, y + 4, { size: 9, bold: true });
      y += 6;
      for (let i = 0; i < loaded.length; i += 3) {
        ensure(ph + 8);
        for (let k = 0; k < 3 && i + k < loaded.length; k++) {
          const p = loaded[i + k];
          const s = Math.min(pw / p.w, ph / p.h);
          const iw = p.w * s,
            ih = p.h * s;
          const x = M + k * (pw + 4);
          doc.addImage(
            p.data,
            "JPEG",
            x + (pw - iw) / 2,
            y + (ph - ih) / 2,
            iw,
            ih,
          );
          txt(p.phase === "out" ? "Move-Out" : "Move-In", x, y + ph + 3.5, {
            size: 7,
            color: GREY,
          });
        }
        y += ph + 6;
      }
      y += 2;
    }
  }

  // ── Footer on every page ───────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    line(LIGHT, 0.2);
    doc.line(M, 269, W - M, 269);
    txt("Computer generated inspection form. E&OE.", M, 272, {
      size: 7.2,
      italic: true,
      color: GREY,
    });
    txt("Page " + i + " of " + pages, W - M, 272, {
      size: 7.2,
      color: GREY,
      align: "right",
    });
  }
  return doc;
}

export function inspectionFilename(f, ctx) {
  const clean = (s) =>
    String(s || "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return `ASRE_Inspection_${clean(ctx.buildingName)}_Unit_${clean(ctx.unitNumber)}.pdf`;
}

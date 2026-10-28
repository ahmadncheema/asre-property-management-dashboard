// ================================================================
// ASRE Property Management Dashboard
// Maintenance reports as PDF: one request, or a whole building.
// Photos are placed inside the PDF. Needs jsPDF on the page (window.jspdf).
// ================================================================

const BLUE = [42, 85, 144];
const GREEN = [62, 173, 130];
const GREY = [120, 120, 120];
const BLACK = [30, 30, 30];
const WHITE = [255, 255, 255];
const AMBER = [200, 130, 0];
const PALE = [238, 241, 246];
const LINE = [214, 219, 227];
const W = 210, M = 18, CW = W - M * 2, TOP = 40, BOTTOM = 262;

// jsPDF's built-in font only knows Latin characters
const clean = (s) =>
  String(s ?? "")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/[^\x20-\x7E -ÿ\n]/g, "");

const fmt = (d) => {
  if (!d) return "-";
  const x = new Date(d);
  return isNaN(x) ? "-" : x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dubai" });
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// A photo from the server, as a (smaller) JPEG that jsPDF can place
async function photoData(url, max = 1100) {
  try {
    const blob = await (await fetch(url)).blob();
    const obj = URL.createObjectURL(blob);
    const img = await loadImage(obj);
    URL.revokeObjectURL(obj);
    if (!img) return null;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.8), w: c.width, h: c.height };
  } catch (e) { return null; }
}

// records: [{ ...request row (with units, floors, buildings), photos: [{url}] }]
// opts: { title, subtitle, photos: true/false, summary: true/false }
async function build(records, opts) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const bg = await loadImage("assets/logo/invoice-bg.png");
  let y = TOP;

  const drawBg = () => bg && doc.addImage(bg, "PNG", 0, 0, 210, 297);
  drawBg();
  const col = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const txt = (s, x, yy, o = {}) => {
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size || 9);
    col(o.color || BLACK);
    doc.text(clean(s), x, yy, { align: o.align || "left" });
  };
  const wrap = (s, w, size = 9, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    return clean(s).split("\n").flatMap((p) => (p === "" ? [""] : doc.splitTextToSize(p, w)));
  };
  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); drawBg(); y = TOP; } };

  // title
  txt("Ahmed Al Sheebani Real Estate L.L.C", M, y, { size: 12, bold: true, color: BLUE });
  txt(opts.title, W - M, y, { size: 17, bold: true, color: BLACK, align: "right" });
  y += 6;
  txt(opts.subtitle || "", W - M, y, { size: 8.5, color: GREY, align: "right" });
  txt("Generated " + fmt(new Date()), M, y, { size: 8.5, color: GREY });
  y += 8;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 6;

  // summary line(s)
  if (opts.summary) {
    const open = records.filter((r) => r.status !== "completed").length;
    const done = records.length - open;
    const photos = records.reduce((n, r) => n + (r.photos ? r.photos.length : 0), 0);
    doc.setFillColor(...PALE); doc.roundedRect(M, y, CW, 14, 1.5, 1.5, "F");
    [["TOTAL", records.length, BLUE], ["OPEN", open, AMBER], ["COMPLETED", done, GREEN], ["PHOTOS", photos, GREY]].forEach(([l, n, c], i) => {
      const x = M + 6 + i * (CW / 4);
      txt(String(n), x, y + 7.2, { size: 13, bold: true, color: c });
      txt(l, x, y + 11.5, { size: 6.8, color: GREY });
    });
    y += 20;
  }

  let currentBuilding = null;
  for (const r of records) {
    const bName = r.buildings && r.buildings.name ? r.buildings.name : "Unknown building";
    if (opts.groupByBuilding && bName !== currentBuilding) {
      ensure(18);
      doc.setFillColor(...BLUE); doc.rect(M, y, CW, 7.5, "F");
      txt(bName.toUpperCase(), M + 2.5, y + 5.2, { size: 9.5, bold: true, color: WHITE });
      y += 11;
      currentBuilding = bName;
    }
    const done = r.status === "completed";
    // request header
    ensure(34);
    doc.setFillColor(...PALE); doc.rect(M, y, CW, 8, "F");
    doc.setFillColor(...(done ? GREEN : AMBER)); doc.rect(M, y, 1.6, 8, "F");
    txt(`Unit ${r.units && r.units.unit_number ? r.units.unit_number : "-"}${r.floors && r.floors.name ? "  |  Floor " + r.floors.name : ""}${opts.groupByBuilding ? "" : "  |  " + bName}`, M + 4, y + 5.4, { size: 9.5, bold: true });
    txt((done ? "COMPLETED" : "OPEN") + "  |  " + (r.category || "Other"), W - M - 2, y + 5.4, { size: 8, bold: true, color: done ? GREEN : AMBER, align: "right" });
    y += 11;
    const meta = [
      ["Tenant", r.units && r.units.tenant_name ? r.units.tenant_name : "-"],
      ["Reported", fmt(r.created_at)],
      ["Completed", done ? fmt(r.completed_at) : "-"],
    ];
    meta.forEach(([l, v], i) => {
      const x = M + 2 + i * (CW / 3);
      txt(l.toUpperCase(), x, y, { size: 6.8, color: GREY });
      txt(v, x, y + 4.2, { size: 8.6, bold: true });
    });
    y += 10;
    const block = (label, text) => {
      if (!text) return;
      const ls = wrap(text, CW - 4, 9);
      ensure(6 + 4.2 * Math.min(ls.length, 3));
      txt(label.toUpperCase(), M + 2, y, { size: 6.8, color: GREY });
      y += 3.8;
      ls.forEach((ln) => { ensure(4.4); txt(ln, M + 2, y, { size: 9 }); y += 4.2; });
      y += 2;
    };
    block("Complaint", r.complaint);
    block("Action taken", r.action_taken);
    block("Remarks", r.remarks);

    // photos
    if (opts.photos && r.photos && r.photos.length) {
      const per = opts.photosPerRow || 2;
      const gap = 4;
      const cellW = (CW - gap * (per - 1)) / per;
      const cellH = per === 2 ? 62 : 44;
      ensure(cellH + 8);
      txt("PHOTOS (" + r.photos.length + ")", M + 2, y, { size: 6.8, color: GREY });
      y += 3.5;
      let i = 0;
      for (const p of r.photos) {
        const img = await photoData(p.url);
        if (!img) continue;
        const col = i % per;
        if (col === 0 && i > 0) y += cellH + gap;
        ensure(cellH + 2);
        const k = Math.min(cellW / img.w, cellH / img.h);
        const w = img.w * k, h = img.h * k;
        const x = M + col * (cellW + gap);
        doc.setDrawColor(...LINE); doc.setLineWidth(0.25);
        doc.rect(x, y, cellW, cellH);
        doc.addImage(img.data, "JPEG", x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
        i++;
      }
      if (i > 0) y += cellH + gap;
    }
    y += 5;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y - 2.5, W - M, y - 2.5);
  }
  if (!records.length) txt("No maintenance requests match this report.", M, y + 4, { size: 10, color: GREY });

  // footer
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    txt("Maintenance report - Ahmed Al Sheebani Real Estate", M, 268, { size: 7, color: GREY });
    txt(`Page ${i} of ${n}`, W - M, 268, { size: 7, color: GREY, align: "right" });
  }
  return doc;
}

const safeName = (s) => clean(s).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "report";

export async function downloadRequestPdf(record) {
  const b = record.buildings && record.buildings.name ? record.buildings.name : "";
  const doc = await build([record], {
    title: "Maintenance Report",
    subtitle: `${b}${record.units && record.units.unit_number ? " - Unit " + record.units.unit_number : ""}`,
    photos: true, photosPerRow: 2, summary: false, groupByBuilding: false,
  });
  doc.save(`Maintenance_${safeName(b)}_Unit_${safeName(record.units && record.units.unit_number)}.pdf`);
}

// records are sorted by building, then unit
export async function downloadBuildingReport(records, { label, includePhotos, statusLabel }) {
  const sorted = [...records].sort((a, b) =>
    String(a.buildings && a.buildings.name).localeCompare(String(b.buildings && b.buildings.name)) ||
    String(a.units && a.units.unit_number).localeCompare(String(b.units && b.units.unit_number), undefined, { numeric: true }));
  const doc = await build(sorted, {
    title: "Maintenance Report",
    subtitle: `${label}${statusLabel ? " - " + statusLabel : ""}`,
    photos: !!includePhotos, photosPerRow: 3, summary: true, groupByBuilding: true,
  });
  doc.save(`Maintenance_Report_${safeName(label)}.pdf`);
}

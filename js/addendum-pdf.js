// ================================================================
// Builds the signed addendum PDF in the tenant's browser.
// The wording and the details come from the server (so they cannot be
// changed on the tenant's phone); the tenant only adds a signature.
// Needs the jsPDF script tag on the page (window.jspdf).
// ================================================================

const W = 210, M = 18, CW = W - M * 2, TOP = 20, BOTTOM = 276;
const NAVY = [27, 43, 110], GREY = [235, 237, 241], INK = [30, 30, 40], MUTED = [110, 115, 125];

// jsPDF's built-in fonts cannot draw a few symbols
const pdfText = (s) =>
  String(s == null ? "" : s)
    .replace(/≤/g, "<=").replace(/≥/g, ">=")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/•/g, "-")
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ]/g, "");

export function dubaiTime(iso) {
  return (
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Dubai", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) + " (Dubai time)"
  );
}

export async function buildAddendumPdf({ template, fields, contentHash, tenant, landlord, merged }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = TOP;

  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = TOP; } };
  const setFont = (style, size, color = INK) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
  };
  const wrap = (text, width) => doc.splitTextToSize(pdfText(text), width);
  // Draw wrapped text line by line so it can flow across pages
  const flow = (text, x, width, lh, firstLabel) => {
    const ls = wrap(text, width);
    ls.forEach((ln, i) => {
      ensure(lh);
      if (i === 0 && firstLabel) firstLabel(y);
      doc.text(ln, x, y);
      y += lh;
    });
  };

  // ── Title + intro ──
  setFont("bold", 7.5, MUTED);
  doc.text("AHMED AL SHEEBANI REAL ESTATE", W / 2, y - 6, { align: "center" });
  setFont("bold", 14, NAVY);
  doc.text(pdfText(template.title).toUpperCase(), W / 2, y + 2, { align: "center" });
  y += 10;
  setFont("normal", 8.6);
  if (template.intro) { flow(template.intro, M, CW, 4.2); y += 3; }

  // ── Details table ──
  const cell = (label, value, x, w, h = 7) => {
    doc.setFillColor(...NAVY); doc.rect(x, y, 34, h, "F");
    doc.setFillColor(...GREY); doc.rect(x + 34, y, w - 34, h, "F");
    setFont("bold", 7, [255, 255, 255]); doc.text(label, x + 2, y + h / 2 + 1);
    setFont("bold", 8.2, INK);
    const v = wrap(value || "", w - 38)[0] || "";
    doc.text(v, x + 36, y + h / 2 + 1);
  };
  const half = (CW - 2) / 2;
  const F = fields;
  [["PROPERTY NAME", F.propertyName], ["LANDLORD NAME", F.landlordName], ["TENANT NAME", F.tenantName]].forEach(([l, v]) => {
    cell(l, v, M, CW); y += 8;
  });
  [["APARTMENT NO.", F.apartmentNo, "APARTMENT DETAILS", F.apartmentDetails],
   ["TOTAL RENT", F.totalRent, "SECURITY DEPOSIT", F.securityDeposit],
   ["CONTRACT START", F.contractStart, "CONTRACT END", F.contractEnd]].forEach(([l1, v1, l2, v2]) => {
    cell(l1, v1, M, half); cell(l2, v2, M + half + 2, half); y += 8;
  });
  y += 3;
  setFont("normal", 8.6);
  if (template.interpretation) { flow(template.interpretation, M, CW, 4.2); y += 4; }

  // ── Free text written in the portal ──
  (template.mode === "pdf" ? [] : template.body || []).forEach((b) => {
    if (b.t === "h") {
      ensure(12); y += 2; setFont("bold", 10, NAVY); doc.text(pdfText(b.x), M, y); y += 6;
    } else if (b.t === "p") {
      setFont("normal", 8.8); ensure(6); flow(b.x, M, CW, 4.3); y += 2;
    } else if (b.t === "bullets") {
      setFont("normal", 8.8);
      b.items.forEach((x) => { ensure(6); flow(x, M + 8, CW - 8, 4.3, (yy) => doc.text("-", M + 3, yy)); y += 0.8; });
      y += 1.5;
    }
  });

  // ── Sections ──
  const NUMX = M + 2, TEXTX = M + 14, TEXTW = CW - 14;
  (template.sections || []).forEach((sec) => {
    ensure(14);
    setFont("bold", 10, NAVY);
    doc.text(`${sec.no}   ${pdfText(sec.title)}.`, M, y);
    y += 6;
    sec.clauses.forEach((cl) => {
      let first = true;
      cl.blocks.forEach((b) => {
        const lead = first
          ? (yy) => { setFont("bold", 8.4, NAVY); doc.text(cl.no, NUMX, yy); setFont("normal", 8.6); }
          : null;
        if (b.t === "p") {
          setFont("normal", 8.6);
          ensure(8);
          flow(b.x, TEXTX, TEXTW, 4.2, lead);
          y += first ? 1 : 1.5;
        } else if (b.t === "list") {
          setFont("normal", 8.6);
          b.items.forEach((it) => {
            ensure(5);
            flow(it.x, TEXTX + 14, TEXTW - 14, 4.2, (yy) => doc.text(it.l, TEXTX + 6, yy));
            y += 0.8;
          });
          y += 0.8;
        } else if (b.t === "bullets") {
          setFont("normal", 8.6);
          b.items.forEach((x) => {
            ensure(5);
            flow(x, TEXTX + 10, TEXTW - 10, 4.2, (yy) => doc.text("-", TEXTX + 4, yy));
            y += 0.8;
          });
          y += 0.8;
        } else if (b.t === "table") {
          const cw = [66, 44, 44], x0 = TEXTX;
          ensure(8);
          doc.setFillColor(...NAVY); doc.rect(x0, y, 154, 6.2, "F");
          setFont("bold", 8, [255, 255, 255]);
          b.head.forEach((h, i) => {
            const cx = x0 + cw.slice(0, i).reduce((a, c) => a + c, 0);
            doc.text(pdfText(h), i === 0 ? cx + 2 : cx + cw[i] / 2, y + 4.3, i === 0 ? {} : { align: "center" });
          });
          y += 6.2;
          b.rows.forEach((r, ri) => {
            ensure(6.2);
            doc.setFillColor(...(ri % 2 ? [248, 249, 251] : GREY)); doc.rect(x0, y, 154, 6.2, "F");
            setFont("normal", 8.4);
            doc.text(pdfText(r[0]), x0 + 2, y + 4.3);
            if (r.length === 2) doc.text(pdfText(r[1]), x0 + 66 + 44, y + 4.3, { align: "center" });
            else { doc.text(pdfText(r[1]), x0 + 66 + 22, y + 4.3, { align: "center" }); doc.text(pdfText(r[2]), x0 + 110 + 22, y + 4.3, { align: "center" }); }
            y += 6.2;
          });
          y += 3;
        }
        first = false;
      });
      y += 1.2;
    });
    y += 3;
  });

  // ── Signature blocks (never split across pages) ──
  ensure(150);
  y += 2;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  y += 7;
  setFont("bold", 10.5, NAVY); doc.text("ACCEPTANCE AND SIGNATURES", M, y); y += 6;
  setFont("normal", 8.8);
  flow(
    template.contractOnly
      ? `The Tenant, ${F.tenantName}, and the Landlord, ${F.landlordName}, confirm that they have read, understood and agree to the Tenancy Contract for Unit ${F.apartmentNo}, ${F.propertyName}.`
      : `The Tenant, ${F.tenantName}, and the Landlord, ${F.landlordName}, confirm that they have read, understood and agree to this ${pdfText(template.title)}, which forms an integral part of the Tenancy Contract for Unit ${F.apartmentNo}, ${F.propertyName}.`,
    M, CW, 4.5,
  );
  y += 4;
  const block = (title, who, party) => {
    const boxH = 28;
    setFont("bold", 8, NAVY); doc.text(title, M, y); y += 3;
    doc.setDrawColor(190, 195, 205); doc.setLineWidth(0.3); doc.roundedRect(M, y, 90, boxH, 1.5, 1.5);
    if (party && party.signaturePng) {
      const p = doc.getImageProperties(party.signaturePng);
      let w = 84, h = (p.height / p.width) * w;
      if (h > boxH - 4) { h = boxH - 4; w = (p.width / p.height) * h; }
      doc.addImage(party.signaturePng, "PNG", M + 3 + (84 - w) / 2, y + 2 + (boxH - 4 - h) / 2, w, h);
    } else {
      setFont("normal", 8, MUTED); doc.text(who + " signature pending", M + 45, y + boxH / 2 + 1, { align: "center" });
    }
    const rx = M + 98;
    setFont("normal", 7, MUTED); doc.text("SIGNED BY", rx, y + 4);
    setFont("bold", 10, INK); doc.text(pdfText(party ? party.name : who === "Tenant" ? F.tenantName : F.landlordName), rx, y + 10);
    setFont("normal", 7, MUTED); doc.text("DATE AND TIME", rx, y + 17);
    setFont("bold", 9, INK); doc.text(party ? pdfText(dubaiTime(party.stamp.at)) : "-", rx, y + 22.5, { maxWidth: W - M - rx });
    y += boxH + 8;
  };
  block("TENANT", "Tenant", tenant);
  block("LANDLORD", "Landlord", landlord);

  // audit record
  doc.setFillColor(...GREY); doc.roundedRect(M, y, CW, 31, 1.5, 1.5, "F");
  setFont("bold", 7.5, NAVY); doc.text("ELECTRONIC SIGNATURE RECORD", M + 4, y + 5.5);
  setFont("normal", 7.3, MUTED);
  doc.text(`Tenant reference: ${tenant ? tenant.stamp.ref : "-"}     Landlord reference: ${landlord ? landlord.stamp.ref : "-"}`, M + 4, y + 10.5);
  doc.text("Document fingerprint (SHA-256):", M + 4, y + 15);
  doc.text(String(contentHash || ""), M + 4, y + 19, { maxWidth: CW - 8 });
  doc.text("Signed electronically. The signatures, times, and device details are kept on the Ahmed Al Sheebani Real Estate system.", M + 4, y + 24, { maxWidth: CW - 8 });

  // ── Footer on every page ──
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    setFont("normal", 7, MUTED);
    doc.text(pdfText(template.footer), M, 288);
    doc.text(merged || template.mode === "pdf" || template.contractOnly ? "Signatures" : `Page ${i} of ${n}`, W - M, 288, { align: "right" });
  }
  return doc;
}

export function pdfToDataUrl(doc) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(doc.output("blob"));
  });
}

// Put the given PDFs (tenancy contract, attached addendum) in front of our pages
export async function mergeParts(doc, parts) {
  const { PDFDocument } = window.PDFLib;
  const out = await PDFDocument.create();
  for (const buf of parts.filter(Boolean)) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
  }
  const mine = await PDFDocument.load(doc.output("arraybuffer"));
  (await out.copyPages(mine, mine.getPageIndices())).forEach((p) => out.addPage(p));
  const bytes = await out.save();
  let bin = ""; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return "data:application/pdf;base64," + btoa(bin);
}

// ── Filling in and signing the Ejari tenancy contract (the standard 2-page form) ──
// Positions were measured from the form: points from the top-left of an A4 page.
export const FORM_FIELDS = [
  // key, label shown to staff, x, baseline (from top), max width, font size
  { k: "owner", label: "Owner name", x: 91, top: 146.5, w: 190 },
  { k: "landlord", label: "Landlord name", x: 91, top: 167.1, w: 190 },
  { k: "tenantName", label: "Tenant name", x: 91, top: 188.5, w: 190 },
  { k: "tenantEmail", label: "Tenant email", x: 70, top: 209.6, w: 135, size: 7.5 },
  { k: "landlordEmail", label: "Landlord email", x: 374, top: 209.1, w: 160, size: 7.5 },
  { k: "tenantPhone", label: "Tenant phone", x: 72, top: 230.5, w: 130 },
  { k: "landlordPhone", label: "Landlord phone", x: 380, top: 230.5, w: 150 },
  { k: "buildingName", label: "Building name", x: 76, top: 250.9, w: 205 },
  { k: "location", label: "Location (area)", x: 340, top: 252.1, w: 190 },
  { k: "propertySize", label: "Property size (sq.m)", x: 88, top: 272.5, w: 105 },
  { k: "propertyType", label: "Property type", x: 292, top: 272.5, w: 75 },
  { k: "propertyNo", label: "Property no.", x: 484, top: 272.5, w: 75 },
  { k: "premises", label: "Premises no. (DEWA)", x: 108, top: 293.1, w: 160 },
  { k: "plot", label: "Plot no.", x: 346, top: 293.1, w: 150 },
  { k: "periodTo", label: "Contract period: to", x: 102, top: 313, w: 120 },
  { k: "periodFrom", label: "Contract period: from", x: 330, top: 314.9, w: 120 },
  { k: "annualRent", label: "Annual rent (AED)", x: 70, top: 333.7, w: 300 },
  { k: "contractValue", label: "Contract value (AED)", x: 78, top: 354.6, w: 300 },
  { k: "deposit", label: "Security deposit amount (AED)", x: 114, top: 376.9, w: 135 },
  { k: "payMode", label: "Mode of payment", x: 374, top: 376.9, w: 165 },
  { k: "term1", label: "Additional term 1 (page 2)", x: 48, top: 481.0, w: 440, page: 1, hidden: true },
  { k: "term2", label: "Additional term 2 (page 2)", x: 48, top: 506.9, w: 440, page: 1, hidden: true },
  { k: "term3", label: "Additional term 3 (page 2)", x: 48, top: 532.9, w: 440, page: 1, hidden: true },
  { k: "term4", label: "Additional term 4 (page 2)", x: 48, top: 558.9, w: 440, page: 1, hidden: true },
  { k: "term5", label: "Additional term 5 (page 2)", x: 48, top: 584.8, w: 440, page: 1, hidden: true },
  { k: "term6", label: "Additional term 6 (page 2)", x: 48, top: 610.8, w: 440, page: 1, hidden: true },
  { k: "term7", label: "Additional term 7 (page 2)", x: 48, top: 636.7, w: 440, page: 1, hidden: true },
  { k: "term8", label: "Additional term 8 (page 2)", x: 48, top: 662.6, w: 440, page: 1, hidden: true },
];
// tick circles for Property Usage (centre x, centre top)
const USAGE = { industrial: [201.5, 126.5], commercial: [316, 126.5], residential: [428.5, 126.5] };
// signature spots on each page: box (x, top, w, h) and where the date goes
const SIGN_SPOTS = [
  { page: 0, tenant: { x: 100, top: 754, w: 130, h: 26, dx: 110 }, landlord: { x: 382, top: 754, w: 130, h: 26, dx: 392 }, dateTop: 821 },
  { page: 1, tenant: { x: 88, top: 693, w: 140, h: 46, dx: 100 }, landlord: { x: 368, top: 693, w: 140, h: 46, dx: 382 }, dateTop: 781 },
];

export async function stampContract(buf, { tenant, landlord, preview, form, usage }) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.05, 0.1, 0.3);
  const first = pages[0];
  const H0 = first.getHeight();
  // typed details on page 1
  if (form) {
    FORM_FIELDS.forEach((f) => {
      const v = pdfText(form[f.k]);
      if (!v) return;
      let size = f.size || 9;
      while (size > 6 && font.widthOfTextAtSize(v, size) > f.w) size -= 0.5;
      const pg = pages[f.page || 0] || first;
      pg.drawText(v, { x: f.x, y: pg.getHeight() - f.top, size, font, color: ink });
    });
    const u = USAGE[usage];
    if (u) {
      const cx = u[0], cy = H0 - u[1];
      first.drawLine({ start: { x: cx - 3.5, y: cy + 0.5 }, end: { x: cx - 1, y: cy - 3 }, thickness: 1.4, color: ink });
      first.drawLine({ start: { x: cx - 1, y: cy - 3 }, end: { x: cx + 4, y: cy + 4 }, thickness: 1.4, color: ink });
    }
  }
  // signatures and dates on pages 1 and 2
  for (const spot of SIGN_SPOTS) {
    const page = pages[spot.page];
    if (!page) continue;
    const H = page.getHeight();
    for (const [role, party] of [["tenant", tenant], ["landlord", landlord]]) {
      const b = spot[role];
      if (party && party.signaturePng) {
        const img = await pdf.embedPng(party.signaturePng);
        const k = Math.min(b.w / img.width, b.h / img.height);
        page.drawImage(img, { x: b.x + (b.w - img.width * k) / 2, y: H - b.top - b.h + (b.h - img.height * k) / 2, width: img.width * k, height: img.height * k });
        const d = new Date(party.stamp.at).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" });
        page.drawText(d, { x: b.dx, y: H - spot.dateTop, size: 9, font, color: ink });
      } else if (preview) {
        page.drawRectangle({ x: b.x, y: H - b.top - b.h, width: b.w, height: b.h, borderColor: rgb(0.85, 0.2, 0.2), borderWidth: 0.8, borderDashArray: [3, 2] });
        page.drawText(role === "tenant" ? "Tenant signs here" : "Landlord signs here", { x: b.x + 3, y: H - b.top - 8, size: 6.5, font, color: rgb(0.85, 0.2, 0.2) });
        page.drawText("dd/mm/yyyy (added on signing)", { x: b.dx, y: H - spot.dateTop, size: 7, font, color: rgb(0.85, 0.2, 0.2) });
      }
    }
  }
  return pdf.save();
}

// The whole signing package as one PDF: contract, attached addendum, our signature page
export async function assemble({ template, fields, contentHash, contractBuf, srcBuf, stampContractPage, form, usage, tenant, landlord, preview }) {
  const doc = await buildAddendumPdf({ template, fields, contentHash, tenant, landlord, merged: !!(contractBuf || srcBuf) });
  const parts = [];
  if (contractBuf) parts.push(stampContractPage ? await stampContract(contractBuf, { tenant, landlord, preview, form, usage }) : contractBuf);
  if (srcBuf) parts.push(srcBuf);
  return parts.length ? mergeParts(doc, parts) : pdfToDataUrl(doc);
}

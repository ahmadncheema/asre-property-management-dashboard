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

export async function buildAddendumPdf({ template, fields, contentHash, stamp, signerName, signaturePng }) {
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

  // ── Signature block (never split across pages) ──
  ensure(92);
  y += 2;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  y += 7;
  setFont("bold", 10.5, NAVY); doc.text("TENANT ACCEPTANCE", M, y); y += 6;
  setFont("normal", 8.8);
  flow(
    `By signing below, I, ${F.tenantName}, confirm that I have read, understood and agree to this ${pdfText(template.title)}, which forms an integral part of my Tenancy Contract for Unit ${F.apartmentNo}, ${F.propertyName}.`,
    M, CW, 4.5,
  );
  y += 4;
  // signature
  const boxH = 30;
  doc.setDrawColor(190, 195, 205); doc.setLineWidth(0.3); doc.roundedRect(M, y, 90, boxH, 1.5, 1.5);
  if (signaturePng) {
    const p = doc.getImageProperties(signaturePng);
    let w = 84, h = (p.height / p.width) * w;
    if (h > boxH - 4) { h = boxH - 4; w = (p.width / p.height) * h; }
    doc.addImage(signaturePng, "PNG", M + 3 + (84 - w) / 2, y + 2 + (boxH - 4 - h) / 2, w, h);
  }
  setFont("normal", 7, MUTED); doc.text("TENANT SIGNATURE", M, y + boxH + 4);
  const rx = M + 98;
  setFont("normal", 7, MUTED); doc.text("SIGNED BY", rx, y + 4);
  setFont("bold", 10, INK); doc.text(pdfText(signerName), rx, y + 10);
  setFont("normal", 7, MUTED); doc.text("DATE AND TIME", rx, y + 17);
  setFont("bold", 9, INK); doc.text(pdfText(dubaiTime(stamp.at)), rx, y + 22.5, { maxWidth: W - M - rx });
  y += boxH + 10;

  // audit record
  doc.setFillColor(...GREY); doc.roundedRect(M, y, CW, 27, 1.5, 1.5, "F");
  setFont("bold", 7.5, NAVY); doc.text("ELECTRONIC SIGNATURE RECORD", M + 4, y + 5.5);
  setFont("normal", 7.3, MUTED);
  doc.text(`Reference: ${stamp.ref}`, M + 4, y + 10.5);
  doc.text("Document fingerprint (SHA-256):", M + 4, y + 15);
  doc.text(String(contentHash || ""), M + 4, y + 19, { maxWidth: CW - 8 });
  doc.text("Signed electronically. The signature, time, and device details are kept on the Ahmed Al Sheebani Real Estate system.", M + 4, y + 24, { maxWidth: CW - 8 });

  // ── Footer on every page ──
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    setFont("normal", 7, MUTED);
    doc.text(pdfText(template.footer), M, 288);
    doc.text(template.mode === "pdf" ? "Signature page" : `Page ${i} of ${n}`, W - M, 288, { align: "right" });
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

// Attached-PDF addendums: put the building's own PDF first, then our signature page
export async function mergeWithSource(doc, srcArrayBuffer) {
  const { PDFDocument } = window.PDFLib;
  const out = await PDFDocument.create();
  const src = await PDFDocument.load(srcArrayBuffer, { ignoreEncryption: true });
  (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
  const sig = await PDFDocument.load(doc.output("arraybuffer"));
  (await out.copyPages(sig, sig.getPageIndices())).forEach((p) => out.addPage(p));
  const bytes = await out.save();
  let bin = ""; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return "data:application/pdf;base64," + btoa(bin);
}

// ================================================================
// The "send for e-signature" form, shared by the Contracts page and
// the unit's Contract window on the Properties page.
// ================================================================
import { whatsappLink, showToast } from "./shared.js";
import { assemble, FORM_FIELDS } from "./addendum-pdf.js";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function jpost(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Something went wrong");
  return j;
}
const money = (v) => (v ? "AED " + Number(v).toLocaleString("en-US") : "");
const day2 = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const day = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

// ── The "link is ready" panel ──
export function renderLinkPanel(box, { token, tenant, email, whatsapp, onNew }) {
  const link = location.origin + "/sign.html?t=" + token;
  const wa = whatsappLink(whatsapp, `Hello ${tenant}, please read and sign your tenancy documents using this link (valid 14 days): ${link}`);
  box.innerHTML = `
    <div style="background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.4);border-radius:10px;padding:14px">
      <b>✅ Signing link ready</b> — valid for 14 days.
      <div class="es-link"><input class="form-input" data-f="link" readonly value="${esc(link)}" /><button class="btn btn-outline btn-sm" data-a="copy">Copy</button></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${wa ? `<a class="btn btn-green btn-sm" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        <button class="btn btn-outline btn-sm" data-a="email">✉ Email link</button>
        <button class="btn btn-outline btn-sm" data-a="new">New request</button>
      </div>
    </div>`;
  box.querySelector('[data-a="copy"]').onclick = () => {
    const el = box.querySelector('[data-f="link"]');
    el.select();
    (navigator.clipboard ? navigator.clipboard.writeText(el.value) : Promise.reject()).catch(() => document.execCommand("copy"));
    showToast("Link copied.");
  };
  box.querySelector('[data-a="email"]').onclick = async () => {
    const to = prompt("Send the link to which email address?", email || "");
    if (!to) return;
    try { await jpost("/api/sign-send-email", { token, to: to.trim(), origin: location.origin }); showToast("Email sent."); }
    catch (e) { showToast(e.message, "error"); }
  };
  box.querySelector('[data-a="new"]').onclick = () => onNew && onNew();
}

// ── The form ──
export async function mountEsignForm(box, { building, unit, session, onCreated }) {
  box.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Loading…</p>';
  const get = (u) => fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [tplRes, adRes, conRes] = await Promise.all([
    get("/api/sign-templates"),
    get("/api/addendum/" + encodeURIComponent(building.id)),
    get("/api/contracts/" + encodeURIComponent(unit.id)),
  ]);
  const templates = (tplRes && tplRes.templates) || [];
  const ad = adRes && adRes.addendum;
  const contracts = ((conRes && conRes.files) || []).filter((f) => !/Signed_(Addendum|Contract)/i.test(f.filename));
  const opts = [];
  if (ad) opts.push({ id: "building", label: "This building's addendum: " + ad.title, defaults: {} });
  templates.forEach((t) => opts.push(t));
  opts.push({ id: "contract-only", label: "Tenancy contract only (no addendum)", defaults: {} });

  box.innerHTML = `
    <div class="esign-form">
      ${building.landlord_username ? "" : '<div style="font-size:0.78rem;color:var(--warning);margin-bottom:8px">⚠ This building has no landlord login assigned (building page > Landlord details). The landlord will not be able to sign until one is set.</div>'}
      <label>What does the tenant sign?</label>
      <select class="form-input" data-f="template">${opts.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join("")}</select>
      <label>Tenancy contract to include (shown first)</label>
      <select class="form-input" data-f="contract">
        <option value="__ejari__" selected>Standard Ejari tenancy contract (blank form, filled in automatically)</option>
        <option value="">No contract, addendum only</option>
        ${contracts.map((f) => `<option value="${esc(f.filename)}" >${esc(f.name)} (${day(f.uploadedAt)})</option>`).join("")}
      </select>
      
      <div data-f="formbox" style="margin-top:10px">
        <label style="display:flex;gap:8px;align-items:center;font-size:0.8rem;color:inherit;margin:0">
          <input type="checkbox" data-f="stamp" checked style="width:auto" />
          Fill in the contract form and put the signatures on it
        </label>
        <details style="margin-top:6px" data-f="formdetails">
          <summary style="cursor:pointer;font-size:0.8rem;color:var(--text-muted)">Contract form details (check or change)</summary>
          <p style="font-size:0.72rem;color:var(--text-muted);margin:6px 0">Filled from the unit and building. Empty boxes are left blank. Clear any box that is already filled in your PDF.</p>
          <label>Additional terms (page 2)</label>
          <select class="form-input" data-c="termsMode"><option value="addendum">Addendum applies (line 1 "Addendum Applies", lines 2 to 8 "XXXXXXXXXX")</option><option value="none">Leave blank</option></select>
          <label>Property usage</label>
          <select class="form-input" data-c="usage"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="industrial">Industrial</option><option value="">Do not tick</option></select>
          <div class="es-grid">
            ${FORM_FIELDS.filter((f) => !f.hidden).map((f) => `<div><label>${esc(f.label)}</label><input class="form-input" data-c="${f.k}" /></div>`).join("")}
          </div>
        </details>
      </div>
      <label>Property name</label><input class="form-input" data-f="property" />
      <label>Landlord name</label><input class="form-input" data-f="landlord" />
      <label>Tenant name</label><input class="form-input" data-f="tenant" />
      <div class="es-grid">
        <div><label>Apartment no.</label><input class="form-input" data-f="unit" /></div>
        <div><label>Apartment details</label><input class="form-input" data-f="details" placeholder="e.g. 1 BHK" /></div>
        <div><label>Total rent</label><input class="form-input" data-f="rent" /></div>
        <div><label>Security deposit</label><input class="form-input" data-f="deposit" /></div>
        <div><label>Contract start</label><input class="form-input" data-f="start" /></div>
        <div><label>Contract end</label><input class="form-input" data-f="end" /></div>
      </div>
      <label>Tenant email (for the final signed copy)</label><input class="form-input" type="email" data-f="email" />
      <p style="font-size:0.75rem;color:var(--text-muted);margin:10px 0 0">Order: tenant signs first, then the landlord signs in the landlord portal. Leasing (leasing@alsheebanirealestate.ae) is emailed at each step, and the tenant gets the fully signed copy at the end. The landlord is not emailed.</p>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-outline" data-a="preview" style="flex:1">👁 Preview</button>
        <button class="btn btn-primary" data-a="create" style="flex:1">Create signing link</button>
      </div>
    </div>
    <div data-f="result" style="display:none"></div>`;

  const q = (n) => box.querySelector(`[data-f="${n}"]`);
  const val = (n) => q(n).value.trim();
  const set = (n, v) => (q(n).value = v == null ? "" : v);
  set("landlord", building.landlord_name || building.owner_name || "");
  set("tenant", unit.tenant_name);
  set("unit", unit.unit_number);
  set("details", unit.size || "");
  set("rent", money(unit.rent));
  set("deposit", money(unit.deposit));
  set("start", day(unit.start_date));
  set("end", day(unit.end_date));
  set("email", unit.tenant_email);
  const cq = (k) => box.querySelector(`[data-c="${k}"]`);
  const fd = day2(unit.start_date), td = day2(unit.end_date);
  const checks = parseInt(unit.num_checks) || 0;
  const defaults = {
    owner: building.owner_name || building.landlord_name, landlord: building.landlord_name || building.owner_name,
    tenantName: unit.tenant_name, tenantEmail: unit.tenant_email, landlordEmail: building.landlord_email,
    tenantPhone: unit.tenant_whatsapp, landlordPhone: building.landlord_phone,
    buildingName: building.name, location: building.location_area, propertySize: unit.size, propertyType: "", propertyNo: unit.unit_number,
    premises: building.dewa_premises_no, plot: building.plot_no, periodTo: td, periodFrom: fd,
    annualRent: money(unit.rent), contractValue: money(unit.rent), deposit: money(unit.deposit),
    payMode: checks ? checks + (checks === 1 ? " Cheque" : " Cheques") : "", term1: "",
  };
  cq("usage").value = building.property_usage || "residential";
  FORM_FIELDS.filter((f) => !f.hidden).forEach((f) => { cq(f.k).value = defaults[f.k] == null ? "" : defaults[f.k]; });
  const syncTerm = () => { cq("termsMode").value = val("template") === "contract-only" ? "none" : "addendum"; };
  const syncContract = () => {
    const has = !!val("contract");
    q("formbox").style.display = has ? "" : "none";
  };
  q("contract").onchange = syncContract;
  const tplChanged = () => {
    syncTerm();
    const t = opts.find((x) => x.id === val("template")) || {};
    set("property", (t.defaults && t.defaults.propertyName) || building.name || "");
    if (t.defaults && t.defaults.landlordName && !val("landlord")) set("landlord", t.defaults.landlordName);
    if (t.id === "building" || t.id === "contract-only") set("landlord", building.landlord_name || building.owner_name || val("landlord"));
  };
  q("template").onchange = tplChanged;
  tplChanged();
  syncContract();

  const payload = () => ({
    unitId: unit.id, buildingId: building.id, templateId: val("template"), contractFile: val("contract"),
    tenantEmail: val("email"), notifyEmail: "", createdBy: session.username,
    stampContractPage: q("stamp").checked && !!val("contract"),
    usage: cq("usage").value,
    form: Object.assign(
      Object.fromEntries(FORM_FIELDS.filter((f) => !f.hidden).map((f) => [f.k, cq(f.k).value.trim()])),
      cq("termsMode").value === "addendum" ? Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((i) => ["term" + i, i === 1 ? "Addendum Applies" : "XXXXXXXXXX"])) : {},
    ),
    fields: { propertyName: val("property"), landlordName: val("landlord"), tenantName: val("tenant"), apartmentNo: val("unit"),
      apartmentDetails: val("details"), totalRent: val("rent"), securityDeposit: val("deposit"), contractStart: val("start"), contractEnd: val("end") },
  });

  // Preview: the full document exactly as the tenant will receive it (not signed)
  box.querySelector('[data-a="preview"]').onclick = async (ev) => {
    const btn = ev.currentTarget, old = btn.textContent;
    const w = window.open("", "_blank"); // opened first so the browser allows it
    btn.disabled = true; btn.textContent = "Preparing…";
    try {
      const p = payload();
      const pv = await jpost("/api/sign-preview", p);
      const fetchBuf = async (u) => (await fetch(u + "?t=" + Date.now())).arrayBuffer();
      const dataUrl = await assemble({
        template: pv.template, fields: pv.fields, contentHash: pv.contentHash,
        contractBuf: p.contractFile === "__ejari__" ? await fetchBuf("/templates/ejari-blank.pdf") : p.contractFile ? await fetchBuf("/api/contract/" + encodeURIComponent(unit.id) + "/" + encodeURIComponent(p.contractFile)) : null,
        srcBuf: pv.hasSource ? await fetchBuf("/api/addendum-file/" + encodeURIComponent(building.id)) : null,
        stampContractPage: pv.stampContractPage, form: pv.form, usage: pv.usage,
        tenant: null, landlord: null, preview: true,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const url = URL.createObjectURL(blob);
      if (w) w.location = url; else location.href = url;
    } catch (e) { if (w) w.close(); showToast(e.message || "Could not make the preview", "error"); }
    btn.disabled = false; btn.textContent = old;
  };

  box.querySelector('[data-a="create"]').onclick = async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true;
    try {
      const j = await jpost("/api/sign-create", payload());
      const res = q("result");
      box.querySelector(".esign-form").style.display = "none";
      res.style.display = "";
      renderLinkPanel(res, { token: j.token, tenant: val("tenant"), email: val("email"), whatsapp: unit.tenant_whatsapp,
        onNew: () => mountEsignForm(box, { building, unit, session, onCreated }) });
      onCreated && onCreated(j);
    } catch (e) { showToast(e.message, "error"); btn.disabled = false; }
  };
}

// ================================================================
// Monthly Report picker (month + building list) for pages that do not
// have it built in. Needs the jsPDF script tag on the page.
// ================================================================

import { generateMonthlyReport } from "./monthly-report.js";
import { showToast } from "./shared.js";

const NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function ensureModal() {
  if (document.getElementById("rp-modal")) return;
  const st = document.createElement("style");
  st.textContent = `
  .rp-list{max-height:200px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:6px 10px}
  .rp-item{display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;color:var(--text)}
  .rp-row{display:flex;gap:10px}`;
  document.head.appendChild(st);
  const wrap = document.createElement("div");
  wrap.innerHTML = `
  <div class="modal-overlay" id="rp-modal" style="display:none">
    <div class="modal" style="max-width:480px">
      <div class="modal-header"><div class="modal-title">Monthly Report</div>
        <button class="modal-close" id="rp-x">×</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Month</label>
          <div class="rp-row"><select id="rp-month" class="form-control"></select>
          <select id="rp-year" class="form-control"></select></div></div>
        <div class="form-group"><label class="form-label">Buildings</label>
          <label class="rp-item" style="font-weight:600"><input type="checkbox" id="rp-all" /> All buildings</label>
          <div class="rp-list" id="rp-list"></div></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" id="rp-cancel">Cancel</button>
        <button class="btn btn-green" id="rp-go">Generate PDF</button></div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
  const close = () => (document.getElementById("rp-modal").style.display = "none");
  document.getElementById("rp-x").onclick = close;
  document.getElementById("rp-cancel").onclick = close;
  document.getElementById("rp-all").onchange = (e) =>
    document.querySelectorAll(".rp-b").forEach((c) => (c.checked = e.target.checked));
  document.getElementById("rp-go").onclick = async () => {
    const ids = [...document.querySelectorAll(".rp-b:checked")].map((c) => c.value);
    if (!ids.length) return showToast("Select at least one building.", "error");
    const btn = document.getElementById("rp-go");
    btn.disabled = true;
    btn.textContent = "Generating...";
    try {
      await generateMonthlyReport({
        buildingIds: ids,
        year: parseInt(document.getElementById("rp-year").value),
        month: parseInt(document.getElementById("rp-month").value),
      });
      showToast("Report downloaded.");
      close();
    } catch (err) {
      console.error(err);
      showToast("Could not create report: " + err.message, "error");
    }
    btn.disabled = false;
    btn.textContent = "Generate PDF";
  };
}

// buildings: [{id, name}] — only the buildings the person may report on
export function openReport(buildings) {
  ensureModal();
  const now = new Date();
  let m = now.getMonth() || 12; // last month
  let y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  document.getElementById("rp-month").innerHTML = NAMES.map(
    (n, i) => `<option value="${i + 1}" ${i + 1 === m ? "selected" : ""}>${n}</option>`,
  ).join("");
  const years = [];
  for (let k = now.getFullYear(); k >= now.getFullYear() - 3; k--) years.push(k);
  document.getElementById("rp-year").innerHTML = years
    .map((k) => `<option value="${k}" ${k === y ? "selected" : ""}>${k}</option>`)
    .join("");
  document.getElementById("rp-all").checked = false;
  document.getElementById("rp-list").innerHTML = buildings.length
    ? buildings
        .map(
          (b) =>
            `<label class="rp-item"><input type="checkbox" class="rp-b" value="${b.id}" /> ${String(b.name).replace(/</g, "&lt;")}</label>`,
        )
        .join("")
    : "No buildings.";
  document.getElementById("rp-modal").style.display = "flex";
}

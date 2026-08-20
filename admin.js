import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { staticAccent } from "./colors.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WEEKDAY_LABELS = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------
const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const signoutBtn = document.getElementById("signout-btn");
const signedInEmail = document.getElementById("signed-in-email");

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
  } catch (e) {
    loginError.textContent = "Couldn't sign in — check your email and password.";
    console.error(e);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
});
loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") loginBtn.click(); });
signoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.style.display = "none";
    adminView.style.display = "block";
    signedInEmail.textContent = user.email;
    boot();
  } else {
    loginView.style.display = "block";
    adminView.style.display = "none";
  }
});

async function boot() {
  await loadGatePassword();
  await loadNighttime();
  renderNighttimePanel();
  await loadSections();
  renderSections();
}

// ------------------------------------------------------------
// History: review past checklist/dropdown responses, export to Excel
// ------------------------------------------------------------
const loadHistoryBtn = document.getElementById("load-history-btn");
const exportHistoryBtn = document.getElementById("export-history-btn");
const historyYearSelect = document.getElementById("history-year-select");
const historyStatus = document.getElementById("history-status");
const historyTableWrap = document.getElementById("history-table-wrap");

let historyRows = []; // flattened rows, most recent date first

loadHistoryBtn.addEventListener("click", async () => {
  historyStatus.textContent = "Loading…";
  historyStatus.className = "status-msg";
  loadHistoryBtn.disabled = true;
  try {
    const snap = await getDocs(collection(db, "responses"));
    const dateDocs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.id.localeCompare(a.id)); // "YYYY-MM-DD" sorts correctly as text

    historyRows = [];
    dateDocs.forEach((dayDoc) => {
      Object.values(dayDoc.checklist || {}).forEach((entry) => {
        historyRows.push({
          date: dayDoc.id,
          section: entry.sectionName || entry.sectionId || "—",
          type: "Checklist",
          label: entry.item || "",
          value: entry.checked ? "Checked" : "Unchecked",
        });
      });
      Object.values(dayDoc.dropdown || {}).forEach((entry) => {
        historyRows.push({
          date: dayDoc.id,
          section: entry.sectionName || entry.sectionId || "—",
          type: "Dropdown",
          label: entry.question || "",
          value: entry.answer || "",
        });
      });
    });

    renderHistoryTable();
    populateYearSelect();
    historyStatus.textContent = historyRows.length ? `Loaded ${dateDocs.length} day(s), ${historyRows.length} response(s).` : "No history yet — nothing's been recorded from the public page.";
    historyStatus.className = "status-msg ok";
  } catch (e) {
    historyStatus.textContent = "Couldn't load history — try again.";
    historyStatus.className = "status-msg error";
    console.error(e);
  } finally {
    loadHistoryBtn.disabled = false;
  }
});

function populateYearSelect() {
  const years = [...new Set(historyRows.map((r) => r.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  historyYearSelect.innerHTML = "";
  if (!years.length) {
    historyYearSelect.disabled = true;
    exportHistoryBtn.disabled = true;
    return;
  }
  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    historyYearSelect.appendChild(opt);
  });
  historyYearSelect.disabled = false;
  exportHistoryBtn.disabled = false;
}

function renderHistoryTable() {
  historyTableWrap.innerHTML = "";
  if (!historyRows.length) return;

  const scroll = document.createElement("div");
  scroll.className = "history-table-scroll";
  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML = `
    <thead>
      <tr><th>Date</th><th>Section</th><th>Type</th><th>Item / Question</th><th>Response</th></tr>
    </thead>
    <tbody>
      ${historyRows.map((r) => `
        <tr>
          <td>${escapeHtml(r.date)}</td>
          <td>${escapeHtml(r.section)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td class="wrap">${escapeHtml(r.label)}</td>
          <td class="wrap">${escapeHtml(r.value)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  scroll.appendChild(table);
  historyTableWrap.appendChild(scroll);
}

exportHistoryBtn.addEventListener("click", () => {
  if (!historyRows.length || typeof XLSX === "undefined") return;
  const year = historyYearSelect.value;
  const yearRows = historyRows.filter((r) => r.date.slice(0, 4) === year);
  if (!yearRows.length) return;

  // Group rows by month (one workbook tab per month), then by date within
  // that month (each date gets its own labeled block inside the tab).
  const byMonth = {};
  yearRows.forEach((r) => {
    const month = r.date.slice(0, 7); // "YYYY-MM"
    if (!byMonth[month]) byMonth[month] = {};
    if (!byMonth[month][r.date]) byMonth[month][r.date] = [];
    byMonth[month][r.date].push(r);
  });

  const workbook = XLSX.utils.book_new();
  Object.keys(byMonth).sort().forEach((month) => {
    const datesInMonth = Object.keys(byMonth[month]).sort();
    const rows = [];
    datesInMonth.forEach((date) => {
      rows.push([`Date: ${date}`]);
      rows.push(["Section", "Type", "Item / Question", "Response"]);
      byMonth[month][date].forEach((r) => rows.push([r.section, r.type, r.label, r.value]));
      rows.push([]); // blank row separates this date from the next
    });
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 42 }, { wch: 24 }];
    // Sheet name is just the month digits ("08") since the year is already in the file/tab set.
    XLSX.utils.book_append_sheet(workbook, worksheet, month.slice(5));
  });

  XLSX.writeFile(workbook, `daily-content-history-${year}.xlsx`);
});

// ------------------------------------------------------------
// Reusable editors: a list of plain-text items, and a list of
// dropdown questions (each with its own list of options).
// Used by both the Nighttime panel and every checklist/dropdown part.
// ------------------------------------------------------------
function itemListEditor(items, save, rerender) {
  const wrap = document.createElement("div");
  items.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "item-row";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Item";
    input.value = item;
    input.addEventListener("change", async () => { items[i] = input.value; await save(); });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn small danger icon";
    del.textContent = "✕";
    del.addEventListener("click", async () => { items.splice(i, 1); await save(); rerender(); });
    row.appendChild(input);
    row.appendChild(del);
    wrap.appendChild(row);
  });
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn small";
  addBtn.textContent = "+ Add item";
  addBtn.addEventListener("click", async () => { items.push(""); await save(); rerender(); });
  wrap.appendChild(addBtn);
  return wrap;
}

function questionListEditor(questions, save, rerender) {
  const wrap = document.createElement("div");
  questions.forEach((q, qi) => {
    const block = document.createElement("div");
    block.className = "q-block";

    const head = document.createElement("div");
    head.className = "q-head";
    const qInput = document.createElement("input");
    qInput.type = "text";
    qInput.placeholder = "Question";
    qInput.value = q.question || "";
    qInput.addEventListener("change", async () => { q.question = qInput.value; await save(); });
    const delQBtn = document.createElement("button");
    delQBtn.type = "button";
    delQBtn.className = "btn small danger icon";
    delQBtn.textContent = "✕";
    delQBtn.addEventListener("click", async () => { questions.splice(qi, 1); await save(); rerender(); });
    head.appendChild(qInput);
    head.appendChild(delQBtn);
    block.appendChild(head);

    const optsWrap = document.createElement("div");
    optsWrap.className = "options";
    if (!q.options) q.options = [];
    q.options.forEach((opt, oi) => {
      const orow = document.createElement("div");
      orow.className = "option-row";
      const oInput = document.createElement("input");
      oInput.type = "text";
      oInput.placeholder = "Option";
      oInput.value = opt;
      oInput.addEventListener("change", async () => { q.options[oi] = oInput.value; await save(); });
      const delO = document.createElement("button");
      delO.type = "button";
      delO.className = "btn small danger icon";
      delO.textContent = "✕";
      delO.addEventListener("click", async () => { q.options.splice(oi, 1); await save(); rerender(); });
      orow.appendChild(oInput);
      orow.appendChild(delO);
      optsWrap.appendChild(orow);
    });
    const addOptBtn = document.createElement("button");
    addOptBtn.type = "button";
    addOptBtn.className = "btn small";
    addOptBtn.textContent = "+ Add option";
    addOptBtn.addEventListener("click", async () => { q.options.push(""); await save(); rerender(); });
    optsWrap.appendChild(addOptBtn);
    block.appendChild(optsWrap);

    wrap.appendChild(block);
  });

  const addQBtn = document.createElement("button");
  addQBtn.type = "button";
  addQBtn.className = "btn small";
  addQBtn.textContent = "+ Add question";
  addQBtn.addEventListener("click", async () => { questions.push({ question: "", options: [""] }); await save(); rerender(); });
  wrap.appendChild(addQBtn);
  return wrap;
}

// ------------------------------------------------------------
// Gate password
// ------------------------------------------------------------
const gatePasswordInput = document.getElementById("gate-password");
const savePasswordBtn = document.getElementById("save-password-btn");
const passwordStatus = document.getElementById("password-status");

async function loadGatePassword() {
  const snap = await getDoc(doc(db, "config", "app"));
  gatePasswordInput.value = snap.exists() ? (snap.data().password || "") : "";
}

savePasswordBtn.addEventListener("click", async () => {
  passwordStatus.textContent = "Saving…";
  passwordStatus.className = "status-msg";
  try {
    await setDoc(doc(db, "config", "app"), { password: gatePasswordInput.value }, { merge: true });
    passwordStatus.textContent = "Saved.";
    passwordStatus.className = "status-msg ok";
  } catch (e) {
    passwordStatus.textContent = "Couldn't save — try again.";
    passwordStatus.className = "status-msg error";
    console.error(e);
  }
});

// ------------------------------------------------------------
// Nighttime content (always exactly 2 parts: checklist + dropdown)
// ------------------------------------------------------------
let nighttimeCache = { checklist: { items: [] }, dropdown: { questions: [] } };

async function loadNighttime() {
  const snap = await getDoc(doc(db, "config", "nighttime"));
  if (snap.exists()) {
    const data = snap.data();
    nighttimeCache = {
      checklist: { items: (data.checklist && data.checklist.items) || [] },
      dropdown: { questions: (data.dropdown && data.dropdown.questions) || [] },
    };
  }
}

async function persistNighttime() {
  await setDoc(doc(db, "config", "nighttime"), nighttimeCache);
}

function renderNighttimePanel() {
  const checklistContainer = document.getElementById("nighttime-checklist");
  checklistContainer.innerHTML = "";
  checklistContainer.appendChild(itemListEditor(nighttimeCache.checklist.items, persistNighttime, renderNighttimePanel));

  const dropdownContainer = document.getElementById("nighttime-dropdown");
  dropdownContainer.innerHTML = "";
  dropdownContainer.appendChild(questionListEditor(nighttimeCache.dropdown.questions, persistNighttime, renderNighttimePanel));
}

// ------------------------------------------------------------
// Sections: load / save / add / delete / reorder
// ------------------------------------------------------------
let sectionsCache = []; // [{id, name, type, order, days, startDate?}]
const activeTabBySection = {}; // sectionId -> weekday key or cycle day index

async function loadSections() {
  const snap = await getDocs(query(collection(db, "sections"), orderBy("order", "asc")));
  sectionsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function persistSection(section) {
  const { id, ...data } = section;
  await setDoc(doc(db, "sections", id), data);
}

function sortedSections() {
  return sectionsCache.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}

const addSectionBtn = document.getElementById("add-section-btn");
const newSectionName = document.getElementById("new-section-name");
const newSectionType = document.getElementById("new-section-type");
const addSectionStatus = document.getElementById("add-section-status");

addSectionBtn.addEventListener("click", async () => {
  const name = newSectionName.value.trim();
  if (!name) {
    addSectionStatus.textContent = "Give the section a name first.";
    addSectionStatus.className = "status-msg error";
    return;
  }
  const type = newSectionType.value;
  const id = `sec_${Date.now()}`;
  const order = sectionsCache.length ? Math.max(...sectionsCache.map((s) => s.order || 0)) + 1 : 1;

  const base = { name, type, order };
  let section;
  if (type === "weekday") {
    section = { id, ...base, days: Object.fromEntries(WEEKDAY_KEYS.map((k) => [k, []])) };
  } else if (type === "cycle") {
    section = { id, ...base, startDate: todayStr(), days: [{ parts: [] }] };
  } else {
    section = { id, ...base, parts: [] };
  }

  addSectionStatus.textContent = "Adding…";
  addSectionStatus.className = "status-msg";
  try {
    await persistSection(section);
    sectionsCache.push(section);
    newSectionName.value = "";
    addSectionStatus.textContent = "Added.";
    addSectionStatus.className = "status-msg ok";
    renderSections();
  } catch (e) {
    addSectionStatus.textContent = "Couldn't add — try again.";
    addSectionStatus.className = "status-msg error";
    console.error(e);
  }
});

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

async function deleteSection(sectionId) {
  if (!confirm("Delete this whole section? This can't be undone.")) return;
  await deleteDoc(doc(db, "sections", sectionId));
  sectionsCache = sectionsCache.filter((s) => s.id !== sectionId);
  renderSections();
}

async function moveSection(sectionId, direction) {
  const sorted = sortedSections();
  const idx = sorted.findIndex((s) => s.id === sectionId);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;

  const a = sorted[idx];
  const b = sorted[swapIdx];
  const tmp = a.order || 0;
  a.order = b.order || 0;
  b.order = tmp;

  await Promise.all([persistSection(a), persistSection(b)]);
  renderSections();
}

// ------------------------------------------------------------
// Rendering: sections list
// ------------------------------------------------------------
const sectionsContainer = document.getElementById("sections-container");

function renderSections() {
  sectionsContainer.innerHTML = "";
  const sorted = sortedSections();
  sorted.forEach((section, i) => {
    sectionsContainer.appendChild(renderSectionBlock(section, i === 0, i === sorted.length - 1));
  });
}

function renderSectionBlock(section, isFirst, isLast) {
  const block = document.createElement("div");
  block.className = "panel section-block";

  const head = document.createElement("div");
  head.className = "section-block-head";

  const title = document.createElement("h3");
  const typeLabel = section.type === "weekday" ? "Day of week" : section.type === "cycle" ? "Cycle" : "Static";
  title.innerHTML = `${escapeHtml(section.name)} <span class="type-badge">${typeLabel}</span>`;
  head.appendChild(title);

  const btns = document.createElement("div");
  btns.className = "head-btns";

  const orderControls = document.createElement("div");
  orderControls.className = "order-controls";
  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "btn small icon";
  upBtn.textContent = "↑";
  upBtn.disabled = isFirst;
  upBtn.title = "Move up";
  upBtn.addEventListener("click", () => moveSection(section.id, -1));
  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "btn small icon";
  downBtn.textContent = "↓";
  downBtn.disabled = isLast;
  downBtn.title = "Move down";
  downBtn.addEventListener("click", () => moveSection(section.id, 1));
  orderControls.appendChild(upBtn);
  orderControls.appendChild(downBtn);
  btns.appendChild(orderControls);

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "btn small";
  renameBtn.textContent = "Rename";
  renameBtn.addEventListener("click", async () => {
    const name = prompt("Section name:", section.name);
    if (!name) return;
    section.name = name;
    await persistSection(section);
    renderSections();
  });
  btns.appendChild(renameBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn small danger";
  deleteBtn.textContent = "Delete section";
  deleteBtn.addEventListener("click", () => deleteSection(section.id));
  btns.appendChild(deleteBtn);

  head.appendChild(btns);
  block.appendChild(head);

  block.appendChild(
    section.type === "weekday" ? renderWeekdayEditor(section)
      : section.type === "cycle" ? renderCycleEditor(section)
      : renderStaticEditor(section)
  );

  return block;
}

function renderStaticEditor(section) {
  const wrap = document.createElement("div");

  const colorRow = document.createElement("div");
  colorRow.className = "row";
  const colorLabelWrap = document.createElement("div");
  colorLabelWrap.innerHTML = `<label class="small">Section color</label>`;
  colorRow.appendChild(colorLabelWrap);

  const currentColor = section.color || staticAccent(section.id);
  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.value = /^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : "#5b6fe0";

  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.value = currentColor;
  hexInput.style.width = "110px";

  colorPicker.addEventListener("input", () => { hexInput.value = colorPicker.value; });
  colorPicker.addEventListener("change", async () => {
    section.color = colorPicker.value;
    await persistSection(section);
  });
  hexInput.addEventListener("change", async () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) colorPicker.value = hexInput.value;
    section.color = hexInput.value;
    await persistSection(section);
  });

  colorRow.appendChild(colorPicker);
  colorRow.appendChild(hexInput);
  wrap.appendChild(colorRow);

  if (!section.parts) section.parts = [];
  wrap.appendChild(renderPartsList(section, section.parts, () => section.parts));
  return wrap;
}

function renderWeekdayEditor(section) {
  const wrap = document.createElement("div");

  const schemeRow = document.createElement("div");
  schemeRow.className = "row";
  const schemeLabelWrap = document.createElement("div");
  schemeLabelWrap.innerHTML = `<label class="small">Color style</label>`;
  schemeRow.appendChild(schemeLabelWrap);
  const schemeSelect = document.createElement("select");
  [["trio", "Trio (blue / purple / pink)"], ["rainbow", "Rainbow (7 colors, starting red)"]].forEach(([val, labelText]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = labelText;
    if ((section.colorScheme || "trio") === val) opt.selected = true;
    schemeSelect.appendChild(opt);
  });
  schemeSelect.addEventListener("change", async () => {
    section.colorScheme = schemeSelect.value;
    await persistSection(section);
  });
  schemeRow.appendChild(schemeSelect);
  wrap.appendChild(schemeRow);

  const activeKey = activeTabBySection[section.id] || "monday";

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  WEEKDAY_KEYS.forEach((key) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab" + (key === activeKey ? " active" : "");
    tab.textContent = WEEKDAY_LABELS[key];
    tab.addEventListener("click", () => {
      activeTabBySection[section.id] = key;
      renderSections();
    });
    tabs.appendChild(tab);
  });
  wrap.appendChild(tabs);

  if (!section.days[activeKey]) section.days[activeKey] = [];
  const parts = section.days[activeKey];
  wrap.appendChild(renderPartsList(section, parts, () => section.days[activeKey]));

  return wrap;
}

function renderCycleEditor(section) {
  const wrap = document.createElement("div");

  const dateRow = document.createElement("div");
  dateRow.className = "row";
  dateRow.innerHTML = `<div><label class="small">Start date (Day 1)</label></div>`;
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = section.startDate || todayStr();
  dateInput.addEventListener("change", async () => {
    section.startDate = dateInput.value;
    await persistSection(section);
  });
  dateRow.appendChild(dateInput);
  wrap.appendChild(dateRow);

  const activeIdx = activeTabBySection[section.id] ?? 0;
  const clampedIdx = Math.min(activeIdx, section.days.length - 1);

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  section.days.forEach((_, i) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab" + (i === clampedIdx ? " active" : "");
    tab.textContent = `Day ${i + 1}`;
    tab.addEventListener("click", () => {
      activeTabBySection[section.id] = i;
      renderSections();
    });
    tabs.appendChild(tab);
  });
  const addDayBtn = document.createElement("button");
  addDayBtn.type = "button";
  addDayBtn.className = "btn small";
  addDayBtn.textContent = "+ Add day";
  addDayBtn.addEventListener("click", async () => {
    section.days.push({ parts: [] });
    activeTabBySection[section.id] = section.days.length - 1;
    await persistSection(section);
    renderSections();
  });
  tabs.appendChild(addDayBtn);
  wrap.appendChild(tabs);

  if (section.days.length > 1) {
    const removeDayBtn = document.createElement("button");
    removeDayBtn.type = "button";
    removeDayBtn.className = "btn small danger mb-12";
    removeDayBtn.textContent = "Delete this day";
    removeDayBtn.addEventListener("click", async () => {
      if (!confirm(`Delete Day ${clampedIdx + 1}? Later days will shift down, and the cycle length will shrink.`)) return;
      section.days.splice(clampedIdx, 1);
      activeTabBySection[section.id] = Math.max(0, clampedIdx - 1);
      await persistSection(section);
      renderSections();
    });
    wrap.appendChild(removeDayBtn);
  }

  const parts = (section.days[clampedIdx] && section.days[clampedIdx].parts) || [];
  wrap.appendChild(renderPartsList(section, parts, () => {
    if (!section.days[clampedIdx].parts) section.days[clampedIdx].parts = [];
    return section.days[clampedIdx].parts;
  }));

  return wrap;
}

function renderPartsList(section, parts, getPartsArray) {
  const wrap = document.createElement("div");

  parts.forEach((part, i) => {
    wrap.appendChild(renderPartCard(section, part, i, getPartsArray));
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn";
  addBtn.textContent = "+ Add part";
  addBtn.addEventListener("click", async () => {
    getPartsArray().push({ type: "text", text: "" });
    await persistSection(section);
    renderSections();
  });
  wrap.appendChild(addBtn);

  return wrap;
}

function renderPartCard(section, part, index, getPartsArray) {
  if (!part.type) part.type = "text"; // backward-compatible default

  const card = document.createElement("div");
  card.className = "part-card";

  const head = document.createElement("div");
  head.className = "part-head";

  const typeSelect = document.createElement("select");
  [["text", "Plain text"], ["heading", "Heading"], ["divider", "Divider"], ["checklist", "Checklist"], ["dropdown", "Dropdown questions"]].forEach(([val, labelText]) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = labelText;
    if (part.type === val) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener("change", async () => {
    const newType = typeSelect.value;
    Object.keys(part).forEach((k) => delete part[k]);
    part.type = newType;
    if (newType === "text") part.text = "";
    if (newType === "heading") part.text = "";
    if (newType === "divider") { /* no fields needed */ }
    if (newType === "checklist") part.items = [""];
    if (newType === "dropdown") part.questions = [{ question: "", options: [""] }];
    await persistSection(section);
    renderSections();
  });
  head.appendChild(typeSelect);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn small danger";
  deleteBtn.textContent = "Delete part";
  deleteBtn.addEventListener("click", async () => {
    getPartsArray().splice(index, 1);
    await persistSection(section);
    renderSections();
  });
  head.appendChild(deleteBtn);

  card.appendChild(head);

  if (part.type === "text") {
    const textArea = document.createElement("textarea");
    textArea.value = part.text || "";
    textArea.placeholder = "What should this part say?";
    textArea.addEventListener("change", async () => {
      part.text = textArea.value;
      await persistSection(section);
    });
    card.appendChild(textArea);
  } else if (part.type === "heading") {
    const headingInput = document.createElement("input");
    headingInput.type = "text";
    headingInput.value = part.text || "";
    headingInput.placeholder = "Heading text — shown large and bold";
    headingInput.style.width = "100%";
    headingInput.addEventListener("change", async () => {
      part.text = headingInput.value;
      await persistSection(section);
    });
    card.appendChild(headingInput);
  } else if (part.type === "divider") {
    const note = document.createElement("p");
    note.className = "status-msg";
    note.style.margin = "0";
    note.textContent = "This part renders as a plain visual divider — nothing to fill in.";
    card.appendChild(note);
  } else if (part.type === "checklist") {
    if (!part.items) part.items = [];
    card.appendChild(itemListEditor(part.items, async () => { await persistSection(section); }, renderSections));
  } else if (part.type === "dropdown") {
    if (!part.questions) part.questions = [];
    card.appendChild(questionListEditor(part.questions, async () => { await persistSection(section); }, renderSections));
  }

  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

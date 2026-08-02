/* =========================================================
   Wall-to-Wall Count — app.js
   Vanilla JS, Firebase (free Spark plan). No build step needed.
   ========================================================= */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const COUNTS_PATH = "counts";
const USER_EMAIL_DOMAIN = "@warehouse.local"; // see README-SETUP.md

let skuMaster = [];      // loaded once from sku-master.json
let pendingLines = [];   // lines queued for the current pallet, pre-submit
let selectedSku = null;  // { code, description, qtyPerBox }

/* ---------------- Utility ---------------- */
function $(id) { return document.getElementById(id); }

function showToast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add("hidden"), 3200);
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

/* ---------------- Load SKU master (static JSON, free hosting) ---------------- */
async function loadSkuMaster() {
  try {
    const res = await fetch("sku-master.json", { cache: "force-cache" });
    skuMaster = await res.json();
  } catch (e) {
    console.error("Could not load sku-master.json", e);
    showToast("Could not load SKU master list", true);
  }
}

/* ---------------- Auth ---------------- */
$("loginBtn").addEventListener("click", async () => {
  const username = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  $("loginError").textContent = "";
  if (!username || !password) {
    $("loginError").textContent = "Enter your user name and password.";
    return;
  }
  const email = username.includes("@") ? username : username + USER_EMAIL_DOMAIN;
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (e) {
    $("loginError").textContent = "Sign-in failed. Check your user name and password.";
  }
});

$("logoutBtn").addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  if (user) {
    $("loginScreen").classList.add("hidden");
    $("appShell").classList.remove("hidden");
    $("userChip").textContent = user.email.replace(USER_EMAIL_DOMAIN, "");
    await loadSkuMaster();
  } else {
    $("appShell").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
  }
});

/* ---------------- Tabs ---------------- */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.remove("hidden");
  });
});

/* ---------------- SKU search / autocomplete ---------------- */
const skuSearch = $("skuSearch");
const skuResults = $("skuResults");

skuSearch.addEventListener("input", () => {
  const q = skuSearch.value.trim().toLowerCase();
  selectedSku = null;
  if (!q) { skuResults.classList.add("hidden"); return; }
  const matches = skuMaster
    .filter((s) => s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    .slice(0, 30);
  if (!matches.length) { skuResults.classList.add("hidden"); return; }
  skuResults.innerHTML = matches.map((s, i) =>
    `<div class="ac-item" data-idx="${i}">
       <div class="ac-code">${s.code}</div>
       <div class="ac-desc">${s.description}</div>
     </div>`
  ).join("");
  skuResults.classList.remove("hidden");
  skuResults.querySelectorAll(".ac-item").forEach((el, i) => {
    el.addEventListener("click", () => selectSku(matches[i]));
  });
});

function selectSku(sku) {
  selectedSku = sku;
  skuSearch.value = sku.code;
  $("skuDescription").value = sku.description;
  $("qtyPerBox").value = sku.qtyPerBox;
  skuResults.classList.add("hidden");
  recalcTotal();
}

/* ---------------- Qty calculation ---------------- */
function recalcTotal() {
  const qtyPerBox = parseFloat($("qtyPerBox").value) || 0;
  const fullBox = parseFloat($("fullBoxQty").value) || 0;
  const loose = parseFloat($("looseBoxQty").value) || 0;
  const total = qtyPerBox * fullBox + loose;
  $("totalQty").textContent = total;
  return total;
}
["qtyPerBox", "fullBoxQty", "looseBoxQty"].forEach((id) =>
  $(id).addEventListener("input", recalcTotal)
);

/* ---------------- Pallet ID validation ---------------- */
const PALLET_PREFIX = "HE";
function isValidPalletId(id) {
  return id.trim().toUpperCase().startsWith(PALLET_PREFIX);
}
$("palletId").addEventListener("input", () => $("palletId").classList.remove("invalid"));
$("palletId").addEventListener("blur", () => {
  const val = $("palletId").value.trim();
  if (val && !isValidPalletId(val)) {
    $("palletId").classList.add("invalid");
    showToast(`Pallet ID must start with "${PALLET_PREFIX}"`, true);
  } else {
    $("palletId").classList.remove("invalid");
  }
});

/* ---------------- Add line ---------------- */
$("addLineBtn").addEventListener("click", () => {
  const palletId = $("palletId").value.trim();
  const locationId = $("locationId").value.trim();
  if (!palletId) return showToast("Scan the Pallet ID first", true);
  if (!isValidPalletId(palletId)) {
    $("palletId").classList.add("invalid");
    return showToast(`Pallet ID must start with "${PALLET_PREFIX}" — check the scan`, true);
  }
  if (!locationId) return showToast("Scan the Location first", true);
  if (!selectedSku) return showToast("Select a SKU from the list", true);

  const line = {
    skuCode: selectedSku.code,
    description: selectedSku.description,
    palletId, locationId,
    qtyPerBox: parseFloat($("qtyPerBox").value) || 0,
    fullBox: parseFloat($("fullBoxQty").value) || 0,
    looseBox: parseFloat($("looseBoxQty").value) || 0,
    totalQty: recalcTotal(),
  };
  pendingLines.push(line);
  renderLines();

  // reset SKU + qty fields only, keep pallet/location for the next line
  skuSearch.value = "";
  $("skuDescription").value = "";
  $("qtyPerBox").value = "";
  $("fullBoxQty").value = "0";
  $("looseBoxQty").value = "0";
  selectedSku = null;
  recalcTotal();
  skuSearch.focus();
});

function renderLines() {
  const tbody = document.querySelector("#linesTable tbody");
  tbody.innerHTML = pendingLines.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="mono">${l.skuCode}</td>
      <td>${l.description}</td>
      <td>${l.qtyPerBox}</td>
      <td>${l.fullBox}</td>
      <td>${l.looseBox}</td>
      <td>${l.totalQty}</td>
      <td><button class="remove-row" data-i="${i}">✕</button></td>
    </tr>`).join("");
  $("lineCount").textContent = pendingLines.length;
  tbody.querySelectorAll(".remove-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingLines.splice(parseInt(btn.dataset.i), 1);
      renderLines();
    });
  });
}

/* ---------------- Submit ---------------- */
$("submitBtn").addEventListener("click", async () => {
  if (!pendingLines.length) return showToast("Add at least one line first", true);
  const user = auth.currentUser;
  const updates = {};
  pendingLines.forEach((line) => {
    const key = db.ref(COUNTS_PATH).push().key;
    updates[`${COUNTS_PATH}/${key}`] = {
      skuCode: line.skuCode,
      description: line.description,
      palletId: line.palletId,
      locationId: line.locationId,
      qtyPerBox: line.qtyPerBox,
      fullBox: line.fullBox,
      looseBox: line.looseBox,
      totalQty: line.totalQty,
      countedBy: user.email.replace(USER_EMAIL_DOMAIN, ""),
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };
  });
  try {
    await db.ref().update(updates);
    showToast(`✅ Submitted ${pendingLines.length} line(s) for Pallet ${pendingLines[0].palletId}`);
    pendingLines = [];
    renderLines();
    $("palletId").value = "";
    $("locationId").value = "";
    $("palletId").focus();
  } catch (e) {
    console.error(e);
    showToast("Submit failed — check your connection and try again.", true);
  }
});

/* ---------------- Verify tab ---------------- */
$("verifyBtn").addEventListener("click", async () => {
  const val = $("verifyInput").value.trim();
  if (!val) return showToast("Scan a Pallet ID or Location ID", true);

  const [byPallet, byLocation] = await Promise.all([
    db.ref(COUNTS_PATH).orderByChild("palletId").equalTo(val).once("value"),
    db.ref(COUNTS_PATH).orderByChild("locationId").equalTo(val).once("value"),
  ]);
  const seen = new Set();
  const rows = [];
  [byPallet, byLocation].forEach((snap) => {
    snap.forEach((child) => {
      if (seen.has(child.key)) return;
      seen.add(child.key);
      rows.push(child.val());
    });
  });

  $("verifyCount").textContent = rows.length;
  $("verifyEmpty").classList.toggle("hidden", rows.length > 0);
  document.querySelector("#verifyTable tbody").innerHTML = rows.map((r) => `
    <tr>
      <td class="mono">${r.skuCode}</td><td>${r.description}</td>
      <td class="mono">${r.palletId}</td><td class="mono">${r.locationId}</td>
      <td>${r.qtyPerBox}</td><td>${r.fullBox}</td><td>${r.looseBox}</td>
      <td>${r.totalQty}</td><td>${r.countedBy}</td><td>${fmtDate(r.timestamp)}</td>
    </tr>`).join("");
});

/* ---------------- Service worker (offline app shell) ---------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW failed:", e));
  });
}

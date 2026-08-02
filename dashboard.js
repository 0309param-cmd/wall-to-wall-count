/* =========================================================
   Wall-to-Wall Count — dashboard.js
   Supervisor-only live view. Not loaded by the PDA app (index.html).
   ========================================================= */

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const COUNTS_PATH = "counts";
const USER_EMAIL_DOMAIN = "@warehouse.local"; // must match app.js

let dashboardRows = [];
let isAdmin = false;

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
    const adminSnap = await db.ref("admins/" + user.uid).once("value");
    isAdmin = adminSnap.val() === true;
    attachDashboardListener();
  } else {
    $("appShell").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
  }
});

/* ---------------- Live data ---------------- */
function attachDashboardListener() {
  db.ref(COUNTS_PATH)
    .orderByChild("timestamp")
    .limitToLast(500)
    .on("value", (snap) => {
      const rows = [];
      snap.forEach((child) => { rows.push({ ...child.val(), _key: child.key }); });
      dashboardRows = rows.reverse(); // newest first
      renderDashboard();
    });
}

function renderDashboard() {
  const fPallet = $("fltPallet").value.trim().toLowerCase();
  const fLocation = $("fltLocation").value.trim().toLowerCase();
  const fSku = $("fltSku").value.trim().toLowerCase();
  const fUser = $("fltUser").value.trim().toLowerCase();

  const filtered = dashboardRows.filter((r) =>
    (!fPallet || (r.palletId || "").toLowerCase().includes(fPallet)) &&
    (!fLocation || (r.locationId || "").toLowerCase().includes(fLocation)) &&
    (!fSku || (r.skuCode || "").toLowerCase().includes(fSku)) &&
    (!fUser || (r.countedBy || "").toLowerCase().includes(fUser))
  );

  document.querySelector("#dashTable tbody").innerHTML = filtered.map((r) => `
    <tr>
      <td class="mono">${r.skuCode}</td><td>${r.description}</td>
      <td class="mono">${r.palletId}</td><td class="mono">${r.locationId}</td>
      <td>${r.qtyPerBox}</td><td>${r.fullBox}</td><td>${r.looseBox}</td>
      <td>${r.totalQty}</td><td>${r.countedBy}</td><td>${fmtDate(r.timestamp)}</td>
      <td>${isAdmin ? `<button class="remove-row" data-key="${r._key}">✕</button>` : ""}</td>
    </tr>`).join("");

  if (isAdmin) {
    document.querySelectorAll("#dashTable .remove-row").forEach((btn) => {
      btn.addEventListener("click", () => deleteRow(btn.dataset.key));
    });
  }
}

async function deleteRow(key) {
  if (!confirm("Delete this record permanently? This cannot be undone.")) return;
  try {
    await db.ref(COUNTS_PATH + "/" + key).remove();
    showToast("Record deleted");
  } catch (e) {
    console.error(e);
    showToast("Delete failed — admin access required", true);
  }
}
["fltPallet", "fltLocation", "fltSku", "fltUser"].forEach((id) =>
  $(id).addEventListener("input", renderDashboard)
);

/* ---------------- Export to Excel ---------------- */
$("exportBtn").addEventListener("click", () => {
  const rows = Array.from(document.querySelectorAll("#dashTable tbody tr")).map((tr) => {
    const cells = tr.querySelectorAll("td");
    return {
      "SKU Code": cells[0].textContent,
      "Description": cells[1].textContent,
      "Pallet ID": cells[2].textContent,
      "Location ID": cells[3].textContent,
      "Qty/Box": cells[4].textContent,
      "Full Box": cells[5].textContent,
      "Loose Box": cells[6].textContent,
      "Total Qty": cells[7].textContent,
      "Counted By": cells[8].textContent,
      "Date": cells[9].textContent,
    };
  });
  if (!rows.length) return showToast("Nothing to export", true);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Count Data");
  XLSX.writeFile(wb, `wall-to-wall-count-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

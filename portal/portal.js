// KosherGuard management portal. Super admins (SUPER_ADMINS) manage institutions and their
// managers; institution managers manage their own devices, policy, staff and unlock codes.
// Data model and access rules: firebase/firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where,
  orderBy, limit, onSnapshot, writeBatch, serverTimestamp, Timestamp, getCountFromServer, connectFirestoreEmulator,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { FIREBASE_CONFIG, SUPER_ADMINS, ONLINE_WINDOW_MS } from "../assets/config.js";
import { newMasterSecret, randomToken, computeUnlockCode } from "../assets/kgcrypto.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
auth.languageCode = "he";
const db = getFirestore(app);
// Local testing against `firebase emulators:start`: open the portal with ?emu on localhost.
if (location.hostname === "localhost" && new URLSearchParams(location.search).has("emu")) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const CATALOG = DEFAULT_CATALOG;
const appLabel = (pkg) => APP_NAMES[pkg] || pkg;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M15 8l2 2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
};
const ic = (name, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name] || ""}</svg>`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function toast(msg, isErr = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("err", isErr);
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), isErr ? 4200 : 2200);
}
function fail(err) {
  console.error(err);
  const msg = err?.code === "permission-denied" ? "אין הרשאה לפעולה הזו" : (err?.message || String(err));
  toast(msg, true);
}
function copy(text) {
  navigator.clipboard.writeText(text).then(() => toast("הועתק"), () => toast("ההעתקה נכשלה", true));
}
const ms = (v) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : v?.toMillis ? v.toMillis() : 0);
function ago(v) {
  const t = ms(v);
  if (!t) return "אף פעם";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "עכשיו";
  if (s < 3600) return `לפני ${Math.round(s / 60)} דק'`;
  if (s < 86400) return `לפני ${Math.round(s / 3600)} שע'`;
  return `לפני ${Math.round(s / 86400)} ימים`;
}
const fmtTime = (t) => new Date(t).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (t) => (t ? new Date(ms(t)).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—");
const minutesToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const timeToMinutes = (v) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
const isOnline = (d) => Date.now() - ms(d.lastSeen) < ONLINE_WINDOW_MS;
const isLive = (d) => ms(d.liveUntil) > Date.now();
function deviceIssues(d) {
  const out = [];
  if (d.filteringEnabled === false) out.push("הסינון כבוי");
  const p = d.protection || {};
  if (d.tier !== "rom" && d.tier !== "owner" && p.accessibility === false) out.push("שירות הנגישות כבוי");
  if (p.vpn === false) out.push("ה-VPN כבוי");
  if (d.tier === "owner" && p.deviceOwner === false) out.push("לא Device Owner");
  return out;
}
const TIERS = { app: "אפליקציה", owner: "מנהל מכשיר", rom: "מערכת הפעלה" };
const PERMS = {
  monitoring: ["ניטור פעילות", "צפייה באתרים ובאפליקציות שהתלמיד השתמש בהם"],
  liveView: ["צפייה חיה", "עדכון מצב המכשיר כל כמה שניות לפי בקשה"],
  remoteCommands: ["פקודות מרחוק", "שחרור אפליקציה, סנכרון, נעילה והודעות"],
  editPolicy: ["עריכת מדיניות", "שינוי מה חסום במכשירי המוסד"],
  manageStaff: ["ניהול צוות", "הוספת אנשי צוות נוספים למוסד"],
};
const DEFAULT_SETTINGS = {
  profileId: "recommended", customCategoryIds: [], customAppPackages: [], filteringEnabled: true,
  downtimeEnabled: false, downtimeStartMinutes: 22 * 60, downtimeEndMinutes: 7 * 60,
  dailyDeviceLimitEnabled: false, dailyDeviceLimitMinutes: 120, essentialAppPackages: [],
};
const DEFAULT_TELEMETRY = { reportDomains: true, reportApps: true, intervalMinutes: 5 };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const S = {
  user: null, email: "", isSuper: false, manager: null,
  inst: null, devices: [], keys: null, policy: null,
  subs: [], drawerSubs: [],
};
function clearSubs(list = "subs") { S[list].forEach((u) => u()); S[list] = []; }
const can = (key) => S.isSuper || S.inst?.permissions?.[key] === true;

function show(view) {
  for (const v of ["viewLoading", "viewLogin", "viewVerify", "viewNoAccess", "viewApp"]) $(v).hidden = v !== view;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const AUTH_ERRORS = {
  "auth/invalid-credential": "מייל או סיסמה שגויים",
  "auth/wrong-password": "סיסמה שגויה",
  "auth/user-not-found": "לא נמצא משתמש עם המייל הזה. בפעם הראשונה בחרו \"יצירת סיסמה\"",
  "auth/email-already-in-use": "כבר יש חשבון עם המייל הזה. נסו להיכנס, או \"שכחתי סיסמה\"",
  "auth/weak-password": "הסיסמה קצרה מדי (לפחות 6 תווים)",
  "auth/invalid-email": "כתובת מייל לא תקינה",
  "auth/popup-closed-by-user": "חלון ההתחברות נסגר",
  "auth/too-many-requests": "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות",
  "auth/unauthorized-domain": "הדומיין הזה עדיין לא מאושר ב-Firebase (Authentication → Settings → Authorized domains)",
};
const authMsg = (e) => AUTH_ERRORS[e.code] || e.message;
let signupMode = false;

function setLoginError(msg) { $("loginErr").hidden = !msg; $("loginErr").textContent = msg || ""; }

$("btnGoogle").addEventListener("click", async () => {
  setLoginError("");
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { setLoginError(authMsg(e)); }
});
$("btnToggleMode").addEventListener("click", () => {
  signupMode = !signupMode;
  $("loginTitle").textContent = signupMode ? "יצירת סיסמה" : "כניסה לפורטל הניהול";
  $("loginSub").textContent = signupMode ? "למי שנרשם על ידי מנהל המערכת ועדיין אין לו סיסמה" : "למנהלי מוסדות ולצוות שקיבלו הרשאה";
  $("btnEmailSubmit").textContent = signupMode ? "יצירת חשבון" : "כניסה";
  $("btnToggleMode").textContent = signupMode ? "כבר יש לי סיסמה" : "פעם ראשונה? יצירת סיסמה";
  $("inPass").autocomplete = signupMode ? "new-password" : "current-password";
  setLoginError("");
});
$("formEmail").addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoginError("");
  const email = $("inEmail").value.trim(), pass = $("inPass").value;
  $("btnEmailSubmit").disabled = true;
  try {
    if (signupMode) {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(cred.user);
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch (err) { setLoginError(authMsg(err)); }
  $("btnEmailSubmit").disabled = false;
});
$("btnForgot").addEventListener("click", async () => {
  const email = $("inEmail").value.trim();
  if (!email) return setLoginError("הקלידו קודם את כתובת המייל");
  try { await sendPasswordResetEmail(auth, email); toast("נשלח מייל לאיפוס סיסמה"); } catch (err) { setLoginError(authMsg(err)); }
});
$("btnRecheck").addEventListener("click", async () => { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); boot(auth.currentUser); });
$("btnResend").addEventListener("click", async () => {
  try { await sendEmailVerification(auth.currentUser); toast("מייל האימות נשלח שוב"); } catch (err) { fail(err); }
});
$("btnSignOut").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, boot);

async function boot(user) {
  clearSubs(); clearSubs("drawerSubs");
  S.user = user; S.manager = null; S.inst = null;
  $("who").hidden = !user;
  if (!user) return show("viewLogin");
  S.email = (user.email || "").toLowerCase();
  $("whoEmail").textContent = user.email || "";
  $("whoAvatar").innerHTML = user.photoURL ? `<img src="${esc(user.photoURL)}" alt="">` : esc((user.displayName || user.email || "?")[0].toUpperCase());
  if (!user.emailVerified) { $("verifyEmail").textContent = user.email; return show("viewVerify"); }
  S.isSuper = SUPER_ADMINS.includes(S.email);
  if (!S.isSuper) {
    try {
      const m = await getDoc(doc(db, "managers", S.email));
      if (!m.exists() || !m.data().active) throw new Error("no manager");
      S.manager = { id: m.id, ...m.data() };
      const i = await getDoc(doc(db, "institutions", S.manager.instId));
      if (!i.exists()) throw new Error("no institution");
    } catch {
      $("noAccessEmail").textContent = user.email;
      return show("viewNoAccess");
    }
  }
  show("viewApp");
  route();
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
const go = (h) => { if (location.hash !== "#/" + h) location.hash = "#/" + h; else route(); };
window.addEventListener("hashchange", route);

function route() {
  if (!S.user || $("viewApp").hidden) return;
  closeDrawer();
  clearSubs();
  const [a, b, c] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!S.isSuper && (a !== "inst" || b !== S.manager.instId)) return go(`inst/${S.manager.instId}/devices`);
  if (a === "inst" && b) return renderInstitution(b, c || "devices");
  if (a === "institutions") return renderInstitutions();
  if (a === "managers") return renderManagers();
  if (a === "overview") return renderOverview();
  go("overview");
}

function renderSide(items, ctx) {
  $("side").innerHTML =
    (ctx ? `<div class="ctx"><small>${esc(ctx.label)}</small><b>${esc(ctx.title)}</b></div>` : "") +
    items.map((it) => it === "-" ? '<div class="sep"></div>'
      : `<a href="#/${it.href}" class="${it.on ? "on" : ""}">${ic(it.icon)}<span>${esc(it.label)}</span></a>`).join("");
}
function superSide(active) {
  renderSide([
    { href: "overview", icon: "grid", label: "סקירה כללית", on: active === "overview" },
    { href: "institutions", icon: "building", label: "מוסדות", on: active === "institutions" },
    { href: "managers", icon: "users", label: "מנהלים וצוות", on: active === "managers" },
  ], { label: "מנהל מערכת", title: "כל המוסדות" });
}
const main = (html) => { $("main").innerHTML = html; window.scrollTo(0, 0); };
const loadingHtml = '<div class="loading" style="min-height:40vh"><div class="spinner"></div></div>';

// ---------------------------------------------------------------------------
// Super admin: overview
// ---------------------------------------------------------------------------
async function slotCount(instId) {
  try { return (await getCountFromServer(collection(db, "institutions", instId, "slots"))).data().count; } catch { return 0; }
}

async function renderOverview() {
  superSide("overview");
  main(loadingHtml);
  try {
    const [instSnap, onlineSnap] = await Promise.all([
      getDocs(collection(db, "institutions")),
      getCountFromServer(query(collection(db, "devices"), where("lastSeen", ">", Timestamp.fromMillis(Date.now() - ONLINE_WINDOW_MS)))),
    ]);
    const insts = instSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const counts = await Promise.all(insts.map((i) => slotCount(i.id)));
    const total = counts.reduce((a, b) => a + b, 0);
    const capacity = insts.reduce((a, i) => a + (i.maxStudents || 0), 0);
    main(`
      <div class="page-head"><div><h1>שלום${S.user.displayName ? ", " + esc(S.user.displayName.split(" ")[0]) : ""}</h1>
        <p>תמונת מצב של כל המוסדות והמכשירים</p></div>
        <div class="actions"><button class="btn" id="btnNewInst">${ic("plus")}מוסד חדש</button></div></div>
      <div class="grid-4" style="margin-bottom:22px">
        <div class="card stat"><small>מוסדות</small><b>${insts.length}</b></div>
        <div class="card stat"><small>מכשירים רשומים</small><b>${total}</b>
          <div class="bar"><i style="width:${capacity ? Math.min(100, (total / capacity) * 100) : 0}%"></i></div></div>
        <div class="card stat"><small>מחוברים עכשיו</small><b style="color:var(--accent)">${onlineSnap.data().count}</b></div>
        <div class="card stat"><small>מכסה כוללת</small><b>${capacity}</b></div>
      </div>
      <div class="panel"><div class="panel-head"><h2>מוסדות</h2><a class="btn sm ghost" href="#/institutions">לכל המוסדות</a></div>
        <div class="rows">${insts.length ? insts.map((i, n) => instRow(i, counts[n])).join("")
          : emptyHtml("building", "אין עדיין מוסדות", "צרו מוסד ראשון כדי להתחיל לרשום מכשירים")}</div></div>`);
    $("btnNewInst").onclick = () => editInstitution(null);
    bindInstRows();
  } catch (e) { fail(e); }
}

function instRow(i, used) {
  const pct = i.maxStudents ? Math.round((used / i.maxStudents) * 100) : 0;
  return `<div class="row" data-inst="${esc(i.id)}">
    <div class="dev-ic">${ic("building")}</div>
    <div class="t"><b>${esc(i.name)}</b><small>${esc([i.city, i.contactName].filter(Boolean).join(" · ") || "—")}</small></div>
    <div class="r">${i.active ? "" : '<span class="pill red">מושבת</span>'}
      <span class="pill ${pct >= 100 ? "red" : pct >= 85 ? "warn" : "blue"}">${used} / ${i.maxStudents || 0} תלמידים</span>
      <button class="icon-btn" data-edit="${esc(i.id)}" title="עריכה">${ic("edit")}</button></div></div>`;
}
function bindInstRows() {
  document.querySelectorAll("[data-inst]").forEach((r) => (r.onclick = (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed) { e.stopPropagation(); return getDoc(doc(db, "institutions", ed.dataset.edit)).then((s) => editInstitution({ id: s.id, ...s.data() })); }
    go(`inst/${r.dataset.inst}/devices`);
  }));
}
const emptyHtml = (icon, title, sub) => `<div class="empty">${ic(icon)}<b>${esc(title)}</b>${esc(sub)}</div>`;

// ---------------------------------------------------------------------------
// Super admin: institutions
// ---------------------------------------------------------------------------
async function renderInstitutions() {
  superSide("institutions");
  main(loadingHtml);
  try {
    const snap = await getDocs(collection(db, "institutions"));
    const insts = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, "he"));
    const counts = await Promise.all(insts.map((i) => slotCount(i.id)));
    main(`
      <div class="page-head"><div><h1>מוסדות</h1><p>כל מוסד מקבל מכסת תלמידים, הרשאות ומפתח שחרור משלו</p></div>
        <div class="actions"><button class="btn" id="btnNewInst">${ic("plus")}מוסד חדש</button></div></div>
      <div class="panel"><div class="panel-head"><h2>${insts.length} מוסדות</h2>
        <input class="input" id="instSearch" placeholder="חיפוש לפי שם או עיר" style="max-width:260px"></div>
        <div class="rows" id="instRows">${insts.length ? insts.map((i, n) => instRow(i, counts[n])).join("")
          : emptyHtml("building", "אין עדיין מוסדות", "לחצו על \"מוסד חדש\" כדי ליצור את הראשון")}</div></div>`);
    $("btnNewInst").onclick = () => editInstitution(null);
    $("instSearch").oninput = (e) => {
      const q = e.target.value.trim();
      document.querySelectorAll("#instRows .row").forEach((r) => { r.hidden = q && !r.textContent.includes(q); });
    };
    bindInstRows();
  } catch (e) { fail(e); }
}

function editInstitution(inst) {
  const p = inst?.permissions || { monitoring: true, liveView: true, remoteCommands: true, editPolicy: true, manageStaff: true };
  const tiers = inst?.tiers || ["app", "owner", "rom"];
  openModal(inst ? "עריכת מוסד" : "מוסד חדש", `
    <div class="form-grid">
      <div class="field full"><label>שם המוסד</label><input class="input" name="name" required value="${esc(inst?.name)}" placeholder="לדוגמה: ישיבת אור התורה"></div>
      <div class="field"><label>עיר</label><input class="input" name="city" value="${esc(inst?.city)}"></div>
      <div class="field"><label>מכסת תלמידים</label><input class="input" name="maxStudents" type="number" min="0" max="99999" required value="${inst?.maxStudents ?? 50}"></div>
      <div class="field"><label>איש קשר</label><input class="input" name="contactName" value="${esc(inst?.contactName)}"></div>
      <div class="field"><label>טלפון</label><input class="input ltr" name="contactPhone" value="${esc(inst?.contactPhone)}"></div>
    </div>
    <div class="field"><label>הרשאות למנהלי המוסד</label><div class="grid-2" style="gap:8px">
      ${Object.entries(PERMS).map(([k, [t, d]]) => `<label class="check"><input type="checkbox" name="perm_${k}" ${p[k] ? "checked" : ""}><span><b>${t}</b><small>${d}</small></span></label>`).join("")}
    </div></div>
    <div class="field"><label>שיטות התקנה מותרות</label><div class="grid-3" style="gap:8px">
      ${Object.entries(TIERS).map(([k, t]) => `<label class="check"><input type="checkbox" name="tier_${k}" ${tiers.includes(k) ? "checked" : ""}><span><b>${t}</b></span></label>`).join("")}
    </div></div>
    <label class="check"><input type="checkbox" name="active" ${inst?.active === false ? "" : "checked"}><span><b>המוסד פעיל</b><small>מוסד מושבת: המנהלים לא נכנסים ומכשירים חדשים לא נרשמים</small></span></label>
    ${inst ? `<button type="button" class="btn danger sm" id="btnDelInst" style="justify-self:start">${ic("trash")}מחיקת המוסד</button>` : ""}`,
  async (f) => {
    const data = {
      name: f.name.value.trim(), city: f.city.value.trim(), contactName: f.contactName.value.trim(),
      contactPhone: f.contactPhone.value.trim(), maxStudents: Math.max(0, parseInt(f.maxStudents.value, 10) || 0),
      active: f.active.checked,
      permissions: Object.fromEntries(Object.keys(PERMS).map((k) => [k, f["perm_" + k].checked])),
      tiers: Object.keys(TIERS).filter((k) => f["tier_" + k].checked),
    };
    if (inst) {
      await updateDoc(doc(db, "institutions", inst.id), data);
      toast("המוסד עודכן");
    } else {
      const id = "i" + randomToken(5);
      const b = writeBatch(db);
      b.set(doc(db, "institutions", id), { ...data, createdAt: serverTimestamp(), createdBy: S.email });
      b.set(doc(db, "institutions", id, "private", "keys"), { masterSecret: newMasterSecret(), enrollToken: randomToken(16), createdAt: serverTimestamp() });
      b.set(doc(db, "institutions", id, "public", "policy"), { settings: DEFAULT_SETTINGS, telemetry: DEFAULT_TELEMETRY, version: 1, updatedAt: serverTimestamp(), updatedBy: S.email });
      await b.commit();
      toast("המוסד נוצר");
      return go(`inst/${id}/staff`);
    }
    route();
  });
  const del = $("btnDelInst");
  if (del) del.onclick = () => deleteInstitution(inst);
}

async function deleteInstitution(inst) {
  if (!confirm(`למחוק את "${inst.name}" עם כל המכשירים, הצוות והמפתחות שלו? אי אפשר לבטל.`)) return;
  try {
    const refs = [];
    for (const sub of ["slots", "private", "public"]) (await getDocs(collection(db, "institutions", inst.id, sub))).forEach((d) => refs.push(d.ref));
    (await getDocs(query(collection(db, "devices"), where("instId", "==", inst.id)))).forEach((d) => refs.push(d.ref));
    (await getDocs(query(collection(db, "managers"), where("instId", "==", inst.id)))).forEach((d) => refs.push(d.ref));
    refs.push(doc(db, "institutions", inst.id));
    for (let i = 0; i < refs.length; i += 400) {
      const b = writeBatch(db);
      refs.slice(i, i + 400).forEach((r) => b.delete(r));
      await b.commit();
    }
    $("modal").close();
    toast("המוסד נמחק");
    go("institutions");
  } catch (e) { fail(e); }
}

// ---------------------------------------------------------------------------
// Super admin: managers
// ---------------------------------------------------------------------------
async function renderManagers() {
  superSide("managers");
  main(loadingHtml);
  try {
    const [mSnap, iSnap] = await Promise.all([getDocs(collection(db, "managers")), getDocs(collection(db, "institutions"))]);
    const insts = Object.fromEntries(iSnap.docs.map((d) => [d.id, d.data().name]));
    const mgrs = mSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (insts[a.instId] || "").localeCompare(insts[b.instId] || "", "he"));
    main(`
      <div class="page-head"><div><h1>מנהלים וצוות</h1><p>מי שרשום כאן יכול להיכנס לפורטל עם Google או עם מייל וסיסמה</p></div>
        <div class="actions"><button class="btn" id="btnNewMgr">${ic("plus")}מנהל חדש</button></div></div>
      <div class="panel"><div class="rows">${mgrs.length ? mgrs.map((m) => managerRow(m, insts[m.instId])).join("")
        : emptyHtml("users", "אין עדיין מנהלים", "הוסיפו מנהל ושייכו אותו למוסד")}</div></div>`);
    $("btnNewMgr").onclick = () => editManager(null, iSnap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    document.querySelectorAll("[data-mgr]").forEach((r) => (r.onclick = () =>
      editManager(mgrs.find((m) => m.id === r.dataset.mgr), iSnap.docs.map((d) => ({ id: d.id, name: d.data().name })))));
  } catch (e) { fail(e); }
}

function managerRow(m, instName) {
  return `<div class="row" data-mgr="${esc(m.id)}">
    <span class="avatar" style="width:42px;height:42px;background:var(--brand-soft);color:var(--brand)">${esc((m.name || m.email)[0].toUpperCase())}</span>
    <div class="t"><b>${esc(m.name || m.email)}</b><small class="mono">${esc(m.email)}</small></div>
    <div class="r">${instName !== undefined ? `<span class="pill">${esc(instName || "מוסד שנמחק")}</span>` : ""}
      <span class="pill ${m.role === "owner" ? "blue" : ""}">${m.role === "owner" ? "מנהל" : "צוות"}</span>
      ${m.active ? "" : '<span class="pill red">מושבת</span>'}</div></div>`;
}

function editManager(m, insts, fixedInstId) {
  const ownerAllowed = S.isSuper;
  openModal(m ? "עריכת משתמש" : (fixedInstId ? "איש צוות חדש" : "מנהל חדש"), `
    <div class="form-grid">
      <div class="field full"><label>מייל</label><input class="input ltr" name="email" type="email" required value="${esc(m?.email)}" ${m ? "readonly" : ""}>
        <span class="hint">חשבון Google עם המייל הזה, או סיסמה שהמשתמש ייצור בכניסה הראשונה</span></div>
      <div class="field"><label>שם</label><input class="input" name="name" value="${esc(m?.name)}"></div>
      <div class="field"><label>תפקיד</label><select class="input" name="role" ${ownerAllowed ? "" : "disabled"}>
        <option value="owner" ${m?.role !== "staff" && ownerAllowed ? "selected" : ""}>מנהל מוסד</option>
        <option value="staff" ${m?.role === "staff" || !ownerAllowed ? "selected" : ""}>איש צוות</option></select></div>
      ${fixedInstId ? "" : `<div class="field full"><label>מוסד</label><select class="input" name="instId" required>
        <option value="">בחרו מוסד…</option>${insts.map((i) => `<option value="${esc(i.id)}" ${m?.instId === i.id ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select></div>`}
    </div>
    <label class="check"><input type="checkbox" name="active" ${m?.active === false ? "" : "checked"}><span><b>פעיל</b><small>משתמש מושבת לא יכול להיכנס</small></span></label>
    ${m ? `<button type="button" class="btn danger sm" id="btnDelMgr" style="justify-self:start">${ic("trash")}הסרת המשתמש</button>` : ""}`,
  async (f) => {
    const email = (m?.email || f.email.value).trim().toLowerCase();
    await setDoc(doc(db, "managers", email), {
      email, name: f.name.value.trim(), role: ownerAllowed ? f.role.value : "staff",
      instId: fixedInstId || f.instId.value, active: f.active.checked,
      ...(m ? {} : { createdAt: serverTimestamp(), createdBy: S.email }),
    }, { merge: true });
    toast("נשמר");
    route();
  });
  const del = $("btnDelMgr");
  if (del) del.onclick = async () => {
    if (!confirm(`להסיר את ${m.email}?`)) return;
    try { await deleteDoc(doc(db, "managers", m.id)); $("modal").close(); toast("הוסר"); route(); } catch (e) { fail(e); }
  };
}

// ---------------------------------------------------------------------------
// Institution workspace
// ---------------------------------------------------------------------------
const INST_TABS = [
  { id: "devices", icon: "phone", label: "מכשירים" },
  { id: "enroll", icon: "qr", label: "רישום מכשיר" },
  { id: "policy", icon: "sliders", label: "מדיניות סינון" },
  { id: "codes", icon: "key", label: "קודי שחרור" },
  { id: "staff", icon: "users", label: "צוות", perm: "manageStaff" },
  { id: "info", icon: "info", label: "פרטי המוסד" },
];

function renderInstitution(instId, tab) {
  main(loadingHtml);
  let first = true;
  S.subs.push(onSnapshot(doc(db, "institutions", instId), (snap) => {
    if (!snap.exists()) { toast("המוסד לא נמצא", true); return go(S.isSuper ? "institutions" : ""); }
    S.inst = { id: snap.id, ...snap.data() };
    const tabs = INST_TABS.filter((t) => !t.perm || can(t.perm));
    renderSide([
      ...(S.isSuper ? [{ href: "institutions", icon: "back", label: "כל המוסדות" }, "-"] : []),
      ...tabs.map((t) => ({ href: `inst/${instId}/${t.id}`, icon: t.icon, label: t.label, on: t.id === tab })),
    ], { label: S.isSuper ? "מוסד" : (S.manager.role === "owner" ? "מנהל מוסד" : "צוות"), title: S.inst.name });
    if (first) { first = false; (TAB_RENDER[tab] || TAB_RENDER.devices)(); }
  }, fail));
}

const TAB_RENDER = {
  devices: renderDevices,
  enroll: renderEnroll,
  policy: renderPolicy,
  codes: renderCodes,
  staff: renderStaff,
  info: renderInfo,
};

function head(title, sub, actions = "") {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
}

// ----- Devices ------------------------------------------------------------
function renderDevices() {
  const inst = S.inst;
  main(head("מכשירים", `${esc(inst.name)} · מצב כל מכשירי התלמידים בזמן אמת`,
    `<a class="btn" href="#/inst/${inst.id}/enroll">${ic("plus")}רישום מכשיר</a>`) + `
    <div class="grid-4" style="margin-bottom:22px" id="devStats"></div>
    <div class="panel"><div class="panel-head"><div class="toolbar">
        <input class="input" id="devSearch" placeholder="חיפוש תלמיד, כיתה או דגם">
        <select class="input" id="devFilter" style="min-width:150px">
          <option value="all">כל המכשירים</option><option value="online">מחוברים</option>
          <option value="offline">לא מחוברים</option><option value="issues">עם בעיות הגנה</option></select></div>
      </div><div class="rows" id="devRows">${loadingHtml}</div></div>`);
  const draw = () => drawDevices();
  $("devSearch").oninput = draw;
  $("devFilter").onchange = draw;
  S.subs.push(onSnapshot(query(collection(db, "devices"), where("instId", "==", inst.id)), (snap) => {
    S.devices = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.lastSeen) - ms(a.lastSeen));
    draw();
  }, fail));
  // Re-draw every 30s so "online"/"ago" labels stay accurate without new snapshots.
  const t = setInterval(draw, 30000);
  S.subs.push(() => clearInterval(t));
}

function drawDevices() {
  if (!$("devRows")) return;
  const all = S.devices, max = S.inst.maxStudents || 0;
  const online = all.filter(isOnline).length;
  const issues = all.filter((d) => deviceIssues(d).length).length;
  $("devStats").innerHTML = `
    <div class="card stat"><small>רשומים</small><b>${all.length}<span class="muted" style="font-size:16px"> / ${max}</span></b>
      <div class="bar"><i style="width:${max ? Math.min(100, (all.length / max) * 100) : 0}%"></i></div></div>
    <div class="card stat"><small>מחוברים עכשיו</small><b style="color:var(--accent)">${online}</b></div>
    <div class="card stat"><small>לא מחוברים</small><b>${all.length - online}</b></div>
    <div class="card stat"><small>בעיות הגנה</small><b style="color:${issues ? "var(--danger)" : "inherit"}">${issues}</b></div>`;
  const q = $("devSearch").value.trim().toLowerCase(), f = $("devFilter").value;
  const list = all.filter((d) => {
    if (f === "online" && !isOnline(d)) return false;
    if (f === "offline" && isOnline(d)) return false;
    if (f === "issues" && !deviceIssues(d).length) return false;
    return !q || [d.studentName, d.className, d.model, d.label].some((v) => (v || "").toLowerCase().includes(q));
  });
  if (!all.length) {
    $("devRows").innerHTML = emptyHtml("phone", "עדיין לא נרשמו מכשירים", "בלשונית \"רישום מכשיר\" יש ברקוד שסורקים באפליקציה בטלפון של התלמיד");
    return;
  }
  $("devRows").innerHTML = list.length ? list.map((d) => {
    const iss = deviceIssues(d);
    return `<div class="row" data-dev="${esc(d.id)}">
      <div class="dev-ic">${ic("phone")}<span class="st ${isLive(d) ? "live" : isOnline(d) ? "on" : ""}"></span></div>
      <div class="t"><b>${esc(d.studentName || d.label || "ללא שם")}</b>
        <small>${esc([d.className, [d.manufacturer, d.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "))} · ${isOnline(d) ? (d.currentAppName ? "עכשיו ב" + esc(d.currentAppName) : "מחובר") : ago(d.lastSeen)}</small></div>
      <div class="r">${iss.length ? `<span class="pill red" title="${esc(iss.join(", "))}">${esc(iss[0])}${iss.length > 1 ? " +" + (iss.length - 1) : ""}</span>` : ""}
        ${d.battery != null ? `<span class="pill">${d.charging ? "⚡" : ""}${d.battery}%</span>` : ""}
        <span class="pill blue">${TIERS[d.tier] || "אפליקציה"}</span></div></div>`;
  }).join("") : emptyHtml("phone", "אין תוצאות", "נסו חיפוש או סינון אחר");
  document.querySelectorAll("[data-dev]").forEach((r) => (r.onclick = () => openDevice(r.dataset.dev)));
}

// ----- Device drawer ------------------------------------------------------
function closeDrawer() {
  clearSubs("drawerSubs");
  $("drawer").classList.remove("open");
  $("drawerBg").classList.remove("open");
  $("drawer").setAttribute("aria-hidden", "true");
}
$("drawerBg").onclick = closeDrawer;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("drawer").classList.contains("open")) closeDrawer(); });

function openDevice(id) {
  clearSubs("drawerSubs");
  const dr = $("drawer");
  dr.innerHTML = loadingHtml;
  dr.classList.add("open"); $("drawerBg").classList.add("open"); dr.setAttribute("aria-hidden", "false");
  let built = false;
  S.drawerSubs.push(onSnapshot(doc(db, "devices", id), (snap) => {
    if (!snap.exists()) { closeDrawer(); return; }
    const d = { id, ...snap.data() };
    if (!built) { buildDrawer(d); built = true; }
    updateDrawer(d);
  }, fail));
}

function buildDrawer(d) {
  const dr = $("drawer");
  dr.innerHTML = `
    <div class="d-head"><div class="dev-ic">${ic("phone")}<span class="st" id="dSt"></span></div>
      <h2 id="dTitle"></h2><button class="icon-btn" id="dClose" aria-label="סגירה">${ic("close")}</button></div>
    <div class="d-body">
      <div id="dIssues"></div>
      <div class="kv" id="dKv"></div>

      ${can("liveView") ? `<div class="panel"><div class="panel-head"><h2>צפייה חיה</h2><span id="dLiveState" class="pill"></span></div>
        <div class="panel-body stack" style="gap:10px"><p class="muted small" style="margin:0">המכשיר ידווח כל כמה שניות במשך 10 דקות (כשהוא מחובר לאינטרנט).</p>
        <div class="row-actions"><button class="btn sm" id="dLiveOn">${ic("eye")}הפעלה ל-10 דקות</button><button class="btn sm ghost" id="dLiveOff">הפסקה</button></div></div></div>` : ""}

      ${can("remoteCommands") ? `<div class="panel"><div class="panel-head"><h2>פקודות מרחוק</h2></div><div class="panel-body stack" style="gap:12px">
        <div class="row-actions">
          <button class="btn sm ghost" data-cmd="ping">${ic("bolt")}דיווח עכשיו</button>
          <button class="btn sm ghost" data-cmd="syncPolicy">${ic("sync")}סנכרון מדיניות</button>
          <button class="btn sm ghost" data-cmd="adminUnlock">${ic("unlock")}פתיחת הגדרות ל-15 דק'</button>
          <button class="btn sm ghost" data-cmd="lockNow">${ic("lock")}נעילה מיידית</button></div>
        <form id="dUnlockApp" class="form-grid" style="align-items:end">
          <div class="field"><label>שחרור אפליקציה</label><input class="input ltr" name="pkg" list="dPkgList" placeholder="com.whatsapp" required></div>
          <div class="field"><label>לכמה זמן</label><select class="input" name="minutes"><option>15</option><option>30</option><option>60</option><option value="180">3 שעות</option></select></div>
          <datalist id="dPkgList">${Object.keys(APP_NAMES).map((p) => `<option value="${esc(p)}" label="${esc(appLabel(p))}">`).join("")}</datalist>
          <button class="btn sm full" type="submit">${ic("unlock")}שחרור</button></form>
        <form id="dMsg" style="display:flex;gap:8px"><input class="input" name="text" placeholder="הודעה שתופיע בטלפון" required><button class="btn sm">${ic("msg")}שליחה</button></form>
        <div><small class="muted">פקודות אחרונות</small><div class="log" id="dCmds" style="max-height:180px"></div></div>
      </div></div>` : ""}

      <div class="panel"><div class="panel-head"><h2>קוד שחרור בלי אינטרנט</h2></div><div class="panel-body stack" style="gap:10px">
        <p class="muted small" style="margin:0">כשהטלפון מציג "קוד אתגר" בן 6 ספרות, הקלידו אותו כאן ומסרו לתלמיד את הקוד שיתקבל.</p>
        <input class="input ltr mono" id="dChallenge" inputmode="numeric" maxlength="6" placeholder="קוד אתגר מהמכשיר">
        <div class="code-out" id="dCode" hidden></div></div></div>

      ${can("monitoring") ? `<div class="panel"><div class="panel-head"><h2>פעילות</h2>
        <div class="seg" id="dLogSeg" style="box-shadow:none;padding:3px">
          <button data-k="all" class="on">הכל</button><button data-k="dns">אתרים</button><button data-k="app">אפליקציות</button><button data-k="block">חסימות</button></div></div>
        <div class="panel-body stack" style="gap:12px"><div id="dTop"></div><div class="log" id="dLog"></div></div></div>` : ""}

      <div class="panel"><div class="panel-head"><h2>פרטי תלמיד</h2></div><form class="panel-body form-grid" id="dEdit">
        <div class="field"><label>שם התלמיד</label><input class="input" name="studentName"></div>
        <div class="field"><label>כיתה</label><input class="input" name="className"></div>
        <div class="field full"><label>הערות</label><textarea class="input" name="notes" rows="2"></textarea></div>
        <div class="full row-actions"><button class="btn sm" type="submit">שמירה</button>
          <button class="btn sm danger" type="button" id="dRemove">${ic("trash")}הסרת המכשיר מהמוסד</button></div></form></div>
    </div>`;

  $("dClose").onclick = closeDrawer;
  const f = $("dEdit");
  f.studentName.value = d.studentName || ""; f.className.value = d.className || ""; f.notes.value = d.notes || "";
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "devices", d.id), { studentName: f.studentName.value.trim(), className: f.className.value.trim(), notes: f.notes.value.trim() });
      toast("נשמר");
    } catch (err) { fail(err); }
  };
  $("dRemove").onclick = () => removeDevice(d);

  $("dChallenge").oninput = async (e) => {
    const ch = e.target.value.replace(/\D/g, "");
    e.target.value = ch;
    const out = $("dCode");
    if (ch.length !== 6) { out.hidden = true; return; }
    const keys = await getKeys();
    if (!keys) return;
    out.textContent = await computeUnlockCode(keys.masterSecret, d.label, ch);
    out.hidden = false;
  };

  if (can("liveView")) {
    $("dLiveOn").onclick = () => updateDoc(doc(db, "devices", d.id), { liveUntil: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000) }).then(() => toast("צפייה חיה הופעלה"), fail);
    $("dLiveOff").onclick = () => updateDoc(doc(db, "devices", d.id), { liveUntil: Timestamp.fromMillis(0) }).then(() => toast("צפייה חיה הופסקה"), fail);
  }

  if (can("remoteCommands")) {
    const send = (type, payload = {}) => addDoc(collection(db, "devices", d.id, "commands"), {
      type, payload, status: "pending", createdAt: serverTimestamp(), createdBy: S.email,
    }).then(() => toast("הפקודה נשלחה"), fail);
    document.querySelectorAll("[data-cmd]").forEach((b) => (b.onclick = () =>
      send(b.dataset.cmd, b.dataset.cmd === "adminUnlock" ? { minutes: 15 } : {})));
    $("dUnlockApp").onsubmit = (e) => {
      e.preventDefault();
      const fm = e.target;
      send("unlockApp", { pkg: fm.pkg.value.trim(), minutes: parseInt(fm.minutes.value, 10) });
      fm.reset();
    };
    $("dMsg").onsubmit = (e) => { e.preventDefault(); send("message", { text: e.target.text.value.trim() }); e.target.reset(); };
    S.drawerSubs.push(onSnapshot(query(collection(db, "devices", d.id, "commands"), orderBy("createdAt", "desc"), limit(8)), (snap) => {
      const names = { ping: "דיווח עכשיו", syncPolicy: "סנכרון מדיניות", adminUnlock: "פתיחת הגדרות", lockNow: "נעילה מיידית", unlockApp: "שחרור אפליקציה", message: "הודעה" };
      const st = { pending: ["ממתין", "warn"], done: ["בוצע", "green"], failed: ["נכשל", "red"] };
      $("dCmds").innerHTML = snap.docs.map((c) => {
        const x = c.data(), [label, cls] = st[x.status] || [x.status, ""];
        const extra = x.type === "unlockApp" ? ` · ${appLabel(x.payload?.pkg)}` : x.type === "message" ? ` · ${x.payload?.text}` : "";
        return `<div style="grid-template-columns:52px 1fr auto"><time>${ms(x.createdAt) ? fmtTime(ms(x.createdAt)) : "…"}</time>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(names[x.type] || x.type)}${esc(extra)}</span><span class="pill ${cls}">${label}</span></div>`;
      }).join("") || '<span class="muted small">עדיין לא נשלחו פקודות</span>';
    }, fail));
  }

  if (can("monitoring")) {
    let kind = "all", entries = [];
    const drawLog = () => {
      const list = entries.filter((x) => kind === "all" || x.k === kind).slice(0, 300);
      const icons = { dns: "🌐", app: "📱", block: "⛔", unlock: "🔓", event: "•" };
      $("dLog").innerHTML = list.length ? list.map((x) => `<div class="${x.k === "block" ? "blocked" : ""}"><time>${fmtTime(x.t)}</time><i>${icons[x.k] || "•"}</i>
        <span class="v" title="${esc(x.v)}">${esc(x.k === "app" || x.k === "block" ? appLabel(x.v) : x.v)}${x.n > 1 ? ` <span class="muted">×${x.n}</span>` : ""}</span></div>`).join("")
        : '<span class="muted small">אין פעילות מדווחת עדיין</span>';
      const counts = {};
      entries.filter((x) => x.k === "dns").forEach((x) => { counts[x.v] = (counts[x.v] || 0) + (x.n || 1); });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      $("dTop").innerHTML = kind !== "app" && kind !== "block" && top.length
        ? `<small class="muted">האתרים הנפוצים</small><div class="chips" style="margin-top:6px">${top.map(([h, n]) => `<span class="chip mono" style="padding-left:10px">${esc(h)} <b>${n}</b></span>`).join("")}</div>` : "";
    };
    $("dLogSeg").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      kind = b.dataset.k;
      $("dLogSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      drawLog();
    };
    S.drawerSubs.push(onSnapshot(query(collection(db, "devices", d.id, "logs"), orderBy("to", "desc"), limit(30)), (snap) => {
      entries = snap.docs.flatMap((b) => b.data().entries || []).sort((a, b) => b.t - a.t);
      drawLog();
    }, fail));
  }
}

function updateDrawer(d) {
  $("dTitle").textContent = d.studentName || d.label || "מכשיר";
  $("dSt").className = "st " + (isLive(d) ? "live" : isOnline(d) ? "on" : "");
  const p = d.protection || {};
  const yes = (v) => v === true ? '<span class="yes">פעיל</span>' : v === false ? '<span style="color:var(--danger);font-weight:700">כבוי</span>' : "—";
  const iss = deviceIssues(d);
  $("dIssues").innerHTML = iss.length ? `<div class="callout danger">${ic("shield")}<div><b>בעיות הגנה:</b> ${esc(iss.join(" · "))}</div></div>` : "";
  $("dKv").innerHTML = [
    ["מצב", isLive(d) ? "צפייה חיה" : isOnline(d) ? "מחובר" : "לא מחובר · " + ago(d.lastSeen)],
    ["עדכון אחרון", fmtDateTime(d.lastSeen)],
    ["אפליקציה פתוחה", d.currentAppName || (d.currentApp ? appLabel(d.currentApp) : "—")],
    ["סוללה", d.battery != null ? `${d.battery}%${d.charging ? " · בטעינה" : ""}` : "—"],
    ["רשת", { wifi: "Wi-Fi", cell: "סלולר", none: "ללא" }[d.network] || "—"],
    ["שיטת התקנה", TIERS[d.tier] || "אפליקציה"],
    ["דגם", [d.manufacturer, d.model].filter(Boolean).join(" ") || "—"],
    ["אנדרואיד / גרסה", `${d.androidVersion || "?"} / ${d.appVersion || "?"}`],
    ["סינון", d.filteringEnabled === false ? '<span style="color:var(--danger);font-weight:700">כבוי</span>' : '<span class="yes">פעיל</span>'],
    ["נגישות", yes(p.accessibility)],
    ["VPN תוכן", yes(p.vpn)],
    ["מנהל מכשיר", yes(p.deviceOwner ?? p.deviceAdmin)],
    ["תווית מכשיר", `<span class="mono">${esc(d.label || "—")}</span>`],
    ["נרשם", fmtDateTime(d.enrolledAt)],
  ].map(([k, v]) => `<div><small>${k}</small><span>${typeof v === "string" && v.startsWith("<") ? v : esc(v)}</span></div>`).join("");
  if ($("dLiveState")) {
    $("dLiveState").className = "pill " + (isLive(d) ? "red" : "");
    $("dLiveState").textContent = isLive(d) ? `פעיל עד ${fmtTime(ms(d.liveUntil))}` : "כבוי";
  }
}

async function removeDevice(d) {
  if (!confirm(`להסיר את "${d.studentName || d.label}" מהמוסד? המקום שלו במכסה יתפנה. האפליקציה בטלפון תצטרך רישום מחדש.`)) return;
  try {
    const refs = [];
    for (const sub of ["logs", "commands"]) (await getDocs(collection(db, "devices", d.id, sub))).forEach((x) => refs.push(x.ref));
    if (d.slot != null) refs.push(doc(db, "institutions", d.instId, "slots", String(d.slot)));
    refs.push(doc(db, "devices", d.id));
    for (let i = 0; i < refs.length; i += 400) {
      const b = writeBatch(db);
      refs.slice(i, i + 400).forEach((r) => b.delete(r));
      await b.commit();
    }
    closeDrawer();
    toast("המכשיר הוסר");
  } catch (e) { fail(e); }
}

// ----- Keys / policy cache -----------------------------------------------
async function getKeys() {
  if (S.keys?.instId === S.inst.id) return S.keys;
  try {
    const k = await getDoc(doc(db, "institutions", S.inst.id, "private", "keys"));
    if (!k.exists()) { toast("למוסד אין מפתח עדיין", true); return null; }
    S.keys = { instId: S.inst.id, ...k.data() };
    return S.keys;
  } catch (e) { fail(e); return null; }
}
async function getPolicy() {
  const p = await getDoc(doc(db, "institutions", S.inst.id, "public", "policy"));
  return p.exists() ? p.data() : { settings: DEFAULT_SETTINGS, telemetry: DEFAULT_TELEMETRY, version: 0 };
}

// ----- Enroll -------------------------------------------------------------
async function renderEnroll() {
  const inst = S.inst;
  main(loadingHtml);
  const [keys, policy, used] = await Promise.all([getKeys(), getPolicy(), slotCount(inst.id)]);
  if (!keys) return main(head("רישום מכשיר", "") + emptyHtml("key", "אין מפתח למוסד", "פנו למנהל המערכת"));
  const payload = JSON.stringify({
    kgSettings: 1,
    masterSecret: keys.masterSecret,
    settings: policy.settings,
    cloud: { p: FIREBASE_CONFIG.projectId, i: inst.id, t: keys.enrollToken, n: inst.name },
  });
  const left = Math.max(0, (inst.maxStudents || 0) - used);
  const tiers = inst.tiers || ["app", "owner", "rom"];
  main(head("רישום מכשיר", "סורקים את הברקוד הזה פעם אחת בכל טלפון של תלמיד",
    `<button class="btn ghost" id="btnDlQr">${ic("download")}הורדת ברקוד</button><button class="btn ghost" onclick="print()">${ic("print")}הדפסה</button>`) + `
    <div class="grid-2" style="align-items:start">
      <div class="panel"><div class="panel-body stack">
        <div class="qr-box" id="enrollQr"></div>
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span class="pill ${left ? "green" : "red"}">${left ? `נותרו ${left} מקומות מתוך ${inst.maxStudents}` : "המכסה מלאה"}</span>
          <span class="pill">מדיניות גרסה ${policy.version || 0}</span></div>
        <div class="callout warn">${ic("lock")}<div>הברקוד מכיל את מפתח השחרור של המוסד. שמרו עליו כמו על סיסמה ואל תשלחו אותו לתלמידים.</div></div>
      </div></div>
      <div class="stack">
        <div class="panel"><div class="panel-head"><h2>איך רושמים טלפון</h2></div><div class="panel-body">
          <ol class="steps" style="gap:10px">
            <li><h4>מתקינים</h4><p>לפי שיטת ההתקנה שבחרתם (${tiers.map((t) => TIERS[t]).join(" / ")}). <a href="../install.html" target="_blank">מדריכי ההתקנה</a></p></li>
            <li><h4>סורקים</h4><p>במסך הפתיחה של האפליקציה לוחצים "סריקת ברקוד מוסד" וסורקים את הברקוד.</p></li>
            <li><h4>שם התלמיד</h4><p>מקלידים שם וכיתה. הטלפון מופיע מיד ברשימת המכשירים.</p></li>
            <li><h4>הרשאות</h4><p>מאשרים את ההרשאות שהאפליקציה מבקשת, וזהו.</p></li>
          </ol></div></div>
        ${can("manageStaff") || S.isSuper ? `<div class="panel"><div class="panel-head"><h2>ברקוד שדלף?</h2></div><div class="panel-body stack" style="gap:10px">
          <p class="muted small" style="margin:0">החלפת אסימון הרישום מבטלת את הברקוד הישן לרישום מכשירים חדשים. מכשירים שכבר רשומים ממשיכים לעבוד.</p>
          <button class="btn sm ghost" id="btnRotate" ${S.isSuper ? "" : "disabled title=\"רק מנהל המערכת\""}>${ic("sync")}החלפת אסימון רישום</button></div></div>` : ""}
      </div></div>`);
  try { $("enrollQr").innerHTML = makeQr(payload).createSvgTag({ cellSize: 5, margin: 6 }); }
  catch { $("enrollQr").innerHTML = '<span class="muted">המדיניות ארוכה מדי לברקוד אחד</span>'; }
  $("btnDlQr").onclick = () => downloadQr(payload, `kosherguard-${inst.id}.png`);
  const rot = $("btnRotate");
  if (rot && S.isSuper) rot.onclick = async () => {
    if (!confirm("להחליף את אסימון הרישום? ברקודים מודפסים ישנים יפסיקו לעבוד לרישום חדש.")) return;
    try { await updateDoc(doc(db, "institutions", inst.id, "private", "keys"), { enrollToken: randomToken(16) }); S.keys = null; toast("הוחלף"); renderEnroll(); } catch (e) { fail(e); }
  };
}

// ----- Policy -------------------------------------------------------------
async function renderPolicy() {
  main(loadingHtml);
  const policy = await getPolicy();
  const s = { ...DEFAULT_SETTINGS, ...policy.settings };
  const tel = { ...DEFAULT_TELEMETRY, ...policy.telemetry };
  const ro = !can("editPolicy");
  const lists = { customAppPackages: [...s.customAppPackages], essentialAppPackages: [...s.essentialAppPackages] };
  main(head("מדיניות סינון", `חלה על כל מכשירי המוסד · גרסה ${policy.version || 0}${policy.updatedBy ? " · עודכנה על ידי " + esc(policy.updatedBy) : ""}`,
    ro ? '<span class="pill warn">צפייה בלבד</span>' : `<button class="btn" id="btnSavePolicy">שמירה ושליחה למכשירים</button>`) + `
    <form id="pol" class="stack">
      <label class="check"><input type="checkbox" name="filteringEnabled" ${s.filteringEnabled ? "checked" : ""}><span><b>הסינון פעיל</b><small>כיבוי משבית את כל החסימות בכל המכשירים</small></span></label>
      <div class="panel"><div class="panel-head"><h2>פרופיל חסימה</h2></div><div class="panel-body grid-2" style="gap:10px">
        ${CATALOG.profiles.map((p) => `<label class="check"><input type="radio" name="profileId" value="${p.id}" ${s.profileId === p.id ? "checked" : ""}><span><b>${esc(p.title)}</b><small>${esc(p.subtitle)}</small></span></label>`).join("")}
      </div>
      <div class="panel-body" id="customCats" style="padding-top:0"><div class="field"><label>קטגוריות לחסימה</label><div class="grid-3" style="gap:8px">
        ${CATALOG.categories.map((c) => `<label class="check"><input type="checkbox" name="cat" value="${c.id}" ${s.customCategoryIds.includes(c.id) ? "checked" : ""}><span><b>${esc(c.title)}</b></span></label>`).join("")}
      </div></div></div></div>
      <div class="grid-2">
        ${["customAppPackages", "essentialAppPackages"].map((key) => `<div class="panel"><div class="panel-head"><h2>${key === "customAppPackages" ? "אפליקציות חסומות נוספות" : "אפליקציות חיוניות (תמיד מותרות)"}</h2></div>
          <div class="panel-body stack" style="gap:10px"><div class="chips" id="chips_${key}"></div>
          <div style="display:flex;gap:8px"><input class="input" id="add_${key}" list="pkgList" placeholder="שם אפליקציה או חבילה"><button type="button" class="btn sm ghost" data-add="${key}">${ic("plus")}</button></div></div></div>`).join("")}
      </div>
      <datalist id="pkgList">${Object.keys(APP_NAMES).map((p) => `<option value="${esc(p)}" label="${esc(appLabel(p))}">`).join("")}</datalist>
      <div class="grid-2">
        <div class="panel"><div class="panel-head"><h2>שעות שינה</h2></div><div class="panel-body stack" style="gap:10px">
          <label class="check"><input type="checkbox" name="downtimeEnabled" ${s.downtimeEnabled ? "checked" : ""}><span><b>חסימה בשעות קבועות</b><small>רק האפליקציות החיוניות זמינות</small></span></label>
          <div class="form-grid"><div class="field"><label>מ-</label><input class="input" type="time" name="downtimeStart" value="${minutesToTime(s.downtimeStartMinutes)}"></div>
          <div class="field"><label>עד</label><input class="input" type="time" name="downtimeEnd" value="${minutesToTime(s.downtimeEndMinutes)}"></div></div></div></div>
        <div class="panel"><div class="panel-head"><h2>מגבלת זמן יומית</h2></div><div class="panel-body stack" style="gap:10px">
          <label class="check"><input type="checkbox" name="dailyDeviceLimitEnabled" ${s.dailyDeviceLimitEnabled ? "checked" : ""}><span><b>הגבלת שימוש יומי</b><small>אחרי המכסה רק אפליקציות חיוניות</small></span></label>
          <div class="field"><label>דקות ביום</label><input class="input" type="number" min="5" max="1440" name="dailyMinutes" value="${s.dailyDeviceLimitMinutes}"></div></div></div>
      </div>
      <div class="panel"><div class="panel-head"><h2>דיווח למערכת</h2></div><div class="panel-body grid-3" style="gap:10px">
        <label class="check"><input type="checkbox" name="reportDomains" ${tel.reportDomains ? "checked" : ""}><span><b>דיווח אתרים</b><small>שמות האתרים בלבד, בלי תוכן</small></span></label>
        <label class="check"><input type="checkbox" name="reportApps" ${tel.reportApps ? "checked" : ""}><span><b>דיווח אפליקציות</b><small>איזו אפליקציה נפתחה ומתי</small></span></label>
        <div class="field"><label>תדירות דיווח</label><select class="input" name="intervalMinutes">
          ${[5, 10, 15, 30].map((m) => `<option value="${m}" ${tel.intervalMinutes === m ? "selected" : ""}>כל ${m} דקות</option>`).join("")}</select></div>
      </div></div>
    </form>`);
  const f = $("pol");
  const syncCats = () => { $("customCats").hidden = f.profileId.value !== "custom"; };
  f.addEventListener("change", syncCats); syncCats();
  const drawChips = (key) => {
    $("chips_" + key).innerHTML = lists[key].map((p, i) => `<span class="chip" title="${esc(p)}">${esc(appLabel(p))}${ro ? "" : `<button type="button" data-rm="${key}:${i}">×</button>`}</span>`).join("")
      || '<span class="muted small">אין</span>';
  };
  Object.keys(lists).forEach(drawChips);
  f.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]");
    if (rm) { const [k, i] = rm.dataset.rm.split(":"); lists[k].splice(+i, 1); drawChips(k); }
    const add = e.target.closest("[data-add]");
    if (add) {
      const k = add.dataset.add, inp = $("add_" + k);
      const { good, bad } = resolveApps(inp.value, CATALOG);
      good.forEach((p) => { if (!lists[k].includes(p)) lists[k].push(p); });
      inp.value = bad.join(", ");
      if (bad.length) toast("לא זוהו: " + bad.join(", "), true);
      drawChips(k);
    }
  });
  if (ro) { f.querySelectorAll("input,select,button").forEach((x) => (x.disabled = true)); return; }
  $("btnSavePolicy").onclick = async () => {
    const settings = {
      ...policy.settings,
      filteringEnabled: f.filteringEnabled.checked,
      profileId: f.profileId.value,
      customCategoryIds: [...f.querySelectorAll('input[name="cat"]:checked')].map((x) => x.value),
      customAppPackages: lists.customAppPackages,
      essentialAppPackages: lists.essentialAppPackages,
      downtimeEnabled: f.downtimeEnabled.checked,
      downtimeStartMinutes: timeToMinutes(f.downtimeStart.value),
      downtimeEndMinutes: timeToMinutes(f.downtimeEnd.value),
      dailyDeviceLimitEnabled: f.dailyDeviceLimitEnabled.checked,
      dailyDeviceLimitMinutes: Math.max(5, parseInt(f.dailyMinutes.value, 10) || 120),
    };
    const telemetry = { reportDomains: f.reportDomains.checked, reportApps: f.reportApps.checked, intervalMinutes: parseInt(f.intervalMinutes.value, 10) };
    try {
      await setDoc(doc(db, "institutions", S.inst.id, "public", "policy"), {
        settings, telemetry, version: (policy.version || 0) + 1, updatedAt: serverTimestamp(), updatedBy: S.email,
      });
      toast("המדיניות נשמרה. מכשירים מחוברים יתעדכנו תוך שניות");
      renderPolicy();
    } catch (e) { fail(e); }
  };
}

// ----- Unlock codes -------------------------------------------------------
async function renderCodes() {
  main(loadingHtml);
  const [keys, devSnap] = await Promise.all([getKeys(), getDocs(query(collection(db, "devices"), where("instId", "==", S.inst.id)))]);
  if (!keys) return;
  const devices = devSnap.docs.map((d) => d.data()).sort((a, b) => (a.studentName || a.label || "").localeCompare(b.studentName || b.label || "", "he"));
  main(head("קודי שחרור", "עובד גם כשהטלפון לא מחובר לאינטרנט") + `
    <div class="grid-2" style="align-items:start">
      <div class="panel"><div class="panel-body stack">
        <div class="field"><label>מכשיר</label><select class="input" id="cDev">
          ${devices.map((d) => `<option value="${esc(d.label)}">${esc(d.studentName || d.label)}${d.className ? " · " + esc(d.className) : ""}</option>`).join("")}
          <option value="__manual">מכשיר שלא ברשימה (הקלדת תווית)…</option></select></div>
        <div class="field" id="cManualWrap" hidden><label>תווית המכשיר</label><input class="input ltr mono" id="cManual" placeholder="כפי שמופיעה במסך השחרור בטלפון"></div>
        <div class="field"><label>קוד אתגר מהטלפון</label><input class="input ltr mono" id="cChallenge" inputmode="numeric" maxlength="6" placeholder="6 ספרות" style="font-size:22px;letter-spacing:.2em;text-align:center"></div>
        <div class="code-out" id="cOut" hidden></div>
        <button class="btn ghost" id="cCopy" hidden>${ic("copy")}העתקת הקוד</button>
      </div></div>
      <div class="panel"><div class="panel-head"><h2>איך זה עובד</h2></div><div class="panel-body">
        <ol class="steps" style="gap:10px">
          <li><h4>התלמיד מבקש</h4><p>בטלפון לוחצים "בקשת שחרור", ומופיע קוד אתגר בן 6 ספרות.</p></li>
          <li><h4>אתם מחשבים</h4><p>בוחרים את המכשיר ומקלידים את הקוד. הקוד מחושב כאן בדפדפן ולא נשלח לשום שרת.</p></li>
          <li><h4>מוסרים את התשובה</h4><p>8 ספרות, בטלפון, בהודעה או בעל פה. הקוד טוב פעם אחת ורק למכשיר הזה.</p></li>
        </ol>
        <details class="faq" style="margin-top:14px"><summary>מפתח השחרור של המוסד (לכלי האופליין)</summary>
          <p>אפשר להזין אותו ב<a href="../admin/" target="_blank">כלי הניהול האופליין</a>. אל תשתפו אותו.</p>
          <div class="secret" id="cSecret">••••-••••-••••</div>
          <div class="row-actions" style="margin:10px 0 16px"><button class="btn sm ghost" id="cReveal">${ic("eye")}הצגה</button><button class="btn sm ghost" id="cCopySecret">${ic("copy")}העתקה</button></div>
        </details></div></div>
    </div>`);
  const calc = async () => {
    const manual = $("cDev").value === "__manual";
    $("cManualWrap").hidden = !manual;
    const label = manual ? $("cManual").value.trim() : $("cDev").value;
    const ch = $("cChallenge").value.replace(/\D/g, "");
    $("cChallenge").value = ch;
    const ok = label && ch.length === 6;
    $("cOut").hidden = $("cCopy").hidden = !ok;
    if (ok) $("cOut").textContent = await computeUnlockCode(keys.masterSecret, label, ch);
  };
  ["cDev", "cManual", "cChallenge"].forEach((id) => $(id).addEventListener("input", calc));
  $("cDev").addEventListener("change", calc);
  calc();
  $("cCopy").onclick = () => copy($("cOut").textContent);
  $("cReveal").onclick = () => { $("cSecret").textContent = keys.masterSecret; };
  $("cCopySecret").onclick = () => copy(keys.masterSecret);
}

// ----- Staff --------------------------------------------------------------
async function renderStaff() {
  main(loadingHtml);
  try {
    const snap = await getDocs(query(collection(db, "managers"), where("instId", "==", S.inst.id)));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    main(head("צוות", "מי יכול להיכנס לפורטל של המוסד",
      `<button class="btn" id="btnAddStaff">${ic("plus")}${S.isSuper ? "הוספת מנהל או איש צוות" : "הוספת איש צוות"}</button>`) + `
      ${S.isSuper && !list.some((m) => m.role === "owner") ? `<div class="callout warn">${ic("info")}<div>למוסד עדיין אין מנהל. הוסיפו את המייל של מנהל המוסד כדי שיוכל להיכנס.</div></div>` : ""}
      <div class="panel"><div class="rows">${list.length ? list.map((m) => managerRow(m)).join("") : emptyHtml("users", "אין עדיין צוות", "")}</div></div>
      <div class="callout" style="margin-top:16px">${ic("info")}<div>המשתמש נכנס עם חשבון Google של המייל הזה. אם אין לו Google, הוא בוחר "פעם ראשונה? יצירת סיסמה" במסך הכניסה, ומאמת את המייל.</div></div>`);
    $("btnAddStaff").onclick = () => editManager(null, [], S.inst.id);
    document.querySelectorAll("[data-mgr]").forEach((r) => (r.onclick = () => {
      const m = list.find((x) => x.id === r.dataset.mgr);
      if (!S.isSuper && m.role === "owner") return toast("רק מנהל המערכת יכול לערוך מנהל מוסד", true);
      editManager(m, [], S.inst.id);
    }));
  } catch (e) { fail(e); }
}

// ----- Info ---------------------------------------------------------------
async function renderInfo() {
  const i = S.inst;
  const used = await slotCount(i.id);
  main(head(i.name, esc([i.city, i.contactName, i.contactPhone].filter(Boolean).join(" · ")),
    S.isSuper ? `<button class="btn ghost" id="btnEditInst">${ic("edit")}עריכה</button>` : "") + `
    <div class="grid-3" style="margin-bottom:20px">
      <div class="card stat"><small>מכסת תלמידים</small><b>${used} / ${i.maxStudents || 0}</b><div class="bar"><i style="width:${i.maxStudents ? Math.min(100, (used / i.maxStudents) * 100) : 0}%"></i></div></div>
      <div class="card stat"><small>סטטוס</small><b style="color:${i.active ? "var(--accent)" : "var(--danger)"}">${i.active ? "פעיל" : "מושבת"}</b></div>
      <div class="card stat"><small>נוצר</small><b style="font-size:20px">${fmtDateTime(i.createdAt)}</b></div>
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><h2>הרשאות</h2></div><div class="panel-body stack" style="gap:8px">
        ${Object.entries(PERMS).map(([k, [t, d]]) => `<div style="display:flex;justify-content:space-between;gap:10px"><span><b>${t}</b><br><small class="muted">${d}</small></span>
          <span class="pill ${i.permissions?.[k] ? "green" : ""}">${i.permissions?.[k] ? "מותר" : "חסום"}</span></div>`).join("")}</div></div>
      <div class="panel"><div class="panel-head"><h2>שיטות התקנה</h2></div><div class="panel-body stack" style="gap:8px">
        ${Object.entries(TIERS).map(([k, t]) => `<div style="display:flex;justify-content:space-between"><b>${t}</b><span class="pill ${(i.tiers || []).includes(k) ? "green" : ""}">${(i.tiers || []).includes(k) ? "מותר" : "לא מותר"}</span></div>`).join("")}
        <a href="../install.html" target="_blank" class="btn sm ghost" style="justify-self:start;margin-top:8px">מדריכי ההתקנה</a></div></div>
    </div>`);
  const ed = $("btnEditInst");
  if (ed) ed.onclick = () => editInstitution(i);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
function openModal(title, bodyHtml, onSubmit) {
  const m = $("modal");
  m.innerHTML = `<form><div class="m-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="סגירה">${ic("close")}</button></div>
    <div class="m-body">${bodyHtml}</div>
    <div class="m-foot"><button class="btn" type="submit">שמירה</button><button class="btn ghost" type="button" data-close>ביטול</button></div></form>`;
  const form = m.querySelector("form");
  m.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => m.close()));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try { await onSubmit(form); m.close(); } catch (err) { fail(err); } finally { btn.disabled = false; }
  };
  m.showModal();
}

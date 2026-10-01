// Shared by every admin page (admin/index.html, admin/catalog.html): small DOM/storage helpers,
// the built-in app catalog and the names of well-known apps.

const $ = (id) => document.getElementById(id);

// Browser storage is only a convenience here (it can be blocked, e.g. in private mode).
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast("הועתק"), () => showToast("ההעתקה נכשלה"));
}

function makeQr(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr;
}

function renderQr(container, text) {
  container.innerHTML = makeQr(text).createSvgTag({ cellSize: 5, margin: 8 });
}

function downloadQr(text, filename) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  };
  img.src = makeQr(text).createDataURL(8, 16);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  children.flat().forEach((c) => node.append(c));
  return node;
}


/** Copy of admin-tool/filter_catalog.json, used until a catalog file is loaded. Keep in sync. */
const DEFAULT_CATALOG = {
  "categories": [
    {
      "id": "social",
      "title": "רשתות חברתיות",
      "packages": [
        "com.instagram.android",
        "com.facebook.katana",
        "com.facebook.lite",
        "com.zhiliaoapp.musically",
        "com.ss.android.ugc.trill",
        "com.snapchat.android",
        "com.twitter.android",
        "com.pinterest",
        "com.reddit.frontpage"
      ]
    },
    {
      "id": "video",
      "title": "וידאו וסטרימינג",
      "packages": [
        "com.google.android.youtube",
        "com.netflix.mediaclient",
        "tv.twitch.android.app",
        "com.disney.disneyplus"
      ]
    },
    {
      "id": "browser",
      "title": "דפדפנים לא מסוננים",
      "packages": [
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.sec.android.app.sbrowser",
        "com.microsoft.emmx",
        "com.opera.browser",
        "com.brave.browser"
      ]
    },
    {
      "id": "messaging",
      "title": "מסרים ותקשורת",
      "packages": [
        "com.whatsapp",
        "org.telegram.messenger",
        "com.facebook.orca",
        "com.discord"
      ]
    },
    {
      "id": "dating",
      "title": "אפליקציות היכרויות",
      "packages": [
        "com.tinder",
        "com.bumble.app",
        "com.okcupid.okcupid"
      ]
    }
  ],
  "profiles": [
    {
      "id": "basic",
      "title": "בסיסי",
      "subtitle": "חוסם רשתות חברתיות ואפליקציות היכרויות",
      "categoryIds": [
        "social",
        "dating"
      ],
      "blockAllGames": false,
      "whitelistMode": false
    },
    {
      "id": "recommended",
      "title": "מומלץ",
      "subtitle": "חוסם רשתות חברתיות, וידאו, היכרויות ודפדפנים לא מסוננים",
      "categoryIds": [
        "social",
        "video",
        "dating",
        "browser"
      ],
      "blockAllGames": false,
      "whitelistMode": false
    },
    {
      "id": "strict",
      "title": "מחמיר",
      "subtitle": "חוסם הכל מלבד אפליקציות חיוניות שתבחר",
      "categoryIds": [
        "social",
        "video",
        "dating",
        "browser",
        "messaging"
      ],
      "blockAllGames": true,
      "whitelistMode": false
    },
    {
      "id": "custom",
      "title": "מותאם אישית",
      "subtitle": "בחר בעצמך אילו אפליקציות וקטגוריות לחסום",
      "categoryIds": [],
      "blockAllGames": false,
      "whitelistMode": false
    }
  ],
  "whitelistDefaults": [
    "com.android.dialer",
    "com.android.contacts",
    "com.android.mms",
    "com.android.camera2",
    "com.android.calculator2",
    "com.android.deskclock",
    "com.android.settings",
    "com.kosherguard.filter",
    "com.google.android.inputmethod.latin"
  ]
};

const APP_NAMES = {
  "com.instagram.android": "Instagram", "com.facebook.katana": "Facebook", "com.facebook.lite": "Facebook Lite",
  "com.zhiliaoapp.musically": "TikTok", "com.ss.android.ugc.trill": "TikTok (גרסה אסייתית)", "com.snapchat.android": "Snapchat",
  "com.twitter.android": "X (Twitter)", "com.pinterest": "Pinterest", "com.reddit.frontpage": "Reddit",
  "com.google.android.youtube": "YouTube", "com.netflix.mediaclient": "Netflix", "tv.twitch.android.app": "Twitch",
  "com.disney.disneyplus": "Disney+", "com.android.chrome": "Chrome", "org.mozilla.firefox": "Firefox",
  "com.sec.android.app.sbrowser": "Samsung Internet", "com.microsoft.emmx": "Edge", "com.opera.browser": "Opera",
  "com.brave.browser": "Brave", "com.whatsapp": "WhatsApp", "com.whatsapp.w4b": "WhatsApp Business",
  "org.telegram.messenger": "Telegram", "com.facebook.orca": "Messenger", "com.discord": "Discord",
  "com.tinder": "Tinder", "com.bumble.app": "Bumble", "com.okcupid.okcupid": "OkCupid",
  "com.waze": "Waze", "com.google.android.apps.maps": "Google Maps", "com.tranzmate": "Moovit",
  "com.google.android.gm": "Gmail", "com.google.android.calendar": "Google Calendar", "com.google.android.keep": "Google Keep",
  "com.google.android.apps.photos": "Google Photos", "com.android.vending": "Google Play",
  "com.spotify.music": "Spotify", "com.google.android.apps.youtube.music": "YouTube Music", "us.zoom.videomeetings": "Zoom",
  "com.roblox.client": "Roblox", "com.mojang.minecraftpe": "Minecraft", "com.supercell.clashofclans": "Clash of Clans",
  "com.king.candycrushsaga": "Candy Crush",
  "com.android.dialer": "טלפון", "com.google.android.dialer": "טלפון (Google)", "com.samsung.android.dialer": "טלפון (Samsung)",
  "com.android.mms": "הודעות", "com.google.android.apps.messaging": "הודעות (Google)", "com.samsung.android.messaging": "הודעות (Samsung)",
  "com.android.camera2": "מצלמה", "com.google.android.GoogleCamera": "מצלמה (Pixel)", "com.sec.android.app.camera": "מצלמה (Samsung)",
  "com.android.contacts": "אנשי קשר", "com.android.calculator2": "מחשבון", "com.google.android.calculator": "מחשבון (Google)",
  "com.android.deskclock": "שעון", "com.google.android.deskclock": "שעון (Google)",
};


function appName(pkg) { return APP_NAMES[pkg] || null; }

/** Every package we know a name for, plus everything in the given catalog. */
function knownPackages(catalog) {
  const set = new Set(Object.keys(APP_NAMES));
  catalog.categories.forEach((c) => c.packages.forEach((p) => set.add(p)));
  (catalog.whitelistDefaults || []).forEach((p) => set.add(p));
  return [...set];
}

/** Fills a <datalist> with every known app (value = package, label = name) for autocomplete. */
function renderAppSuggestions(datalist, catalog) {
  const opts = knownPackages(catalog)
    .sort((a, b) => (appName(a) || a).localeCompare(appName(b) || b))
    .map((pkg) => el("option", { value: pkg, label: appName(pkg) || pkg }));
  datalist.replaceChildren(...opts);
}

const PACKAGE_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;

/** Turns what the admin typed (a package, a known app name, or several separated by commas/lines) into packages. */
function resolveApps(text, catalog) {
  const byName = {};
  for (const pkg of knownPackages(catalog)) if (appName(pkg)) byName[appName(pkg).toLowerCase()] = pkg;
  const good = [], bad = [];
  text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((token) => {
    if (byName[token.toLowerCase()]) good.push(byName[token.toLowerCase()]);
    else if (PACKAGE_RE.test(token)) good.push(token);
    else bad.push(token);
  });
  return { good, bad };
}


async function loadCatalogFile() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
    });
    const file = await handle.getFile();
    return JSON.parse(await file.text());
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) { reject(new Error("לא נבחר קובץ")); return; }
      try { resolve(JSON.parse(await file.text())); } catch (err) { reject(err); }
    });
    input.click();
  });
}


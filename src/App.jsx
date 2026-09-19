import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, ClipboardList, Truck, CalendarDays, CheckCircle2, FileText, Plus, Bell, Search,
  ChevronRight, ChevronLeft, X, LogOut, Blinds, PanelsTopLeft, Layers, Trees,
  Rows3, Upload, Trash2, Printer, Image as ImageIcon, MapPin, Phone, Hash, User, Clock, Calendar,
  History, CalendarCheck, RotateCcw, ChevronDown, Flame, Flag, AlertTriangle, ClipboardCheck
} from "lucide-react";

/* =========================================================
   CONFIG — copy these two values from your old App.jsx
   ========================================================= */
const SUPABASE_URL = "https://fyuwslsfbdwtgnmgvbmm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5dXdzbHNmYmR3dGdubWd2Ym1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mzg5NDgsImV4cCI6MjEwNDAxNDk0OH0._ilgWkOoEz3F1OE4JTHzk7mHH6z7QEgfBbzYJOg_W2M";
const TABLE = "projects_v2"; // new table so old tracker data stays untouched

const USERS = {
  "0001": { name: "Jaco", level: 1 },
  "0002": { name: "James", level: 1 },
  "0003": { name: "Trent", level: 1 },
  "0004": { name: "Theo", level: 1 },
  "0005": { name: "Co-ordinator", level: 2 },
  "2222": { name: "Developer", level: 3 },
};
const CONSULTANTS = ["Jaco", "James", "Trent", "Theo"];

// `calendar` says which calendar a department's jobs land on — Shutters and Calore share one team and one calendar
const DEPARTMENTS = [
  { id: "blinds", label: "Blinds", icon: Blinds, calendar: "blinds", from: "#3b4a63", to: "#1c2536" },
  { id: "shutters", label: "Shutters", icon: PanelsTopLeft, calendar: "shutters", from: "#5a5f6b", to: "#252a34" },
  { id: "calore", label: "Calore", icon: Flame, calendar: "shutters", from: "#5a4a3a", to: "#231a14" },
  { id: "carpets", label: "Carpets", icon: Rows3, calendar: "carpets", from: "#6b5d52", to: "#2a2420" },
  { id: "vinyl", label: "Vinyl", icon: Layers, calendar: "vinyl", from: "#7a6a4f", to: "#2c261c" },
  { id: "wood", label: "Wood", icon: Trees, calendar: "wood", from: "#8a5a34", to: "#2e1e12" },
];
const deptOf = (id) => DEPARTMENTS.find((d) => d.id === id) || DEPARTMENTS[0];
const CALENDARS = [
  { id: "blinds", label: "Blinds", icon: Blinds },
  { id: "shutters", label: "Shutters & Calore", icon: PanelsTopLeft },
  { id: "carpets", label: "Carpets", icon: Rows3 },
  { id: "vinyl", label: "Vinyl", icon: Layers },
  { id: "wood", label: "Wood", icon: Trees },
];
const calendarOf = (deptId) => deptOf(deptId).calendar;
const calOf = (calId) => CALENDARS.find((c) => c.id === calId) || CALENDARS[0];

// Team names are placeholders until phase 4; Calore uses the Shutters team
const TEAMS = { blinds: ["Team 1", "Team 2"], shutters: ["Team 1"], calore: ["Team 1"], carpets: ["Team 1"], vinyl: ["Team 1", "Team 2"], wood: ["Team 1", "Team 2"] };
const teamsOf = (dept) => TEAMS[dept] || ["Team 1"];

// Phase 5 — product catalogue: Department -> Category -> Supplier -> Range
const PRODUCT_CATALOG = {
  "Carpets": {
    "Belgotex": ["Arabica", "Conqueror", "Textured", "Aqua", "Softology Light", "Softology", "Softology Ultra", "Sensology Aural", "Serengeti", "Sensology Lush", "Westminster", "Baltimore", "Sensology Tactual", "Influence", "Inclusive", "Coexist", "CO-Create", "Merino", "Grace", "Latte", "Mood", "Longevity - Grandeur", "Longevity - Serenity", "Immerse", "Fliptile", "Mindful", "Attuned", "Perpetual", "City Life", "Rustic Grain", "Panthera", "Highlands", "Color Rib (Needlepunch)", "Garage Carpet (Needlepunch)", "Hercules (Needlepunch)", "Berber Point 650 (Needlepunch)", "Berber Point 920 (Needlepunch)", "Timbavati (Needlepunch)", "Color Rib (Resinbac)", "Hercules (Resinbac)", "Berber Point 650 (Resinbac)", "Berber Point 920 (Resinbac)", "Metro (Resinbac)", "Main Street (Resinbac)", "Diagonals (Resinbac)", "Berber Point 920 (Nexbac)", "Sportec Rubber Flooring"],
    "Nouwens": ["Berber Look", "Rustique", "Copenhagen", "Kirman", "Natural Flair", "Attitude", "Entertainer", "Icon", "Creations", "Harbour"],
    "Floornet": ["Carlton", "Manhattan Xtreme", "Prestige", "Imago", "Stockholm", "Palermo", "Etosha", "Islay", "Sorrento", "Saturnus", "Taurus", "Lewis", "Amber", "Ultimate Twist", "ART Fusion", "Passion", "Alexandria", "Nature", "Chambord", "Luxor", "Romeo", "Pinning Board", "Powerpoint", "Dirt Off", "Florpoint"],
    "Rowley & Hughes": ["Seagrass Beijing", "Coir Herringbone", "Coir Boucle", "Gold Hemp Platted", "Silver Hemp Platted", "Gold Hemp Ribbed Boucle", "Silver Hemp Ribbed Boucle", "Sisal Wild Honey", "Sisal Harvest Moon", "Sisal Grey Beard", "Sisal Artichoke", "Sisal Olive Bark", "Sisal Saffron", "Sisal Storm Cloud", "Sisal Monsoon Sky", "Sisal Oriental Topaz", "Sisal Honeyguide", "Sisal Francolin", "Sisal Buttonquail", "Sisal Nightjar", "Sisal Sand Grouse", "Sisal Partridge", "Sisal Groundscraper", "Sisal Arrowmarked", "Wool Sandpiper", "Coir PVC Backed 17mm", "Coir PVC Backed 20mm", "Seagrass Basic Natural", "Seagrass 4 X 4 Natural", "Seagrass Herringbone", "Coir Boucle Natural", "Coir Herringbone Natural", "Jute Xtra Heavy Boucle Natural", "Jute Xtra Heavy Panama Natural", "Sisal Fine Boucle Gunmetal", "Sisal Fine Boucle Oatmeal", "Sisal Fine Boucle Pewter", "Sisal Fine Boucle Sahara Sands", "Sisal Fine Boucle Zanzibar", "Sisal Panama Allegro", "Sisal Panama Cobblestone", "Sisal Panama Cocoa", "Sisal Panama Puma", "Sisal Panama Sable", "Sisal Panama Sandy Cove", "Sisal Fine Panama Gunmetal", "Sisal Fine Panama Namib Sands", "Sisal Fine Panama Silver", "Sisal Herringbone Ash Grey", "Sisal Longweave Natural", "Sisal Longweave Silver", "Sisal Togo Silver Gray", "Wool & Sisal Trellis Galena", "Wool & Sisal Kalahari Pearl Grey", "Wool & Sisal Chuncky weave Graphite", "Wool & Sisal Jacquard Clifton", "Wool & Sisal Chunky Karringmelk", "Wool & Sisal Chunky Smokey", "Multi-Use Fine Boucle Baltic", "Multi-Use Fine Boucle Storm Cloud", "Multi-Use Fine Boucle Light Grey/ Scoria", "Multi-use Flatweave Buiscuit", "Multi-Use Flatweave Anthracite,Clay Court", "Multi-Use Flatweave Pebble, Urban", "Multi-Use Flatweave Cayman", "Multi-Use Flatweave Zodiac", "Multi-Use Flatweave Amber", "Coir Brushed 17mm Black/ Burgandy/ Charcoal", "Coir Brushed 17mm Natural"],
  },
  "Glue Down Vinyl": {
    "Azura": ["Dezign Series S120", "Dezign Series S200", "Dezign Series S250", "Dezign Series XL", "Dezign Series Herringbone"],
    "FinFloor": ["Aurora Dryback Vinyl Flooring Panel", "Aurora Herringbone", "GalaxyDryback Textured Finish", "Fincrete"],
    "Belgotex": ["Hilton", "Bayport", "Select Home", "Select Plus", "Portland", "Archetypes", "Oak Tri Fecta Medium", "Oak Tri Fecta Large", "Oak Tri-Fecta XL", "Select Pro", "Penninsula", "Sylvan", "Fortitude", "Elite 55", "Retreat", "Strata", "Aggeregate"],
    "Fotakis": ["Allegro X", "Nordica"],
    "Global Streams": ["Numi 2.0", "Lake", "Bonsai 2.0", "Dessert", "Mountain", "Mineral", "Bonsai 1.0", "Fire"],
    "KBAC": ["Natures Look", "Versatilles", "Plantation", "Woodlands", "Flagstone"],
    "Lalegno": ["Lalegno Ultra LVP"],
    "Likewise": ["LG Hausys Penthouse", "LG Hausys Symmetry", "Cascade", "Dune", "Peak", "Highlands Flow", "Highlands Weave", "Primary"],
    "Mazista": ["Lifestyle", "Living", "Project", "Premium (Micro Bevel)", "Premium (Painted Bevel)", "Herringbone"],
    "MacNeil": ["Twig Base", "Twigg Core"],
    "Floornet": ["Rococo Wide Plank Light Commercial", "Rococo Wide Plank Medium Commercial", "Illusions", "Rococo Wide Plank Heavy Commercial"],
    "Wannabiwood": ["Wanabiwood Classic Micro Bevelled", "Wanabiwood Echo Tile Micro Bevelled", "Wanabiwood Carribbean LVT", "Wanabiwoood Desire Dryback"],
  },
  "Click Vinyl": {
    "Belgotex": ["Hardwood"],
    "Traviata": ["Firmfit", "Travi-Lock XL", "Travi-Lock XL Dryback", "Mfloor Contact", "Travi-Lock XL Dryback Grandeur", "Travi-Lock Industrial Black", "Travi-Lock Instustrial Colours"],
    "FinFloor": ["Diamond Core SPC", "Sapphire"],
    "Azura": ["Dezign S540", "Pergo Gloma Pro 4"],
    "Global Streams": ["Numi SPC", "Como Artica Premium"],
    "Mazista": ["SPC Ridgid Core 6mm"],
    "Likewise": ["GreenTouch Atomic", "GreenTouch Core", "GreenTouch Elements"],
    "MacNeil": ["Renew SPC 5,5", "Renew SPC 6,5", "Herringbone 8mm"],
    "Floornet": ["Milano"],
    "Wannabiwood": ["Desire"],
  },
  "Laminates": {
    "Traviata": ["Silver", "Tru-Wood XL", "Tru-Wood", "Klasik", "Cadenza BerryAlloc"],
    "FinFloor": ["Parador", "AGT Bella Neo", "AGT Natura", "Armonia Large", "Authentic Herringbone", "Black Forest+"],
    "Likewise": ["Woodline", "Quickstep Classic", "Quickstep Impressive Pattern", "Quickstep Impressive", "Quickstep Impressive Design", "Essential", "Home", "Loc Floor Plus", "Loc Floor Extra", "Hydro Safe", "Manor Herringbone", "Grande XXL"],
    "Global Streams": ["Atlantic", "Altitude"],
    "Azura": ["Mandal", "Dalen", "Odense", "Vibrance 0V", "Vibrance 4V", "Vibrance Wide", "Berry Alloc Ocean 8", "Berry Alloc Ocean 12", "FloorPlan Fix", "FloorPlan Classic", "FloorPlan Street"],
    "MacNeil": ["Advance", "Basic", "Exquisit", "Exquisit Plus", "Mega Plus"],
  },
};

// Which catalogue categories each department may pick from. Departments not listed
// keep the old free-text product field until their product lists are loaded.
const DEPT_CATEGORIES = {
  carpets: ["Carpets"],
  vinyl: ["Glue Down Vinyl", "Click Vinyl", "Laminates"],
};
const categoriesOf = (dept) => DEPT_CATEGORIES[dept] || [];
const hasCatalog = (dept) => categoriesOf(dept).length > 0;
const suppliersOf = (cat) => Object.keys(PRODUCT_CATALOG[cat] || {});
const rangesOf = (cat, sup) => ((PRODUCT_CATALOG[cat] || {})[sup] || []);
// The label written into productType so stickers, reports and search keep working unchanged
const composeProduct = (sup, rng) => [sup, rng].filter(Boolean).join(" ");

// Snags
const SNAG_CATEGORIES = ["Consultant boo-boo", "Installation boo-boo", "Factory boo-boo"];
const SNAG_CAUSES = ["Consultant boo-boo", "Installation boo-boo", "Supplier boo-boo"];
const COST_CATEGORIES = ["Labour", "Material", "Call-out", "Other"];
const openSnags = (p) => (p.snags || []).filter((s) => !s.resolved);
const hasOpenSnags = (p) => openSnags(p).length > 0;
const zar = (n) => "R " + (Number(n) || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Daily capacity in hours for the Availability view
const capacityOf = (dateIso) => (fromIso(dateIso).getDay() === 5 ? 7 : 8);
const DEFAULT_HOURS_PER_DAY = 4;

const TIMES = [];
for (let h = 7; h <= 17; h++) for (let m = 0; m < 60; m += 15) {
  if (h === 17 && m > 0) break;
  TIMES.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

/* =========================================================
   DATE HELPERS
   ========================================================= */
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayIso = () => iso(new Date());
const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
const isWeekend = (s) => { const w = fromIso(s).getDay(); return w === 0 || w === 6; };
// install spans working days only (Mon–Fri)
const installEnd = (start, days) => {
  let cur = start, left = Math.max(1, days || 1) - 1;
  while (left > 0) { cur = addDays(cur, 1); if (!isWeekend(cur)) left--; }
  return cur;
};
const spanDays = (start, end) => {
  const out = []; let cur = start;
  while (cur <= end) { out.push(cur); cur = addDays(cur, 1); if (out.length > 60) break; }
  return out;
};
const fmt = (s, opts = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) =>
  s ? fromIso(s).toLocaleDateString("en-ZA", opts) : "";
const fmtShort = (s) => fmt(s, { day: "numeric", month: "short" });
const weekStart = (s) => { const d = fromIso(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); };
const timeLt = (a, b) => !!a && !!b && a < b; // "HH:MM" strings compare correctly as text
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

/* =========================================================
   INSTALL SCHEDULE — one entry per install day, each movable
   ========================================================= */
// Build a fresh schedule of N working days from a start date
const buildSchedule = (start, days, time, endTime) => {
  const out = [{ dayIndex: 1, date: start, time, endTime: endTime || null }];
  let cur = start;
  for (let i = 2; i <= Math.max(1, days || 1); i++) {
    do { cur = addDays(cur, 1); } while (isWeekend(cur));
    out.push({ dayIndex: i, date: cur, time: null });
  }
  return out;
};
// Legacy fallback: phase-1 records only have installDate + installDays (number)
const scheduleOf = (p) => {
  if (Array.isArray(p.installSchedule) && p.installSchedule.length) return p.installSchedule;
  if (p.installDate) return buildSchedule(p.installDate, Number(p.installDays) || 1, p.installTime, p.installEndTime);
  return [];
};
// Keep the sortable top-level dates in sync with the schedule
const withSchedule = (p, schedule) => {
  const sorted = [...schedule].sort((a, b) => a.date.localeCompare(b.date));
  return { ...p, installSchedule: schedule, installDate: sorted[0]?.date || null, installEndDate: sorted[sorted.length - 1]?.date || null };
};
const hoursPerDay = (p) => Number(p.estHours) || DEFAULT_HOURS_PER_DAY;
// Two-step booking: a job can sit on the calendar as "planned" (no lines) or "reserved" (one line)
// before it is confirmed as booked (two lines). While planned/reserved it stays in its tray.
const isReserved = (p) => !!p.reserveStage && p.status !== "booked" && p.status !== "installed";
const onCalendar = (p) => p.status === "booked" || p.status === "installed" || isReserved(p);
// Received but some line items still outstanding
const partiallyReceived = (p) => p.received && (p.lineItems || []).some((li) => !li.received);

/* =========================================================
   SUPABASE (REST, no client library needed)
   ========================================================= */
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};
async function dbLoad() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data`, { headers });
  if (!r.ok) throw new Error(`Load failed (${r.status})`);
  const rows = await r.json();
  return rows.map((row) => ({ ...row.data, id: row.id }));
}
async function dbSave(project) {
  const body = [{ id: project.id, data: project, updated_at: new Date().toISOString() }];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Save failed (${r.status})`);
}

/* =========================================================
   IMAGE COMPRESSION (job cards)
   ========================================================= */
function compressImage(file, maxW = 1400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   SMALL UI PIECES
   ========================================================= */
const STATUS_META = {
  ordered: { label: "Placed", cls: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  received: { label: "Received", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  booked: { label: "Booked", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  installed: { label: "Completed", cls: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
};
const Badge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.ordered;
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
};
const RBadge = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[11px] font-bold leading-none">R</span>
);
const PartialBadge = () => (
  <span title="Received, but not in full" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-black text-[11px] font-bold leading-none">!</span>
);
const SnagFlag = ({ small }) => (
  <span title="Open snag" className={`inline-flex items-center justify-center rounded-full bg-red-600 text-white ${small ? "w-4 h-4" : "w-5 h-5"}`}><Flag size={small ? 9 : 11} strokeWidth={3} /></span>
);
const snagCardCls = (p) => (hasOpenSnags(p) ? "border-red-500/70 ring-1 ring-red-500/40" : "border-[#30363d]");
const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs text-slate-400 mb-1">{label}</span>
    {children}
  </label>
);
const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#1f6feb]";
const btnPrimary = "px-4 py-2 rounded-lg bg-[#1f6feb] hover:bg-[#388bfd] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhost = "px-4 py-2 rounded-lg border border-[#30363d] hover:bg-[#21262d] text-slate-200 text-sm";

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        className={`bg-[#161b22] border border-[#30363d] rounded-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d] sticky top-0 bg-[#161b22] z-10">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[#21262d] text-slate-400"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* =========================================================
   LOGIN
   ========================================================= */
function Login({ onLogin }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    const u = USERS[pin];
    if (!u) { setErr("That PIN isn't recognised."); return; }
    onLogin({ ...u, pin });
  };
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-2xl p-8">
        <Logo />
        <p className="text-slate-400 text-sm mt-6 mb-4">Enter your PIN to sign in.</p>
        <input
          type="password" inputMode="numeric" maxLength={4} value={pin} autoFocus
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
          placeholder="••••"
        />
        {err && <p className="text-red-400 text-sm mt-2">{err}</p>}
        <button onClick={submit} className={`${btnPrimary} w-full mt-4`}>Sign in</button>
        <button onClick={() => onLogin({ name: "Viewer", level: 0 })} className="w-full mt-2 text-sm text-slate-400 hover:text-slate-200 py-2">
          Continue as view only
        </button>
      </div>
    </div>
  );
}

function Logo({ small }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-[3px] -skew-x-12">
        <span className="block w-2.5 h-7 bg-[#4a7bd1] rounded-sm" />
        <span className="block w-2.5 h-7 bg-[#4a7bd1] rounded-sm" />
      </div>
      {!small && (
        <div className="leading-tight">
          <div className="text-white font-extrabold tracking-[0.25em] text-lg">NOLANS</div>
          <div className="text-slate-400 text-[10px] tracking-[0.2em]">INSTALLATION MANAGEMENT</div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("nolans_user")) || null; } catch { return null; }
  });
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("home"); // home | placed | received | booked | completed | history | availability | reports | dept:<id>
  const [calMonth, setCalMonth] = useState(null); // month the calendar should open on (from Availability)
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");

  const level = user?.level ?? 0;
  const isCoord = level >= 2;
  const isDev = level >= 3;

  useEffect(() => { if (user) sessionStorage.setItem("nolans_user", JSON.stringify(user)); }, [user]);

  const refresh = async () => {
    try { setProjects(await dbLoad()); setError(""); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!user) return;
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (p, msg) => {
    setProjects((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i === -1) return [...prev, p];
      const copy = [...prev]; copy[i] = p; return copy;
    });
    try { await dbSave(p); if (msg) setToast(msg); }
    catch (e) { setError(e.message); }
  };

  const active = useMemo(() => projects.filter((p) => !p.deleted), [projects]);
  const deletedList = useMemo(() => projects.filter((p) => p.deleted).sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || "")), [projects]);
  const mine = (list) => (level === 1 ? list.filter((p) => p.consultant === user.name) : list);
  const q = search.trim().toLowerCase();
  const matches = (p) => !q || [p.clientName, p.po, p.address, p.productType, p.supplier, p.productRange, p.consultant, p.contact].some((v) => (v || "").toLowerCase().includes(q));

  const lists = useMemo(() => ({
    placed: mine(active.filter((p) => p.status === "ordered")).sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9")),
    received: mine(active.filter((p) => p.status === "received")).sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9")),
    booked: active.filter((p) => p.status === "booked").sort((a, b) => (a.installDate || "").localeCompare(b.installDate || "")),
    completed: active.filter((p) => p.status === "installed" && !p.invoiced).sort((a, b) => (b.installedAt || "").localeCompare(a.installedAt || "")),
    history: active.filter((p) => p.status === "installed" && p.invoiced).sort((a, b) => (b.invoicedAt || "").localeCompare(a.invoicedAt || "")),
    snags: active.filter(hasOpenSnags).sort((a, b) => {
      const la = Math.max(...openSnags(a).map((s) => s.createdAt || "")), lb = Math.max(...openSnags(b).map((s) => s.createdAt || ""));
      return String(lb).localeCompare(String(la));
    }),
  }), [active, level, user]);
  // Unacknowledged open snags — badge for co-ordinator+
  const newSnagCount = useMemo(() => active.reduce((n, p) => n + openSnags(p).filter((s) => !s.acknowledged).length, 0), [active]);
  const reviewCount = useMemo(() => active.reduce((n, p) => n + (p.snags || []).filter((s) => s.resolved && !(s.review && s.review.cause)).length, 0), [active]);

  // Global search: consultants only see their own placed/received orders
  const searchResults = useMemo(() => {
    if (!q) return [];
    return active
      .filter(matches)
      .filter((p) => level !== 1 || p.status === "booked" || p.status === "installed" || p.consultant === user.name)
      .sort((a, b) => (a.clientName || "").localeCompare(b.clientName || ""))
      .slice(0, 12);
  }, [q, active, level, user]);

  if (!user) return <Login onLogin={setUser} />;

  const nav = [
    { id: "home", label: "Home", icon: Home },
    { id: "placed", label: "Placed orders", icon: ClipboardList, count: lists.placed.length },
    { id: "received", label: "Received orders", icon: Truck, count: lists.received.length },
    { id: "booked", label: "Booked orders", icon: CalendarDays, count: lists.booked.length },
    ...(level >= 1 ? [{ id: "snags", label: "Snags", icon: Flag, count: lists.snags.length, alert: isCoord ? newSnagCount : 0 }] : []),
    { id: "completed", label: "Completed orders", icon: CheckCircle2, count: lists.completed.length },
    { id: "history", label: "History", icon: History, count: lists.history.length },
    ...(level >= 1 ? [{ id: "review", label: "Snag review", icon: ClipboardCheck, count: isCoord ? reviewCount : null }] : []),
    ...(isCoord ? [
      { id: "availability", label: "Availability", icon: CalendarCheck },
      { id: "reports", label: "Reports", icon: FileText },
    ] : []),
  ];

  const logout = () => { sessionStorage.removeItem("nolans_user"); setUser(null); setView("home"); };
  const openDept = (id, month) => { setCalMonth(month || null); setView(`dept:${calendarOf(id)}`); };
  const openProject = (p) => { setSelected(p); setSearch(""); };

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col print:bg-white print:text-black">
      {/* Top bar */}
      <header className="print:hidden h-16 flex items-center gap-4 px-5 border-b border-[#30363d] bg-[#0d1117]">
        <button onClick={() => setView("home")} className="shrink-0"><Logo /></button>
        <div className="flex-1 max-w-2xl mx-auto relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); if (e.key === "Enter" && searchResults.length === 1) openProject(searchResults[0]); }}
            placeholder="Search orders, clients or PO numbers"
            className={`${inputCls} pl-9 rounded-full bg-[#161b22]`}
          />
          {q && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"><X size={14} /></button>}
          {q && <SearchDropdown results={searchResults} onOpen={openProject} onClose={() => setSearch("")} />}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isCoord && (
            <button onClick={() => setShowCreate(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
              <Plus size={16} /> New project
            </button>
          )}
          <button className="relative p-2 rounded-lg hover:bg-[#161b22] text-slate-300" title="Notifications (coming in phase 3)">
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2 pl-2">
            <div className="w-9 h-9 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center text-sm font-semibold">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm hidden sm:block">{user.name}</span>
            <button onClick={logout} className="p-1.5 rounded-md hover:bg-[#161b22] text-slate-400" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="print:hidden w-60 shrink-0 border-r border-[#30363d] p-4 flex flex-col">
          <nav className="space-y-1">
            {nav.map((n) => {
              const activeNav = view === n.id;
              return (
                <button
                  key={n.id} onClick={() => setView(n.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${activeNav ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#161b22]"}`}
                >
                  <n.icon size={18} />
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.alert > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">{n.alert} new</span>}
                  {n.count != null && <span className="text-xs text-slate-400">{n.count}</span>}
                </button>
              );
            })}
          </nav>
          <div className="mt-6 pt-4 border-t border-[#30363d]">
            <div className="text-[11px] text-slate-500 px-3 mb-1">Departments</div>
            {DEPARTMENTS.map((d) => (
              <button
                key={d.id} onClick={() => openDept(d.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${view === `dept:${d.calendar}` ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#161b22]"}`}
              >
                <d.icon size={16} /> {d.label}
              </button>
            ))}
          </div>
          <div className="mt-auto pt-4 text-[10px] text-slate-500 tracking-wider">
            FLOORING | BLINDS | SHUTTERS | FIREPLACES
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-6 overflow-auto print:p-0">
          {error && (
            <div className="print:hidden mb-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm px-4 py-3 flex items-center justify-between">
              <span>{error}. Check the Supabase URL/key at the top of App.jsx and that the {TABLE} table exists.</span>
              <button onClick={refresh} className="underline">Retry</button>
            </div>
          )}
          {loading ? (
            <div className="text-slate-400 text-sm">Loading…</div>
          ) : view === "home" ? (
            <HomeView user={user} lists={lists} setView={setView} openDept={openDept} />
          ) : view === "reports" ? (
            <ReportsView projects={active} />
          ) : view === "availability" ? (
            <AvailabilityView projects={active} openDept={openDept} />
          ) : view === "snags" ? (
            <SnagsView items={lists.snags} onOpen={setSelected} />
          ) : view === "review" ? (
            <SnagReviewView projects={active} user={user} isCoord={isCoord} save={save} onOpen={setSelected} />
          ) : view === "completed" ? (
            <CompletedView items={lists.completed} isCoord={isCoord} isDev={isDev} user={user} save={save} onOpen={setSelected} setToast={setToast} />
          ) : view === "history" ? (
            <HistoryView items={lists.history} deleted={deletedList} isCoord={isCoord} isDev={isDev} user={user} save={save} onOpen={setSelected} />
          ) : view.startsWith("dept:") ? (
            <CalendarView
              key={view} cal={calOf(view.slice(5))} projects={active.filter((p) => calendarOf(p.department) === view.slice(5))}
              isCoord={isCoord} user={user} save={save} onOpen={setSelected} initialMonth={calMonth}
            />
          ) : (
            <ListView
              title={nav.find((n) => n.id === view)?.label} status={view}
              items={lists[view]} onOpen={setSelected} level={level}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {(showCreate || editing) && (
        <ProjectForm
          initial={editing} user={user} isCoord={isCoord}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSave={async (p) => { await save(p, editing ? "Project updated" : "Project created"); setShowCreate(false); setEditing(null); if (editing) setSelected(p); }}
        />
      )}
      {selected && (
        <ProjectDetail
          project={projects.find((p) => p.id === selected.id) || selected}
          user={user} level={level} isCoord={isCoord} isDev={isDev} save={save}
          onClose={() => setSelected(null)} onEdit={() => { setEditing(projects.find((p) => p.id === selected.id)); setSelected(null); }}
        />
      )}
      {toast && (
        <div className="print:hidden fixed bottom-5 right-5 bg-[#161b22] border border-[#30363d] text-sm px-4 py-2.5 rounded-xl shadow-xl">{toast}</div>
      )}
    </div>
  );
}

/* =========================================================
   GLOBAL SEARCH DROPDOWN
   ========================================================= */
function SearchDropdown({ results, onOpen, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest("input")) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute left-0 right-0 top-full mt-2 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden z-40">
      {results.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-500">No matching orders.</div>
      ) : results.map((p) => {
        const d = deptOf(p.department);
        return (
          <button key={p.id} onClick={() => onOpen(p)} className="w-full text-left px-4 py-2.5 hover:bg-[#21262d] border-b border-[#30363d] last:border-0 flex items-center gap-3">
            <d.icon size={16} className="text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{p.clientName} <span className="text-slate-500 font-normal">· PO {p.po}</span></div>
              <div className="text-xs text-slate-400 truncate">{d.label} · {p.consultant}{p.team ? ` · ${p.team}` : ""}{p.installDate ? ` · ${fmtShort(p.installDate)} ${p.installTime || ""}` : p.materialEta ? ` · ETA ${fmtShort(p.materialEta)}` : ""}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasOpenSnags(p) && <SnagFlag />}
              {isReserved(p) && <span className={`text-[10px] ${p.received ? "text-slate-300" : "text-red-300"}`}>{p.reserveStage === "reserved" ? "Reserved" : "Planned"}</span>}
              {partiallyReceived(p) && p.status === "received" && <PartialBadge />}
              <Badge status={p.status} />
              {p.invoiced && <span className="text-[10px] text-slate-500">Invoiced</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================
   HOME DASHBOARD
   ========================================================= */
function HomeView({ user, lists, setView, openDept }) {
  const myCount = lists.placed.length + lists.received.length;
  const cards = [
    { id: "signed", label: "Signed in consultant", sub: user.name, count: myCount, icon: User, color: "bg-blue-600" },
    { id: "placed", label: "Placed orders", count: lists.placed.length, icon: ClipboardList, color: "bg-green-600" },
    { id: "received", label: "Received orders", count: lists.received.length, icon: Truck, color: "bg-amber-500" },
    { id: "booked", label: "Booked orders", count: lists.booked.length, icon: CalendarDays, color: "bg-violet-600" },
    { id: "completed", label: "Completed orders", count: lists.completed.length, icon: CheckCircle2, color: "bg-teal-600" },
  ];
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-7">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-slate-400 text-sm tracking-[0.2em]">WELCOME BACK</div>
          <h1 className="text-3xl font-bold text-white mt-1">{user.name}</h1>
          <p className="text-slate-400 mt-2 text-sm max-w-md">Manage your orders, track progress and keep everything on schedule.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300"><Calendar size={16} /> {fmt(todayIso())}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_1.6fr] gap-5">
        <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-3 space-y-2">
          {cards.map((c) => (
            <button
              key={c.id} onClick={() => c.id !== "signed" && setView(c.id)}
              className="w-full flex items-center gap-4 bg-[#161b22] hover:bg-[#1c222b] border border-[#30363d] rounded-xl p-4 text-left"
            >
              <div className={`w-11 h-11 rounded-full ${c.color} flex items-center justify-center text-white shrink-0`}><c.icon size={20} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{c.label}</div>
                {c.sub && <div className="text-xs text-slate-400">{c.sub}</div>}
              </div>
              <span className="w-10 h-10 rounded-full bg-[#21262d] flex items-center justify-center text-sm font-semibold">{c.count}</span>
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          ))}
        </div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-3 space-y-3">
          {DEPARTMENTS.map((d) => (
            <button
              key={d.id} onClick={() => openDept(d.id)}
              className="w-full h-24 rounded-xl border border-[#30363d] flex items-center px-6 gap-5 text-left relative overflow-hidden group"
              style={{ background: `linear-gradient(90deg, ${d.to} 0%, ${d.to} 35%, ${d.from} 100%)` }}
            >
              <div
                className="absolute inset-y-0 right-0 w-1/2 opacity-40"
                style={{ backgroundImage: `repeating-linear-gradient(${d.id === "shutters" || d.id === "blinds" ? "180deg" : "45deg"}, rgba(255,255,255,0.08) 0 6px, transparent 6px 18px)` }}
              />
              <d.icon size={40} className="text-white relative" strokeWidth={1.5} />
              <span className="text-2xl font-semibold text-white relative">{d.label}</span>
              <ChevronRight size={24} className="ml-auto text-white/80 relative" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LIST VIEWS (placed / received / booked / completed)
   ========================================================= */
function ListView({ title, status, items, onOpen, level }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <span className="text-sm text-slate-400">{items.length} {items.length === 1 ? "order" : "orders"}{level === 1 && (status === "placed" || status === "received") ? " of yours" : ""}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-slate-400 text-sm py-10 text-center border border-dashed border-[#30363d] rounded-xl">Nothing here yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const d = deptOf(p.department);
            return (
              <button key={p.id} onClick={() => onOpen(p)} className={`w-full text-left bg-[#0d1117] hover:bg-[#12181f] border ${snagCardCls(p)} rounded-xl p-4 grid grid-cols-12 gap-3 items-center`}>
                <div className="col-span-12 md:col-span-4 min-w-0">
                  <div className="font-medium text-white truncate">{p.clientName}</div>
                  <div className="text-xs text-slate-400 truncate">{p.address}</div>
                </div>
                <div className="col-span-6 md:col-span-2 text-sm text-slate-300 flex items-center gap-1.5"><d.icon size={14} className="text-slate-500" />{d.label}</div>
                <div className="col-span-6 md:col-span-2 text-sm text-slate-300 truncate">{p.productType}</div>
                <div className="col-span-6 md:col-span-2 text-xs text-slate-400">
                  {status === "placed" || status === "received" ? <>ETA {fmtShort(p.materialEta)}</> :
                   status === "booked" ? <>{fmtShort(p.installDate)}{p.installEndDate !== p.installDate ? ` – ${fmtShort(p.installEndDate)}` : ""} · {p.installTime}</> :
                   <>Done {fmtShort((p.installedAt || "").slice(0, 10))}</>}
                </div>
                <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-2 text-xs text-slate-400">
                  <span className="truncate">PO {p.po} · {p.consultant}{p.team ? ` · ${p.team}` : ""}</span>
                  {hasOpenSnags(p) && <SnagFlag />}
                  {isReserved(p) && <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${p.received ? "border-slate-400/60 text-slate-200" : "border-red-500 text-red-300"}`}>{p.reserveStage === "reserved" ? "Reserved" : "Planned"} {fmtShort(p.installDate)}</span>}
                  {partiallyReceived(p) && p.status === "received" && <PartialBadge />}
                  <Badge status={p.status} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   CREATE / EDIT PROJECT
   ========================================================= */
// Older projects were saved before the product catalogue existed. When one is opened for
// editing we fill in what we can: single-category departments pick themselves, and a typed
// product label is matched back to a supplier and range where the wording lines up.
function catalogBackfill(p) {
  if (!hasCatalog(p.department)) return {};
  if (p.productRange && p.supplier) return {};
  const cats = categoriesOf(p.department);
  const label = (p.productType || "").trim().toLowerCase();
  if (label) {
    for (const cat of cats) {
      for (const sup of suppliersOf(cat)) {
        for (const rng of rangesOf(cat, sup)) {
          if (composeProduct(sup, rng).toLowerCase() === label || rng.toLowerCase() === label) {
            return { productCategory: cat, supplier: sup, productRange: rng, productType: composeProduct(sup, rng) };
          }
        }
      }
    }
  }
  return { productCategory: cats.length === 1 ? cats[0] : (p.productCategory || ""), supplier: p.supplier || "", productRange: "" };
}

function ProjectForm({ initial, user, isCoord, onClose, onSave }) {
  const [f, setF] = useState(() => initial ? { ...initial, lineItems: initial.lineItems || [], team: initial.team || teamsOf(initial.department)[0], ...catalogBackfill(initial) } : {
    clientName: "", contact: "", address: "", po: "", consultant: CONSULTANTS[0], department: "blinds", team: "Team 1",
    productType: "", productCategory: "", supplier: "", productRange: "",
    lineItems: [], materialEta: todayIso(), installDays: 1, estHours: "", jobCards: [],
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const fileRef = useRef();

  const setDept = (dept) => setF((s) => {
    const cats = categoriesOf(dept);
    const keep = cats.includes(s.productCategory);
    return {
      ...s,
      department: dept,
      team: teamsOf(dept).includes(s.team) ? s.team : teamsOf(dept)[0],
      productCategory: keep ? s.productCategory : (cats.length === 1 ? cats[0] : ""),
      supplier: keep ? s.supplier : "",
      productRange: keep ? s.productRange : "",
      productType: keep ? s.productType : (hasCatalog(dept) ? "" : s.productType),
    };
  });

  // Catalogue pickers — each level clears the ones below it and rewrites the product label
  const setCategory = (cat) => setF((s) => ({ ...s, productCategory: cat, supplier: "", productRange: "", productType: "" }));
  const setSupplier = (sup) => setF((s) => ({ ...s, supplier: sup, productRange: "", productType: "" }));
  const setRange = (rng) => setF((s) => ({ ...s, productRange: rng, productType: composeProduct(s.supplier, rng) }));

  const addLine = () => set("lineItems", [...f.lineItems, { id: uid(), description: "", received: false }]);
  const updLine = (id, patch) => set("lineItems", f.lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  const delLine = (id) => set("lineItems", f.lineItems.filter((li) => li.id !== id));

  const addFiles = async (files) => {
    setBusy(true);
    const cards = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      cards.push({ id: uid(), image: await compressImage(file), createdAt: new Date().toISOString(), author: user.name });
    }
    set("jobCards", [...(f.jobCards || []), ...cards]);
    setBusy(false);
  };

  const valid = f.clientName.trim() && f.po.trim() && f.materialEta;
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const now = new Date().toISOString();
    const lineItems = f.lineItems.filter((li) => li.description.trim());
    const base = { ...f, lineItems, installDays: Number(f.installDays) || 1, estHours: f.estHours === "" ? null : Number(f.estHours) };
    const p = initial
      ? base
      : { ...base, id: uid(), createdAt: now, createdBy: user.name, status: "ordered", received: false, installed: false,
          log: [{ id: uid(), text: "Project created", author: user.name, createdAt: now }] };
    await onSave(p);
    setBusy(false);
  };

  return (
    <Modal title={initial ? "Edit project" : "New project"} onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Client name"><input className={inputCls} value={f.clientName} onChange={(e) => set("clientName", e.target.value)} autoFocus /></Field>
        <Field label="Contact number"><input className={inputCls} value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
        <div className="md:col-span-2"><Field label="Address"><input className={inputCls} value={f.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
        <Field label="Purchase order number"><input className={inputCls} value={f.po} onChange={(e) => set("po", e.target.value)} /></Field>
        <Field label="Consultant">
          <select className={inputCls} value={f.consultant} onChange={(e) => set("consultant", e.target.value)}>
            {CONSULTANTS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Department">
          <select className={inputCls} value={f.department} onChange={(e) => setDept(e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Install team">
          <select className={inputCls} value={f.team} onChange={(e) => set("team", e.target.value)} disabled={!isCoord}>
            {teamsOf(f.department).map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Material ETA"><input type="date" className={inputCls} value={f.materialEta} onChange={(e) => set("materialEta", e.target.value)} /></Field>
        <Field label="Estimated install duration (working days)"><input type="number" min="1" max="30" className={inputCls} value={f.installDays} onChange={(e) => set("installDays", e.target.value)} /></Field>
        <div className="md:col-span-2">
          <Field label="Estimated hours on site per day (used by Availability; blank = 4h)"><input type="number" min="1" max="10" step="0.5" className={inputCls} value={f.estHours ?? ""} onChange={(e) => set("estHours", e.target.value)} placeholder="4" /></Field>
        </div>

        {/* Line items */}
        <div className="md:col-span-2 border border-[#30363d] rounded-xl p-4">
          {hasCatalog(f.department) ? (
            <div className="space-y-3">
              {categoriesOf(f.department).length > 1 && (
                <Field label="Product category">
                  <select className={inputCls} value={f.productCategory || ""} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Select a category…</option>
                    {categoriesOf(f.department).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Supplier">
                <select className={inputCls} value={f.supplier || ""} onChange={(e) => setSupplier(e.target.value)} disabled={!f.productCategory}>
                  <option value="">{f.productCategory ? "Select a supplier…" : "Pick a product category first"}</option>
                  {suppliersOf(f.productCategory).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Range (main line item)">
                <select className={inputCls} value={f.productRange || ""} onChange={(e) => setRange(e.target.value)} disabled={!f.supplier}>
                  <option value="">{f.supplier ? "Select a range…" : "Pick a supplier first"}</option>
                  {rangesOf(f.productCategory, f.supplier).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              {f.productType && !f.productRange && (
                <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  Existing entry: <span className="text-amber-100">{f.productType}</span> — this was typed in by hand. Pick a category, supplier and range above to replace it, or leave it as it is.
                </div>
              )}
            </div>
          ) : (
            <Field label="Main line item (product)"><input className={inputCls} value={f.productType} onChange={(e) => set("productType", e.target.value)} placeholder="e.g. Engineered oak flooring 45m²" /></Field>
          )}
          <div className="text-xs text-slate-400 mt-4 mb-2">Additional line items — trims, adhesive, moisture barrier, etc.</div>
          <div className="space-y-2">
            {f.lineItems.map((li) => (
              <div key={li.id} className="flex items-center gap-2">
                <input className={inputCls} value={li.description} onChange={(e) => updLine(li.id, { description: e.target.value })} placeholder="Item description" />
                {isCoord && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 shrink-0 select-none">
                    <input type="checkbox" checked={!!li.received} onChange={(e) => updLine(li.id, { received: e.target.checked, receivedAt: e.target.checked ? new Date().toISOString() : null, receivedBy: e.target.checked ? user.name : null })} />
                    Received
                  </label>
                )}
                <button onClick={() => delLine(li.id)} className="p-1.5 rounded-md hover:bg-[#21262d] text-slate-400 shrink-0"><X size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={addLine} className={`${btnGhost} mt-2 flex items-center gap-1.5 text-xs py-1.5`}><Plus size={14} /> Add item</button>
        </div>

        <div className="md:col-span-2">
          <Field label="Job cards (JPEG)">
            <div
              className="border border-dashed border-[#30363d] rounded-xl p-4 text-center text-sm text-slate-400 hover:border-[#1f6feb] cursor-pointer"
              onClick={() => fileRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }}
            >
              <Upload size={18} className="mx-auto mb-1" />
              Click or drop images here — you can add more than one
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/*" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
            </div>
          </Field>
          {(f.jobCards || []).length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {f.jobCards.map((c) => (
                <div key={c.id} className="relative group">
                  <img src={c.image} alt="Job card" className="w-full h-24 object-cover rounded-lg border border-[#30363d]" />
                  <button onClick={() => set("jobCards", f.jobCards.filter((x) => x.id !== c.id))} className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-white opacity-0 group-hover:opacity-100"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={submit} disabled={!valid || busy} className={btnPrimary}>{busy ? "Saving…" : initial ? "Save changes" : "Create project"}</button>
      </div>
    </Modal>
  );
}

/* =========================================================
   PROJECT DETAIL
   ========================================================= */
function ProjectDetail({ project: p, user, level, isCoord, isDev, save, onClose, onEdit }) {
  const d = deptOf(p.department);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [snagModal, setSnagModal] = useState(false);
  const [resolving, setResolving] = useState(null); // snag being resolved
  const [addingDay, setAddingDay] = useState(false);
  const now = () => new Date().toISOString();
  const log = (text, base = p) => [...(base.log || []), { id: uid(), text, author: user.name, createdAt: now() }];
  const schedule = scheduleOf(p);
  const lineItems = p.lineItems || [];
  const snags = p.snags || [];
  const open = openSnags(p);
  const canSnag = level >= 1;

  // Co-ordinator opening the job acknowledges its new snags (clears the "new" badge)
  useEffect(() => {
    if (isCoord && open.some((s) => !s.acknowledged)) {
      save({ ...p, snags: snags.map((s) => (s.resolved ? s : { ...s, acknowledged: true })) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const markReceived = () => save({ ...p, status: "received", received: true, receivedAt: now(), log: log("Main item received") }, "Marked as received");
  const undoReceived = () => save({ ...p, status: "ordered", received: false, receivedAt: null, log: log("Received undone") }, "Moved back to placed");
  const markInstalled = () => save({ ...p, status: "installed", installed: true, installedAt: now(), log: log("Installation completed") }, "Marked as completed");
  const undoInstalled = () => save({ ...p, status: "booked", installed: false, installedAt: null, log: log("Completion undone") }, "Moved back to booked");
  const unbook = () => save({ ...p, status: "received", reserveStage: null, installDate: null, installEndDate: null, installTime: null, installEndTime: null, installSchedule: [], log: log("Booking removed") }, "Booking removed");
  // Two-step booking controls
  const reserve = () => save({ ...p, reserveStage: "reserved", log: log(`Reserved for ${fmt(p.installDate)}${p.received ? "" : " (material not yet received)"}`) }, "Reserved");
  const unreserve = () => save({ ...p, reserveStage: "planned", log: log("Reservation removed — still planned") }, "Back to planned");
  const unplan = () => save({ ...p, reserveStage: null, installDate: null, installEndDate: null, installTime: null, installEndTime: null, installSchedule: [], log: log("Removed from calendar") }, "Removed from calendar");
  const confirmBooking = () => save({ ...p, status: "booked", reserveStage: null, log: log(`Booking confirmed for ${fmt(p.installDate)}`) }, "Booking confirmed");
  const del = () => save({ ...p, deleted: true, deletedAt: now(), deletedBy: user.name, deleteReason: reason, log: log(`Deleted: ${reason}`) }, "Project deleted");
  const toggleLine = (li) => {
    const received = !li.received;
    const items = lineItems.map((x) => (x.id === li.id ? { ...x, received, receivedAt: received ? now() : null, receivedBy: received ? user.name : null } : x));
    save({ ...p, lineItems: items, log: log(`${li.description}: ${received ? "received" : "marked not received"}`) });
  };

  // Add one extra install day on a chosen date (from the sticker, no full edit needed)
  const addDay = (date) => {
    const next = [...schedule, { dayIndex: schedule.length + 1, date, time: null }];
    save(withSchedule({ ...p, installDays: next.length, log: log(`Day ${next.length} added on ${fmt(date)}`) }, next), "Day added");
    setAddingDay(false);
  };
  const removeDay = (dayIndex) => {
    if (schedule.length <= 1) return;
    const next = schedule.filter((s) => s.dayIndex !== dayIndex).map((s, i) => ({ ...s, dayIndex: i + 1 }));
    save(withSchedule({ ...p, installDays: next.length, log: log(`Day ${dayIndex} removed`) }, next), "Day removed");
  };

  // Snags
  const logSnag = (snag) => {
    const wasDone = p.status === "installed";
    const next = { ...p, snags: [...snags, snag], log: log(`Snag logged (${snag.category}): ${snag.description}`) };
    if (wasDone) next.snagReturn = true; // re-launch a return-visit sticker above the calendar
    save(next, wasDone ? "Snag logged — return visit ready to book" : "Snag logged");
    setSnagModal(false);
  };
  const resolveSnag = (snag, note) => {
    const next = snags.map((s) => (s.id === snag.id ? { ...s, resolved: true, resolvedAt: now(), resolvedBy: user.name, resolveReason: note } : s));
    const stillOpen = next.some((s) => !s.resolved);
    save({ ...p, snags: next, snagReturn: stillOpen ? p.snagReturn : false, log: log(`Snag resolved (${snag.category}) by ${user.name}: ${note}`) }, "Snag resolved");
    setResolving(null);
  };

  const Row = ({ icon: I, label, value }) => (
    <div className="flex items-start gap-3 py-2">
      <I size={16} className="text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className="text-sm text-slate-100 break-words">{value || "—"}</div></div>
    </div>
  );
  const returnVisits = p.returnVisits || [];

  return (
    <Modal title={p.clientName} onClose={onClose} wide>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge status={p.status} />
        {p.invoiced && <span className="text-xs px-2 py-0.5 rounded-full border border-slate-500/30 text-slate-400">Invoiced</span>}
        <span className="text-xs text-slate-400 flex items-center gap-1"><d.icon size={14} /> {d.label}</span>
        <span className="text-xs text-slate-400">· {p.consultant}</span>
        {p.team && <span className="text-xs text-slate-400">· {p.team}</span>}
        {p.received && p.status === "received" && <RBadge />}
        {partiallyReceived(p) && <span className="flex items-center gap-1 text-xs text-yellow-300"><PartialBadge /> not received in full</span>}
        {isReserved(p) && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${p.received ? "border-slate-400/60 text-slate-200" : "border-red-500 text-red-300"}`}>
            {p.reserveStage === "reserved" ? "Reserved" : "Planned"} · {fmt(p.installDate)}{p.received ? "" : " · no stock yet"}
          </span>
        )}
        {open.length > 0 && <span className="flex items-center gap-1 text-xs text-red-300"><SnagFlag /> {open.length} open snag{open.length > 1 ? "s" : ""}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <Row icon={Phone} label="Contact" value={p.contact} />
        <Row icon={Hash} label="Purchase order" value={p.po} />
        <div className="md:col-span-2"><Row icon={MapPin} label="Address" value={p.address} /></div>
        <Row icon={Truck} label="Material ETA" value={fmt(p.materialEta)} />
        <Row icon={Clock} label="Install estimate" value={`${p.installDays || 1} working day${(p.installDays || 1) > 1 ? "s" : ""} · ${hoursPerDay(p)}h per day`} />
        {schedule.length > 0 && (
          <div className="md:col-span-2">
            <Row icon={CalendarDays} label="Installation days" value={
              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                {[...schedule].sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
                  <span key={s.dayIndex} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 flex items-center gap-1.5">
                    {s.dayIndex}/{schedule.length} · {fmt(s.date)}{s.time ? ` ${s.time}` : ""}{s.endTime ? `–${s.endTime}` : ""}
                    {isCoord && (p.status === "booked" || isReserved(p)) && schedule.length > 1 && (
                      <button onClick={() => removeDay(s.dayIndex)} title="Remove this day" className="text-emerald-300/70 hover:text-red-300"><X size={11} /></button>
                    )}
                  </span>
                ))}
                {isCoord && (p.status === "booked" || isReserved(p)) && (
                  <button onClick={() => setAddingDay(true)} className="text-xs px-2 py-1 rounded-lg border border-dashed border-[#30363d] text-slate-300 hover:border-[#1f6feb] flex items-center gap-1"><Plus size={12} /> Add day</button>
                )}
              </div>
            } />
          </div>
        )}
        {returnVisits.length > 0 && (
          <div className="md:col-span-2">
            <Row icon={Flag} label="Snag return visits" value={
              <div className="flex flex-wrap gap-1.5 mt-1">
                {returnVisits.map((v) => (
                  <span key={v.id} className="text-xs px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-100">{fmt(v.date)}{v.time ? ` ${v.time}` : ""}{v.endTime ? `–${v.endTime}` : ""}</span>
                ))}
              </div>
            } />
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="mt-4 border border-[#30363d] rounded-xl p-3">
        <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Layers size={14} /> Line items</div>
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-slate-100">{p.productType} <span className="text-slate-500 text-xs">(main)</span></span>
          {p.received ? <span className="text-xs text-emerald-300">Received</span> : <span className="text-xs text-slate-500">Not received</span>}
        </div>
        {lineItems.map((li) => (
          <div key={li.id} className="flex items-center justify-between py-1.5 text-sm border-t border-[#30363d]">
            <span className="text-slate-200">{li.description}</span>
            {isCoord ? (
              <button onClick={() => toggleLine(li)} className={`text-xs px-2 py-1 rounded-lg border ${li.received ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" : "border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"}`}>
                {li.received ? "Received" : "Mark received"}
              </button>
            ) : (
              <span className={`text-xs ${li.received ? "text-emerald-300" : "text-yellow-300"}`}>{li.received ? "Received" : "Not received"}</span>
            )}
          </div>
        ))}
        {lineItems.length === 0 && <div className="text-xs text-slate-500 pt-1">No additional items.</div>}
      </div>

      {/* Snags */}
      <div className={`mt-4 border rounded-xl p-3 ${open.length ? "border-red-500/50" : "border-[#30363d]"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-500 flex items-center gap-1"><Flag size={14} /> Snags ({snags.length})</div>
          {canSnag && <button onClick={() => setSnagModal(true)} className="text-xs px-2 py-1 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 flex items-center gap-1"><Plus size={12} /> Log snag</button>}
        </div>
        {snags.length === 0 && <div className="text-xs text-slate-500">No snags logged.</div>}
        {[...snags].sort((a, b) => (a.resolved === b.resolved ? (b.createdAt || "").localeCompare(a.createdAt || "") : a.resolved ? 1 : -1)).map((s) => (
          <div key={s.id} className={`py-2 border-t border-[#30363d] first:border-0 ${s.resolved ? "opacity-70" : ""}`}>
            <div className="flex items-start gap-3">
              {s.photo && <img src={s.photo} alt="Snag" onClick={() => setLightbox(s.photo)} className="w-14 h-14 object-cover rounded-lg border border-[#30363d] cursor-zoom-in shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${s.resolved ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}`}>{s.resolved ? "Resolved" : "Open"}</span>
                  <span className="text-xs font-medium text-slate-200">{s.category}</span>
                  <span className="text-[11px] text-slate-500">· {s.author}, {fmtShort((s.createdAt || "").slice(0, 10))}</span>
                </div>
                <div className="text-sm text-slate-300 mt-1">{s.description}</div>
                {s.resolved && <div className="text-xs text-emerald-200/80 mt-1">Resolved by {s.resolvedBy} on {fmtShort((s.resolvedAt || "").slice(0, 10))}: {s.resolveReason}</div>}
              </div>
              {!s.resolved && canSnag && <button onClick={() => setResolving(s)} className="text-xs px-2 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 shrink-0">Resolve</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><ImageIcon size={14} /> Job cards ({(p.jobCards || []).length})</div>
        {(p.jobCards || []).length === 0 ? (
          <div className="text-sm text-slate-500">No job cards uploaded.</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {p.jobCards.map((c) => (
              <img key={c.id} src={c.image} alt="Job card" onClick={() => setLightbox(c.image)} className="w-full h-24 object-cover rounded-lg border border-[#30363d] cursor-zoom-in" />
            ))}
          </div>
        )}
      </div>

      {isCoord && (
        <div className="mt-6 pt-4 border-t border-[#30363d] flex flex-wrap gap-2">
          {isReserved(p) && (
            <>
              {p.reserveStage === "planned" && <button onClick={reserve} className={`${btnGhost} border-slate-400/60`}>Reserve this date</button>}
              {p.reserveStage === "reserved" && <button onClick={unreserve} className={btnGhost}>Back to planned</button>}
              <button onClick={confirmBooking} disabled={!p.received} title={p.received ? "" : "Mark the main item received before confirming"} className={btnPrimary}>Confirm booking</button>
              <button onClick={unplan} className={btnGhost}>Remove from calendar</button>
            </>
          )}
          {p.status === "ordered" && <button onClick={markReceived} className={isReserved(p) ? btnGhost : btnPrimary}>Mark main item received</button>}
          {p.status === "received" && !isReserved(p) && <button onClick={undoReceived} className={btnGhost}>Undo received</button>}
          {p.status === "booked" && <button onClick={markInstalled} className={btnPrimary}>Mark as completed</button>}
          {p.status === "booked" && <button onClick={unbook} className={btnGhost}>Remove booking</button>}
          {p.status === "installed" && !p.invoiced && <button onClick={undoInstalled} className={btnGhost}>Undo completion</button>}
          <button onClick={onEdit} className={btnGhost}>Edit details</button>
          {isDev && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className="ml-auto px-3 py-2 rounded-lg text-red-300 hover:bg-red-500/10 text-sm flex items-center gap-1"><Trash2 size={14} /> Delete</button>}
        </div>
      )}
      {confirmDelete && (
        <div className="mt-3 p-3 rounded-xl border border-red-500/40 bg-red-500/5">
          <div className="text-sm text-red-200 mb-2">Reason for deleting this project</div>
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry" autoFocus />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setConfirmDelete(false)} className={btnGhost}>Cancel</button>
            <button onClick={() => { del(); onClose(); }} disabled={!reason.trim()} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm disabled:opacity-50">Delete project</button>
          </div>
        </div>
      )}

      {(p.log || []).length > 0 && (
        <div className="mt-5">
          <div className="text-xs text-slate-500 mb-1">Activity</div>
          <ul className="text-xs text-slate-400 space-y-0.5 max-h-28 overflow-y-auto">
            {[...p.log].reverse().map((l) => <li key={l.id}>{new Date(l.createdAt).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — {l.text} ({l.author})</li>)}
          </ul>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
      {snagModal && <SnagLogModal user={user} onClose={() => setSnagModal(false)} onSave={logSnag} />}
      {resolving && <SnagResolveModal snag={resolving} onClose={() => setResolving(null)} onConfirm={(note) => resolveSnag(resolving, note)} />}
      {addingDay && <AddDayModal project={p} schedule={schedule} onClose={() => setAddingDay(false)} onConfirm={addDay} />}
    </Modal>
  );
}

function SnagLogModal({ user, onClose, onSave }) {
  const [category, setCategory] = useState(SNAG_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const pick = async (file) => { if (!file || !file.type.startsWith("image/")) return; setBusy(true); setPhoto(await compressImage(file, 1200, 0.75)); setBusy(false); };
  return (
    <Modal title="Log a snag" onClose={onClose}>
      <div className="space-y-4">
        <Field label="What went wrong">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {SNAG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description">
          <textarea className={`${inputCls} min-h-[90px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, what the client reported, what needs fixing" autoFocus />
        </Field>
        <Field label="Photo (optional)">
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current.click()} className={`${btnGhost} flex items-center gap-1.5`}><Upload size={14} /> {photo ? "Change photo" : "Add photo"}</button>
            {photo && <img src={photo} alt="Snag" className="h-14 w-14 object-cover rounded-lg border border-[#30363d]" />}
            {photo && <button onClick={() => setPhoto(null)} className="text-xs text-slate-400 hover:text-red-300">Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button
          disabled={!description.trim() || busy}
          onClick={() => onSave({ id: uid(), category, description: description.trim(), photo, createdAt: new Date().toISOString(), author: user.name, resolved: false, acknowledged: false })}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm disabled:opacity-50"
        >Log snag</button>
      </div>
    </Modal>
  );
}

function SnagResolveModal({ snag, onClose, onConfirm }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="Resolve snag" onClose={onClose}>
      <div className="text-sm text-slate-300 mb-3"><span className="font-medium text-white">{snag.category}</span> — {snag.description}</div>
      <Field label="How was it resolved? (required)">
        <textarea className={`${inputCls} min-h-[80px]`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Inspected on site, re-aligned the blind, client happy" autoFocus />
      </Field>
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => onConfirm(note.trim())} disabled={!note.trim()} className={btnPrimary}>Mark resolved</button>
      </div>
    </Modal>
  );
}

function AddDayModal({ project: p, schedule, onClose, onConfirm }) {
  const last = [...schedule].sort((a, b) => a.date.localeCompare(b.date)).pop();
  let suggested = last ? addDays(last.date, 1) : todayIso();
  while (isWeekend(suggested)) suggested = addDays(suggested, 1);
  const [date, setDate] = useState(suggested);
  const clash = schedule.some((s) => s.date === date);
  return (
    <Modal title={`Add day ${schedule.length + 1} — ${p.clientName}`} onClose={onClose}>
      <Field label="Date for the extra day"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} autoFocus /></Field>
      {isWeekend(date) && <p className="text-xs text-amber-300 mt-2">This is a weekend date.</p>}
      {clash && <p className="text-xs text-red-300 mt-2">This job already has a day on that date.</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => onConfirm(date)} disabled={!date || clash} className={btnPrimary}>Add day</button>
      </div>
    </Modal>
  );
}

/* =========================================================
   DEPARTMENT CALENDAR
   ========================================================= */
// Sticker colour: Shutters orange, Calore blue, everything else green. Snag returns are red.
const stickerCls = (p, variant) => {
  if (variant === "return") return "bg-red-500/20 border-red-500/60 text-red-50";
  // White sticker while planned/reserved; red outline until the material has actually arrived
  if (variant === "reserved") return p.received ? "bg-white border-slate-300 text-slate-900" : "bg-white border-red-500 border-2 text-slate-900";
  if (variant === "booked" || variant === "installed") {
    const done = variant === "installed";
    if (p.department === "shutters") return done ? "bg-orange-700/70 border-orange-500/60 text-white" : "bg-orange-400/25 border-orange-400/60 text-orange-50";
    if (p.department === "calore") return done ? "bg-blue-700/70 border-blue-500/60 text-white" : "bg-blue-400/25 border-blue-400/60 text-blue-50";
    return done ? "bg-emerald-700/70 border-emerald-500/60 text-white" : "bg-emerald-400/25 border-emerald-400/50 text-emerald-50";
  }
  return "bg-slate-300/15 border-slate-400/30 text-slate-200";
};

// One bar = reserved, two bars = confirmed (booked). Nothing while only planned.
const StageBars = ({ p, dark }) => {
  const n = p.status === "booked" || p.status === "installed" ? 2 : p.reserveStage === "reserved" ? 1 : 0;
  if (!n) return null;
  return (
    <span className="flex flex-col gap-[3px] shrink-0" title={n === 2 ? "Confirmed" : "Reserved"}>
      {Array.from({ length: n }).map((_, i) => <span key={i} className={`block w-6 h-[3px] rounded ${dark ? "bg-slate-900" : "bg-white"}`} />)}
    </span>
  );
};

function Sticker({ p, draggable, onDragStart, onClick, variant, dayTag, time, endTime, inTray }) {
  // A planned/reserved job shows white in its tray too, so the tray and calendar match
  if (inTray && isReserved(p)) variant = "reserved";
  const cls = stickerCls(p, variant);
  const flagged = hasOpenSnags(p);
  const white = variant === "reserved";
  return (
    <div
      draggable={draggable} onDragStart={onDragStart} onClick={onClick}
      className={`border rounded-lg px-2 py-1.5 text-xs leading-tight select-none ${cls} ${flagged && variant !== "return" ? "ring-1 ring-red-500/60" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${!draggable && variant === "ordered" ? "opacity-80" : ""}`}
      title={`${p.clientName} · PO ${p.po} · ${p.productType || ""}${p.team ? ` · ${p.team}` : ""}${variant === "return" ? " · Snag return visit" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-semibold truncate flex-1">{p.clientName}</span>
        {dayTag && <span className="font-bold opacity-90">{dayTag}</span>}
        {(flagged || variant === "return") && <SnagFlag small />}
        {p.status === "received" && partiallyReceived(p) && <PartialBadge />}
        {p.status === "received" && variant !== "return" && <RBadge />}
      </div>
      <div className="flex items-center justify-between gap-2 opacity-80 mt-0.5">
        <span className="truncate">{variant === "return" ? "Snag return" : p.consultant}{p.team ? ` · ${p.team}` : ""}</span>
        {inTray && isReserved(p) && p.installDate ? <span className="text-[10px] font-semibold">{p.reserveStage === "reserved" ? "Reserved" : "Planned"} {fmtShort(p.installDate)}</span> : null}
        {!inTray && time && <span>{time}{endTime ? `–${endTime}` : ""}</span>}
        {!inTray && !time && p.materialEta && p.status === "ordered" && !isReserved(p) && <span>ETA {fmtShort(p.materialEta)}</span>}
        {inTray && !isReserved(p) && p.materialEta && p.status === "ordered" && <span>ETA {fmtShort(p.materialEta)}</span>}
        {!inTray && (variant === "reserved" || variant === "booked" || variant === "installed") && <StageBars p={p} dark={white} />}
      </div>
    </div>
  );
}

function CalendarView({ cal, projects, isCoord, user, save, onOpen, initialMonth }) {
  const [month, setMonth] = useState(() => {
    const d = initialMonth ? fromIso(initialMonth) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [booking, setBooking] = useState(null); // { project, date, mode: "book" | "moveDay" | "return" | "moveReturn", dayIndex | visitId }
  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef(null); // { p, kind: "received" | "day" | "return" | "moveReturn", dayIndex, visitId }

  const ordered = projects.filter((p) => p.status === "ordered").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9"));
  const received = projects.filter((p) => p.status === "received").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9"));
  const returns = projects.filter((p) => p.snagReturn); // completed jobs with a snag, waiting for a return visit to be booked
  const onCal = projects.filter(onCalendar); // booked, installed, or planned/reserved

  // map date → items: install days and snag return visits
  const byDay = useMemo(() => {
    const m = {};
    onCal.forEach((p) => {
      const sched = scheduleOf(p);
      sched.forEach((s) => { (m[s.date] = m[s.date] || []).push({ kind: "day", p, day: s, total: sched.length }); });
    });
    projects.forEach((p) => (p.returnVisits || []).forEach((v) => { (m[v.date] = m[v.date] || []).push({ kind: "return", p, visit: v }); }));
    Object.values(m).forEach((arr) => arr.sort((a, b) => ((a.day || a.visit).time || "99").localeCompare((b.day || b.visit).time || "99")));
    return m;
  }, [onCal, projects]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - lead);
    const out = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); out.push(d); }
    if (out[35].getMonth() !== month.getMonth()) out.length = 35;
    return out;
  }, [month]);

  const startDrag = (info) => (e) => { dragRef.current = info; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", info.p.id); };
  const dropOn = (dateIso) => (e) => {
    e.preventDefault(); setDragOver(null);
    const drag = dragRef.current; dragRef.current = null;
    if (!drag || !isCoord) return;
    const { p, kind, dayIndex, visitId } = drag;
    if (kind === "received" || kind === "ordered") setBooking({ project: p, date: dateIso, mode: "book" });
    else if (kind === "day") {
      const cur = scheduleOf(p).find((s) => s.dayIndex === dayIndex);
      if (cur && cur.date !== dateIso) setBooking({ project: p, date: dateIso, mode: "moveDay", dayIndex });
    } else if (kind === "return") setBooking({ project: p, date: dateIso, mode: "return" });
    else if (kind === "moveReturn") {
      const cur = (p.returnVisits || []).find((v) => v.id === visitId);
      if (cur && cur.date !== dateIso) setBooking({ project: p, date: dateIso, mode: "moveReturn", visitId });
    }
  };

  const logLine = (text) => ({ id: uid(), text, author: user.name, createdAt: new Date().toISOString() });

  const confirmBooking = ({ time, endTime, days, reason }) => {
    const { project: p, date, mode, dayIndex, visitId } = booking;
    if (mode === "book") {
      // Step 1 of the two-step booking: the job is only PLANNED on this date. Status does not change
      // and the sticker stays in its tray until the co-ordinator confirms it.
      const schedule = buildSchedule(date, days, time, endTime);
      save(withSchedule({ ...p, reserveStage: "planned", installTime: time, installEndTime: endTime || null, installDays: days,
        log: [...(p.log || []), logLine(`Planned for ${fmt(date)} ${time}${endTime ? `–${endTime}` : ""} (${days} day${days > 1 ? "s" : ""})${p.received ? "" : " — material not yet received"}`)] }, schedule), "Planned on calendar — open the job to reserve or confirm");
    } else if (mode === "moveDay") {
      const schedule = scheduleOf(p).map((s) => (s.dayIndex === dayIndex ? { ...s, date, time: time || s.time, endTime: endTime || null } : s));
      const total = schedule.length;
      const why = p.status === "booked" && reason ? ` — ${reason}` : "";
      const next = withSchedule({ ...p, log: [...(p.log || []), logLine(`Day ${dayIndex}/${total} moved to ${fmt(date)}${time ? ` at ${time}` : ""}${why}`)] }, schedule);
      if (dayIndex === 1 && time) { next.installTime = time; next.installEndTime = endTime || null; }
      save(next, `Day ${dayIndex}/${total} moved`);
    } else if (mode === "return") {
      const visit = { id: uid(), date, time: time || null, endTime: endTime || null, createdAt: new Date().toISOString(), author: user.name };
      save({ ...p, snagReturn: false, returnVisits: [...(p.returnVisits || []), visit], log: [...(p.log || []), logLine(`Snag return visit booked for ${fmt(date)}${time ? ` at ${time}` : ""}`)] }, "Return visit booked");
    } else if (mode === "moveReturn") {
      const visits = (p.returnVisits || []).map((v) => (v.id === visitId ? { ...v, date, time: time || v.time, endTime: endTime || null } : v));
      save({ ...p, returnVisits: visits, log: [...(p.log || []), logLine(`Snag return visit moved to ${fmt(date)}${time ? ` at ${time}` : ""}`)] }, "Return visit moved");
    }
    setBooking(null);
  };

  const monthLabel = month.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const today = todayIso();
  const isShutters = cal.id === "shutters";

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left tray: ordered, by ETA */}
      <aside className="w-56 shrink-0 bg-[#161b22] border border-[#30363d] rounded-2xl p-3 flex flex-col">
        <div className="text-sm font-semibold text-white mb-0.5">Awaiting material</div>
        <div className="text-[11px] text-slate-500 mb-3">In ETA order · {ordered.length}</div>
        <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
          {ordered.length === 0 && <div className="text-xs text-slate-500">No outstanding orders.</div>}
          {ordered.map((p) => <Sticker key={p.id} p={p} inTray draggable={isCoord && !isReserved(p)} onDragStart={startDrag({ p, kind: "ordered" })} onClick={() => onOpen(p)} variant="ordered" />)}
        </div>
        {isCoord && ordered.length > 0 && <div className="text-[11px] text-slate-500 mt-3">Drag onto a date to plan it before stock arrives (white sticker, red outline). Mark received to move it up.</div>}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <cal.icon size={22} className="text-slate-300" />
            <h1 className="text-2xl font-bold text-white">{cal.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-[#161b22]"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium w-40 text-center">{monthLabel}</span>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-[#161b22]"><ChevronRight size={18} /></button>
            <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className={`${btnGhost} py-1.5`}>Today</button>
          </div>
        </div>

        {/* Top tray: received + snag returns, ready to book */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-white">Ready to book</span>
            <RBadge />
            <span className="text-[11px] text-slate-500">{isCoord ? "Drag a sticker onto a date" : "Co-ordinator books these"} · {received.length + returns.length}</span>
            {returns.length > 0 && <span className="text-[11px] text-red-300 flex items-center gap-1 ml-2"><SnagFlag small /> {returns.length} snag return{returns.length > 1 ? "s" : ""} to rebook</span>}
          </div>
          <div className="flex flex-wrap gap-2 min-h-[38px]">
            {received.length + returns.length === 0 && <div className="text-xs text-slate-500 self-center">Nothing waiting to be booked.</div>}
            {returns.map((p) => (
              <div key={`r-${p.id}`} className="w-44">
                <Sticker p={p} draggable={isCoord} onDragStart={startDrag({ p, kind: "return" })} onClick={() => onOpen(p)} variant="return" />
              </div>
            ))}
            {received.map((p) => (
              <div key={p.id} className="w-44">
                <Sticker p={p} inTray draggable={isCoord && !isReserved(p)} onDragStart={startDrag({ p, kind: "received" })} onClick={() => onOpen(p)} variant="received" />
              </div>
            ))}
          </div>
        </div>

        {/* Month grid */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-3 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-7 text-[11px] text-slate-500 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-[minmax(110px,1fr)]">
            {cells.map((d) => {
              const key = iso(d);
              const inMonth = d.getMonth() === month.getMonth();
              const wk = isWeekend(key);
              const items = byDay[key] || [];
              return (
                <div
                  key={key}
                  onDragOver={(e) => { if (isCoord) { e.preventDefault(); setDragOver(key); } }}
                  onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
                  onDrop={dropOn(key)}
                  className={`rounded-lg border p-1.5 flex flex-col gap-1 overflow-hidden ${dragOver === key ? "border-[#1f6feb] bg-[#1f6feb]/10" : "border-[#30363d]"} ${inMonth ? (wk ? "bg-[#0d1117]/60" : "bg-[#0d1117]") : "bg-transparent opacity-40"}`}
                >
                  <div className={`text-xs ${key === today ? "text-white font-bold" : "text-slate-500"}`}>
                    <span className={key === today ? "inline-flex w-5 h-5 rounded-full bg-[#1f6feb] items-center justify-center" : ""}>{d.getDate()}</span>
                  </div>
                  {items.map((it) => it.kind === "day" ? (
                    <Sticker
                      key={`${it.p.id}-${it.day.dayIndex}`} p={it.p} variant={isReserved(it.p) ? "reserved" : it.p.status}
                      draggable={isCoord && (it.p.status === "booked" || isReserved(it.p))}
                      onDragStart={startDrag({ p: it.p, kind: "day", dayIndex: it.day.dayIndex })} onClick={() => onOpen(it.p)}
                      dayTag={it.total > 1 ? `${it.day.dayIndex}/${it.total}` : null}
                      time={it.day.time} endTime={it.day.endTime}
                    />
                  ) : (
                    <Sticker
                      key={`${it.p.id}-${it.visit.id}`} p={it.p} variant="return"
                      draggable={isCoord}
                      onDragStart={startDrag({ p: it.p, kind: "moveReturn", visitId: it.visit.id })} onClick={() => onOpen(it.p)}
                      time={it.visit.time} endTime={it.visit.endTime}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300/15 border border-slate-400/30" /> Placed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300/15 border border-slate-400/30" /><RBadge /> Received</span>
            <span className="flex items-center gap-1.5"><PartialBadge /> Not in full</span>
            {isShutters ? (
              <>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-400/25 border border-orange-400/60" /> Shutters</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400/25 border border-blue-400/60" /> Calore</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400/25 border border-emerald-400/50" /> Booked</span>
            )}
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-700/70 border border-emerald-500/60" /> Completed (darker)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-slate-300" /> Planned / reserved</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border-2 border-red-500" /> Reserved, no stock yet</span>
            <span className="flex items-center gap-1.5"><span className="flex flex-col gap-[2px]"><span className="block w-4 h-[2px] bg-slate-300" /></span> Reserved</span>
            <span className="flex items-center gap-1.5"><span className="flex flex-col gap-[2px]"><span className="block w-4 h-[2px] bg-slate-300" /><span className="block w-4 h-[2px] bg-slate-300" /></span> Confirmed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/60" /> Snag return</span>
            <span className="ml-auto">Each day (1/3, 2/3…) drags on its own.</span>
          </div>
        </div>
      </div>

      {booking && <BookingModal booking={booking} onClose={() => setBooking(null)} onConfirm={confirmBooking} />}
    </div>
  );
}

function BookingModal({ booking, onClose, onConfirm }) {
  const { project: p, date, mode, dayIndex, visitId } = booking;
  const isBook = mode === "book";
  const isMoveDay = mode === "moveDay";
  const isReturn = mode === "return";
  const isMoveReturn = mode === "moveReturn";
  const current = isMoveDay ? scheduleOf(p).find((s) => s.dayIndex === dayIndex) : isMoveReturn ? (p.returnVisits || []).find((v) => v.id === visitId) : null;
  const total = isMoveDay ? scheduleOf(p).length : 0;
  const [time, setTime] = useState(isBook ? (p.installTime || "08:00") : (current?.time || (isReturn ? "08:00" : "")));
  const [endTime, setEndTime] = useState(current?.endTime || (isBook ? (p.installEndTime || "") : ""));
  const [days, setDays] = useState(p.installDays || 1);
  const [reason, setReason] = useState("");
  const needsReason = isMoveDay && p.status === "booked"; // confirmed jobs only move with a reason
  const end = isBook ? installEnd(date, Number(days) || 1) : null;
  const weekend = isWeekend(date);
  const badTime = timeLt(endTime, time) || (!!endTime && !!time && endTime === time);
  const title = isBook ? "Plan installation" : isMoveDay ? `Move day ${dayIndex}/${total}` : isReturn ? "Book snag return visit" : "Move snag return visit";
  const timeRequired = isBook || isReturn;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm text-slate-300 mb-4">
        <span className="font-semibold text-white">{p.clientName}</span> · PO {p.po}{p.team ? ` · ${p.team}` : ""}
        {isBook && <div className="text-xs text-slate-400 mt-1">This plans the job on the date. It stays in its tray until you reserve or confirm it from the job screen.{!p.received ? " Material has not been received yet, so it will show with a red outline." : ""}</div>}
        {isMoveDay && <div className="text-xs text-slate-400 mt-1">Currently {fmt(current?.date)}{current?.time ? ` at ${current.time}` : ""}. Only this day moves; the other days stay where they are.</div>}
        {isMoveReturn && <div className="text-xs text-slate-400 mt-1">Currently {fmt(current?.date)}{current?.time ? ` at ${current.time}` : ""}.</div>}
        {isReturn && <div className="text-xs text-red-300 mt-1 flex items-center gap-1"><SnagFlag small /> Return visit for {openSnags(p).length} open snag{openSnags(p).length > 1 ? "s" : ""}.</div>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={isBook || isReturn ? "Date" : "New date"}><div className={`${inputCls} bg-[#21262d]`}>{fmt(date)}</div></Field>
        {isBook && <Field label="Working days"><input type="number" min="1" max="30" className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} /></Field>}
        <Field label={timeRequired ? "Start time" : "Start time (optional)"}>
          <select className={inputCls} value={time} onChange={(e) => setTime(e.target.value)}>
            {!timeRequired && <option value="">No time</option>}
            {TIMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Expected finish (optional)">
          <select className={`${inputCls} ${badTime ? "border-red-500" : ""}`} value={endTime} onChange={(e) => setEndTime(e.target.value)}>
            <option value="">Not set</option>
            {TIMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {isBook && <Field label="Last day"><div className={`${inputCls} bg-[#21262d]`}>{fmt(end)}</div></Field>}
      </div>
      {needsReason && (
        <div className="mt-4">
          <Field label="Reason for moving a confirmed installation (required)">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client away, installer sick" autoFocus />
          </Field>
        </div>
      )}
      {badTime && <p className="text-xs text-red-300 mt-3 flex items-center gap-1"><AlertTriangle size={12} /> Finish time must be later than the start time.</p>}
      {weekend && <p className="text-xs text-amber-300 mt-3">This is a weekend date.</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => onConfirm({ time, endTime, days: Math.max(1, Number(days) || 1), reason: reason.trim() })} disabled={badTime || (needsReason && !reason.trim())} className={btnPrimary}>
          {isBook ? "Plan on this date" : isMoveDay ? "Move this day" : isReturn ? "Book return visit" : "Move visit"}
        </button>
      </div>
    </Modal>
  );
}

/* =========================================================
   COMPLETED (ready to invoice) + INVOICE LIST
   ========================================================= */
function CompletedView({ items, isCoord, isDev, user, save, onOpen, setToast }) {
  const [printing, setPrinting] = useState(false);
  const ticked = items.filter((p) => p.readyToInvoice);
  const toggle = (p) => save({ ...p, readyToInvoice: !p.readyToInvoice });
  const locked = (p) => hasOpenSnags(p) && !isDev; // open snag blocks invoicing unless developer
  const confirmInvoiced = () => {
    const at = new Date().toISOString();
    ticked.forEach((p) => save({ ...p, invoiced: true, invoicedAt: at, readyToInvoice: false, log: [...(p.log || []), { id: uid(), text: "Invoiced — moved to history", author: user.name, createdAt: at }] }));
    setPrinting(false);
    setToast(`${ticked.length} job${ticked.length > 1 ? "s" : ""} moved to History`);
  };

  if (printing) {
    return (
      <div>
        <div className="print:hidden flex items-center gap-2 mb-4">
          <button onClick={() => window.print()} className={`${btnPrimary} flex items-center gap-2`}><Printer size={16} /> Print / Save as PDF</button>
          <button onClick={confirmInvoiced} className={`${btnGhost} border-emerald-500/40 text-emerald-300`}>Done — move these {ticked.length} to History</button>
          <button onClick={() => setPrinting(false)} className={btnGhost}>Back</button>
        </div>
        <div className="report bg-white text-black rounded-2xl p-8 print:p-0 print:rounded-none">
          <div className="border-b-2 border-black pb-3 mb-4">
            <div className="text-xs tracking-widest text-gray-600">NOLANS INVOICE LIST</div>
            <h2 className="text-2xl font-bold">{fmt(todayIso())} · {ticked.length} {ticked.length === 1 ? "job" : "jobs"}</h2>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-gray-400"><th className="py-1.5 pr-3">Client</th><th className="py-1.5 pr-3">PO</th><th className="py-1.5 pr-3">Department</th><th className="py-1.5 pr-3">Team</th><th className="py-1.5 pr-3">Consultant</th><th className="py-1.5 pr-3">Installed</th></tr></thead>
            <tbody>
              {ticked.map((p) => (
                <tr key={p.id} className="border-b border-gray-200 align-top">
                  <td className="py-1.5 pr-3"><div className="font-semibold">{p.clientName}</div><div className="text-xs text-gray-600">{p.address}</div></td>
                  <td className="py-1.5 pr-3">{p.po}</td>
                  <td className="py-1.5 pr-3">{deptOf(p.department).label}<div className="text-xs text-gray-600">{p.productType}</div></td>
                  <td className="py-1.5 pr-3">{p.team || "—"}</td>
                  <td className="py-1.5 pr-3">{p.consultant}</td>
                  <td className="py-1.5 pr-3">{fmtShort(p.installDate)}{p.installEndDate && p.installEndDate !== p.installDate ? ` – ${fmtShort(p.installEndDate)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <style>{`@media print { @page { margin: 12mm; } body { background: white !important; } }`}</style>
      </div>
    );
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Completed orders</h1>
          <div className="text-sm text-slate-400">{items.length} awaiting invoicing{isCoord && ticked.length > 0 ? ` · ${ticked.length} ticked` : ""}</div>
        </div>
        {isCoord && <button onClick={() => setPrinting(true)} disabled={ticked.length === 0} className={`${btnPrimary} flex items-center gap-2`}><FileText size={16} /> Generate invoice list</button>}
      </div>
      {items.length === 0 ? (
        <div className="text-slate-400 text-sm py-10 text-center border border-dashed border-[#30363d] rounded-xl">Nothing here yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const d = deptOf(p.department);
            return (
              <div key={p.id} className={`bg-[#0d1117] border ${snagCardCls(p)} rounded-xl p-4 flex items-center gap-4`}>
                {isCoord && (
                  <label className={`flex items-center gap-2 text-xs shrink-0 select-none ${locked(p) ? "text-slate-500 cursor-not-allowed" : "text-slate-300 cursor-pointer"}`} title={locked(p) ? "Resolve the open snag before invoicing" : ""}>
                    <input type="checkbox" checked={!!p.readyToInvoice} disabled={locked(p)} onChange={() => toggle(p)} className="w-4 h-4" />
                    Ready to invoice
                  </label>
                )}
                <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-12 md:col-span-5 min-w-0">
                    <div className="font-medium text-white truncate">{p.clientName}</div>
                    <div className="text-xs text-slate-400 truncate">{p.address}</div>
                  </div>
                  <div className="col-span-6 md:col-span-3 text-sm text-slate-300 flex items-center gap-1.5"><d.icon size={14} className="text-slate-500" />{d.label}{p.team ? ` · ${p.team}` : ""}</div>
                  <div className="col-span-6 md:col-span-4 text-xs text-slate-400 text-right flex items-center justify-end gap-2">
                    {hasOpenSnags(p) && <span className="flex items-center gap-1 text-red-300"><SnagFlag small /> {openSnags(p).length} open</span>}
                    <span>PO {p.po} · {p.consultant} · done {fmtShort((p.installedAt || "").slice(0, 10))}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   HISTORY (invoiced) + DELETED
   ========================================================= */
function HistoryView({ items, deleted, isCoord, isDev, user, save, onOpen }) {
  const [showDeleted, setShowDeleted] = useState(false);
  const groups = useMemo(() => {
    const m = {};
    items.forEach((p) => { const k = (p.invoicedAt || "").slice(0, 7); (m[k] = m[k] || []).push(p); });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);
  const stamp = () => new Date().toISOString();
  const moveBack = (p) => save({ ...p, invoiced: false, invoicedAt: null, log: [...(p.log || []), { id: uid(), text: "Moved back to Completed", author: user.name, createdAt: stamp() }] }, "Moved back to Completed");
  const restore = (p) => save({ ...p, deleted: false, deletedAt: null, deletedBy: null, deleteReason: null, log: [...(p.log || []), { id: uid(), text: "Restored", author: user.name, createdAt: stamp() }] }, "Project restored");

  return (
    <div className="space-y-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="text-2xl font-bold text-white">History</h1>
          <span className="text-sm text-slate-400">{items.length} invoiced</span>
        </div>
        {groups.length === 0 ? (
          <div className="text-slate-400 text-sm py-10 text-center border border-dashed border-[#30363d] rounded-xl">No invoiced jobs yet.</div>
        ) : groups.map(([k, list]) => (
          <div key={k} className="mb-5">
            <div className="text-xs text-slate-500 tracking-wider mb-2">{fromIso(k + "-01").toLocaleDateString("en-ZA", { month: "long", year: "numeric" }).toUpperCase()} · {list.length}</div>
            <div className="space-y-2">
              {list.map((p) => {
                const d = deptOf(p.department);
                return (
                  <div key={p.id} className={`bg-[#0d1117] border ${snagCardCls(p)} rounded-xl p-4 flex items-center gap-4`}>
                    <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-12 md:col-span-5 min-w-0">
                        <div className="font-medium text-white truncate flex items-center gap-2">{p.clientName}{hasOpenSnags(p) && <SnagFlag small />}</div>
                        <div className="text-xs text-slate-400 truncate">PO {p.po} · {p.consultant}</div>
                      </div>
                      <div className="col-span-6 md:col-span-3 text-sm text-slate-300 flex items-center gap-1.5"><d.icon size={14} className="text-slate-500" />{d.label}</div>
                      <div className="col-span-6 md:col-span-4 text-xs text-slate-400 text-right">Installed {fmtShort(p.installDate)} · invoiced {fmtShort((p.invoicedAt || "").slice(0, 10))}</div>
                    </button>
                    {isCoord && <button onClick={() => moveBack(p)} className={`${btnGhost} py-1.5 text-xs flex items-center gap-1 shrink-0`} title="Move back to Completed"><RotateCcw size={12} /> Move back</button>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isDev && deleted.length > 0 && (
        <div className="bg-[#161b22] border border-orange-500/40 rounded-2xl p-6">
          <button onClick={() => setShowDeleted((s) => !s)} className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2 text-orange-300 font-semibold"><Trash2 size={16} /> Deleted projects <span className="text-xs font-normal text-orange-300/70">· {deleted.length} · developer only</span></div>
            <ChevronDown size={18} className={`text-orange-300 transition-transform ${showDeleted ? "rotate-180" : ""}`} />
          </button>
          {showDeleted && (
            <div className="space-y-2 mt-4">
              {deleted.map((p) => (
                <div key={p.id} className="bg-[#0d1117] border border-orange-500/30 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{p.clientName} <span className="text-xs text-slate-500 font-normal">· PO {p.po} · {deptOf(p.department).label} · {p.consultant}</span></div>
                    <div className="text-xs text-orange-200/80 mt-0.5">Reason: {p.deleteReason || "—"} · by {p.deletedBy} on {fmtShort((p.deletedAt || "").slice(0, 10))}</div>
                  </div>
                  <button onClick={() => restore(p)} className={`${btnGhost} py-1.5 text-xs flex items-center gap-1 shrink-0`}><RotateCcw size={12} /> Restore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   AVAILABILITY (co-ordinator+)
   ========================================================= */
function AvailabilityView({ projects, openDept }) {
  const [dept, setDept] = useState("all");
  const inScope = projects.filter((p) => dept === "all" || calendarOf(p.department) === dept);
  const booked = inScope.filter(onCalendar); // includes planned/reserved days so the capacity picture is honest

  const hoursByDay = useMemo(() => {
    const m = {};
    booked.forEach((p) => scheduleOf(p).forEach((s) => { m[s.date] = (m[s.date] || 0) + hoursPerDay(p); }));
    inScope.forEach((p) => (p.returnVisits || []).forEach((v) => { m[v.date] = (m[v.date] || 0) + DEFAULT_HOURS_PER_DAY; }));
    return m;
  }, [booked, inScope]);

  const months = useMemo(() => {
    const now = new Date();
    return [0, 1, 2].map((off) => {
      const first = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const days = [];
      const cur = new Date(first);
      while (cur.getMonth() === first.getMonth()) {
        const k = iso(cur);
        if (!isWeekend(k)) days.push(k);
        cur.setDate(cur.getDate() + 1);
      }
      return { label: first.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }), first: iso(first), days };
    });
  }, []);

  const state = (k) => {
    const used = hoursByDay[k] || 0, cap = capacityOf(k), pct = used / cap;
    if (pct <= 0.5) return { cls: "bg-emerald-500/15 border-emerald-500/40 text-emerald-100", used, cap };
    if (pct <= 0.8) return { cls: "bg-amber-500/15 border-amber-500/40 text-amber-100", used, cap };
    return { cls: "bg-red-500/15 border-red-500/40 text-red-100", used, cap };
  };
  const today = todayIso();

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Availability</h1>
          <div className="text-sm text-slate-400">Booked hours per working day · capacity 8h Mon–Thu, 7h Fri</div>
        </div>
        <div className="flex items-center gap-3">
          <select className={`${inputCls} w-44`} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {CALENDARS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/40" /> Free</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/40" /> Limited</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/40" /> Full</span>
          </div>
        </div>
      </div>
      {months.map((m) => (
        <div key={m.first} className="mb-6">
          <div className="text-xs text-slate-500 tracking-wider mb-2">{m.label.toUpperCase()}</div>
          <div className="grid grid-cols-5 gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <div key={d} className="text-[11px] text-slate-500 px-2">{d}</div>)}
            {/* pad to the weekday of the first working day */}
            {Array.from({ length: (fromIso(m.days[0]).getDay() + 6) % 7 }).map((_, i) => <div key={`pad${i}`} />)}
            {m.days.map((k) => {
              const s = state(k);
              return (
                <button
                  key={k} onClick={() => openDept(dept === "all" ? "blinds" : dept, k)}
                  className={`border rounded-lg p-2 text-left ${s.cls} ${k === today ? "ring-2 ring-[#1f6feb]" : ""} ${k < today ? "opacity-50" : ""}`}
                  title="Open this month on the calendar"
                >
                  <div className="text-xs font-semibold">{fromIso(k).getDate()}</div>
                  <div className="text-[11px] opacity-80">{s.used}h / {s.cap}h</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   REPORTS (co-ordinator+)
   ========================================================= */
function ReportsView({ projects }) {
  const [dept, setDept] = useState("blinds");
  const [mode, setMode] = useState("daily");
  const [date, setDate] = useState(todayIso());

  const range = mode === "daily" ? [date, date] : [weekStart(date), addDays(weekStart(date), 6)];
  // one row per install day that falls in the range
  const inScope = projects.filter((p) => calendarOf(p.department) === dept);
  const rows = [
    ...inScope.filter((p) => p.status === "booked" || p.status === "installed")
      .flatMap((p) => scheduleOf(p).filter((s) => s.date >= range[0] && s.date <= range[1]).map((s) => ({ p, day: s, total: scheduleOf(p).length }))),
    ...inScope.flatMap((p) => (p.returnVisits || []).filter((v) => v.date >= range[0] && v.date <= range[1]).map((v) => ({ p, day: { dayIndex: 1, date: v.date, time: v.time, endTime: v.endTime }, total: 1, isReturn: true }))),
  ].sort((a, b) => (a.day.date + (a.day.time || "99")).localeCompare(b.day.date + (b.day.time || "99")));
  const d = calOf(dept);
  const title = mode === "daily" ? `${d.label} — ${fmt(date)}` : `${d.label} — week of ${fmt(range[0])} to ${fmt(range[1])}`;

  return (
    <div>
      <div className="print:hidden bg-[#161b22] border border-[#30363d] rounded-2xl p-5 mb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Reports</h1>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="Department">
            <select className={inputCls} value={dept} onChange={(e) => setDept(e.target.value)}>
              {CALENDARS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Report">
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label={mode === "daily" ? "Date" : "Any date in the week"}><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <button onClick={() => window.print()} disabled={rows.length === 0} className={`${btnPrimary} flex items-center justify-center gap-2`}><Printer size={16} /> Save as PDF</button>
        </div>
        <p className="text-xs text-slate-500 mt-3">Save as PDF opens the print dialog — choose "Save as PDF" as the printer, then share the file on WhatsApp.</p>
      </div>

      <div className="report bg-white text-black rounded-2xl p-8 print:p-0 print:rounded-none">
        <div className="flex items-baseline justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="text-xs tracking-widest text-gray-600">NOLANS INSTALLATION SCHEDULE</div>
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          <div className="text-xs text-gray-600">{rows.length} {rows.length === 1 ? "visit" : "visits"}</div>
        </div>
        {rows.length === 0 ? (
          <div className="text-gray-600 text-sm py-8 text-center">No installations booked for this period.</div>
        ) : rows.map(({ p, day, total, isReturn }, idx) => (
          <div key={`${p.id}-${day.dayIndex}-${day.date}`} className={`report-job ${idx > 0 ? "mt-6 pt-6 border-t border-gray-300" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold">
                  {p.clientName}
                  {total > 1 ? <span className="text-sm font-normal text-gray-600"> · day {day.dayIndex} of {total}</span> : null}
                  {isReturn ? <span className="text-sm font-bold text-red-700"> · SNAG RETURN VISIT</span> : null}
                  {(p.department === "shutters" || p.department === "calore") ? <span className="text-sm font-normal text-gray-600"> · {deptOf(p.department).label}</span> : null}
                </div>
                {isReturn && openSnags(p).map((s) => <div key={s.id} className="text-sm text-red-800">{s.category}: {s.description}</div>)}
                <div className="text-sm text-gray-800">{p.address}</div>
                <div className="text-sm text-gray-800">Contact: {p.contact || "—"}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold">{fmt(day.date)}</div>
                <div className="text-gray-800">{day.time ? `${day.time}${day.endTime ? ` – ${day.endTime}` : ""}` : "Continuation"}</div>
                <div className="text-gray-800">PO {p.po}</div>
                <div className="text-gray-600">{p.productType} · {p.consultant}{p.team ? ` · ${p.team}` : ""}</div>
              </div>
            </div>
            {(p.jobCards || []).length > 0 && day.dayIndex === 1 && !isReturn && (
              <div className="mt-3 space-y-3">
                {p.jobCards.map((c) => <img key={c.id} src={c.image} alt="Job card" className="w-full rounded border border-gray-300 report-img" />)}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; }
          body { background: white !important; }
          .report { color: black; }
          .report-job { break-inside: avoid; page-break-inside: avoid; }
          .report-img { max-height: 240mm; object-fit: contain; }
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   SNAGS TAB — jobs with open snags, any status
   ========================================================= */
function SnagsView({ items, onOpen }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Flag size={22} className="text-red-400" /> Snags</h1>
        <span className="text-sm text-slate-400">{items.length} job{items.length === 1 ? "" : "s"} with open snags</span>
      </div>
      {items.length === 0 ? (
        <div className="text-slate-400 text-sm py-10 text-center border border-dashed border-[#30363d] rounded-xl">No open snags. Nice.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const d = deptOf(p.department);
            const open = openSnags(p);
            return (
              <button key={p.id} onClick={() => onOpen(p)} className={`w-full text-left bg-[#0d1117] hover:bg-[#12181f] border ${snagCardCls(p)} rounded-xl p-4`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <SnagFlag />
                  <span className="font-medium text-white">{p.clientName}</span>
                  <span className="text-xs text-slate-400">PO {p.po} · <d.icon size={12} className="inline" /> {d.label} · {p.consultant}{p.team ? ` · ${p.team}` : ""}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {p.snagReturn && <span className="text-[11px] text-red-300">Return visit to book</span>}
                    {(p.returnVisits || []).length > 0 && !p.snagReturn && <span className="text-[11px] text-slate-400">Return {fmtShort([...p.returnVisits].sort((a, b) => b.date.localeCompare(a.date))[0].date)}</span>}
                    <Badge status={p.status} />
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {open.map((s) => (
                    <div key={s.id} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-[11px] px-1.5 py-0.5 rounded border border-red-500/40 text-red-300 shrink-0 mt-0.5">{s.category}</span>
                      <span className="flex-1">{s.description}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">{s.author}, {fmtShort((s.createdAt || "").slice(0, 10))}{!s.acknowledged ? " · NEW" : ""}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SNAG REVIEW — resolved snags: cause + cost to company
   Level 2+ edits; consultants can view and add notes.
   ========================================================= */
function SnagReviewView({ projects, user, isCoord, save, onOpen }) {
  const [filter, setFilter] = useState("pending"); // pending | all
  const [noteDraft, setNoteDraft] = useState({});
  const rows = useMemo(() => projects
    .flatMap((p) => (p.snags || []).filter((s) => s.resolved).map((s) => ({ p, s })))
    .filter(({ s }) => filter === "all" || !(s.review && s.review.cause))
    .sort((a, b) => (b.s.resolvedAt || "").localeCompare(a.s.resolvedAt || "")), [projects, filter]);

  const patchReview = (p, s, patch) => {
    const review = { cause: null, costs: [], notes: [], ...(s.review || {}), ...patch };
    save({ ...p, snags: p.snags.map((x) => (x.id === s.id ? { ...x, review } : x)) });
  };
  const addCost = (p, s) => patchReview(p, s, { costs: [...((s.review && s.review.costs) || []), { id: uid(), category: COST_CATEGORIES[0], amount: "", note: "" }] });
  const updCost = (p, s, id, patch) => patchReview(p, s, { costs: (s.review.costs || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const delCost = (p, s, id) => patchReview(p, s, { costs: (s.review.costs || []).filter((c) => c.id !== id) });
  const addNote = (p, s) => {
    const text = (noteDraft[s.id] || "").trim();
    if (!text) return;
    patchReview(p, s, { notes: [...((s.review && s.review.notes) || []), { id: uid(), text, author: user.name, createdAt: new Date().toISOString() }] });
    setNoteDraft((d) => ({ ...d, [s.id]: "" }));
  };
  const totalOf = (s) => ((s.review && s.review.costs) || []).reduce((n, c) => n + (Number(c.amount) || 0), 0);

  // Simple totals — proper filtered reporting comes in phase 4
  const totals = useMemo(() => {
    const all = projects.flatMap((p) => (p.snags || []).filter((s) => s.resolved).map((s) => ({ p, s })));
    const byCause = {}, byCal = {};
    let grand = 0;
    all.forEach(({ p, s }) => {
      const t = totalOf(s); grand += t;
      const c = (s.review && s.review.cause) || "Not yet allocated"; byCause[c] = (byCause[c] || 0) + t;
      const k = calOf(calendarOf(p.department)).label; byCal[k] = (byCal[k] || 0) + t;
    });
    return { grand, byCause, byCal, count: all.length };
  }, [projects]);

  return (
    <div className="space-y-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ClipboardCheck size={22} className="text-slate-300" /> Snag review</h1>
            <div className="text-sm text-slate-400">{isCoord ? "Allocate the cause and cost to company for each resolved snag." : "View only — you can add notes."}</div>
          </div>
          <select className={`${inputCls} w-44`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Needs allocation</option>
            <option value="all">All resolved snags</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="text-slate-400 text-sm py-10 text-center border border-dashed border-[#30363d] rounded-xl">{filter === "pending" ? "Everything has been allocated." : "No resolved snags yet."}</div>
        ) : (
          <div className="space-y-3">
            {rows.map(({ p, s }) => {
              const d = deptOf(p.department);
              const r = s.review || { cause: null, costs: [], notes: [] };
              return (
                <div key={s.id} className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    {s.photo && <img src={s.photo} alt="Snag" className="w-14 h-14 object-cover rounded-lg border border-[#30363d] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <button onClick={() => onOpen(p)} className="font-medium text-white hover:underline">{p.clientName}</button>
                      <span className="text-xs text-slate-400"> · PO {p.po} · <d.icon size={12} className="inline" /> {d.label} · {p.productType} · {p.consultant}{p.team ? ` · ${p.team}` : ""}</span>
                      <div className="text-sm text-slate-300 mt-1"><span className="text-[11px] px-1.5 py-0.5 rounded border border-slate-500/40 text-slate-400 mr-2">Logged as {s.category}</span>{s.description}</div>
                      <div className="text-xs text-emerald-200/80 mt-1">Resolved by {s.resolvedBy} on {fmtShort((s.resolvedAt || "").slice(0, 10))}: {s.resolveReason}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-500">Cost to company</div>
                      <div className={`text-lg font-semibold ${totalOf(s) > 0 ? "text-red-300" : "text-slate-400"}`}>{zar(totalOf(s))}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 mt-4">
                    <Field label="Cause">
                      <select className={inputCls} value={r.cause || ""} disabled={!isCoord} onChange={(e) => patchReview(p, s, { cause: e.target.value || null })}>
                        <option value="">Not yet allocated</option>
                        {SNAG_CAUSES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Cost lines (ZAR)</div>
                      <div className="space-y-2">
                        {(r.costs || []).map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <select className={`${inputCls} w-32`} value={c.category} disabled={!isCoord} onChange={(e) => updCost(p, s, c.id, { category: e.target.value })}>
                              {COST_CATEGORIES.map((x) => <option key={x}>{x}</option>)}
                            </select>
                            <input type="number" min="0" step="0.01" className={`${inputCls} w-32`} placeholder="0.00" value={c.amount} disabled={!isCoord} onChange={(e) => updCost(p, s, c.id, { amount: e.target.value })} />
                            <input className={inputCls} placeholder="Note (optional)" value={c.note || ""} disabled={!isCoord} onChange={(e) => updCost(p, s, c.id, { note: e.target.value })} />
                            {isCoord && <button onClick={() => delCost(p, s, c.id)} className="p-1.5 rounded-md hover:bg-[#21262d] text-slate-400 shrink-0"><X size={14} /></button>}
                          </div>
                        ))}
                        {(r.costs || []).length === 0 && <div className="text-xs text-slate-500">No costs recorded.</div>}
                      </div>
                      {isCoord && <button onClick={() => addCost(p, s)} className={`${btnGhost} mt-2 flex items-center gap-1.5 text-xs py-1.5`}><Plus size={14} /> Add cost line</button>}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#30363d]">
                    {(r.notes || []).map((n) => (
                      <div key={n.id} className="text-xs text-slate-400 mb-1"><span className="text-slate-300">{n.author}</span> · {fmtShort((n.createdAt || "").slice(0, 10))}: {n.text}</div>
                    ))}
                    <div className="flex items-center gap-2 mt-1">
                      <input className={`${inputCls} text-xs`} placeholder="Add a note" value={noteDraft[s.id] || ""} onChange={(e) => setNoteDraft((dft) => ({ ...dft, [s.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addNote(p, s)} />
                      <button onClick={() => addNote(p, s)} className={`${btnGhost} py-1.5 text-xs shrink-0`}>Add note</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isCoord && totals.count > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Cost to company — all resolved snags</h2>
            <span className="text-xl font-bold text-red-300">{zar(totals.grand)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">By cause</div>
              {Object.entries(totals.byCause).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="flex justify-between py-0.5 text-slate-300"><span>{k}</span><span>{zar(v)}</span></div>)}
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">By department</div>
              {Object.entries(totals.byCal).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="flex justify-between py-0.5 text-slate-300"><span>{k}</span><span>{zar(v)}</span></div>)}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-3">Filtering by product type, consultant and team comes in phase 4.</div>
        </div>
      )}
    </div>
  );
}

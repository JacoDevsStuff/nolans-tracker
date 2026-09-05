import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase, loadAll, fetchProject, upsertProject, removeProject } from "./supabase.js"
import {
  Lock, Unlock, Plus, Search, X, Camera, Check, Trash2, RefreshCw,
  MapPin, User, Package, Calendar, AlertTriangle, ChevronRight, ChevronLeft,
  ClipboardList, Image as ImageIcon, Phone, Hash, Users, Clock, Menu, CalendarDays, Archive, Undo2, StickyNote, FileText, Printer, CalendarCheck, Flag, Wrench, Receipt, RotateCcw,
} from "lucide-react";

/* ============================================================
   CONFIG
   PINs. Each tier can do everything the tier below can, plus
   its own extras. Add or change people here (or just ask me).
     Consultants → view + post notes
     Coordinator → the above + dates, status, material received,
                    install time, team, snags & photos,
                    CREATE projects
     Developer   → the above + edit client/order fields,
                    delete / restore / permanently remove
   ============================================================ */
const USERS = {
  "0001": { name: "Jaco",        level: 1 },
  "0002": { name: "James",       level: 1 },
  "0003": { name: "Trent",       level: 1 },
  "0004": { name: "Theo",        level: 1 },
  "0005": { name: "Co-ordinator", level: 2 },
  "2222": { name: "Developer",   level: 3 },
};
const ROLES = {
  0: { name: "View only",   badge: "bg-slate-100 text-slate-600 border-slate-200" },
  1: { name: "Consultant",  badge: "bg-blue-50 text-blue-700 border-blue-200" },
  2: { name: "Co-ordinator", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  3: { name: "Developer",   badge: "bg-violet-50 text-violet-700 border-violet-200" },
};
const COMPANY_NAME = "Nolans Install Tracker";

/* Installation time options (09:00–17:00, half-hour steps) */
const DAY_START = 9;
const DAY_END = 17;
const DAY_CAPACITY = DAY_END - DAY_START; // 8 working hours per team per day
const TIME_SLOTS = (() => {
  const out = [];
  for (let h = DAY_START; h <= DAY_END; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < DAY_END) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();
/* Estimated job durations the co-ordinator can pick from */
const DURATIONS = [1, 1.5, 2, 3, 4, 5, 6, 8, 12, 16, 24];
const SNAG_HOURS = 2; // default capacity a snag return visit consumes (now editable per job)
const SNAG_DURATIONS = [1, 1.5, 2, 3, 4, 6, 8];
const fmtHours = (h) => (h % 1 === 0 ? `${h}h` : `${Math.floor(h)}h30`);
/* Hours a snag return visit consumes on the day (per-job override, falls back to default) */
const snagHoursOf = (e) => (e && e.snagHours != null && e.snagHours !== "" ? Number(e.snagHours) : SNAG_HOURS);

/* ---------- Status pipeline ---------- */
const STATUSES = [
  { key: "ordered",           label: "Ordered",              badge: "bg-slate-100 text-slate-700 border-slate-200",   dot: "bg-slate-400" },
  { key: "material_received", label: "Material Received",    badge: "bg-amber-100 text-amber-800 border-amber-200",   dot: "bg-amber-500" },
  { key: "scheduled",         label: "Installation Scheduled", badge: "bg-blue-100 text-blue-800 border-blue-200",    dot: "bg-blue-500" },
  { key: "installed",         label: "Installed",            badge: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-500" },
  { key: "complete",          label: "Complete",             badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
];
const statusIndex = (k) => Math.max(0, STATUSES.findIndex((s) => s.key === k));
const statusMeta = (k) => STATUSES.find((s) => s.key === k) || STATUSES[0];

/* ---------- Installation teams (edit here to add/rename) ---------- */
const TEAMS = [
  { key: "team1", label: "Team 1 — Darren" },
  { key: "team2", label: "Team 2 — To be confirmed" },
];
const teamLabel = (k) => (TEAMS.find((t) => t.key === k) || {}).label || "Unassigned";

/* ---------- Consultants (edit here to add/rename) ---------- */
const CONSULTANTS = ["Jaco", "James", "Trent", "Theo", "Luciano", "Marco"];
/* Repairs can also be logged by the front office (receptionist / walk-in) */
const REPAIR_CONSULTANTS = [...CONSULTANTS, "Office"];

/* ---------- Product type options ---------- */
const PRODUCT_TYPES = ["Carpet", "Carpet Tile", "Turf", "Novillon", "Rug", "Other"];

/* Short one-line product summary from the split fields (with legacy fallback) */
function productSummary(e) {
  const parts = [e.type, e.range, e.colour].filter(Boolean);
  if (parts.length) return parts.join(" · ") + (e.sqm ? ` · ${e.sqm}m²` : "");
  return e.product || ""; // legacy single-field fallback
}
const isRepairJob = (e) => e && e.kind === "repair";


/* ---------- Image compression (keeps storage small) ---------- */
function compressImage(file, maxDim = 1200, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtWhen = (ts) => (ts ? new Date(ts).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/* ---------- Date range helpers (multi-day installs) ---------- */
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
/** every ISO date from start..end inclusive (end optional = single day) */
function dateRange(start, end) {
  if (!start) return [];
  if (!end || end <= start) return [start];
  const span = Math.min(daysBetween(start, end), 60); // safety cap
  return Array.from({ length: span + 1 }, (_, i) => addDays(start, i));
}
/** "12 Mar" or "12–14 Mar 2026" style label for an install range */
function fmtRange(start, end) {
  if (!start) return "—";
  if (!end || end <= start) return fmtDate(start);
  const a = new Date(start + "T00:00:00"), b = new Date(end + "T00:00:00");
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const dayA = String(a.getDate()).padStart(2, "0");
  return sameMonth
    ? `${dayA}–${fmtDate(end)}`
    : `${fmtDate(start)} – ${fmtDate(end)}`;
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

/** hours this job consumes on each day it occupies */
function dayLoad(entry, forDate) {
  const days = dateRange(entry.installDate, entry.installEndDate).length || 1;
  const cap = forDate ? dayCapacity(forDate) : DAY_CAPACITY;
  const total = entry.estHours || cap * days;
  return total / days;
}
/** how many days a job needs at full capacity */
const daysNeeded = (hours) => Math.max(1, Math.ceil((hours || DAY_CAPACITY) / DAY_CAPACITY));

/** Capacity for a given ISO date — Fridays 7h (09:00–16:00), all others 8h */
function dayCapacity(iso) {
  const dow = new Date(iso + "T00:00:00").getDay(); // 0=Sun,5=Fri,6=Sat
  return dow === 5 ? 7 : DAY_CAPACITY;
}
const isWeekend = (iso) => { const d = new Date(iso + "T00:00:00").getDay(); return d === 0 || d === 6; };

/** Monday of the week containing iso */
function startOfWeek(iso) {
  const d = new Date(iso + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}
/** does [aStart,aEnd] overlap [bStart,bEnd] (all inclusive ISO strings) */
const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && aEnd >= bStart;
const fmtDayLabel = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short" });

/* Date a completed job counts against for invoicing (installed → completed → install end) */
const invoiceDate = (e) =>
  e.installedDate ||
  (e.completedAt ? new Date(e.completedAt).toISOString().slice(0, 10) : "") ||
  e.installEndDate || e.installDate || "";

/* ============================================================
   MAIN
   ============================================================ */
export default function App() {
  const [index, setIndex] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("projects");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const level = user ? user.level : 0;
  const canCreate = level >= 2;   // co-ordinator can now create projects
  const canInternal = level >= 3; // developer — edit locked fields, delete/restore

  const loadAll_ = useCallback(async () => {
    const list = await loadAll();
    setIndex(list);
  }, []);

  useEffect(() => {
    (async () => { await loadAll_(); setLoading(false); })();
    // Realtime: push updates to all open tabs instantly
    const channel = supabase
      .channel("projects_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, loadAll_)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadAll_]);

  const manualRefresh = async () => { setRefreshing(true); await loadAll_(); setTimeout(() => setRefreshing(false), 400); };

  const submitPin = () => {
    const u = USERS[pinValue.trim()];
    if (u) {
      setUser(u); setPinOpen(false); setPinValue(""); setPinError("");
    } else { setPinError("PIN not recognised"); }
  };

  const saveProject = async (p) => {
    const saved = await upsertProject(p);
    setIndex((prev) => {
      const next = [...prev.filter((e) => e.id !== p.id), { ...saved, openSnags: (saved.snags||[]).filter(s=>!s.resolved).length }];
      return next.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    });
    return saved;
  };

  /** Soft delete — keeps the record so it still shows in History, tagged with who & when */
  const deleteProject = async (id) => {
    const p = await fetchProject(id);
    if (!p) return;
    await saveProject({ ...p, deleted: true, deletedAt: Date.now(), deletedBy: user ? user.name : "Unknown" });
    setOpenId(null);
  };
  /** Bring a deleted project back to life */
  const restoreProject = async (id) => {
    const p = await fetchProject(id);
    if (!p) return;
    await saveProject({ ...p, deleted: false, deletedAt: null, deletedBy: null });
  };
  /** Permanently wipe (developer only) */
  const purgeProject = async (id) => {
    await removeProject(id);
    setIndex((prev) => prev.filter((e) => e.id !== id));
    setOpenId(null);
  };

  /** Book (or move) a job onto a day. Spans forward if the estimate exceeds one day. */
  const scheduleProject = async (id, iso) => {
    const p = await fetchProject(id);
    if (!p) return;
    const hadSpan = p.installDate && p.installEndDate && p.installEndDate > p.installDate
      ? daysBetween(p.installDate, p.installEndDate) : null;
    const span = hadSpan !== null ? hadSpan : daysNeeded(p.estHours) - 1;
    p.installDate = iso;
    p.installEndDate = span > 0 ? addDays(iso, span) : "";
    if (statusIndex(p.status) < statusIndex("scheduled")) p.status = "scheduled";
    await saveProject(p);
  };

  // Live (non-deleted) records feed every working view
  const live = index.filter((e) => !e.deleted);
  const active = live.filter((e) => e.status !== "complete");
  const openSnagJobs = live.filter((e) => (e.openSnags || 0) > 0);
  // History = completed jobs with no open snags, PLUS anything that's been deleted
  const history = index.filter((e) => e.deleted || (e.status === "complete" && !(e.openSnags > 0)));

  /** Schedule a snag return visit onto a day */
  const scheduleSnagVisit = async (id, iso) => {
    const p = await fetchProject(id);
    if (!p) return;
    p.snagVisitDate = iso;
    await saveProject(p);
  };

  const filtered = active.filter((e) => {
    if (filter === "snags" && !e.openSnags) return false;
    if (filter !== "all" && filter !== "snags" && e.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return [e.clientName, e.address, e.consultant, e.type, e.range, e.colour, e.product, e.po, e.repairType].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
    }
    return true;
  });

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s.key]: live.filter((e) => e.status === s.key).length }), {});
  const snagCount = active.reduce((a, e) => a + (e.openSnags || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => setMenuOpen(true)} className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100" title="Menu">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="min-w-0">
              <h1 className="font-semibold leading-tight truncate">{COMPANY_NAME}</h1>
              <p className="text-xs text-slate-500 leading-tight">{active.length} active · {history.length} in history</p>
            </div>
          </div>
          <button onClick={manualRefresh} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Refresh">
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
          {user ? (
            <button onClick={() => setUser(null)} title="Sign out to view only"
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border ${ROLES[level].badge}`}>
              <Unlock size={15} /> {user.name}
            </button>
          ) : (
            <button onClick={() => setPinOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
              <Lock size={15} /> Sign in
            </button>
          )}
        </div>
        {/* View tabs */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {[
            { key: "projects", label: "Projects", icon: ClipboardList, count: active.length },
            { key: "calendar", label: "Calendar", icon: CalendarDays },
            { key: "snags", label: "Snags", icon: Flag, count: openSnagJobs.length, danger: true },
            { key: "reports", label: "Reports", icon: FileText },
            ...(level >= 2 ? [{ key: "availability", label: "Availability", icon: CalendarCheck }] : []),
            { key: "history", label: "History", icon: Archive, count: history.length },
          ].map((t) => (
            <button key={t.key} onClick={() => setView(t.key)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 border-b-2 -mb-px transition ${
                view === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <t.icon size={15} /> {t.label}
              {t.count > 0 && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${t.danger ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {view === "calendar" ? (
          <CalendarView index={active} level={level} onOpen={(id) => setOpenId(id)}
            onSchedule={scheduleProject} onScheduleSnag={scheduleSnagVisit} snagJobs={openSnagJobs} />
        ) : view === "snags" ? (
          <SnagsView snagJobs={openSnagJobs} onOpen={(id) => setOpenId(id)} />
        ) : view === "reports" ? (
          <ReportsView index={live} level={level} />
        ) : view === "availability" && level >= 2 ? (
          <AvailabilityView index={active} />
        ) : view === "history" ? (
          <HistoryView history={history} onOpen={(id) => setOpenId(id)} />
        ) : (
        <>
        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, address, consultant…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          {canCreate && (
            <button onClick={() => setCreating(true)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
              <Plus size={16} /> New Project
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All <b className="ml-1 opacity-60">{active.length}</b></Chip>
          {STATUSES.filter((s) => s.key !== "complete").map((s) => (
            <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
              <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${s.dot}`} />{s.label} <b className="ml-1 opacity-60">{counts[s.key]}</b>
            </Chip>
          ))}
          <Chip active={filter === "snags"} onClick={() => setFilter("snags")} danger>
            <AlertTriangle size={12} className="mr-1" /> Open snags <b className="ml-1 opacity-70">{snagCount}</b>
          </Chip>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState canCreate={canCreate} onCreate={() => setCreating(true)} hasAny={active.length > 0} />
        ) : (
          <div className="grid gap-3">
            {filtered.map((e) => <Card key={e.id} entry={e} onClick={() => setOpenId(e.id)} />)}
          </div>
        )}
        </>
        )}
      </main>

      {/* Menu drawer */}
      {menuOpen && (
        <MenuDrawer
          user={user} level={level} index={active} historyCount={history.length} snagTotal={openSnagJobs.length} view={view}
          onView={(v) => { setView(v); setMenuOpen(false); }}
          onSignIn={() => { setMenuOpen(false); setPinOpen(true); }}
          onSignOut={() => { setUser(null); setMenuOpen(false); }}
          onNew={() => { setMenuOpen(false); setCreating(true); }}
          onFilter={(f) => { setFilter(f); setView("projects"); setMenuOpen(false); }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* PIN modal */}
      {pinOpen && (
        <Modal onClose={() => { setPinOpen(false); setPinError(""); setPinValue(""); }}>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-1"><Lock size={18} /><h2 className="font-semibold text-lg">Sign in</h2></div>
            <p className="text-sm text-slate-500 mb-4">Enter your personal PIN. It sets your name on notes and what you can change.</p>
            <input
              autoFocus type="password" inputMode="numeric" value={pinValue}
              onChange={(e) => { setPinValue(e.target.value); setPinError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submitPin()}
              placeholder="PIN"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 mb-2"
            />
            {pinError && <p className="text-sm text-red-600 mb-2">{pinError}</p>}
            <button onClick={submitPin} className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Unlock</button>
          </div>
        </Modal>
      )}

      {/* New project */}
      {creating && (
        <ProjectForm
          onClose={() => setCreating(false)}
          onSave={async (p) => { await saveProject(p); setCreating(false); setOpenId(p.id); }}
        />
      )}

      {/* Detail */}
      {openId && (
        <Detail
          id={openId} level={level} user={user}
          onClose={() => { setOpenId(null); loadAll_(); }}
          onSave={saveProject} onDelete={deleteProject}
          onRestore={restoreProject} onPurge={purgeProject}
        />
      )}
    </div>
  );
}

/* ============================================================
   LIST CARD
   ============================================================ */
function Card({ entry, onClick }) {
  const meta = statusMeta(entry.status);
  const stage = statusIndex(entry.status);
  const pct = (stage / (STATUSES.length - 1)) * 100;
  const scheduled = entry.status !== "ordered" && entry.status !== "material_received";
  const multiDay = entry.installEndDate && entry.installDate && entry.installEndDate > entry.installDate;
  const repair = isRepairJob(entry);
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            {entry.clientName || "Unnamed client"}
            {repair && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 flex items-center gap-0.5"><Wrench size={10} /> REPAIR</span>}
            {entry.reserved && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-dashed border-slate-300">RESERVED</span>}
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-1 truncate"><MapPin size={13} className="shrink-0" /> {entry.address || "No address"}</div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${meta.badge}`}>{meta.label}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
        {entry.po && <span className="flex items-center gap-1"><Hash size={12} /> {entry.po}</span>}
        {repair
          ? (entry.repairType && <span className="flex items-center gap-1 text-yellow-700"><Wrench size={12} /> {entry.repairType}</span>)
          : (productSummary(entry) && <span className="flex items-center gap-1"><Package size={12} /> {productSummary(entry)}</span>)}
        {repair && entry.type && <span className="flex items-center gap-1"><Package size={12} /> {entry.type}</span>}
        {entry.consultant && <span className="flex items-center gap-1"><User size={12} /> {entry.consultant}</span>}
        {entry.team && <span className="flex items-center gap-1"><Users size={12} /> {teamLabel(entry.team)}</span>}
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {scheduled
            ? <>Install: {fmtRange(entry.installDate, entry.installEndDate)}{entry.installTime ? ` · ${entry.installTime}` : ""}{multiDay ? ` · ${daysBetween(entry.installDate, entry.installEndDate) + 1} days` : ""}</>
            : repair
              ? <>Repair · awaiting scheduling</>
              : <>Material ETA: {fmtDate(entry.materialEta)}</>}
        </span>
        {entry.openSnags > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-medium"><AlertTriangle size={12} /> {entry.openSnags} snag{entry.openSnags > 1 ? "s" : ""}</span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${meta.dot}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

/* ============================================================
   DETAIL
   ============================================================ */
function Detail({ id, level, user, onClose, onSave, onDelete, onRestore, onPurge }) {
  const [p, setP] = useState(null);
  const [snagNote, setSnagNote] = useState("");
  const [snagBusy, setSnagBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);

  const canNote = level >= 1;      // consultant+
  const canOperate = level >= 2;   // coordinator+  (dates, status, material, install time, snags, team)
  const canInternal = level >= 3;  // developer+    (client/order fields, delete/restore/purge)

  useEffect(() => {
    (async () => {
      const proj = await fetchProject(id);
      if (proj && !proj.log) {
        proj.log = proj.notes ? [{ id: uid(), text: proj.notes, role: 0, createdAt: proj.createdAt || Date.now() }] : [];
      }
      setP(proj);
    })();
  }, [id]);

  const patch = (fields) => setP((prev) => ({ ...prev, ...fields }));

  const persist = async (next) => { setP(next); await onSave(next); };

  const setStatus = async (key) => {
    const next = { ...p, status: key };
    if (key === "material_received" && !next.materialReceivedDate) next.materialReceivedDate = todayISO();
    if (key === "installed" && !next.installedDate) next.installedDate = next.installEndDate || next.installDate || todayISO();
    if (key === "complete") next.completedAt = next.completedAt || Date.now();
    else next.completedAt = null;
    await persist(next);
  };

  const addSnag = async (photo) => {
    const snag = { id: uid(), note: snagNote.trim(), photo: photo || null, resolved: false, createdAt: Date.now() };
    const next = { ...p, snags: [snag, ...(p.snags || [])] };
    setSnagNote("");
    await persist(next);
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSnagBusy(true);
    try { const data = await compressImage(file); await addSnag(data); }
    finally { setSnagBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const toggleSnag = async (sid) => {
    const snags = p.snags.map((s) => (s.id === sid ? { ...s, resolved: !s.resolved } : s));
    const stillOpen = snags.some((s) => !s.resolved);
    await persist({ ...p, snags, snagVisitDate: stillOpen ? p.snagVisitDate : "" });
  };
  const removeSnag = async (sid) => {
    const snags = p.snags.filter((s) => s.id !== sid);
    const stillOpen = snags.some((s) => !s.resolved);
    await persist({ ...p, snags, snagVisitDate: stillOpen ? p.snagVisitDate : "" });
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const entry = { id: uid(), text: noteText.trim(), role: level, author: user ? user.name : "", createdAt: Date.now() };
    setNoteText("");
    await persist({ ...p, log: [entry, ...(p.log || [])] });
  };
  const removeNote = async (nid) => {
    await persist({ ...p, log: (p.log || []).filter((n) => n.id !== nid) });
  };

  if (!p) return <Modal onClose={onClose}><div className="p-10 text-center text-slate-400 text-sm">Loading…</div></Modal>;

  const meta = statusMeta(p.status);
  const curIdx = statusIndex(p.status);
  const openSnags = (p.snags || []).filter((s) => !s.resolved).length;
  const repair = isRepairJob(p);
  const consultantOptions = repair ? REPAIR_CONSULTANTS : CONSULTANTS;

  return (
    <Modal onClose={onClose} wide>
      {/* head */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="min-w-0">
          {canInternal ? (
            <input value={p.clientName || ""} onChange={(e) => patch({ clientName: e.target.value })} onBlur={() => onSave(p)}
              className="font-semibold text-lg w-full focus:outline-none border-b border-transparent focus:border-slate-300" placeholder="Client name" />
          ) : <h2 className="font-semibold text-lg truncate">{p.clientName || "Unnamed client"}</h2>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${meta.badge}`}>{meta.label}</span>
            {repair && <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border bg-yellow-100 text-yellow-800 border-yellow-300"><Wrench size={11} /> Repair</span>}
            {p.deleted && <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full border bg-orange-100 text-orange-800 border-orange-300">Deleted</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-2 -m-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={20} /></button>
      </div>

      <div className="p-5 space-y-6">
        {p.deleted && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
            This project was deleted{p.deletedBy ? ` by ${p.deletedBy}` : ""}{p.deletedAt ? ` on ${fmtWhen(p.deletedAt)}` : ""}. It stays in History for the record.
          </div>
        )}

        {/* Status stepper */}
        <section>
          <SectionTitle>Status</SectionTitle>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STATUSES.map((s, i) => {
              const done = i <= curIdx;
              const clickable = canOperate && !p.deleted;
              return (
                <React.Fragment key={s.key}>
                  <button
                    disabled={!clickable} onClick={() => setStatus(s.key)}
                    className={`flex flex-col items-center gap-1 px-1 shrink-0 ${clickable ? "cursor-pointer" : "cursor-default"}`}
                    style={{ minWidth: 72 }}
                  >
                    <span className={`h-7 w-7 rounded-full flex items-center justify-center text-white text-xs ${done ? s.dot : "bg-slate-200"}`}>
                      {done ? <Check size={14} /> : i + 1}
                    </span>
                    <span className={`text-[10px] text-center leading-tight ${done ? "text-slate-700 font-medium" : "text-slate-400"}`}>{s.label}</span>
                  </button>
                  {i < STATUSES.length - 1 && <div className={`h-0.5 flex-1 min-w-[10px] ${i < curIdx ? s.dot : "bg-slate-200"}`} />}
                </React.Fragment>
              );
            })}
          </div>
          {canOperate && p.status === "complete" && openSnags > 0 && (
            <p className="mt-2 text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> Marked complete with {openSnags} open snag{openSnags > 1 ? "s" : ""}.</p>
          )}
          {canOperate && !p.deleted && p.installDate && (
            <button onClick={async () => {
              await persist({ ...p, installDate: "", installEndDate: "", installTime: "",
                status: p.status === "scheduled" ? (repair ? "ordered" : "material_received") : p.status });
            }} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1">
              <Undo2 size={12} /> Unbook (send back to the tray)
            </button>
          )}
          {canOperate && !p.deleted && !repair && (
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!p.reserved} onChange={(e) => persist({ ...p, reserved: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              <span className="text-xs text-slate-600">
                <b>Reserved</b> — pencilled in, material not yet arrived (shows as unconfirmed on the calendar)
              </span>
            </label>
          )}
        </section>

        {/* Details */}
        <section>
          <SectionTitle>Details</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <Field icon={Phone} label="Client contact" value={p.contact} editMode={canInternal} onChange={(v) => patch({ contact: v })} onBlur={() => onSave(p)} />
            <Field icon={MapPin} label="Address" value={p.address} editMode={canInternal} onChange={(v) => patch({ address: v })} onBlur={() => onSave(p)} />
            <Field icon={Hash} label="Internal PO number" value={p.po} editMode={canInternal} onChange={(v) => patch({ po: v })} onBlur={() => onSave(p)} />
            <div>
              <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Package size={12} /> Type</label>
              {canInternal ? (
                <select value={p.type || ""} onChange={(e) => persist({ ...p, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Select…</option>
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  {p.type && !PRODUCT_TYPES.includes(p.type) && <option value={p.type}>{p.type}</option>}
                </select>
              ) : <p className="text-sm text-slate-800">{p.type || p.product || "—"}</p>}
            </div>
            {repair ? (
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Wrench size={12} /> Repair type</label>
                {canInternal ? (
                  <input value={p.repairType || ""} onChange={(e) => patch({ repairType: e.target.value })} onBlur={() => onSave(p)}
                    placeholder="e.g. re-stretch lounge, patch burn near hearth…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
                ) : <p className="text-sm text-slate-800">{p.repairType || "—"}</p>}
              </div>
            ) : (
              <>
                <Field icon={Package} label="Range" value={p.range} editMode={canInternal} onChange={(v) => patch({ range: v })} onBlur={() => onSave(p)} />
                <Field icon={Package} label="Colour" value={p.colour} editMode={canInternal} onChange={(v) => patch({ colour: v })} onBlur={() => onSave(p)} />
                <Field icon={Hash} label="Square meters (m²)" value={p.sqm} editMode={canInternal} onChange={(v) => patch({ sqm: v })} onBlur={() => onSave(p)} />
              </>
            )}
            <div>
              <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><User size={12} /> Consultant</label>
              {canInternal ? (
                <select value={p.consultant || ""} onChange={(e) => persist({ ...p, consultant: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Select…</option>
                  {consultantOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  {p.consultant && !consultantOptions.includes(p.consultant) && <option value={p.consultant}>{p.consultant}</option>}
                </select>
              ) : <p className="text-sm text-slate-800">{p.consultant || "—"}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Users size={12} /> Installation team</label>
              {canOperate ? (
                <select value={p.team || ""} onChange={(e) => persist({ ...p, team: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Unassigned</option>
                  {TEAMS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              ) : <p className="text-sm text-slate-800">{p.team ? teamLabel(p.team) : "—"}</p>}
            </div>
            <DateField label="Order date" value={p.orderDate} editMode={canOperate} onChange={(v) => persist({ ...p, orderDate: v })} />
            {!repair && <DateField label="Material ETA" value={p.materialEta} editMode={canOperate} onChange={(v) => persist({ ...p, materialEta: v })} />}
            {!repair && <DateField label="Material received" value={p.materialReceivedDate} editMode={canOperate} onChange={(v) => persist({ ...p, materialReceivedDate: v })} />}
            <DateField label={repair ? "Repair start date" : "Install start date"} value={p.installDate} editMode={canOperate} onChange={(v) => persist({ ...p, installDate: v })} />
            <DateField label={repair ? "Repair end date (multi-day)" : "Install end date (multi-day)"} value={p.installEndDate} editMode={canOperate} min={p.installDate}
              hint={p.installDate && p.installEndDate && p.installEndDate > p.installDate ? `${daysBetween(p.installDate, p.installEndDate) + 1} days on site` : "Leave blank for a single day"}
              onChange={(v) => persist({ ...p, installEndDate: v })} />
            <TimeField label={repair ? "Repair start time" : "Install start time"} value={p.installTime} editMode={canOperate} onChange={(v) => persist({ ...p, installTime: v })} />
            <div>
              <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Clock size={12} /> Estimated duration</label>
              {canOperate ? (
                <>
                  <select value={p.estHours || ""} onChange={(e) => persist({ ...p, estHours: e.target.value ? Number(e.target.value) : "" })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                    <option value="">Full day ({DAY_CAPACITY}h)</option>
                    {DURATIONS.map((h) => <option key={h} value={h}>{fmtHours(h)}</option>)}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {p.estHours > DAY_CAPACITY
                      ? `Needs ${daysNeeded(p.estHours)} days at ${DAY_CAPACITY}h/day`
                      : `Uses ${fmtHours(p.estHours || DAY_CAPACITY)} of the ${DAY_CAPACITY}h day`}
                  </p>
                </>
              ) : <p className="text-sm text-slate-800">{p.estHours ? fmtHours(p.estHours) : `Full day (${DAY_CAPACITY}h)`}</p>}
            </div>
            <DateField label="Installed on" value={p.installedDate} editMode={canOperate} onChange={(v) => persist({ ...p, installedDate: v })} />
          </div>
        </section>

        {/* Notes & messages */}
        <section>
          <SectionTitle>Notes &amp; messages</SectionTitle>
          {canNote ? (
            <div className="flex gap-2 mb-3">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                placeholder="e.g. Client asked to move the date, please call from site…"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
              <button onClick={addNote} disabled={!noteText.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
                <Plus size={15} /> Post
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-3">Enter a PIN to add a note.</p>
          )}
          {(p.log || []).length === 0 ? (
            <p className="text-sm text-slate-400">No notes yet.</p>
          ) : (
            <div className="grid gap-2">
              {p.log.map((n) => (
                <div key={n.id} className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{n.text}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      <span className="font-medium text-slate-500">{n.author || ROLES[n.role]?.name || "—"}</span>
                      {n.author && <span className="text-slate-400"> ({ROLES[n.role]?.name})</span>} · {fmtWhen(n.createdAt)}
                    </p>
                  </div>
                  {canOperate && (
                    <button onClick={() => removeNote(n.id)} className="text-slate-300 hover:text-red-500 shrink-0" title="Delete note"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Snags */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle noMargin>Snags {openSnags > 0 && <span className="text-red-600">({openSnags} open)</span>}</SectionTitle>
          </div>

          {openSnags > 0 && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-100">
              <label className="text-xs text-red-800 mb-1 flex items-center gap-1 font-medium"><Flag size={12} /> Snag return visit</label>
              {canOperate ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-red-700/80">Return date</span>
                      <input type="date" value={p.snagVisitDate || ""} onChange={(e) => persist({ ...p, snagVisitDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300" />
                    </div>
                    <div>
                      <span className="text-[11px] text-red-700/80">Visit duration</span>
                      <select value={p.snagHours ?? SNAG_HOURS} onChange={(e) => persist({ ...p, snagHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300">
                        {SNAG_DURATIONS.map((h) => <option key={h} value={h}>{fmtHours(h)}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-red-700/80 mt-1">Or drag this job from the Snags tray onto a day in the Calendar. Counts {fmtHours(snagHoursOf(p))} against that day.</p>
                </>
              ) : <p className="text-sm text-slate-800">{p.snagVisitDate ? `${fmtDate(p.snagVisitDate)} · ${fmtHours(snagHoursOf(p))}` : "Not scheduled"}</p>}
            </div>
          )}

          {canOperate && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              <input value={snagNote} onChange={(e) => setSnagNote(e.target.value)} placeholder="Describe the snag…"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
                <button onClick={() => fileRef.current?.click()} disabled={snagBusy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                  <Camera size={15} /> {snagBusy ? "Adding…" : "Add with photo"}
                </button>
                <button onClick={() => addSnag(null)} disabled={snagBusy || !snagNote.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-white disabled:opacity-40">
                  <Plus size={15} /> Note only
                </button>
              </div>
            </div>
          )}

          {(p.snags || []).length === 0 ? (
            <p className="text-sm text-slate-400">No snags logged.</p>
          ) : (
            <div className="grid gap-2">
              {p.snags.map((s) => (
                <div key={s.id} className={`flex gap-3 p-3 rounded-lg border ${s.resolved ? "bg-slate-50 border-slate-200" : "bg-red-50 border-red-100"}`}>
                  {s.photo ? (
                    <img src={s.photo} onClick={() => setLightbox(s.photo)} alt="snag"
                      className="h-16 w-16 rounded-lg object-cover cursor-pointer shrink-0" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><ImageIcon size={20} /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${s.resolved ? "line-through text-slate-400" : "text-slate-800"}`}>{s.note || "(no description)"}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtWhen(s.createdAt)}</p>
                    {canOperate && (
                      <div className="flex gap-3 mt-1.5">
                        <button onClick={() => toggleSnag(s.id)} className="text-xs font-medium text-emerald-700 hover:underline">
                          {s.resolved ? "Reopen" : "Mark resolved"}
                        </button>
                        <button onClick={() => removeSnag(s.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
                      </div>
                    )}
                    {!canOperate && s.resolved && <span className="text-xs text-emerald-600 font-medium">Resolved</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Danger zone */}
        {canInternal && (
          <section className="pt-2 border-t border-slate-100">
            {p.deleted ? (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => { onRestore(p.id); onClose(); }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                  <RotateCcw size={14} /> Restore project
                </button>
                {confirmPurge ? (
                  <>
                    <span className="text-sm text-slate-600">Permanently remove? This can't be undone.</span>
                    <button onClick={() => onPurge(p.id)} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white">Yes, wipe it</button>
                    <button onClick={() => setConfirmPurge(false)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmPurge(true)} className="flex items-center gap-1.5 text-sm text-red-600 hover:underline"><Trash2 size={14} /> Delete permanently</button>
                )}
              </div>
            ) : confirmDel ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">Delete this project? It stays in History, marked deleted.</span>
                <button onClick={() => onDelete(p.id)} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white">Yes, delete</button>
                <button onClick={() => setConfirmDel(false)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 text-sm text-red-600 hover:underline"><Trash2 size={14} /> Delete project</button>
            )}
          </section>
        )}
        <p className="text-[11px] text-slate-400 text-right">Last updated {fmtWhen(p.updatedAt)}</p>
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="snag full" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   CALENDAR VIEW
   Material ETAs (amber) and installation days (blue). Jobs whose
   material has arrived but aren't booked yet sit in the sticky-note
   tray as "stickers"; the co-ordinator drags one onto a day to book
   it. Received-material stickers carry a red "R". Repairs sit in
   their own yellow tray and land as wrench entries. Each day shows
   how much of the working day is still free.
   ============================================================ */
function CalendarView({ index, level, onOpen, onSchedule, onScheduleSnag, snagJobs = [] }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [show, setShow] = useState({ eta: true, install: true, reserved: true, snag: true, repair: true });
  const [dragId, setDragId] = useState(null);   // HTML5 drag
  const [dragKind, setDragKind] = useState(null); // "install" | "snag"
  const [pendingId, setPendingId] = useState(null); // tap-to-place (touch friendly)
  const [pendingKind, setPendingKind] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const canOperate = level >= 2;

  // Stickers whose material has landed but aren't booked yet
  const tray = index.filter((e) => !isRepairJob(e) && e.status === "material_received" && !e.installDate);
  // Repair stickers awaiting a booking
  const repairTray = index.filter((e) => isRepairJob(e) && !e.installDate);
  // Jobs with open snags not yet given a return-visit date → red snag stickers
  const snagTray = snagJobs.filter((e) => !e.snagVisitDate);

  // Lookup: ISO date -> events, plus hours booked per day
  const byDate = {};
  const loadByDate = {};
  const push = (iso, ev) => { if (!iso) return; (byDate[iso] = byDate[iso] || []).push(ev); };
  index.forEach((e) => {
    if (show.eta && e.materialEta && e.status === "ordered" && !isRepairJob(e)) {
      push(e.materialEta, { type: "eta", id: e.id, label: e.clientName || "Unnamed", sub: productSummary(e) });
    }
    if (e.installDate) {
      const repair = isRepairJob(e);
      const days = dateRange(e.installDate, e.installEndDate);
      days.forEach((d, i) => {
        const load = dayLoad(e, d);
        loadByDate[d] = (loadByDate[d] || 0) + load; // reserved still counts toward capacity
        const evType = e.reserved ? "reserved" : repair ? "repair" : "install";
        const showIt = e.reserved ? show.reserved : repair ? show.repair : show.install;
        if (showIt) push(d, {
          type: evType, id: e.id,
          label: e.clientName || "Unnamed",
          sub: days.length > 1 ? `Day ${i + 1}/${days.length}` : (repair ? (e.repairType || "") : ""),
          time: e.installTime || "",
          hours: load, team: e.team, first: i === 0, span: days.length > 1,
        });
      });
    }
  });
  // Snag return visits (from all jobs with open snags)
  snagJobs.forEach((e) => {
    if (!e.snagVisitDate) return;
    const h = snagHoursOf(e);
    loadByDate[e.snagVisitDate] = (loadByDate[e.snagVisitDate] || 0) + h;
    if (show.snag) push(e.snagVisitDate, {
      type: "snag", id: e.id, label: e.clientName || "Unnamed",
      sub: "Snag return", hours: h, first: true,
    });
  });

  // Month grid, Monday-first
  const first = new Date(cursor.y, cursor.m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, iso: `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const step = (n) => {
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const today = todayISO();

  const place = (id, iso, kind) => {
    if (!canOperate || !id) return;
    if (kind === "snag") onScheduleSnag(id, iso);
    else onSchedule(id, iso);
    setDragId(null); setDragKind(null); setPendingId(null); setPendingKind(null); setDropTarget(null);
  };

  const horizon = addDays(today, 30);
  const upcoming = Object.keys(byDate)
    .filter((iso) => iso >= today && iso <= horizon).sort()
    .map((iso) => ({ iso, events: byDate[iso].filter((e) => e.type === "eta" || e.first) }))
    .filter((g) => g.events.length);

  return (
    <div>
      {/* Sticker tray — material in, awaiting booking (each carries a red R) */}
      {(tray.length > 0 || (pendingId && pendingKind === "install")) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 flex items-center gap-1.5">
              <Package size={13} /> Material in, awaiting booking ({tray.length})
            </h3>
            {canOperate && (
              <span className="text-[11px] text-amber-700">
                {pendingId && pendingKind === "install" ? "Now tap a day to book it" : "Drag a sticker onto a day, or tap it"}
              </span>
            )}
          </div>
          {tray.length === 0 ? (
            <p className="text-sm text-amber-700/70">All received material is booked in.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tray.map((e) => {
                const hrs = e.estHours || DAY_CAPACITY;
                const picked = pendingId === e.id && pendingKind === "install";
                return (
                  <div key={e.id}
                    draggable={canOperate}
                    onDragStart={() => { setDragId(e.id); setDragKind("install"); }}
                    onDragEnd={() => { setDragId(null); setDragKind(null); setDropTarget(null); }}
                    onClick={() => canOperate && (picked ? (setPendingId(null), setPendingKind(null)) : (setPendingId(e.id), setPendingKind("install")))}
                    className={`relative shrink-0 w-44 p-2.5 rounded-lg shadow-sm border transition select-none ${
                      canOperate ? "cursor-grab active:cursor-grabbing" : ""} ${
                      picked ? "bg-amber-200 border-amber-500 ring-2 ring-amber-400" : "bg-amber-100 border-amber-300 hover:shadow"}`}
                    style={{ transform: picked ? "rotate(0deg)" : "rotate(-1deg)" }}>
                    <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shadow-sm" title="Material received">R</span>
                    <p className="text-sm font-semibold text-amber-950 truncate pr-5">{e.clientName || "Unnamed"}</p>
                    {productSummary(e) && <p className="text-[11px] text-amber-800 truncate">{productSummary(e)}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-amber-800">
                      <span className="flex items-center gap-0.5"><Clock size={10} /> {fmtHours(hrs)}</span>
                      {e.team && <span className="flex items-center gap-0.5 truncate"><Users size={10} /> {teamLabel(e.team).split(" — ")[0]}</span>}
                    </div>
                    <button onClick={(ev) => { ev.stopPropagation(); onOpen(e.id); }}
                      className="mt-1.5 text-[11px] font-medium text-amber-900 underline underline-offset-2">Open</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Repair tray — repairs awaiting a booking (yellow, wrench) */}
      {repairTray.length > 0 && (
        <div className="mb-4 rounded-xl border border-yellow-300 bg-yellow-50/70 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-yellow-800 flex items-center gap-1.5">
              <Wrench size={13} /> Repairs to schedule ({repairTray.length})
            </h3>
            {canOperate && (
              <span className="text-[11px] text-yellow-700">
                {pendingId && pendingKind === "install" ? "Now tap a day to book it" : "Drag a sticker onto a day, or tap it"}
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {repairTray.map((e) => {
              const hrs = e.estHours || DAY_CAPACITY;
              const picked = pendingId === e.id && pendingKind === "install";
              return (
                <div key={e.id}
                  draggable={canOperate}
                  onDragStart={() => { setDragId(e.id); setDragKind("install"); }}
                  onDragEnd={() => { setDragId(null); setDragKind(null); setDropTarget(null); }}
                  onClick={() => canOperate && (picked ? (setPendingId(null), setPendingKind(null)) : (setPendingId(e.id), setPendingKind("install")))}
                  className={`shrink-0 w-44 p-2.5 rounded-lg shadow-sm border transition select-none ${
                    canOperate ? "cursor-grab active:cursor-grabbing" : ""} ${
                    picked ? "bg-yellow-200 border-yellow-500 ring-2 ring-yellow-400" : "bg-yellow-100 border-yellow-300 hover:shadow"}`}
                  style={{ transform: picked ? "rotate(0deg)" : "rotate(-1deg)" }}>
                  <p className="text-sm font-semibold text-yellow-900 truncate flex items-center gap-1"><Wrench size={11} /> {e.clientName || "Unnamed"}</p>
                  {e.repairType && <p className="text-[11px] text-yellow-800 truncate">{e.repairType}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-yellow-800">
                    <span className="flex items-center gap-0.5"><Clock size={10} /> {fmtHours(hrs)}</span>
                    {e.team && <span className="flex items-center gap-0.5 truncate"><Users size={10} /> {teamLabel(e.team).split(" — ")[0]}</span>}
                  </div>
                  <button onClick={(ev) => { ev.stopPropagation(); onOpen(e.id); }}
                    className="mt-1.5 text-[11px] font-medium text-yellow-900 underline underline-offset-2">Open</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Snag tray — open snags awaiting a return-visit date */}
      {snagTray.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-800 flex items-center gap-1.5">
              <Flag size={13} /> Snags to schedule ({snagTray.length})
            </h3>
            {canOperate && (
              <span className="text-[11px] text-red-700">
                {pendingId && pendingKind === "snag" ? "Now tap a day for the return visit" : "Drag onto a day, or tap it"}
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {snagTray.map((e) => {
              const picked = pendingId === e.id && pendingKind === "snag";
              const openN = (e.snags || []).filter((s) => !s.resolved).length;
              return (
                <div key={e.id}
                  draggable={canOperate}
                  onDragStart={() => { setDragId(e.id); setDragKind("snag"); }}
                  onDragEnd={() => { setDragId(null); setDragKind(null); setDropTarget(null); }}
                  onClick={() => canOperate && (picked ? (setPendingId(null), setPendingKind(null)) : (setPendingId(e.id), setPendingKind("snag")))}
                  className={`shrink-0 w-44 p-2.5 rounded-lg shadow-sm border transition select-none ${
                    canOperate ? "cursor-grab active:cursor-grabbing" : ""} ${
                    picked ? "bg-red-200 border-red-500 ring-2 ring-red-400" : "bg-red-100 border-red-300 hover:shadow"}`}
                  style={{ transform: picked ? "rotate(0deg)" : "rotate(-1deg)" }}>
                  <p className="text-sm font-semibold text-red-950 truncate flex items-center gap-1"><Flag size={11} /> {e.clientName || "Unnamed"}</p>
                  <p className="text-[11px] text-red-800 truncate">{openN} open snag{openN > 1 ? "s" : ""}{e.address ? ` · ${e.address}` : ""}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-red-800">
                    <span className="flex items-center gap-0.5"><Clock size={10} /> {fmtHours(snagHoursOf(e))}</span>
                    {e.team && <span className="flex items-center gap-0.5 truncate"><Users size={10} /> {teamLabel(e.team).split(" — ")[0]}</span>}
                  </div>
                  <button onClick={(ev) => { ev.stopPropagation(); onOpen(e.id); }}
                    className="mt-1.5 text-[11px] font-medium text-red-900 underline underline-offset-2">Open</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
          <h2 className="font-semibold text-base min-w-[150px] text-center">{MONTHS[cursor.m]} {cursor.y}</h2>
          <button onClick={() => step(1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight size={18} /></button>
        </div>
        <button onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
          className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-slate-300">Today</button>
      </div>

      {/* Legend / toggles */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={() => setShow((s) => ({ ...s, eta: !s.eta }))}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
            show.eta ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-white text-slate-400 border-slate-200"}`}>
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Material ETA
        </button>
        <button onClick={() => setShow((s) => ({ ...s, install: !s.install }))}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
            show.install ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-white text-slate-400 border-slate-200"}`}>
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Installation
        </button>
        <button onClick={() => setShow((s) => ({ ...s, repair: !s.repair }))}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
            show.repair ? "bg-yellow-50 text-yellow-800 border-yellow-300" : "bg-white text-slate-400 border-slate-200"}`}>
          <Wrench size={11} /> Repair
        </button>
        <button onClick={() => setShow((s) => ({ ...s, reserved: !s.reserved }))}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
            show.reserved ? "bg-slate-50 text-slate-700 border-slate-300" : "bg-white text-slate-400 border-slate-200"}`}>
          <span className="h-2 w-2 rounded-full border border-dashed border-slate-400" /> Reserved
        </button>
        <button onClick={() => setShow((s) => ({ ...s, snag: !s.snag }))}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
            show.snag ? "bg-red-50 text-red-800 border-red-200" : "bg-white text-slate-400 border-slate-200"}`}>
          <span className="h-2 w-2 rounded-full bg-red-500" /> Snag visit
        </button>
        <span className="flex items-center gap-1.5 text-xs text-slate-400 px-2 py-1.5">
          Working day: {DAY_CAPACITY}h ({String(DAY_START).padStart(2,"0")}:00–{DAY_END}:00)
        </span>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DOW.map((d) => <div key={d} className="text-[11px] font-semibold text-slate-500 text-center py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const events = c ? (byDate[c.iso] || []) : [];
            const booked = c ? (loadByDate[c.iso] || 0) : 0;
            const cap = c ? dayCapacity(c.iso) : DAY_CAPACITY;
            const free = Math.max(0, cap - booked);
            const over = booked > cap;
            const isToday = c && c.iso === today;
            const weekend = i % 7 >= 5;
            const isTarget = c && dropTarget === c.iso;
            const armed = canOperate && (dragId || pendingId);
            return (
              <div key={i}
                onDragOver={(e) => { if (c && canOperate) { e.preventDefault(); setDropTarget(c.iso); } }}
                onDragLeave={() => setDropTarget((t) => (c && t === c.iso ? null : t))}
                onDrop={(e) => { e.preventDefault(); if (c) place(dragId, c.iso, dragKind); }}
                onClick={() => { if (c && pendingId) place(pendingId, c.iso, pendingKind); }}
                className={`min-h-[104px] border-b border-r border-slate-100 p-1.5 transition ${
                  weekend ? "bg-slate-50/60" : ""} ${!c ? "bg-slate-50/40" : ""} ${
                  isTarget ? "bg-blue-50 ring-2 ring-inset ring-blue-400" : ""} ${
                  armed && c ? "cursor-pointer hover:bg-blue-50/50" : ""}`}>
                {c && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full ${
                        isToday ? "bg-slate-900 text-white font-semibold" : "text-slate-400"}`}>{c.d}</span>
                      {booked > 0 && (
                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                          over ? "bg-red-100 text-red-700" : free === 0 ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                          {over ? `+${fmtHours(booked - cap)}` : free === 0 ? "Full" : `${fmtHours(free)} left`}
                        </span>
                      )}
                    </div>
                    {booked > 0 && (
                      <div className="h-1 rounded-full bg-slate-100 mb-1 overflow-hidden">
                        <div className={`h-full ${over ? "bg-red-500" : booked >= cap ? "bg-slate-400" : "bg-blue-500"}`}
                          style={{ width: `${Math.min(100, (booked / cap) * 100)}%` }} />
                      </div>
                    )}
                    <div className="space-y-1">
                      {events.slice(0, 3).map((ev, j) => {
                        const style =
                          ev.type === "eta" ? "bg-amber-100 text-amber-900"
                          : ev.type === "snag" ? "bg-red-100 text-red-800 border border-red-300"
                          : ev.type === "repair" ? "bg-yellow-100 text-yellow-900 border border-yellow-400"
                          : ev.type === "reserved" ? "bg-white text-slate-500 border border-dashed border-slate-400 opacity-80"
                          : `bg-blue-100 text-blue-900 ${ev.span && !ev.first ? "opacity-70" : ""}`;
                        const lead =
                          ev.type === "eta" ? "ETA"
                          : ev.type === "snag" ? "⚑ Snag"
                          : ev.type === "repair" ? `🔧 ${ev.first ? (ev.time || "TBC") : fmtHours(ev.hours)}`
                          : ev.type === "reserved" ? `◌ ${ev.first ? (ev.time || "TBC") : fmtHours(ev.hours)}`
                          : (ev.first ? (ev.time || "TBC") : fmtHours(ev.hours));
                        return (
                          <button key={j} onClick={(e) => { e.stopPropagation(); onOpen(ev.id); }}
                            draggable={canOperate && (ev.type === "install" || ev.type === "reserved" || ev.type === "repair") && ev.first}
                            onDragStart={(e) => { e.stopPropagation(); setDragId(ev.id); setDragKind("install"); }}
                            className={`w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded truncate transition hover:opacity-80 ${style}`}
                            title={`${ev.label}${ev.sub ? " · " + ev.sub : ""}${ev.time ? " · " + ev.time : ""}${ev.hours ? " · " + fmtHours(ev.hours) : ""}`}>
                            <span className="font-medium">{lead}</span> {ev.label}
                            {ev.sub && <span className="block opacity-70 truncate">{ev.sub}</span>}
                          </button>
                        );
                      })}
                      {events.length > 3 && <div className="text-[10px] text-slate-400 pl-1">+{events.length - 3} more</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {canOperate && (
        <p className="text-[11px] text-slate-400 mt-2">
          Drag a booked job to another day to move it. Open a job to unbook it.
        </p>
      )}

      {/* Upcoming */}
      <div className="mt-6">
        <SectionTitle>Next 30 days</SectionTitle>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing scheduled in the next 30 days.</p>
        ) : (
          <div className="grid gap-2">
            {upcoming.map((g) => (
              <div key={g.iso} className="bg-white rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-slate-500">{fmtDate(g.iso)}{g.iso === today && <span className="ml-2 text-slate-900">Today</span>}</p>
                  {loadByDate[g.iso] > 0 && (
                    <p className="text-[11px] text-slate-400">{fmtHours(loadByDate[g.iso])} of {DAY_CAPACITY}h booked</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  {g.events.map((ev, j) => (
                    <button key={j} onClick={() => onOpen(ev.id)} className="flex items-center gap-2 text-left hover:underline">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${
                        ev.type === "eta" ? "bg-amber-500" :
                        ev.type === "snag" ? "bg-red-500" :
                        ev.type === "repair" ? "bg-yellow-400" :
                        ev.type === "reserved" ? "bg-slate-300" : "bg-blue-500"}`} />
                      <span className="text-sm text-slate-800 truncate">{ev.label}</span>
                      <span className="text-xs text-slate-400 truncate">
                        {ev.type === "eta" ? "material ETA"
                          : ev.type === "snag" ? "snag return"
                          : ev.type === "repair" ? `repair${ev.time ? " · " + ev.time : ""}`
                          : ev.type === "reserved" ? `reserved${ev.time ? " · " + ev.time : ""}`
                          : `installation${ev.time ? " · " + ev.time : ""}${ev.hours ? " · " + fmtHours(ev.hours) : ""}`}{ev.sub ? ` · ${ev.sub}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SNAGS VIEW — every job with open snags, in one place
   ============================================================ */
function SnagsView({ snagJobs, onOpen }) {
  const [q, setQ] = useState("");
  const list = snagJobs.filter((e) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [e.clientName, e.address, e.consultant, e.po, e.range, e.colour].filter(Boolean).some((x) => String(x).toLowerCase().includes(s));
  });

  return (
    <div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search snags by client, PO, address…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>

      {snagJobs.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3 text-emerald-500"><Check size={26} /></div>
          <p className="font-medium text-slate-700">No open snags</p>
          <p className="text-sm text-slate-400">Everything's clear. Snags logged on any job show up here until resolved.</p>
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Nothing matches that search.</p>
      ) : (
        <div className="grid gap-3">
          {list.map((e) => {
            const open = (e.snags || []).filter((s) => !s.resolved);
            const wasCompleted = e.status === "complete";
            return (
              <button key={e.id} onClick={() => onOpen(e.id)}
                className="text-left bg-red-50 rounded-xl border border-red-200 p-4 hover:border-red-300 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2 text-slate-900">
                      <Flag size={15} className="text-red-500 shrink-0" />
                      {e.clientName || "Unnamed client"}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-1 truncate mt-0.5"><MapPin size={13} className="shrink-0" /> {e.address || "No address"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                      {open.length} open snag{open.length > 1 ? "s" : ""}
                    </span>
                    {wasCompleted && <span className="text-[10px] text-slate-500">was completed</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 flex-wrap">
                  {e.po && <span className="flex items-center gap-1"><Hash size={12} /> {e.po}</span>}
                  {productSummary(e) && <span className="flex items-center gap-1"><Package size={12} /> {productSummary(e)}</span>}
                  {e.team && <span className="flex items-center gap-1"><Users size={12} /> {teamLabel(e.team)}</span>}
                  {e.snagVisitDate
                    ? <span className="flex items-center gap-1 text-red-600 font-medium"><Calendar size={12} /> Return visit {fmtDate(e.snagVisitDate)} · {fmtHours(snagHoursOf(e))}</span>
                    : <span className="flex items-center gap-1 text-amber-600 font-medium"><Calendar size={12} /> Not yet scheduled</span>}
                </div>
                <div className="space-y-1">
                  {open.slice(0, 2).map((s) => (
                    <p key={s.id} className="text-sm text-slate-700 flex items-start gap-1.5">
                      <span className="text-red-400 mt-0.5">•</span> {s.note || "(no description)"}
                    </p>
                  ))}
                  {open.length > 2 && <p className="text-xs text-slate-400">+{open.length - 2} more…</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   HISTORY VIEW — completed installations + deleted projects
   Deleted projects show in orange, tagged with who & when.
   ============================================================ */
function HistoryView({ history, onOpen }) {
  const [q, setQ] = useState("");
  const filtered = history.filter((e) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [e.clientName, e.address, e.consultant, e.range, e.colour, e.product, e.po, e.repairType, e.deletedBy].filter(Boolean).some((x) => String(x).toLowerCase().includes(s));
  });

  // Group by month (deleted → deletion month; else completion / installed / update month)
  const groups = {};
  filtered.forEach((e) => {
    const when = e.deleted
      ? (e.deletedAt ? new Date(e.deletedAt).toISOString().slice(0, 10) : todayISO())
      : (e.installedDate || (e.completedAt ? new Date(e.completedAt).toISOString().slice(0, 10) : null)
        || (e.updatedAt ? new Date(e.updatedAt).toISOString().slice(0, 10) : todayISO()));
    const key = when.slice(0, 7);
    (groups[key] = groups[key] || []).push({ ...e, when });
  });
  const keys = Object.keys(groups).sort().reverse();
  keys.forEach((k) => groups[k].sort((a, b) => b.when.localeCompare(a.when)));

  return (
    <div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search history by client, PO, address…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400"><Archive size={26} /></div>
          <p className="font-medium text-slate-700">Nothing in history yet</p>
          <p className="text-sm text-slate-400">Jobs move here once the co-ordinator marks them Complete. Deleted projects are kept here too.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Nothing matches that search.</p>
      ) : (
        <div className="space-y-5">
          {keys.map((k) => {
            const [y, m] = k.split("-");
            return (
              <div key={k}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  {MONTHS[Number(m) - 1]} {y} <span className="text-slate-300">· {groups[k].length}</span>
                </h3>
                <div className="grid gap-2">
                  {groups[k].map((e) => {
                    const days = dateRange(e.installDate, e.installEndDate).length;
                    const del = e.deleted;
                    const repair = isRepairJob(e);
                    return (
                      <button key={e.id} onClick={() => onOpen(e.id)}
                        className={`text-left rounded-xl border p-3.5 hover:shadow-sm transition ${
                          del ? "bg-orange-50 border-orange-200 hover:border-orange-300" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="min-w-0">
                            <div className="font-semibold truncate flex items-center gap-2">
                              {e.clientName || "Unnamed client"}
                              {repair && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 flex items-center gap-0.5"><Wrench size={10} /> REPAIR</span>}
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1 truncate">
                              <MapPin size={13} className="shrink-0" /> {e.address || "No address"}
                            </div>
                          </div>
                          {del ? (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 bg-orange-100 text-orange-800 border-orange-300">
                              <Trash2 size={11} className="inline -mt-0.5 mr-0.5" /> Deleted
                            </span>
                          ) : (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 bg-emerald-100 text-emerald-800 border-emerald-200">
                              <Check size={11} className="inline -mt-0.5 mr-0.5" /> Complete
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          {e.po && <span className="flex items-center gap-1"><Hash size={12} /> {e.po}</span>}
                          {repair
                            ? (e.repairType && <span className="flex items-center gap-1 text-yellow-700"><Wrench size={12} /> {e.repairType}</span>)
                            : (productSummary(e) && <span className="flex items-center gap-1"><Package size={12} /> {productSummary(e)}</span>)}
                          {e.consultant && <span className="flex items-center gap-1"><User size={12} /> {e.consultant}</span>}
                          {e.team && <span className="flex items-center gap-1"><Users size={12} /> {teamLabel(e.team)}</span>}
                          {e.installDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} /> {repair ? "Repaired" : "Installed"} {fmtRange(e.installDate, e.installEndDate)}
                              {days > 1 ? ` (${days} days)` : ""}
                            </span>
                          )}
                          {!del && e.openSnags > 0 && (
                            <span className="flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle size={12} /> closed with {e.openSnags} open snag{e.openSnags > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {del && (
                          <p className="mt-2 text-xs text-orange-700 flex items-center gap-1">
                            <Trash2 size={12} /> Deleted{e.deletedBy ? ` by ${e.deletedBy}` : ""}{e.deletedAt ? ` · ${fmtWhen(e.deletedAt)}` : ""}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   REPORTS VIEW — printable daily / weekly schedule + invoicing
   ============================================================ */
function ReportsView({ index, level }) {
  const [mode, setMode] = useState("daily");
  const [date, setDate] = useState(todayISO());
  const canInvoice = level >= 2;

  const isWeekMode = mode === "weekly" || mode === "invoicing";
  const start = isWeekMode ? startOfWeek(date) : date;
  const end = isWeekMode ? addDays(start, 6) : date;
  const periodLabel = mode === "daily" ? fmtDate(date) : `${fmtDate(start)} – ${fmtDate(end)}`;

  const stepBack = () => setDate(addDays(date, isWeekMode ? -7 : -1));
  const stepFwd = () => setDate(addDays(date, isWeekMode ? 7 : 1));

  // ---- Schedule report (daily / weekly): installs + snag return visits ----
  const dayList = dateRange(start, end);
  const scheduleGroups = dayList.map((day) => {
    const installs = index
      .filter((e) => e.installDate && rangesOverlap(e.installDate, e.installEndDate || e.installDate, day, day))
      .map((e) => {
        const span = dateRange(e.installDate, e.installEndDate);
        return { ...e, dayNo: span.indexOf(day) + 1, dayCount: span.length, _row: "install" };
      });
    const snags = index
      .filter((e) => e.snagVisitDate === day && (e.snags || []).some((s) => !s.resolved))
      .map((e) => ({ ...e, dayNo: 1, dayCount: 1, _row: "snag", _isSnag: true }));
    const jobs = [...installs, ...snags]
      .sort((a, b) => (a.installTime || "99").localeCompare(b.installTime || "99") || (a.clientName || "").localeCompare(b.clientName || ""));
    return { day, jobs };
  }).filter((g) => g.jobs.length);
  const totalJobs = scheduleGroups.reduce((a, g) => a + g.jobs.length, 0);

  // ---- Invoicing report: completed jobs in the selected week ----
  const invoiceJobs = index
    .filter((e) => e.status === "complete" && !e.deleted)
    .map((e) => ({ ...e, _inv: invoiceDate(e) }))
    .filter((e) => e._inv && e._inv >= start && e._inv <= end)
    .sort((a, b) => a._inv.localeCompare(b._inv) || (a.clientName || "").localeCompare(b.clientName || ""));

  return (
    <div>
      {/* Print styling — only #install-report shows on paper */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #install-report, #install-report * { visibility: visible !important; }
          #install-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12px; }
          .no-print { display: none !important; }
          #install-report table { font-size: 11px; }
          #install-report thead { display: table-header-group; }
          #install-report tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Controls */}
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          {["daily", "weekly", ...(canInvoice ? ["invoicing"] : [])].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-2 text-sm font-medium capitalize ${mode === m ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {m}
            </button>
          ))}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300" />
        <div className="flex gap-1">
          <button onClick={stepBack} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <button onClick={() => setDate(todayISO())} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Today</button>
          <button onClick={stepFwd} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      {/* Report body */}
      <div id="install-report">
        {mode === "invoicing" ? (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Receipt size={18} /> {COMPANY_NAME} — Invoicing</h2>
              <p className="text-sm text-slate-500">
                Completed installations ready for invoicing · Week of {periodLabel} · {invoiceJobs.length} job{invoiceJobs.length === 1 ? "" : "s"}
              </p>
            </div>
            {invoiceJobs.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center no-print">Nothing completed in this week.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200">
                      <th className="py-1.5 pr-3 font-semibold">PO</th>
                      <th className="py-1.5 pr-3 font-semibold">Client</th>
                      <th className="py-1.5 pr-3 font-semibold">Product</th>
                      <th className="py-1.5 pr-3 font-semibold">Consultant</th>
                      <th className="py-1.5 pr-3 font-semibold">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceJobs.map((j) => (
                      <tr key={j.id} className="border-t border-slate-100 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap font-medium text-slate-800">{j.po || "—"}</td>
                        <td className="py-2 pr-3">
                          {j.clientName || "—"}
                          {isRepairJob(j) && <span className="ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-300">Repair</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {isRepairJob(j)
                            ? <>{j.repairType ? <span className="text-yellow-700">🔧 {j.repairType}</span> : "Repair"}{j.type ? <span className="block text-[11px] text-slate-400">{j.type}</span> : null}</>
                            : (productSummary(j) || "—")}
                        </td>
                        <td className="py-2 pr-3">{j.consultant || "—"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{fmtDate(j._inv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">{COMPANY_NAME} — Installation schedule</h2>
              <p className="text-sm text-slate-500">
                {mode === "daily" ? "Daily" : "Weekly"} report · {periodLabel} · {totalJobs} job{totalJobs === 1 ? "" : "s"}
              </p>
            </div>

            {scheduleGroups.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center no-print">Nothing booked for this {mode === "daily" ? "day" : "week"}.</p>
            ) : (
              <div className="space-y-5">
                {scheduleGroups.map((g) => (
                  <div key={g.day}>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 pb-1 border-b border-slate-200">
                      {fmtDayLabel(g.day)} <span className="text-slate-400 font-normal">· {g.jobs.length} job{g.jobs.length === 1 ? "" : "s"}</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                            <th className="py-1.5 pr-3 font-semibold">Time</th>
                            <th className="py-1.5 pr-3 font-semibold">Client</th>
                            <th className="py-1.5 pr-3 font-semibold">Contact</th>
                            <th className="py-1.5 pr-3 font-semibold">Address</th>
                            <th className="py-1.5 pr-3 font-semibold">Product</th>
                            <th className="py-1.5 pr-3 font-semibold">Consultant</th>
                            <th className="py-1.5 pr-3 font-semibold">Team</th>
                            <th className="py-1.5 pr-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.jobs.map((j) => {
                            const st = reportStatus(j);
                            return (
                              <tr key={`${j.id}-${j._row}`} className="border-t border-slate-100 align-top">
                                <td className="py-2 pr-3 whitespace-nowrap">
                                  {j._isSnag ? (j.snagVisitDate ? "—" : "—") : (j.installTime || "TBC")}
                                  {j.dayCount > 1 && <span className="block text-[10px] text-slate-400">Day {j.dayNo}/{j.dayCount}</span>}
                                </td>
                                <td className="py-2 pr-3 font-medium text-slate-800">{j.clientName || "—"}</td>
                                <td className="py-2 pr-3 whitespace-nowrap">{j.contact || "—"}</td>
                                <td className="py-2 pr-3">{j.address || "—"}</td>
                                <td className="py-2 pr-3">
                                  {j._isSnag
                                    ? <span className="text-red-700">Snag return · {fmtHours(snagHoursOf(j))}</span>
                                    : isRepairJob(j)
                                      ? <>{j.repairType ? <span className="text-yellow-700">🔧 {j.repairType}</span> : "Repair"}{j.type ? <span className="block text-[10px] text-slate-400">{j.type}</span> : null}</>
                                      : (productSummary(j) || "—")}
                                </td>
                                <td className="py-2 pr-3">{j.consultant || "—"}</td>
                                <td className="py-2 pr-3 whitespace-nowrap">{j.team ? teamLabel(j.team).split(" — ")[0] : "—"}</td>
                                <td className="py-2 pr-3">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Status label shown on the daily/weekly report */
function reportStatus(j) {
  if (j._isSnag) return { label: "Snag", cls: "bg-red-100 text-red-800 border-red-200" };
  if (isRepairJob(j)) return { label: "Repair", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (j.reserved && !j.materialReceivedDate) return { label: "Reserved", cls: "bg-white text-slate-500 border-dashed border-slate-300" };
  return { label: "Installation", cls: "bg-blue-100 text-blue-800 border-blue-200" };
}

/* ============================================================
   AVAILABILITY VIEW — co-ordinator only
   Shows next 3 months of weekdays (Mon–Fri) with free hours.
   Fridays cap at 7h (09:00–16:00), all other days 8h.
   ============================================================ */
function AvailabilityView({ index }) {
  const today = todayISO();

  // Build load map (installs + snag return visits)
  const loadByDate = useMemo(() => {
    const map = {};
    index.forEach((e) => {
      if (e.installDate) {
        dateRange(e.installDate, e.installEndDate).forEach((d) => {
          map[d] = (map[d] || 0) + dayLoad(e, d);
        });
      }
      if (e.snagVisitDate && (e.snags || []).some((s) => !s.resolved)) {
        map[e.snagVisitDate] = (map[e.snagVisitDate] || 0) + snagHoursOf(e);
      }
    });
    return map;
  }, [index]);

  // Safe counter-based loop — no string comparison, guaranteed to finish
  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i <= 90; i++) {
      const d = addDays(today, i);
      if (!isWeekend(d)) result.push(d);
    }
    return result;
  }, [today]);

  // Group by week
  const weekGroups = useMemo(() => {
    const weeks = {};
    days.forEach((d) => {
      const wk = startOfWeek(d);
      (weeks[wk] = weeks[wk] || []).push(d);
    });
    return Object.keys(weeks).sort().map((wk) => ({ wk, days: weeks[wk] }));
  }, [days]);

  const freeHours = (d) => Math.max(0, dayCapacity(d) - (loadByDate[d] || 0));
  const isFull = (d) => freeHours(d) === 0;
  const isLimited = (d) => !isFull(d) && freeHours(d) < dayCapacity(d) / 2;
  const dotColor = (d) => isFull(d) ? "bg-red-500" : isLimited(d) ? "bg-amber-400" : "bg-emerald-500";
  const cardColor = (d) => isFull(d) ? "bg-red-50 border-red-100" : isLimited(d) ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100";
  const textColor = (d) => isFull(d) ? "text-red-700" : isLimited(d) ? "text-amber-800" : "text-emerald-800";
  const isFriday = (d) => new Date(d + "T00:00:00").getDay() === 5;
  const nextFree = days.find((d) => freeHours(d) === dayCapacity(d));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900">Availability — next 3 months</h2>
          <p className="text-xs text-slate-500 mt-0.5">Weekdays only · Mon–Thu 8h · Fri 7h (09:00–16:00)</p>
        </div>
        {nextFree && (
          <div className="text-right">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Next fully free day</p>
            <p className="text-sm font-semibold text-emerald-700">{fmtDayLabel(nextFree)}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Limited (&lt;50% free)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Full</span>
      </div>

      <div className="space-y-4">
        {weekGroups.map(({ wk, days: wkDays }) => {
          const allFull = wkDays.every(isFull);
          return (
            <div key={wk}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Week of {fmtDate(wk)}
                {allFull && <span className="ml-2 text-red-500">· Fully booked</span>}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {wkDays.map((d) => {
                  const free = freeHours(d);
                  const cap = dayCapacity(d);
                  const pct = Math.min(100, ((cap - free) / cap) * 100);
                  const isToday = d === today;
                  return (
                    <div key={d} className={`rounded-xl border p-3 ${cardColor(d)} ${isToday ? "ring-2 ring-slate-900" : ""}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-semibold ${textColor(d)}`}>
                          {fmtDayLabel(d)}{isFriday(d) ? " ·Fri" : ""}
                          {isToday && <span className="ml-1 text-slate-900">· Today</span>}
                        </span>
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor(d)}`} />
                      </div>
                      <div className="h-1.5 rounded-full bg-white/60 overflow-hidden mb-1.5">
                        <div className={`h-full ${isFull(d) ? "bg-red-400" : isLimited(d) ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className={`text-[11px] font-medium ${textColor(d)}`}>
                        {isFull(d) ? "Full" : `${fmtHours(free)} of ${fmtHours(cap)} free`}
                      </p>
                      {(loadByDate[d] || 0) > 0 && !isFull(d) && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{fmtHours(loadByDate[d])} booked</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   MENU DRAWER
   ============================================================ */
function MenuDrawer({ user, level, index, historyCount, snagTotal, view, onView, onSignIn, onSignOut, onNew, onFilter, onClose }) {
  const today = todayISO();
  const week = addDays(today, 7);
  const dueSoon = index.filter((e) => e.materialEta && e.materialEta >= today && e.materialEta <= week && e.status === "ordered").length;
  const installsSoon = index.filter((e) => e.installDate && e.installDate >= today && e.installDate <= week).length;
  const awaitingBooking = index.filter((e) => e.status === "material_received" && !e.installDate).length;
  const snagCount = index.reduce((a, e) => a + (e.openSnags || 0), 0);
  const canCreate = level >= 2;

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-72 max-w-[85vw] h-full shadow-xl flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center text-white"><ClipboardList size={18} /></div>
            <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <p className="font-semibold leading-tight">{COMPANY_NAME}</p>
          {user ? (
            <p className="text-xs text-slate-500 mt-0.5">Signed in as <span className="font-medium text-slate-700">{user.name}</span> · {ROLES[level].name}</p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">Not signed in · view only</p>
          )}
        </div>

        <nav className="p-2 flex-1 overflow-y-auto">
          {canCreate && (
            <button onClick={onNew} className="w-full flex items-center gap-2 mb-2 px-3 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
              <Plus size={16} /> New project
            </button>
          )}
          <MenuItem icon={ClipboardList} label="Projects" active={view === "projects"} onClick={() => onView("projects")} />
          <MenuItem icon={CalendarDays} label="Calendar" active={view === "calendar"} onClick={() => onView("calendar")} />
          <MenuItem icon={Flag} label="Snags" active={view === "snags"} badge={snagTotal} danger onClick={() => onView("snags")} />
          <MenuItem icon={FileText} label="Reports" active={view === "reports"} onClick={() => onView("reports")} />
          {level >= 2 && <MenuItem icon={CalendarCheck} label="Availability" active={view === "availability"} onClick={() => onView("availability")} />}
          <MenuItem icon={Archive} label="History" active={view === "history"} badge={historyCount} onClick={() => onView("history")} />

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-3 pt-4 pb-1">Quick filters</p>
          <MenuItem icon={Package} label="Awaiting material" badge={index.filter((e) => e.status === "ordered").length} onClick={() => onFilter("ordered")} />
          <MenuItem icon={StickyNote} label="Awaiting booking" badge={awaitingBooking} onClick={() => onFilter("material_received")} />
          <MenuItem icon={Calendar} label="Scheduled" badge={index.filter((e) => e.status === "scheduled").length} onClick={() => onFilter("scheduled")} />
          <MenuItem icon={AlertTriangle} label="Open snags" badge={snagCount} danger onClick={() => onFilter("snags")} />

          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-3 pt-4 pb-1">This week</p>
          <div className="px-3 py-2 text-sm text-slate-600 space-y-1">
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> {dueSoon} material deliver{dueSoon === 1 ? "y" : "ies"} due</p>
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> {installsSoon} installation{installsSoon === 1 ? "" : "s"} starting</p>
          </div>
        </nav>

        <div className="p-3 border-t border-slate-200">
          {user ? (
            <button onClick={onSignOut} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Lock size={15} /> Sign out
            </button>
          ) : (
            <button onClick={onSignIn} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
              <Unlock size={15} /> Sign in with PIN
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function MenuItem({ icon: Icon, label, active, badge, danger, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon size={16} className={danger && badge > 0 ? "text-red-500" : ""} />
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && (
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${danger ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{badge}</span>
      )}
    </button>
  );
}

/* ============================================================
   NEW PROJECT FORM (installation or repair)
   ============================================================ */
function ProjectForm({ onClose, onSave }) {
  const [kind, setKind] = useState("installation"); // "installation" | "repair"
  const [f, setF] = useState({
    clientName: "", contact: "", address: "", po: "",
    type: "", range: "", colour: "", sqm: "", repairType: "",
    consultant: "", team: "", orderDate: todayISO(), materialEta: "", reserved: false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isRepair = kind === "repair";
  const consultantOptions = isRepair ? REPAIR_CONSULTANTS : CONSULTANTS;

  const submit = () => {
    if (!f.clientName.trim()) return;
    const base = {
      id: uid(),
      clientName: f.clientName, contact: f.contact, address: f.address, po: f.po,
      type: f.type, consultant: f.consultant, team: f.team, orderDate: f.orderDate,
      status: "ordered", snags: [], log: [],
      installTime: "", installDate: "", installEndDate: "", estHours: "",
      snagVisitDate: "", completedAt: null, createdAt: Date.now(), updatedAt: Date.now(),
    };
    const extra = isRepair
      ? { kind: "repair", repairType: f.repairType, range: "", colour: "", sqm: "", materialEta: "", reserved: false }
      : { kind: "installation", range: f.range, colour: f.colour, sqm: f.sqm, materialEta: f.materialEta, reserved: f.reserved };
    onSave({ ...base, ...extra });
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">New {isRepair ? "repair" : "project"}</h2>
          <button onClick={onClose} className="p-2 -m-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>

        {/* Kind switch */}
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden mb-4">
          <button onClick={() => setKind("installation")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${kind === "installation" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            <Package size={15} /> Installation
          </button>
          <button onClick={() => setKind("repair")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${kind === "repair" ? "bg-yellow-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            <Wrench size={15} /> Repair
          </button>
        </div>

        <div className="space-y-3">
          <Input label="Client name *" value={f.clientName} onChange={(v) => set("clientName", v)} autoFocus />
          <Input label="Client contact (phone / email)" value={f.contact} onChange={(v) => set("contact", v)} />
          <Input label="Address" value={f.address} onChange={(v) => set("address", v)} />
          <Input label="Internal PO number" value={f.po} onChange={(v) => set("po", v)} />

          {isRepair ? (
            <>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Product type</label>
                <select value={f.type} onChange={(e) => set("type", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                  <option value="">Select…</option>
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Input label="Repair type (what needs doing)" value={f.repairType} onChange={(v) => set("repairType", v)} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Type</label>
                  <select value={f.type} onChange={(e) => set("type", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                    <option value="">Select…</option>
                    {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Input label="Square meters (m²)" value={f.sqm} onChange={(v) => set("sqm", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Range" value={f.range} onChange={(v) => set("range", v)} />
                <Input label="Colour" value={f.colour} onChange={(v) => set("colour", v)} />
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Consultant{isRepair ? " / logged by" : ""}</label>
            <select value={f.consultant} onChange={(e) => set("consultant", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="">Select…</option>
              {consultantOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Installation team</label>
            <select value={f.team} onChange={(e) => set("team", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="">Unassigned</option>
              {TEAMS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className={`grid ${isRepair ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
            <div><label className="text-xs text-slate-500 mb-1 block">{isRepair ? "Logged date" : "Order date"}</label>
              <input type="date" value={f.orderDate} onChange={(e) => set("orderDate", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            {!isRepair && (
              <div><label className="text-xs text-slate-500 mb-1 block">Material ETA</label>
                <input type="date" value={f.materialEta} onChange={(e) => set("materialEta", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            )}
          </div>

          {!isRepair && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input type="checkbox" checked={f.reserved} onChange={(e) => set("reserved", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              <span className="text-sm text-slate-700">Pencil in as <b>Reserved</b> (material not yet arrived — shows as unconfirmed on the calendar)</span>
            </label>
          )}
          {isRepair && (
            <p className="text-xs text-slate-400 pt-1">Repairs skip the material stage. Schedule from the yellow tray on the Calendar.</p>
          )}
        </div>
        <button onClick={submit} disabled={!f.clientName.trim()}
          className="w-full mt-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">Create {isRepair ? "repair" : "project"}</button>
      </div>
    </Modal>
  );
}

/* ============================================================
   SMALL UI PIECES
   ============================================================ */
function Chip({ children, active, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 flex items-center text-xs font-medium px-3 py-1.5 rounded-full border transition ${
        active ? (danger ? "bg-red-600 text-white border-red-600" : "bg-slate-900 text-white border-slate-900")
               : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
      {children}
    </button>
  );
}
function SectionTitle({ children, noMargin }) {
  return <h3 className={`text-xs font-semibold uppercase tracking-wide text-slate-400 ${noMargin ? "" : "mb-2"}`}>{children}</h3>;
}
function Field({ icon: Icon, label, value, editMode, onChange, onBlur }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Icon size={12} /> {label}</label>
      {editMode ? (
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      ) : <p className="text-sm text-slate-800">{value || "—"}</p>}
    </div>
  );
}
function DateField({ label, value, editMode, onChange, min, hint }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12} /> {label}</label>
      {editMode ? (
        <>
          <input type="date" value={value || ""} min={min || undefined} onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
          {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
        </>
      ) : <p className="text-sm text-slate-800">{fmtDate(value)}</p>}
    </div>
  );
}
function TimeField({ label, value, editMode, onChange }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Clock size={12} /> {label}</label>
      {editMode ? (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
          <option value="">—</option>
          {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      ) : <p className="text-sm text-slate-800">{value || "—"}</p>}
    </div>
  );
}
function Input({ label, value, onChange, autoFocus }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
    </div>
  );
}
function Modal({ children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-start sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={`bg-white w-full ${wide ? "max-w-2xl" : "max-w-md"} sm:rounded-2xl rounded-none min-h-screen sm:min-h-0 sm:max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl`}>
        {children}
      </div>
    </div>
  );
}
function EmptyState({ canCreate, onCreate, hasAny }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400"><ClipboardList size={26} /></div>
      <p className="font-medium text-slate-700">{hasAny ? "No projects match" : "No projects yet"}</p>
      <p className="text-sm text-slate-400 mb-4">{hasAny ? "Try clearing the search or filter." : canCreate ? "Add your first installation to get started." : "Enter the co-ordinator or developer PIN to add projects."}</p>
      {canCreate && !hasAny && (
        <button onClick={onCreate} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium"><Plus size={16} /> New Project</button>
      )}
    </div>
  );
}

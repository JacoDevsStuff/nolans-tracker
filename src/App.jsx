import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase, loadAll, fetchProject, upsertProject, removeProject } from "./supabase.js"
import {
  Lock, Unlock, Plus, Search, X, Camera, Check, Trash2, RefreshCw,
  MapPin, User, Package, Calendar, AlertTriangle, ChevronRight, ChevronLeft,
  ClipboardList, Image as ImageIcon, Phone, Hash, Users, Clock, Menu, CalendarDays, Archive, Undo2, StickyNote, FileText, Printer, CalendarCheck,
} from "lucide-react";

/* ============================================================
   CONFIG
   PINs. Each tier can do everything the tier below can, plus
   its own extras. Add or change people here (or just ask me).
     Consultants → view + post notes
     Coordinator → the above + dates, status, material received,
                    install time, team, snags & photos
     Developer   → the above + client/order fields, create/delete
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
const fmtHours = (h) => (h % 1 === 0 ? `${h}h` : `${Math.floor(h)}h30`);

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
  const canInternal = level >= 3;

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

  const deleteProject = async (id) => {
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


  const active = index.filter((e) => e.status !== "complete");
  const history = index.filter((e) => e.status === "complete");

  const filtered = active.filter((e) => {
    if (filter === "snags" && !e.openSnags) return false;
    if (filter !== "all" && filter !== "snags" && e.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return [e.clientName, e.address, e.consultant, e.product, e.po].filter(Boolean).some((x) => x.toLowerCase().includes(q));
    }
    return true;
  });

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s.key]: index.filter((e) => e.status === s.key).length }), {});
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
              <p className="text-xs text-slate-500 leading-tight">{active.length} active · {history.length} completed</p>
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
            { key: "reports", label: "Reports", icon: FileText },
            ...(level >= 2 ? [{ key: "availability", label: "Availability", icon: CalendarCheck }] : []),
            { key: "history", label: "History", icon: Archive, count: history.length },
          ].map((t) => (
            <button key={t.key} onClick={() => setView(t.key)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 border-b-2 -mb-px transition ${
                view === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <t.icon size={15} /> {t.label}
              {t.count > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.count}</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {view === "calendar" ? (
          <CalendarView index={active} level={level} onOpen={(id) => setOpenId(id)}
            onSchedule={scheduleProject} />
        ) : view === "reports" ? (
          <ReportsView index={index} />
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
          {canInternal && (
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
          <EmptyState canCreate={canInternal} onCreate={() => setCreating(true)} hasAny={active.length > 0} />
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
          user={user} level={level} index={active} historyCount={history.length} view={view}
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
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{entry.clientName || "Unnamed client"}</div>
          <div className="text-sm text-slate-500 flex items-center gap-1 truncate"><MapPin size={13} className="shrink-0" /> {entry.address || "No address"}</div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${meta.badge}`}>{meta.label}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
        {entry.po && <span className="flex items-center gap-1"><Hash size={12} /> {entry.po}</span>}
        {entry.product && <span className="flex items-center gap-1"><Package size={12} /> {entry.product}</span>}
        {entry.consultant && <span className="flex items-center gap-1"><User size={12} /> {entry.consultant}</span>}
        {entry.team && <span className="flex items-center gap-1"><Users size={12} /> {teamLabel(entry.team)}</span>}
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {scheduled
            ? <>Install: {fmtRange(entry.installDate, entry.installEndDate)}{entry.installTime ? ` · ${entry.installTime}` : ""}{multiDay ? ` · ${daysBetween(entry.installDate, entry.installEndDate) + 1} days` : ""}</>
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
function Detail({ id, level, user, onClose, onSave, onDelete }) {
  const [p, setP] = useState(null);
  const [snagNote, setSnagNote] = useState("");
  const [snagBusy, setSnagBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);

  const canNote = level >= 1;      // consultant+
  const canOperate = level >= 2;   // coordinator+  (dates, status, material, install time, snags, team)
  const canInternal = level >= 3;  // developer+    (client/order fields, delete project)

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
    await persist({ ...p, snags: p.snags.map((s) => (s.id === sid ? { ...s, resolved: !s.resolved } : s)) });
  };
  const removeSnag = async (sid) => {
    await persist({ ...p, snags: p.snags.filter((s) => s.id !== sid) });
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

  return (
    <Modal onClose={onClose} wide>
      {/* head */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="min-w-0">
          {canInternal ? (
            <input value={p.clientName || ""} onChange={(e) => patch({ clientName: e.target.value })} onBlur={() => onSave(p)}
              className="font-semibold text-lg w-full focus:outline-none border-b border-transparent focus:border-slate-300" placeholder="Client name" />
          ) : <h2 className="font-semibold text-lg truncate">{p.clientName || "Unnamed client"}</h2>}
          <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.badge}`}>{meta.label}</span>
        </div>
        <button onClick={onClose} className="p-2 -m-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={20} /></button>
      </div>

      <div className="p-5 space-y-6">
        {/* Status stepper */}
        <section>
          <SectionTitle>Status</SectionTitle>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STATUSES.map((s, i) => {
              const done = i <= curIdx;
              const clickable = canOperate;
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
          {canOperate && p.installDate && (
            <button onClick={async () => {
              await persist({ ...p, installDate: "", installEndDate: "", installTime: "",
                status: p.status === "scheduled" ? "material_received" : p.status });
            }} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1">
              <Undo2 size={12} /> Unbook (send back to the tray)
            </button>
          )}
        </section>

        {/* Details */}
        <section>
          <SectionTitle>Details</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <Field icon={Phone} label="Client contact" value={p.contact} editMode={canInternal} onChange={(v) => patch({ contact: v })} onBlur={() => onSave(p)} />
            <Field icon={MapPin} label="Address" value={p.address} editMode={canInternal} onChange={(v) => patch({ address: v })} onBlur={() => onSave(p)} />
            <Field icon={Hash} label="Internal PO number" value={p.po} editMode={canInternal} onChange={(v) => patch({ po: v })} onBlur={() => onSave(p)} />
            <Field icon={Package} label="Product / carpet" value={p.product} editMode={canInternal} onChange={(v) => patch({ product: v })} onBlur={() => onSave(p)} />
            <Field icon={User} label="Consultant" value={p.consultant} editMode={canInternal} onChange={(v) => patch({ consultant: v })} onBlur={() => onSave(p)} />
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
            <DateField label="Material ETA" value={p.materialEta} editMode={canOperate} onChange={(v) => persist({ ...p, materialEta: v })} />
            <DateField label="Material received" value={p.materialReceivedDate} editMode={canOperate} onChange={(v) => persist({ ...p, materialReceivedDate: v })} />
            <DateField label="Install start date" value={p.installDate} editMode={canOperate} onChange={(v) => persist({ ...p, installDate: v })} />
            <DateField label="Install end date (multi-day)" value={p.installEndDate} editMode={canOperate} min={p.installDate}
              hint={p.installDate && p.installEndDate && p.installEndDate > p.installDate ? `${daysBetween(p.installDate, p.installEndDate) + 1} days on site` : "Leave blank for a single day"}
              onChange={(v) => persist({ ...p, installEndDate: v })} />
            <TimeField label="Install start time" value={p.installTime} editMode={canOperate} onChange={(v) => persist({ ...p, installTime: v })} />
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
            {confirmDel ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Delete this project permanently?</span>
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
   tray; the co-ordinator drags one onto a day to book it. Each day
   shows how much of the working day is still free.
   ============================================================ */
function CalendarView({ index, level, onOpen, onSchedule }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [show, setShow] = useState({ eta: true, install: true });
  const [dragId, setDragId] = useState(null);   // HTML5 drag
  const [pendingId, setPendingId] = useState(null); // tap-to-place (touch friendly)
  const [dropTarget, setDropTarget] = useState(null);

  const canOperate = level >= 2;

  // Unbooked jobs whose material has landed → sticky notes
  const tray = index.filter((e) => e.status === "material_received" && !e.installDate);

  // Lookup: ISO date -> events, plus hours booked per day
  const byDate = {};
  const loadByDate = {};
  const push = (iso, ev) => { if (!iso) return; (byDate[iso] = byDate[iso] || []).push(ev); };
  index.forEach((e) => {
    if (show.eta && e.materialEta && e.status === "ordered") {
      push(e.materialEta, { type: "eta", id: e.id, label: e.clientName || "Unnamed", sub: e.product || "" });
    }
    if (e.installDate) {
      const days = dateRange(e.installDate, e.installEndDate);
      days.forEach((d, i) => {
        const load = dayLoad(e, d);
        loadByDate[d] = (loadByDate[d] || 0) + load;
        if (show.install) push(d, {
          type: "install", id: e.id,
          label: e.clientName || "Unnamed",
          sub: days.length > 1 ? `Day ${i + 1}/${days.length}` : (e.installTime || ""),
          hours: load, team: e.team, first: i === 0, span: days.length > 1,
        });
      });
    }
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

  const place = (id, iso) => {
    if (!canOperate || !id) return;
    onSchedule(id, iso);
    setDragId(null); setPendingId(null); setDropTarget(null);
  };

  const horizon = addDays(today, 30);
  const upcoming = Object.keys(byDate)
    .filter((iso) => iso >= today && iso <= horizon).sort()
    .map((iso) => ({ iso, events: byDate[iso].filter((e) => e.type === "eta" || e.first) }))
    .filter((g) => g.events.length);

  return (
    <div>
      {/* Sticky note tray */}
      {(tray.length > 0 || pendingId) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 flex items-center gap-1.5">
              <Package size={13} /> Material in, awaiting booking ({tray.length})
            </h3>
            {canOperate && (
              <span className="text-[11px] text-amber-700">
                {pendingId ? "Now tap a day to book it" : "Drag a note onto a day, or tap it"}
              </span>
            )}
          </div>
          {tray.length === 0 ? (
            <p className="text-sm text-amber-700/70">All received material is booked in.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tray.map((e) => {
                const hrs = e.estHours || DAY_CAPACITY;
                const picked = pendingId === e.id;
                return (
                  <div key={e.id}
                    draggable={canOperate}
                    onDragStart={() => setDragId(e.id)}
                    onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                    onClick={() => canOperate && setPendingId(picked ? null : e.id)}
                    className={`shrink-0 w-44 p-2.5 rounded-lg shadow-sm border transition select-none ${
                      canOperate ? "cursor-grab active:cursor-grabbing" : ""} ${
                      picked ? "bg-amber-200 border-amber-500 ring-2 ring-amber-400" : "bg-amber-100 border-amber-300 hover:shadow"}`}
                    style={{ transform: picked ? "rotate(0deg)" : "rotate(-1deg)" }}>
                    <p className="text-sm font-semibold text-amber-950 truncate">{e.clientName || "Unnamed"}</p>
                    {e.product && <p className="text-[11px] text-amber-800 truncate">{e.product}</p>}
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
                onDrop={(e) => { e.preventDefault(); if (c) place(dragId, c.iso); }}
                onClick={() => { if (c && pendingId) place(pendingId, c.iso); }}
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
                      {events.slice(0, 3).map((ev, j) => (
                        <button key={j} onClick={(e) => { e.stopPropagation(); onOpen(ev.id); }}
                          draggable={canOperate && ev.type === "install" && ev.first}
                          onDragStart={(e) => { e.stopPropagation(); setDragId(ev.id); }}
                          className={`w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded truncate transition hover:opacity-80 ${
                            ev.type === "eta" ? "bg-amber-100 text-amber-900"
                              : `bg-blue-100 text-blue-900 ${ev.span && !ev.first ? "opacity-70" : ""}`}`}
                          title={`${ev.label}${ev.sub ? " · " + ev.sub : ""}${ev.hours ? " · " + fmtHours(ev.hours) : ""}`}>
                          <span className="font-medium">{ev.type === "eta" ? "ETA" : fmtHours(ev.hours)}</span> {ev.label}
                          {ev.sub && <span className="block opacity-70 truncate">{ev.sub}</span>}
                        </button>
                      ))}
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
          Drag a booked installation to another day to move it. Open a job to unbook it.
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
                      <span className={`h-2 w-2 rounded-full shrink-0 ${ev.type === "eta" ? "bg-amber-500" : "bg-blue-500"}`} />
                      <span className="text-sm text-slate-800 truncate">{ev.label}</span>
                      <span className="text-xs text-slate-400 truncate">
                        {ev.type === "eta" ? "material ETA" : `installation${ev.hours ? " · " + fmtHours(ev.hours) : ""}`}{ev.sub ? ` · ${ev.sub}` : ""}
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
   HISTORY VIEW — completed installations
   ============================================================ */
function HistoryView({ history, onOpen }) {
  const [q, setQ] = useState("");
  const filtered = history.filter((e) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [e.clientName, e.address, e.consultant, e.product, e.po].filter(Boolean).some((x) => x.toLowerCase().includes(s));
  });

  // Group by completion month (falls back to installed date, then last update)
  const groups = {};
  filtered.forEach((e) => {
    const when = e.installedDate || (e.completedAt ? new Date(e.completedAt).toISOString().slice(0, 10) : null)
      || (e.updatedAt ? new Date(e.updatedAt).toISOString().slice(0, 10) : todayISO());
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
          placeholder="Search completed jobs by client, PO, address…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400"><Archive size={26} /></div>
          <p className="font-medium text-slate-700">No completed installations yet</p>
          <p className="text-sm text-slate-400">Jobs move here once the co-ordinator marks them Complete.</p>
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
                    return (
                      <button key={e.id} onClick={() => onOpen(e.id)}
                        className="text-left bg-white rounded-xl border border-slate-200 p-3.5 hover:border-slate-300 hover:shadow-sm transition">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{e.clientName || "Unnamed client"}</div>
                            <div className="text-sm text-slate-500 flex items-center gap-1 truncate">
                              <MapPin size={13} className="shrink-0" /> {e.address || "No address"}
                            </div>
                          </div>
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 bg-emerald-100 text-emerald-800 border-emerald-200">
                            <Check size={11} className="inline -mt-0.5 mr-0.5" /> Complete
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          {e.po && <span className="flex items-center gap-1"><Hash size={12} /> {e.po}</span>}
                          {e.product && <span className="flex items-center gap-1"><Package size={12} /> {e.product}</span>}
                          {e.consultant && <span className="flex items-center gap-1"><User size={12} /> {e.consultant}</span>}
                          {e.team && <span className="flex items-center gap-1"><Users size={12} /> {teamLabel(e.team)}</span>}
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> Installed {fmtRange(e.installDate, e.installEndDate)}
                            {days > 1 ? ` (${days} days)` : ""}
                          </span>
                          {e.openSnags > 0 && (
                            <span className="flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle size={12} /> closed with {e.openSnags} open snag{e.openSnags > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
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
   REPORTS VIEW — printable daily / weekly install schedule
   ============================================================ */
function ReportsView({ index }) {
  const [mode, setMode] = useState("daily");
  const [date, setDate] = useState(todayISO());

  const start = mode === "daily" ? date : startOfWeek(date);
  const end = mode === "daily" ? date : addDays(start, 6);

  // Build one group per day in the period; a job appears on each day it's on site.
  const dayList = dateRange(start, end);
  const groups = dayList.map((day) => {
    const jobs = index
      .filter((e) => e.installDate && rangesOverlap(e.installDate, e.installEndDate || e.installDate, day, day))
      .map((e) => {
        const span = dateRange(e.installDate, e.installEndDate);
        const dayNo = span.indexOf(day) + 1;
        return { ...e, dayNo, dayCount: span.length };
      })
      .sort((a, b) => (a.installTime || "99").localeCompare(b.installTime || "99") || (a.clientName || "").localeCompare(b.clientName || ""));
    return { day, jobs };
  }).filter((g) => g.jobs.length);

  const totalJobs = groups.reduce((a, g) => a + g.jobs.length, 0);
  const periodLabel = mode === "daily" ? fmtDate(date) : `${fmtDate(start)} – ${fmtDate(end)}`;

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
          {["daily", "weekly"].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-2 text-sm font-medium capitalize ${mode === m ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {m}
            </button>
          ))}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300" />
        <div className="flex gap-1">
          <button onClick={() => setDate(addDays(date, mode === "daily" ? -1 : -7))} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <button onClick={() => setDate(todayISO())} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Today</button>
          <button onClick={() => setDate(addDays(date, mode === "daily" ? 1 : 7))} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      {/* Report body */}
      <div id="install-report">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">{COMPANY_NAME} — Installation schedule</h2>
          <p className="text-sm text-slate-500">
            {mode === "daily" ? "Daily" : "Weekly"} report · {periodLabel} · {totalJobs} installation{totalJobs === 1 ? "" : "s"}
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center no-print">No installations booked for this {mode === "daily" ? "day" : "week"}.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
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
                      {g.jobs.map((j) => (
                        <tr key={j.id} className="border-t border-slate-100 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {j.installTime || "—"}
                            {j.dayCount > 1 && <span className="block text-[10px] text-slate-400">Day {j.dayNo}/{j.dayCount}</span>}
                          </td>
                          <td className="py-2 pr-3 font-medium text-slate-800">{j.clientName || "—"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{j.contact || "—"}</td>
                          <td className="py-2 pr-3">{j.address || "—"}</td>
                          <td className="py-2 pr-3">{j.product || "—"}</td>
                          <td className="py-2 pr-3">{j.consultant || "—"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{j.team ? teamLabel(j.team).split(" — ")[0] : "—"}</td>
                          <td className="py-2 pr-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusMeta(j.status).badge}`}>{statusMeta(j.status).label}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
   AVAILABILITY VIEW — co-ordinator only
   Shows next 3 months of weekdays (Mon–Fri) with free hours.
   Fridays cap at 7h (09:00–16:00), all other days 8h.
   ============================================================ */
function AvailabilityView({ index }) {
  const today = todayISO();

  // Build load map
  const loadByDate = useMemo(() => {
    const map = {};
    index.forEach((e) => {
      if (!e.installDate) return;
      dateRange(e.installDate, e.installEndDate).forEach((d) => {
        map[d] = (map[d] || 0) + dayLoad(e, d);
      });
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
function MenuDrawer({ user, level, index, historyCount, view, onView, onSignIn, onSignOut, onNew, onFilter, onClose }) {
  const today = todayISO();
  const week = addDays(today, 7);
  const dueSoon = index.filter((e) => e.materialEta && e.materialEta >= today && e.materialEta <= week && e.status === "ordered").length;
  const installsSoon = index.filter((e) => e.installDate && e.installDate >= today && e.installDate <= week).length;
  const awaitingBooking = index.filter((e) => e.status === "material_received" && !e.installDate).length;
  const snagCount = index.reduce((a, e) => a + (e.openSnags || 0), 0);

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
          <MenuItem icon={ClipboardList} label="Projects" active={view === "projects"} onClick={() => onView("projects")} />
          <MenuItem icon={CalendarDays} label="Calendar" active={view === "calendar"} onClick={() => onView("calendar")} />
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

          {level >= 3 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-3 pt-4 pb-1">Developer</p>
              <MenuItem icon={Plus} label="New project" onClick={onNew} />
            </>
          )}
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
   NEW PROJECT FORM
   ============================================================ */
function ProjectForm({ onClose, onSave }) {
  const [f, setF] = useState({ clientName: "", contact: "", address: "", po: "", product: "", consultant: "", team: "", orderDate: todayISO(), materialEta: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.clientName.trim()) return;
    onSave({ id: uid(), ...f, status: "ordered", snags: [], log: [], installTime: "", installDate: "", installEndDate: "", estHours: "", completedAt: null, createdAt: Date.now(), updatedAt: Date.now() });
  };
  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">New project</h2>
          <button onClick={onClose} className="p-2 -m-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <Input label="Client name *" value={f.clientName} onChange={(v) => set("clientName", v)} autoFocus />
          <Input label="Client contact (phone / email)" value={f.contact} onChange={(v) => set("contact", v)} />
          <Input label="Address" value={f.address} onChange={(v) => set("address", v)} />
          <Input label="Internal PO number" value={f.po} onChange={(v) => set("po", v)} />
          <Input label="Product / carpet" value={f.product} onChange={(v) => set("product", v)} />
          <Input label="Consultant" value={f.consultant} onChange={(v) => set("consultant", v)} />
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Installation team</label>
            <select value={f.team} onChange={(e) => set("team", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="">Unassigned</option>
              {TEAMS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 mb-1 block">Order date</label>
              <input type="date" value={f.orderDate} onChange={(e) => set("orderDate", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Material ETA</label>
              <input type="date" value={f.materialEta} onChange={(e) => set("materialEta", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
          </div>
        </div>
        <button onClick={submit} disabled={!f.clientName.trim()}
          className="w-full mt-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">Create project</button>
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
      <p className="text-sm text-slate-400 mb-4">{hasAny ? "Try clearing the search or filter." : canCreate ? "Add your first installation to get started." : "Enter the developer PIN to add projects."}</p>
      {canCreate && !hasAny && (
        <button onClick={onCreate} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium"><Plus size={16} /> New Project</button>
      )}
    </div>
  );
}


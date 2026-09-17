import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, ClipboardList, Truck, CalendarDays, CheckCircle2, FileText, Plus, Bell, Search,
  ChevronRight, ChevronLeft, X, LogOut, Blinds, PanelsTopLeft, Layers, Trees,
  Rows3, Upload, Trash2, Printer, Image as ImageIcon, MapPin, Phone, Hash, User, Clock, Calendar
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

const DEPARTMENTS = [
  { id: "blinds", label: "Blinds", icon: Blinds, from: "#3b4a63", to: "#1c2536" },
  { id: "shutters", label: "Shutters", icon: PanelsTopLeft, from: "#5a5f6b", to: "#252a34" },
  { id: "carpets", label: "Carpets", icon: Rows3, from: "#6b5d52", to: "#2a2420" },
  { id: "vinyl", label: "Vinyl", icon: Layers, from: "#7a6a4f", to: "#2c261c" },
  { id: "wood", label: "Wood", icon: Trees, from: "#8a5a34", to: "#2e1e12" },
];
const deptOf = (id) => DEPARTMENTS.find((d) => d.id === id) || DEPARTMENTS[0];

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
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

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
  const [view, setView] = useState("home"); // home | placed | received | booked | completed | reports | dept:<id>
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
  const mine = (list) => (level === 1 ? list.filter((p) => p.consultant === user.name) : list);
  const q = search.trim().toLowerCase();
  const matches = (p) => !q || [p.clientName, p.po, p.address, p.productType, p.consultant, p.contact].some((v) => (v || "").toLowerCase().includes(q));

  const lists = useMemo(() => ({
    placed: mine(active.filter((p) => p.status === "ordered")).sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9")),
    received: mine(active.filter((p) => p.status === "received")).sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9")),
    booked: active.filter((p) => p.status === "booked").sort((a, b) => (a.installDate || "").localeCompare(b.installDate || "")),
    completed: active.filter((p) => p.status === "installed").sort((a, b) => (b.installedAt || "").localeCompare(a.installedAt || "")),
  }), [active, level, user]);

  if (!user) return <Login onLogin={setUser} />;

  const nav = [
    { id: "home", label: "Home", icon: Home },
    { id: "placed", label: "Placed orders", icon: ClipboardList, count: lists.placed.length },
    { id: "received", label: "Received orders", icon: Truck, count: lists.received.length },
    { id: "booked", label: "Booked orders", icon: CalendarDays, count: lists.booked.length },
    { id: "completed", label: "Completed orders", icon: CheckCircle2, count: lists.completed.length },
    ...(isCoord ? [{ id: "reports", label: "Reports", icon: FileText }] : []),
  ];

  const logout = () => { sessionStorage.removeItem("nolans_user"); setUser(null); setView("home"); };

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col print:bg-white print:text-black">
      {/* Top bar */}
      <header className="print:hidden h-16 flex items-center gap-4 px-5 border-b border-[#30363d] bg-[#0d1117]">
        <button onClick={() => setView("home")} className="shrink-0"><Logo /></button>
        <div className="flex-1 max-w-2xl mx-auto relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders, clients or PO numbers"
            className={`${inputCls} pl-9 rounded-full bg-[#161b22]`}
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isCoord && (
            <button onClick={() => setShowCreate(true)} className={`${btnPrimary} flex items-center gap-1.5`}>
              <Plus size={16} /> New project
            </button>
          )}
          <button className="relative p-2 rounded-lg hover:bg-[#161b22] text-slate-300" title="Notifications (coming in phase 2)">
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
                  {n.count != null && <span className="text-xs text-slate-400">{n.count}</span>}
                </button>
              );
            })}
          </nav>
          <div className="mt-6 pt-4 border-t border-[#30363d]">
            <div className="text-[11px] text-slate-500 px-3 mb-1">Departments</div>
            {DEPARTMENTS.map((d) => (
              <button
                key={d.id} onClick={() => setView(`dept:${d.id}`)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${view === `dept:${d.id}` ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#161b22]"}`}
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
            <HomeView user={user} lists={lists} setView={setView} />
          ) : view === "reports" ? (
            <ReportsView projects={active} />
          ) : view.startsWith("dept:") ? (
            <CalendarView
              dept={deptOf(view.slice(5))} projects={active.filter((p) => p.department === view.slice(5))}
              isCoord={isCoord} user={user} save={save} onOpen={setSelected}
            />
          ) : (
            <ListView
              title={nav.find((n) => n.id === view)?.label} status={view}
              items={lists[view].filter(matches)} onOpen={setSelected} level={level}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {(showCreate || editing) && (
        <ProjectForm
          initial={editing} user={user}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSave={async (p) => { await save(p, editing ? "Project updated" : "Project created"); setShowCreate(false); setEditing(null); if (editing) setSelected(p); }}
        />
      )}
      {selected && (
        <ProjectDetail
          project={projects.find((p) => p.id === selected.id) || selected}
          user={user} isCoord={isCoord} isDev={isDev} save={save}
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
   HOME DASHBOARD
   ========================================================= */
function HomeView({ user, lists, setView }) {
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
              key={d.id} onClick={() => setView(`dept:${d.id}`)}
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
              <button key={p.id} onClick={() => onOpen(p)} className="w-full text-left bg-[#0d1117] hover:bg-[#12181f] border border-[#30363d] rounded-xl p-4 grid grid-cols-12 gap-3 items-center">
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
                  <span className="truncate">PO {p.po} · {p.consultant}</span>
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
function ProjectForm({ initial, user, onClose, onSave }) {
  const [f, setF] = useState(() => initial || {
    clientName: "", contact: "", address: "", po: "", consultant: CONSULTANTS[0], department: "blinds",
    productType: "", materialEta: todayIso(), installDays: 1, jobCards: [],
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const fileRef = useRef();

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
    const p = initial
      ? { ...f, installDays: Number(f.installDays) || 1 }
      : { ...f, id: uid(), createdAt: now, createdBy: user.name, status: "ordered", received: false, installed: false, installDays: Number(f.installDays) || 1,
          log: [{ id: uid(), text: "Project created", author: user.name, createdAt: now }] };
    // keep calendar end date in sync if the duration changed on an already-booked job
    if (p.installDate) p.installEndDate = installEnd(p.installDate, p.installDays);
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
          <select className={inputCls} value={f.department} onChange={(e) => set("department", e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Product type"><input className={inputCls} value={f.productType} onChange={(e) => set("productType", e.target.value)} placeholder="e.g. Roller blinds, Belgotex Loft" /></Field>
        <Field label="Material ETA"><input type="date" className={inputCls} value={f.materialEta} onChange={(e) => set("materialEta", e.target.value)} /></Field>
        <Field label="Estimated install duration (working days)"><input type="number" min="1" max="30" className={inputCls} value={f.installDays} onChange={(e) => set("installDays", e.target.value)} /></Field>
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
function ProjectDetail({ project: p, user, isCoord, isDev, save, onClose, onEdit }) {
  const d = deptOf(p.department);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const now = () => new Date().toISOString();
  const log = (text) => [...(p.log || []), { id: uid(), text, author: user.name, createdAt: now() }];

  const markReceived = () => save({ ...p, status: "received", received: true, receivedAt: now(), log: log("Material received") }, "Marked as received");
  const undoReceived = () => save({ ...p, status: "ordered", received: false, receivedAt: null, log: log("Received undone") }, "Moved back to placed");
  const markInstalled = () => save({ ...p, status: "installed", installed: true, installedAt: now(), log: log("Installation completed") }, "Marked as completed");
  const undoInstalled = () => save({ ...p, status: "booked", installed: false, installedAt: null, log: log("Completion undone") }, "Moved back to booked");
  const unbook = () => save({ ...p, status: "received", installDate: null, installEndDate: null, installTime: null, log: log("Booking removed") }, "Booking removed");
  const del = () => save({ ...p, deleted: true, deletedAt: now(), deletedBy: user.name, deleteReason: reason, log: log(`Deleted: ${reason}`) }, "Project deleted");

  const Row = ({ icon: I, label, value }) => (
    <div className="flex items-start gap-3 py-2">
      <I size={16} className="text-slate-500 mt-0.5 shrink-0" />
      <div className="min-w-0"><div className="text-xs text-slate-500">{label}</div><div className="text-sm text-slate-100 break-words">{value || "—"}</div></div>
    </div>
  );

  return (
    <Modal title={p.clientName} onClose={onClose} wide>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge status={p.status} />
        <span className="text-xs text-slate-400 flex items-center gap-1"><d.icon size={14} /> {d.label}</span>
        <span className="text-xs text-slate-400">· {p.consultant}</span>
        {p.received && p.status === "received" && <RBadge />}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <Row icon={Phone} label="Contact" value={p.contact} />
        <Row icon={Hash} label="Purchase order" value={p.po} />
        <div className="md:col-span-2"><Row icon={MapPin} label="Address" value={p.address} /></div>
        <Row icon={Layers} label="Product type" value={p.productType} />
        <Row icon={Truck} label="Material ETA" value={fmt(p.materialEta)} />
        <Row icon={Clock} label="Install duration" value={`${p.installDays || 1} working day${(p.installDays || 1) > 1 ? "s" : ""}`} />
        {p.installDate && (
          <Row icon={CalendarDays} label="Installation" value={`${fmt(p.installDate)}${p.installEndDate !== p.installDate ? ` → ${fmt(p.installEndDate)}` : ""} at ${p.installTime}`} />
        )}
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
          {p.status === "ordered" && <button onClick={markReceived} className={btnPrimary}>Mark as received</button>}
          {p.status === "received" && <button onClick={undoReceived} className={btnGhost}>Undo received</button>}
          {p.status === "booked" && <button onClick={markInstalled} className={btnPrimary}>Mark as completed</button>}
          {p.status === "booked" && <button onClick={unbook} className={btnGhost}>Remove booking</button>}
          {p.status === "installed" && <button onClick={undoInstalled} className={btnGhost}>Undo completion</button>}
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
          <img src={lightbox} alt="Job card" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </Modal>
  );
}

/* =========================================================
   DEPARTMENT CALENDAR
   ========================================================= */
function Sticker({ p, draggable, onDragStart, onClick, variant, dayTag }) {
  const cls =
    variant === "installed" ? "bg-emerald-700/70 border-emerald-500/60 text-white" :
    variant === "booked" ? "bg-emerald-400/25 border-emerald-400/50 text-emerald-50" :
    "bg-slate-300/15 border-slate-400/30 text-slate-200";
  return (
    <div
      draggable={draggable} onDragStart={onDragStart} onClick={onClick}
      className={`border rounded-lg px-2 py-1.5 text-xs leading-tight select-none ${cls} ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${!draggable && variant !== "booked" && variant !== "installed" ? "opacity-80" : ""}`}
      title={`${p.clientName} · PO ${p.po} · ${p.productType || ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-semibold truncate flex-1">{p.clientName}</span>
        {p.status === "received" && <RBadge />}
      </div>
      <div className="flex items-center justify-between gap-2 opacity-80 mt-0.5">
        <span className="truncate">{p.consultant}</span>
        {p.installTime && !dayTag && <span>{p.installTime}</span>}
        {dayTag && <span>{dayTag}</span>}
        {!p.installTime && p.materialEta && p.status === "ordered" && <span>ETA {fmtShort(p.materialEta)}</span>}
      </div>
    </div>
  );
}

function CalendarView({ dept, projects, isCoord, user, save, onOpen }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [booking, setBooking] = useState(null); // { project, date, reschedule }
  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef(null);

  const ordered = projects.filter((p) => p.status === "ordered").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9"));
  const received = projects.filter((p) => p.status === "received").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9"));
  const onCal = projects.filter((p) => p.status === "booked" || p.status === "installed");

  // map date → [{p, dayIndex, total}]
  const byDay = useMemo(() => {
    const m = {};
    onCal.forEach((p) => {
      if (!p.installDate) return;
      const days = spanDays(p.installDate, p.installEndDate || p.installDate).filter((d) => !isWeekend(d) || d === p.installDate);
      days.forEach((d, i) => { (m[d] = m[d] || []).push({ p, i, n: days.length }); });
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.p.installTime || "").localeCompare(b.p.installTime || "")));
    return m;
  }, [onCal]);

  // grid cells
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - lead);
    const out = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); out.push(d); }
    if (out[35].getMonth() !== month.getMonth()) out.length = 35;
    return out;
  }, [month]);

  const startDrag = (p) => (e) => { dragRef.current = p; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); };
  const dropOn = (dateIso) => (e) => {
    e.preventDefault(); setDragOver(null);
    const p = dragRef.current; dragRef.current = null;
    if (!p || !isCoord) return;
    if (p.status === "received") setBooking({ project: p, date: dateIso, reschedule: false });
    else if (p.status === "booked" && p.installDate !== dateIso) setBooking({ project: p, date: dateIso, reschedule: true });
  };

  const confirmBooking = ({ time, days }) => {
    const { project: p, date, reschedule } = booking;
    const end = installEnd(date, days);
    const text = reschedule ? `Rescheduled to ${fmt(date)} at ${time}` : `Booked for ${fmt(date)} at ${time}`;
    save({ ...p, status: "booked", installDate: date, installEndDate: end, installTime: time, installDays: days,
      log: [...(p.log || []), { id: uid(), text, author: user.name, createdAt: new Date().toISOString() }] }, reschedule ? "Installation moved" : "Installation booked");
    setBooking(null);
  };

  const monthLabel = month.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const today = todayIso();

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left tray: ordered, by ETA */}
      <aside className="w-56 shrink-0 bg-[#161b22] border border-[#30363d] rounded-2xl p-3 flex flex-col">
        <div className="text-sm font-semibold text-white mb-0.5">Awaiting material</div>
        <div className="text-[11px] text-slate-500 mb-3">In ETA order · {ordered.length}</div>
        <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
          {ordered.length === 0 && <div className="text-xs text-slate-500">No outstanding orders.</div>}
          {ordered.map((p) => <Sticker key={p.id} p={p} draggable={false} onClick={() => onOpen(p)} variant="ordered" />)}
        </div>
        {isCoord && ordered.length > 0 && <div className="text-[11px] text-slate-500 mt-3">Open a sticker and mark it received to move it up.</div>}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <dept.icon size={22} className="text-slate-300" />
            <h1 className="text-2xl font-bold text-white">{dept.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-[#161b22]"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium w-40 text-center">{monthLabel}</span>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-[#161b22]"><ChevronRight size={18} /></button>
            <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} className={`${btnGhost} py-1.5`}>Today</button>
          </div>
        </div>

        {/* Top tray: received, ready to book */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-white">Received — ready to book</span>
            <RBadge />
            <span className="text-[11px] text-slate-500">{isCoord ? "Drag a sticker onto a date" : "Co-ordinator books these"} · {received.length}</span>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[38px]">
            {received.length === 0 && <div className="text-xs text-slate-500 self-center">Nothing waiting to be booked.</div>}
            {received.map((p) => (
              <div key={p.id} className="w-44">
                <Sticker p={p} draggable={isCoord} onDragStart={startDrag(p)} onClick={() => onOpen(p)} variant="received" />
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
                  {items.map(({ p, i, n }) => (
                    <Sticker
                      key={p.id} p={p} variant={p.status}
                      draggable={isCoord && p.status === "booked" && i === 0}
                      onDragStart={startDrag(p)} onClick={() => onOpen(p)}
                      dayTag={n > 1 ? `Day ${i + 1}/${n}${i === 0 && p.installTime ? ` · ${p.installTime}` : ""}` : null}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300/15 border border-slate-400/30" /> Placed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300/15 border border-slate-400/30" /><RBadge /> Received</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400/25 border border-emerald-400/50" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-700/70 border border-emerald-500/60" /> Completed</span>
          </div>
        </div>
      </div>

      {booking && <BookingModal booking={booking} onClose={() => setBooking(null)} onConfirm={confirmBooking} />}
    </div>
  );
}

function BookingModal({ booking, onClose, onConfirm }) {
  const { project: p, date, reschedule } = booking;
  const [time, setTime] = useState(p.installTime || "08:00");
  const [days, setDays] = useState(p.installDays || 1);
  const end = installEnd(date, Number(days) || 1);
  const weekend = isWeekend(date);
  return (
    <Modal title={reschedule ? "Move installation" : "Book installation"} onClose={onClose}>
      <div className="text-sm text-slate-300 mb-4">
        <span className="font-semibold text-white">{p.clientName}</span> · PO {p.po}
        {reschedule && <div className="text-xs text-slate-400 mt-1">Currently {fmt(p.installDate)} at {p.installTime}</div>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date"><div className={`${inputCls} bg-[#21262d]`}>{fmt(date)}</div></Field>
        <Field label="Start time">
          <select className={inputCls} value={time} onChange={(e) => setTime(e.target.value)}>
            {TIMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Working days"><input type="number" min="1" max="30" className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Field label="Ends"><div className={`${inputCls} bg-[#21262d]`}>{fmt(end)}</div></Field>
      </div>
      {weekend && <p className="text-xs text-amber-300 mt-3">This is a weekend date.</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => onConfirm({ time, days: Math.max(1, Number(days) || 1) })} className={btnPrimary}>{reschedule ? "Move installation" : "Book installation"}</button>
      </div>
    </Modal>
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
  const jobs = projects
    .filter((p) => p.department === dept && (p.status === "booked" || p.status === "installed") && p.installDate)
    .filter((p) => p.installDate <= range[1] && (p.installEndDate || p.installDate) >= range[0])
    .sort((a, b) => (a.installDate + (a.installTime || "")).localeCompare(b.installDate + (b.installTime || "")));
  const d = deptOf(dept);
  const title = mode === "daily" ? `${d.label} — ${fmt(date)}` : `${d.label} — week of ${fmt(range[0])} to ${fmt(range[1])}`;

  return (
    <div>
      <div className="print:hidden bg-[#161b22] border border-[#30363d] rounded-2xl p-5 mb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Reports</h1>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="Department">
            <select className={inputCls} value={dept} onChange={(e) => setDept(e.target.value)}>
              {DEPARTMENTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Report">
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label={mode === "daily" ? "Date" : "Any date in the week"}><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <button onClick={() => window.print()} disabled={jobs.length === 0} className={`${btnPrimary} flex items-center justify-center gap-2`}><Printer size={16} /> Save as PDF</button>
        </div>
        <p className="text-xs text-slate-500 mt-3">Save as PDF opens the print dialog — choose "Save as PDF" as the printer, then share the file on WhatsApp.</p>
      </div>

      {/* Printable report */}
      <div className="report bg-white text-black rounded-2xl p-8 print:p-0 print:rounded-none">
        <div className="flex items-baseline justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="text-xs tracking-widest text-gray-600">NOLANS INSTALLATION SCHEDULE</div>
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          <div className="text-xs text-gray-600">{jobs.length} {jobs.length === 1 ? "installation" : "installations"}</div>
        </div>
        {jobs.length === 0 ? (
          <div className="text-gray-600 text-sm py-8 text-center">No installations booked for this period.</div>
        ) : jobs.map((p, idx) => (
          <div key={p.id} className={`report-job ${idx > 0 ? "mt-6 pt-6 border-t border-gray-300" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold">{p.clientName}</div>
                <div className="text-sm text-gray-800">{p.address}</div>
                <div className="text-sm text-gray-800">Contact: {p.contact || "—"}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold">{fmt(p.installDate)}{p.installEndDate !== p.installDate ? ` → ${fmt(p.installEndDate)}` : ""}</div>
                <div className="text-gray-800">Start {p.installTime}</div>
                <div className="text-gray-800">PO {p.po}</div>
                <div className="text-gray-600">{p.productType} · {p.consultant}</div>
              </div>
            </div>
            {(p.jobCards || []).length > 0 && (
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

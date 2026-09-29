import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, ClipboardList, Truck, CalendarDays, CheckCircle2, FileText, Plus, Bell, Search,
  ChevronRight, ChevronLeft, X, LogOut, Blinds, PanelsTopLeft, Layers, Trees,
  Rows3, Upload, Trash2, Printer, Image as ImageIcon, MapPin, Phone, Hash, User, Clock, Calendar,
  History, CalendarCheck, RotateCcw, ChevronDown, Flame, Flag, AlertTriangle, ClipboardCheck, TrendingUp, Lock, MessageSquarePlus, Gauge, Send, Check, Menu, MoreVertical, Wrench, Sparkles, PackageOpen, Crown, Trophy, Star, ShieldCheck, Boxes, Tag, Pencil
} from "lucide-react";

/* =========================================================
   CONFIG — copy these two values from your old App.jsx
   ========================================================= */
const SUPABASE_URL = "https://fyuwslsfbdwtgnmgvbmm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5dXdzbHNmYmR3dGdubWd2Ym1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mzg5NDgsImV4cCI6MjEwNDAxNDk0OH0._ilgWkOoEz3F1OE4JTHzk7mHH6z7QEgfBbzYJOg_W2M";
const TABLE = "projects_v2"; // new table so old tracker data stays untouched

// Phase 13 — live PINs. Keys MUST stay quoted strings: "0005" as a number would become 5 and never match.
// `was` lists retired PINs. They can NOT sign in; they only keep a person's existing notes, read-notification
// marks and review flags linked to them after the PIN change.
const USERS = {
  "3847": { name: "Jaco", level: 1, was: ["0001"] },
  "2961": { name: "James", level: 1, was: ["0002"] },
  "7234": { name: "Trent", level: 1, was: ["0003"] },
  "4518": { name: "Theo", level: 1, was: ["0004"] },
  "0005": { name: "Franco", level: 2, depts: null, bookAny: true, perfReports: true, canSeeNotes: true, canSeeReviews: true }, // app partner — full access, all departments, sees everyone's feedback notes
  "8073": { name: "Marco", level: 2, depts: null, was: ["0006"] },   // owner — all departments (Performance Report locked: Beta card)
  "6325": { name: "Luciano", level: 2, depts: null, was: ["0007"] }, // owner — all departments, manages Wood (Performance Report locked: Beta card)
  "1492": { name: "Alton", level: 2, depts: ["vinyl"], was: ["0008"] },
  "9057": { name: "Chanel", level: 2, depts: ["blinds"], was: ["0009"] },
  "2233": { name: "Developer", level: 3, was: ["2222"] },
};
// Every PIN a signed-in user's existing data may be stored under (current first, then retired ones)
const pinsOf = (user) => (user && user.pin ? [String(user.pin), ...((USERS[String(user.pin)] || {}).was || [])] : []);
// Phase 10.2 — Marco, Luciano and Office can also be picked as the consultant on a job (all departments)
const CONSULTANTS = ["Jaco", "James", "Trent", "Theo", "Marco", "Luciano", "Office"];

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

// Teams are stored on jobs as "Team 1" / "Team 2" (so older jobs keep working); Calore uses the Shutters team
const TEAMS = { blinds: ["Team 1", "Team 2"], shutters: ["Team 1"], calore: ["Team 1"], carpets: ["Team 1"], vinyl: ["Team 1", "Team 2"], wood: ["Team 1", "Team 2"] };
const teamsOf = (dept) => TEAMS[dept] || ["Team 1"];
// Phase 12A — real team names, shown everywhere a team appears. Vinyl Team 2 (Alton) is formed from Desmond's crew when needed.
const TEAM_NAMES = {
  blinds: { "Team 1": "Navin", "Team 2": "Henro" },
  shutters: { "Team 1": "Joey" },
  calore: { "Team 1": "Joey" },
  carpets: { "Team 1": "Darren" },
  vinyl: { "Team 1": "Desmond", "Team 2": "Alton" },
  wood: { "Team 1": "Jacques", "Team 2": "Aiden" },
};
const teamLabel = (dept, team) => (team ? ((TEAM_NAMES[dept] || {})[team] || team) : "");

// Phase 5 — product catalogue: Department -> Category -> Supplier -> Range
const PRODUCT_CATALOG = {
  "Carpets": {
    "Belgotex": ["Arabica", "Conqueror", "Textured", "Aqua", "Softology Light", "Softology", "Softology Ultra", "Sensology Aural", "Serengeti", "Sensology Lush", "Westminster", "Baltimore", "Sensology Tactual", "Influence", "Inclusive", "Coexist", "CO-Create", "Merino", "Grace", "Latte", "Mood", "Longevity - Grandeur", "Longevity - Serenity", "Immerse", "Fliptile", "Mindful", "Attuned", "Perpetual", "City Life", "Rustic Grain", "Panthera", "Highlands", "Color Rib (Needlepunch)", "Garage Carpet (Needlepunch)", "Hercules (Needlepunch)", "Berber Point 650 (Needlepunch)", "Berber Point 920 (Needlepunch)", "Timbavati (Needlepunch)", "Color Rib (Resinbac)", "Hercules (Resinbac)", "Berber Point 650 (Resinbac)", "Berber Point 920 (Resinbac)", "Metro (Resinbac)", "Main Street (Resinbac)", "Diagonals (Resinbac)", "Berber Point 920 (Nexbac)", "Sportec Rubber Flooring", "Turf"],
    "Nouwens": ["Berber Look", "Rustique", "Copenhagen", "Kirman", "Natural Flair", "Attitude", "Entertainer", "Icon", "Creations", "Harbour"],
    "Floornet": ["Carlton", "Manhattan Xtreme", "Prestige", "Imago", "Stockholm", "Palermo", "Etosha", "Islay", "Sorrento", "Saturnus", "Taurus", "Lewis", "Amber", "Ultimate Twist", "ART Fusion", "Passion", "Alexandria", "Nature", "Chambord", "Luxor", "Romeo", "Pinning Board", "Powerpoint", "Dirt Off", "Florpoint"],
    "Synsport": ["Turf"],
    "Fotakis": ["Novillon"],
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
  // Phase 10.3 — installed by the Vinyl team, on the Vinyl calendar
  "Louvre Roofs & Carports": {
    "Hunter Douglas": ["Adjustable Louvre Roof"],
    "AWA": ["Carport Recovery"],
  },
  // Phase 10.3 — Blinds department (awnings and screens are installed by the Blinds team)
  "Blinds & Awnings": {
    "Luxaflex": ["Roller Blinds", "25mm Alu Venetian Blinds", "50mm Alu Venetian Blinds", "50mm FormWood Venetian Blinds", "50mm Wood Venetian Blinds", "25mm Duette Blinds", "32mm Duette Blinds", "Twist Roller Blind", "Ambience Shade", "Drop Blind"],
    "Blindsquip": ["Roller Blinds", "25mm Alu Venetian Blinds", "50mm Alu Venetian Blinds", "50mm FormWood Venetian Blinds", "50mm Wood Venetian Blinds", "Twist Roller Blind"],
    "Bali Blinds": ["Bamboo Blinds"],
    "Blinds Factory": ["Roller Blinds", "25mm Alu Venetian Blinds", "50mm Alu Venetian Blinds", "50mm FormWood Venetian Blinds", "50mm Wood Venetian Blinds", "Twist Roller Blind", "Vertical Blinds", "Drop Blinds"],
    "Wonderblinds": ["Drop Blind", "Pergola Awning", "Fold Arm Awning"],
    "AC Screens": ["Drop Blind", "Fold-Arm Awning", "Roller Shutter"],
  },
  // Phase 10.3 — Shutters department; range codes updated Phase 15 (Shutter Boards): Blockhouse does
  // aluminium and fixed louvre only (B1 security, B2 non-security, FL fixed louvre); Plantation does
  // aluminium and timber (A1/A2/A3 aluminium tiers, T1/T2 timber tiers)
  "Shutters & Screens": {
    "Blockhouse": ["B1", "B2", "FL"],
    "Plantation": ["A1", "A2", "A3", "T1", "T2"],
    "Mediterranean": ["Shoji Screens"],
    "Corner Star": ["Flyscreens", "Secure Screens"],
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

// Phase 14 — Wood catalogue. Structure differs from the Category->Supplier->Range pattern above:
// here it's Supplier -> Finish type (Pre-finished/Unfinished/Patterns) -> Range, because a range's
// finish type varies by supplier and Jaco wants supplier picked first. Each range lists its available
// plank sizes (shown as a size sub-dropdown when there's more than one) and flags whether colour applies
// (an Unfinished board, or an unfinished pattern shape) — though the colour box itself is already shown
// for every product line app-wide, so needsColour is kept for future use rather than gating the field.
const WOOD_CATALOG = {
  "Oggie": {
    "Pre-finished": [
      { name: "Livello Extra Rustic Brushed Whitemist", sizes: ["14/3x148x1860mm", "14/3x190x1900mm", "15/4x260x2200mm"] },
      { name: "Ona Rustic, Natural", sizes: ["14/3x190x1900mm"] },
      { name: "Ona Rustic, Greymist", sizes: ["14/3x190x1900mm"] },
      { name: "Ona Rustic, Greymist XL", sizes: ["15/4x260x2200mm"] },
      { name: "Ona Living, Wirebrushed Danish White", sizes: ["14/3x190x1900mm"] },
      { name: "Ona Living, Wirebrushed Greymist", sizes: ["14/3x190x1900mm"] },
      { name: "Oliato Living, Wirebrushed Greymist", sizes: ["15/4x260x2200mm"] },
      { name: "Oliato Living, Wirebrushed Danish White", sizes: ["15/4x260x2200mm"] },
      { name: "Lusso Weathered Natural", sizes: ["2200x260x15/4mm"] },
      { name: "Lusso Weathered Brazil Brown", sizes: ["2200x260x15/4mm"] },
      { name: "Lusso Weathered Puro Grey", sizes: ["2200x260x15/4mm"] },
      { name: "Lusso Weathered White", sizes: ["2200x260x15/4mm"] },
      { name: "Lusso Weathered Walnut", sizes: ["2200x260x15/4mm"] },
      { name: "Cerato Hand Chiselled, Greymist", sizes: ["15/4x260x2200mm", "20/6x260x2200mm"] },
      { name: "Cerato Hand Chiselled, Danish White", sizes: ["20/6x260x2200mm"] },
      { name: "Cerato Hand Chiselled, Mink Grey", sizes: ["20/6x260x2200mm"] },
      { name: "Cerato Hand Chiselled, Dove Grey", sizes: ["20/6x260x2200mm"] },
      { name: "American Walnut Rustic", sizes: ["15/4x220x2200mm", "20/6x220x2200mm"] },
      { name: "Herringbone Rustic Greymist", sizes: ["14/3x122x610mm", "15/4x122x610mm"] },
      { name: "Herringbone American Walnut Rustic", sizes: ["15/4x125x600mm"] },
    ],
    "Unfinished": [
      { name: "Crudo Living", sizes: ["15/3x190x1900mm", "15/4x190x1900mm", "15/4x260x2200mm"], needsColour: true },
      { name: "Crudo Rustic", sizes: ["15/3x190x1900mm", "15/4x190x1900mm", "15/4x260x2200mm"], needsColour: true },
      { name: "Grande Rustic", sizes: ["15/4x305x2550mm", "20/6x400x2550mm", "20/6x400x5000mm"], needsColour: true },
      { name: "Ande Irregular Aged Handscraped", sizes: ["20/6x220x2200mm"], needsColour: true },
    ],
    "Patterns": [
      { name: "Herringbone Rustic Greymist", sizes: ["14/3x122x610mm", "15/4x122x610mm"] },
      { name: "Herringbone American Walnut Rustic", sizes: ["15/4x125x600mm"] },
      { name: "Herringbone Living", sizes: ["15/3x122x610mm", "15/4x122x610mm"], needsColour: true },
      { name: "Chevron Living", sizes: ["15/4x90x510mm"], needsColour: true },
      { name: "Versailles Living", sizes: ["15/4x900x900mm"], needsColour: true },
      { name: "Braid Living", sizes: ["15/4x190x285mm"], needsColour: true },
      { name: "Biscuit Living", sizes: ["15/4x90x600mm"], needsColour: true },
      { name: "Palm Living", sizes: ["15/4x135x600mm"], needsColour: true },
      { name: "Modello Wave Living", sizes: ["15/4x90x600mm"], needsColour: true },
      { name: "Modello Pearl Living", sizes: ["15/4x90x600mm"], needsColour: true },
      { name: "Modello Scallop Living", sizes: ["15/4x90x600mm"], needsColour: true },
      { name: "Casa Living", sizes: ["15/4x180x243mm"], needsColour: true },
      { name: "Fiore Living", sizes: ["15/4x189x328mm"], needsColour: true },
    ],
  },
};
const woodSuppliers = () => Object.keys(WOOD_CATALOG);
const woodFinishes = (sup) => Object.keys(WOOD_CATALOG[sup] || {});
const woodRanges = (sup, finish) => ((WOOD_CATALOG[sup] || {})[finish] || []);
const woodRangeObj = (sup, finish, name) => woodRanges(sup, finish).find((r) => r.name === name);

// Phase 15 — Calore catalogue. Supplier -> Type -> Unit type, then a free-text model name (models change
// too often to keep as a fixed list) and a free-text serial number for internal records only (never part
// of the composed product label, so it never shows on stickers, search or reports). A "client's own
// fireplace" toggle skips the whole cascade for jobs installing a unit the client already owns.
const CALORE_CATALOG = {
  "Calore": {
    "Wood": ["Free-Standing", "Built-In"],
    "Pellet": ["Free-Standing", "Built-In"],
    "Gas": ["Free-Standing", "Built-In"],
  },
};
const caloreSuppliers = () => Object.keys(CALORE_CATALOG);
const caloreTypes = (sup) => Object.keys(CALORE_CATALOG[sup] || {});
const caloreUnitTypes = (sup, type) => ((CALORE_CATALOG[sup] || {})[type] || []);

// Which catalogue categories each department may pick from. Departments not listed
// keep the old free-text product field until their product lists are loaded.
const DEPT_CATEGORIES = {
  carpets: ["Carpets"],
  vinyl: ["Glue Down Vinyl", "Click Vinyl", "Laminates", "Louvre Roofs & Carports"],
  blinds: ["Blinds & Awnings"],
  shutters: ["Shutters & Screens"],
};
// Phase 10.3 — how each department measures a product line
//   area    : m² typed in (Vinyl)
//   roll    : roll width × linear metres = m², or m² typed in when no roll width is picked (Carpets)
//   qty     : free-text quantity, e.g. "3 blinds" (Blinds)
//   panels  : number of references and number of panels (Shutters)
// Phase 15 — Calore takes no area/colour/qty measurement at all ("none"); its own line fields
// (type, unit type, model, serial) are handled separately in the form and aren't part of this map.
const MEASURE_OF = { carpets: "roll", vinyl: "area", blinds: "qty", shutters: "panels", calore: "none" };
const measureOf = (dept) => MEASURE_OF[dept] || "area";
const ROLL_WIDTHS = ["2", "3.66", "4"];
const rollLabel = (w) => `${Number(w).toFixed(w === "3.66" ? 2 : 1)} m`;
const rollArea = (w, lm) => { const a = Number(w) * Number(lm); return a > 0 ? Math.round(a * 100) / 100 : ""; };
// Short text for a line's measurement, used on job details, stickers and search
const measureText = (l, dept) => {
  const m = measureOf(dept);
  if (m === "none") return "";
  if (m === "qty") return (l.qty || "").toString().trim();
  if (m === "panels") return [l.refs ? `${l.refs} ref${Number(l.refs) === 1 ? "" : "s"}` : "", l.panels ? `${l.panels} panel${Number(l.panels) === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
  const area = areaFmt(l.area);
  if (m === "roll" && l.rollWidth && l.linearM) return `${area} (${l.linearM} lm × ${rollLabel(l.rollWidth)})`;
  return area;
};
const categoriesOf = (dept) => DEPT_CATEGORIES[dept] || [];
const hasCatalog = (dept) => categoriesOf(dept).length > 0 || dept === "wood" || dept === "calore"; // Phase 14/15 — Wood and Calore have their own catalogue shapes
const suppliersOf = (cat) => Object.keys(PRODUCT_CATALOG[cat] || {});
const rangesOf = (cat, sup) => ((PRODUCT_CATALOG[cat] || {})[sup] || []);
// The label written into productType so stickers, reports and search keep working unchanged
// Phase 9.2 — optional free-text colour is appended so stickers/search show it; reports group by supplier + range only
// Phase 17 — "Other" is a sentinel supplier value available in every catalogued department, for the
// occasional out-of-the-norm order. Picking it replaces the whole cascade below it (range/finish/type/
// model, and colour) with one free-text description; quantities/measurements still apply as normal.
// Reporting groups every Other line under one collective "Other" bucket (see rangeLabel) rather than by
// the typed text, so one-off suppliers don't fragment the stats.
const OTHER_SUPPLIER = "Other";
const composeProduct = (sup, rng, colour, size) => [sup, rng, size, (colour || "").trim()].filter(Boolean).join(" ");

// Phase 6 — multiple product lines per job (one per range/colour/room) for catalogued departments.
// A fresh, empty product line for a department (auto-picks the only category where there is just one).
const newLine = (dept) => { const cats = categoriesOf(dept); return { id: uid(), productCategory: cats.length === 1 ? cats[0] : "", supplier: "", finish: "", boardSize: "", productRange: "", productType: "", colour: "", area: "", rollWidth: "", linearM: "", qty: "", refs: "", panels: "", ownFireplace: false, calType: "", calUnitType: "", model: "", serial: "" }; };
// All product lines for a job. Falls back to a single synthesised line for older records that only
// stored the top-level product fields, so nothing built before Phase 6 breaks.
const productLinesOf = (p) => {
  if (Array.isArray(p.productLines) && p.productLines.length) return p.productLines;
  if (hasCatalog(p.department) && (p.productRange || p.productType)) {
    return [{ id: (p.id || "") + "-pl0", productCategory: p.productCategory || "", supplier: p.supplier || "", productRange: p.productRange || "", productType: p.productType || "", colour: p.colour || "", area: p.area ?? "" }];
  }
  return [];
};
const areaFmt = (a) => { const n = Number(a); return (a === "" || a == null || isNaN(n)) ? "" : `${n} m²`; };
const totalArea = (p) => productLinesOf(p).reduce((sum, l) => sum + (Number(l.area) || 0), 0);
// Phase 10.3 — one-line size of the whole job in the department's own unit (m², refs/panels or quantities)
const jobMeasureText = (p) => {
  const m = measureOf(p.department);
  const lines = productLinesOf(p);
  if (m === "none") return "";
  if (m === "panels") {
    const r = lines.reduce((n, l) => n + (Number(l.refs) || 0), 0), pn = lines.reduce((n, l) => n + (Number(l.panels) || 0), 0);
    return [r ? `${r} ref${r === 1 ? "" : "s"}` : "", pn ? `${pn} panel${pn === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
  }
  if (m === "qty") return lines.map((l) => (l.qty || "").toString().trim()).filter(Boolean).join(", ");
  const a = totalArea(p); return a > 0 ? `${Math.round(a * 100) / 100} m²` : "";
};
// One string holding everything searchable on a job, including every product line and item.
const searchText = (p) => [
  p.clientName, p.po, p.address, p.productType, p.supplier, p.productRange, p.consultant, p.contact, teamLabel(p.department, p.team),
  ...productLinesOf(p).flatMap((l) => [l.supplier, l.productRange, l.productType, l.colour, l.qty, l.boardSize, l.calType, l.calUnitType, l.model, l.serial]),
  ...(p.lineItems || []).map((li) => li.description),
].filter(Boolean).join(" ").toLowerCase();

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

/* =========================================================
   SOUTH AFRICAN PUBLIC HOLIDAYS
   Fixed-date holidays + Easter (Good Friday & Family Day) computed per year.
   SA Public Holidays Act: a holiday falling on a Sunday moves to the Monday.
   Computed once per year and cached. Custom dates come from app settings.
   ========================================================= */
function easterSunday(year) {
  // Anonymous Gregorian ("Meeus/Jones/Butcher") algorithm
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
const _saHolidayCache = {};
function saHolidayMap(year) {
  if (_saHolidayCache[year]) return _saHolidayCache[year];
  const map = {};
  const put = (d, name) => { map[iso(d)] = name; };
  // Fixed-date public holidays
  const fixed = [
    [0, 1, "New Year's Day"],
    [2, 21, "Human Rights Day"],
    [3, 27, "Freedom Day"],
    [4, 1, "Workers' Day"],
    [5, 16, "Youth Day"],
    [7, 9, "National Women's Day"],
    [8, 24, "Heritage Day"],
    [11, 16, "Day of Reconciliation"],
    [11, 25, "Christmas Day"],
    [11, 26, "Day of Goodwill"],
  ];
  fixed.forEach(([mo, day, name]) => put(new Date(year, mo, day), name));
  // Easter-linked holidays
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const familyDay = new Date(easter); familyDay.setDate(easter.getDate() + 1);
  put(goodFriday, "Good Friday");
  put(familyDay, "Family Day");
  // Sunday -> observed on Monday (does not remove the Sunday itself)
  Object.entries({ ...map }).forEach(([dateIso, name]) => {
    if (fromIso(dateIso).getDay() === 0) put(fromIso(addDays(dateIso, 1)), `${name} (observed)`);
  });
  _saHolidayCache[year] = map;
  return map;
}
// name of the holiday on a given ISO date, or null. `custom` = [{date, name}] from settings.
const holidayName = (dateIso, custom = []) => {
  const c = custom.find((h) => h.date === dateIso);
  if (c) return c.name || "Company holiday";
  return saHolidayMap(fromIso(dateIso).getFullYear())[dateIso] || null;
};
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
  s ? (s === ETA_TBC ? ETA_TBC : fromIso(s).toLocaleDateString("en-ZA", opts)) : "";
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
const onCalendar = (p) => !p.invoiced && (p.status === "booked" || p.status === "installed" || isReserved(p));
// Received but some line items still outstanding
// Phase 11 — lines can also be flagged "partially received" with a note (e.g. "3 of 5 rolls in")
const hasPartialFlag = (p) => !!p.mainPartial || productLinesOf(p).some((l) => l.partial) || (p.lineItems || []).some((li) => li.partial);
const partiallyReceived = (p) => p.received && ((p.lineItems || []).some((li) => !li.received) || hasPartialFlag(p));
// Show the "!" badge while the job is still waiting to be installed
const showPartial = (p) => partiallyReceived(p) && (p.status === "received" || p.status === "booked");

/* Phase 11 — repairs and snag material */
const isRepair = (p) => !!(p && p.isRepair);
const RepairIcon = ({ small }) => (
  <span title="Repair" className={`inline-flex items-center justify-center rounded-full bg-sky-600 text-white shrink-0 ${small ? "w-4 h-4" : "w-5 h-5"}`}><Wrench size={small ? 9 : 11} strokeWidth={2.5} /></span>
);
// Snags flagged as needing material that nobody has confirmed as ordered yet
const snagMaterialPending = (p) => (p.snags || []).filter((s) => s.materialRequired && !s.materialOrdered);
// PO numbers on new jobs: exactly 6 digits, saved as "PL 123456"
const poDigits = (v) => (v || "").replace(/\D/g, "").slice(0, 6);
const formatPo = (digits) => `PL ${digits}`;

/* Phase 12A — overlocking (Carpets only). Stage: null = still to order, "ordered", "received" (flag cleared). */
const hasOverlock = (p) => !!(p && p.department === "carpets" && p.overlock);
const needsOverlock = (p) => hasOverlock(p) && p.overlockStage !== "received";
const overlockSizesOf = (p) => (p.overlockSizes || []).map((x) => (x || "").trim()).filter(Boolean);
const overlockStatusText = (p) => (p.overlockStage === "received" ? "received" : p.overlockStage === "ordered" ? "ordered, not yet received" : "to be ordered");

/* Phase 9.1 — ETA follow-up
   Overdue  = ETA date has passed and the order is still not received
   Due soon = ETA is today or within the next ETA_WARN_DAYS days, still not received */
const ETA_WARN_DAYS = 3;
// Phase 17 — a Material ETA can be "TBC" instead of a date, for orders where no date is known yet.
// Stored as this exact string in materialEta; fmt()/fmtShort() pass it straight through everywhere.
const ETA_TBC = "TBC";
const etaStateOf = (p) => {
  if (!p || p.status !== "ordered" || p.received || !p.materialEta || p.deleted || p.invoiced) return null;
  if (p.materialEta === ETA_TBC) return "tbc";
  const today = todayIso();
  if (p.materialEta < today) return "overdue";
  if (p.materialEta <= addDays(today, ETA_WARN_DAYS)) return "soon";
  return null;
};
const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / 86400000);
const etaLabel = (p) => {
  const st = etaStateOf(p); if (!st) return "";
  if (st === "tbc") return "ETA to be confirmed";
  const d = daysBetween(todayIso(), p.materialEta);
  if (st === "overdue") return `${-d} day${d === -1 ? "" : "s"} overdue`;
  return d === 0 ? "ETA today" : `ETA in ${d} day${d === 1 ? "" : "s"}`;
};
const EtaBadge = ({ p, small }) => {
  const st = etaStateOf(p); if (!st) return null;
  const cls = st === "overdue" ? "bg-red-600 text-white" : st === "tbc" ? "bg-slate-500 text-white" : "bg-amber-400 text-slate-900";
  return (
    <span title={etaLabel(p)} className={`shrink-0 font-bold rounded-full ${small ? "text-[9px] px-1 py-px" : "text-[10px] px-1.5 py-0.5"} ${cls}`}>
      {st === "overdue" ? "OVERDUE" : st === "tbc" ? "TBC" : "ETA SOON"}
    </span>
  );
};

/* =========================================================
   PHASE 10.2 — NOTIFICATION EVENTS
   Every save is compared with the job as it was, and each change below becomes one notification.
   ========================================================= */
const NOTIF_META = {
  received: { label: "Received", cls: "bg-emerald-500" },
  partial: { label: "Partial receipt", cls: "bg-amber-400" },
  snagMaterial: { label: "Snag material", cls: "bg-sky-400" },
  eta: { label: "ETA changed", cls: "bg-amber-400" },
  planned: { label: "Planned", cls: "bg-slate-300" },
  reserved: { label: "Reserved", cls: "bg-yellow-400" },
  booked: { label: "Booked", cls: "bg-green-500" },
  moved: { label: "Moved", cls: "bg-sky-400" },
  removed: { label: "Removed", cls: "bg-red-400" },
  completed: { label: "Completed", cls: "bg-teal-400" },
  invoiced: { label: "Invoiced", cls: "bg-slate-400" },
  snag: { label: "Snag logged", cls: "bg-red-500" },
  snagResolved: { label: "Snag resolved", cls: "bg-emerald-400" },
  overlockOrdered: { label: "Overlocking ordered", cls: "bg-amber-400" },
  overlockReceived: { label: "Overlocking received", cls: "bg-emerald-400" },
  other: { label: "Non-catalogue product", cls: "bg-orange-400" },
};
const schedKey = (p) => scheduleOf(p).map((d) => d.date).sort().join(",");
function diffEvents(prev, next) {
  const ev = [];
  if (!prev || !next || next.deleted) return ev;
  const add = (type, text) => ev.push({ type, text });
  if (!prev.received && next.received) add("received", "Main item received");
  const before = Object.fromEntries((prev.lineItems || []).map((l) => [l.id, l]));
  const newlyIn = (next.lineItems || []).filter((l) => l.received && !(before[l.id] && before[l.id].received));
  if (newlyIn.length) {
    const out = (next.lineItems || []).filter((l) => !l.received).length;
    add("partial", `${newlyIn.map((l) => l.description).join(", ")} received${out ? ` · ${out} item${out > 1 ? "s" : ""} still outstanding` : " · all items in"}`);
  }
  // Phase 11 — a line newly flagged as partially received
  const flagged = (x) => [
    ...(x.mainPartial ? [{ key: "main", label: x.productType || "Main item", note: x.mainPartialNote }] : []),
    ...productLinesOf(x).filter((l) => l.partial).map((l) => ({ key: "pl-" + l.id, label: l.productType || l.productRange || "Product", note: l.partialNote })),
    ...(x.lineItems || []).filter((l) => l.partial).map((l) => ({ key: "li-" + l.id, label: l.description, note: l.partialNote })),
  ];
  const wasFlagged = new Set(flagged(prev).map((f) => f.key));
  flagged(next).filter((f) => !wasFlagged.has(f.key)).forEach((f) => add("partial", `Partially received: ${f.label}${f.note ? ` (${f.note})` : ""}`));
  if (prev.materialEta && next.materialEta && prev.materialEta !== next.materialEta && !next.received) add("eta", `ETA changed from ${fmtShort(prev.materialEta)} to ${fmtShort(next.materialEta)}`);
  const ps = prev.reserveStage || null, ns = next.reserveStage || null;
  const wasOn = !!prev.installDate, isOn = !!next.installDate;
  if (!wasOn && isOn && ns === "planned") add("planned", `Planned for ${fmt(next.installDate)}`);
  if (ns === "reserved" && ps !== "reserved") add("reserved", `Reserved for ${fmt(next.installDate)}`);
  if (ps === "reserved" && ns === "planned") add("removed", `Reservation removed, still planned for ${fmt(next.installDate)}`);
  if (next.status === "booked" && (prev.status === "ordered" || prev.status === "received")) add("booked", `Booking confirmed for ${fmt(next.installDate)}`);
  if (wasOn && isOn && schedKey(prev) !== schedKey(next)) {
    add("moved", prev.installDate !== next.installDate
      ? `Install moved from ${fmtShort(prev.installDate)} to ${fmtShort(next.installDate)}`
      : `Install days changed (now ${fmtShort(next.installDate)}${next.installEndDate && next.installEndDate !== next.installDate ? ` to ${fmtShort(next.installEndDate)}` : ""})`);
  }
  if (wasOn && !isOn && next.status !== "installed") add("removed", prev.status === "booked" ? "Booking removed" : "Removed from calendar");
  if (next.status === "installed" && prev.status !== "installed") add("completed", "Installation completed");
  if (!prev.invoiced && next.invoiced) add("invoiced", "Invoiced and moved to History");
  // Phase 12A — overlocking
  if (hasOverlock(next) && prev.overlockStage !== "ordered" && next.overlockStage === "ordered") add("overlockOrdered", `Overlocking ordered${overlockSizesOf(next).length ? `: ${overlockSizesOf(next).join(", ")}` : ""}`);
  if (hasOverlock(next) && prev.overlockStage !== "received" && next.overlockStage === "received") add("overlockReceived", "Overlocking received");
  // Phase 17 — "Other" (non-catalogue) product used: notify so it can be checked whether that supplier's
  // range should be added to the catalogue. Fires once per line the first time it becomes an Other line.
  const otherBefore = new Set((prev.productLines || []).filter((l) => l.supplier === OTHER_SUPPLIER && l.productType).map((l) => l.id));
  (next.productLines || []).filter((l) => l.supplier === OTHER_SUPPLIER && l.productType && !otherBefore.has(l.id))
    .forEach((l) => add("other", `Non-catalogue product used: "${l.productType}"`));
  const prevSnags = Object.fromEntries((prev.snags || []).map((x) => [x.id, x]));
  (next.snags || []).forEach((sn) => {
    const old = prevSnags[sn.id];
    if (!old) add("snag", `Snag logged (${sn.category}): ${sn.description || ""}${sn.materialRequired ? " · material to be ordered" : ""}`.trim());
    else if (old.materialRequired && !old.materialOrdered && sn.materialOrdered) add("snagMaterial", `Snag material ordered${sn.materialNote ? `: ${sn.materialNote}` : ""}`);
    else if (!old.resolved && sn.resolved) add("snagResolved", `Snag resolved${sn.resolveReason ? `: ${sn.resolveReason}` : ""}`);
  });
  return ev;
}
const notifBase = (p) => ({ projectId: p.id, clientName: p.clientName || "", po: p.po || "", department: p.department, consultant: p.consultant || "", isTest: !!p.isTest });
// Backlog: rebuild the last week's events from each job's activity log (runs once, ids are fixed so it can't double up)
const LOG_RULES = [
  [/^Main item received/, "received"], [/: received$/, "partial"], [/^Planned for/, "planned"],
  [/^Reserved for/, "reserved"], [/^Reservation removed/, "removed"], [/^Booking confirmed/, "booked"],
  [/^Day \d+(\/\d+)? (moved|added|removed)/, "moved"], [/^Booking removed|^Removed from calendar/, "removed"],
  [/^Installation completed/, "completed"], [/^Invoiced/, "invoiced"], [/^Snag logged/, "snag"], [/^Snag resolved/, "snagResolved"],
  [/^Overlocking ordered/, "overlockOrdered"], [/^Overlocking received/, "overlockReceived"],
];
function backlogNotifs(projects, since, until) {
  const out = [];
  projects.forEach((p) => {
    if (p.deleted) return;
    (p.log || []).forEach((l) => {
      if (!l.createdAt || l.createdAt < since || l.createdAt >= until) return;
      const rule = LOG_RULES.find(([re]) => re.test(l.text || ""));
      if (!rule) return;
      out.push({ id: `${NOTIF_PREFIX}bk-${p.id}-${l.id}`, ...notifBase(p), type: rule[1], text: l.text, author: l.author || "", createdAt: l.createdAt, readBy: [], backlog: true });
    });
  });
  return out;
}
const ago = (isoTs) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(isoTs).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
};

/* =========================================================
   SUPABASE (REST, no client library needed)
   ========================================================= */
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};
const SETTINGS_ID = "__app_settings__"; // reserved row in projects_v2 for app-wide settings (holidays etc.)
async function dbLoad() {
  // Personal notes live in the same table under ids starting "note:" — they are never loaded as projects
  // Notifications live there too under "notif:" — also never loaded as projects
  // Phase 12C — installation reviews live there too under "review:" — never loaded as projects
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data&id=not.like.${encodeURIComponent(NOTE_PREFIX)}*&id=not.like.${encodeURIComponent(NOTIF_PREFIX)}*&id=not.like.${encodeURIComponent(REVIEW_PREFIX)}*&id=not.like.${encodeURIComponent(INV_PREFIX)}*`, { headers });
  if (!r.ok) throw new Error(`Load failed (${r.status})`);
  const rows = await r.json();
  return rows.filter((row) => row.id !== SETTINGS_ID && !String(row.id).startsWith(NOTE_PREFIX) && !String(row.id).startsWith(NOTIF_PREFIX) && !String(row.id).startsWith(REVIEW_PREFIX) && !String(row.id).startsWith(INV_PREFIX)).map((row) => ({ ...row.data, id: row.id }));
}

/* Phase 10.2 — notifications. One row per event (id "notif:<id>") so people acting at the same time
   never overwrite each other. Rows older than NOTIF_DAYS are removed on load. */
const NOTIF_PREFIX = "notif:";
const NOTIF_DAYS = 7;
const notifCutoff = () => new Date(Date.now() - NOTIF_DAYS * 86400000).toISOString();
async function dbLoadNotifs() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data&id=like.${encodeURIComponent(NOTIF_PREFIX)}*&data->>createdAt=gte.${encodeURIComponent(notifCutoff())}`, { headers });
  if (!r.ok) throw new Error(`Notifications load failed (${r.status})`);
  const rows = await r.json();
  return rows.map((row) => ({ ...row.data, id: row.id }));
}
async function dbSaveNotifs(list) {
  if (!list.length) return;
  const at = new Date().toISOString();
  const body = list.map((n) => ({ id: n.id, data: n, updated_at: at }));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Notification save failed (${r.status})`);
}
async function dbDeleteOldNotifs() {
  // Best effort: if it fails, old rows are still hidden because loading only asks for the last 7 days
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=like.${encodeURIComponent(NOTIF_PREFIX)}*&data->>createdAt=lt.${encodeURIComponent(notifCutoff())}`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } });
  } catch { /* ignore */ }
}
// Phase 9.1 — personal feedback notes. Each note is its own row (id "note:<uuid>") so two people
// posting at once can never overwrite each other. A user only ever loads their own notes; the Developer loads all.
const NOTE_PREFIX = "note:";
// Phase 11.2 — the Developer and anyone flagged canSeeNotes (Franco) see everyone's notes
const seesAllNotes = (user) => (user?.level ?? 0) >= 3 || !!user?.canSeeNotes;
const noteReaders = () => ["the developer", ...Object.values(USERS).filter((u) => u.canSeeNotes).map((u) => u.name)];
async function dbLoadNotes(user) {
  const isDevUser = seesAllNotes(user);
  const mineOnly = isDevUser ? "" : `&data->>pin=in.(${pinsOf(user).map((x) => encodeURIComponent(`"${x}"`)).join(",")})`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data&id=like.${encodeURIComponent(NOTE_PREFIX)}*${mineOnly}`, { headers });
  if (!r.ok) throw new Error(`Notes load failed (${r.status})`);
  const rows = await r.json();
  return rows.map((row) => ({ ...row.data, id: row.id })).filter((n) => !n.deleted);
}
async function dbSaveNote(note) {
  const body = [{ id: note.id, data: note, updated_at: new Date().toISOString() }];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Note save failed (${r.status})`);
}
/* Phase 12C — installation reviews. CONFIDENTIAL: Franco and the Developer only.
   Each review is its own row (id "review:<uuid>"), never stored on the job, so it never reaches search,
   stickers, notifications, the activity log or any PDF. Only users allowed to see reviews ever load them;
   everyone else can only write one. */
const REVIEW_PREFIX = "review:";
const canSeeReviews = (user) => (user?.level ?? 0) >= 3 || !!user?.canSeeReviews;
const REVIEW_CONCERNS = ["Punctuality", "Quality of work", "Client communication", "Site cleanliness", "Preparedness", "Damage / care of property", "Adherence to booking time"];
async function dbLoadReviews(user) {
  if (!canSeeReviews(user)) return [];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data&id=like.${encodeURIComponent(REVIEW_PREFIX)}*`, { headers });
  if (!r.ok) throw new Error(`Reviews load failed (${r.status})`);
  const rows = await r.json();
  return rows.map((row) => ({ ...row.data, id: row.id })).filter((v) => !v.deleted);
}
async function dbSaveReview(review) {
  const body = [{ id: review.id, data: review, updated_at: new Date().toISOString() }];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Review save failed (${r.status})`);
}
/* Phase 12B — inventory. Each stock item is its own row (id "inv:<uuid>").
   status: "available" → "reserved" (marked sold) → "removed" (the job it went to was invoiced). */
const INV_PREFIX = "inv:";
async function dbLoadInventory() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id,data&id=like.${encodeURIComponent(INV_PREFIX)}*`, { headers });
  if (!r.ok) throw new Error(`Inventory load failed (${r.status})`);
  const rows = await r.json();
  return rows.map((row) => ({ ...row.data, id: row.id })).filter((v) => !v.deleted && v.status !== "removed");
}
async function dbSaveInventory(items) {
  const list = Array.isArray(items) ? items : [items];
  if (!list.length) return;
  const at = new Date().toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(list.map((it) => ({ id: it.id, data: it, updated_at: at }))),
  });
  if (!r.ok) throw new Error(`Inventory save failed (${r.status})`);
}
async function dbLoadSettings() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${SETTINGS_ID}&select=data`, { headers });
  if (!r.ok) throw new Error(`Settings load failed (${r.status})`);
  const rows = await r.json();
  return (rows[0] && rows[0].data) || { customHolidays: [] };
}
async function dbSaveSettings(settings) {
  const body = [{ id: SETTINGS_ID, data: settings, updated_at: new Date().toISOString() }];
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Settings save failed (${r.status})`);
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
// Phase 12A — amber overlocking badge: solid = still to order, light = ordered and waiting to come back
const OverlockBadge = ({ p, small }) => {
  if (!needsOverlock(p)) return null;
  const ordered = p.overlockStage === "ordered";
  return (
    <span title={ordered ? "Overlocking ordered, not yet received" : "Overlocking required, not yet ordered"}
      className={`inline-flex items-center justify-center rounded-full font-bold leading-none shrink-0 ${small ? "h-4 px-1 text-[9px]" : "h-5 px-1.5 text-[10px]"} ${ordered ? "bg-amber-100 text-amber-800 border border-amber-500" : "bg-amber-400 text-black"}`}>OL</span>
  );
};
// Phase 15 — Calore smart prompts: plain amber flags, no ordered/received stage (unlike overlocking)
const CoreDrillingBadge = ({ p, small }) => {
  if (p.department !== "calore" || !p.coreDrilling) return null;
  return <span title="Core drilling required" className={`inline-flex items-center justify-center rounded-full font-bold leading-none shrink-0 bg-amber-400 text-black ${small ? "h-4 px-1 text-[9px]" : "h-5 px-1.5 text-[10px]"}`}>CD</span>;
};
const EscutcheonBadge = ({ p, small }) => {
  if (p.department !== "calore" || !p.escutcheonPlate) return null;
  return <span title="Custom escutcheon plate required" className={`inline-flex items-center justify-center rounded-full font-bold leading-none shrink-0 bg-amber-400 text-black ${small ? "h-4 px-1 text-[9px]" : "h-5 px-1.5 text-[10px]"}`}>EP</span>;
};
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
const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-base md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#1f6feb]";
const btnPrimary = "px-4 py-2 rounded-lg bg-[#1f6feb] hover:bg-[#388bfd] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhost = "px-4 py-2 rounded-lg border border-[#30363d] hover:bg-[#21262d] text-slate-200 text-sm";

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center bg-black/60 p-0 md:p-4" onMouseDown={onClose}>
      <div
        className={`bg-[#161b22] border-0 md:border border-[#30363d] rounded-none md:rounded-2xl w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} h-full md:h-auto max-h-full md:max-h-[92vh] overflow-y-auto shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 md:py-4 border-b border-[#30363d] sticky top-0 bg-[#161b22] z-10" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <h3 className="text-base font-semibold text-white min-w-0 truncate">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-1 rounded-md hover:bg-[#21262d] text-slate-400 shrink-0"><X size={20} /></button>
        </div>
        <div className="p-4 md:p-5" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>
  );
}

/* =========================================================
   LOGIN
   ========================================================= */
/* =========================================================
   PHASE 10 — MOBILE HELPERS
   ========================================================= */
const MOBILE_QUERY = "(max-width: 767px)";
function useIsMobile() {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const h = () => setM(mq.matches);
    h();
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); };
  }, []);
  return m;
}

// PWA / "Add to Home Screen". Everything lives in App.jsx, so the tags are added to <head> at start-up
// instead of editing index.html. The icon is drawn once on a canvas (the Nolans mark, white on dark).
function installPwaTags() {
  if (typeof document === "undefined" || document.getElementById("nolans-pwa")) return;
  const head = document.head;
  const add = (tag, attrs) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); head.appendChild(el); return el; };
  let icon = "";
  try {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#0d1117"; g.fillRect(0, 0, 512, 512);
    g.save(); g.translate(256, 256); g.scale(1.45, 1.45); g.translate(-192, -197.5);
    g.strokeStyle = "#ffffff"; g.lineWidth = 21; g.lineCap = "round"; g.lineJoin = "round";
    g.stroke(new Path2D("M112 183 L94 208 L94 296.5 L144 296.5 L144 98 L215 98 L289.5 160 L289.5 296.5 L225.5 296.5 L225.5 200 L178 158"));
    g.restore();
    icon = c.toDataURL("image/png");
  } catch { /* canvas unavailable — skip icon */ }
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
  else add("meta", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" });
  add("meta", { id: "nolans-pwa", name: "apple-mobile-web-app-capable", content: "yes" });
  add("meta", { name: "mobile-web-app-capable", content: "yes" });
  add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
  add("meta", { name: "apple-mobile-web-app-title", content: "Nolans" });
  add("meta", { name: "theme-color", content: "#0d1117" });
  if (icon) add("link", { rel: "apple-touch-icon", href: icon });
  try {
    const manifest = {
      name: "Nolans Installation Management", short_name: "Nolans",
      start_url: window.location.origin + "/", scope: window.location.origin + "/", display: "standalone",
      background_color: "#0d1117", theme_color: "#0d1117",
      icons: icon ? [{ src: icon, sizes: "512x512", type: "image/png", purpose: "any" }] : [],
    };
    add("link", { rel: "manifest", href: "data:application/manifest+json," + encodeURIComponent(JSON.stringify(manifest)) });
  } catch { /* ignore */ }
}
installPwaTags();

// Phase 10.3 — list tabs that get the My jobs / All jobs switch
const SCOPED_VIEWS = ["placed", "received", "booked", "eta", "snags", "completed", "history"];
function ScopeToggle({ scope, setScope, mineCount, allCount, mineLabel }) {
  const btn = (id, label, n) => (
    <button onClick={() => setScope(id)} className={`px-3 md:px-4 py-1.5 rounded-lg text-sm flex items-center gap-2 ${scope === id ? "bg-[#1e3a6e] text-white" : "text-slate-400 hover:text-slate-200"}`}>
      {label} <span className={`text-xs ${scope === id ? "text-slate-200" : "text-slate-500"}`}>{n}</span>
    </button>
  );
  return (
    <div className="mb-3 inline-flex items-center gap-1 p-1 bg-[#161b22] border border-[#30363d] rounded-xl">
      {btn("mine", mineLabel, mineCount)}
      {btn("all", "All jobs", allCount)}
    </div>
  );
}

function Login({ onLogin }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    const entered = String(pin);
    const u = entered.length === 4 && Object.prototype.hasOwnProperty.call(USERS, entered) ? USERS[entered] : null;
    if (!u) { setErr("That PIN isn't recognised."); setPin(""); return; }
    onLogin({ ...u, pin: entered });
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
      </div>
    </div>
  );
}

// Phase 10.1 — the Nolans logo, drawn as a single-weight line (21-unit stroke, round ends and corners)
// traced from the brand artwork. Colour follows the surrounding text colour.
const LOGO_ICON_PATH = "M112 183 L94 208 L94 296.5 L144 296.5 L144 98 L215 98 L289.5 160 L289.5 296.5 L225.5 296.5 L225.5 200 L178 158";
const LogoStrokes = ({ word }) => (
  <g fill="none" stroke="currentColor" strokeWidth="21" strokeLinecap="round" strokeLinejoin="round">
    <path d={LOGO_ICON_PATH} />
    {word && (
      <g transform="translate(1 1.5)">
        <path d="M402.5 277.5 V184.5 L487 277.5 V184.5" />
        <rect x="537.5" y="184.5" width="82" height="93" rx="36" />
        <path d="M669.5 184.5 V277.5 H737.5" />
        <path d="M773 277.5 L818.5 186 L864 277.5 M785 257 H852" />
        <path d="M909.5 277.5 V184.5 L993.5 277.5 V184.5" />
        <path d="M1112 194 C1100 187 1088 184.5 1074 184.5 C1054 184.5 1041.5 193 1041.5 206 C1041.5 220 1054 226 1074 229.5 L1090 232.5 C1110 236 1119.5 244 1119.5 256 C1119.5 270 1106 277.5 1086 277.5 L1074 277.5 C1062 277.5 1050 274 1041.5 266" />
      </g>
    )}
  </g>
);
function Logo({ small }) {
  if (small) {
    return (
      <svg viewBox="78 84 230 230" className="h-8 w-8 text-white" role="img" aria-label="Nolans">
        <LogoStrokes />
      </svg>
    );
  }
  return (
    <div className="flex flex-col items-start leading-none text-white">
      <svg viewBox="78 84 1060 230" className="h-8 w-auto" role="img" aria-label="Nolans">
        <LogoStrokes word />
      </svg>
      <div className="text-slate-400 text-[8px] tracking-[0.2em] mt-1.5 whitespace-nowrap">INSTALLATION MANAGEMENT</div>
    </div>
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("nolans_user"));
      if (!saved) return null;
      // Re-resolve against the current user table so name/level/department permissions stay fresh.
      // Phase 13 — no valid live PIN (old view-only session, retired PIN) means back to the login screen.
      const savedPin = saved.pin ? String(saved.pin) : "";
      const current = savedPin && Object.prototype.hasOwnProperty.call(USERS, savedPin) ? USERS[savedPin] : null;
      if (!current) { try { sessionStorage.removeItem("nolans_user"); } catch { /* ignore */ } return null; }
      return { ...current, pin: savedPin };
    } catch { return null; }
  });
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState({ customHolidays: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("home"); // home | placed | received | booked | completed | history | availability | reports | dept:<id>
  const [calMonth, setCalMonth] = useState(null); // month the calendar should open on (from Availability)
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  // Phase 10 — mobile shell: slide-in menu, "…" actions menu, expandable search
  const [navOpen, setNavOpen] = useState(false);
  // Phase 10.2 — notifications
  const [notifs, setNotifs] = useState([]);
  const [reviews, setReviews] = useState([]); // Phase 12C — only ever filled for Franco and the Developer
  const [inventory, setInventory] = useState([]); // Phase 12B — available + reserved stock items
  const [invPrompt, setInvPrompt] = useState(null); // Phase 12B — { project, source: "snag" | "completion", note }
  const [bellOpen, setBellOpen] = useState(false);
  // Phase 10.3 — "My jobs" / "All jobs" on list tabs; always starts on My jobs when a tab is opened
  const [scope, setScope] = useState("mine");
  const projectsRef = useRef([]);
  projectsRef.current = projects;
  const notifHousekeeping = useRef(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  useEffect(() => { setNavOpen(false); setMoreOpen(false); setBellOpen(false); setScope("mine"); }, [view]);
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [navOpen]);

  const level = user?.level ?? 0;
  const isCoord = level >= 2;
  const isDev = level >= 3;
  // Which departments this user may make changes to. null/undefined depts = all (owners, developer).
  const canEditDept = (deptId) => isDev || (isCoord && (!user?.depts || user.depts.includes(deptId)));
  const canEdit = (p) => canEditDept(p?.department);
  // Booking (drag onto a calendar, reschedule, add/remove day) — some co-ordinators may book any department even where they can't otherwise edit
  const canBook = (p) => canEdit(p) || !!user?.bookAny;
  // Departments a co-ordinator is allowed to create/pick in the form (null = all)
  const allowedDepts = (isDev || !user?.depts) ? null : user.depts;
  // Phase 9 — Performance Report is open to Developer and users flagged perfReports; everyone else sees a Beta Testing card
  const canSeePerf = isDev || !!user?.perfReports;

  useEffect(() => { if (user) sessionStorage.setItem("nolans_user", JSON.stringify(user)); }, [user]);

  const refresh = async () => {
    try {
      const [ps, st] = await Promise.all([dbLoad(), dbLoadSettings()]);
      setProjects(ps); setSettings(st); setError("");
      // Notifications load separately so a problem there never blocks the app
      try {
        let ns = await dbLoadNotifs();
        if (!notifHousekeeping.current) {
          notifHousekeeping.current = true;
          dbDeleteOldNotifs();
          // One-off backlog: turn the last week's activity into notifications the first time this version runs
          if (!st.notifBacklogAt) {
            const until = new Date().toISOString();
            const bk = backlogNotifs(ps, notifCutoff(), until);
            await dbSaveNotifs(bk);
            const nextSt = { ...st, notifBacklogAt: until };
            setSettings(nextSt); await dbSaveSettings(nextSt);
            ns = await dbLoadNotifs();
          }
        }
        setNotifs(ns);
      } catch { /* notifications are optional */ }
      try { setInventory(await dbLoadInventory()); } catch { /* inventory is optional */ }
      // Phase 12C — confidential reviews: fetched only for users allowed to see them
      if (canSeeReviews(user)) { try { setReviews(await dbLoadReviews(user)); } catch { /* optional */ } }
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  const saveSettings = async (next) => {
    setSettings(next);
    try { await dbSaveSettings(next); }
    catch (e) { setError(e.message); }
  };
  const customHolidays = settings.customHolidays || [];
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

  // Phase 12B — inventory
  const saveInventory = async (items, msg) => {
    const list = Array.isArray(items) ? items : [items];
    setInventory((prev) => {
      let next = [...prev];
      list.forEach((it) => {
        const i = next.findIndex((x) => x.id === it.id);
        if (it.deleted || it.status === "removed") { if (i !== -1) next.splice(i, 1); return; }
        if (i === -1) next.push(it); else next[i] = it;
      });
      return next;
    });
    try { await dbSaveInventory(list); if (msg) setToast(msg); }
    catch (e) { setError(e.message); }
  };
  const addInventoryItems = (rows) => {
    const at = new Date().toISOString();
    const items = rows.map((r) => ({ id: INV_PREFIX + uid(), status: "available", createdAt: at, addedBy: user.name, ...r }));
    return saveInventory(items, items.length === 1 ? "Added to inventory" : `${items.length} items added to inventory`);
  };
  const markInventorySold = (item, note) => saveInventory({ ...item, status: "reserved", soldNote: (note || "").trim(), reservedBy: user.name, reservedAt: new Date().toISOString() }, "Moved to reserved");
  const unreserveInventory = (item) => saveInventory({ ...item, status: "available", soldNote: "", reservedBy: null, reservedAt: null, linkedProjectId: null, linkedClient: null, linkedPo: null, linkedAt: null }, "Moved back to available");
  const linkInventory = (itemId, p) => {
    const item = inventory.find((x) => x.id === itemId);
    if (!item) return;
    saveInventory({ ...item, status: "reserved", linkedProjectId: p.id, linkedClient: p.clientName || "", linkedPo: p.po || "", linkedAt: new Date().toISOString(),
      reservedBy: item.reservedBy || user.name, reservedAt: item.reservedAt || new Date().toISOString() });
  };

  // Phase 12C — submit a confidential installation review (never touches the job itself)
  const submitReview = async (p, { rating, concerns, comment }) => {
    const review = {
      id: REVIEW_PREFIX + uid(), projectId: p.id, clientName: p.clientName || "", po: p.po || "",
      department: p.department, team: p.team || teamsOf(p.department)[0], jobConsultant: p.consultant || "",
      jobStatus: p.status, isTest: !!p.isTest,
      author: user.name, authorPin: user.pin || "", rating, concerns, comment: comment.trim(), createdAt: new Date().toISOString(),
    };
    await dbSaveReview(review);
    if (canSeeReviews(user)) setReviews((prev) => [...prev, review]);
    try { localStorage.setItem(`nolans_reviewed_${p.id}_${user.pin || user.name}`, "1"); } catch { /* ignore */ }
    setToast("Review submitted confidentially");
  };

  const save = async (p, msg) => {
    const before = projectsRef.current.find((x) => x.id === p.id);
    // Phase 12B — a reserved stock item is permanently removed once the job it went to is invoiced
    if (p.inventoryItemId && p.invoiced && !(before && before.invoiced)) {
      const item = inventory.find((x) => x.id === p.inventoryItemId);
      if (item) saveInventory({ ...item, status: "removed", removedAt: new Date().toISOString(), removedBy: user.name });
    }
    const events = user && user.pin ? diffEvents(before, p) : [];
    setProjects((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i === -1) return [...prev, p];
      const copy = [...prev]; copy[i] = p; return copy;
    });
    try {
      await dbSave(p); if (msg) setToast(msg);
      if (events.length) {
        const at = new Date().toISOString();
        const rows = events.map((e) => ({ id: NOTIF_PREFIX + uid(), ...notifBase(p), type: e.type, text: e.text, author: user.name, createdAt: at, readBy: [] }));
        setNotifs((prev) => [...prev, ...rows]);
        dbSaveNotifs(rows).catch(() => {});
      }
    }
    catch (e) { setError(e.message); }
  };
  // Phase 11 — anyone who can see the reminder can confirm the snag material has been ordered
  const markSnagMaterialOrdered = (p, snag) => {
    const at = new Date().toISOString();
    const snags = (p.snags || []).map((s) => (s.id === snag.id ? { ...s, materialOrdered: true, materialOrderedBy: user.name, materialOrderedAt: at } : s));
    save({ ...p, snags, log: [...(p.log || []), { id: uid(), text: `Snag material ordered${snag.materialNote ? `: ${snag.materialNote}` : ""}`, author: user.name, createdAt: at }] }, "Snag material marked as ordered");
    if (!p.isTest) setInvPrompt({ project: p, source: "snag", note: snag.materialNote || "" }); // Phase 12B
  };
  // Who sees a notification: the job's consultant, co-ordinators for that department, and the Developer
  const notifVisible = (n) => {
    if (!user || !user.pin) return false;
    if (isDev) return true;
    if (n.isTest) return false;
    if (n.consultant && n.consultant === user.name) return true;
    return isCoord && canEditDept(n.department);
  };
  const myPins = pinsOf(user);
  const isUnread = (n) => !(n.readBy || []).some((x) => myPins.includes(String(x)));
  const markRead = (list) => {
    const rows = list.filter(isUnread).map((n) => ({ ...n, readBy: [...(n.readBy || []), user.pin] }));
    if (!rows.length) return;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    setNotifs((prev) => prev.map((n) => byId[n.id] || n));
    dbSaveNotifs(rows).catch(() => {});
  };

  const active = useMemo(() => projects.filter((p) => !p.deleted && (isDev || !p.isTest)), [projects, isDev]);
  const deletedList = useMemo(() => projects.filter((p) => p.deleted).sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || "")), [projects]);
  // Phase 10.3 — "my" jobs: consultants = jobs with their name as consultant; co-ordinators = their departments
  // (owners and Franco cover every department); Developer sees everything
  const isMine = (p) => {
    if (!user || isDev || level < 1) return true;
    if (level === 1) return p.consultant === user.name;
    return !user.depts || user.depts.includes(p.department) || p.consultant === user.name;
  };
  const mine = (list) => list.filter(isMine);
  const q = search.trim().toLowerCase();
  const matches = (p) => !q || searchText(p).includes(q);

  const buildLists = (src) => ({
    placed: src.filter((p) => p.status === "ordered").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9")),
    received: src.filter((p) => p.status === "received").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9")),
    booked: src.filter((p) => p.status === "booked").sort((a, b) => (a.installDate || "").localeCompare(b.installDate || "")),
    completed: src.filter((p) => p.status === "installed" && !p.invoiced).sort((a, b) => (b.installedAt || "").localeCompare(a.installedAt || "")),
    history: src.filter((p) => p.status === "installed" && p.invoiced).sort((a, b) => (b.invoicedAt || "").localeCompare(a.invoicedAt || "")),
    snags: src.filter(hasOpenSnags).sort((a, b) => {
      const la = Math.max(...openSnags(a).map((s) => s.createdAt || "")), lb = Math.max(...openSnags(b).map((s) => s.createdAt || ""));
      return String(lb).localeCompare(String(la));
    }),
  });
  const allLists = useMemo(() => buildLists(active), [active]);
  const lists = useMemo(() => buildLists(mine(active)), [active, level, user]); // "My jobs" — used for counts and home
  const shownLists = scope === "all" ? allLists : lists;
  // Unacknowledged open snags — badge for co-ordinator+
  const newSnagCount = useMemo(() => active.reduce((n, p) => n + openSnags(p).filter((s) => !s.acknowledged).length, 0), [active]);
  const reviewCount = useMemo(() => active.reduce((n, p) => n + (p.snags || []).filter((s) => s.resolved && !(s.review && s.review.cause)).length, 0), [active]);
  // Phase 9.1 — orders overdue or due within 3 days, still not received. Consultants see only their own (same rule as Placed orders).
  const etaOf = (src) => {
    const withState = src.filter((p) => etaStateOf(p)).sort((a, b) => a.materialEta.localeCompare(b.materialEta));
    return { overdue: withState.filter((p) => etaStateOf(p) === "overdue"), soon: withState.filter((p) => etaStateOf(p) === "soon"), tbc: withState.filter((p) => etaStateOf(p) === "tbc") };
  };
  const etaAlerts = useMemo(() => etaOf(mine(active)), [active, level, user]);
  const etaAll = useMemo(() => etaOf(active), [active]);
  const etaCount = etaAlerts.overdue.length + etaAlerts.soon.length + etaAlerts.tbc.length;
  const myNotifs = useMemo(() => {
    const cutoff = notifCutoff();
    return notifs.filter((n) => n.createdAt >= cutoff && notifVisible(n)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifs, user, level]);
  const unreadCount = myNotifs.filter(isUnread).length;
  // Phase 11 — snag material still to be ordered: shown to the job's consultant and the co-ordinators for that department
  const snagMaterialJobs = useMemo(() => active
    .filter((p) => snagMaterialPending(p).length > 0)
    .filter((p) => isDev || p.consultant === user?.name || (isCoord && canEditDept(p.department)))
    .flatMap((p) => snagMaterialPending(p).map((s) => ({ p, s })))
    .sort((a, b) => (a.s.createdAt || "").localeCompare(b.s.createdAt || "")), [active, user, level]);
  const bellCount = unreadCount + etaCount;

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
    { id: "eta", label: "ETA alerts", icon: AlertTriangle, count: etaCount, alert: etaAlerts.overdue.length + etaAlerts.tbc.length, alertLabel: "overdue" },
    { id: "booked", label: "Booked orders", icon: CalendarDays, count: lists.booked.length },
    ...(level >= 1 ? [{ id: "snags", label: "Snags", icon: Flag, count: lists.snags.length, alert: isCoord ? newSnagCount : 0 }] : []),
    { id: "completed", label: "Completed orders", icon: CheckCircle2, count: lists.completed.length },
    { id: "history", label: "History", icon: History, count: lists.history.length },
    { id: "inventory", label: "Inventory", icon: Boxes, count: inventory.filter((x) => x.status === "available").length },
    ...(level >= 1 ? [{ id: "review", label: "Snag review", icon: ClipboardCheck, count: isCoord ? reviewCount : null }] : []),
    { id: "performance", label: "Performance Report", icon: TrendingUp, beta: !canSeePerf },
    ...(isCoord ? [
      { id: "availability", label: "Availability", icon: CalendarCheck },
      { id: "reports", label: "Reports", icon: FileText },
      // Phase 16 — changelog now Co-ordinator+ only (was visible to everyone); desktop only (hidden in the phone menu)
      { id: "updates", label: "App updates", icon: Sparkles, desktopOnly: true },
    ] : []),
  ];

  const logout = () => { sessionStorage.removeItem("nolans_user"); setUser(null); setView("home"); };
  const openDept = (id, month) => { setCalMonth(month || null); setView(`dept:${calendarOf(id)}`); };
  const openProject = (p) => { setSelected(p); setSearch(""); };

  const pick = (fn) => () => { fn(); setNavOpen(false); };
  const actions = [
    ...(isCoord ? [{ key: "new", label: "New project", icon: Plus, run: () => setShowCreate(true), cls: "text-white" }] : []),
    ...(isDev ? [{ key: "test", label: "New test project", icon: Plus, run: () => setShowTest(true), cls: "text-orange-300" }] : []),
    ...(isDev ? [{ key: "hol", label: "Public holidays", icon: Calendar, run: () => setShowHolidays(true), cls: "text-slate-200" }] : []),
  ];
  const searchBox = (autoFocus) => (
    <div className="relative w-full">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        value={search} onChange={(e) => setSearch(e.target.value)} autoFocus={autoFocus}
        onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); if (e.key === "Enter" && searchResults.length === 1) openProject(searchResults[0]); }}
        placeholder="Search orders, clients or PO numbers"
        className={`${inputCls} pl-9 pr-8 rounded-full bg-[#161b22]`}
      />
      {q && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"><X size={14} /></button>}
      {q && <SearchDropdown results={searchResults} onOpen={(p) => { openProject(p); setMobileSearch(false); }} onClose={() => setSearch("")} />}
    </div>
  );
  const sidebarBody = (
    <>
      <nav className="space-y-1">
        {nav.map((n) => {
          const activeNav = view === n.id;
          return (
            <button
              key={n.id} onClick={pick(() => setView(n.id))}
              className={`${n.desktopOnly ? "hidden md:flex" : "flex"} w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${activeNav ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#161b22]"}`}
            >
              <n.icon size={18} className="shrink-0" />
              <span className="flex-1 text-left">{n.label}</span>
              {n.beta && <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full border border-amber-400/50 text-amber-300">BETA</span>}
              {n.alert > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white whitespace-nowrap">{n.alert} {n.alertLabel || "new"}</span>}
              {n.count != null && <span className="text-xs text-slate-400">{n.count}</span>}
            </button>
          );
        })}
      </nav>
      <div className="mt-6 pt-4 border-t border-[#30363d]">
        <div className="text-[11px] text-slate-500 px-3 mb-1">Departments</div>
        {DEPARTMENTS.map((d) => (
          <button
            key={d.id} onClick={pick(() => openDept(d.id))}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${view === `dept:${d.calendar}` ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#161b22]"}`}
          >
            <d.icon size={16} /> {d.label}
          </button>
        ))}
      </div>
      <div className="mt-auto pt-4 text-[10px] text-slate-500 tracking-wider">
        FLOORING | BLINDS | SHUTTERS | FIREPLACES
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col print:bg-white print:text-black" style={{ overflowX: "clip" }}>
      {/* Top bar */}
      <header className="print:hidden sticky top-0 z-30 border-b border-[#30363d] bg-[#0d1117]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="h-14 md:h-16 flex items-center gap-2 md:gap-4 px-3 md:px-5">
          <button onClick={() => setNavOpen(true)} className="md:hidden p-2 -ml-1 rounded-lg hover:bg-[#161b22] text-slate-200" aria-label="Open menu"><Menu size={22} /></button>
          <button onClick={() => setView("home")} className="shrink-0">
            <span className="md:hidden"><Logo small /></span>
            <span className="hidden md:block"><Logo /></span>
          </button>
          <div className="hidden md:block flex-1 max-w-2xl mx-auto">{searchBox(false)}</div>
          <div className="flex-1 md:hidden" />
          <div className="flex items-center gap-1 md:gap-3 shrink-0">
            <button onClick={() => setMobileSearch((v) => !v)} className={`md:hidden p-2 rounded-lg hover:bg-[#161b22] ${mobileSearch ? "text-white bg-[#161b22]" : "text-slate-300"}`} aria-label="Search"><Search size={19} /></button>
            {isCoord && (
              <button onClick={() => setShowCreate(true)} className={`${btnPrimary} hidden md:flex items-center gap-1.5`}>
                <Plus size={16} /> New project
              </button>
            )}
            {isDev && (
              <button onClick={() => setShowTest(true)} className="hidden md:flex px-4 py-2 rounded-lg border-2 border-orange-500 text-orange-300 hover:bg-orange-500/10 text-sm font-medium items-center gap-1.5" title="Developer only — a fully working test project, hidden from everyone else and dropped from reports and searches once deleted">
                <Plus size={16} /> New test project
              </button>
            )}
            {isDev && (
              <button onClick={() => setShowHolidays(true)} className="hidden md:flex px-4 py-2 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#161b22] text-sm font-medium items-center gap-1.5" title="Developer only — manage custom public holidays shown on every calendar">
                <Calendar size={16} /> Public holidays
              </button>
            )}
            <div className="relative">
              <button onClick={() => setBellOpen((v) => !v)} className={`relative p-2 rounded-lg hover:bg-[#161b22] ${bellOpen ? "bg-[#161b22] text-white" : "text-slate-300"}`} title={`${unreadCount} unread · ${etaCount} ETA alert${etaCount === 1 ? "" : "s"}`} aria-label="Notifications">
                <Bell size={18} />
                {bellCount > 0 && <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${unreadCount || etaAlerts.overdue.length ? "bg-red-600 text-white" : "bg-amber-400 text-slate-900"}`}>{bellCount > 99 ? "99+" : bellCount}</span>}
              </button>
              {bellOpen && (
                <BellPanel
                  notifs={myNotifs} isUnread={isUnread} canSeeNotifs={!!user.pin} etaAlerts={etaAlerts}
                  onClose={() => setBellOpen(false)}
                  onOpenNotif={(n) => { markRead([n]); setBellOpen(false); const pj = projects.find((x) => x.id === n.projectId); if (pj && !pj.deleted) setSelected(pj); }}
                  onMarkAll={() => markRead(myNotifs)}
                  onOpenJob={(pj) => { setBellOpen(false); setSelected(pj); }}
                  onViewAllEta={() => { setBellOpen(false); setView("eta"); }}
                />
              )}
            </div>
            {actions.length > 0 && (
              <div className="relative md:hidden">
                <button onClick={() => setMoreOpen((v) => !v)} className={`p-2 rounded-lg hover:bg-[#161b22] ${moreOpen ? "bg-[#161b22] text-white" : "text-slate-300"}`} aria-label="More actions"><MoreVertical size={19} /></button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden">
                      {actions.map((a) => (
                        <button key={a.key} onClick={() => { setMoreOpen(false); a.run(); }} className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-[#21262d] border-b border-[#30363d] last:border-0 ${a.cls}`}>
                          <a.icon size={16} /> {a.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 pl-1 md:pl-2">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center text-xs md:text-sm font-semibold">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm hidden lg:block">{user.name}</span>
              <button onClick={logout} className="hidden md:block p-1.5 rounded-md hover:bg-[#161b22] text-slate-400" title="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </div>
        {mobileSearch && <div className="md:hidden px-3 pb-3">{searchBox(true)}</div>}
      </header>

      {/* Mobile slide-in menu */}
      {navOpen && (
        <div className="print:hidden md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-[#0d1117] border-r border-[#30363d] p-4 flex flex-col overflow-y-auto"
            style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-center justify-between mb-4">
              <Logo />
              <button onClick={() => setNavOpen(false)} className="p-2 rounded-lg hover:bg-[#161b22] text-slate-400" aria-label="Close menu"><X size={20} /></button>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-xl bg-[#161b22] border border-[#30363d]">
              <div className="w-8 h-8 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center text-xs font-semibold">{user.name.slice(0, 2).toUpperCase()}</div>
              <span className="text-sm flex-1">{user.name}</span>
              <button onClick={logout} className="p-1.5 rounded-md hover:bg-[#21262d] text-slate-400 flex items-center gap-1 text-xs"><LogOut size={14} /> Sign out</button>
            </div>
            {sidebarBody}
          </aside>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar (desktop) */}
        <aside className="print:hidden hidden md:flex w-60 shrink-0 border-r border-[#30363d] p-4 flex-col">
          {sidebarBody}
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-3 md:p-6 overflow-auto print:p-0" style={{ paddingBottom: "max(5rem, calc(env(safe-area-inset-bottom) + 5rem))" }}>
          {error && (
            <div className="print:hidden mb-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-sm px-4 py-3 flex items-center justify-between">
              <span>{error}. Check the Supabase URL/key at the top of App.jsx and that the {TABLE} table exists.</span>
              <button onClick={refresh} className="underline">Retry</button>
            </div>
          )}
          {!loading && SCOPED_VIEWS.includes(view) && (
            <ScopeToggle scope={scope} setScope={setScope}
              mineCount={view === "eta" ? etaAlerts.overdue.length + etaAlerts.soon.length + etaAlerts.tbc.length : (lists[view] || []).length}
              allCount={view === "eta" ? etaAll.overdue.length + etaAll.soon.length + etaAll.tbc.length : (allLists[view] || []).length}
              mineLabel={level === 1 || isDev ? "My jobs" : user.depts ? `My departments` : "My jobs"} />
          )}
          {loading ? (
            <div className="text-slate-400 text-sm">Loading…</div>
          ) : view === "home" ? (
            <HomeView user={user} lists={lists} setView={setView} openDept={openDept} etaAlerts={etaAlerts} onOpen={setSelected}
              snagMaterial={snagMaterialJobs} onMaterialOrdered={markSnagMaterialOrdered}
              capacity={computeCapacity(active.filter((p) => !p.isTest), customHolidays, closeDateOf(settings))}
              isDev={isDev} onSetClose={() => setShowHolidays(true)} />
          ) : view === "eta" ? (
            <EtaAlertsView alerts={scope === "all" ? etaAll : etaAlerts} onOpen={setSelected} level={scope === "all" ? 2 : level} />
          ) : view === "updates" ? (
            <ChangelogView />
          ) : view === "inventory" ? (
            <InventoryView items={inventory} user={user} level={level} isDev={isDev}
              onSold={markInventorySold} onUnreserve={unreserveInventory}
              onEdit={(it) => saveInventory(it, "Inventory item updated")}
              onDelete={(it) => saveInventory({ ...it, deleted: true, deletedBy: user.name, deletedAt: new Date().toISOString() }, "Inventory item deleted")}
              onOpenProject={(id) => { const p = projects.find((x) => x.id === id); if (p) setSelected(p); }} />
          ) : view === "performance" ? (
            canSeePerf ? <PerformanceView projects={active.filter((p) => !p.isTest)} user={user} reviews={canSeeReviews(user) ? reviews.filter((v) => !v.isTest) : null} /> : <><PerformanceBeta /><MyStanding projects={active.filter((p) => !p.isTest)} user={user} /></>
          ) : view === "reports" ? (
            <ReportsView projects={active} />
          ) : view === "availability" ? (
            <AvailabilityView projects={active} openDept={openDept} />
          ) : view === "snags" ? (
            <SnagsView items={shownLists.snags} onOpen={setSelected} />
          ) : view === "review" ? (
            <SnagReviewView projects={active} user={user} isCoord={isCoord} canEdit={canEdit} save={save} onOpen={setSelected} />
          ) : view === "completed" ? (
            <CompletedView items={shownLists.completed} isCoord={isCoord} canEdit={canEdit} isDev={isDev} user={user} save={save} onOpen={setSelected} setToast={setToast} />
          ) : view === "history" ? (
            <HistoryView items={shownLists.history} deleted={deletedList} isCoord={isCoord} canEdit={canEdit} isDev={isDev} user={user} save={save} onOpen={setSelected} />
          ) : view.startsWith("dept:") ? (
            <CalendarView
              key={view} cal={calOf(view.slice(5))} projects={active.filter((p) => calendarOf(p.department) === view.slice(5))}
              isCoord={isCoord} canEdit={canEdit} canBook={canBook} customHolidays={customHolidays} user={user} save={save} onOpen={setSelected} initialMonth={calMonth}
            />
          ) : (
            <ListView
              title={nav.find((n) => n.id === view)?.label} status={view}
              items={shownLists[view]} onOpen={setSelected} level={level}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {(showCreate || showTest || editing) && (
        <ProjectForm
          initial={editing} user={user} isCoord={isCoord} isTest={showTest && !editing} allowedDepts={allowedDepts}
          reservedStock={inventory.filter((x) => x.status === "reserved" && !x.linkedProjectId)}
          onClose={() => { setShowCreate(false); setShowTest(false); setEditing(null); }}
          onSave={async (p) => { await save(p, editing ? "Project updated" : (p.isTest ? "Test project created" : "Project created")); if (!editing && p.inventoryItemId) linkInventory(p.inventoryItemId, p); setShowCreate(false); setShowTest(false); setEditing(null); if (editing) setSelected(p); }}
        />
      )}
      {selected && (
        <ProjectDetail
          project={projects.find((p) => p.id === selected.id) || selected}
          user={user} level={level} isCoord={isCoord} canEdit={canEdit(projects.find((p) => p.id === selected.id) || selected)} isDev={isDev} save={save}
          reviews={canSeeReviews(user) ? reviews.filter((v) => v.projectId === selected.id) : null} onSubmitReview={submitReview}
          onInventoryPrompt={setInvPrompt}
          onClose={() => setSelected(null)} onEdit={() => { setEditing(projects.find((p) => p.id === selected.id)); setSelected(null); }}
        />
      )}
      {invPrompt && (
        <InventoryAddModal project={invPrompt.project} source={invPrompt.source} note={invPrompt.note}
          onClose={() => setInvPrompt(null)}
          onSave={async (rows) => { await addInventoryItems(rows); setInvPrompt(null); }} />
      )}
      {showHolidays && (
        <HolidaysModal custom={customHolidays} closeDate={closeDateOf(settings)}
          onSave={(list, closeDate) => saveSettings({ ...settings, customHolidays: list, closeDate })} onClose={() => setShowHolidays(false)} />
      )}
      {user.pin && <NotesWidget user={user} view={view} />}
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
              <div className="text-xs text-slate-400 truncate">{d.label} · {p.consultant}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}{p.installDate ? ` · ${fmtShort(p.installDate)} ${p.installTime || ""}` : p.materialEta ? ` · ETA ${fmtShort(p.materialEta)}` : ""}</div>
              {(p.productType || jobMeasureText(p)) && <div className="text-[11px] text-slate-500 truncate">{p.productType}{productLinesOf(p).length > 1 ? ` +${productLinesOf(p).length - 1} more` : ""}{jobMeasureText(p) ? ` · ${jobMeasureText(p)}` : ""}</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {p.isTest && <span className="text-[10px] text-orange-300 font-semibold">TEST</span>}
              {isRepair(p) && <RepairIcon />}
              {hasOpenSnags(p) && <SnagFlag />}
              {isReserved(p) && <span className={`text-[10px] ${p.received ? "text-slate-300" : "text-red-300"}`}>{p.reserveStage === "reserved" ? "Reserved" : "Planned"}</span>}
              {showPartial(p) && <PartialBadge />}
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
function HomeView({ user, lists, setView, openDept, etaAlerts, onOpen, capacity, isDev, onSetClose, snagMaterial = [], onMaterialOrdered }) {
  const myCount = lists.placed.length + lists.received.length;
  const cards = [
    { id: "signed", label: "Signed in consultant", sub: user.name, count: myCount, icon: User, color: "bg-blue-600" },
    { id: "placed", label: "Placed orders", count: lists.placed.length, icon: ClipboardList, color: "bg-green-600" },
    { id: "received", label: "Received orders", count: lists.received.length, icon: Truck, color: "bg-amber-500" },
    { id: "booked", label: "Booked orders", count: lists.booked.length, icon: CalendarDays, color: "bg-violet-600" },
    { id: "completed", label: "Completed orders", count: lists.completed.length, icon: CheckCircle2, color: "bg-teal-600" },
  ];
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-7">
      <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-2 mb-5 md:mb-6">
        <div>
          <div className="text-slate-400 text-xs md:text-sm tracking-[0.2em]">WELCOME BACK</div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">{user.name}</h1>
          <p className="text-slate-400 mt-2 text-sm max-w-md hidden sm:block">Manage your orders, track progress and keep everything on schedule.</p>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400 md:text-slate-300 shrink-0"><Calendar size={16} /> {fmt(todayIso())}</div>
      </div>
      {etaAlerts && <EtaBanner alerts={etaAlerts} onOpen={onOpen} onViewAll={() => setView("eta")} />}
      <SnagMaterialBanner items={snagMaterial} onOpen={onOpen} onOrdered={onMaterialOrdered} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_1.6fr] gap-5">
        <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl p-3 space-y-2">
          {cards.map((c) => (
            <button
              key={c.id} onClick={() => c.id !== "signed" && setView(c.id)}
              className="w-full flex items-center gap-3 md:gap-4 bg-[#161b22] hover:bg-[#1c222b] border border-[#30363d] rounded-xl p-3 md:p-4 text-left"
            >
              <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full ${c.color} flex items-center justify-center text-white shrink-0`}><c.icon size={20} /></div>
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
              className="w-full h-16 md:h-24 rounded-xl border border-[#30363d] flex items-center px-4 md:px-6 gap-4 md:gap-5 text-left relative overflow-hidden group"
              style={{ background: `linear-gradient(90deg, ${d.to} 0%, ${d.to} 35%, ${d.from} 100%)` }}
            >
              <div
                className="absolute inset-y-0 right-0 w-1/2 opacity-40"
                style={{ backgroundImage: `repeating-linear-gradient(${d.id === "shutters" || d.id === "blinds" ? "180deg" : "45deg"}, rgba(255,255,255,0.08) 0 6px, transparent 6px 18px)` }}
              />
              <d.icon className="text-white relative w-7 h-7 md:w-10 md:h-10" strokeWidth={1.5} />
              <span className="text-lg md:text-2xl font-semibold text-white relative">{d.label}</span>
              <ChevronRight size={24} className="ml-auto text-white/80 relative" />
            </button>
          ))}
        </div>
      </div>
      {capacity && <CapacityPanel capacity={capacity} openDept={openDept} isDev={isDev} onSetClose={onSetClose} />}
    </div>
  );
}

/* =========================================================
   PHASE 9.1 — TEAM CAPACITY (home screen, all levels)
   Per department calendar from today to the year-end close date (weekends and public holidays skipped).
   A team counts as booked on a day if it has any install, planned/reserved day or snag return visit.
   Departments with two teams are measured in team-days (2 teams × 30 days = 60).
   ========================================================= */
// Phase 10.1 — capacity runs from today up to and including the year-end close date (set by the Developer).
const DEFAULT_CLOSE_DATE = "2026-12-18"; // used until a date has been saved in settings
const closeDateOf = (settings) => (settings && settings.closeDate !== undefined ? settings.closeDate : DEFAULT_CLOSE_DATE);
const workingDaysBetween = (start, end, custom) => {
  const out = []; let cur = start;
  while (cur <= end) { if (!isWeekend(cur) && !holidayName(cur, custom)) out.push(cur); cur = addDays(cur, 1); if (out.length > 400) break; }
  return out;
};
// Returns { closeDate, workingDays, rows } or { closeDate, missing: true } when no future close date is set
function computeCapacity(projects, custom = [], closeDate) {
  const today = todayIso();
  if (!closeDate || closeDate < today) return { closeDate, missing: true };
  const windowDays = workingDaysBetween(today, closeDate, custom);
  const rows = CALENDARS.map((cal) => {
    const teamCount = teamsOf(cal.id).length;
    const inCal = projects.filter((p) => calendarOf(p.department) === cal.id);
    const occ = {}; // date -> set of occupied team slots
    const mark = (date, key) => { (occ[date] = occ[date] || new Set()).add(key); };
    inCal.filter(onCalendar).forEach((p) => scheduleOf(p).forEach((sd) => mark(sd.date, p.team || `job:${p.id}`)));
    inCal.forEach((p) => (p.returnVisits || []).forEach((v) => mark(v.date, v.team || p.team || `ret:${v.id}`)));
    const usedOn = (d) => Math.min(teamCount, occ[d] ? occ[d].size : 0);
    const total = windowDays.length * teamCount;
    const booked = windowDays.reduce((n, d) => n + usedOn(d), 0);
    return { cal, teamCount, total, booked, free: total - booked };
  });
  return { closeDate, workingDays: windowDays.length, rows };
}
function CapacityPanel({ capacity, openDept, isDev, onSetClose }) {
  const { closeDate, missing, workingDays, rows } = capacity;
  return (
    <div className="mt-5 bg-[#0d1117] border border-[#30363d] rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Gauge size={18} className="text-slate-300" />
          <h2 className="text-lg font-semibold text-white">Team capacity</h2>
        </div>
        {!missing && <span className="text-xs text-slate-500">{workingDays} working days to year-end close · {fmt(closeDate, { day: "numeric", month: "short", year: "numeric" })}</span>}
      </div>
      {missing ? (
        <div className="text-sm text-slate-400 border border-dashed border-[#30363d] rounded-xl px-4 py-5 text-center">
          {closeDate ? <>The year-end close date ({fmt(closeDate, { day: "numeric", month: "short", year: "numeric" })}) has passed.</> : "No year-end close date is set."}
          {isDev
            ? <> <button onClick={onSetClose} className="underline text-slate-200 hover:text-white">Set the next close date</button></>
            : " Capacity will show once the next close date is set."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {rows.map(({ cal, teamCount, total, booked, free }) => {
            const pct = total ? booked / total : 0;
            const bar = pct > 0.8 ? "bg-red-500" : pct > 0.5 ? "bg-amber-400" : "bg-emerald-500";
            return (
              <button key={cal.id} onClick={() => openDept(cal.id)} className="text-left bg-[#161b22] hover:bg-[#1c222b] border border-[#30363d] rounded-xl p-3"
                title={teamCount > 1 ? `${teamCount} teams, counted in team-days` : ""}>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <cal.icon size={16} className="text-slate-400" /> <span className="truncate">{cal.label}</span>
                  {teamCount > 1 && <span className="ml-auto text-[10px] text-slate-500">{teamCount} teams</span>}
                </div>
                <div className="mt-2 flex items-center text-xs text-slate-400 divide-x divide-[#30363d]">
                  <span className="pr-2"><span className={`font-semibold ${free === 0 ? "text-red-300" : "text-white"}`}>{free}</span> free</span>
                  <span className="px-2"><span className="font-semibold text-slate-200">{booked}</span> booked</span>
                  <span className="pl-2"><span className="font-semibold text-slate-200">{total}</span> total</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[#21262d] overflow-hidden"><div className={`h-full ${bar}`} style={{ width: `${Math.round(pct * 100)}%` }} /></div>
                  <span className="text-xs font-semibold text-slate-200 w-9 text-right">{Math.round(pct * 100)}%</span>
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
   PHASE 10.2 — BELL PANEL (notifications + ETA alerts)
   ========================================================= */
function BellPanel({ notifs, isUnread, canSeeNotifs, etaAlerts, onClose, onOpenNotif, onMarkAll, onOpenJob, onViewAllEta }) {
  const unread = notifs.filter(isUnread).length;
  const etaList = [...etaAlerts.overdue, ...etaAlerts.tbc, ...etaAlerts.soon];
  const [tab, setTab] = useState(() => (canSeeNotifs && (unread > 0 || etaList.length === 0) ? "notifs" : "eta"));
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed md:absolute left-2 right-2 md:left-auto md:right-0 top-[calc(3.5rem+env(safe-area-inset-top))] md:top-full md:mt-2 z-50 md:w-[400px] max-h-[75vh] flex flex-col bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-[#30363d]">
          {canSeeNotifs && (
            <button onClick={() => setTab("notifs")} className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${tab === "notifs" ? "border-[#1f6feb] text-white" : "border-transparent text-slate-400"}`}>
              Notifications {unread > 0 && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">{unread}</span>}
            </button>
          )}
          <button onClick={() => setTab("eta")} className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${tab === "eta" ? "border-[#1f6feb] text-white" : "border-transparent text-slate-400"}`}>
            ETA alerts {etaList.length > 0 && <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${(etaAlerts.overdue.length || etaAlerts.tbc.length) ? "bg-red-600 text-white" : "bg-amber-400 text-slate-900"}`}>{etaList.length}</span>}
          </button>
        </div>
        {tab === "notifs" ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 text-[11px] text-slate-500 border-b border-[#30363d]">
              <span>Last {NOTIF_DAYS} days · your jobs and departments</span>
              {unread > 0 && <button onClick={onMarkAll} className="text-slate-300 hover:text-white underline">Mark all read</button>}
            </div>
            <div className="overflow-y-auto flex-1">
              {notifs.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">No updates this week.</div> : notifs.map((n) => {
                const meta = NOTIF_META[n.type] || { label: "Update", cls: "bg-slate-400" };
                const un = isUnread(n);
                const d = deptOf(n.department);
                return (
                  <button key={n.id} onClick={() => onOpenNotif(n)} className={`w-full text-left px-4 py-3 border-b border-[#30363d] last:border-0 flex gap-3 hover:bg-[#1c222b] ${un ? "bg-[#1f6feb]/5" : ""}`}>
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${un ? meta.cls : "bg-transparent border border-slate-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm truncate ${un ? "text-white font-semibold" : "text-slate-300"}`}>{n.clientName || "Job"}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">{d.label}</span>
                        <span className="ml-auto text-[10px] text-slate-500 shrink-0">{ago(n.createdAt)}</span>
                      </div>
                      <div className={`text-xs mt-0.5 ${un ? "text-slate-200" : "text-slate-400"}`}><span className="font-medium">{meta.label}</span> · {n.text}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">{n.author ? `by ${n.author}` : ""}{n.consultant ? ` · ${n.consultant}'s job` : ""}{n.po ? ` · PO ${n.po}` : ""}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="overflow-y-auto flex-1">
              {etaList.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">No orders overdue or due within {ETA_WARN_DAYS} days.</div> : etaList.map((p) => (
                <button key={p.id} onClick={() => onOpenJob(p)} className="w-full text-left px-4 py-3 border-b border-[#30363d] last:border-0 flex items-center gap-3 hover:bg-[#1c222b]">
                  <EtaBadge p={p} small />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{p.clientName}</div>
                    <div className="text-[11px] text-slate-400 truncate">{deptOf(p.department).label} · PO {p.po} · {etaLabel(p)}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={onViewAllEta} className="px-4 py-2.5 text-xs text-slate-300 hover:text-white border-t border-[#30363d] text-center">Open ETA alerts page</button>
          </>
        )}
      </div>
    </>
  );
}

/* =========================================================
   PHASE 9.1 — ETA FOLLOW-UP (home banner + dedicated view)
   ========================================================= */
/* Phase 11 — snag material reminder (home screen). Visible to the job's consultant and that department's
   co-ordinators until someone ticks it off as ordered. */
function SnagMaterialBanner({ items, onOpen, onOrdered }) {
  const [confirming, setConfirming] = useState(null); // snag id awaiting a second tap
  if (!items.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-sky-500/50 bg-sky-500/10 px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <PackageOpen size={18} className="text-sky-300" />
        <span className="text-sm text-white font-medium">Snag material to be ordered <span className="text-slate-400 font-normal">· {items.length}</span></span>
      </div>
      <div className="space-y-2">
        {items.map(({ p, s }) => (
          <div key={s.id} className="flex items-center gap-3 flex-wrap bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2">
            <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left">
              <div className="text-sm text-white truncate flex items-center gap-1.5">{p.clientName} {isRepair(p) && <RepairIcon small />}</div>
              <div className="text-xs text-slate-400 truncate">{deptOf(p.department).label} · PO {p.po} · {p.consultant}{s.materialNote ? ` · ${s.materialNote}` : ""}</div>
            </button>
            {confirming === s.id ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-300">Ordered?</span>
                <button onClick={() => { onOrdered(p, s); setConfirming(null); }} className="text-xs px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white">Yes</button>
                <button onClick={() => setConfirming(null)} className="text-xs px-2.5 py-1 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#21262d]">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(s.id)} className="text-xs px-2.5 py-1 rounded-lg border border-sky-500/50 text-sky-200 hover:bg-sky-500/15 shrink-0 flex items-center gap-1"><Check size={12} /> Mark as ordered</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EtaBanner({ alerts, onOpen, onViewAll }) {
  const { overdue, soon, tbc } = alerts;
  if (!overdue.length && !soon.length && !tbc.length) return null;
  const top = [...overdue, ...tbc, ...soon].slice(0, 4);
  return (
    <div className={`mb-5 rounded-xl border px-4 py-3 ${(overdue.length || tbc.length) ? "border-red-500/50 bg-red-500/10" : "border-amber-400/50 bg-amber-400/10"}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <AlertTriangle size={18} className={(overdue.length || tbc.length) ? "text-red-400" : "text-amber-300"} />
        <span className="text-sm text-white font-medium">
          {overdue.length > 0 && <>{overdue.length} order{overdue.length === 1 ? "" : "s"} past ETA</>}
          {overdue.length > 0 && tbc.length > 0 && " · "}
          {tbc.length > 0 && <>{tbc.length} ETA{tbc.length === 1 ? "" : "s"} to be confirmed</>}
          {(overdue.length > 0 || tbc.length > 0) && soon.length > 0 && " · "}
          {soon.length > 0 && <>{soon.length} due within {ETA_WARN_DAYS} days</>}
          <span className="text-slate-400 font-normal"> · not yet received</span>
        </span>
        <button onClick={onViewAll} className="ml-auto text-xs underline text-slate-300 hover:text-white">View all</button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {top.map((p) => (
          <button key={p.id} onClick={() => onOpen(p)} className="flex items-center gap-2 text-xs bg-[#0d1117] border border-[#30363d] hover:border-slate-500 rounded-lg px-2.5 py-1.5">
            <EtaBadge p={p} small />
            <span className="text-white">{p.clientName}</span>
            <span className="text-slate-400">{deptOf(p.department).label} · {etaLabel(p)}</span>
          </button>
        ))}
        {overdue.length + tbc.length + soon.length > top.length && <button onClick={onViewAll} className="text-xs text-slate-400 hover:text-white px-2">+{overdue.length + tbc.length + soon.length - top.length} more</button>}
      </div>
    </div>
  );
}
function EtaAlertsView({ alerts, onOpen, level }) {
  const Section = ({ title, items, tone }) => (
    <div className="mb-6">
      <div className={`text-xs tracking-wider mb-2 ${tone}`}>{title} · {items.length}</div>
      {items.length === 0 ? (
        <div className="text-slate-500 text-sm py-6 text-center border border-dashed border-[#30363d] rounded-xl">Nothing here.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const d = deptOf(p.department);
            const lines = productLinesOf(p);
            const supplier = p.supplier || lines[0]?.supplier || "";
            return (
              <button key={p.id} onClick={() => onOpen(p)} className={`w-full text-left bg-[#0d1117] hover:bg-[#12181f] border ${etaStateOf(p) === "overdue" ? "border-red-500/60" : etaStateOf(p) === "tbc" ? "border-slate-500/60" : "border-amber-400/50"} rounded-xl p-3 md:p-4 grid grid-cols-12 gap-x-3 gap-y-1.5 md:gap-3 items-center`}>
                <div className="col-span-12 md:col-span-4 min-w-0">
                  <div className="font-medium text-white truncate">{p.clientName}</div>
                  <div className="text-xs text-slate-400 truncate">PO {p.po} · {p.consultant}</div>
                </div>
                <div className="col-span-6 md:col-span-2 text-sm text-slate-300 flex items-center gap-1.5"><d.icon size={14} className="text-slate-500" />{d.label}</div>
                <div className="col-span-6 md:col-span-3 text-sm text-slate-300 truncate">{p.productType}{supplier && !String(p.productType || "").includes(supplier) ? ` · ${supplier}` : ""}</div>
                <div className="col-span-6 md:col-span-2 text-xs text-slate-300">ETA {fmtShort(p.materialEta)}<div className="text-slate-400">{etaLabel(p)}</div></div>
                <div className="col-span-6 md:col-span-1 flex justify-end"><EtaBadge p={p} /></div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-xl md:text-2xl font-bold text-white">ETA alerts</h1>
        <span className="text-sm text-slate-400">{alerts.overdue.length + alerts.tbc.length + alerts.soon.length} to follow up{level === 1 ? " (yours)" : ""}</span>
      </div>
      <p className="text-sm text-slate-400 mb-5">Orders not yet received that are past their ETA, still to be confirmed, or due within {ETA_WARN_DAYS} days. Tap an order to open it.</p>
      <Section title="OVERDUE — PAST ETA" items={alerts.overdue} tone="text-red-300" />
      <Section title="ETA TO BE CONFIRMED" items={alerts.tbc} tone="text-slate-300" />
      <Section title={`DUE WITHIN ${ETA_WARN_DAYS} DAYS`} items={alerts.soon} tone="text-amber-300" />
    </div>
  );
}

/* =========================================================
   PHASE 9.1 — PERSONAL NOTES (floating, every screen)
   Each user sees only their own notes; the Developer sees everyone's.
   Used as a feedback channel for personalised changes.
   ========================================================= */
const SCREEN_NAMES = { home: "Home", placed: "Placed orders", received: "Received orders", booked: "Booked orders", eta: "ETA alerts", snags: "Snags", completed: "Completed orders", history: "History", review: "Snag review", updates: "App updates", performance: "Performance Report", availability: "Availability", reports: "Reports" };
const screenName = (v) => (v && v.startsWith("dept:") ? `${calOf(v.slice(5)).label} calendar` : SCREEN_NAMES[v] || v || "");
/* =========================================================
   PHASE 11 — APP UPDATES (changelog, desktop only)
   Hand-maintained: add a new entry at the TOP of CHANGELOG each phase.
   ========================================================= */
const CHANGELOG = [
  { phase: "17", date: "2026-09-29", items: [
    "Every department: pick \"Other (not listed)\" as the supplier to type a free-text product description for out-of-the-norm orders — Developer and Franco get notified so the catalogue can be extended if needed.",
    "Material ETA can now be set to TBC instead of a date — TBC orders show alongside overdue ones in ETA alerts until a real date is entered.",
    "Notes on a job: anyone can add one, shown below client details with author and timestamp.",
  ] },
  { phase: "16", date: "2026-09-29", items: [
    "App updates page moved to Co-ordinator and up (was visible to everyone).",
    "Home menu order: ETA alerts now sits above Booked orders.",
  ] },
  { phase: "15", date: "2026-09-29", items: [
    "Shutters: Blockhouse and Plantation ranges updated to their real codes (Blockhouse: B1, B2, FL · Plantation: A1, A2, A3, T1, T2).",
    "Calore: new product catalogue — Supplier, Type (Wood/Pellet/Gas) and Unit type (Free-Standing/Built-In), plus a free-text model name.",
    "Calore: tick \"Installing the client's own fireplace\" to skip the catalogue for jobs on a unit the client already owns.",
    "Calore: internal serial number field, and two new flags — Core drilling required and Custom escutcheon plate — shown as amber badges until unticked.",
  ] },
  { phase: "12B", date: "2026-09-27", items: [
    "Inventory: a new Inventory page lists stock on hand and reserved stock, with cost and the reason each item is there.",
    "When snag material is ordered, or a co-ordinator marks a job as completed, the app asks whether anything is going to stock and lets you add the items.",
    "Anyone can mark an item as sold, which moves it to Reserved. When creating a new project, tick \"From inventory\" to pick a reserved item.",
    "Once that job is invoiced, the item is removed from inventory.",
  ] },
  { phase: "12C", date: "2026-09-27", items: [
    "Installation reviews: any job now has a \"Leave installation review\" button. Give an overall star rating, tick any areas of concern and add a comment. Reviews are confidential.",
    "Once a job is completed, the consultant gets a prompt to leave a considered review.",
  ] },
  { phase: "12A", date: "2026-09-27", items: [
    "Overlocking (Carpets): tick \"Overlocking required\" on a job and add the sizes. An amber OL badge shows on the job until the overlocking is ordered and received.",
    "The job's consultant or co-ordinator presses Place order, then Mark overlocking received. Both send a notification.",
    "Overlocking shows on the daily and weekly PDF schedule.",
    "Leaderboard added to the Performance Report: top m² sold, jobs invoiced, team m² installed, fewest snags per m², and top ranges by m² and by number of jobs.",
    "Consultants can see their own standing on the Performance Report page.",
    "Install teams now show real names: Navin, Henro, Joey, Darren, Desmond, Alton, Jacques and Aiden.",
  ] },
  { phase: "11.2", date: "2026-09-27", items: [
    "Material ETA now opens a calendar: tap a date, use the arrows to move between months.",
    "Franco can see everyone's feedback notes.",
  ] },
  { phase: "11.1", date: "2026-09-27", items: [
    "Snag review fix: picking a cause no longer saves straight away. Choose the cause, add cost lines, then press Save.",
  ] },
  { phase: "11", date: "2026-09-27", items: [
    "Repairs: new jobs can be created as a Repair (small wrench icon). A repair with no material goes straight to Ready to book.",
    "Calendar filter for co-ordinators: All, New jobs or Repairs. Snag return visits show under Repairs.",
    "Snag material: when logging a snag you can tick \"Material required\". The consultant and the department co-ordinator see a reminder on the home screen until it's marked as ordered.",
    "Partial receipt: any received line can be flagged as partially received with a note (e.g. 3 of 5 rolls in).",
    "PO numbers on new jobs are 6 digits and saved as PL 123456.",
    "Performance Report shows installations and repairs separately.",
    "This App updates page.",
  ] },
  { phase: "10.3", date: "2026-09-27", items: [
    "Blinds and Shutters product catalogues, plus Turf, Laminates and Louvre Roofs & Carports.",
    "Measurements per department: blind quantities, shutter references and panels, carpet roll width × linear metres.",
    "SOW Submitted tick box on shutter jobs.",
    "Completed jobs turn light grey on the calendar until invoiced.",
    "My jobs / All jobs toggle on the list tabs.",
    "Desktop calendar shows a rolling 4 weeks.",
  ] },
  { phase: "10.2", date: "2026-09-26", items: [
    "Notifications in the bell: received, reserved, booked, completed, invoiced, moves, snags and ETA changes.",
    "Marco, Luciano and Office added to the consultant list.",
  ] },
  { phase: "10.1", date: "2026-09-26", items: [
    "Real Nolans logo.",
    "Capacity panel counts working days up to the year-end close date.",
    "Phones: tap an empty day to book a job.",
  ] },
  { phase: "10", date: "2026-09-26", items: [
    "Phone layout: slide-out menu, full-screen windows, week view calendar.",
    "Add to Home Screen support.",
  ] },
  { phase: "9.2", date: "2026-09-25", items: [
    "Edit details fixed for older hand-typed products, with colour per product line.",
  ] },
  { phase: "9.1", date: "2026-09-24", items: [
    "Team capacity on the home screen.",
    "ETA alerts for orders due soon or overdue.",
    "Floating notes button for feedback.",
  ] },
  { phase: "9", date: "2026-09-23", items: [
    "Performance Report (consultants and install teams), with PDF export.",
  ] },
  { phase: "8", date: "2026-09-22", items: [
    "Public holidays on every calendar.",
    "Jobs stay on the calendar until invoiced.",
  ] },
  { phase: "7", date: "2026-09-20", items: [
    "Department permissions for co-ordinators.",
    "New 3-bar status on stickers: planned, reserved, confirmed.",
  ] },
  { phase: "6", date: "2026-09-20", items: [
    "Multiple product lines per job with m² per line.",
    "Tap-to-expand calendar stickers.",
  ] },
  { phase: "5", date: "2026-09-19", items: [
    "Product catalogue dropdowns for Carpets and Vinyl.",
  ] },
  { phase: "4", date: "", items: [
    "Snag review: cause and cost per snag.",
  ] },
  { phase: "3", date: "", items: [
    "Calore Fireplaces department (shares the Shutters calendar).",
  ] },
  { phase: "2", date: "", items: [
    "Snags: log problems on a job and book return visits.",
    "Search, multi-day installs, additional line items and invoicing.",
  ] },
  { phase: "1", date: "", items: [
    "Launch: projects, department calendars, drag-and-drop booking, trays and PDF reports.",
  ] },
];
function ChangelogView() {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6 max-w-3xl">
      <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 mb-1"><Sparkles size={22} className="text-slate-300" /> App updates</h1>
      <p className="text-sm text-slate-400 mb-6">What's changed in each version of the tracker, newest first.</p>
      <div className="space-y-5">
        {CHANGELOG.map((c, i) => (
          <div key={c.phase} className={`border-l-2 pl-4 ${i === 0 ? "border-[#1f6feb]" : "border-[#30363d]"}`}>
            <div className="flex items-baseline gap-3 mb-1.5">
              <span className="text-white font-semibold">Phase {c.phase}</span>
              {c.date && <span className="text-xs text-slate-500">{fmt(c.date, { day: "numeric", month: "long", year: "numeric" })}</span>}
              {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1f6feb] text-white">Latest</span>}
            </div>
            <ul className="space-y-1">
              {c.items.map((t, j) => <li key={j} className="text-sm text-slate-300 flex gap-2"><span className="text-slate-600">•</span><span>{t}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesWidget({ user, view }) {
  const isDevUser = seesAllNotes(user);
  const readers = noteReaders().filter((n) => n !== user.name && !(n === "the developer" && (user.level ?? 0) >= 3));
  const joinAnd = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0] || "");
  const readersText = joinAnd(readers);
  const withYou = joinAnd(["you", ...readers]);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showDone, setShowDone] = useState(false);
  const load = async () => {
    try { setNotes(await dbLoadNotes(user)); setErr(""); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [user.pin]);
  useEffect(() => { if (open) load(); }, [open]);
  const put = async (n) => {
    setNotes((prev) => { const i = prev.findIndex((x) => x.id === n.id); const c = [...prev]; if (i === -1) c.push(n); else c[i] = n; return c.filter((x) => !x.deleted); });
    try { await dbSaveNote(n); setErr(""); } catch (e) { setErr(e.message); }
  };
  const post = async () => {
    const t = text.trim(); if (!t) return;
    setBusy(true);
    await put({ id: NOTE_PREFIX + uid(), pin: user.pin, author: user.name, text: t, screen: screenName(view), createdAt: new Date().toISOString(), done: false });
    setText(""); setBusy(false);
  };
  const openCount = notes.filter((n) => !n.done).length;
  const shown = notes.filter((n) => showDone || !n.done).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return (
    <div className="print:hidden">
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-40 w-12 h-12 rounded-full bg-[#1f6feb] hover:bg-[#388bfd] text-white shadow-xl flex items-center justify-center" title={`My notes — ideas and feedback, visible to ${withYou} only`}>
          <MessageSquarePlus size={20} />
          {isDevUser && openCount > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-[10px] font-bold flex items-center justify-center">{openCount}</span>}
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 left-5 z-40 w-[min(380px,calc(100vw-2.5rem))] max-h-[70vh] flex flex-col bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <div>
              <div className="text-sm font-semibold text-white">{isDevUser ? "All feedback notes" : "My notes"}</div>
              <div className="text-[11px] text-slate-500">{isDevUser ? `Everyone's notes · also visible to ${readersText}` : `Only ${withYou} can see these`}</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#21262d] text-slate-400"><X size={16} /></button>
          </div>
          <div className="p-3 border-b border-[#30363d]">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputCls} placeholder={`An idea, a problem, something you'd change… (on ${screenName(view)})`}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) post(); }} />
            <div className="flex items-center justify-between mt-2">
              {isDevUser ? (
                <label className="text-[11px] text-slate-400 flex items-center gap-1.5"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done</label>
              ) : <span />}
              <button onClick={post} disabled={busy || !text.trim()} className={`${btnPrimary} flex items-center gap-1.5 py-1.5`}><Send size={14} /> Post</button>
            </div>
            {err && <div className="text-[11px] text-red-400 mt-1">{err}</div>}
          </div>
          <div className="overflow-auto p-3 space-y-2">
            {shown.length === 0 ? <div className="text-xs text-slate-500 text-center py-4">No notes yet.</div> : shown.map((n) => (
              <div key={n.id} className={`border border-[#30363d] rounded-lg p-2.5 text-sm ${n.done ? "opacity-60" : ""}`}>
                <div className="text-slate-100 whitespace-pre-wrap break-words">{n.text}</div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                  {isDevUser && <span className="text-slate-300 font-semibold">{n.author}</span>}
                  <span>{new Date(n.createdAt).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  {n.screen && <span>· {n.screen}</span>}
                  {n.done && <span className="text-emerald-400">· done</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {isDevUser && <button onClick={() => put({ ...n, done: !n.done, doneAt: n.done ? null : new Date().toISOString() })} className="p-1 rounded hover:bg-[#21262d] text-emerald-300" title={n.done ? "Mark as open" : "Mark as done"}><Check size={12} /></button>}
                    {(isDevUser || pinsOf(user).includes(String(n.pin))) && <button onClick={() => { if (confirm("Delete this note?")) put({ ...n, deleted: true }); }} className="p-1 rounded hover:bg-[#21262d] text-slate-400" title="Delete note"><Trash2 size={12} /></button>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   LIST VIEWS (placed / received / booked / completed)
   ========================================================= */
function ListView({ title, status, items, onOpen, level }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-white">{title}</h1>
        <span className="text-sm text-slate-400">{items.length} {items.length === 1 ? "order" : "orders"}{level === 1 && (status === "placed" || status === "received") ? " of yours" : ""}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-slate-400 text-sm py-10 text-center border border-dashed border-[#30363d] rounded-xl">Nothing here yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const d = deptOf(p.department);
            return (
              <button key={p.id} onClick={() => onOpen(p)} className={`w-full text-left bg-[#0d1117] hover:bg-[#12181f] border ${snagCardCls(p)} rounded-xl p-3 md:p-4 grid grid-cols-12 gap-x-3 gap-y-1.5 md:gap-3 items-center`}>
                <div className="col-span-12 md:col-span-4 min-w-0">
                  <div className="font-medium text-white truncate flex items-center gap-1.5"><span className="truncate">{p.clientName}</span>{isRepair(p) && <RepairIcon small />}</div>
                  <div className="text-xs text-slate-400 truncate">{p.address}</div>
                </div>
                <div className="col-span-6 md:col-span-2 text-sm text-slate-300 flex items-center gap-1.5"><d.icon size={14} className="text-slate-500" />{d.label}</div>
                <div className="col-span-6 md:col-span-2 text-sm text-slate-300 truncate">{p.productType}</div>
                <div className="col-span-6 md:col-span-2 text-xs text-slate-400">
                  {status === "placed" || status === "received" ? <>ETA {fmtShort(p.materialEta)}</> :
                   status === "booked" ? <>{fmtShort(p.installDate)}{p.installEndDate !== p.installDate ? ` – ${fmtShort(p.installEndDate)}` : ""} · {p.installTime}</> :
                   <>Done {fmtShort((p.installedAt || "").slice(0, 10))}</>}
                </div>
                <div className="col-span-12 md:col-span-2 flex items-center justify-start md:justify-end gap-2 text-xs text-slate-400 flex-wrap">
                  <span className="truncate">PO {p.po} · {p.consultant}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}</span>
                  {hasOpenSnags(p) && <SnagFlag />}
                  <EtaBadge p={p} />
                  {isReserved(p) && <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${p.received ? "border-slate-400/60 text-slate-200" : "border-red-500 text-red-300"}`}>{p.reserveStage === "reserved" ? "Reserved" : "Planned"} {fmtShort(p.installDate)}</span>}
                  {showPartial(p) && <PartialBadge />}
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
// Phase 9.2 — older jobs were typed in by hand (e.g. "Rustique Sandelwood 9lm"). When one is opened
// for editing, each product line is matched back to the catalogue where possible so the dropdowns
// unlock and pre-fill. Matching rules (kept strict to avoid wrong guesses):
//   • the typed text must START with the range name, optionally preceded by the supplier name
//   • the longest matching range wins; if the same range name exists at two suppliers and the
//     supplier isn't typed, only the category is filled and supplier/range are left to pick by hand
//   • whatever follows the range becomes the colour; a trailing quantity is removed from it, and a
//     quantity in m² (m2, m², sqm) is copied into Area if Area is empty. Linear metres (lm) are not converted.
const QTY_TAIL = /\s*[,;-]?\s*(\d+(?:[.,]\d+)?)\s*(lm|m2|m²|sqm|sq\s?m|m)\s*$/i;
function matchLegacyLine(line, dept) {
  // Phase 14 — Wood's catalogue can't be reverse-matched from one free-text string (supplier, finish
  // type and board size are three separate pickers now), so a hand-typed entry is just flagged as
  // legacy for reference; the consultant re-picks it from the dropdowns.
  if (dept === "wood") {
    const next = { ...line, colour: line.colour || "" };
    if (line.productRange && line.supplier) return next;
    const raw = (line.productType || "").trim();
    return raw ? { ...next, _legacy: raw, _matched: false } : next;
  }
  // Phase 15 — Calore's cascade (type/unit type/free-text model) can't be reverse-matched from one
  // free-text string either, and it's a clean slate (no auto-match wanted) — same flag-and-re-pick
  // treatment as Wood.
  if (dept === "calore") {
    const next = { ...line, colour: line.colour || "" };
    if (next.ownFireplace || (next.calType && next.calUnitType)) return next;
    const raw = (line.productType || "").trim();
    return raw ? { ...next, _legacy: raw, _matched: false } : next;
  }
  const cats = categoriesOf(dept);
  if (!cats.length) return line;
  const next = { ...line, colour: line.colour || "" };
  if (!next.productCategory && cats.length === 1) next.productCategory = cats[0];
  if (line.productRange && line.supplier) return next; // already catalogued
  const raw = (line.productType || "").trim();
  if (!raw) return next;
  const rawN = raw.replace(/\s+/g, " ");
  const label = rawN.toLowerCase();
  const startsWord = (text, word) => text === word || text.startsWith(word + " ") || text.startsWith(word + ",");
  const hits = [];
  for (const cat of (next.productCategory ? [next.productCategory] : cats)) {
    for (const sup of suppliersOf(cat)) {
      const supL = sup.toLowerCase();
      const afterSup = startsWord(label, supL) ? label.slice(supL.length).trim() : null;
      for (const rng of rangesOf(cat, sup)) {
        const rngL = rng.toLowerCase();
        if (afterSup != null && startsWord(afterSup, rngL)) hits.push({ cat, sup, rng, withSup: true, rest: rawN.slice(label.length - afterSup.length + rngL.length).trim() });
        else if (startsWord(label, rngL)) hits.push({ cat, sup, rng, withSup: false, rest: rawN.slice(rngL.length).trim() });
      }
    }
  }
  if (!hits.length) return { ...next, _legacy: raw, _matched: false };
  const best = Math.max(...hits.map((h) => h.rng.length));
  let top = hits.filter((h) => h.rng.length === best);
  if (top.some((h) => h.withSup)) top = top.filter((h) => h.withSup);
  if (new Set(top.map((h) => h.sup)).size > 1) {
    // same range name at more than one supplier — let the user choose
    const cat = new Set(top.map((h) => h.cat)).size === 1 ? top[0].cat : next.productCategory;
    return { ...next, productCategory: cat || "", _legacy: raw, _matched: false };
  }
  const h = top[0];
  let rest = h.rest.replace(/^[,;\-\s]+/, "");
  let area = next.area;
  const q = rest.match(QTY_TAIL);
  if (q) {
    const unit = q[2].toLowerCase().replace(/\s/g, "");
    if ((unit === "m2" || unit === "m²" || unit === "sqm") && (area === "" || area == null)) area = q[1].replace(",", ".");
    rest = rest.slice(0, q.index).trim();
  }
  const colour = next.colour || rest;
  return { ...next, productCategory: h.cat, supplier: h.sup, productRange: h.rng, colour, area, productType: composeProduct(h.sup, h.rng, colour), _legacy: raw, _matched: true };
}

// Whether a product line already has a real product picked (vs. still being a hand-typed legacy
// string) — Calore uses its own cascade fields instead of productRange, so it needs its own check.
const isLineCatalogued = (l, dept) => (dept === "calore" ? (!!l.ownFireplace || !!(l.calType && l.calUnitType)) : !!l.productRange);

// Phase 10.3 — the measurement boxes under each product line, per department
function LineMeasureFields({ dept, l, onColour, onChange }) {
  const m = measureOf(dept);
  if (m === "none") return null;
  const colour = l.supplier === OTHER_SUPPLIER ? null : <Field label="Colour (optional)"><input className={inputCls} value={l.colour || ""} onChange={(e) => onColour(e.target.value)} placeholder="e.g. Sandelwood" /></Field>;
  if (m === "qty") return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {colour}
      <Field label="Quantity"><input className={inputCls} value={l.qty || ""} onChange={(e) => onChange({ qty: e.target.value })} placeholder="e.g. 3 blinds" /></Field>
    </div>
  );
  if (m === "panels") return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {colour}
      <Field label="References"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={l.refs ?? ""} onChange={(e) => onChange({ refs: e.target.value })} placeholder="e.g. 6" /></Field>
      <Field label="Panels"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={l.panels ?? ""} onChange={(e) => onChange({ panels: e.target.value })} placeholder="e.g. 14" /></Field>
    </div>
  );
  if (m === "roll") {
    const locked = !!l.rollWidth && l.linearM !== "" && l.linearM != null;
    return (
      <>
        {colour}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Roll width">
            <select className={inputCls} value={l.rollWidth || ""} onChange={(e) => onChange({ rollWidth: e.target.value })}>
              <option value="">None</option>
              {ROLL_WIDTHS.map((w) => <option key={w} value={w}>{rollLabel(w)}</option>)}
            </select>
          </Field>
          <Field label="Linear m"><input type="number" min="0" step="0.01" inputMode="decimal" className={`${inputCls} ${!l.rollWidth ? "opacity-50" : ""}`} value={l.linearM ?? ""} disabled={!l.rollWidth} onChange={(e) => onChange({ linearM: e.target.value })} placeholder={l.rollWidth ? "e.g. 12.5" : "Pick width"} /></Field>
          <Field label="Area (m²)"><input type="number" min="0" step="0.01" inputMode="decimal" className={`${inputCls} ${locked ? "bg-[#161b22] text-emerald-200" : ""}`} value={l.area ?? ""} readOnly={locked} onChange={(e) => onChange({ area: e.target.value })} placeholder="e.g. 24.5" /></Field>
        </div>
        <div className="text-[11px] text-slate-500">{locked ? "m² worked out from roll width × linear metres." : "Pick a roll width and enter linear metres to work out m², or leave it on None and type the m² yourself."}</div>
      </>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {colour}
      <Field label="Area (m²)"><input type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} value={l.area ?? ""} onChange={(e) => onChange({ area: e.target.value })} placeholder="e.g. 24.5" /></Field>
    </div>
  );
}

/* Phase 11.2 — tap-to-pick calendar for dates (used for Material ETA). Opens as a small centred popup,
   so it behaves the same on phones and desktop. Value is "YYYY-MM-DD" like the rest of the app. */
function DatePicker({ value, onChange, placeholder = "Pick a date" }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (value || todayIso()).slice(0, 7)); // "YYYY-MM"
  const openPicker = () => { setMonth((value || todayIso()).slice(0, 7)); setOpen(true); };
  const first = `${month}-01`;
  const lead = (fromIso(first).getDay() + 6) % 7; // blank cells before the 1st (week starts Monday)
  const dim = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${month}-${pad(i + 1)}`)];
  const shift = (n) => { const d = fromIso(first); d.setMonth(d.getMonth() + n); setMonth(iso(d).slice(0, 7)); };
  const today = todayIso();
  const pickDate = (d) => { onChange(d); setOpen(false); };
  return (
    <>
      <button type="button" onClick={openPicker} className={`${inputCls} flex items-center gap-2 text-left`}>
        <Calendar size={15} className="text-slate-400 shrink-0" />
        <span className={value ? "text-slate-100" : "text-slate-500"}>{value ? fmt(value) : placeholder}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-xs bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => shift(-1)} className="p-2 rounded-lg hover:bg-[#21262d] text-slate-300" aria-label="Previous month"><ChevronLeft size={18} /></button>
              <span className="text-sm font-semibold text-white">{fromIso(first).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}</span>
              <button type="button" onClick={() => shift(1)} className="p-2 rounded-lg hover:bg-[#21262d] text-slate-300" aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 text-[11px] text-slate-500 text-center mb-1">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => d ? (
                <button type="button" key={d} onClick={() => pickDate(d)}
                  className={`h-10 rounded-lg text-sm tabular-nums ${d === value ? "bg-[#1f6feb] text-white font-semibold" : d === today ? "border border-[#1f6feb] text-white" : isWeekend(d) ? "text-slate-500 hover:bg-[#21262d]" : "text-slate-200 hover:bg-[#21262d]"}`}>
                  {Number(d.slice(8))}
                </button>
              ) : <div key={`b${i}`} />)}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#30363d]">
              <button type="button" onClick={() => pickDate(today)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-[#21262d] text-slate-300">Today</button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-[#21262d] text-slate-400">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProjectForm({ initial, user, isCoord, isTest, allowedDepts, onClose, onSave, reservedStock = [] }) {
  const deptOptions = allowedDepts ? DEPARTMENTS.filter((d) => allowedDepts.includes(d.id)) : DEPARTMENTS;
  const [f, setF] = useState(() => {
    const defaultDept = (allowedDepts && allowedDepts.length) ? allowedDepts[0] : "blinds";
    const base = initial ? { ...initial, lineItems: initial.lineItems || [], team: initial.team || teamsOf(initial.department)[0], overlock: !!initial.overlock, overlockSizes: (initial.overlockSizes && initial.overlockSizes.length) ? initial.overlockSizes : [""] } : {
      clientName: "", contact: "", address: "", po: "", consultant: CONSULTANTS[0], department: defaultDept, team: teamsOf(defaultDept)[0],
      productType: "", productCategory: "", supplier: "", productRange: "",
      productLines: [], lineItems: [], materialEta: todayIso(), installDays: 1, estHours: "", jobCards: [],
      isRepair: false, repairNeedsMaterial: true,
      overlock: false, overlockSizes: [""],
      fromInventory: false, inventoryItemId: "",
    };
    // Seed the product-line list for catalogued departments (carries old single-product jobs across)
    if (hasCatalog(base.department)) {
      let lines = (Array.isArray(base.productLines) && base.productLines.length) ? base.productLines : productLinesOf(base);
      if (!lines.length) lines = [newLine(base.department)];
      base.productLines = lines.map((l) => matchLegacyLine({ ...l, id: l.id || uid() }, base.department));
    } else {
      base.productLines = [];
    }
    return base;
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const fileRef = useRef();
  const testMode = isTest || !!(initial && initial.isTest);

  const setDept = (dept) => setF((s) => {
    const cats = categoriesOf(dept);
    const next = { ...s, department: dept, team: teamsOf(dept).includes(s.team) ? s.team : teamsOf(dept)[0] };
    if (hasCatalog(dept)) {
      // keep the current lines only if every one still belongs to this department's categories
      const keep = (s.productLines || []).length > 0 && (s.productLines || []).every((l) => !l.productCategory || cats.includes(l.productCategory));
      next.productLines = keep ? s.productLines : [newLine(dept)];
      next.productType = ""; next.productCategory = ""; next.supplier = ""; next.productRange = "";
    } else {
      next.productLines = [];
    }
    return next;
  });

  // Per-line catalogue pickers — each level clears the ones below it and rewrites that line's label
  const updProdLine = (id, patch) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  // A hand-typed entry (l._legacy) is only replaced once a range is actually picked
  const setLineCategory = (id, cat) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, productCategory: cat, supplier: "", productRange: "", productType: l._legacy || "" } : l)) }));
  const setLineSupplier = (id, sup) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, supplier: sup, productRange: "", productType: l._legacy || "" } : l)) }));
  const setLineRange = (id, rng) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, productRange: rng, productType: rng ? composeProduct(l.supplier, rng, l.colour) : (l._legacy || "") } : l)) }));
  const setLineColour = (id, colour) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, colour, productType: l.productRange ? composeProduct(l.supplier, l.productRange, colour, l.boardSize) : l.productType } : l)) }));
  // Phase 14 — Wood's own cascade: supplier -> finish type -> range -> (size, when the range has more than one)
  const setLineWoodSupplier = (id, sup) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, supplier: sup, finish: "", productRange: "", boardSize: "", productType: l._legacy || "" } : l)) }));
  const setLineWoodFinish = (id, finish) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, finish, productRange: "", boardSize: "", productType: l._legacy || "" } : l)) }));
  const setLineWoodRange = (id, name) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => {
    if (l.id !== id) return l;
    const obj = woodRangeObj(l.supplier, l.finish, name);
    const boardSize = obj && obj.sizes.length === 1 ? obj.sizes[0] : "";
    return { ...l, productRange: name, boardSize, productType: name ? composeProduct(l.supplier, name, l.colour, boardSize) : (l._legacy || "") };
  }) }));
  const setLineWoodSize = (id, size) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => (l.id === id ? { ...l, boardSize: size, productType: composeProduct(l.supplier, l.productRange, l.colour, size) } : l)) }));
  // Phase 15 — Calore's own cascade: supplier -> type -> unit type -> free-text model; a single patch
  // object keeps this to one setter. Changing an earlier level clears the ones below it, and ticking
  // "client's own fireplace" clears and skips the whole cascade.
  const setLineCalore = (id, patch) => setF((s) => ({ ...s, productLines: s.productLines.map((l) => {
    if (l.id !== id) return l;
    let merged = { ...l, ...patch };
    if ("ownFireplace" in patch) merged = { ...merged, supplier: "", calType: "", calUnitType: "", model: "" };
    else if ("supplier" in patch) merged = { ...merged, calType: "", calUnitType: "" };
    else if ("calType" in patch) merged = { ...merged, calUnitType: "" };
    merged.productType = merged.ownFireplace ? "Client's own fireplace" : merged.supplier === OTHER_SUPPLIER ? (merged.model || "") : ([merged.supplier, merged.calType, merged.calUnitType, merged.model].filter(Boolean).join(" ") || (l._legacy || ""));
    return merged;
  }) }));
  const addProdLine = () => setF((s) => ({ ...s, productLines: [...s.productLines, newLine(s.department)] }));
  const delProdLine = (id) => setF((s) => ({ ...s, productLines: s.productLines.length > 1 ? s.productLines.filter((l) => l.id !== id) : s.productLines }));

  const addLine = () => set("lineItems", [...f.lineItems, { id: uid(), description: "", qty: "", received: false }]);
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

  // Phase 11 — new jobs: PO must be exactly 6 digits (saved as "PL 123456"). Existing jobs keep whatever they had.
  const [poNum, setPoNum] = useState("");
  const poOk = initial ? !!(f.po || "").trim() : poNum.length === 6;
  // A repair with no material skips the ETA and goes straight to Ready to book
  const noMaterial = !initial && f.isRepair && !f.repairNeedsMaterial;
  const invOk = initial || !f.fromInventory || reservedStock.some((x) => x.id === f.inventoryItemId); // Phase 12B
  const valid = f.clientName.trim() && poOk && (noMaterial || f.materialEta || (initial && initial.received)) && invOk;
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    const now = new Date().toISOString();
    const lineItems = f.lineItems.filter((li) => li.description.trim())
      .map((li) => ({ ...li, qty: (li.qty === "" || li.qty == null) ? null : Number(li.qty) }));
    const base = { ...f, lineItems, installDays: Number(f.installDays) || 1, estHours: f.estHours === "" ? null : Number(f.estHours) };
    if (!initial) base.po = formatPo(poNum);
    base.isRepair = !!f.isRepair;
    if (!base.isRepair) delete base.repairNeedsMaterial;
    if (noMaterial) base.materialEta = null;
    if (hasCatalog(f.department)) {
      // keep only lines that actually have a product; store area as a number
      const lines = (f.productLines || []).filter((l) => l.productRange || l.productType)
        .map(({ _legacy, _matched, ...l }) => {
          const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
          const rolled = l.rollWidth && num(l.linearM) != null;
          return {
            ...l, colour: (l.colour || "").trim(),
            rollWidth: l.rollWidth || "", linearM: num(l.linearM),
            area: rolled ? rollArea(l.rollWidth, l.linearM) || null : num(l.area),
            qty: (l.qty || "").toString().trim(), refs: num(l.refs), panels: num(l.panels),
          };
        });
      base.productLines = lines;
      const first = lines[0];
      base.productType = first ? first.productType : "";
      base.supplier = first ? first.supplier : "";
      base.productRange = first ? first.productRange : "";
      base.productCategory = first ? first.productCategory : "";
      base.area = first ? first.area : null;
      base.colour = first ? first.colour : "";
    } else {
      base.productLines = [];
    }
    // Phase 12A — overlocking only applies to Carpets; sizes are free text, blanks dropped
    const olOn = f.department === "carpets" && !!f.overlock;
    const olWas = !!(initial && hasOverlock(initial));
    base.overlock = olOn;
    base.overlockSizes = olOn ? (f.overlockSizes || []).map((x) => (x || "").trim()).filter(Boolean) : [];
    if (!olOn) { base.overlockStage = null; base.overlockOrderedAt = null; base.overlockOrderedBy = null; base.overlockReceivedAt = null; base.overlockReceivedBy = null; }
    else if (!olWas) { base.overlockStage = null; }
    const createdText = `${isTest ? "Test project" : base.isRepair ? "Repair" : "Project"} created${noMaterial ? " — no material required, ready to book" : ""}${olOn ? " · overlocking required" : ""}`;
    // Phase 12B — new jobs only: link a reserved stock item
    if (!initial) {
      const item = f.fromInventory ? reservedStock.find((x) => x.id === f.inventoryItemId) : null;
      delete base.fromInventory;
      if (item) {
        base.inventoryItemId = item.id;
        base.inventoryItemLabel = [item.description, item.size].filter(Boolean).join(" · ");
      } else { delete base.inventoryItemId; }
    }
    if (initial && olOn !== olWas) {
      base.log = [...(initial.log || []), { id: uid(), text: olOn ? "Overlocking required" : "Overlocking no longer required", author: user.name, createdAt: now }];
    }
    const p = initial
      ? base
      : { ...base, id: uid(), createdAt: now, createdBy: user.name, installed: false,
          ...(noMaterial ? { status: "received", received: true, receivedAt: now } : { status: "ordered", received: false }),
          ...(isTest ? { isTest: true } : {}),
          log: [{ id: uid(), text: base.inventoryItemId ? `${createdText} · from inventory: ${base.inventoryItemLabel}` : createdText, author: user.name, createdAt: now }] };
    await onSave(p);
    setBusy(false);
  };

  return (
    <Modal title={initial ? (initial.isTest ? "Edit test project" : "Edit project") : (isTest ? "New test project" : "New project")} onClose={onClose} wide>
      {testMode && (
        <div className="mb-4 text-xs text-orange-200 bg-orange-500/10 border border-orange-500/40 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={14} /> Test project — visible to developers only, and dropped from reports and searches once deleted.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Phase 11 — project type */}
        <div className="md:col-span-2">
          <div className="text-xs text-slate-400 mb-1">Project type</div>
          <div className="flex gap-1 bg-[#0d1117] border border-[#30363d] rounded-xl p-1 w-fit">
            {[[false, "Installation"], [true, "Repair"]].map(([rep, label]) => (
              <button key={label} type="button" onClick={() => set("isRepair", rep)}
                className={`px-4 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${!!f.isRepair === rep ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#21262d]"}`}>
                {rep && <Wrench size={14} />}{label}
              </button>
            ))}
          </div>
          {f.isRepair && !initial && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-200">Material required?</span>
              <div className="flex gap-1 bg-[#0d1117] border border-[#30363d] rounded-xl p-1">
                {[[true, "Yes"], [false, "No"]].map(([v, label]) => (
                  <button key={label} type="button" onClick={() => set("repairNeedsMaterial", v)}
                    className={`px-4 py-1 rounded-lg text-sm ${f.repairNeedsMaterial === v ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#21262d]"}`}>{label}</button>
                ))}
              </div>
              <span className="text-xs text-slate-500">{f.repairNeedsMaterial ? "Follows the normal ordered → received flow." : "Goes straight to Ready to book."}</span>
            </div>
          )}
        </div>
        <Field label="Client name"><input className={inputCls} value={f.clientName} onChange={(e) => set("clientName", e.target.value)} autoFocus /></Field>
        <Field label="Contact number"><input className={inputCls} value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
        <div className="md:col-span-2"><Field label="Address"><input className={inputCls} value={f.address} onChange={(e) => set("address", e.target.value)} /></Field></div>
        {initial ? (
          <Field label="Purchase order number"><input className={inputCls} value={f.po} onChange={(e) => set("po", e.target.value)} /></Field>
        ) : (
          <Field label="Purchase order number (6 digits)">
            <div className="flex items-stretch">
              <span className="px-3 flex items-center rounded-l-lg border border-r-0 border-[#30363d] bg-[#21262d] text-sm text-slate-300 font-medium">PL</span>
              <input className={`${inputCls} rounded-l-none`} inputMode="numeric" value={poNum} onChange={(e) => setPoNum(poDigits(e.target.value))} placeholder="123456" />
            </div>
            {poNum.length > 0 && poNum.length < 6 && <div className="text-xs text-amber-300 mt-1">{6 - poNum.length} more digit{6 - poNum.length === 1 ? "" : "s"} needed</div>}
          </Field>
        )}
        <Field label="Consultant">
          <select className={inputCls} value={f.consultant} onChange={(e) => set("consultant", e.target.value)}>
            {CONSULTANTS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Department">
          <select className={inputCls} value={f.department} onChange={(e) => setDept(e.target.value)}>
            {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Install team">
          <select className={inputCls} value={f.team} onChange={(e) => set("team", e.target.value)} disabled={!isCoord}>
            {teamsOf(f.department).map((t) => <option key={t} value={t}>{teamLabel(f.department, t)}</option>)}
          </select>
        </Field>
        {noMaterial ? (
          <Field label="Material ETA"><div className="text-sm text-slate-500 py-2">Not needed — no material on this repair</div></Field>
        ) : (
          <Field label="Material ETA">
            {f.materialEta === ETA_TBC ? (
              <div className="flex items-center gap-2">
                <div className={`${inputCls} flex-1 text-slate-400`}>To be confirmed</div>
                <button type="button" onClick={() => set("materialEta", todayIso())} className="text-xs px-3 py-2 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#21262d] shrink-0">Set a date</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1"><DatePicker value={f.materialEta || ""} onChange={(v) => set("materialEta", v)} /></div>
                <button type="button" onClick={() => set("materialEta", ETA_TBC)} className="text-xs px-3 py-2 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#21262d] shrink-0">TBC</button>
              </div>
            )}
          </Field>
        )}
        <Field label="Estimated install duration (working days)"><input type="number" min="1" max="30" className={inputCls} value={f.installDays} onChange={(e) => set("installDays", e.target.value)} /></Field>
        <div className="md:col-span-2">
          <Field label="Estimated hours on site per day (used by Availability; blank = 4h)"><input type="number" min="1" max="10" step="0.5" className={inputCls} value={f.estHours ?? ""} onChange={(e) => set("estHours", e.target.value)} placeholder="4" /></Field>
        </div>

        {/* Products + line items */}
        <div className="md:col-span-2 border border-[#30363d] rounded-xl p-4">
          {hasCatalog(f.department) ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">Products — add a line for each range or colour (e.g. one per room)</div>
              {f.productLines.map((l, idx) => (
                <div key={l.id} className="border border-[#30363d] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{idx === 0 ? "Main product" : `Product ${idx + 1}`}</span>
                    {f.productLines.length > 1 && <button onClick={() => delProdLine(l.id)} className="p-1 rounded-md hover:bg-[#21262d] text-slate-400" title="Remove this product"><X size={13} /></button>}
                  </div>
                  {categoriesOf(f.department).length > 1 && (
                    <Field label="Product category">
                      <select className={inputCls} value={l.productCategory || ""} onChange={(e) => setLineCategory(l.id, e.target.value)}>
                        <option value="">Select a category…</option>
                        {categoriesOf(f.department).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                  )}
                  {f.department === "wood" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Field label="Supplier">
                          <select className={inputCls} value={l.supplier || ""} onChange={(e) => setLineWoodSupplier(l.id, e.target.value)}>
                            <option value="">Select a supplier…</option>
                            {woodSuppliers().map((s) => <option key={s} value={s}>{s}</option>)}
                            <option value={OTHER_SUPPLIER}>Other (not listed)</option>
                          </select>
                        </Field>
                        {l.supplier !== OTHER_SUPPLIER && (
                          <Field label="Finish type">
                            <select className={inputCls} value={l.finish || ""} onChange={(e) => setLineWoodFinish(l.id, e.target.value)} disabled={!l.supplier}>
                              <option value="">{l.supplier ? "Select a finish type…" : "Pick a supplier first"}</option>
                              {woodFinishes(l.supplier).map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                            </select>
                          </Field>
                        )}
                      </div>
                      {l.supplier === OTHER_SUPPLIER ? (
                        <Field label="Product description"><input className={inputCls} value={l.productRange || ""} onChange={(e) => updProdLine(l.id, { productRange: e.target.value, productType: e.target.value })} placeholder="e.g. Joma Herringbone Oak, Natural" /></Field>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Field label="Range">
                            <select className={inputCls} value={l.productRange || ""} onChange={(e) => setLineWoodRange(l.id, e.target.value)} disabled={!l.finish}>
                              <option value="">{l.finish ? "Select a range…" : "Pick a finish type first"}</option>
                              {woodRanges(l.supplier, l.finish).map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                            </select>
                          </Field>
                          {(() => {
                            const obj = woodRangeObj(l.supplier, l.finish, l.productRange);
                            if (!obj || obj.sizes.length < 2) return null;
                            return (
                              <Field label="Size">
                                <select className={inputCls} value={l.boardSize || ""} onChange={(e) => setLineWoodSize(l.id, e.target.value)}>
                                  <option value="">Select a size…</option>
                                  {obj.sizes.map((sz) => <option key={sz} value={sz}>{sz}</option>)}
                                </select>
                              </Field>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  ) : f.department === "calore" ? (
                    <>
                      <label className="flex items-center gap-2 text-sm text-slate-200 select-none cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" checked={!!l.ownFireplace} onChange={(e) => setLineCalore(l.id, { ownFireplace: e.target.checked })} />
                        Installing the client's own fireplace
                      </label>
                      {!l.ownFireplace && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Field label="Supplier">
                              <select className={inputCls} value={l.supplier || ""} onChange={(e) => setLineCalore(l.id, { supplier: e.target.value })}>
                                <option value="">Select a supplier…</option>
                                {caloreSuppliers().map((s) => <option key={s} value={s}>{s}</option>)}
                                <option value={OTHER_SUPPLIER}>Other (not listed)</option>
                              </select>
                            </Field>
                            {l.supplier !== OTHER_SUPPLIER && (
                              <Field label="Type">
                                <select className={inputCls} value={l.calType || ""} onChange={(e) => setLineCalore(l.id, { calType: e.target.value })} disabled={!l.supplier}>
                                  <option value="">{l.supplier ? "Select a type…" : "Pick a supplier first"}</option>
                                  {caloreTypes(l.supplier).map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </Field>
                            )}
                          </div>
                          {l.supplier === OTHER_SUPPLIER ? (
                            <Field label="Product description"><input className={inputCls} value={l.model || ""} onChange={(e) => setLineCalore(l.id, { model: e.target.value })} placeholder="e.g. Jydepejsen Norca 8kW wood-burning insert" /></Field>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Field label="Unit type">
                                <select className={inputCls} value={l.calUnitType || ""} onChange={(e) => setLineCalore(l.id, { calUnitType: e.target.value })} disabled={!l.calType}>
                                  <option value="">{l.calType ? "Select a unit type…" : "Pick a type first"}</option>
                                  {caloreUnitTypes(l.supplier, l.calType).map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </Field>
                              <Field label="Model name"><input className={inputCls} value={l.model || ""} onChange={(e) => setLineCalore(l.id, { model: e.target.value })} placeholder="e.g. Calore Vesta 700" /></Field>
                            </div>
                          )}
                        </>
                      )}
                      <Field label="Serial number (internal, optional)"><input className={inputCls} value={l.serial || ""} onChange={(e) => updProdLine(l.id, { serial: e.target.value })} placeholder="e.g. SN-004821" /></Field>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="Supplier">
                        <select className={inputCls} value={l.supplier || ""} onChange={(e) => setLineSupplier(l.id, e.target.value)} disabled={!l.productCategory}>
                          <option value="">{l.productCategory ? "Select a supplier…" : "Pick a category first"}</option>
                          {suppliersOf(l.productCategory).map((s) => <option key={s} value={s}>{s}</option>)}
                          <option value={OTHER_SUPPLIER}>Other (not listed)</option>
                        </select>
                      </Field>
                      {l.supplier === OTHER_SUPPLIER ? (
                        <Field label="Product description"><input className={inputCls} value={l.productRange || ""} onChange={(e) => updProdLine(l.id, { productRange: e.target.value, productType: e.target.value })} placeholder="e.g. Vescom Odetta, White" /></Field>
                      ) : (
                        <Field label="Range">
                          <select className={inputCls} value={l.productRange || ""} onChange={(e) => setLineRange(l.id, e.target.value)} disabled={!l.supplier}>
                            <option value="">{l.supplier ? "Select a range…" : "Pick a supplier first"}</option>
                            {rangesOf(l.productCategory, l.supplier).map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </Field>
                      )}
                    </div>
                  )}
                  {f.department !== "calore" && (
                    <LineMeasureFields dept={f.department} l={l}
                      onColour={(v) => setLineColour(l.id, v)}
                      onChange={(patch) => {
                        const next = { ...l, ...patch };
                        // Carpets: roll width × linear metres fills in m² (and the m² box locks while both are set)
                        if (measureOf(f.department) === "roll" && ("rollWidth" in patch || "linearM" in patch) && next.rollWidth && next.linearM !== "" && next.linearM != null) patch = { ...patch, area: rollArea(next.rollWidth, next.linearM) };
                        updProdLine(l.id, patch);
                      }} />
                  )}
                  {l._legacy && isLineCatalogued(l, f.department) && (
                    <div className="text-xs text-sky-300/90 bg-sky-500/10 border border-sky-500/30 rounded-lg px-3 py-2">
                      Matched from the typed entry <span className="text-sky-100">{l._legacy}</span>. Check the details above, then save.
                    </div>
                  )}
                  {l._legacy && !isLineCatalogued(l, f.department) && (
                    <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                      Existing entry: <span className="text-amber-100">{l._legacy}</span> (typed in by hand). Pick from the options above to replace it, or leave it as it is.
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addProdLine} className={`${btnGhost} flex items-center gap-1.5 text-xs py-1.5`}><Plus size={14} /> Add product line</button>
            </div>
          ) : (
            <Field label="Main line item (product)"><input className={inputCls} value={f.productType} onChange={(e) => set("productType", e.target.value)} placeholder="e.g. Engineered oak flooring 45m²" /></Field>
          )}
          <div className="text-xs text-slate-400 mt-4 mb-2">Additional line items — trims, adhesive, moisture barrier, etc.</div>
          <div className="space-y-2">
            {f.lineItems.map((li) => (
              <div key={li.id} className="flex items-center gap-2">
                <input className={`${inputCls} flex-1`} value={li.description} onChange={(e) => updLine(li.id, { description: e.target.value })} placeholder="Item description" />
                <input type="number" min="0" step="1" className={`${inputCls} w-20 shrink-0`} value={li.qty ?? ""} onChange={(e) => updLine(li.id, { qty: e.target.value })} placeholder="Qty" title="Quantity" />
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

        {/* Phase 12B — new jobs only: supplied from a reserved stock item */}
        {!initial && (
          <div className={`md:col-span-2 border rounded-xl p-4 ${f.fromInventory ? "border-teal-500/50 bg-teal-500/5" : "border-[#30363d]"}`}>
            <label className={`flex items-center gap-3 select-none ${reservedStock.length ? "cursor-pointer" : "opacity-60"}`}>
              <input type="checkbox" className="w-4 h-4" disabled={!reservedStock.length} checked={!!f.fromInventory} onChange={(e) => set("fromInventory", e.target.checked)} />
              <span className="text-sm text-slate-100 font-medium flex items-center gap-1.5"><Boxes size={15} className="text-teal-300" /> From inventory</span>
              <span className="text-xs text-slate-500 ml-auto text-right">{reservedStock.length ? `${reservedStock.length} reserved item${reservedStock.length === 1 ? "" : "s"}` : "No reserved stock at the moment"}</span>
            </label>
            {f.fromInventory && (
              <select className={`${inputCls} mt-3`} value={f.inventoryItemId} onChange={(e) => set("inventoryItemId", e.target.value)}>
                <option value="">Choose a reserved item…</option>
                {reservedStock.map((x) => (
                  <option key={x.id} value={x.id}>{[x.description, x.size, x.soldNote ? `for ${x.soldNote}` : "", x.reservedBy ? `(${x.reservedBy})` : ""].filter(Boolean).join(" · ")}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Phase 12A — overlocking (Carpets only) */}
        {f.department === "carpets" && (
          <div className={`md:col-span-2 border rounded-xl p-4 ${f.overlock ? "border-amber-500/50 bg-amber-500/5" : "border-[#30363d]"}`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4" checked={!!f.overlock} onChange={(e) => set("overlock", e.target.checked)} />
              <span className="text-sm text-slate-100 font-medium">Overlocking required</span>
              <span className="text-xs text-slate-500 ml-auto text-right">Adds 2 to 3 weeks to lead time — order it early</span>
            </label>
            {f.overlock && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-slate-400">Sizes to overlock</div>
                {(f.overlockSizes || [""]).map((sz, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={`${inputCls} flex-1`} value={sz} placeholder={i === 0 ? "e.g. 2.4 x 1.8 m lounge rug" : "Another size"}
                      onChange={(e) => set("overlockSizes", (f.overlockSizes || [""]).map((x, j) => (j === i ? e.target.value : x)))} />
                    {(f.overlockSizes || []).length > 1 && (
                      <button onClick={() => set("overlockSizes", f.overlockSizes.filter((_, j) => j !== i))} className="p-1.5 rounded-md hover:bg-[#21262d] text-slate-400 shrink-0" title="Remove this size"><X size={14} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => set("overlockSizes", [...(f.overlockSizes || []), ""])} className={`${btnGhost} flex items-center gap-1.5 text-xs py-1.5`}><Plus size={14} /> Add more sizes</button>
              </div>
            )}
          </div>
        )}

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
function ProjectDetail({ project: p, user, level, isCoord, canEdit, isDev, save, onClose, onEdit, reviews, onSubmitReview, onInventoryPrompt }) {
  const d = deptOf(p.department);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [snagModal, setSnagModal] = useState(false);
  const [resolving, setResolving] = useState(null); // snag being resolved
  const [addingDay, setAddingDay] = useState(false);
  const [partialEdit, setPartialEdit] = useState(null); // Phase 11 — { kind: "main" | "pl" | "li", id, label, on, note }
  // Phase 12C — confidential installation reviews
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewKey = `nolans_reviewed_${p.id}_${user.pin || user.name}`;
  const [reviewedHere, setReviewedHere] = useState(() => { try { return [...pinsOf(user), user.name].some((x) => x && localStorage.getItem(`nolans_reviewed_${p.id}_${x}`)); } catch { return false; } });
  const canReview = (level ?? 0) >= 1 && !!onSubmitReview;
  const showReviewPrompt = canReview && p.status === "installed" && p.consultant === user.name && !reviewedHere;
  const noMaterialRepair = isRepair(p) && p.repairNeedsMaterial === false;
  const now = () => new Date().toISOString();
  const log = (text, base = p) => [...(base.log || []), { id: uid(), text, author: user.name, createdAt: now() }];
  const schedule = scheduleOf(p);
  const lineItems = p.lineItems || [];
  const snags = p.snags || [];
  const open = openSnags(p);
  const canSnag = level >= 1;
  // Phase 17 — notes on a job: open to everyone, shown just below client details, newest first
  const [noteText, setNoteText] = useState("");
  const notes = [...(p.notes || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const addNote = () => {
    const t = noteText.trim(); if (!t) return;
    const note = { id: uid(), author: user.name, text: t, createdAt: now() };
    save({ ...p, notes: [...(p.notes || []), note], log: log(`Note added: "${t}"`) }, "Note added");
    setNoteText("");
  };

  // A co-ordinator for this job's department acknowledges its new snags (clears the "new" badge)
  useEffect(() => {
    if (canEdit && open.some((s) => !s.acknowledged)) {
      save({ ...p, snags: snags.map((s) => (s.resolved ? s : { ...s, acknowledged: true })) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const markReceived = () => save({ ...p, status: "received", received: true, receivedAt: now(), log: log("Main item received") }, "Marked as received");
  const undoReceived = () => save({ ...p, status: "ordered", received: false, receivedAt: null, log: log("Received undone") }, "Moved back to placed");
  const markInstalled = () => {
    save({ ...p, status: "installed", installed: true, installedAt: now(), log: log("Installation completed") }, "Marked as completed");
    if ((isCoord || isDev) && onInventoryPrompt && !p.isTest) onInventoryPrompt({ project: p, source: "completion" }); // Phase 12B — anything going to stock?
  };
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

  // Phase 11 — flag (or clear) a line as partially received, with a short note
  const savePartial = ({ kind, id, label }, on, note) => {
    const n = on ? (note || "").trim() : "";
    let next = { ...p };
    if (kind === "main") next = { ...next, mainPartial: on, mainPartialNote: n };
    if (kind === "pl") next = { ...next, productLines: productLinesOf(p).map((l) => (l.id === id ? { ...l, partial: on, partialNote: n } : l)) };
    if (kind === "li") next = { ...next, lineItems: lineItems.map((l) => (l.id === id ? { ...l, partial: on, partialNote: n } : l)) };
    save({ ...next, log: log(on ? `Partially received: ${label}${n ? ` — ${n}` : ""}` : `Partial flag cleared: ${label}`) }, on ? "Flagged as partially received" : "Partial flag cleared");
    setPartialEdit(null);
  };
  // Phase 11 — confirm snag material has been ordered (same as the home screen reminder)
  const snagMaterialOrdered = (snag) => {
    const next = snags.map((s) => (s.id === snag.id ? { ...s, materialOrdered: true, materialOrderedBy: user.name, materialOrderedAt: now() } : s));
    save({ ...p, snags: next, log: log(`Snag material ordered${snag.materialNote ? `: ${snag.materialNote}` : ""}`) }, "Snag material marked as ordered");
    if (onInventoryPrompt && !p.isTest) onInventoryPrompt({ project: p, source: "snag", note: snag.materialNote || "" }); // Phase 12B
  };
  // A small "partially received" control for one line
  const partialCtl = (target, on, note, allowed) => (
    on ? (
      <button disabled={!canEdit} onClick={() => setPartialEdit({ ...target, on, note })} title={note || "Partially received"}
        className={`text-xs px-2 py-1 rounded-lg border border-yellow-500/50 text-yellow-300 flex items-center gap-1 ${canEdit ? "hover:bg-yellow-500/10" : "cursor-default"}`}>
        <PartialBadge /> Partial
      </button>
    ) : (canEdit && allowed) ? (
      <button onClick={() => setPartialEdit({ ...target, on, note: "" })} className="text-xs px-2 py-1 rounded-lg border border-[#30363d] text-slate-400 hover:bg-[#21262d]">Flag partial</button>
    ) : null
  );
  const partialNote = (on, note) => (on && note ? <div className="text-xs text-yellow-200/80 pb-1.5 -mt-0.5">Partial: {note}</div> : null);

  // Phase 12A — overlocking: the job's own consultant or a co-ordinator for this department
  const canOverlock = canEdit || isDev || p.consultant === user.name;
  const overlockOrdered = () => save({ ...p, overlockStage: "ordered", overlockOrderedAt: now(), overlockOrderedBy: user.name, log: log(`Overlocking ordered${overlockSizesOf(p).length ? `: ${overlockSizesOf(p).join(", ")}` : ""}`) }, "Overlocking marked as ordered");
  const overlockReceived = () => save({ ...p, overlockStage: "received", overlockReceivedAt: now(), overlockReceivedBy: user.name, log: log("Overlocking received") }, "Overlocking received");

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
        {isRepair(p) && <span className="text-xs px-2 py-0.5 rounded-full border border-sky-500/50 text-sky-200 flex items-center gap-1"><RepairIcon small /> Repair{noMaterialRepair ? " · no material" : ""}</span>}
        {p.isTest && <span className="text-xs px-2 py-0.5 rounded-full border-2 border-orange-500 text-orange-300 font-semibold">TEST</span>}
        {p.invoiced && <span className="text-xs px-2 py-0.5 rounded-full border border-slate-500/30 text-slate-400">Invoiced</span>}
        <span className="text-xs text-slate-400 flex items-center gap-1"><d.icon size={14} /> {d.label}</span>
        <span className="text-xs text-slate-400">· {p.consultant}</span>
        {p.team && <span className="text-xs text-slate-400">· {teamLabel(p.department, p.team)}</span>}
        {p.received && p.status === "received" && <RBadge />}
        {partiallyReceived(p) && <span className="flex items-center gap-1 text-xs text-yellow-300"><PartialBadge /> not received in full</span>}
        {needsOverlock(p) && <span className="flex items-center gap-1 text-xs text-amber-300"><OverlockBadge p={p} /> overlocking {overlockStatusText(p)}</span>}
        {p.department === "calore" && p.coreDrilling && <span className="flex items-center gap-1 text-xs text-amber-300"><CoreDrillingBadge p={p} /> core drilling required</span>}
        {p.department === "calore" && p.escutcheonPlate && <span className="flex items-center gap-1 text-xs text-amber-300"><EscutcheonBadge p={p} /> custom escutcheon plate</span>}
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
        <Row icon={Truck} label="Material ETA" value={noMaterialRepair && !p.materialEta ? "Not required (repair)" : fmt(p.materialEta)} />
        <Row icon={Clock} label="Install estimate" value={`${p.installDays || 1} working day${(p.installDays || 1) > 1 ? "s" : ""} · ${hoursPerDay(p)}h per day`} />
        {schedule.length > 0 && (
          <div className="md:col-span-2">
            <Row icon={CalendarDays} label="Installation days" value={
              <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                {[...schedule].sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
                  <span key={s.dayIndex} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 flex items-center gap-1.5">
                    {s.dayIndex}/{schedule.length} · {fmt(s.date)}{s.time ? ` ${s.time}` : ""}{s.endTime ? `–${s.endTime}` : ""}
                    {canEdit && (p.status === "booked" || isReserved(p)) && schedule.length > 1 && (
                      <button onClick={() => removeDay(s.dayIndex)} title="Remove this day" className="text-emerald-300/70 hover:text-red-300"><X size={11} /></button>
                    )}
                  </span>
                ))}
                {canEdit && (p.status === "booked" || isReserved(p)) && (
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

      {/* Phase 17 — notes on a job: open to everyone, newest first, author + timestamp shown */}
      <div className="mt-4 border border-[#30363d] rounded-xl p-3">
        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5"><MessageSquarePlus size={14} /> Notes {notes.length > 0 && <span>· {notes.length}</span>}</div>
        <div className="flex items-center gap-2 mb-2">
          <input className={inputCls} value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add a note…" />
          <button onClick={addNote} disabled={!noteText.trim()} className={`${btnGhost} py-2 text-xs shrink-0 disabled:opacity-50`}>Add</button>
        </div>
        {notes.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.map((n) => (
              <div key={n.id} className="text-sm bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2">
                <div className="text-slate-100">{n.text}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{n.author} · {ago(n.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase 10.3 — Shutters: schedule of works submitted. Anyone signed in can tick it; the history records who. */}
      {p.department === "shutters" && (
        <label className={`mt-4 flex items-center gap-3 border rounded-xl px-3 py-2.5 ${p.sowSubmitted ? "border-emerald-500/40 bg-emerald-500/5" : "border-[#30363d]"} ${(user.level ?? 0) >= 1 ? "cursor-pointer" : "opacity-70"}`}>
          <input type="checkbox" className="w-4 h-4" checked={!!p.sowSubmitted} disabled={(user.level ?? 0) < 1}
            onChange={(e) => {
              const on = e.target.checked;
              save({ ...p, sowSubmitted: on, sowBy: on ? user.name : null, sowAt: on ? now() : null, log: log(on ? "SOW submitted" : "SOW submitted unticked") }, on ? "SOW marked as submitted" : "SOW unticked");
            }} />
          <span className="text-sm text-slate-100 font-medium">SOW Submitted</span>
          <span className="text-xs text-slate-400 ml-auto text-right">{p.sowSubmitted ? `${p.sowBy || ""}${p.sowAt ? ` · ${fmtShort(p.sowAt.slice(0, 10))}` : ""}` : "Schedule of works not yet submitted"}</span>
        </label>
      )}

      {/* Phase 15 — Calore smart prompts: plain flags, ticked at creation or any time after; anyone signed in can toggle */}
      {p.department === "calore" && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <label className={`flex-1 flex items-center gap-3 border rounded-xl px-3 py-2.5 ${p.coreDrilling ? "border-amber-500/50 bg-amber-500/5" : "border-[#30363d]"} ${(user.level ?? 0) >= 1 ? "cursor-pointer" : "opacity-70"}`}>
            <input type="checkbox" className="w-4 h-4" checked={!!p.coreDrilling} disabled={(user.level ?? 0) < 1}
              onChange={(e) => { const on = e.target.checked; save({ ...p, coreDrilling: on, log: log(on ? "Core drilling flagged as required" : "Core drilling no longer required") }, on ? "Core drilling marked as required" : "Core drilling unticked"); }} />
            <span className="text-sm text-slate-100 font-medium">Core drilling required</span>
          </label>
          <label className={`flex-1 flex items-center gap-3 border rounded-xl px-3 py-2.5 ${p.escutcheonPlate ? "border-amber-500/50 bg-amber-500/5" : "border-[#30363d]"} ${(user.level ?? 0) >= 1 ? "cursor-pointer" : "opacity-70"}`}>
            <input type="checkbox" className="w-4 h-4" checked={!!p.escutcheonPlate} disabled={(user.level ?? 0) < 1}
              onChange={(e) => { const on = e.target.checked; save({ ...p, escutcheonPlate: on, log: log(on ? "Custom escutcheon plate flagged as required" : "Custom escutcheon plate no longer required") }, on ? "Escutcheon plate marked as required" : "Escutcheon plate unticked"); }} />
            <span className="text-sm text-slate-100 font-medium">Custom escutcheon plate</span>
          </label>
        </div>
      )}

      {/* Phase 12A — overlocking */}
      {hasOverlock(p) && (
        <div className={`mt-4 border rounded-xl p-3 ${needsOverlock(p) ? "border-amber-500/50 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <OverlockBadge p={p} />
            <span className="text-sm text-slate-100 font-medium">Overlocking</span>
            <span className={`text-xs ${needsOverlock(p) ? "text-amber-300" : "text-emerald-300"}`}>· {overlockStatusText(p)}</span>
            <span className="ml-auto flex gap-2">
              {canOverlock && !p.overlockStage && <button onClick={overlockOrdered} className="text-xs px-2.5 py-1 rounded-lg border border-amber-500/60 text-amber-200 hover:bg-amber-500/15">Place order</button>}
              {canOverlock && p.overlockStage === "ordered" && <button onClick={overlockReceived} className="text-xs px-2.5 py-1 rounded-lg border border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/15">Mark overlocking received</button>}
            </span>
          </div>
          {overlockSizesOf(p).length > 0 && (
            <ul className="text-sm text-slate-300 mt-2 space-y-0.5">
              {overlockSizesOf(p).map((sz, i) => <li key={i}>• {sz}</li>)}
            </ul>
          )}
          {(p.overlockOrderedBy || p.overlockReceivedBy) && (
            <div className="text-xs text-slate-500 mt-2">
              {p.overlockOrderedBy && <span>Ordered by {p.overlockOrderedBy}{p.overlockOrderedAt ? ` on ${fmtShort(p.overlockOrderedAt.slice(0, 10))}` : ""}</span>}
              {p.overlockReceivedBy && <span> · Received by {p.overlockReceivedBy}{p.overlockReceivedAt ? ` on ${fmtShort(p.overlockReceivedAt.slice(0, 10))}` : ""}</span>}
            </div>
          )}
        </div>
      )}

      {/* Phase 12B — supplied from inventory */}
      {p.inventoryItemId && (
        <div className="mt-4 border border-teal-500/40 bg-teal-500/5 rounded-xl p-3 flex items-center gap-2 text-sm">
          <Boxes size={16} className="text-teal-300 shrink-0" />
          <span className="text-slate-300">From inventory:</span>
          <span className="text-slate-100">{p.inventoryItemLabel || "stock item"}</span>
          <span className="text-xs text-slate-500 ml-auto">{p.invoiced ? "removed from stock" : "removed from stock once invoiced"}</span>
        </div>
      )}

      {/* Line items */}
      <div className="mt-4 border border-[#30363d] rounded-xl p-3">
        <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Layers size={14} /> Line items</div>
        {productLinesOf(p).length > 0 ? productLinesOf(p).map((l, i) => (
          <div key={l.id || i} className={i > 0 ? "border-t border-[#30363d]" : ""}>
            <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="text-slate-100">{l.productType || l.productRange || "—"} {i === 0 && <span className="text-slate-500 text-xs">(main)</span>}{measureText(l, p.department) && <span className="text-slate-400 text-xs"> · {measureText(l, p.department)}</span>}{p.department === "calore" && l.serial && <span className="text-slate-500 text-xs"> · SN {l.serial}</span>}</span>
              <span className="flex items-center gap-2 shrink-0">
                {partialCtl({ kind: "pl", id: l.id, label: l.productType || l.productRange || "Product" }, !!l.partial, l.partialNote, p.received)}
                {i === 0 && (p.received ? <span className="text-xs text-emerald-300">Received</span> : <span className="text-xs text-slate-500">Not received</span>)}
              </span>
            </div>
            {partialNote(!!l.partial, l.partialNote)}
          </div>
        )) : (
          <div>
            <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="text-slate-100">{p.productType || "—"} <span className="text-slate-500 text-xs">(main)</span></span>
              <span className="flex items-center gap-2 shrink-0">
                {partialCtl({ kind: "main", label: p.productType || "Main item" }, !!p.mainPartial, p.mainPartialNote, p.received)}
                {p.received ? <span className="text-xs text-emerald-300">Received</span> : <span className="text-xs text-slate-500">Not received</span>}
              </span>
            </div>
            {partialNote(!!p.mainPartial, p.mainPartialNote)}
          </div>
        )}
        {lineItems.map((li) => (
          <div key={li.id} className="border-t border-[#30363d]">
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="text-slate-200">{li.description}{(li.qty != null && li.qty !== "") ? <span className="text-slate-400 text-xs"> · qty {li.qty}</span> : null}</span>
            <span className="flex items-center gap-2 shrink-0">
            {partialCtl({ kind: "li", id: li.id, label: li.description }, !!li.partial, li.partialNote, li.received)}
            {canEdit ? (
              <button onClick={() => toggleLine(li)} className={`text-xs px-2 py-1 rounded-lg border ${li.received ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" : "border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"}`}>
                {li.received ? "Received" : "Mark received"}
              </button>
            ) : (
              <span className={`text-xs ${li.received ? "text-emerald-300" : "text-yellow-300"}`}>{li.received ? "Received" : "Not received"}</span>
            )}
            </span>
          </div>
          {partialNote(!!li.partial, li.partialNote)}
          </div>
        ))}
        {lineItems.length === 0 && productLinesOf(p).length === 0 && <div className="text-xs text-slate-500 pt-1">No additional items.</div>}
      </div>

      {/* Phase 12C — installation review prompt once the job is completed */}
      {showReviewPrompt && (
        <div className="mt-4 border border-amber-400/40 bg-amber-400/5 rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <Star size={18} className="text-amber-300 shrink-0" />
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm text-slate-100 font-medium">This installation is complete</div>
            <div className="text-xs text-slate-400">Now that the dust has settled, would you like to leave a considered review of the install team? Reviews are confidential.</div>
          </div>
          <button onClick={() => setReviewOpen(true)} className="text-xs px-3 py-1.5 rounded-lg border border-amber-400/60 text-amber-200 hover:bg-amber-400/15">Leave review</button>
        </div>
      )}

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
                {s.materialRequired && (
                  <div className={`text-xs mt-1.5 flex items-center gap-2 flex-wrap ${s.materialOrdered ? "text-emerald-200/80" : "text-sky-200"}`}>
                    <PackageOpen size={13} />
                    <span>Material required{s.materialNote ? `: ${s.materialNote}` : ""}</span>
                    <span className="text-slate-500">·</span>
                    {s.materialOrdered
                      ? <span>Ordered by {s.materialOrderedBy} on {fmtShort((s.materialOrderedAt || "").slice(0, 10))}</span>
                      : <span className="text-sky-300 font-medium">To be ordered</span>}
                    {!s.materialOrdered && (isDev || canEdit || p.consultant === user.name) && (
                      <button onClick={() => snagMaterialOrdered(s)} className="px-2 py-0.5 rounded-lg border border-sky-500/50 text-sky-200 hover:bg-sky-500/15">Mark as ordered</button>
                    )}
                  </div>
                )}
                {s.resolved && <div className="text-xs text-emerald-200/80 mt-1">Resolved by {s.resolvedBy} on {fmtShort((s.resolvedAt || "").slice(0, 10))}: {s.resolveReason}</div>}
              </div>
              {!s.resolved && canSnag && <button onClick={() => setResolving(s)} className="text-xs px-2 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 shrink-0">Resolve</button>}
            </div>
          </div>
        ))}
      </div>

      {canReview && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {reviewedHere && <span className="text-[11px] text-slate-500 flex items-center gap-1"><ShieldCheck size={12} /> You've reviewed this installation</span>}
          <button onClick={() => setReviewOpen(true)} className="text-xs px-2.5 py-1 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#21262d] flex items-center gap-1.5"><Star size={12} /> Leave installation review</button>
        </div>
      )}

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

      {canEdit ? (
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
          {p.status === "received" && !isReserved(p) && !noMaterialRepair && <button onClick={undoReceived} className={btnGhost}>Undo received</button>}
          {p.status === "booked" && <button onClick={markInstalled} className={btnPrimary}>Mark as completed</button>}
          {p.status === "booked" && <button onClick={unbook} className={btnGhost}>Remove booking</button>}
          {p.status === "installed" && !p.invoiced && <button onClick={undoInstalled} className={btnGhost}>Undo completion</button>}
          <button onClick={onEdit} className={btnGhost}>Edit details</button>
          {isDev && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className="ml-auto px-3 py-2 rounded-lg text-red-300 hover:bg-red-500/10 text-sm flex items-center gap-1"><Trash2 size={14} /> Delete</button>}
        </div>
      ) : isCoord ? (
        <div className="mt-6 pt-4 border-t border-[#30363d] text-xs text-slate-500">View only — {deptOf(p.department).label} is managed by another co-ordinator.</div>
      ) : null}
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

      {/* Phase 12C — confidential: only rendered when reviews were loaded (Franco and Developer) */}
      {Array.isArray(reviews) && (
        <div className="mt-5 border border-amber-400/30 rounded-xl p-3">
          <div className="text-xs text-amber-300/90 mb-2 flex items-center gap-1.5"><ShieldCheck size={14} /> Installation reviews ({reviews.length}) · confidential</div>
          {reviews.length === 0 ? <div className="text-xs text-slate-500">No reviews on this job.</div> : (
            <div className="space-y-2">
              {[...reviews].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).map((v) => <ReviewCard key={v.id} review={v} />)}
            </div>
          )}
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
      {reviewOpen && (
        <ReviewModal project={p} onClose={() => setReviewOpen(false)}
          onSubmit={async (data) => { await onSubmitReview(p, data); setReviewedHere(true); setReviewOpen(false); }} />
      )}
      {partialEdit && <PartialModal target={partialEdit} onClose={() => setPartialEdit(null)} onSave={(note) => savePartial(partialEdit, true, note)} onClear={() => savePartial(partialEdit, false)} />}
    </Modal>
  );
}

/* =========================================================
   PHASE 12B — INVENTORY
   ========================================================= */
const blankStockRow = (dept, reason) => ({ key: uid(), description: "", size: "", cost: "", reason, department: dept || "" });
const stockRowOk = (r) => r.description.trim() && r.reason.trim() && r.cost !== "" && !isNaN(Number(r.cost)) && Number(r.cost) >= 0;

function StockRowFields({ row, onChange, onRemove, showDept = true }) {
  const set = (k, v) => onChange({ ...row, [k]: v });
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 space-y-2">
      <div className="flex items-start gap-2">
        <input className={`${inputCls} flex-1`} value={row.description} onChange={(e) => set("description", e.target.value)} placeholder="Product, e.g. Belgotex Merino, Oatmeal" />
        {onRemove && <button onClick={onRemove} className="p-2 rounded-md hover:bg-[#21262d] text-slate-400 shrink-0" title="Remove this item"><X size={14} /></button>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} value={row.size} onChange={(e) => set("size", e.target.value)} placeholder="Size / quantity, e.g. 4 x 2.6 m" />
        <input className={inputCls} type="number" inputMode="decimal" min="0" step="0.01" value={row.cost} onChange={(e) => set("cost", e.target.value)} placeholder="Cost (R)" />
      </div>
      <input className={inputCls} value={row.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Why is this in stock?" />
      {showDept && (
        <select className={inputCls} value={row.department} onChange={(e) => set("department", e.target.value)}>
          <option value="">No department</option>
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      )}
    </div>
  );
}

function InventoryAddModal({ project: p, source, note, onClose, onSave }) {
  const where = `${p.clientName || "job"}${p.po ? ` (${p.po})` : ""}`;
  const defaultReason = source === "snag" ? `Surplus from snag re-order · ${where}` : `Left over after completion · ${where}`;
  const [step, setStep] = useState("ask");
  const [rows, setRows] = useState(() => [blankStockRow(p.department, defaultReason)]);
  const [busy, setBusy] = useState(false);
  const allOk = rows.length > 0 && rows.every(stockRowOk);
  const submit = async () => {
    if (!allOk || busy) return;
    setBusy(true);
    await onSave(rows.map((r) => ({
      description: r.description.trim(), size: r.size.trim(), cost: Number(r.cost), reason: r.reason.trim(), department: r.department || null,
      source, sourceProjectId: p.id, sourceClient: p.clientName || "", sourcePo: p.po || "",
    })));
    setBusy(false);
  };
  return (
    <Modal title={step === "ask" ? "Anything going to stock?" : "Add to inventory"} onClose={onClose}>
      {step === "ask" ? (
        <>
          <div className="text-sm text-slate-300">
            {source === "snag"
              ? <>Snag material has been ordered{note ? <> (<span className="text-slate-100">{note}</span>)</> : ""}. Will any of it be left over and go into stock?</>
              : <>{where} is complete. Is there any material left over that should go into stock?</>}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className={btnGhost}>No</button>
            <button onClick={() => setStep("add")} className={btnPrimary}>Yes, add to inventory</button>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs text-slate-400 mb-3">Everyone can see the inventory list, including the cost.</div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <StockRowFields key={r.key} row={r}
                onChange={(nr) => setRows((cur) => cur.map((x, j) => (j === i ? nr : x)))}
                onRemove={rows.length > 1 ? () => setRows((cur) => cur.filter((_, j) => j !== i)) : null} />
            ))}
          </div>
          <button onClick={() => setRows((cur) => [...cur, blankStockRow(p.department, defaultReason)])} className={`${btnGhost} mt-2 flex items-center gap-1.5 text-xs py-1.5`}><Plus size={14} /> Add another item</button>
          <div className="text-[11px] text-slate-500 mt-3">Product, cost and reason are required.</div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className={btnGhost}>Cancel</button>
            <button onClick={submit} disabled={!allOk || busy} className={btnPrimary}>{busy ? "Saving…" : `Add ${rows.length === 1 ? "item" : `${rows.length} items`}`}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function InventorySoldModal({ item, onClose, onSave }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="Mark as sold" onClose={onClose}>
      <div className="text-sm text-slate-200">{[item.description, item.size].filter(Boolean).join(" · ")}</div>
      <div className="text-xs text-slate-500 mt-1 mb-4">Moves to the reserved list. A co-ordinator can then pick it when creating the new job.</div>
      <Field label="Sold to / note (optional)">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Mrs Botha, Brackenridge" autoFocus />
      </Field>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => onSave(note)} className={btnPrimary}>Mark as sold</button>
      </div>
    </Modal>
  );
}

function InventoryEditModal({ item, onClose, onSave, onDelete }) {
  const [row, setRow] = useState({ key: item.id, description: item.description || "", size: item.size || "", cost: item.cost ?? "", reason: item.reason || "", department: item.department || "" });
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <Modal title="Edit inventory item" onClose={onClose}>
      <StockRowFields row={row} onChange={setRow} />
      <div className="flex items-center gap-2 mt-5">
        {!confirmDel
          ? <button onClick={() => setConfirmDel(true)} className="px-3 py-2 rounded-lg text-red-300 hover:bg-red-500/10 text-sm flex items-center gap-1"><Trash2 size={14} /> Delete</button>
          : <button onClick={onDelete} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm">Confirm delete</button>}
        <span className="flex-1" />
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button disabled={!stockRowOk(row)} onClick={() => onSave({ ...item, description: row.description.trim(), size: row.size.trim(), cost: Number(row.cost), reason: row.reason.trim(), department: row.department || null, editedBy: "", editedAt: new Date().toISOString() })} className={btnPrimary}>Save</button>
      </div>
    </Modal>
  );
}

function InventoryView({ items, user, level, isDev, onSold, onUnreserve, onEdit, onDelete, onOpenProject }) {
  const [q, setQ] = useState("");
  const [selling, setSelling] = useState(null);
  const [editing, setEditing] = useState(null);
  const match = (x) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [x.description, x.size, x.reason, x.sourceClient, x.sourcePo, x.soldNote, x.linkedClient, x.reservedBy, x.department && deptOf(x.department).label]
      .filter(Boolean).join(" ").toLowerCase().includes(t);
  };
  const byNewest = (a, b) => (b.createdAt || "").localeCompare(a.createdAt || "");
  const available = items.filter((x) => x.status === "available" && match(x)).sort(byNewest);
  const reserved = items.filter((x) => x.status === "reserved" && match(x)).sort((a, b) => (b.reservedAt || "").localeCompare(a.reservedAt || ""));
  const totalCost = (list) => list.reduce((n, x) => n + (Number(x.cost) || 0), 0);

  const Card = ({ x }) => (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="text-sm text-slate-100 font-medium">{x.description}{x.size && <span className="text-slate-400 font-normal"> · {x.size}</span>}</div>
          <div className="text-xs text-slate-400 mt-0.5">{x.reason}</div>
        </div>
        <div className="text-sm text-slate-100 tabular-nums">{zar(x.cost)}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-2 text-[11px] text-slate-500">
        {x.department && <span className="px-1.5 py-0.5 rounded border border-[#30363d] text-slate-400">{deptOf(x.department).label}</span>}
        <span>Added by {x.addedBy || "—"} · {fmtShort((x.createdAt || "").slice(0, 10))}</span>
        {x.sourceProjectId && <button onClick={() => onOpenProject(x.sourceProjectId)} className="underline hover:text-slate-300">from {x.sourceClient || "job"}{x.sourcePo ? ` (${x.sourcePo})` : ""}</button>}
      </div>
      {x.status === "reserved" && (
        <div className="mt-2 text-xs text-teal-200/90 flex items-center gap-2 flex-wrap">
          <Tag size={12} /> Sold by {x.reservedBy || "—"} · {fmtShort((x.reservedAt || "").slice(0, 10))}{x.soldNote ? ` · ${x.soldNote}` : ""}
          {x.linkedProjectId
            ? <button onClick={() => onOpenProject(x.linkedProjectId)} className="underline">→ {x.linkedClient || "job"}{x.linkedPo ? ` (${x.linkedPo})` : ""}</button>
            : <span className="text-slate-500">· not yet linked to a job</span>}
        </div>
      )}
      <div className="flex gap-2 mt-3 flex-wrap">
        {x.status === "available" && level >= 1 && <button onClick={() => setSelling(x)} className="text-xs px-2.5 py-1 rounded-lg border border-teal-500/50 text-teal-200 hover:bg-teal-500/10 flex items-center gap-1"><Tag size={12} /> Mark as sold</button>}
        {x.status === "reserved" && !x.linkedProjectId && isDev && <button onClick={() => onUnreserve(x)} className="text-xs px-2.5 py-1 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#21262d] flex items-center gap-1"><RotateCcw size={12} /> Back to available</button>}
        {isDev && <button onClick={() => setEditing(x)} className="text-xs px-2.5 py-1 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#21262d] flex items-center gap-1"><Pencil size={12} /> Edit</button>}
      </div>
    </div>
  );

  const Section = ({ title, list, empty }) => (
    <div className="mt-5">
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-xs text-slate-500">{list.length} item{list.length === 1 ? "" : "s"} · {zar(totalCost(list))}</span>
      </div>
      {list.length === 0 ? <div className="text-sm text-slate-500 bg-[#161b22] border border-[#30363d] rounded-xl p-4">{empty}</div>
        : <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">{list.map((x) => <Card key={x.id} x={x} />)}</div>}
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2"><Boxes size={20} className="text-teal-300" /> Inventory</h1>
        <input className={`${inputCls} max-w-xs ml-auto`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock" />
      </div>
      <div className="text-xs text-slate-500 mt-1">Stock is added when snag material is ordered or when a job is completed. Items marked as sold move to Reserved, and drop off once the job they went to is invoiced.</div>
      <Section title="Available" list={available} empty={q ? "Nothing matches." : "No stock on hand."} />
      <Section title="Reserved" list={reserved} empty={q ? "Nothing matches." : "Nothing reserved."} />
      {selling && <InventorySoldModal item={selling} onClose={() => setSelling(null)} onSave={(note) => { onSold(selling, note); setSelling(null); }} />}
      {editing && <InventoryEditModal item={editing} onClose={() => setEditing(null)}
        onSave={(it) => { onEdit({ ...it, editedBy: user.name }); setEditing(null); }}
        onDelete={() => { onDelete(editing); setEditing(null); }} />}
    </div>
  );
}

/* =========================================================
   PHASE 12C — INSTALLATION REVIEWS (confidential)
   ========================================================= */
const Stars = ({ value, size = 14 }) => (
  <span className="inline-flex gap-0.5" title={`${value} of 5`}>
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= value ? "text-amber-300 fill-amber-300" : "text-slate-600"} />)}
  </span>
);
function ReviewCard({ review: v, showJob }) {
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Stars value={v.rating} />
        <span className="text-xs text-slate-300">{v.author}</span>
        <span className="text-[11px] text-slate-500">· {fmtShort((v.createdAt || "").slice(0, 10))}{v.jobStatus === "installed" ? " · after completion" : v.jobStatus ? ` · while ${v.jobStatus}` : ""}</span>
        {showJob && <span className="text-[11px] text-slate-400 ml-auto">{v.clientName} · PO {v.po}</span>}
      </div>
      {(v.concerns || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {v.concerns.map((c) => <span key={c} className="text-[11px] px-2 py-0.5 rounded-full border border-red-500/40 text-red-200">{c}</span>)}
        </div>
      )}
      <div className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">{v.comment}</div>
    </div>
  );
}
function ReviewModal({ project: p, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [concerns, setConcerns] = useState([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (c) => setConcerns((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const valid = rating >= 1 && comment.trim().length > 0;
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setErr("");
    try { await onSubmit({ rating, concerns, comment }); }
    catch (e) { setErr(e.message || "Could not submit the review"); setBusy(false); }
  };
  const shown = hover || rating;
  return (
    <Modal title="Installation review" onClose={onClose}>
      <div className="text-xs text-slate-400 mb-4">
        {p.clientName} · {deptOf(p.department).label} · install team <span className="text-slate-200">{teamLabel(p.department, p.team || teamsOf(p.department)[0])}</span>
      </div>
      <div className="text-xs text-slate-300 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
        <ShieldCheck size={14} className="text-amber-300 shrink-0 mt-0.5" />
        <span>Confidential. Only Franco and the developer can read reviews; the install team and other staff never see them. Please keep it fair and factual.</span>
      </div>
      <div className="text-sm text-slate-200 mb-1.5">Overall rating</div>
      <div className="flex gap-1 mb-4" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="p-1" title={`${n} of 5`}>
            <Star size={28} className={n <= shown ? "text-amber-300 fill-amber-300" : "text-slate-600"} />
          </button>
        ))}
      </div>
      <div className="text-sm text-slate-200 mb-1.5">Areas of concern <span className="text-slate-500 text-xs">(tick any that apply)</span></div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {REVIEW_CONCERNS.map((c) => {
          const on = concerns.includes(c);
          return <button key={c} type="button" onClick={() => toggle(c)} className={`text-xs px-2.5 py-1 rounded-full border ${on ? "border-red-500/60 bg-red-500/15 text-red-100" : "border-[#30363d] text-slate-300 hover:bg-[#21262d]"}`}>{c}</button>;
        })}
      </div>
      <Field label="Comment (required)">
        <textarea className={`${inputCls} min-h-[96px]`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What happened, and what should be different next time?" />
      </Field>
      {err && <div className="text-xs text-red-300 mt-2">{err}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={submit} disabled={!valid || busy} className={btnPrimary}>{busy ? "Submitting…" : "Submit review"}</button>
      </div>
    </Modal>
  );
}

function SnagLogModal({ user, onClose, onSave }) {
  const [category, setCategory] = useState(SNAG_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [materialRequired, setMaterialRequired] = useState(false); // Phase 11
  const [materialNote, setMaterialNote] = useState("");
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
        <div className={`border rounded-xl px-3 py-2.5 ${materialRequired ? "border-sky-500/50 bg-sky-500/5" : "border-[#30363d]"}`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={materialRequired} onChange={(e) => setMaterialRequired(e.target.checked)} />
            <span className="text-sm text-slate-100">Material required to resolve</span>
          </label>
          {materialRequired && (
            <>
              <input className={`${inputCls} mt-2`} value={materialNote} onChange={(e) => setMaterialNote(e.target.value)} placeholder="What's needed, e.g. 2 m² replacement vinyl" />
              <div className="text-[11px] text-slate-500 mt-1.5">The job's consultant and the department co-ordinator get a "to be ordered" reminder on their home screen until it's marked as ordered.</div>
            </>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button
          disabled={!description.trim() || busy}
          onClick={() => onSave({ id: uid(), category, description: description.trim(), photo, createdAt: new Date().toISOString(), author: user.name, resolved: false, acknowledged: false,
            ...(materialRequired ? { materialRequired: true, materialNote: materialNote.trim(), materialOrdered: false } : {}) })}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm disabled:opacity-50"
        >Log snag</button>
      </div>
    </Modal>
  );
}

// Phase 11 — flag one line as partially received, with a note of what's in and what's outstanding
function PartialModal({ target, onClose, onSave, onClear }) {
  const [note, setNote] = useState(target.note || "");
  return (
    <Modal title="Partially received" onClose={onClose}>
      <div className="text-sm text-slate-300 mb-3"><span className="font-medium text-white">{target.label}</span></div>
      <Field label="Note (what's in, what's still outstanding)">
        <textarea className={`${inputCls} min-h-[80px]`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 3 of 5 rolls in, 2 on backorder" autoFocus />
      </Field>
      <div className="flex justify-end gap-2 mt-6 flex-wrap">
        {target.on && <button onClick={onClear} className="mr-auto px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#21262d]">Clear flag (all received)</button>}
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={() => onSave(note)} className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-900 text-sm font-medium">{target.on ? "Save note" : "Flag as partial"}</button>
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
  // Phase 10.3 — completed (installed, not yet invoiced) turns light grey on the calendar for every department
  if (variant === "installed") return "bg-slate-300 border-slate-400 text-slate-800";
  if (variant === "booked") {
    const done = false;
    if (p.department === "shutters") return done ? "bg-orange-700/70 border-orange-500/60 text-white" : "bg-orange-400/25 border-orange-400/60 text-orange-50";
    if (p.department === "calore") return done ? "bg-blue-700/70 border-blue-500/60 text-white" : "bg-blue-400/25 border-blue-400/60 text-blue-50";
    return done ? "bg-emerald-700/70 border-emerald-500/60 text-white" : "bg-emerald-400/25 border-emerald-400/50 text-emerald-50";
  }
  return "bg-slate-300/15 border-slate-400/30 text-slate-200";
};

// 3-bar progress: 1 = planned, 2 = reserved, 3 = confirmed. Fills bottom-up.
// Planned = all grey, Reserved = bottom two yellow, Confirmed = all green.
const stageLevel = (p) => (p.status === "booked" || p.status === "installed") ? 3 : p.reserveStage === "reserved" ? 2 : p.reserveStage === "planned" ? 1 : 0;
const StageBars = ({ p }) => {
  const n = stageLevel(p);
  if (!n) return null;
  const label = n === 3 ? "Confirmed booking" : n === 2 ? "Reserved" : "Planned";
  // colour of a filled bar depends on the stage; empty bars are faint grey
  const fill = n === 3 ? "bg-[#5aa515]" : n === 2 ? "bg-[#c9a227]" : "bg-slate-400";
  const empty = "bg-slate-400/30";
  return (
    <span className="flex flex-col gap-[2px] shrink-0" title={label}>
      {[3, 2, 1].map((lvl) => <span key={lvl} className={`block w-6 h-[3px] rounded ${lvl <= n ? fill : empty}`} />)}
    </span>
  );
};

function Sticker({ p, draggable, onDragStart, onClick, variant, dayTag, time, endTime, inTray, expandable, expanded, onToggle }) {
  // A planned/reserved job shows white in its tray too, so the tray and calendar match
  if (inTray && isReserved(p)) variant = "reserved";
  const cls = stickerCls(p, variant);
  const flagged = hasOpenSnags(p);
  const test = !!p.isTest;
  const compact = expandable && !expanded;
  const eta = variant !== "return" ? etaStateOf(p) : null;
  const ringCls = test ? "ring-2 ring-orange-500 border-orange-500"
    : (flagged && variant !== "return") ? "ring-1 ring-red-500/60"
    : eta === "overdue" ? "ring-2 ring-red-500"
    : eta === "soon" ? "ring-2 ring-amber-400" : "";
  const showBars = variant === "reserved" || variant === "booked" || variant === "installed";
  return (
    <div
      draggable={draggable} onDragStart={onDragStart} onClick={expandable ? onToggle : onClick}
      className={`border rounded-lg px-2 py-1.5 text-xs leading-tight select-none ${cls} ${ringCls} ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${!draggable && variant === "ordered" ? "opacity-80" : ""}`}
      title={`${p.clientName} · PO ${p.po} · ${p.productType || ""}${p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}${isRepair(p) ? " · Repair" : ""}${variant === "return" ? " · Snag return visit" : ""}`}
    >
      {compact ? (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate flex-1">{p.clientName}</span>
          {isRepair(p) && variant !== "return" && <RepairIcon small />}
          {dayTag && <span className="font-bold opacity-90 text-[10px]">{dayTag}</span>}
          {time && <span className="opacity-80">{time}</span>}
          {variant !== "return" && <OverlockBadge p={p} small />}
          {variant !== "return" && <CoreDrillingBadge p={p} small />}
          {variant !== "return" && <EscutcheonBadge p={p} small />}
          <EtaBadge p={p} small />
          {showBars && <StageBars p={p} />}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold truncate flex-1">{p.clientName}</span>
            {isRepair(p) && variant !== "return" && <RepairIcon small />}
            {dayTag && <span className="font-bold opacity-90">{dayTag}</span>}
            {(flagged || variant === "return") && <SnagFlag small />}
            {variant !== "return" && <OverlockBadge p={p} small />}
            {variant !== "return" && <CoreDrillingBadge p={p} small />}
            {variant !== "return" && <EscutcheonBadge p={p} small />}
            {variant !== "return" && <EtaBadge p={p} small />}
            {showPartial(p) && <PartialBadge />}
            {p.status === "received" && variant !== "return" && <RBadge />}
          </div>
          <div className="flex items-center justify-between gap-2 opacity-80 mt-0.5">
            <span className="truncate">{variant === "return" ? "Snag return" : p.consultant}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}</span>
            {inTray && isReserved(p) && p.installDate ? <span className="text-[10px] font-semibold">{p.reserveStage === "reserved" ? "Reserved" : "Planned"} {fmtShort(p.installDate)}</span> : null}
            {!inTray && time && <span>{time}{endTime ? `–${endTime}` : ""}</span>}
            {!inTray && !time && p.materialEta && p.status === "ordered" && !isReserved(p) && <span>ETA {fmtShort(p.materialEta)}</span>}
            {inTray && !isReserved(p) && p.materialEta && p.status === "ordered" && <span>ETA {fmtShort(p.materialEta)}</span>}
            {!inTray && showBars && <StageBars p={p} />}
          </div>
          {expandable && expanded && (
            <>
              {p.productType && <div className="opacity-70 truncate mt-0.5">{p.productType}{productLinesOf(p).length > 1 ? ` +${productLinesOf(p).length - 1}` : ""}{jobMeasureText(p) ? ` · ${jobMeasureText(p)}` : ""}</div>}
              <button onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} className="mt-1 text-[10px] underline opacity-80 hover:opacity-100">Open full details ›</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* =========================================================
   PUBLIC HOLIDAYS MANAGER (Developer only)
   ========================================================= */
function HolidaysModal({ custom, closeDate: initialClose, onSave, onClose }) {
  const [list, setList] = useState(() => [...(custom || [])].sort((a, b) => a.date.localeCompare(b.date)));
  const [closeDate, setCloseDate] = useState(initialClose || "");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const year = new Date().getFullYear();
  const base = Object.entries(saHolidayMap(year)).sort((a, b) => a[0].localeCompare(b[0]));

  const add = () => {
    if (!date) return;
    const next = [...list.filter((h) => h.date !== date), { date, name: name.trim() || "Company holiday" }].sort((a, b) => a.date.localeCompare(b.date));
    setList(next); setDate(""); setName("");
  };
  const remove = (d) => setList(list.filter((h) => h.date !== d));
  const commit = () => { onSave(list, closeDate || ""); onClose(); };

  return (
    <Modal title="Public holidays & year-end" onClose={onClose}>
      <div className="border border-[#30363d] rounded-xl p-3 mb-4">
        <div className="text-xs text-slate-500 mb-2">Year-end close date</div>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={`${inputCls} w-auto`} />
          {closeDate && <button onClick={() => setCloseDate("")} className="text-xs text-slate-400 hover:text-red-300">Clear</button>}
        </div>
        <div className="text-[11px] text-slate-500 mt-2">Team capacity on the home screen counts working days from today up to and including this date. Set the next one after the year-end meeting.</div>
      </div>

      <p className="text-sm text-slate-400 mb-4">South African public holidays are built in automatically. Add custom dates below (for example a company shutdown day). They show on every calendar but do not block booking.</p>

      <div className="border border-[#30363d] rounded-xl p-3 mb-4">
        <div className="text-xs text-slate-500 mb-2">Add a custom date</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="text-[11px] text-slate-500 mb-1">Name</div>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Company shutdown" className={inputCls} />
          </div>
          <button onClick={add} disabled={!date} className={btnPrimary}>Add</button>
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-1">Custom holidays</div>
      {list.length === 0 ? (
        <div className="text-sm text-slate-500 mb-4">None added.</div>
      ) : (
        <div className="mb-4 space-y-1">
          {list.map((h) => (
            <div key={h.date} className="flex items-center justify-between text-sm bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5">
              <span><span className="text-slate-300">{fmtShort(h.date)}</span> · <span className="text-slate-100">{h.name}</span></span>
              <button onClick={() => remove(h.date)} className="text-slate-400 hover:text-red-300"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <details className="mb-4">
        <summary className="text-xs text-slate-500 cursor-pointer">Built-in SA holidays for {year} ({base.length})</summary>
        <div className="mt-2 space-y-1">
          {base.map(([d, nm]) => (
            <div key={d} className="flex items-center justify-between text-sm text-slate-400 px-1">
              <span>{fmtShort(d)}</span><span>{nm}</span>
            </div>
          ))}
        </div>
      </details>

      <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
        <button onClick={onClose} className={btnGhost}>Cancel</button>
        <button onClick={commit} className={btnPrimary}>Save</button>
      </div>
    </Modal>
  );
}

function CalendarView({ cal, projects, isCoord, canEdit, canBook = canEdit, customHolidays = [], user, save, onOpen, initialMonth }) {
  // Phase 10.3 — desktop shows a rolling 4-week window: last week + this week + the next two
  // (i.e. the previous week and three weeks forward). Arrows move one week at a time, no limits.
  const defaultWin = (d) => addDays(weekStart(d || todayIso()), -7);
  const [winStart, setWinStart] = useState(() => defaultWin(initialMonth));
  const [booking, setBooking] = useState(null); // { project, date, mode: "book" | "moveDay" | "return" | "moveReturn", dayIndex | visitId }
  const [dragOver, setDragOver] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null); // which calendar sticker is expanded to full detail
  const dragRef = useRef(null); // { p, kind: "received" | "day" | "return" | "moveReturn", dayIndex, visitId }
  // Phase 10 — phones get a one-week list view (opens on the current week, or the week picked in Availability)
  const isMobile = useIsMobile();
  const [weekOf, setWeekOf] = useState(() => weekStart(initialMonth || todayIso()));
  const [showTrays, setShowTrays] = useState(false);
  const [pickDay, setPickDay] = useState(null); // Phase 10.1 — mobile: date whose job picker is open
  useEffect(() => { setExpandedKey(null); }, [winStart, weekOf]);
  // Phase 11 — co-ordinators can narrow trays and calendar to All / New jobs / Repairs (remembered for the session).
  // Snag return visits count as repair work, so they show under Repairs and hide under New jobs.
  const [jobFilter, setJobFilterState] = useState(() => { try { return (isCoord && sessionStorage.getItem("nolans_cal_filter")) || "all"; } catch { return "all"; } });
  const setJobFilter = (v) => { setJobFilterState(v); try { sessionStorage.setItem("nolans_cal_filter", v); } catch { /* ignore */ } };
  const filterOn = isCoord ? jobFilter : "all";
  const showJob = (p) => filterOn === "all" || (filterOn === "repairs" ? isRepair(p) : !isRepair(p));
  const showReturns = filterOn !== "new";
  const shown = projects.filter(showJob);

  const ordered = shown.filter((p) => p.status === "ordered").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9"));
  const received = shown.filter((p) => p.status === "received").sort((a, b) => (a.materialEta || "9").localeCompare(b.materialEta || "9"));
  const returns = showReturns ? projects.filter((p) => p.snagReturn) : []; // completed jobs with a snag, waiting for a return visit to be booked
  const onCal = shown.filter(onCalendar); // booked, installed, or planned/reserved
  const filterBar = isCoord ? (
    <div className="flex gap-1 bg-[#161b22] border border-[#30363d] rounded-xl p-1 w-fit">
      {[["all", "All"], ["new", "New jobs"], ["repairs", "Repairs"]].map(([id, label]) => (
        <button key={id} onClick={() => setJobFilter(id)} className={`px-3 py-1 rounded-lg text-xs md:text-sm flex items-center gap-1.5 ${filterOn === id ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#21262d]"}`}>
          {id === "repairs" && <Wrench size={13} />}{label}
        </button>
      ))}
    </div>
  ) : null;

  // map date → items: install days and snag return visits
  const byDay = useMemo(() => {
    const m = {};
    onCal.forEach((p) => {
      const sched = scheduleOf(p);
      sched.forEach((s) => { (m[s.date] = m[s.date] || []).push({ kind: "day", p, day: s, total: sched.length }); });
    });
    if (showReturns) projects.forEach((p) => (p.returnVisits || []).forEach((v) => { (m[v.date] = m[v.date] || []).push({ kind: "return", p, visit: v }); }));
    Object.values(m).forEach((arr) => arr.sort((a, b) => ((a.day || a.visit).time || "99").localeCompare((b.day || b.visit).time || "99")));
    return m;
  }, [projects, filterOn]);

  const cells = useMemo(() => Array.from({ length: 28 }, (_, i) => fromIso(addDays(winStart, i))), [winStart]);

  const startDrag = (info) => (e) => { dragRef.current = info; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", info.p.id); };
  const dropOn = (dateIso) => (e) => {
    e.preventDefault(); setDragOver(null);
    const drag = dragRef.current; dragRef.current = null;
    if (!drag || !canBook(drag.p)) return;
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

  const monthLabel = `${fmt(winStart, { day: "numeric", month: "short" })} – ${fmt(addDays(winStart, 27), { day: "numeric", month: "short", year: "numeric" })}`;
  const isDefaultWin = winStart === defaultWin();
  const today = todayIso();
  const isShutters = cal.id === "shutters";
  // Stickers for one day — shared by the desktop month grid and the mobile week list.
  // On phones stickers aren't expandable: a tap opens the job straight away.
  const renderItems = (items, mobile) => items.map((it) => it.kind === "day" ? (
                    <Sticker
                      key={`${it.p.id}-${it.day.dayIndex}`} p={it.p} variant={isReserved(it.p) ? "reserved" : it.p.status}
                      draggable={!mobile && canBook(it.p) && (it.p.status === "booked" || isReserved(it.p))}
                      onDragStart={startDrag({ p: it.p, kind: "day", dayIndex: it.day.dayIndex })} onClick={() => onOpen(it.p)}
                      dayTag={it.total > 1 ? `${it.day.dayIndex}/${it.total}` : null}
                      time={it.day.time} endTime={it.day.endTime}
                      expandable={!mobile && it.day.dayIndex === 1}
                      expanded={expandedKey === `${it.p.id}-${it.day.dayIndex}`}
                      onToggle={() => setExpandedKey((k) => (k === `${it.p.id}-${it.day.dayIndex}` ? null : `${it.p.id}-${it.day.dayIndex}`))}
                    />
                  ) : (
                    <Sticker
                      key={`${it.p.id}-${it.visit.id}`} p={it.p} variant="return"
                      draggable={!mobile && canBook(it.p)}
                      onDragStart={startDrag({ p: it.p, kind: "moveReturn", visitId: it.visit.id })} onClick={() => onOpen(it.p)}
                      time={it.visit.time} endTime={it.visit.endTime}
                    />
                  ));

  const legendItems = (
    <>
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
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300 border border-slate-400" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-slate-300" /> Planned / reserved</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/15 border border-amber-500/30" /> Public holiday</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border-2 border-red-500" /> Reserved, no stock yet</span>
            <span className="flex items-center gap-1.5"><span className="flex flex-col gap-[2px]"><span className="block w-4 h-[2px] bg-slate-500/40" /><span className="block w-4 h-[2px] bg-slate-500/40" /><span className="block w-4 h-[2px] bg-slate-300" /></span> Planned</span>
            <span className="flex items-center gap-1.5"><span className="flex flex-col gap-[2px]"><span className="block w-4 h-[2px] bg-slate-500/40" /><span className="block w-4 h-[2px] bg-slate-300" /><span className="block w-4 h-[2px] bg-slate-300" /></span> Reserved</span>
            <span className="flex items-center gap-1.5"><span className="flex flex-col gap-[2px]"><span className="block w-4 h-[2px] bg-slate-300" /><span className="block w-4 h-[2px] bg-slate-300" /><span className="block w-4 h-[2px] bg-slate-300" /></span> Confirmed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/60" /> Snag return</span>
            <span className="flex items-center gap-1.5"><RepairIcon small /> Repair</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded ring-2 ring-orange-500 border border-orange-500" /> Test (dev only)</span>
    </>
  );

  // ---------- Phone layout: one week at a time ----------
  if (isMobile) {
    const weekDays = [0, 1, 2, 3, 4, 5, 6].map((o) => addDays(weekOf, o));
    const weekEnd = weekDays[6];
    const weekLabel = `${fmt(weekOf, { day: "numeric", month: "short" })} – ${fmt(weekEnd, { day: "numeric", month: "short", year: "numeric" })}`;
    const thisWeek = weekStart(today);
    const trayCount = ordered.length + received.length + returns.length;
    // Phase 10.1 — tap-to-book: same jobs the desktop lets you drag, grouped by whether stock is in
    const readyPick = [...returns.filter((p) => canBook(p)).map((p) => ({ p, kind: "return" })),
      ...received.filter((p) => canBook(p) && !isReserved(p)).map((p) => ({ p, kind: "received" }))];
    const awaitingPick = ordered.filter((p) => canBook(p) && !isReserved(p)).map((p) => ({ p, kind: "ordered" }));
    const canPick = isCoord && readyPick.length + awaitingPick.length > 0;
    const choose = ({ p, kind }) => { const date = pickDay; setPickDay(null); setBooking({ project: p, date, mode: kind === "return" ? "return" : "book" }); };
    const PickRow = ({ item, awaiting }) => {
      const { p, kind } = item;
      const d = deptOf(p.department);
      return (
        <button onClick={() => choose(item)} className={`w-full text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 ${awaiting ? "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15" : kind === "return" ? "border-red-500/40 bg-red-500/10 hover:bg-red-500/15" : "border-[#30363d] bg-[#0d1117] hover:bg-[#12181f]"}`}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate flex items-center gap-1.5">{p.clientName} {kind === "return" && <SnagFlag small />}{kind !== "return" && isRepair(p) && <RepairIcon small />}</div>
            <div className="text-[11px] text-slate-400 truncate">{d.label} · PO {p.po} · {p.consultant}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}</div>
            {p.productType && <div className="text-[11px] text-slate-500 truncate">{p.productType}{jobMeasureText(p) ? ` · ${jobMeasureText(p)}` : ""}</div>}
          </div>
          <div className="shrink-0 text-right">
            {awaiting ? <div className="text-[11px] text-amber-300">ETA {fmtShort(p.materialEta)}</div>
              : kind === "return" ? <div className="text-[11px] text-red-300">Snag return</div>
              : <div className="text-[11px] text-emerald-300">Stock in</div>}
            <EtaBadge p={p} small />
          </div>
        </button>
      );
    };
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <cal.icon size={20} className="text-slate-300 shrink-0" />
            <h1 className="text-xl font-bold text-white truncate">{cal.label}</h1>
          </div>
          {weekOf !== thisWeek && <button onClick={() => setWeekOf(thisWeek)} className={`${btnGhost} py-1.5 px-3 shrink-0`}>This week</button>}
        </div>

        <div className="flex items-center justify-between bg-[#161b22] border border-[#30363d] rounded-xl p-1">
          <button onClick={() => setWeekOf(addDays(weekOf, -7))} className="p-2.5 rounded-lg hover:bg-[#21262d]" aria-label="Previous week"><ChevronLeft size={20} /></button>
          <div className="text-center">
            <div className="text-sm font-medium text-white">{weekLabel}</div>
            {weekOf === thisWeek && <div className="text-[10px] text-slate-500 tracking-wider">THIS WEEK</div>}
          </div>
          <button onClick={() => setWeekOf(addDays(weekOf, 7))} className="p-2.5 rounded-lg hover:bg-[#21262d]" aria-label="Next week"><ChevronRight size={20} /></button>
        </div>
        {filterBar}

        {/* Trays, folded away until needed */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl">
          <button onClick={() => setShowTrays((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
            <span className="text-sm font-medium text-white flex-1">Trays</span>
            <span className="text-[11px] text-slate-400">{ordered.length} awaiting · {received.length + returns.length} ready</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${showTrays ? "rotate-180" : ""}`} />
          </button>
          {showTrays && (
            <div className="px-3 pb-3 space-y-3 border-t border-[#30363d] pt-3">
              <div>
                <div className="text-xs font-semibold text-white mb-1.5 flex items-center gap-2">Ready to book <RBadge /> <span className="text-slate-500 font-normal">{received.length + returns.length}</span></div>
                <div className="space-y-1.5">
                  {received.length + returns.length === 0 && <div className="text-xs text-slate-500">Nothing waiting to be booked.</div>}
                  {returns.map((p) => <Sticker key={`r-${p.id}`} p={p} onClick={() => onOpen(p)} variant="return" />)}
                  {received.map((p) => <Sticker key={p.id} p={p} inTray onClick={() => onOpen(p)} variant="received" />)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-white mb-1.5">Awaiting material <span className="text-slate-500 font-normal">· in ETA order · {ordered.length}</span></div>
                <div className="space-y-1.5">
                  {ordered.length === 0 && <div className="text-xs text-slate-500">No outstanding orders.</div>}
                  {ordered.map((p) => <Sticker key={p.id} p={p} inTray onClick={() => onOpen(p)} variant="ordered" />)}
                </div>
              </div>
              {isCoord && trayCount > 0 && <div className="text-[11px] text-slate-500">To book, tap a day below and pick the job.</div>}
            </div>
          )}
        </div>

        {/* Days of the week */}
        <div className="space-y-2">
          {weekDays.map((key) => {
            const wk = isWeekend(key);
            const hol = holidayName(key, customHolidays);
            const items = byDay[key] || [];
            const isToday = key === today;
            if (wk && !items.length && !hol) {
              return (
                <div key={key} onClick={() => canPick && setPickDay(key)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#30363d]/60 bg-[#0d1117]/40 text-xs text-slate-600 ${canPick ? "cursor-pointer" : ""}`}>
                  <span className="w-20">{fmt(key, { weekday: "short", day: "numeric", month: "short" })}</span> Weekend
                  {canPick && <Plus size={12} className="ml-auto" />}
                </div>
              );
            }
            return (
              <div key={key} onClick={() => { if (canPick && !items.length) setPickDay(key); }} className={`${canPick && !items.length ? "cursor-pointer active:bg-[#161b22]" : ""} rounded-xl border p-2.5 ${isToday ? "border-[#1f6feb]" : hol ? "border-amber-500/40" : "border-[#30363d]"} ${hol ? "bg-amber-500/5" : wk ? "bg-[#0d1117]/60" : "bg-[#0d1117]"} ${key < today ? "opacity-70" : ""}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-sm font-semibold ${isToday ? "text-white" : "text-slate-300"}`}>{fmt(key, { weekday: "long" })}</span>
                  <span className={`text-xs ${isToday ? "px-1.5 py-0.5 rounded-full bg-[#1f6feb] text-white" : "text-slate-500"}`}>{fmt(key, { day: "numeric", month: "short" })}</span>
                  {items.length > 0 && <span className="ml-auto text-[11px] text-slate-500">{items.length} {items.length === 1 ? "job" : "jobs"}</span>}
                  {items.length > 0 && canPick && (
                    <button onClick={(e) => { e.stopPropagation(); setPickDay(key); }} className="ml-1 p-1.5 -my-1 rounded-lg border border-[#30363d] text-slate-300 hover:bg-[#21262d]" aria-label="Book another job on this day"><Plus size={14} /></button>
                  )}
                </div>
                {hol && <div className="text-[11px] mb-1.5 px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-200">{hol}</div>}
                {items.length ? <div className="space-y-1.5">{renderItems(items, true)}</div> : !hol && <div className="text-xs text-slate-600">{canPick ? "Nothing booked · tap to book a job" : "Nothing booked"}</div>}
              </div>
            );
          })}
        </div>

        <details className="text-[11px] text-slate-500 bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2">
          <summary className="cursor-pointer text-slate-400">Colour key</summary>
          <div className="flex items-center gap-x-4 gap-y-2 mt-2 flex-wrap">{legendItems}</div>
        </details>

        {pickDay && (
          <Modal title={`Book a job · ${fmt(pickDay, { weekday: "short", day: "numeric", month: "short" })}`} onClose={() => setPickDay(null)}>
            {holidayName(pickDay, customHolidays) && <div className="text-xs mb-3 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200">Public holiday: {holidayName(pickDay, customHolidays)}</div>}
            <div className="text-xs font-semibold text-white mb-2 flex items-center gap-2">Ready to book <RBadge /> <span className="text-slate-500 font-normal">{readyPick.length}</span></div>
            <div className="space-y-2 mb-5">
              {readyPick.length === 0 && <div className="text-xs text-slate-500">Nothing with stock in.</div>}
              {readyPick.map((it) => <PickRow key={`${it.kind}-${it.p.id}`} item={it} />)}
            </div>
            <div className="text-xs font-semibold text-amber-300 mb-1 flex items-center gap-2">Awaiting material <span className="text-slate-500 font-normal">{awaitingPick.length}</span></div>
            <div className="text-[11px] text-slate-500 mb-2">Stock not in yet. These can be planned but show with a red outline until received.</div>
            <div className="space-y-2">
              {awaitingPick.length === 0 && <div className="text-xs text-slate-500">No outstanding orders.</div>}
              {awaitingPick.map((it) => <PickRow key={`o-${it.p.id}`} item={it} awaiting />)}
            </div>
          </Modal>
        )}
        {booking && <BookingModal booking={booking} onClose={() => setBooking(null)} onConfirm={confirmBooking} />}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left tray: ordered, by ETA */}
      <aside className="w-56 shrink-0 bg-[#161b22] border border-[#30363d] rounded-2xl p-3 flex flex-col">
        <div className="text-sm font-semibold text-white mb-0.5">Awaiting material</div>
        <div className="text-[11px] text-slate-500 mb-3">In ETA order · {ordered.length}</div>
        <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
          {ordered.length === 0 && <div className="text-xs text-slate-500">No outstanding orders.</div>}
          {ordered.map((p) => <Sticker key={p.id} p={p} inTray draggable={canBook(p) && !isReserved(p)} onDragStart={startDrag({ p, kind: "ordered" })} onClick={() => onOpen(p)} variant="ordered" />)}
        </div>
        {isCoord && ordered.length > 0 && <div className="text-[11px] text-slate-500 mt-3">Drag onto a date to plan it before stock arrives (white sticker, red outline). Mark received to move it up.</div>}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <cal.icon size={22} className="text-slate-300" />
            <h1 className="text-xl md:text-2xl font-bold text-white">{cal.label}</h1>
            {filterBar && <div className="ml-2">{filterBar}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWinStart(addDays(winStart, -7))} className="p-2 rounded-lg hover:bg-[#161b22]" title="Back one week"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium w-48 text-center">{monthLabel}</span>
            <button onClick={() => setWinStart(addDays(winStart, 7))} className="p-2 rounded-lg hover:bg-[#161b22]" title="Forward one week"><ChevronRight size={18} /></button>
            <button onClick={() => setWinStart(defaultWin())} disabled={isDefaultWin} className={`${btnGhost} py-1.5 ${isDefaultWin ? "opacity-50" : ""}`}>Today</button>
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
                <Sticker p={p} draggable={canBook(p)} onDragStart={startDrag({ p, kind: "return" })} onClick={() => onOpen(p)} variant="return" />
              </div>
            ))}
            {received.map((p) => (
              <div key={p.id} className="w-44">
                <Sticker p={p} inTray draggable={canBook(p) && !isReserved(p)} onDragStart={startDrag({ p, kind: "received" })} onClick={() => onOpen(p)} variant="received" />
              </div>
            ))}
          </div>
        </div>

        {/* 4-week grid */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-3 flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-7 text-[11px] text-slate-500 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-[minmax(110px,auto)]">
            {cells.map((d) => {
              const key = iso(d);
              const inMonth = true;
              const past = key < today;
              const wk = isWeekend(key);
              const hol = holidayName(key, customHolidays);
              const items = byDay[key] || [];
              return (
                <div
                  key={key}
                  onDragOver={(e) => { if (isCoord) { e.preventDefault(); setDragOver(key); } }}
                  onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
                  onDrop={dropOn(key)}
                  className={`rounded-lg border p-1.5 flex flex-col gap-1 ${dragOver === key ? "border-[#1f6feb] bg-[#1f6feb]/10" : hol ? "border-amber-500/40" : "border-[#30363d]"} ${inMonth ? (hol ? "bg-amber-500/5" : wk ? "bg-[#0d1117]/60" : "bg-[#0d1117]") : "bg-transparent opacity-40"} ${past ? "opacity-75" : ""}`}
                >
                  <div className={`text-xs ${key === today ? "text-white font-bold" : "text-slate-500"}`}>
                    <span className={key === today ? "inline-flex w-5 h-5 rounded-full bg-[#1f6feb] items-center justify-center" : ""}>{d.getDate()}</span>
                    {(d.getDate() === 1 || key === winStart) && <span className="ml-1 text-slate-400">{fmt(key, { month: "short" })}</span>}
                  </div>
                  {hol && (
                    <div className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-200 truncate" title={hol}>
                      {hol}
                    </div>
                  )}
                  {renderItems(items, false)}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500 flex-wrap">
            {legendItems}
            <span className="ml-auto">Tap a sticker to expand it. Each day (1/3, 2/3…) drags on its own.</span>
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
        <span className="font-semibold text-white">{p.clientName}</span> · PO {p.po}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}
        {isBook && <div className="text-xs text-slate-400 mt-1">This plans the job on the date. It stays in its tray until you reserve or confirm it from the job screen.{!p.received ? " Material has not been received yet, so it will show with a red outline." : ""}</div>}
        {isMoveDay && <div className="text-xs text-slate-400 mt-1">Currently {fmt(current?.date)}{current?.time ? ` at ${current.time}` : ""}. Only this day moves; the other days stay where they are.</div>}
        {isMoveReturn && <div className="text-xs text-slate-400 mt-1">Currently {fmt(current?.date)}{current?.time ? ` at ${current.time}` : ""}.</div>}
        {isReturn && <div className="text-xs text-red-300 mt-1 flex items-center gap-1"><SnagFlag small /> Return visit for {openSnags(p).length} open snag{openSnags(p).length > 1 ? "s" : ""}.</div>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
function CompletedView({ items, isCoord, canEdit, isDev, user, save, onOpen, setToast }) {
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
        <div className="print:hidden flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => window.print()} className={`${btnPrimary} flex items-center gap-2`}><Printer size={16} /> Print / Save as PDF</button>
          <button onClick={confirmInvoiced} className={`${btnGhost} border-emerald-500/40 text-emerald-300`}>Done — move these {ticked.length} to History</button>
          <button onClick={() => setPrinting(false)} className={btnGhost}>Back</button>
        </div>
        <div className="report bg-white text-black rounded-2xl p-4 md:p-8 print:p-0 print:rounded-none overflow-x-auto print:overflow-visible">
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
                  <td className="py-1.5 pr-3">{teamLabel(p.department, p.team) || "—"}</td>
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
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Completed orders</h1>
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
              <div key={p.id} className={`bg-[#0d1117] border ${snagCardCls(p)} rounded-xl p-3 md:p-4 flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-4`}>
                {canEdit(p) && (
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
                  <div className="col-span-6 md:col-span-3 text-sm text-slate-300 flex items-center gap-1.5"><d.icon size={14} className="text-slate-500" />{d.label}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}</div>
                  <div className="col-span-12 md:col-span-4 text-xs text-slate-400 text-left md:text-right flex items-center justify-start md:justify-end gap-2 flex-wrap">
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
function HistoryView({ items, deleted, isCoord, canEdit, isDev, user, save, onOpen }) {
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
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="text-xl md:text-2xl font-bold text-white">History</h1>
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
                  <div key={p.id} className={`bg-[#0d1117] border ${snagCardCls(p)} rounded-xl p-3 md:p-4 flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-4`}>
                    <button onClick={() => onOpen(p)} className="flex-1 min-w-0 text-left grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-12 md:col-span-5 min-w-0">
                        <div className="font-medium text-white truncate flex items-center gap-2">{p.clientName}{hasOpenSnags(p) && <SnagFlag small />}</div>
                        <div className="text-xs text-slate-400 truncate">PO {p.po} · {p.consultant}</div>
                      </div>
                      <div className="col-span-6 md:col-span-3 text-sm text-slate-300 flex items-center gap-1.5"><d.icon size={14} className="text-slate-500" />{d.label}</div>
                      <div className="col-span-12 md:col-span-4 text-xs text-slate-400 text-left md:text-right">Installed {fmtShort(p.installDate)} · invoiced {fmtShort((p.invoicedAt || "").slice(0, 10))}</div>
                    </button>
                    {canEdit(p) && <button onClick={() => moveBack(p)} className={`${btnGhost} py-1.5 text-xs flex items-center gap-1 shrink-0`} title="Move back to Completed"><RotateCcw size={12} /> Move back</button>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isDev && deleted.length > 0 && (
        <div className="bg-[#161b22] border border-orange-500/40 rounded-2xl p-4 md:p-6">
          <button onClick={() => setShowDeleted((s) => !s)} className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2 text-orange-300 font-semibold"><Trash2 size={16} /> Deleted projects <span className="text-xs font-normal text-orange-300/70">· {deleted.length} · developer only</span></div>
            <ChevronDown size={18} className={`text-orange-300 transition-transform ${showDeleted ? "rotate-180" : ""}`} />
          </button>
          {showDeleted && (
            <div className="space-y-2 mt-4">
              {deleted.map((p) => (
                <div key={p.id} className="bg-[#0d1117] border border-orange-500/30 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate flex items-center gap-2">{p.clientName}{p.isTest && <span className="text-[10px] px-1.5 rounded-full border border-orange-500 text-orange-300 font-semibold">TEST</span>} <span className="text-xs text-slate-500 font-normal">· PO {p.po} · {deptOf(p.department).label} · {p.consultant}</span></div>
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
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Availability</h1>
          <div className="text-sm text-slate-400">Booked hours per working day · capacity 8h Mon–Thu, 7h Fri</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
      <div className="print:hidden bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-5 mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-4">Reports</h1>
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
                {day.dayIndex === 1 && !isReturn && productLinesOf(p).length > 0 && (
                  <div className="text-sm text-gray-800 mt-1">
                    {productLinesOf(p).map((l, i) => (
                      <div key={l.id || i}>• {l.productType || l.productRange}{measureText(l, p.department) ? ` — ${measureText(l, p.department)}` : ""}</div>
                    ))}
                    {totalArea(p) > 0 && productLinesOf(p).length > 1 && <div className="font-semibold">Total: {totalArea(p)} m²</div>}
                  </div>
                )}
                {day.dayIndex === 1 && !isReturn && hasOverlock(p) && (
                  <div className={`text-sm mt-1 ${needsOverlock(p) ? "font-semibold text-amber-800" : "text-gray-800"}`}>
                    Overlocking ({overlockStatusText(p)}){overlockSizesOf(p).length ? `: ${overlockSizesOf(p).join(", ")}` : ""}
                  </div>
                )}
              </div>
              <div className="text-right text-sm">
                <div className="font-semibold">{fmt(day.date)}</div>
                <div className="text-gray-800">{day.time ? `${day.time}${day.endTime ? ` – ${day.endTime}` : ""}` : "Continuation"}</div>
                <div className="text-gray-800">PO {p.po}</div>
                <div className="text-gray-600">{productLinesOf(p).length === 0 && p.productType ? `${p.productType} · ` : ""}{p.consultant}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}</div>
              </div>
            </div>
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
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2"><Flag size={22} className="text-red-400" /> Snags</h1>
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
                  <span className="text-xs text-slate-400">PO {p.po} · <d.icon size={12} className="inline" /> {d.label} · {p.consultant}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}</span>
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
/* Phase 11.1 — cause + cost lines for one snag, held as a local draft. Nothing is written until Save is pressed,
   so picking a cause no longer submits the row (and no longer drops it out of "Needs allocation" mid-edit). */
const draftOf = (r) => ({ cause: (r && r.cause) || "", costs: ((r && r.costs) || []).map((c) => ({ ...c, amount: c.amount == null ? "" : String(c.amount), note: c.note || "" })) });
function ReviewEditor({ review, canEdit, onSave }) {
  const [draft, setDraft] = useState(() => draftOf(review));
  const saved = draftOf(review);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  // Pick up changes saved elsewhere (auto-refresh) only while there are no unsaved edits here
  const savedKey = JSON.stringify(saved);
  useEffect(() => { if (!dirty) setDraft(draftOf(review)); /* eslint-disable-next-line */ }, [savedKey]);
  const upd = (id, patch) => setDraft((d) => ({ ...d, costs: d.costs.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const add = () => setDraft((d) => ({ ...d, costs: [...d.costs, { id: uid(), category: COST_CATEGORIES[0], amount: "", note: "" }] }));
  const del = (id) => setDraft((d) => ({ ...d, costs: d.costs.filter((c) => c.id !== id) }));
  const total = draft.costs.reduce((n, c) => n + (Number(c.amount) || 0), 0);
  return (
    <div className={`mt-4 rounded-xl ${dirty ? "border border-amber-400/40 bg-amber-400/5 p-3" : ""}`}>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        <Field label="Cause">
          <select className={inputCls} value={draft.cause} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, cause: e.target.value }))}>
            <option value="">Not yet allocated</option>
            {SNAG_CAUSES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <div>
          <div className="text-xs text-slate-400 mb-1">Cost lines (ZAR)</div>
          <div className="space-y-2">
            {draft.costs.map((c) => (
              <div key={c.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select className={`${inputCls} w-[calc(50%-0.25rem)] sm:w-32`} value={c.category} disabled={!canEdit} onChange={(e) => upd(c.id, { category: e.target.value })}>
                  {COST_CATEGORIES.map((x) => <option key={x}>{x}</option>)}
                </select>
                <input type="number" min="0" step="0.01" className={`${inputCls} w-[calc(50%-0.25rem)] sm:w-32`} placeholder="0.00" value={c.amount} disabled={!canEdit} onChange={(e) => upd(c.id, { amount: e.target.value })} />
                <input className={`${inputCls} flex-1 min-w-0`} placeholder="Note (optional)" value={c.note} disabled={!canEdit} onChange={(e) => upd(c.id, { note: e.target.value })} />
                {canEdit && <button onClick={() => del(c.id)} className="p-1.5 rounded-md hover:bg-[#21262d] text-slate-400 shrink-0"><X size={14} /></button>}
              </div>
            ))}
            {draft.costs.length === 0 && <div className="text-xs text-slate-500">No costs recorded.</div>}
          </div>
          {canEdit && <button onClick={add} className={`${btnGhost} mt-2 flex items-center gap-1.5 text-xs py-1.5`}><Plus size={14} /> Add cost line</button>}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center justify-end gap-2 mt-3 flex-wrap">
          {dirty && <span className="text-xs text-amber-300 mr-auto">Unsaved changes · total {zar(total)}</span>}
          {dirty && <button onClick={() => setDraft(draftOf(review))} className={`${btnGhost} py-1.5 text-xs`}>Cancel</button>}
          <button onClick={() => onSave(draft)} disabled={!dirty} className={`${btnPrimary} py-1.5 text-xs flex items-center gap-1.5`}><Check size={14} /> Save</button>
        </div>
      )}
    </div>
  );
}

function SnagReviewView({ projects, user, isCoord, canEdit, save, onOpen }) {
  const [filter, setFilter] = useState("pending"); // pending | all
  const [noteDraft, setNoteDraft] = useState({});
  const rows = useMemo(() => projects
    .flatMap((p) => (p.snags || []).filter((s) => s.resolved).map((s) => ({ p, s })))
    .filter(({ s }) => filter === "all" || !(s.review && s.review.cause))
    .sort((a, b) => (b.s.resolvedAt || "").localeCompare(a.s.resolvedAt || "")), [projects, filter]);

  const patchReview = (p, s, patch, extraLog, msg) => {
    const review = { cause: null, costs: [], notes: [], ...(s.review || {}), ...patch };
    const log = extraLog ? [...(p.log || []), { id: uid(), text: extraLog, author: user.name, createdAt: new Date().toISOString() }] : p.log;
    save({ ...p, snags: p.snags.map((x) => (x.id === s.id ? { ...x, review } : x)), log }, msg);
  };
  // Phase 11.1 — cause and cost lines are edited as a draft and only saved when Save is pressed
  const saveReview = (p, s, draft) => {
    const costs = draft.costs
      .filter((c) => c.amount !== "" || (c.note || "").trim())
      .map((c) => ({ ...c, amount: c.amount === "" ? "" : Number(c.amount), note: (c.note || "").trim() }));
    const total = costs.reduce((n, c) => n + (Number(c.amount) || 0), 0);
    patchReview(p, s, { cause: draft.cause || null, costs, reviewedBy: user.name, reviewedAt: new Date().toISOString() },
      `Snag review saved: ${draft.cause || "cause not allocated"} · ${zar(total)}`,
      draft.cause ? "Snag review saved" : "Costs saved — cause still to be allocated");
  };
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
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2"><ClipboardCheck size={22} className="text-slate-300" /> Snag review</h1>
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
              const rowEdit = canEdit(p);
              return (
                <div key={s.id} className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    {s.photo && <img src={s.photo} alt="Snag" className="w-14 h-14 object-cover rounded-lg border border-[#30363d] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <button onClick={() => onOpen(p)} className="font-medium text-white hover:underline">{p.clientName}</button>
                      <span className="text-xs text-slate-400"> · PO {p.po} · <d.icon size={12} className="inline" /> {d.label} · {p.productType} · {p.consultant}{p.team ? ` · ${teamLabel(p.department, p.team)}` : ""}</span>
                      <div className="text-sm text-slate-300 mt-1"><span className="text-[11px] px-1.5 py-0.5 rounded border border-slate-500/40 text-slate-400 mr-2">Logged as {s.category}</span>{s.description}</div>
                      <div className="text-xs text-emerald-200/80 mt-1">Resolved by {s.resolvedBy} on {fmtShort((s.resolvedAt || "").slice(0, 10))}: {s.resolveReason}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-500">Cost to company</div>
                      <div className={`text-lg font-semibold ${totalOf(s) > 0 ? "text-red-300" : "text-slate-400"}`}>{zar(totalOf(s))}</div>
                    </div>
                  </div>

                  <ReviewEditor key={s.id} review={r} canEdit={rowEdit} onSave={(draft) => saveReview(p, s, draft)} />

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
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-6">
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

/* =========================================================
   PHASE 9 — PERFORMANCE REPORT (consultants + install teams)
   Every figure is worked out live from the job data, so adding a new
   metric later is one extra line in computePerformance().
   ========================================================= */
const PERF_MODES = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "custom", label: "Custom range" },
  { id: "all", label: "All time" },
];
// Timestamps (ISO with time) or plain dates -> local "YYYY-MM-DD"
const dayOf = (ts) => { if (!ts) return null; if (ts.length === 10) return ts; const d = new Date(ts); return isNaN(d) ? null : iso(d); };
const inPeriod = (d, from, to) => !!d && (!from || d >= from) && (!to || d <= to);
// Reviewed cause wins; otherwise fall back to the category it was logged under
const snagCauseOf = (s) => (s.review && s.review.cause) || s.category || "";
const snagCostOf = (s) => ((s.review && s.review.costs) || []).reduce((n, c) => n + (Number(c.amount) || 0), 0);
const rangeLabel = (l) => (l.supplier === OTHER_SUPPLIER ? "Other" : (l.productRange ? composeProduct(l.supplier, l.productRange) : (l.productType || "Range not specified")));
const m2 = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-ZA")} m²`;
const quarterOptions = () => {
  const now = new Date(); let y = now.getFullYear(); let q = Math.floor(now.getMonth() / 3) + 1;
  const out = [];
  for (let i = 0; i < 12; i++) { out.push(`${y}-Q${q}`); q--; if (q === 0) { q = 4; y--; } }
  return out;
};
function periodOf({ mode, month, quarter, from, to }) {
  if (mode === "month" && month) {
    const [y, m] = month.split("-").map(Number);
    return { from: `${month}-01`, to: `${month}-${pad(new Date(y, m, 0).getDate())}`, label: new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" }) };
  }
  if (mode === "quarter" && quarter) {
    const [y, qs] = quarter.split("-Q"); const qn = Number(qs); const sm = (qn - 1) * 3 + 1; const em = sm + 2;
    return { from: `${y}-${pad(sm)}-01`, to: `${y}-${pad(em)}-${pad(new Date(Number(y), em, 0).getDate())}`, label: `Q${qn} ${y}` };
  }
  if (mode === "custom") {
    return { from: from || null, to: to || null, label: `${from ? fmt(from) : "Start"} to ${to ? fmt(to) : "today"}` };
  }
  return { from: null, to: null, label: "All time" };
}

const blankStats = () => ({ ordered: 0, repairs: 0, booked: 0, completed: 0, invoiced: 0, m2: 0, m2ByDept: {}, ranges: {}, snags: 0, snagCost: 0 });

// The single loop every number in the report comes from.
function computePerformance(projects, { from, to }, deptFilter) {
  const scope = projects.filter((p) => deptFilter === "all" || p.department === deptFilter);
  const consultants = {}, teams = {};
  const allRanges = {}; // Phase 12A — every range sold in the period: m² and number of jobs it appeared on
  const cStat = (name) => (consultants[name] = consultants[name] || blankStats());
  const tStat = (dept, team) => { const k = `${dept}|${team}`; return (teams[k] = teams[k] || { dept, team, ...blankStats() }); };
  // Seed known people/teams so zero rows still show
  CONSULTANTS.forEach(cStat);
  DEPARTMENTS.filter((d) => deptFilter === "all" || d.id === deptFilter).forEach((d) => teamsOf(d.id).forEach((t) => tStat(d.id, t)));

  scope.forEach((p) => {
    const c = cStat(p.consultant || "Unassigned");
    const t = tStat(p.department, p.team || teamsOf(p.department)[0]);
    const area = totalArea(p);
    const bookDate = p.installDate || scheduleOf(p)[0]?.date || null;

    // Ordered = job created in the period. Consultant m² and ranges count here (what was sold).
    if (inPeriod(dayOf(p.createdAt), from, to)) {
      c.ordered++; t.ordered++;
      if (isRepair(p)) { c.repairs++; t.repairs++; } // Phase 11 — repairs are part of Ordered, also shown on their own
      c.m2 += area;
      if (area) c.m2ByDept[p.department] = (c.m2ByDept[p.department] || 0) + area;
      const seenRanges = new Set();
      productLinesOf(p).forEach((l) => {
        const a = Number(l.area) || 0;
        const k = rangeLabel(l);
        const r = (c.ranges[k] = c.ranges[k] || { m2: 0, lines: 0, panels: 0 });
        r.m2 += a; r.lines++; r.panels += Number(l.panels) || 0;
        const g = (allRanges[k] = allRanges[k] || { m2: 0, jobs: 0 });
        g.m2 += a; if (!seenRanges.has(k)) { seenRanges.add(k); g.jobs++; }
      });
    }
    // Booked = first install day falls in the period (still booked or already done)
    if ((p.status === "booked" || p.status === "installed") && inPeriod(bookDate, from, to)) { c.booked++; t.booked++; }
    // Completed = marked installed in the period. Team m² counts here (what was actually laid).
    if (p.status === "installed" && inPeriod(dayOf(p.installedAt), from, to)) { c.completed++; t.completed++; t.m2 += area; }
    // Invoiced = moved to History in the period
    if (p.invoiced && inPeriod(dayOf(p.invoicedAt), from, to)) { c.invoiced++; t.invoiced++; }

    (p.snags || []).forEach((s) => {
      if (!inPeriod(dayOf(s.createdAt), from, to)) return;
      const cause = snagCauseOf(s);
      if (cause === "Consultant boo-boo") { c.snags++; c.snagCost += snagCostOf(s); }
      if (cause === "Installation boo-boo") { t.snags++; t.snagCost += snagCostOf(s); }
    });
  });

  const consultantRows = Object.entries(consultants).map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.m2 - a.m2 || b.ordered - a.ordered || a.name.localeCompare(b.name));
  const deptOrder = DEPARTMENTS.map((d) => d.id);
  const teamRows = Object.values(teams)
    .sort((a, b) => deptOrder.indexOf(a.dept) - deptOrder.indexOf(b.dept) || a.team.localeCompare(b.team));
  const sum = (rows) => rows.reduce((acc, r) => ({ ordered: acc.ordered + r.ordered, repairs: acc.repairs + r.repairs, booked: acc.booked + r.booked, completed: acc.completed + r.completed, invoiced: acc.invoiced + r.invoiced, m2: acc.m2 + r.m2, snags: acc.snags + r.snags, snagCost: acc.snagCost + r.snagCost }), blankStats());
  return { consultantRows, teamRows, cTotal: sum(consultantRows), tTotal: sum(teamRows), allRanges };
}

/* =========================================================
   PHASE 12A — LEADERBOARD
   Six boards built from the same numbers as the rest of the report (same period and department filter).
   Ties keep list order (no shared ranks). Anyone with nothing to count sits at the bottom.
   ========================================================= */
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const RANGE_BOARD_LIMIT = 10;
function computeLeaderboard(data) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const rank = (rows) => rows.map((r, i) => ({ ...r, rank: i + 1, gold: i === 0 && r.active }));

  const consultantM2 = rank(data.consultantRows.map((r) => ({ key: r.name, name: r.name, score: r.m2, display: m2(r.m2), active: r.m2 > 0 }))
    .sort((a, b) => b.score - a.score || byName(a, b)));

  const invoiced = rank(data.consultantRows.map((r) => ({ key: r.name, name: r.name, score: r.invoiced, display: plural(r.invoiced, "job"), active: r.invoiced > 0 }))
    .sort((a, b) => b.score - a.score || byName(a, b)));

  // Teams: Shutters and Calore are one team (Joey), so they're merged by calendar
  const teamMap = {};
  data.teamRows.forEach((r) => {
    const cal = calendarOf(r.dept);
    const k = `${cal}|${r.team}`;
    const t = (teamMap[k] = teamMap[k] || { key: k, name: teamLabel(r.dept, r.team), sub: calOf(cal).label, score: 0 });
    t.score += r.m2;
  });
  const teamM2 = rank(Object.values(teamMap).map((t) => ({ ...t, display: m2(t.score), active: t.score > 0 }))
    .sort((a, b) => b.score - a.score || byName(a, b)));

  // Fewest consultant snags per m² sold. Nobody with m² sold can be scored, so they go to the bottom.
  const snagRate = rank(data.consultantRows.map((r) => {
    const active = r.m2 > 0;
    const rate = active ? r.snags / r.m2 : Infinity;
    return { key: r.name, name: r.name, score: rate, m2: r.m2, active,
      display: active ? `${plural(r.snags, "snag")} · ${(Math.round(rate * 10000) / 100).toLocaleString("en-ZA")} per 100 m²` : "No m² sold" };
  }).sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1) || a.score - b.score || b.m2 - a.m2 || byName(a, b)));

  const ranges = Object.entries(data.allRanges || {}).filter(([k]) => k !== "Range not specified");
  const rangeM2 = rank(ranges.filter(([, v]) => v.m2 > 0).map(([k, v]) => ({ key: k, name: k, score: v.m2, jobs: v.jobs, display: m2(v.m2), active: true }))
    .sort((a, b) => b.score - a.score || b.jobs - a.jobs || byName(a, b)));
  const rangeJobs = rank(ranges.map(([k, v]) => ({ key: k, name: k, score: v.jobs, m2: v.m2, display: plural(v.jobs, "job"), active: v.jobs > 0 }))
    .sort((a, b) => b.score - a.score || b.m2 - a.m2 || byName(a, b)));

  return [
    { id: "consultantM2", title: "Top consultant · m² sold", kind: "consultant", rows: consultantM2 },
    { id: "invoiced", title: "Top consultant · jobs invoiced", kind: "consultant", rows: invoiced },
    { id: "teamM2", title: "Top install team · m² installed", kind: "team", rows: teamM2 },
    { id: "snagRate", title: "Fewest snags per m² sold", kind: "consultant", rows: snagRate },
    { id: "rangeM2", title: "Top range · m²", kind: "range", rows: rangeM2, limit: RANGE_BOARD_LIMIT },
    { id: "rangeJobs", title: "Top range · number of jobs", kind: "range", rows: rangeJobs, limit: RANGE_BOARD_LIMIT },
  ];
}

const RankMark = ({ row }) => (
  row.gold
    ? <span title="First place" className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 text-black flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.45)]"><Crown size={13} strokeWidth={2.5} /></span>
    : <span className="w-6 h-6 rounded-full bg-[#0d1117] border border-[#30363d] text-slate-400 text-[11px] font-semibold flex items-center justify-center shrink-0 tabular-nums">{row.rank}</span>
);

function LeaderboardBoard({ board }) {
  const shown = board.limit ? board.rows.slice(0, board.limit) : board.rows;
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{board.title}</div>
      {shown.length === 0 ? (
        <div className="text-xs text-slate-500">Nothing to rank in this period.</div>
      ) : (
        <div className="space-y-1.5">
          {shown.map((r) => (
            <div key={r.key} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${r.gold ? "bg-amber-400/10 border border-amber-400/40" : ""} ${r.active ? "" : "opacity-50"}`}>
              <RankMark row={r} />
              <span className="flex-1 min-w-0 truncate text-sm">
                <span className={r.gold ? "text-amber-200 font-semibold" : "text-slate-100"}>{r.name}</span>
                {r.sub && <span className="text-slate-500 text-xs"> · {r.sub}</span>}
              </span>
              <span className={`text-xs tabular-nums shrink-0 ${r.gold ? "text-amber-200" : "text-slate-400"}`}>{r.display}</span>
            </div>
          ))}
          {board.limit && board.rows.length > board.limit && <div className="text-[11px] text-slate-500 pt-1">Top {board.limit} of {board.rows.length}</div>}
        </div>
      )}
    </div>
  );
}

// Full board — Franco and Developer (inside the Performance Report)
function LeaderboardPanel({ boards }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 mt-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1"><Trophy size={18} className="text-amber-300" /> Leaderboard</h2>
      <div className="text-xs text-slate-500 mb-4">Same period and department as the report above. Everyone else only sees their own position.</div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {boards.map((b) => <LeaderboardBoard key={b.id} board={b} />)}
      </div>
    </div>
  );
}

// Own position only — shown to everyone who can't open the full report
function MyStanding({ projects, user }) {
  const now = new Date();
  const [mode, setMode] = useState("month");
  const period = periodOf({ mode, month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`, quarter: quarterOptions()[0] });
  const boards = useMemo(() => computeLeaderboard(computePerformance(projects, period, "all")), [projects, period.from, period.to]);
  const mine = boards.filter((b) => b.kind === "consultant")
    .map((b) => ({ board: b, row: b.rows.find((r) => r.name === user.name), total: b.rows.length }))
    .filter((x) => x.row);
  if (!mine.length) return null;
  return (
    <div className="max-w-2xl mx-auto mt-4 bg-[#161b22] border border-[#30363d] rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2"><Trophy size={17} className="text-amber-300" /> Your standing</h2>
        <div className="flex gap-1 bg-[#0d1117] border border-[#30363d] rounded-xl p-1">
          {[["month", "This month"], ["quarter", "This quarter"], ["all", "All time"]].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} className={`px-3 py-1 rounded-lg text-xs ${mode === id ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#21262d]"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {mine.map(({ board, row, total }) => (
          <div key={board.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${row.gold ? "bg-amber-400/10 border-amber-400/40" : "bg-[#0d1117] border-[#30363d]"}`}>
            <RankMark row={row} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-100">{board.title}</div>
              <div className="text-xs text-slate-500">{row.active ? `Position ${row.rank} of ${total}` : "Not ranked yet this period"}</div>
            </div>
            <span className={`text-xs tabular-nums ${row.gold ? "text-amber-200" : "text-slate-400"}`}>{row.display}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
const sortedRanges = (ranges) => Object.entries(ranges).sort((a, b) => b[1].m2 - a[1].m2 || b[1].lines - a[1].lines);

/* Phase 12C — group confidential reviews by install team for the Performance Report */
function groupReviews(reviews, projects, { from, to }, deptFilter) {
  if (!Array.isArray(reviews)) return null;
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const groups = {};
  reviews.forEach((v) => {
    if (v.isTest) return;
    if (!inPeriod(dayOf(v.createdAt), from, to)) return;
    const p = byId[v.projectId];
    const dept = p ? p.department : v.department;
    if (deptFilter !== "all" && dept !== deptFilter) return;
    const team = (p ? p.team : v.team) || teamsOf(dept)[0];
    const cal = calendarOf(dept);
    const k = `${cal}|${team}`;
    const g = (groups[k] = groups[k] || { key: k, name: teamLabel(dept, team), sub: calOf(cal).label, items: [], concerns: {} });
    g.items.push({ ...v, clientName: p ? p.clientName : v.clientName, po: p ? p.po : v.po });
    (v.concerns || []).forEach((c) => { g.concerns[c] = (g.concerns[c] || 0) + 1; });
  });
  return Object.values(groups).map((g) => ({
    ...g,
    avg: g.items.reduce((n, v) => n + (Number(v.rating) || 0), 0) / g.items.length,
    items: g.items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
  })).sort((a, b) => a.avg - b.avg || b.items.length - a.items.length || a.name.localeCompare(b.name));
}
function TeamReviewsPanel({ groups }) {
  const [openKey, setOpenKey] = useState(null);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="bg-[#161b22] border border-amber-400/30 rounded-2xl p-5 mt-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1"><ShieldCheck size={18} className="text-amber-300" /> Installation reviews</h2>
      <div className="text-xs text-slate-500 mb-4">Confidential · Franco and developer only · {total} review{total === 1 ? "" : "s"} in this period · lowest average first · not included in the PDF</div>
      {groups.length === 0 ? <div className="text-sm text-slate-500">No reviews in this period.</div> : (
        <div className="space-y-2">
          {groups.map((g) => {
            const isOpen = openKey === g.key;
            const avg = Math.round(g.avg * 10) / 10;
            return (
              <div key={g.key} className="bg-[#0d1117] border border-[#30363d] rounded-xl">
                <button onClick={() => setOpenKey(isOpen ? null : g.key)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <span className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium">{g.name}</span>
                    <span className="text-xs text-slate-500"> · {g.sub}</span>
                  </span>
                  <Stars value={Math.round(g.avg)} />
                  <span className="text-xs text-slate-300 tabular-nums w-24 text-right">{avg} avg · {g.items.length}</span>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {Object.keys(g.concerns).length > 0 && (
                  <div className="flex flex-wrap gap-1 px-4 pb-3 -mt-1">
                    {Object.entries(g.concerns).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-full border border-red-500/40 text-red-200">{c} × {n}</span>
                    ))}
                  </div>
                )}
                {isOpen && <div className="px-4 pb-4 space-y-2">{g.items.map((v) => <ReviewCard key={v.id} review={v} showJob />)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PerformanceBeta() {
  return (
    <div className="max-w-2xl mx-auto mt-10 bg-[#161b22] border border-amber-400/30 rounded-2xl p-10 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/40 flex items-center justify-center mb-5">
        <TrendingUp size={26} className="text-amber-300" />
      </div>
      <div className="inline-block text-[10px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full border border-amber-400/50 text-amber-300 mb-4">BETA TESTING</div>
      <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Performance Report</h1>
      <p className="text-slate-400 text-sm leading-relaxed">Something big is on its way. This feature is currently being tested and will open up to everyone soon.</p>
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"><Lock size={12} /> Limited access during testing</div>
    </div>
  );
}

function PerformanceView({ projects, user, reviews }) {
  const now = new Date();
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [quarter, setQuarter] = useState(quarterOptions()[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dept, setDept] = useState("all");
  const [tab, setTab] = useState("consultants");

  const period = periodOf({ mode, month, quarter, from, to });
  const data = useMemo(() => computePerformance(projects, period, dept), [projects, period.from, period.to, dept]);
  const boards = useMemo(() => computeLeaderboard(data), [data]);
  // Phase 12C — confidential reviews grouped by install team (Shutters and Calore are one team)
  const reviewGroups = useMemo(() => groupReviews(reviews, projects, period, dept), [reviews, projects, period.from, period.to, dept]);
  const deptLabel = dept === "all" ? "All departments" : deptOf(dept).label;
  const generated = new Date().toLocaleString("en-ZA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const th = "text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-2 px-3";
  const td = "py-2.5 px-3 text-sm text-slate-200";
  const num = "py-2.5 px-3 text-sm text-slate-200 text-right tabular-nums";
  const pipelineCells = (r, bold) => (
    <>
      <td className={`${num} ${bold ? "font-semibold" : ""}`}>{r.ordered}</td>
      <td className={`${num} ${bold ? "font-semibold" : ""} ${r.repairs ? "text-sky-300" : ""}`}>{r.repairs}</td>
      <td className={`${num} ${bold ? "font-semibold" : ""}`}>{r.booked}</td>
      <td className={`${num} ${bold ? "font-semibold" : ""}`}>{r.completed}</td>
      <td className={`${num} ${bold ? "font-semibold" : ""}`}>{r.invoiced}</td>
      <td className={`${num} ${bold ? "font-semibold" : ""}`}>{r.m2 ? m2(r.m2) : "—"}</td>
      <td className={`${num} ${bold ? "font-semibold" : ""}`}>{r.snags}</td>
      <td className={`${num} ${bold ? "font-semibold" : ""} ${r.snagCost > 0 ? "text-red-300" : ""}`}>{r.snagCost ? zar(r.snagCost) : "—"}</td>
    </>
  );
  const pipelineHeads = (m2Label, snagLabel) => (
    <>
      <th className={`${th} text-right`}>Ordered</th>
      <th className={`${th} text-right`}>Repairs</th>
      <th className={`${th} text-right`}>Booked</th>
      <th className={`${th} text-right`}>Completed</th>
      <th className={`${th} text-right`}>Invoiced</th>
      <th className={`${th} text-right`}>{m2Label}</th>
      <th className={`${th} text-right`}>{snagLabel}</th>
      <th className={`${th} text-right`}>Snag cost</th>
    </>
  );

  return (
    <div>
      {/* ---------- Controls (screen only) ---------- */}
      <div className="print:hidden bg-[#161b22] border border-[#30363d] rounded-2xl p-4 md:p-5 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2"><TrendingUp size={22} className="text-slate-300" /> Performance Report</h1>
            <div className="text-sm text-slate-400">{period.label} · {deptLabel}</div>
          </div>
          <button onClick={() => window.print()} className={`${btnPrimary} flex items-center gap-2`}><Printer size={16} /> Save as PDF</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="Period">
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              {PERF_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          {mode === "month" && <Field label="Month"><input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
          {mode === "quarter" && (
            <Field label="Quarter">
              <select className={inputCls} value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                {quarterOptions().map((q) => <option key={q} value={q}>{q.replace("-", " ")}</option>)}
              </select>
            </Field>
          )}
          {mode === "custom" && <Field label="From"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>}
          {mode === "custom" && <Field label="To"><input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></Field>}
          <Field label="Department">
            <select className={inputCls} value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="all">All departments</option>
              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-500 mt-3">Save as PDF opens the print dialog. Choose "Save as PDF" as the printer. The PDF always includes both the consultant and team reports.</p>
      </div>

      {/* ---------- Screen view ---------- */}
      <div className="print:hidden">
        <div className="flex items-center gap-3 mb-3 text-sm text-slate-300 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d]">Installations <span className="text-white font-semibold tabular-nums">{data.cTotal.ordered - data.cTotal.repairs}</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-[#161b22] border border-sky-500/40 flex items-center gap-1.5"><RepairIcon small /> Repairs <span className="text-white font-semibold tabular-nums">{data.cTotal.repairs}</span></span>
          <span className="text-xs text-slate-500">jobs created in this period</span>
        </div>
        <div className="flex gap-1 mb-4 bg-[#161b22] border border-[#30363d] rounded-xl p-1 w-fit">
          {[["consultants", "Consultants"], ["teams", "Install teams"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-lg text-sm ${tab === id ? "bg-[#1e3a6e] text-white" : "text-slate-300 hover:bg-[#21262d]"}`}>{label}</button>
          ))}
        </div>

        {tab === "consultants" ? (
          <div className="space-y-4">
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-[#30363d]">
                  <tr><th className={th}>Consultant</th>{pipelineHeads("m² sold", "Snags")}</tr>
                </thead>
                <tbody>
                  {data.consultantRows.map((r) => <tr key={r.name} className="border-b border-[#21262d]"><td className={`${td} font-medium text-white`}>{r.name}</td>{pipelineCells(r)}</tr>)}
                  <tr className="bg-[#0d1117]"><td className={`${td} font-semibold text-white`}>Total</td>{pipelineCells(data.cTotal, true)}</tr>
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.consultantRows.filter((r) => r.ordered > 0).map((r) => (
                <div key={r.name} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5">
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">{r.name}</h3>
                    <span className="text-sm text-slate-400">{m2(r.m2)} sold</span>
                  </div>
                  {Object.keys(r.m2ByDept).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Object.entries(r.m2ByDept).sort((a, b) => b[1] - a[1]).map(([d, a]) => (
                        <span key={d} className="text-xs px-2 py-1 rounded-lg bg-[#0d1117] border border-[#30363d] text-slate-300">{deptOf(d).label} · {m2(a)}</span>
                      ))}
                    </div>
                  )}
                  {sortedRanges(r.ranges).length === 0 ? (
                    <div className="text-xs text-slate-500">No catalogued ranges in this period (range detail covers catalogued products).</div>
                  ) : (
                    <div className="space-y-1">
                      {sortedRanges(r.ranges).map(([k, v]) => {
                        const pct = r.m2 ? Math.max(3, (v.m2 / r.m2) * 100) : 0;
                        return (
                          <div key={k}>
                            <div className="flex justify-between text-sm"><span className="text-slate-200">{k}</span><span className="text-slate-400 tabular-nums">{v.m2 ? m2(v.m2) : v.panels ? `${v.panels} panel${v.panels === 1 ? "" : "s"}` : `${v.lines} line${v.lines === 1 ? "" : "s"}`}</span></div>
                            {v.m2 > 0 && <div className="h-1 bg-[#0d1117] rounded-full mt-1 mb-1.5"><div className="h-1 bg-[#1f6feb] rounded-full" style={{ width: `${pct}%` }} /></div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-[#30363d]">
                <tr><th className={th}>Department · Team</th>{pipelineHeads("m² installed", "Snags")}</tr>
              </thead>
              <tbody>
                {data.teamRows.map((r) => {
                  const d = deptOf(r.dept);
                  return <tr key={`${r.dept}|${r.team}`} className="border-b border-[#21262d]"><td className={td}><span className="inline-flex items-center gap-2"><d.icon size={14} className="text-slate-500" /><span className="text-white font-medium">{d.label}</span><span className="text-slate-400">· {teamLabel(r.dept, r.team)}</span></span></td>{pipelineCells(r)}</tr>;
                })}
                <tr className="bg-[#0d1117]"><td className={`${td} font-semibold text-white`}>Total</td>{pipelineCells(data.tTotal, true)}</tr>
              </tbody>
            </table>
          </div>
        )}
        {tab === "teams" && reviewGroups && <TeamReviewsPanel groups={reviewGroups} />}
        <p className="text-[11px] text-slate-500 mt-3">Consultant snags count Consultant boo-boos only; team snags count Installation boo-boos only. The reviewed cause is used where one has been allocated. Test projects are excluded.</p>
        <LeaderboardPanel boards={boards} />
      </div>

      {/* ---------- Printable report (PDF) ---------- */}
      <div className="perf-report hidden print:block bg-white text-black">
        <div className="border-b-2 border-black pb-3 mb-5">
          <div className="text-xs tracking-widest text-gray-600">NOLANS PERFORMANCE REPORT</div>
          <h2 className="text-2xl font-bold">{period.label} · {deptLabel}</h2>
          <div className="text-sm mt-1">Installations {data.cTotal.ordered - data.cTotal.repairs} · Repairs {data.cTotal.repairs} (jobs created in the period)</div>
          <div className="text-xs text-gray-600 mt-1">Period: {period.from ? fmt(period.from) : "Start of records"} to {period.to ? fmt(period.to) : "today"} · Generated {generated} by {user.name}</div>
        </div>

        <h3 className="text-lg font-bold mb-2">1. Consultant performance</h3>
        <table className="w-full text-sm border-collapse mb-5">
          <thead><tr className="border-b border-black text-left">
            <th className="py-1 pr-2">Consultant</th><th className="py-1 px-2 text-right">Ordered</th><th className="py-1 px-2 text-right">Repairs</th><th className="py-1 px-2 text-right">Booked</th><th className="py-1 px-2 text-right">Completed</th><th className="py-1 px-2 text-right">Invoiced</th><th className="py-1 px-2 text-right">m² sold</th><th className="py-1 px-2 text-right">Consultant snags</th><th className="py-1 pl-2 text-right">Snag cost</th>
          </tr></thead>
          <tbody>
            {[...data.consultantRows, { name: "TOTAL", ...data.cTotal, isTotal: true }].map((r) => (
              <tr key={r.name} className={`border-b border-gray-300 ${r.isTotal ? "font-bold" : ""}`}>
                <td className="py-1 pr-2">{r.name}</td><td className="py-1 px-2 text-right">{r.ordered}</td><td className="py-1 px-2 text-right">{r.repairs}</td><td className="py-1 px-2 text-right">{r.booked}</td><td className="py-1 px-2 text-right">{r.completed}</td><td className="py-1 px-2 text-right">{r.invoiced}</td><td className="py-1 px-2 text-right">{m2(r.m2)}</td><td className="py-1 px-2 text-right">{r.snags}</td><td className="py-1 pl-2 text-right">{zar(r.snagCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="text-lg font-bold mb-2">2. Ranges sold per consultant</h3>
        {data.consultantRows.filter((r) => r.ordered > 0).length === 0 && <div className="text-sm text-gray-600 mb-5">No orders in this period.</div>}
        {data.consultantRows.filter((r) => r.ordered > 0).map((r) => (
          <div key={r.name} className="perf-block mb-4">
            <div className="font-semibold">{r.name} · {m2(r.m2)} sold across {r.ordered} order{r.ordered === 1 ? "" : "s"}</div>
            {Object.keys(r.m2ByDept).length > 0 && <div className="text-xs text-gray-700">By department: {Object.entries(r.m2ByDept).sort((a, b) => b[1] - a[1]).map(([d, a]) => `${deptOf(d).label} ${m2(a)}`).join(", ")}</div>}
            {sortedRanges(r.ranges).length === 0 ? (
              <div className="text-xs text-gray-600">No catalogued ranges (range detail covers Carpets and Vinyl only).</div>
            ) : (
              <ul className="text-sm mt-1">
                {sortedRanges(r.ranges).map(([k, v]) => <li key={k}>• {r.name} sold {v.m2 ? m2(v.m2) : `${v.lines} line${v.lines === 1 ? "" : "s"} (no m² entered)`} of {k}</li>)}
              </ul>
            )}
          </div>
        ))}

        <h3 className="text-lg font-bold mb-2 mt-6">3. Install team performance</h3>
        <table className="w-full text-sm border-collapse mb-5">
          <thead><tr className="border-b border-black text-left">
            <th className="py-1 pr-2">Department · Team</th><th className="py-1 px-2 text-right">Ordered</th><th className="py-1 px-2 text-right">Repairs</th><th className="py-1 px-2 text-right">Booked</th><th className="py-1 px-2 text-right">Completed</th><th className="py-1 px-2 text-right">Invoiced</th><th className="py-1 px-2 text-right">m² installed</th><th className="py-1 px-2 text-right">Installation snags</th><th className="py-1 pl-2 text-right">Snag cost</th>
          </tr></thead>
          <tbody>
            {[...data.teamRows, { dept: "", team: "TOTAL", ...data.tTotal, isTotal: true }].map((r) => (
              <tr key={`${r.dept}|${r.team}`} className={`border-b border-gray-300 ${r.isTotal ? "font-bold" : ""}`}>
                <td className="py-1 pr-2">{r.isTotal ? "TOTAL" : `${deptOf(r.dept).label} · ${teamLabel(r.dept, r.team)}`}</td><td className="py-1 px-2 text-right">{r.ordered}</td><td className="py-1 px-2 text-right">{r.repairs}</td><td className="py-1 px-2 text-right">{r.booked}</td><td className="py-1 px-2 text-right">{r.completed}</td><td className="py-1 px-2 text-right">{r.invoiced}</td><td className="py-1 px-2 text-right">{m2(r.m2)}</td><td className="py-1 px-2 text-right">{r.snags}</td><td className="py-1 pl-2 text-right">{zar(r.snagCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="text-lg font-bold mb-2 mt-6">4. Leaderboard</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
          {boards.map((b) => {
            const shown = b.limit ? b.rows.slice(0, b.limit) : b.rows;
            return (
              <div key={b.id} className="perf-block">
                <div className="font-semibold text-sm border-b border-black mb-1">{b.title}</div>
                {shown.length === 0 ? <div className="text-xs text-gray-600">Nothing to rank in this period.</div> : (
                  <table className="w-full text-xs border-collapse"><tbody>
                    {shown.map((r) => (
                      <tr key={r.key} className={`border-b border-gray-200 ${r.gold ? "font-bold" : ""} ${r.active ? "" : "text-gray-500"}`}>
                        <td className="py-0.5 pr-2 w-6">{r.gold ? "★" : r.rank}</td>
                        <td className="py-0.5 pr-2">{r.name}{r.sub ? ` · ${r.sub}` : ""}</td>
                        <td className="py-0.5 text-right">{r.display}</td>
                      </tr>
                    ))}
                  </tbody></table>
                )}
                {b.limit && b.rows.length > b.limit && <div className="text-[10px] text-gray-500 mt-0.5">Top {b.limit} of {b.rows.length}</div>}
              </div>
            );
          })}
        </div>

        <div className="perf-block text-xs text-gray-700 border-t border-gray-400 pt-3">
          <div className="font-semibold text-black mb-1">How to read this report</div>
          <div>Ordered: jobs created in the period. Repairs: the repair jobs within Ordered (already included in that count). Booked: jobs whose first install day falls in the period. Completed: jobs marked installed in the period. Invoiced: jobs moved to History in the period. A single job can appear in several columns if it moved through several stages in the same period.</div>
          <div>m² sold (consultants) counts on the order date. m² installed (teams) counts on the completion date. Only Carpets and Vinyl record m² and ranges; other departments show job counts only.</div>
          <div>Consultant snags are snags whose cause is Consultant boo-boo; installation snags are those whose cause is Installation boo-boo. The cause allocated in Snag review is used where set, otherwise the category logged. Snags count on the date logged. Snag cost is the total of cost lines entered in Snag review. Test projects are excluded.</div>
          <div>Leaderboard: m² sold and ranges count on the order date, jobs invoiced on the invoice date, team m² on the completion date (Shutters and Calore count as one team). Fewest snags per m² divides a consultant's consultant boo-boos by their m² sold, shown per 100 m²; consultants with no m² sold go to the bottom. Ties keep list order. The star marks first place.</div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; }
          body { background: white !important; }
          .perf-report { color: black; }
          .perf-report tr, .perf-block { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

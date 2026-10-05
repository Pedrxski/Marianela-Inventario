import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  ShoppingBag,
  BarChart3,
  Package,
  Trash2,
  Pencil,
  X,
  Check,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  LogOut,
  Loader2,
  Lock,
  ImagePlus,
  Globe,
  EyeOff,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------- */
/* Tokens de diseño                                                  */
/* ---------------------------------------------------------------- */
const COLORS = {
  bg: "#F5F7F4",
  surface: "#FFFFFF",
  ink: "#1B2420",
  inkSoft: "#5B6660",
  accent: "#0E6B55",
  accentSoft: "#E3F0EA",
  gold: "#B8862E",
  danger: "#A8402A",
  border: "#E2E5E1",
};

const inputStyle = {
  width: "100%",
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "16px",
  background: "#fff",
  color: COLORS.ink,
  outline: "none",
  boxSizing: "border-box",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: COLORS.inkSoft,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle = { padding: "10px 12px", whiteSpace: "nowrap" };

const iconBtnStyle = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: "8px",
  padding: "6px",
  background: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const typeBadgeStyle = {
  border: `1px dashed ${COLORS.accent}`,
  color: COLORS.accent,
  background: COLORS.accentSoft,
  padding: "2px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const TYPE_OPTIONS = [
  "Camisetas",
  "Pantalones",
  "Vestidos",
  "Faldas",
  "Chaquetas",
  "Sudaderas",
  "Jerséis",
  "Camisas",
  "Shorts",
  "Ropa interior",
  "Accesorios",
  "Calzado",
  "Otro",
];

const CLOTHING_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "Único"];
// Tallas numéricas de cintura, para cuando el tipo de prenda es "Pantalones".
const PANTS_SIZE_OPTIONS = ["26", "28", "30", "32", "34", "36", "38", "40", "42"];

// Debe coincidir exactamente con el constraint "garments_audience_check" de la
// base de datos (ver supabase/migracion-1-columnas-y-fotos.sql) y con las
// opciones de filtro del landing. Si se agrega un valor aquí hay que agregarlo
// también allá.
const AUDIENCE_OPTIONS = ["Unisex", "Damas", "Caballeros", "Niños"];

const GARMENT_IMAGES_BUCKET = "garment-images";
const MAX_IMAGE_MB = 5;

const PERIODS = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
];

const NAV_ITEMS = [
  { value: "agregar", label: "Añadir", icon: Plus },
  { value: "inventario", label: "Inventario", icon: Package },
  { value: "ventas", label: "Ventas", icon: ShoppingBag },
  { value: "dashboard", label: "Dashboard", icon: BarChart3 },
];

const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const WEEK_DAYS = ["L", "M", "X", "J", "V", "S", "D"];

/* ---------------------------------------------------------------- */
/* Utilidades                                                        */
/* ---------------------------------------------------------------- */
const eurFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
function formatEUR(n) {
  return eurFormatter.format(Number.isFinite(n) ? n : 0);
}

/* --- Traducción entre el formato de la app (camelCase) y las columnas de Supabase (snake_case) --- */
function garmentFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    audience: row.audience || "Unisex",
    price: Number(row.price),
    cost: Number(row.cost),
    units: row.units,
    sizes: row.sizes || [],
    images: row.images || [],
    isPublished: !!row.is_published,
    createdAt: row.created_at,
  };
}
function garmentToDb(g) {
  return {
    name: g.name,
    type: g.type,
    audience: g.audience || "Unisex",
    price: g.price,
    cost: g.cost,
    units: g.units,
    sizes: g.sizes || [],
    images: g.images || [],
    is_published: !!g.isPublished,
  };
}
function saleFromDb(row) {
  return {
    id: row.id,
    garmentId: row.garment_id,
    garmentName: row.garment_name,
    type: row.type,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    unitCost: Number(row.unit_cost),
    date: row.sale_date,
    createdAt: row.created_at,
  };
}
function saleToDb(s) {
  return {
    garment_id: s.garmentId,
    garment_name: s.garmentName,
    type: s.type,
    quantity: s.quantity,
    unit_price: s.unitPrice,
    unit_cost: s.unitCost,
    sale_date: s.date,
  };
}

/* --- Subida de fotos a Supabase Storage (bucket "garment-images") ---
   Requiere que ya se haya corrido supabase/migracion-1-columnas-y-fotos.sql
   (crea el bucket y sus políticas: solo usuarios con sesión pueden subir). */
async function uploadGarmentImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" no es una imagen.`);
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`"${file.name}" pesa más de ${MAX_IMAGE_MB}MB.`);
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(GARMENT_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(GARMENT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function parseDateLocal(dateStr) {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return toISODate(new Date());
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getPeriodRange(period, refDateStr) {
  const d = parseDateLocal(refDateStr);
  let start, end;
  if (period === "dia") {
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } else if (period === "semana") {
    const dow = (d.getDay() + 6) % 7;
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  } else if (period === "mes") {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  } else {
    start = new Date(d.getFullYear(), 0, 1);
    end = new Date(d.getFullYear(), 11, 31);
  }
  return { start, end };
}

function isDateInRange(dateStr, start, end) {
  const d = parseDateLocal(dateStr);
  return d >= start && d <= end;
}

function formatRangeLabel(period, range) {
  if (period === "dia") {
    return range.start.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }
  if (period === "semana") {
    const sMonth = MONTHS_SHORT[range.start.getMonth()];
    const eMonth = MONTHS_SHORT[range.end.getMonth()];
    return `${range.start.getDate()} ${sMonth} – ${range.end.getDate()} ${eMonth} ${range.end.getFullYear()}`;
  }
  if (period === "mes") {
    return `${MONTHS_LONG[range.start.getMonth()]} ${range.start.getFullYear()}`;
  }
  return `${range.start.getFullYear()}`;
}

function buildTrend(salesInRange, period, range) {
  if (period === "semana") {
    return WEEK_DAYS.map((label, i) => {
      const day = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() + i);
      const dayStr = toISODate(day);
      const total = salesInRange
        .filter((s) => s.date === dayStr)
        .reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);
      return { label, value: Math.round(total * 100) / 100 };
    });
  }
  if (period === "mes") {
    const daysInMonth = new Date(range.start.getFullYear(), range.start.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayStr = toISODate(new Date(range.start.getFullYear(), range.start.getMonth(), day));
      const total = salesInRange
        .filter((s) => s.date === dayStr)
        .reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);
      return { label: String(day), value: Math.round(total * 100) / 100 };
    });
  }
  if (period === "anio") {
    return MONTHS_SHORT.map((label, i) => {
      const total = salesInRange
        .filter((s) => {
          const sd = parseDateLocal(s.date);
          return sd.getFullYear() === range.start.getFullYear() && sd.getMonth() === i;
        })
        .reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);
      return { label, value: Math.round(total * 100) / 100 };
    });
  }
  return [];
}

/* ---------------------------------------------------------------- */
/* Piezas pequeñas de UI                                             */
/* ---------------------------------------------------------------- */
function TagLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 40 40" fill="none">
      <rect
        x="6" y="6" width="28" height="28" rx="6"
        transform="rotate(-8 20 20)"
        stroke={COLORS.accent} strokeWidth="2" strokeDasharray="3 3"
        fill={COLORS.accentSoft}
      />
      <circle cx="15" cy="15" r="2.4" fill={COLORS.accent} transform="rotate(-8 20 20)" />
    </svg>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block mb-3">
      <span
        className="block text-xs font-semibold mb-1"
        style={{ color: COLORS.inkSoft, letterSpacing: "0.02em", textTransform: "uppercase" }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs mt-1" style={{ color: COLORS.inkSoft }}>{hint}</span>
      )}
    </label>
  );
}

function EmptyState({ text }) {
  return (
    <div
      className="text-center py-10 px-4 rounded-xl"
      style={{ border: `1px dashed ${COLORS.border}`, color: COLORS.inkSoft }}
    >
      <Package size={28} style={{ margin: "0 auto 8px", color: COLORS.accent }} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Inicio de sesión                                                   */
/* ---------------------------------------------------------------- */
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login"); // "login" | "reset" | "reset-sent"

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) {
      setError("Correo o contraseña incorrectos.");
    }
  }

  async function handleResetRequest(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Escribe tu correo primero.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (resetError) {
      setError("No se pudo enviar el correo. Revisa que esté bien escrito.");
    } else {
      setMode("reset-sent");
    }
  }

  return (
    <div
      style={{ minHeight: "100dvh", background: COLORS.bg, fontFamily: "'Inter', sans-serif", color: COLORS.ink }}
      className="w-full flex flex-col items-center justify-center px-6"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        input:focus, button:focus { outline: 2px solid ${COLORS.accent}; outline-offset: 1px; }
      `}</style>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div style={{ marginBottom: 10 }}><TagLogo /></div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
            Inventario
          </h1>
          <p style={{ fontSize: 12, color: COLORS.inkSoft, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
            <Lock size={11} /> Acceso solo para la tienda
          </p>
        </div>

        {mode === "reset-sent" ? (
          <div
            className="text-center text-sm p-4 rounded-xl"
            style={{ background: COLORS.accentSoft, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}
          >
            Te enviamos un correo a <strong>{email}</strong> con un link para crear una contraseña nueva.
            <button
              type="button"
              onClick={() => setMode("login")}
              className="block mx-auto mt-3 text-xs font-semibold underline"
              style={{ color: COLORS.accent, background: "none", border: "none" }}
            >
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={mode === "reset" ? handleResetRequest : handleLogin} noValidate>
            <Field label="Correo">
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                style={inputStyle}
              />
            </Field>
            {mode === "login" && (
              <Field label="Contraseña">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </Field>
            )}

            {error && (
              <div
                className="flex items-center gap-2 text-sm mt-1 mb-2 p-2.5 rounded-lg"
                style={{ color: COLORS.danger, background: "#FBEAE5", border: `1px solid ${COLORS.danger}` }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: COLORS.accent, border: "none", opacity: loading ? 0.7 : 1 }}
              className="w-full text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === "reset" ? "Enviar link de recuperación" : "Entrar"}
            </button>

            <button
              type="button"
              onClick={() => { setError(""); setMode(mode === "reset" ? "login" : "reset"); }}
              className="block mx-auto mt-4 text-xs font-medium underline"
              style={{ color: COLORS.inkSoft, background: "none", border: "none" }}
            >
              {mode === "reset" ? "Volver a iniciar sesión" : "¿Olvidaste tu contraseña?"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Header({ onSignOut }) {
  return (
    <header
      className="w-full flex items-center gap-2 px-4 pt-4 pb-3"
      style={{
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bg,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <TagLogo />
      <div className="flex-1">
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 700, lineHeight: 1.1, margin: 0 }}>
          Marianela Shop
        </h1>
        <p style={{ fontSize: 11, color: COLORS.inkSoft, margin: 0 }}>Gestión de inventario</p>
      </div>
      <button onClick={onSignOut} title="Cerrar sesión" style={{ ...iconBtnStyle, color: COLORS.inkSoft }}>
        <LogOut size={16} />
      </button>
    </header>
  );
}

function BottomNav({ tab, setTab }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex justify-center z-20"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-md flex" style={{ background: "#fff", borderTop: `1px solid ${COLORS.border}` }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.value;
          return (
            <button
              key={item.value}
              onClick={() => setTab(item.value)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? COLORS.accent : COLORS.inkSoft, background: "transparent", border: "none" }}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span style={{ fontSize: "10px", fontWeight: 500 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Toast({ message, type }) {
  return (
    <div className="fixed left-0 right-0 flex justify-center z-30" style={{ bottom: "88px" }}>
      <div
        style={{ background: type === "error" ? COLORS.danger : COLORS.ink, color: "#fff" }}
        className="px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2"
      >
        {type === "error" ? <AlertCircle size={14} /> : <Check size={14} />}
        {message}
      </div>
    </div>
  );
}

function ConfirmDialog({ info, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ background: "rgba(27,36,32,0.45)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md p-5 rounded-t-2xl"
        style={{ background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, margin: "0 0 6px" }}>
          ¿Eliminar {info.type === "garment" ? "prenda" : "venta"}?
        </h3>
        <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
          {info.type === "garment"
            ? `Se eliminará "${info.label}" del inventario. Esta acción no se puede deshacer.`
            : `Se eliminará esta venta de "${info.label}" y el stock se restaurará.`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            style={{ border: `1.5px solid ${COLORS.border}`, background: "#fff" }}
            className="flex-1 py-2.5 rounded-xl font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{ background: COLORS.danger, color: "#fff", border: "none" }}
            className="flex-1 py-2.5 rounded-xl font-medium"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Formulario: Añadir / Editar prenda                                */
/* ---------------------------------------------------------------- */
function AddGarmentForm({ onSubmit, editing, onCancelEdit, typeOptions }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [type, setType] = useState("");
  const [units, setUnits] = useState("");
  const [sizes, setSizes] = useState([]);
  const [audience, setAudience] = useState("Unisex");
  const [isPublished, setIsPublished] = useState(false);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editing) {
      setName(editing.name || "");
      setPrice(String(editing.price ?? ""));
      setCost(String(editing.cost ?? ""));
      setType(editing.type || "");
      setUnits(String(editing.units ?? ""));
      setSizes(editing.sizes || []);
      setAudience(editing.audience || "Unisex");
      setIsPublished(!!editing.isPublished);
      setImages(editing.images || []);
      setError("");
    } else {
      resetForm();
    }
  }, [editing]);

  function resetForm() {
    setName("");
    setPrice("");
    setCost("");
    setType("");
    setUnits("");
    setSizes([]);
    setAudience("Unisex");
    setIsPublished(false);
    setImages([]);
    setError("");
  }

  function toggleSize(s) {
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  const isPants = type.trim().toLowerCase() === "pantalones";
  const sizeOptions = isPants ? PANTS_SIZE_OPTIONS : CLOTHING_SIZE_OPTIONS;

  // Si cambiamos de categoría, descartamos tallas seleccionadas que ya no apliquen
  // (p. ej. "M" seleccionado y luego se cambia el tipo a "Pantalones").
  useEffect(() => {
    setSizes((prev) => prev.filter((s) => sizeOptions.includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPants]);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of files) {
        const url = await uploadGarmentImage(file);
        setImages((prev) => [...prev, url]);
      }
    } catch (err) {
      setError(err.message || "No se pudo subir una de las fotos.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }
  function moveImage(idx, dir) {
    setImages((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const priceNum = parseFloat(price);
      const costTrim = cost.trim();
      const unitsTrim = units.trim();
      const costNum = costTrim === "" ? 0 : parseFloat(cost);
      const unitsNum = unitsTrim === "" ? 0 : parseInt(units, 10);
      if (!name.trim()) { setError("Escribe el nombre de la prenda."); return; }
      if (!type.trim()) { setError("Indica el tipo de prenda."); return; }
      if (!Number.isFinite(priceNum) || priceNum < 0) { setError("El precio no es válido."); return; }
      if (!Number.isFinite(costNum) || costNum < 0) { setError("El costo de compra no es válido."); return; }
      if (!Number.isFinite(unitsNum) || unitsNum < 0) { setError("Las unidades disponibles no son válidas."); return; }
      if (uploading) { setError("Espera a que terminen de subir las fotos."); return; }
      setError("");
      onSubmit({
        name: name.trim(),
        type: type.trim(),
        audience,
        price: priceNum,
        cost: costNum,
        units: unitsNum,
        sizes,
        images,
        isPublished,
      });
      resetForm();
    } catch (err) {
      setError("Ocurrió un error inesperado al guardar. Inténtalo de nuevo.");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="pb-6">
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, margin: "0 0 2px" }}>
        {editing ? "Editar prenda" : "Añadir prenda"}
      </h2>
      <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
        {editing ? "Actualiza los datos y guarda los cambios." : "Registra una nueva prenda en el inventario."}
      </p>

      <Field label="Nombre de la prenda">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Camisa lino azul"
          required
          style={inputStyle}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio de venta (€)">
          <input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00" required style={inputStyle}
          />
        </Field>
        <Field label="Costo de compra (€)" hint="Opcional, 0 si aún no lo sabes.">
          <input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={cost} onChange={(e) => setCost(e.target.value)}
            placeholder="0.00" style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de prenda">
          <input
            list="type-options"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Ej. Camisetas"
            required
            style={inputStyle}
          />
          <datalist id="type-options">
            {typeOptions.map((t) => <option key={t} value={t} />)}
          </datalist>
        </Field>
        <Field label="Público" hint="Filtro del catálogo online.">
          <select value={audience} onChange={(e) => setAudience(e.target.value)} style={inputStyle}>
            {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Unidades disponibles" hint="Opcional, se usa 0 si lo dejas en blanco.">
        <input
          type="number" min="0" step="1" inputMode="numeric"
          value={units} onChange={(e) => setUnits(e.target.value)}
          placeholder="0" style={inputStyle}
        />
      </Field>

      <Field label={isPants ? "Tallas disponibles (cintura)" : "Tallas disponibles"}>
        <div className="flex flex-wrap gap-2 mt-1">
          {sizeOptions.map((s) => {
            const active = sizes.includes(s);
            return (
              <button
                type="button"
                key={s}
                onClick={() => toggleSize(s)}
                style={{
                  border: `1.5px solid ${active ? COLORS.accent : COLORS.border}`,
                  background: active ? COLORS.accent : "#fff",
                  color: active ? "#fff" : COLORS.ink,
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                {s}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Fotos de la prenda" hint={`Hasta ${MAX_IMAGE_MB}MB cada una. La primera foto es la portada en la tienda online.`}>
        <div className="flex flex-col gap-2">
          {images.length > 0 && (
            <div className="flex flex-col gap-2">
              {images.map((url, idx) => (
                <div
                  key={url + idx}
                  className="flex items-center gap-2 p-1.5 rounded-lg"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  <img
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                  />
                  <span className="text-xs flex-1" style={{ color: COLORS.inkSoft }}>
                    {idx === 0 ? "Portada" : `Foto ${idx + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveImage(idx, -1)}
                    disabled={idx === 0}
                    style={{ ...iconBtnStyle, opacity: idx === 0 ? 0.3 : 1 }}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(idx, 1)}
                    disabled={idx === images.length - 1}
                    style={{ ...iconBtnStyle, opacity: idx === images.length - 1 ? 0.3 : 1 }}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    style={{ ...iconBtnStyle, color: COLORS.danger }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
            style={{ border: `1.5px dashed ${COLORS.border}`, color: COLORS.accent, background: COLORS.accentSoft }}
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {uploading ? "Subiendo…" : "Añadir foto"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </Field>

      <label
        className="flex items-center justify-between gap-3 p-3 rounded-xl mb-3 cursor-pointer"
        style={{ border: `1.5px solid ${isPublished ? COLORS.accent : COLORS.border}`, background: isPublished ? COLORS.accentSoft : "#fff" }}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {isPublished ? <Globe size={16} style={{ color: COLORS.accent }} /> : <EyeOff size={16} style={{ color: COLORS.inkSoft }} />}
          <span>
            Publicar en la tienda online
            <span className="block text-xs font-normal" style={{ color: COLORS.inkSoft }}>
              {isPublished ? "Visible en el landing (precio y fotos, nunca el costo)." : "Solo visible aquí, en el inventario."}
            </span>
          </span>
        </span>
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: COLORS.accent, flexShrink: 0 }}
        />
      </label>

      {error && (
        <div
          className="flex items-center gap-2 text-sm mt-1 mb-2 p-2.5 rounded-lg"
          style={{ color: COLORS.danger, background: "#FBEAE5", border: `1px solid ${COLORS.danger}` }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          style={{ background: COLORS.accent, border: "none" }}
          className="flex-1 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
        >
          {editing ? (<><Check size={18} /> Guardar cambios</>) : (<><Plus size={18} /> Añadir prenda</>)}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancelEdit}
            style={{ border: `1.5px solid ${COLORS.border}`, background: "#fff" }}
            className="px-4 rounded-xl font-medium"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- */
/* Inventario                                                        */
/* ---------------------------------------------------------------- */
function InventoryTab({ garments, onEdit, onDelete }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return garments;
    return garments.filter(
      (g) => g.name.toLowerCase().includes(q) || g.type.toLowerCase().includes(q)
    );
  }, [garments, search]);

  const totalUnits = garments.reduce((sum, g) => sum + (g.units || 0), 0);

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, margin: 0 }}>
          Inventario
        </h2>
        <span className="text-xs" style={{ color: COLORS.inkSoft }}>
          {garments.length} prendas · {totalUnits} uds.
        </span>
      </div>

      <div className="relative mb-4">
        <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: COLORS.inkSoft }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o tipo…"
          style={{ ...inputStyle, paddingLeft: "36px" }}
        />
      </div>

      {garments.length === 0 ? (
        <EmptyState text="Aún no has añadido prendas. Ve a la pestaña «Añadir» para registrar la primera." />
      ) : filtered.length === 0 ? (
        <EmptyState text="No hay prendas que coincidan con tu búsqueda." />
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${COLORS.border}` }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: "680px" }}>
            <thead>
              <tr style={{ background: COLORS.accentSoft }}>
                <th style={thStyle}></th>
                <th style={thStyle}>Prenda</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Tallas</th>
                <th style={thStyle}>Precio</th>
                <th style={thStyle}>Costo</th>
                <th style={thStyle}>Stock</th>
                <th style={thStyle}>Tienda</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td style={tdStyle}>
                    {g.images && g.images[0] ? (
                      <img
                        src={g.images[0]}
                        alt=""
                        style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: 6,
                          border: `1px dashed ${COLORS.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: COLORS.inkSoft,
                        }}
                      >
                        <ImagePlus size={13} />
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>
                    {g.name}
                    <span className="block text-xs font-normal" style={{ color: COLORS.inkSoft }}>{g.audience}</span>
                  </td>
                  <td style={tdStyle}><span style={typeBadgeStyle}>{g.type}</span></td>
                  <td style={tdStyle}>{g.sizes && g.sizes.length ? g.sizes.join(", ") : "—"}</td>
                  <td style={{ ...tdStyle, color: COLORS.gold, fontWeight: 600 }}>{formatEUR(g.price)}</td>
                  <td style={tdStyle}>{formatEUR(g.cost)}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        color: g.units === 0 ? COLORS.danger : g.units <= 3 ? COLORS.gold : COLORS.ink,
                        fontWeight: 700,
                      }}
                    >
                      {g.units}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {g.isPublished ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.accent }}>
                        <Globe size={13} /> Publicada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}>
                        <EyeOff size={13} /> Oculta
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div className="flex gap-1">
                      <button onClick={() => onEdit(g)} style={iconBtnStyle}><Pencil size={14} /></button>
                      <button onClick={() => onDelete(g)} style={{ ...iconBtnStyle, color: COLORS.danger }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Ventas                                                             */
/* ---------------------------------------------------------------- */
function SalesTab({ garments, sales, onAddSale, onDeleteSale }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState("");

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const avail = garments.filter((g) => g.units > 0);
    if (!q) return avail.slice(0, 8);
    return avail
      .filter((g) => g.name.toLowerCase().includes(q) || g.type.toLowerCase().includes(q))
      .slice(0, 8);
  }, [garments, query]);

  function handleSelect(g) {
    setSelected(g);
    setQuery(g.name);
    setQty("1");
    setError("");
  }

  function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
      if (!selected) { setError("Selecciona una prenda de la lista."); return; }
      const q = parseInt(qty, 10);
      if (!Number.isFinite(q) || q <= 0) { setError("La cantidad debe ser mayor que 0."); return; }
      if (q > selected.units) { setError(`Solo quedan ${selected.units} unidades disponibles.`); return; }
      if (!date) { setError("Selecciona la fecha de la venta."); return; }
      onAddSale({ garmentId: selected.id, quantity: q, date });
      setSelected(null);
      setQuery("");
      setQty("1");
      setDate(todayStr());
      setError("");
    } catch (err) {
      setError("Ocurrió un error inesperado al registrar la venta. Inténtalo de nuevo.");
    }
  }

  const recentSales = sales.slice(0, 10);
  const qtyNum = parseFloat(qty) || 0;

  return (
    <div className="pb-6">
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, margin: "0 0 2px" }}>
        Registrar venta
      </h2>
      <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
        Busca la prenda, indica la cantidad y la fecha.
      </p>

      <form onSubmit={handleSubmit}>
        <Field label="Prenda vendida">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Buscar prenda…"
            style={inputStyle}
          />
        </Field>

        {!selected && query && (
          <div className="mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            {options.length === 0 ? (
              <div className="p-3 text-sm" style={{ color: COLORS.inkSoft }}>
                Sin resultados con stock disponible.
              </div>
            ) : (
              options.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => handleSelect(g)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between"
                  style={{ borderTop: `1px solid ${COLORS.border}`, background: "#fff" }}
                >
                  <span>
                    <span className="font-medium">{g.name}</span>
                    <span className="block text-xs" style={{ color: COLORS.inkSoft }}>
                      {g.type} · Stock: {g.units}
                    </span>
                  </span>
                  <span style={{ color: COLORS.gold, fontWeight: 600 }} className="text-sm">
                    {formatEUR(g.price)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {selected && (
          <div className="mb-3 p-3 rounded-xl flex items-center justify-between" style={{ background: COLORS.accentSoft }}>
            <div>
              <div className="font-medium text-sm">{selected.name}</div>
              <div className="text-xs" style={{ color: COLORS.inkSoft }}>
                Stock disponible: {selected.units}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelected(null); setQuery(""); }}
              style={iconBtnStyle}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad">
            <input
              type="number" min="1" step="1" inputMode="numeric"
              value={qty} onChange={(e) => setQty(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Fecha de venta">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayStr()}
              style={inputStyle}
            />
          </Field>
        </div>

        {selected && (
          <p className="text-sm mb-2" style={{ color: COLORS.inkSoft }}>
            Total: <span style={{ color: COLORS.gold, fontWeight: 700 }}>{formatEUR(qtyNum * selected.price)}</span>
          </p>
        )}

        {error && (
          <div
            className="flex items-center gap-2 text-sm mb-2 p-2.5 rounded-lg"
            style={{ color: COLORS.danger, background: "#FBEAE5", border: `1px solid ${COLORS.danger}` }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          style={{ background: COLORS.accent, border: "none" }}
          className="w-full text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
        >
          <ShoppingBag size={18} /> Registrar venta
        </button>
      </form>

      <div className="mt-7">
        <h3
          className="text-sm font-semibold mb-2"
          style={{ color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          Ventas recientes
        </h3>
        {recentSales.length === 0 ? (
          <EmptyState text="Todavía no se han registrado ventas." />
        ) : (
          <div className="flex flex-col gap-2">
            {recentSales.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl flex items-center justify-between"
                style={{ border: `1px solid ${COLORS.border}` }}
              >
                <div>
                  <div className="font-medium text-sm">
                    {s.garmentName} <span style={{ color: COLORS.inkSoft }}>×{s.quantity}</span>
                  </div>
                  <div className="text-xs" style={{ color: COLORS.inkSoft }}>
                    {formatDateDisplay(s.date)} · {s.type}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: COLORS.gold, fontWeight: 700 }} className="text-sm">
                    {formatEUR(s.unitPrice * s.quantity)}
                  </span>
                  <button onClick={() => onDeleteSale(s)} style={{ ...iconBtnStyle, color: COLORS.danger }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Dashboard                                                          */
/* ---------------------------------------------------------------- */
function KpiCard({ label, value, icon, color, span }) {
  return (
    <div
      className={span ? "col-span-2" : ""}
      style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 14px", background: "#fff" }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span
          className="text-xs font-semibold"
          style={{ letterSpacing: "0.03em", color: COLORS.inkSoft, textTransform: "uppercase" }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function DashboardTab({ sales, garments }) {
  const [period, setPeriod] = useState("mes");
  const [refDate, setRefDate] = useState(todayStr());
  const [selectedType, setSelectedType] = useState("all");

  const range = useMemo(() => getPeriodRange(period, refDate), [period, refDate]);

  const salesInRange = useMemo(
    () => sales.filter((s) => isDateInRange(s.date, range.start, range.end)),
    [sales, range]
  );

  const availableTypes = useMemo(() => {
    const set = new Set();
    garments.forEach((g) => { if (g.type) set.add(g.type); });
    sales.forEach((s) => { if (s.type) set.add(s.type); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [garments, sales]);

  const filteredSales = useMemo(
    () => (selectedType === "all" ? salesInRange : salesInRange.filter((s) => s.type === selectedType)),
    [salesInRange, selectedType]
  );

  const totals = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let units = 0;
    const byGroup = {};
    filteredSales.forEach((s) => {
      revenue += s.unitPrice * s.quantity;
      cost += s.unitCost * s.quantity;
      units += s.quantity;
      // Con "Todas las prendas" agrupamos por tipo; al filtrar un tipo concreto,
      // agrupamos por prenda para dar un detalle más útil.
      const key = selectedType === "all" ? s.type : s.garmentName;
      byGroup[key] = (byGroup[key] || 0) + s.quantity;
    });
    const groupList = Object.entries(byGroup)
      .map(([label, qty]) => ({ label, qty }))
      .sort((a, b) => b.qty - a.qty);
    return { revenue, profit: revenue - cost, units, groupList };
  }, [filteredSales, selectedType]);

  const trend = useMemo(() => buildTrend(filteredSales, period, range), [filteredSales, period, range]);
  const rangeLabel = formatRangeLabel(period, range);
  const maxGroupQty = totals.groupList.length ? totals.groupList[0].qty : 1;

  function shift(delta) {
    const d = parseDateLocal(refDate);
    if (period === "dia") d.setDate(d.getDate() + delta);
    else if (period === "semana") d.setDate(d.getDate() + delta * 7);
    else if (period === "mes") d.setMonth(d.getMonth() + delta);
    else d.setFullYear(d.getFullYear() + delta);
    setRefDate(toISODate(d));
  }

  return (
    <div className="pb-6">
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, margin: "0 0 2px" }}>
        Dashboard de ventas
      </h2>
      <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>
        Analiza tus ventas por periodo.
      </p>

      <div className="flex gap-2 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              background: period === p.value ? COLORS.accent : "#fff",
              color: period === p.value ? "#fff" : COLORS.ink,
              border: `1.5px solid ${period === p.value ? COLORS.accent : COLORS.border}`,
            }}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <Field label="Ver reporte de">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={inputStyle}
          >
            <option value="all">Todas las prendas (general)</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      <div
        className="flex items-center justify-between mb-4 p-2 rounded-xl"
        style={{ border: `1px solid ${COLORS.border}` }}
      >
        <button onClick={() => shift(-1)} style={iconBtnStyle}><ChevronLeft size={16} /></button>
        <span className="text-sm font-medium">{rangeLabel}</span>
        <button onClick={() => shift(1)} style={iconBtnStyle}><ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <KpiCard label="Ventas totales" value={formatEUR(totals.revenue)} icon={<TrendingUp size={16} />} color={COLORS.gold} />
        <KpiCard
          label="Ganancia total"
          value={formatEUR(totals.profit)}
          icon={totals.profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          color={COLORS.accent}
        />
        <KpiCard label="Unidades vendidas" value={totals.units} icon={<Package size={16} />} color={COLORS.ink} span />
      </div>

      {trend.length > 0 && (
        <div className="mb-5">
          <h3
            className="text-sm font-semibold mb-2"
            style={{ color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em" }}
          >
            Tendencia de ventas
          </h3>
          <div style={{ width: "100%", height: 180, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "8px 4px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: COLORS.inkSoft }}
                  axisLine={{ stroke: COLORS.border }}
                  tickLine={false}
                  interval={period === "mes" ? 2 : 0}
                />
                <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={34} />
                <Tooltip formatter={(v) => formatEUR(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.border}` }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={COLORS.accent} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h3
          className="text-sm font-semibold mb-2"
          style={{ color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em" }}
        >
          {selectedType === "all" ? "Unidades vendidas por tipo" : `Detalle de "${selectedType}" por prenda`}
        </h3>
        {totals.groupList.length === 0 ? (
          <EmptyState
            text={
              selectedType === "all"
                ? "No hay ventas registradas en este periodo."
                : `No hay ventas de "${selectedType}" en este periodo.`
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {totals.groupList.map((t) => (
              <div key={t.label} className="flex items-center gap-2">
                <span className="text-xs" style={{ color: COLORS.inkSoft, width: "96px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.label}
                </span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ background: COLORS.accentSoft, height: 10 }}>
                  <div style={{ width: `${(t.qty / maxGroupQty) * 100}%`, background: COLORS.accent, height: "100%" }} />
                </div>
                <span className="text-xs font-semibold" style={{ width: "24px", textAlign: "right" }}>{t.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* App principal                                                      */
/* ---------------------------------------------------------------- */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = aún no se sabe, null = sin sesión
  const [tab, setTab] = useState("inventario");
  const [garments, setGarments] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingGarment, setEditingGarment] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(message, type) {
    setToast({ message, type: type || "success" });
    setTimeout(() => setToast(null), 2600);
  }

  // Sesión de Supabase Auth: se comprueba al cargar y se escuchan los cambios
  // (login, logout, token renovado) para mantener la app sincronizada.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const reloadGarments = useCallback(async () => {
    const { data, error } = await supabase
      .from("garments")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setGarments(data.map(garmentFromDb));
    return error;
  }, []);

  const reloadSales = useCallback(async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) setSales(data.map(saleFromDb));
    return error;
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let mounted = true;

    (async () => {
      const [gErr, sErr] = await Promise.all([reloadGarments(), reloadSales()]);
      if (mounted) {
        if (gErr || sErr) showToast("No se pudo conectar con la base de datos. Revisa tu conexión.", "error");
        setLoading(false);
      }
    })();

    // Tiempo real: si otro dispositivo añade, edita o borra algo, esta pantalla se
    // actualiza sola sin necesidad de recargar la página manualmente.
    const channel = supabase
      .channel("store-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "garments" }, () => reloadGarments())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => reloadSales())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [session, reloadGarments, reloadSales]);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleSaveGarment(data) {
    try {
      if (editingGarment) {
        const { error } = await supabase.from("garments").update(garmentToDb(data)).eq("id", editingGarment.id);
        if (error) throw error;
        showToast("Prenda actualizada.");
        setEditingGarment(null);
      } else {
        const { error } = await supabase.from("garments").insert([garmentToDb(data)]);
        if (error) throw error;
        showToast("Prenda añadida al inventario.");
      }
      await reloadGarments();
      setTab("inventario");
    } catch (err) {
      showToast("No se pudo guardar la prenda. Revisa tu conexión.", "error");
    }
  }

  function requestDeleteGarment(g) {
    setConfirmDelete({ type: "garment", id: g.id, label: g.name });
  }

  function requestDeleteSale(s) {
    setConfirmDelete({ type: "sale", id: s.id, label: `${s.garmentName} (${formatDateDisplay(s.date)})` });
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === "garment") {
        const { error } = await supabase.from("garments").delete().eq("id", confirmDelete.id);
        if (error) throw error;
        showToast("Prenda eliminada.");
        await reloadGarments();
      } else if (confirmDelete.type === "sale") {
        const sale = sales.find((s) => s.id === confirmDelete.id);
        if (sale) {
          const garment = garments.find((g) => g.id === sale.garmentId);
          if (garment) {
            const { error: uErr } = await supabase
              .from("garments")
              .update({ units: garment.units + sale.quantity })
              .eq("id", garment.id);
            if (uErr) throw uErr;
          }
        }
        const { error } = await supabase.from("sales").delete().eq("id", confirmDelete.id);
        if (error) throw error;
        showToast("Venta eliminada y stock restaurado.");
        await Promise.all([reloadGarments(), reloadSales()]);
      }
    } catch (err) {
      showToast("No se pudo completar la eliminación. Revisa tu conexión.", "error");
    }
    setConfirmDelete(null);
  }

  async function handleAddSale({ garmentId, quantity, date }) {
    const garment = garments.find((g) => g.id === garmentId);
    if (!garment) return;
    try {
      const sale = {
        garmentId: garment.id,
        garmentName: garment.name,
        type: garment.type,
        quantity,
        unitPrice: garment.price,
        unitCost: garment.cost,
        date,
      };
      const { error: sErr } = await supabase.from("sales").insert([saleToDb(sale)]);
      if (sErr) throw sErr;
      const { error: gErr } = await supabase
        .from("garments")
        .update({ units: Math.max(0, garment.units - quantity) })
        .eq("id", garment.id);
      if (gErr) throw gErr;
      showToast("Venta registrada.");
      await Promise.all([reloadGarments(), reloadSales()]);
    } catch (err) {
      showToast("No se pudo registrar la venta. Revisa tu conexión.", "error");
    }
  }

  function handleEditGarment(g) {
    setEditingGarment(g);
    setTab("agregar");
  }

  const existingTypes = useMemo(() => {
    const set = new Set(TYPE_OPTIONS);
    garments.forEach((g) => { if (g.type) set.add(g.type); });
    return Array.from(set);
  }, [garments]);

  // Mientras no se sabe si hay sesión (primer chequeo de Supabase Auth), se
  // muestra una pantalla neutra en vez de parpadear al login o al inventario.
  if (session === undefined) {
    return (
      <div
        style={{
          minHeight: "100dvh", background: COLORS.bg, color: COLORS.inkSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', sans-serif", fontSize: 14,
        }}
      >
        <Loader2 size={18} className="animate-spin" style={{ marginRight: 8 }} /> Comprobando sesión…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: COLORS.bg,
          color: COLORS.inkSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
        }}
      >
        Cargando inventario…
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: "100dvh", background: COLORS.bg, fontFamily: "'Inter', sans-serif", color: COLORS.ink }}
      className="w-full flex flex-col items-center"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        input:focus, button:focus { outline: 2px solid ${COLORS.accent}; outline-offset: 1px; }
      `}</style>
      <div className="w-full max-w-md" style={{ minHeight: "100dvh", position: "relative" }}>
        <Header onSignOut={handleSignOut} />
        <main className="px-4 pt-4" style={{ paddingBottom: "104px" }}>
          {/* Los 4 paneles permanecen montados siempre; solo se oculta/muestra con CSS.
              Así ninguno pierde su estado (texto escrito, búsquedas, filtros) al cambiar de pestaña. */}
          <div style={{ display: tab === "agregar" ? "block" : "none" }}>
            <AddGarmentForm
              onSubmit={handleSaveGarment}
              editing={editingGarment}
              onCancelEdit={() => setEditingGarment(null)}
              typeOptions={existingTypes}
            />
          </div>
          <div style={{ display: tab === "inventario" ? "block" : "none" }}>
            <InventoryTab garments={garments} onEdit={handleEditGarment} onDelete={requestDeleteGarment} />
          </div>
          <div style={{ display: tab === "ventas" ? "block" : "none" }}>
            <SalesTab garments={garments} sales={sales} onAddSale={handleAddSale} onDeleteSale={requestDeleteSale} />
          </div>
          <div style={{ display: tab === "dashboard" ? "block" : "none" }}>
            <DashboardTab sales={sales} garments={garments} />
          </div>
        </main>
        <BottomNav tab={tab} setTab={(t) => { setEditingGarment(null); setTab(t); }} />
        {toast && <Toast message={toast.message} type={toast.type} />}
        {confirmDelete && (
          <ConfirmDialog info={confirmDelete} onCancel={() => setConfirmDelete(null)} onConfirm={handleConfirmDelete} />
        )}
      </div>
    </div>
  );
}

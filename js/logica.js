// =========================================================
//  Reglas del negocio: cobros, renovaciones, tiempo, planes
// =========================================================
import { db, guardar, ajustes } from "./datos.js";

// ---------- fechas ----------
export const hoyISO = () => new Date().toISOString().slice(0, 10);
export const periodoActual = () => hoyISO().slice(0, 7);
export const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export const nombrePeriodo = p => { const [y, m] = p.split("-").map(Number); return `${MESES[m - 1]} ${y}`; };
export const sumarMeses = (p, n) => { const [y, m] = p.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const diasHasta = f => f ? Math.round((new Date(f + "T12:00:00") - new Date(hoyISO() + "T12:00:00")) / 86400000) : null;
export const fechaCorta = f => { if (!f) return "—"; const [y, m, d] = f.slice(0, 10).split("-").map(Number); return `${d} ${MESES[m - 1].slice(0, 3)} ${y}`; };
export const sumarAnio = f => { const [y, m, d] = f.split("-"); return `${+y + 1}-${m}-${d}`; };

// ---------- dinero ----------
export const colones = n => "₡" + Math.round(+n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const dinero = (n, moneda = "CRC") => moneda === "USD" ? "$" + (+n || 0).toFixed(2).replace(/\.00$/, "") : colones(n);

// ---------- clientes ----------
export const cliente = id => db.clientes.find(c => c.id === id);
export const nombreCliente = id => cliente(id)?.nombre || "—";
export const activos = () => db.clientes.filter(c => c.estado === "activo");
export const mrr = () => activos().reduce((s, c) => s + (+c.plan?.mensualidad || 0), 0);

// ---------- cobros ----------
// Crea la mensualidad del período para cada cliente activo (no duplica)
export async function generarMensualidades(periodo = periodoActual()) {
  let n = 0;
  for (const c of activos()) {
    const monto = +c.plan?.mensualidad || 0;
    if (!monto) continue;
    if (c.plan?.inicio && c.plan.inicio.slice(0, 7) > periodo) continue;
    if (c.plan?.fin && c.plan.fin.slice(0, 7) < periodo) continue;
    if (db.cobros.some(x => x.clienteId === c.id && x.concepto === "mensualidad" && x.periodo === periodo && x.estado !== "anulado")) continue;
    const dia = String(Math.min(+c.plan?.diaPago || 5, 28)).padStart(2, "0");
    await guardar("cobros", { clienteId: c.id, concepto: "mensualidad", detalle: `Mensualidad ${nombrePeriodo(periodo)}`, periodo, monto, moneda: "CRC", vence: `${periodo}-${dia}`, estado: "pendiente" });
    n++;
  }
  return n;
}
export const estadoCobro = c => c.estado === "pagado" ? "pagado" : c.estado === "anulado" ? "anulado" : (diasHasta(c.vence) < 0 ? "vencido" : "pendiente");
export const pendientes = () => db.cobros.filter(c => ["pendiente", "vencido"].includes(estadoCobro(c))).sort((a, b) => (a.vence || "").localeCompare(b.vence || ""));
export const cobradoMes = (p = periodoActual()) => db.cobros.filter(c => c.estado === "pagado" && (c.pagadoFecha || "").startsWith(p) && (c.moneda || "CRC") === "CRC").reduce((s, c) => s + (+c.monto || 0), 0);
export const porCobrar = () => pendientes().filter(c => (c.moneda || "CRC") === "CRC").reduce((s, c) => s + (+c.monto || 0), 0);
export const vencidos = () => pendientes().filter(c => estadoCobro(c) === "vencido");

export function mensajeCobro(cb) {
  const c = cliente(cb.clienteId) || {};
  const a = ajustes();
  return `Hola ${c.contacto || c.nombre || ""}, le saluda ${a.firma || "José de ISCR Tech"}. ` +
    `Le recuerdo el pago de *${cb.detalle || cb.concepto}* por *${dinero(cb.monto, cb.moneda)}*` +
    (cb.vence ? `, con fecha límite ${fechaCorta(cb.vence)}` : "") + `.` +
    (a.sinpe ? ` Puede hacerlo por SINPE Móvil al ${a.sinpe}.` : "") + ` ¡Muchas gracias!`;
}
export const linkWhatsApp = (tel, msg) => `https://wa.me/506${String(tel || "").replace(/\D/g, "").slice(-8)}?text=${encodeURIComponent(msg)}`;

// ---------- renovaciones (dominios, hosting, etc.) ----------
export function estadoServicio(s) {
  const d = diasHasta(s.vence);
  if (d === null) return { clase: "gris", txt: "Sin fecha" };
  if (d < 0) return { clase: "rojo", txt: `Venció hace ${-d} d` };
  if (d <= 30) return { clase: "rojo", txt: `Vence en ${d} d` };
  if (d <= 60) return { clase: "ambar", txt: `Vence en ${d} d` };
  return { clase: "verde", txt: `En ${d} d` };
}
export const proximasRenovaciones = (dias = 90) => db.servicios.filter(s => s.vence && diasHasta(s.vence) <= dias).sort((a, b) => a.vence.localeCompare(b.vence));

// ---------- tickets y tiempo ----------
export const ESTADOS_TICKET = { abierto: "Abierto", progreso: "En progreso", esperando: "Esperando cliente", listo: "Listo", cerrado: "Cerrado" };
export const ticketAbierto = t => !["listo", "cerrado"].includes(t.estado);
export const minutosTicket = t => (t.tiempo || []).reduce((s, e) => s + (+e.minutos || 0), 0) + (t.timerInicio ? Math.round((Date.now() - new Date(t.timerInicio)) / 60000) : 0);
export const horas = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h ${m ? m + " min" : ""}`.trim() : `${m} min`; };
export const minutosMes = (p = periodoActual()) => db.tickets.reduce((s, t) => s + (t.tiempo || []).filter(e => (e.fin || e.inicio || "").startsWith(p)).reduce((a, e) => a + (+e.minutos || 0), 0), 0);
export const siguienteNumero = () => db.tickets.reduce((m, t) => Math.max(m, +t.numero || 0), 0) + 1;

export async function iniciarTimer(t) {
  for (const otro of db.tickets.filter(x => x.timerInicio && x.id !== t.id)) await detenerTimer(otro);
  return guardar("tickets", { ...t, timerInicio: new Date().toISOString(), estado: t.estado === "abierto" ? "progreso" : t.estado });
}
export async function detenerTimer(t, nota = "") {
  if (!t.timerInicio) return t;
  const fin = new Date(), min = Math.max(1, Math.round((fin - new Date(t.timerInicio)) / 60000));
  return guardar("tickets", { ...t, timerInicio: null, tiempo: [...(t.tiempo || []), { inicio: t.timerInicio, fin: fin.toISOString(), minutos: min, nota }] });
}
export const timerActivo = () => db.tickets.find(t => t.timerInicio);

// Cambios del plan usados en el mes (tickets "incluidos" creados en el período)
export function usoPlan(c, p = periodoActual()) {
  const usados = db.tickets.filter(t => t.clienteId === c.id && t.incluido !== false && t.tipo !== "error" && (t.creado || "").startsWith(p) && t.estado !== "cancelado").length;
  const limite = c.plan?.cambiosMes === "ilimitados" ? Infinity : (+c.plan?.cambiosMes || 0);
  return { usados, limite, excedido: usados > limite };
}

// ---------- mantenimiento mensual ----------
export const PLANTILLA_MANT = [
  "Revisar que el sitio cargue y el https esté activo",
  "Probar el carrito / pedido por WhatsApp",
  "Respaldo de la base de datos (exportar)",
  "Revisar uso de Firebase y tarjetas sospechosas",
  "Revisar fecha de vencimiento del dominio",
  "Enviar reporte mensual al cliente"
];
export async function generarMantenimientos(p = periodoActual()) {
  const plantilla = ajustes().plantillaMant?.length ? ajustes().plantillaMant : PLANTILLA_MANT;
  let n = 0;
  for (const c of activos()) {
    if (db.mantenimientos.some(m => m.clienteId === c.id && m.periodo === p)) continue;
    await guardar("mantenimientos", { clienteId: c.id, periodo: p, tareas: plantilla.map((txt, i) => ({ id: i + 1, texto: txt, hecho: false })) });
    n++;
  }
  return n;
}
export const progresoMant = m => { const t = m.tareas || []; return t.length ? Math.round(100 * t.filter(x => x.hecho).length / t.length) : 0; };

// =========================================================
//  ISCR Labs — app principal (vistas, formularios y acciones)
// =========================================================
import { FIREBASE } from "./config.js";
import { db, modo, cargarTodo, guardar, borrar, exportar, importar, ajustes, guardarAjustes, iniciarFirebase, firebase } from "./datos.js";
import * as L from "./logica.js";
import { ico } from "./iconos.js";

const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (m) => { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600); };
const opciones = (obj, sel) => Object.entries(obj).map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(t)}</option>`).join("");
const clientesOpc = () => Object.fromEntries([["", "— Elegir cliente —"], ...[...db.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => [c.id, c.nombre])]);

const ESTADO_CLIENTE = { activo: "Activo", prospecto: "Prospecto", pausado: "Pausado", baja: "De baja" };
const CHIP_CLIENTE = { activo: "verde", prospecto: "azul", pausado: "ambar", baja: "gris" };
const TIPO_TICKET = { cambio: "Cambio de contenido", error: "Error / falla", nuevo: "Función nueva", soporte: "Soporte / consulta" };
const PRIORIDAD = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" };
const CHIP_PRIO = { baja: "gris", media: "azul", alta: "ambar", urgente: "rojo" };
const CHIP_ESTADO = { abierto: "azul", progreso: "ambar", esperando: "gris", listo: "verde", cerrado: "gris" };
const ORIGEN = { whatsapp: "WhatsApp", llamada: "Llamada", correo: "Correo", interno: "Interno (mío)" };
const CONCEPTO = { mensualidad: "Mensualidad", arranque: "Arranque / instalación", dominio: "Dominio", hosting: "Hosting", extra: "Trabajo extra", otro: "Otro" };
const CHIP_COBRO = { pagado: "verde", pendiente: "azul", vencido: "rojo", anulado: "gris" };
const TIPO_SERV = { dominio: "Dominio", hosting: "Hosting", correo: "Correo", ssl: "Certificado SSL", app: "App / servicio", otro: "Otro" };
const ENTORNO = { produccion: "Producción", prueba: "Prueba / preview" };
const METODO = { sinpe: "SINPE Móvil", transferencia: "Transferencia", efectivo: "Efectivo", tarjeta: "Tarjeta" };

// =========================================================
//  FORMULARIOS (modal genérico)
// =========================================================
const get = (o, k) => !k ? undefined : k.split(".").reduce((a, p) => a?.[p], o);
const set = (o, k, v) => { const ps = k.split("."); let a = o; ps.slice(0, -1).forEach(p => a = a[p] ??= {}); a[ps.at(-1)] = v; };

function campoHTML(f, val) {
  if (f.tipo === "sep") return `<div class="sep">${esc(f.label)}</div>`;
  const id = "f_" + f.k.replace(/\./g, "_");
  const cls = f.full || f.tipo === "textarea" ? "full" : "";
  if (f.tipo === "check") return `<label class="chk ${cls}"><input type="checkbox" id="${id}" ${val ? "checked" : ""}> ${esc(f.label)}</label>`;
  let input;
  if (f.tipo === "select") input = `<select id="${id}">${opciones(f.opciones, val ?? f.def ?? "")}</select>`;
  else if (f.tipo === "textarea") input = `<textarea id="${id}" placeholder="${esc(f.ph || "")}">${esc(val ?? "")}</textarea>`;
  else input = `<input id="${id}" type="${f.tipo || "text"}" value="${esc(val ?? f.def ?? "")}" placeholder="${esc(f.ph || "")}" ${f.req ? "required" : ""} ${f.tipo === "number" ? 'step="any"' : ""}>`;
  return `<label class="${cls}">${esc(f.label)}${f.req ? " *" : ""}${input}${f.ayuda ? `<span class="muted" style="font-weight:400">${esc(f.ayuda)}</span>` : ""}</label>`;
}
function leerCampos(campos, base = {}) {
  const o = structuredClone(base);
  for (const f of campos) {
    if (f.tipo === "sep") continue;
    const el = $("f_" + f.k.replace(/\./g, "_"));
    let v = f.tipo === "check" ? el.checked : el.value.trim();
    if (f.tipo === "number" && v !== "") v = +v;
    set(o, f.k, v);
  }
  return o;
}
function abrirModal(html, { ancho = false } = {}) {
  $("modalCaja").className = "modal-caja" + (ancho ? " ancho" : "");
  $("modalCaja").innerHTML = html; $("modal").hidden = false;
  $("modalCaja").querySelector("input,select,textarea")?.focus();
}
const cerrarModal = () => { $("modal").hidden = true; $("modalCaja").innerHTML = ""; };
$("modal").addEventListener("mousedown", e => { if (e.target === $("modal")) cerrarModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("modal").hidden) cerrarModal(); });

function formulario({ titulo, campos, datos = {}, onGuardar, onBorrar, extra = "" }) {
  abrirModal(`
    <form id="frm">
      <div class="modal-cab"><h2>${esc(titulo)}</h2><button type="button" class="icono-btn" data-acc="cerrar">${ico("x")}</button></div>
      <div class="modal-cuerpo"><div class="form">${campos.map(f => campoHTML(f, get(datos, f.k))).join("")}</div>${extra}</div>
      <div class="modal-pie">
        ${onBorrar ? `<button type="button" class="btn sec izq" id="frmBorrar">${ico("trash-2")} Borrar</button>` : ""}
        <button type="button" class="btn sec" data-acc="cerrar">Cancelar</button>
        <button class="btn" type="submit">${ico("check")} Guardar</button>
      </div>
    </form>`);
  $("frm").onsubmit = async e => {
    e.preventDefault();
    const falta = campos.find(f => f.req && f.k && !$("f_" + f.k.replace(/\./g, "_")).value.trim());
    if (falta) return toast(`Falta: ${falta.label}`);
    await onGuardar(leerCampos(campos, datos)); cerrarModal(); render(); toast("Guardado");
  };
  if (onBorrar) $("frmBorrar").onclick = async () => { if (confirm("¿Borrar este registro? No se puede deshacer.")) { await onBorrar(); cerrarModal(); render(); toast("Borrado"); } };
}

// ---------- definiciones de formularios ----------
const F_CLIENTE = [
  { k: "nombre", label: "Nombre del negocio", req: true },
  { k: "estado", label: "Estado", tipo: "select", opciones: ESTADO_CLIENTE, def: "activo" },
  { k: "contacto", label: "Persona de contacto" },
  { k: "telefono", label: "Teléfono / WhatsApp", ph: "8888-8888" },
  { k: "correo", label: "Correo", tipo: "email" },
  { k: "razonSocial", label: "Razón social / cédula jurídica" },
  { k: "sitio", label: "Sitio web (producción)", ph: "https://…", full: true },
  { k: "repo", label: "Repositorio GitHub", ph: "usuario/repo" },
  { k: "prueba", label: "Sitio de prueba", ph: "https://…github.io/…" },
  { tipo: "sep", label: "Plan y contrato" },
  { k: "plan.nombre", label: "Plan", ph: "Ej. Premium ₡40.000" },
  { k: "plan.mensualidad", label: "Mensualidad (₡)", tipo: "number" },
  { k: "plan.cambiosMes", label: "Cambios incluidos por mes", ph: "4 o ilimitados", def: "4" },
  { k: "plan.diaPago", label: "Día de pago", tipo: "number", def: 5 },
  { k: "plan.inicio", label: "Inicio del contrato", tipo: "date" },
  { k: "plan.fin", label: "Fin del contrato", tipo: "date" },
  { k: "notas", label: "Notas", tipo: "textarea" }
];
const F_TICKET = [
  { k: "clienteId", label: "Cliente", tipo: "select", opciones: {}, req: true },
  { k: "titulo", label: "¿Qué hay que hacer?", req: true, full: true, ph: "Ej. Actualizar precios de res" },
  { k: "tipo", label: "Tipo", tipo: "select", opciones: TIPO_TICKET, def: "cambio" },
  { k: "prioridad", label: "Prioridad", tipo: "select", opciones: PRIORIDAD, def: "media" },
  { k: "estado", label: "Estado", tipo: "select", opciones: L.ESTADOS_TICKET, def: "abierto" },
  { k: "origen", label: "¿Cómo llegó?", tipo: "select", opciones: ORIGEN, def: "whatsapp" },
  { k: "limite", label: "Fecha límite", tipo: "date" },
  { k: "incluido", label: "Cuenta dentro de los cambios del plan", tipo: "check", def: true },
  { k: "descripcion", label: "Detalle", tipo: "textarea" }
];
const F_CAMBIO = [
  { k: "clienteId", label: "Cliente", tipo: "select", opciones: {}, req: true },
  { k: "fecha", label: "Fecha", tipo: "date", req: true },
  { k: "descripcion", label: "Qué se cambió", req: true, full: true },
  { k: "entorno", label: "Dónde", tipo: "select", opciones: ENTORNO, def: "produccion" },
  { k: "ticketId", label: "Ticket relacionado", tipo: "select", opciones: {} },
  { k: "commit", label: "Commit (hash o enlace)", ph: "a2c067d" },
  { k: "repo", label: "Repositorio", ph: "usuario/repo" },
  { k: "notas", label: "Notas", tipo: "textarea" }
];
const F_COBRO = [
  { k: "clienteId", label: "Cliente", tipo: "select", opciones: {}, req: true },
  { k: "concepto", label: "Concepto", tipo: "select", opciones: CONCEPTO, def: "mensualidad" },
  { k: "detalle", label: "Detalle", full: true, ph: "Ej. Mensualidad diciembre 2026" },
  { k: "monto", label: "Monto", tipo: "number", req: true },
  { k: "moneda", label: "Moneda", tipo: "select", opciones: { CRC: "Colones (₡)", USD: "Dólares ($)" }, def: "CRC" },
  { k: "vence", label: "Fecha límite", tipo: "date", req: true },
  { k: "periodo", label: "Mes que cubre", tipo: "month" },
  { k: "estado", label: "Estado", tipo: "select", opciones: { pendiente: "Pendiente", pagado: "Pagado", anulado: "Anulado" }, def: "pendiente" },
  { k: "pagadoFecha", label: "Fecha de pago", tipo: "date" },
  { k: "metodo", label: "Método", tipo: "select", opciones: { "": "—", ...METODO } },
  { k: "referencia", label: "Comprobante / referencia", full: true }
];
const F_SERVICIO = [
  { k: "clienteId", label: "Cliente", tipo: "select", opciones: {}, req: true },
  { k: "tipo", label: "Tipo", tipo: "select", opciones: TIPO_SERV, def: "dominio" },
  { k: "nombre", label: "Nombre", req: true, ph: "carnicerialacentral.com", full: true },
  { k: "proveedor", label: "Proveedor", ph: "Namecheap, NIC, Firebase…" },
  { k: "vence", label: "Vence / se renueva", tipo: "date" },
  { k: "costo", label: "Lo que me cuesta (por período)", tipo: "number" },
  { k: "moneda", label: "Moneda del costo", tipo: "select", opciones: { USD: "Dólares ($)", CRC: "Colones (₡)" }, def: "USD" },
  { k: "cobroCliente", label: "Lo que le cobro al cliente (₡)", tipo: "number", ayuda: "0 si va incluido en la mensualidad" },
  { k: "renovacionAuto", label: "Renovación automática activada", tipo: "check" },
  { k: "cuenta", label: "Cuenta donde está", ph: "iscrtech.apps@gmail.com" },
  { k: "notas", label: "Notas", tipo: "textarea" }
];

const conClientes = (campos, extraOpc) => campos.map(f => f.k === "clienteId" ? { ...f, opciones: clientesOpc() } : f.k === "ticketId" ? { ...f, opciones: extraOpc } : f);

function formCliente(c = { estado: "activo", plan: { cambiosMes: "4", diaPago: 5 } }) {
  formulario({ titulo: c.id ? `Editar ${c.nombre}` : "Nuevo cliente", campos: F_CLIENTE, datos: c,
    onGuardar: d => guardar("clientes", d), onBorrar: c.id ? () => borrar("clientes", c.id) : null });
}
function formTicket(t = {}) {
  const datos = { incluido: true, tipo: "cambio", prioridad: "media", estado: "abierto", origen: "whatsapp", ...t };
  formulario({ titulo: t.id ? `Ticket #${t.numero}` : "Nuevo ticket", campos: conClientes(F_TICKET), datos,
    onGuardar: async d => {
      if (!d.numero) d.numero = L.siguienteNumero();
      if (["listo", "cerrado"].includes(d.estado) && !d.cerradoFecha) d.cerradoFecha = new Date().toISOString();
      if (d.timerInicio && ["listo", "cerrado"].includes(d.estado)) d = await L.detenerTimer(d);
      await guardar("tickets", d);
    },
    onBorrar: t.id ? () => borrar("tickets", t.id) : null });
}
function formCambio(c = {}) {
  const tks = Object.fromEntries([["", "— Ninguno —"], ...db.tickets.filter(t => !c.clienteId || t.clienteId === c.clienteId).sort((a, b) => b.numero - a.numero).map(t => [t.id, `#${t.numero} · ${t.titulo}`])]);
  formulario({ titulo: c.id ? "Editar cambio" : "Registrar cambio", campos: conClientes(F_CAMBIO, tks),
    datos: { fecha: L.hoyISO(), entorno: "produccion", repo: L.cliente(c.clienteId)?.repo || "", ...c },
    onGuardar: d => guardar("cambios", d), onBorrar: c.id ? () => borrar("cambios", c.id) : null });
}
function formCobro(c = {}) {
  formulario({ titulo: c.id ? "Editar cobro" : "Nuevo cobro", campos: conClientes(F_COBRO),
    datos: { concepto: "extra", moneda: "CRC", estado: "pendiente", vence: L.hoyISO(), periodo: L.periodoActual(), ...c },
    onGuardar: d => { if (d.estado === "pagado" && !d.pagadoFecha) d.pagadoFecha = L.hoyISO(); return guardar("cobros", d); },
    onBorrar: c.id ? () => borrar("cobros", c.id) : null });
}
function formServicio(s = {}) {
  formulario({ titulo: s.id ? `Editar ${s.nombre}` : "Nuevo dominio / servicio", campos: conClientes(F_SERVICIO),
    datos: { tipo: "dominio", moneda: "USD", renovacionAuto: true, ...s },
    onGuardar: d => guardar("servicios", d), onBorrar: s.id ? () => borrar("servicios", s.id) : null });
}

// ---------- pagar / renovar ----------
function formPagar(cb) {
  abrirModal(`
    <form id="frmPago">
      <div class="modal-cab"><h2>Registrar pago</h2><button type="button" class="icono-btn" data-acc="cerrar">${ico("x")}</button></div>
      <div class="modal-cuerpo">
        <p style="margin-bottom:14px"><b>${esc(L.nombreCliente(cb.clienteId))}</b> · ${esc(cb.detalle || CONCEPTO[cb.concepto])} · <b>${L.dinero(cb.monto, cb.moneda)}</b></p>
        <div class="form">
          <label>Fecha de pago<input type="date" id="pFecha" value="${L.hoyISO()}"></label>
          <label>Método<select id="pMetodo">${opciones(METODO, "sinpe")}</select></label>
          <label class="full">Comprobante / referencia<input id="pRef" placeholder="N.° de SINPE o transferencia"></label>
        </div>
      </div>
      <div class="modal-pie"><button type="button" class="btn sec" data-acc="cerrar">Cancelar</button><button class="btn verde">${ico("check")} Marcar pagado</button></div>
    </form>`);
  $("frmPago").onsubmit = async e => {
    e.preventDefault();
    await guardar("cobros", { ...cb, estado: "pagado", pagadoFecha: $("pFecha").value, metodo: $("pMetodo").value, referencia: $("pRef").value.trim() });
    cerrarModal(); render(); toast("Pago registrado");
  };
}
async function renovarServicio(s) {
  if (!s.vence) return formServicio(s);
  const nueva = L.sumarAnio(s.vence);
  if (!confirm(`¿Marcar ${s.nombre} como renovado hasta el ${L.fechaCorta(nueva)}?`)) return;
  await guardar("servicios", { ...s, vence: nueva, historial: [...(s.historial || []), { fecha: L.hoyISO(), hasta: nueva, costo: s.costo, moneda: s.moneda }] });
  if (+s.cobroCliente > 0 && confirm(`¿Crear el cobro de ${L.colones(s.cobroCliente)} al cliente por esta renovación?`))
    await guardar("cobros", { clienteId: s.clienteId, concepto: s.tipo === "dominio" ? "dominio" : "hosting", detalle: `Renovación ${s.nombre} (hasta ${L.fechaCorta(nueva)})`, monto: +s.cobroCliente, moneda: "CRC", vence: L.hoyISO(), estado: "pendiente" });
  render(); toast("Renovación registrada");
}

// ---------- detalle de ticket (con tiempo) ----------
function verTicket(t) {
  const c = L.cliente(t.clienteId) || {};
  const cambios = db.cambios.filter(x => x.ticketId === t.id);
  abrirModal(`
    <div class="modal-cab"><h2>#${t.numero} · ${esc(t.titulo)}</h2><button class="icono-btn" data-acc="cerrar">${ico("x")}</button></div>
    <div class="modal-cuerpo">
      <div class="ficha" style="margin-bottom:16px">
        <div><small>Cliente</small><b>${esc(c.nombre || "—")}</b></div>
        <div><small>Estado</small><span class="chip ${CHIP_ESTADO[t.estado]}">${L.ESTADOS_TICKET[t.estado]}</span></div>
        <div><small>Prioridad</small><span class="chip ${CHIP_PRIO[t.prioridad]}">${PRIORIDAD[t.prioridad]}</span></div>
        <div><small>Tipo</small><b>${TIPO_TICKET[t.tipo] || "—"}</b> ${t.incluido === false ? '<span class="chip ambar">Extra</span>' : '<span class="chip gris">Del plan</span>'}</div>
        <div><small>Creado</small><b>${L.fechaCorta(t.creado)}</b> <span class="muted">por ${ORIGEN[t.origen] || "—"}</span></div>
        <div><small>Fecha límite</small><b>${L.fechaCorta(t.limite)}</b></div>
      </div>
      ${t.descripcion ? `<p style="white-space:pre-wrap;background:var(--fondo);padding:12px;border-radius:10px;margin-bottom:16px">${esc(t.descripcion)}</p>` : ""}
      <div class="panel"><div class="panel-cab"><h2>${ico("timer")} Tiempo: <span class="timer" id="tTotal">${L.horas(L.minutosTicket(t))}</span></h2>
        <div class="der">${t.timerInicio ? `<button class="btn rojo peq" data-acc="parar" data-id="${t.id}">${ico("square")} Detener</button>` : `<button class="btn verde peq" data-acc="iniciar" data-id="${t.id}">${ico("play")} Iniciar</button>`}
        <button class="btn sec peq" id="tMas">${ico("plus")} Agregar tiempo</button></div></div>
        ${(t.tiempo || []).length ? `<table><tr><th>Fecha</th><th>Duración</th><th>Nota</th></tr>${[...t.tiempo].reverse().map(e => `<tr><td>${L.fechaCorta(e.inicio || e.fin)}</td><td>${L.horas(e.minutos)}</td><td class="muted">${esc(e.nota || "")}</td></tr>`).join("")}</table>` : `<div class="vacio">Sin tiempo registrado.</div>`}
      </div>
      <div class="panel"><div class="panel-cab"><h2>${ico("git-commit-horizontal")} Cambios publicados</h2><div class="der"><button class="btn sec peq" id="tCambio">${ico("plus")} Registrar cambio</button></div></div>
        ${cambios.length ? cambios.map(x => `<div class="lista-item"><span class="chip ${x.entorno === "produccion" ? "verde" : "gris"}">${ENTORNO[x.entorno]}</span><div class="txt"><b>${esc(x.descripcion)}</b><span class="muted">${L.fechaCorta(x.fecha)} ${x.commit ? "· " + esc(x.commit) : ""}</span></div></div>`).join("") : `<div class="vacio">Todavía no hay cambios ligados a este ticket.</div>`}
      </div>
    </div>
    <div class="modal-pie">
      ${c.telefono ? `<a class="btn wa izq" target="_blank" rel="noopener" href="${L.linkWhatsApp(c.telefono, `Hola ${c.contacto || c.nombre}, ${t.estado === "listo" || t.estado === "cerrado" ? "ya quedó listo" : "estoy trabajando en"}: ${t.titulo}.`)}">${ico("message-circle")} Avisar al cliente</a>` : ""}
      <button class="btn sec" id="tEditar">${ico("pencil")} Editar</button>
      ${L.ticketAbierto(t) ? `<button class="btn verde" id="tListo">${ico("check")} Marcar listo</button>` : ""}
    </div>`, { ancho: true });
  $("tEditar").onclick = () => formTicket(t);
  $("tCambio").onclick = () => formCambio({ clienteId: t.clienteId, ticketId: t.id, descripcion: t.titulo });
  $("tMas").onclick = async () => {
    const m = prompt("¿Cuántos minutos agregar?", "30"); if (!m || isNaN(+m)) return;
    const nota = prompt("Nota (opcional)", "") || "";
    const ahora = new Date().toISOString();
    await guardar("tickets", { ...t, tiempo: [...(t.tiempo || []), { inicio: ahora, fin: ahora, minutos: +m, nota }] });
    verTicket(db.tickets.find(x => x.id === t.id)); render();
  };
  if ($("tListo")) $("tListo").onclick = async () => {
    let tk = t.timerInicio ? await L.detenerTimer(t) : t;
    await guardar("tickets", { ...tk, estado: "listo", cerradoFecha: new Date().toISOString() });
    cerrarModal(); render(); toast(`Ticket #${t.numero} listo`);
    if (!db.cambios.some(x => x.ticketId === t.id) && confirm("¿Registrar el cambio publicado para este ticket?")) formCambio({ clienteId: t.clienteId, ticketId: t.id, descripcion: t.titulo });
  };
}

// =========================================================
//  VISTAS
// =========================================================
const MENU = [
  ["", "Inicio", "layout-dashboard"], ["clientes", "Clientes", "users"], ["tickets", "Tickets", "ticket"],
  ["cobros", "Cobros", "wallet"], ["renovaciones", "Renovaciones", "calendar-clock"], ["cambios", "Historial de cambios", "git-commit-horizontal"],
  ["mantenimiento", "Mantenimiento", "wrench"], ["ajustes", "Ajustes", "settings"]
];
let ruta = [], filtros = { tEstado: "abiertos", tCliente: "", cPeriodo: L.periodoActual(), cCliente: "", mPeriodo: L.periodoActual(), xCliente: "", xEntorno: "" };

const vacio = (txt, acc, btn) => `<div class="vacio">${txt}${acc ? `<div style="margin-top:12px"><button class="btn" data-acc="${acc}">${ico("plus")} ${btn}</button></div>` : ""}</div>`;
const chipEstadoCobro = cb => { const e = L.estadoCobro(cb); return `<span class="chip ${CHIP_COBRO[e]}">${{ pagado: "Pagado", pendiente: "Pendiente", vencido: "Vencido", anulado: "Anulado" }[e]}</span>`; };
const filaTicket = t => `<tr class="click" data-ver-ticket="${t.id}">
  <td><b>#${t.numero}</b></td><td><b>${esc(t.titulo)}</b><div class="muted">${esc(L.nombreCliente(t.clienteId))}</div></td>
  <td class="ocultar-movil ocultar-compacta"><span class="chip ${CHIP_PRIO[t.prioridad]}">${PRIORIDAD[t.prioridad]}</span></td>
  <td><span class="chip ${CHIP_ESTADO[t.estado]}">${L.ESTADOS_TICKET[t.estado]}</span>${t.timerInicio ? ' <span class="chip rojo">● corriendo</span>' : ""}</td>
  <td class="ocultar-movil timer">${L.horas(L.minutosTicket(t))}</td>
  <td class="ocultar-movil ocultar-compacta muted">${L.fechaCorta(t.creado)}</td></tr>`;
const tablaTickets = (ts, compacta = false) => ts.length ? `<table class="${compacta ? "compacta" : ""}"><tr><th>#</th><th>Ticket</th><th class="ocultar-movil ocultar-compacta">Prioridad</th><th>Estado</th><th class="ocultar-movil">Tiempo</th><th class="ocultar-movil ocultar-compacta">Creado</th></tr>${ts.map(filaTicket).join("")}</table>` : "";
const filaCobro = cb => `<tr>
  <td><b>${esc(L.nombreCliente(cb.clienteId))}</b><div class="muted">${esc(cb.detalle || CONCEPTO[cb.concepto])}</div></td>
  <td class="der-txt"><b>${L.dinero(cb.monto, cb.moneda)}</b></td>
  <td class="ocultar-movil">${L.fechaCorta(cb.vence)}</td><td>${chipEstadoCobro(cb)}</td>
  <td class="der-txt" style="white-space:nowrap">${cb.estado !== "pagado" && cb.estado !== "anulado" ? `<button class="btn verde peq" data-acc="pagar" data-id="${cb.id}">${ico("check")} Pagó</button> ${L.cliente(cb.clienteId)?.telefono ? `<a class="btn wa peq" target="_blank" rel="noopener" href="${L.linkWhatsApp(L.cliente(cb.clienteId).telefono, L.mensajeCobro(cb))}" title="Recordar por WhatsApp">${ico("message-circle")}</a>` : ""}` : `<span class="muted">${L.fechaCorta(cb.pagadoFecha)} · ${METODO[cb.metodo] || ""}</span>`}
  <button class="icono-btn" data-acc="editar-cobro" data-id="${cb.id}">${ico("pencil")}</button></td></tr>`;
const tablaCobros = cs => `<table><tr><th>Cliente</th><th class="der-txt">Monto</th><th class="ocultar-movil">Vence</th><th>Estado</th><th></th></tr>${cs.map(filaCobro).join("")}</table>`;
const filaServicio = s => { const e = L.estadoServicio(s); return `<tr>
  <td><b>${esc(s.nombre)}</b><div class="muted">${TIPO_SERV[s.tipo] || ""} · ${esc(s.proveedor || "")}</div></td>
  <td class="ocultar-movil">${esc(L.nombreCliente(s.clienteId))}</td>
  <td>${L.fechaCorta(s.vence)}<div><span class="chip ${e.clase}">${e.txt}</span></div></td>
  <td class="ocultar-movil">${s.costo ? L.dinero(s.costo, s.moneda) : "—"}${+s.cobroCliente ? `<div class="muted">cobro ${L.colones(s.cobroCliente)}</div>` : ""}</td>
  <td class="ocultar-movil">${s.renovacionAuto ? '<span class="chip verde">Auto</span>' : '<span class="chip ambar">Manual</span>'}</td>
  <td class="der-txt" style="white-space:nowrap"><button class="btn sec peq" data-acc="renovar" data-id="${s.id}">${ico("repeat")} Renovado</button> <button class="icono-btn" data-acc="editar-servicio" data-id="${s.id}">${ico("pencil")}</button></td></tr>`; };
const tablaServicios = ss => `<table><tr><th>Servicio</th><th class="ocultar-movil">Cliente</th><th>Vence</th><th class="ocultar-movil">Costo</th><th class="ocultar-movil">Renovación</th><th></th></tr>${ss.map(filaServicio).join("")}</table>`;
const filaCambio = x => `<tr>
  <td style="white-space:nowrap">${L.fechaCorta(x.fecha)}</td>
  <td><b>${esc(x.descripcion)}</b><div class="muted">${esc(L.nombreCliente(x.clienteId))}${x.ticketId ? ` · ticket #${db.tickets.find(t => t.id === x.ticketId)?.numero ?? "?"}` : ""}</div></td>
  <td><span class="chip ${x.entorno === "produccion" ? "verde" : "gris"}">${ENTORNO[x.entorno] || "—"}</span></td>
  <td class="ocultar-movil">${x.commit ? (x.repo ? `<a href="https://github.com/${esc(x.repo)}/commit/${esc(x.commit)}" target="_blank" rel="noopener"><code>${esc(String(x.commit).slice(0, 7))}</code></a>` : `<code>${esc(String(x.commit).slice(0, 7))}</code>`) : "—"}</td>
  <td class="der-txt"><button class="icono-btn" data-acc="editar-cambio" data-id="${x.id}">${ico("pencil")}</button></td></tr>`;
const tablaCambios = xs => `<table><tr><th>Fecha</th><th>Cambio</th><th>Dónde</th><th class="ocultar-movil">Commit</th><th></th></tr>${xs.map(filaCambio).join("")}</table>`;

// ---------- INICIO ----------
function vInicio() {
  const abiertos = db.tickets.filter(L.ticketAbierto).sort((a, b) => ["urgente", "alta", "media", "baja"].indexOf(a.prioridad) - ["urgente", "alta", "media", "baja"].indexOf(b.prioridad) || a.numero - b.numero);
  const pend = L.pendientes(), venc = L.vencidos(), renov = L.proximasRenovaciones(60);
  const mants = db.mantenimientos.filter(m => m.periodo === L.periodoActual());
  const cambios = [...db.cambios].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 6);
  if (!db.clientes.length) return `<div class="panel"><div class="panel-cuerpo" style="text-align:center;padding:40px">
    <h2 style="font-size:1.4rem;margin-bottom:8px">Bienvenido a ISCR Labs</h2>
    <p class="muted" style="margin-bottom:18px">Aquí vas a llevar clientes, tickets, tiempo, cambios publicados, cobros y renovaciones.</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <button class="btn" style="white-space:normal" data-acc="sembrar">${ico("rocket")} Cargar Carnicería La Central como primer cliente</button>
    <button class="btn sec" data-acc="nuevo-cliente">${ico("plus")} Empezar en blanco</button></div></div></div>`;
  return `
  <div class="kpis">
    <div class="kpi"><small>${ico("repeat")} Ingreso mensual recurrente</small><b>${L.colones(L.mrr())}</b><span>${L.activos().length} cliente(s) activo(s)</span></div>
    <div class="kpi"><small>${ico("wallet")} Cobrado en ${L.MESES[new Date().getMonth()]}</small><b>${L.colones(L.cobradoMes())}</b><span>por cobrar ${L.colones(L.porCobrar())}</span></div>
    <div class="kpi ${venc.length ? "alerta" : ""}"><small>${ico("alert-triangle")} Cobros vencidos</small><b>${venc.length}</b><span>${L.colones(venc.reduce((s, c) => s + (+c.monto || 0), 0))}</span></div>
    <div class="kpi"><small>${ico("ticket")} Tickets abiertos</small><b>${abiertos.length}</b><span>${abiertos.filter(t => ["alta", "urgente"].includes(t.prioridad)).length} con prioridad alta</span></div>
    <div class="kpi"><small>${ico("clock")} Horas este mes</small><b>${L.horas(L.minutosMes())}</b><span>en tickets</span></div>
  </div>
  <div class="grid3">
    <div>
      <div class="panel"><div class="panel-cab"><h2>${ico("wallet")} Por cobrar</h2><div class="der"><a class="btn sec peq" href="#/cobros">Ver todo ${ico("chevron-right")}</a></div></div>
        ${pend.length ? tablaCobros(pend.slice(0, 8)) : vacio("No hay cobros pendientes.", "generar-mensualidades", "Generar mensualidades del mes")}</div>
      <div class="panel"><div class="panel-cab"><h2>${ico("ticket")} Tickets abiertos</h2><div class="der"><a class="btn sec peq" href="#/tickets">Ver todo ${ico("chevron-right")}</a></div></div>
        ${abiertos.length ? tablaTickets(abiertos.slice(0, 8), true) : vacio("No hay tickets abiertos.", "nuevo-ticket", "Nuevo ticket")}</div>
    </div>
    <div>
      <div class="panel"><div class="panel-cab"><h2>${ico("calendar-clock")} Renovaciones (60 días)</h2></div>
        ${renov.length ? renov.map(s => { const e = L.estadoServicio(s); return `<div class="lista-item"><span class="chip ${e.clase}">${e.txt}</span><div class="txt"><b>${esc(s.nombre)}</b><span class="muted">${esc(L.nombreCliente(s.clienteId))} · ${esc(s.proveedor || "")}</span></div></div>`; }).join("") : vacio("Nada vence en los próximos 60 días.")}</div>
      <div class="panel"><div class="panel-cab"><h2>${ico("wrench")} Mantenimiento de ${L.MESES[new Date().getMonth()]}</h2><div class="der"><a class="btn sec peq" href="#/mantenimiento">Abrir</a></div></div>
        ${mants.length ? mants.map(m => `<div class="lista-item"><div class="txt"><b>${esc(L.nombreCliente(m.clienteId))}</b></div><div class="barra-prog" style="width:110px"><i style="width:${L.progresoMant(m)}%"></i></div><span class="muted">${L.progresoMant(m)}%</span></div>`).join("") : vacio("Sin lista de este mes.", "generar-mant", "Generar listas")}</div>
      <div class="panel"><div class="panel-cab"><h2>${ico("git-commit-horizontal")} Últimos cambios</h2></div>
        ${cambios.length ? cambios.map(x => `<div class="lista-item"><div class="txt"><b>${esc(x.descripcion)}</b><span class="muted">${L.fechaCorta(x.fecha)} · ${esc(L.nombreCliente(x.clienteId))}</span></div></div>`).join("") : vacio("Sin cambios registrados.")}</div>
    </div>
  </div>`;
}

// ---------- CLIENTES ----------
function vClientes() {
  const cs = [...db.clientes].sort((a, b) => (a.estado === "activo" ? 0 : 1) - (b.estado === "activo" ? 0 : 1) || a.nombre.localeCompare(b.nombre));
  return `<div class="filtros"><button class="btn" data-acc="nuevo-cliente">${ico("plus")} Nuevo cliente</button></div>
  <div class="panel">${cs.length ? `<table><tr><th>Cliente</th><th>Estado</th><th class="der-txt">Mensualidad</th><th class="ocultar-movil">Cambios del mes</th><th class="ocultar-movil">Tickets abiertos</th><th class="ocultar-movil">Por cobrar</th></tr>
    ${cs.map(c => { const u = L.usoPlan(c); const deuda = L.pendientes().filter(x => x.clienteId === c.id); return `<tr class="click" data-ir="#/clientes/${c.id}">
      <td><b>${esc(c.nombre)}</b><div class="muted">${esc(c.contacto || c.telefono || "")}</div></td>
      <td><span class="chip ${CHIP_CLIENTE[c.estado]}">${ESTADO_CLIENTE[c.estado]}</span></td>
      <td class="der-txt">${+c.plan?.mensualidad ? L.colones(c.plan.mensualidad) : '<span class="muted">Por definir</span>'}</td>
      <td class="ocultar-movil">${u.limite === Infinity ? `${u.usados} / ilimitados` : `<span class="${u.excedido ? "chip rojo" : ""}">${u.usados} / ${u.limite}</span>`}</td>
      <td class="ocultar-movil">${db.tickets.filter(t => t.clienteId === c.id && L.ticketAbierto(t)).length}</td>
      <td class="ocultar-movil">${deuda.length ? `<span class="chip ${deuda.some(x => L.estadoCobro(x) === "vencido") ? "rojo" : "azul"}">${L.colones(deuda.reduce((s, x) => s + (+x.monto || 0), 0))}</span>` : "—"}</td></tr>`; }).join("")}</table>` : vacio("Todavía no hay clientes.", "nuevo-cliente", "Nuevo cliente")}</div>`;
}
function vCliente(id) {
  const c = L.cliente(id); if (!c) return vacio("Cliente no encontrado.");
  const u = L.usoPlan(c);
  const tks = db.tickets.filter(t => t.clienteId === id).sort((a, b) => b.numero - a.numero);
  const servs = db.servicios.filter(s => s.clienteId === id);
  const cobros = db.cobros.filter(x => x.clienteId === id).sort((a, b) => (b.vence || "").localeCompare(a.vence || ""));
  const cambios = db.cambios.filter(x => x.clienteId === id).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const minTot = tks.reduce((s, t) => s + L.minutosTicket(t), 0);
  const link = (u, txt) => u ? `<a href="${esc(u.startsWith("http") ? u : "https://" + u)}" target="_blank" rel="noopener">${esc(txt || u)} ${ico("external-link")}</a>` : "—";
  return `
  <div class="filtros"><a class="btn sec" href="#/clientes">← Clientes</a>
    <button class="btn sec" data-acc="editar-cliente" data-id="${c.id}">${ico("pencil")} Editar</button>
    <button class="btn" data-acc="nuevo-ticket" data-cliente="${c.id}">${ico("plus")} Ticket</button>
    <button class="btn sec" data-acc="nuevo-cambio" data-cliente="${c.id}">${ico("git-commit-horizontal")} Cambio</button>
    <button class="btn sec" data-acc="nuevo-cobro" data-cliente="${c.id}">${ico("wallet")} Cobro</button>
    <button class="btn sec" data-acc="nuevo-servicio" data-cliente="${c.id}">${ico("globe")} Dominio / servicio</button>
    ${c.telefono ? `<a class="btn wa" target="_blank" rel="noopener" href="${L.linkWhatsApp(c.telefono, `Hola ${c.contacto || ""}`)}">${ico("message-circle")} WhatsApp</a>` : ""}</div>
  <div class="panel"><div class="panel-cab"><h2>${esc(c.nombre)}</h2><span class="chip ${CHIP_CLIENTE[c.estado]}">${ESTADO_CLIENTE[c.estado]}</span></div>
    <div class="panel-cuerpo"><div class="ficha">
      <div><small>Contacto</small><b>${esc(c.contacto || "—")}</b></div><div><small>Teléfono</small><b>${esc(c.telefono || "—")}</b></div>
      <div><small>Correo</small><b>${esc(c.correo || "—")}</b></div><div><small>Razón social</small><b>${esc(c.razonSocial || "—")}</b></div>
      <div><small>Sitio</small><b>${link(c.sitio)}</b></div><div><small>Prueba</small><b>${link(c.prueba, "ver")}</b></div>
      <div><small>Repositorio</small><b>${c.repo ? link("https://github.com/" + c.repo, c.repo) : "—"}</b></div>
      <div><small>Plan</small><b>${esc(c.plan?.nombre || "—")}</b></div>
      <div><small>Mensualidad</small><b>${+c.plan?.mensualidad ? L.colones(c.plan.mensualidad) : "Por definir"}</b> <span class="muted">día ${c.plan?.diaPago || "—"}</span></div>
      <div><small>Contrato</small><b>${L.fechaCorta(c.plan?.inicio)} → ${L.fechaCorta(c.plan?.fin)}</b></div>
      <div><small>Cambios este mes</small><b>${u.usados} / ${u.limite === Infinity ? "ilimitados" : u.limite}</b> ${u.excedido ? '<span class="chip rojo">Excedido: cobrar extra</span>' : ""}</div>
      <div><small>Tiempo total</small><b>${L.horas(minTot)}</b></div>
    </div>${c.notas ? `<p class="muted" style="margin-top:14px;white-space:pre-wrap">${esc(c.notas)}</p>` : ""}</div></div>
  <div class="grid2">
    <div class="panel"><div class="panel-cab"><h2>${ico("ticket")} Tickets</h2></div>${tks.length ? tablaTickets(tks, true) : vacio("Sin tickets.")}</div>
    <div class="panel"><div class="panel-cab"><h2>${ico("wallet")} Cobros</h2></div>${cobros.length ? tablaCobros(cobros) : vacio("Sin cobros.")}</div>
  </div>
  <div class="panel"><div class="panel-cab"><h2>${ico("calendar-clock")} Dominios y servicios</h2></div>${servs.length ? tablaServicios(servs) : vacio("Sin dominios ni servicios.", "nuevo-servicio", "Agregar")}</div>
  <div class="panel"><div class="panel-cab"><h2>${ico("git-commit-horizontal")} Historial de cambios</h2></div>${cambios.length ? tablaCambios(cambios) : vacio("Sin cambios registrados.")}</div>`;
}

// ---------- TICKETS ----------
function vTickets() {
  let ts = [...db.tickets];
  if (filtros.tEstado === "abiertos") ts = ts.filter(L.ticketAbierto); else if (filtros.tEstado !== "todos") ts = ts.filter(t => t.estado === filtros.tEstado);
  if (filtros.tCliente) ts = ts.filter(t => t.clienteId === filtros.tCliente);
  ts.sort((a, b) => b.numero - a.numero);
  return `<div class="filtros">
    <button class="btn" data-acc="nuevo-ticket">${ico("plus")} Nuevo ticket</button>
    <select data-filtro="tEstado">${opciones({ abiertos: "Abiertos", todos: "Todos", ...L.ESTADOS_TICKET }, filtros.tEstado)}</select>
    <select data-filtro="tCliente">${opciones({ "": "Todos los clientes", ...Object.fromEntries(db.clientes.map(c => [c.id, c.nombre])) }, filtros.tCliente)}</select>
    <span class="muted">${ts.length} ticket(s)</span></div>
  <div class="panel">${ts.length ? tablaTickets(ts) : vacio("No hay tickets con ese filtro.", "nuevo-ticket", "Nuevo ticket")}</div>`;
}

// ---------- COBROS ----------
function vCobros() {
  const p = filtros.cPeriodo;
  let cs = db.cobros.filter(x => (x.periodo || (x.vence || "").slice(0, 7)) === p || (L.estadoCobro(x) === "vencido" && p === L.periodoActual()));
  if (filtros.cCliente) cs = cs.filter(x => x.clienteId === filtros.cCliente);
  cs.sort((a, b) => (a.vence || "").localeCompare(b.vence || ""));
  const total = cs.filter(x => x.estado !== "anulado" && (x.moneda || "CRC") === "CRC").reduce((s, x) => s + (+x.monto || 0), 0);
  const pagado = cs.filter(x => x.estado === "pagado" && (x.moneda || "CRC") === "CRC").reduce((s, x) => s + (+x.monto || 0), 0);
  return `<div class="filtros">
    <button class="btn" data-acc="nuevo-cobro">${ico("plus")} Nuevo cobro</button>
    <button class="btn sec" data-acc="generar-mensualidades">${ico("refresh-cw")} Generar mensualidades de ${L.nombrePeriodo(p)}</button>
    <div class="seg"><button data-acc="mes" data-d="-1">‹</button><button class="act" style="min-width:150px">${L.nombrePeriodo(p)}</button><button data-acc="mes" data-d="1">›</button></div>
    <select data-filtro="cCliente">${opciones({ "": "Todos los clientes", ...Object.fromEntries(db.clientes.map(c => [c.id, c.nombre])) }, filtros.cCliente)}</select></div>
  <div class="kpis"><div class="kpi"><small>Total del mes</small><b>${L.colones(total)}</b></div><div class="kpi"><small>Cobrado</small><b>${L.colones(pagado)}</b></div><div class="kpi ${total - pagado > 0 ? "alerta" : ""}"><small>Falta</small><b>${L.colones(total - pagado)}</b></div></div>
  <div class="panel">${cs.length ? tablaCobros(cs) : vacio(`No hay cobros en ${L.nombrePeriodo(p)}.`, "generar-mensualidades", "Generar mensualidades")}</div>`;
}

// ---------- RENOVACIONES ----------
function vRenovaciones() {
  const ss = [...db.servicios].sort((a, b) => (a.vence || "9999").localeCompare(b.vence || "9999"));
  const costoAnualUSD = ss.filter(s => s.moneda === "USD").reduce((t, s) => t + (+s.costo || 0), 0);
  return `<div class="filtros"><button class="btn" data-acc="nuevo-servicio">${ico("plus")} Dominio / servicio</button>
    <span class="muted">Costo anual de servicios en dólares: <b>$${costoAnualUSD.toFixed(2)}</b></span></div>
  <div class="panel">${ss.length ? tablaServicios(ss) : vacio("Agregá los dominios y hostings de tus clientes para que ISCR Labs te avise antes de que venzan.", "nuevo-servicio", "Agregar dominio")}</div>`;
}

// ---------- CAMBIOS ----------
function vCambios() {
  let xs = [...db.cambios];
  if (filtros.xCliente) xs = xs.filter(x => x.clienteId === filtros.xCliente);
  if (filtros.xEntorno) xs = xs.filter(x => x.entorno === filtros.xEntorno);
  xs.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || (b.creado || "").localeCompare(a.creado || ""));
  return `<div class="filtros"><button class="btn" data-acc="nuevo-cambio">${ico("plus")} Registrar cambio</button>
    <select data-filtro="xCliente">${opciones({ "": "Todos los clientes", ...Object.fromEntries(db.clientes.map(c => [c.id, c.nombre])) }, filtros.xCliente)}</select>
    <select data-filtro="xEntorno">${opciones({ "": "Producción y prueba", ...ENTORNO }, filtros.xEntorno)}</select>
    <span class="muted">${xs.length} cambio(s)</span></div>
  <div class="panel">${xs.length ? tablaCambios(xs) : vacio("Sin cambios registrados.", "nuevo-cambio", "Registrar cambio")}</div>`;
}

// ---------- MANTENIMIENTO ----------
function vMantenimiento() {
  const p = filtros.mPeriodo;
  const ms = db.mantenimientos.filter(m => m.periodo === p);
  return `<div class="filtros">
    <button class="btn" data-acc="generar-mant">${ico("refresh-cw")} Generar listas de ${L.nombrePeriodo(p)}</button>
    <div class="seg"><button data-acc="mmes" data-d="-1">‹</button><button class="act" style="min-width:150px">${L.nombrePeriodo(p)}</button><button data-acc="mmes" data-d="1">›</button></div>
    <span class="muted">La lista base se cambia en Ajustes.</span></div>
  <div class="grid2">${ms.length ? ms.map(m => `<div class="panel"><div class="panel-cab"><h2>${esc(L.nombreCliente(m.clienteId))}</h2><div class="der"><div class="barra-prog" style="width:90px"><i style="width:${L.progresoMant(m)}%"></i></div><span class="muted">${L.progresoMant(m)}%</span></div></div>
    <div class="panel-cuerpo">${m.tareas.map(t => `<label class="check ${t.hecho ? "hecho" : ""}"><input type="checkbox" data-tarea="${m.id}:${t.id}" ${t.hecho ? "checked" : ""}><span>${esc(t.texto)}</span></label>`).join("")}</div></div>`).join("") : `<div class="panel">${vacio(`Sin listas para ${L.nombrePeriodo(p)}.`, "generar-mant", "Generar listas")}</div>`}</div>`;
}

// ---------- AJUSTES ----------
function vAjustes() {
  const a = ajustes();
  return `<div class="grid2">
  <div class="panel"><div class="panel-cab"><h2>${ico("settings")} Datos para mensajes</h2></div><div class="panel-cuerpo">
    <form class="form" id="frmAjustes">
      <label>Firma en recordatorios<input id="aFirma" value="${esc(a.firma || "José de ISCR Tech")}"></label>
      <label>SINPE Móvil para cobros<input id="aSinpe" value="${esc(a.sinpe || "")}" placeholder="8690-1930"></label>
      <label>Tarifa por hora extra (₡)<input id="aTarifa" type="number" value="${esc(a.tarifaHora || "")}"></label>
      <label class="full">Lista base de mantenimiento mensual (una tarea por línea)<textarea id="aMant" style="min-height:150px">${esc((a.plantillaMant?.length ? a.plantillaMant : L.PLANTILLA_MANT).join("\n"))}</textarea></label>
      <div class="full"><button class="btn">${ico("check")} Guardar ajustes</button></div>
    </form></div></div>
  <div class="panel"><div class="panel-cab"><h2>${ico("shield-check")} Datos y respaldo</h2></div><div class="panel-cuerpo" style="display:grid;gap:12px">
    <p>Modo actual: <b>${modo === "local" ? "Local (solo este navegador)" : "Firebase (en la nube)"}</b></p>
    <p class="muted">Registros: ${db.clientes.length} clientes · ${db.tickets.length} tickets · ${db.cambios.length} cambios · ${db.cobros.length} cobros · ${db.servicios.length} servicios</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" data-acc="exportar">${ico("download")} Descargar respaldo (JSON)</button>
      <label class="btn sec" style="cursor:pointer">${ico("upload")} Importar respaldo<input type="file" id="aImportar" accept="application/json" hidden></label>
    </div>
    <p class="muted">Descargá un respaldo una vez al mes. Con el respaldo podés pasar los datos del modo local a Firebase cuando lo actives.</p>
  </div></div></div>`;
}

// =========================================================
//  RENDER Y RUTAS
// =========================================================
function render() {
  ruta = (location.hash.replace(/^#\/?/, "") || "").split("/");
  const sec = ruta[0] || "";
  const abiertos = db.tickets.filter(L.ticketAbierto).length, venc = L.vencidos().length;
  $("menu").innerHTML = MENU.map(([r, t, i]) => `<a href="#/${r}" class="${sec === r ? "act" : ""}">${ico(i)} ${t}${r === "tickets" && abiertos ? `<span class="num" style="background:var(--azul)">${abiertos}</span>` : ""}${r === "cobros" && venc ? `<span class="num">${venc}</span>` : ""}</a>`).join("");
  const titulos = Object.fromEntries(MENU.map(([r, t]) => [r, t]));
  $("titulo").textContent = sec === "clientes" && ruta[1] ? (L.cliente(ruta[1])?.nombre || "Cliente") : titulos[sec] || "Inicio";
  const vistas = { "": vInicio, clientes: () => ruta[1] ? vCliente(ruta[1]) : vClientes(), tickets: vTickets, cobros: vCobros, renovaciones: vRenovaciones, cambios: vCambios, mantenimiento: vMantenimiento, ajustes: vAjustes };
  $("vista").innerHTML = (vistas[sec] || vInicio)();
  $("lateral").classList.remove("abierto");
  pintarTimer();
  if (sec === "ajustes") enlazarAjustes();
}
window.addEventListener("hashchange", () => { cerrarModal(); render(); window.scrollTo(0, 0); });

function pintarTimer() {
  const t = L.timerActivo(), g = $("timerGlobal");
  if (!t) { g.hidden = true; return; }
  g.hidden = false;
  const seg = Math.floor((Date.now() - new Date(t.timerInicio)) / 1000);
  g.innerHTML = `<span class="punto"></span><span>#${t.numero}</span><span class="timer">${String(Math.floor(seg / 3600)).padStart(2, "0")}:${String(Math.floor(seg / 60) % 60).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}</span><button class="btn rojo peq" data-acc="parar" data-id="${t.id}">${ico("square")}</button>`;
}
setInterval(() => {
  const t = L.timerActivo(); if (!t) return;
  pintarTimer();
  const tot = $("tTotal"); if (tot && !$("modal").hidden && $("modalCaja").querySelector(`[data-id="${t.id}"]`)) tot.textContent = L.horas(L.minutosTicket(t));
}, 1000);

function enlazarAjustes() {
  $("frmAjustes").onsubmit = async e => {
    e.preventDefault();
    await guardarAjustes({ firma: $("aFirma").value.trim(), sinpe: $("aSinpe").value.trim(), tarifaHora: +$("aTarifa").value || "", plantillaMant: $("aMant").value.split("\n").map(s => s.trim()).filter(Boolean) });
    toast("Ajustes guardados");
  };
  $("aImportar").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const reemplazar = confirm("¿Reemplazar todos los datos actuales por el respaldo? (Cancelar = combinar)");
    try { await importar(await f.text(), { reemplazar }); render(); toast("Respaldo importado"); } catch (err) { alert("No se pudo importar: " + err.message); }
  };
}

// ---------- acciones (delegadas) ----------
const ACCIONES = {
  "cerrar": () => cerrarModal(),
  "nuevo-cliente": () => formCliente(),
  "editar-cliente": b => formCliente(L.cliente(b.dataset.id)),
  "nuevo-ticket": b => formTicket({ clienteId: b.dataset.cliente || (ruta[0] === "clientes" ? ruta[1] : "") || "" }),
  "nuevo-cambio": b => formCambio({ clienteId: b.dataset.cliente || "" }),
  "editar-cambio": b => formCambio(db.cambios.find(x => x.id === b.dataset.id)),
  "nuevo-cobro": b => formCobro({ clienteId: b.dataset.cliente || "" }),
  "editar-cobro": b => formCobro(db.cobros.find(x => x.id === b.dataset.id)),
  "pagar": b => formPagar(db.cobros.find(x => x.id === b.dataset.id)),
  "nuevo-servicio": b => formServicio({ clienteId: b.dataset.cliente || (ruta[0] === "clientes" ? ruta[1] : "") || "" }),
  "editar-servicio": b => formServicio(db.servicios.find(x => x.id === b.dataset.id)),
  "renovar": b => renovarServicio(db.servicios.find(x => x.id === b.dataset.id)),
  "iniciar": async b => { const t = await L.iniciarTimer(db.tickets.find(x => x.id === b.dataset.id)); render(); if (!$("modal").hidden) verTicket(t); toast(`Tiempo corriendo en #${t.numero}`); },
  "parar": async b => { const t = await L.detenerTimer(db.tickets.find(x => x.id === b.dataset.id)); render(); if (!$("modal").hidden) verTicket(t); toast(`Tiempo guardado en #${t.numero}`); },
  "generar-mensualidades": async () => { const n = await L.generarMensualidades(filtros.cPeriodo); render(); toast(n ? `${n} mensualidad(es) creada(s)` : "Ya estaban todas creadas (o falta definir montos)"); },
  "generar-mant": async () => { const n = await L.generarMantenimientos(filtros.mPeriodo); render(); toast(n ? `${n} lista(s) creada(s)` : "Ya estaban creadas"); },
  "mes": b => { filtros.cPeriodo = L.sumarMeses(filtros.cPeriodo, +b.dataset.d); render(); },
  "mmes": b => { filtros.mPeriodo = L.sumarMeses(filtros.mPeriodo, +b.dataset.d); render(); },
  "exportar": () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportar()], { type: "application/json" })); a.download = `iscr-labs-respaldo-${L.hoyISO()}.json`; a.click(); },
  "sembrar": async () => { const { sembrar } = await import("./semilla.js"); await sembrar(); await L.generarMantenimientos(); render(); toast("Carnicería La Central cargada"); },
  "salir": async () => { if (firebase()) { await firebase().A.signOut(firebase().auth); location.reload(); } }
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-acc]");
  if (b) { e.preventDefault(); ACCIONES[b.dataset.acc]?.(b); return; }
  const vt = e.target.closest("[data-ver-ticket]");
  if (vt) return verTicket(db.tickets.find(t => t.id === vt.dataset.verTicket));
  const ir = e.target.closest("[data-ir]");
  if (ir && !e.target.closest("a,button")) location.hash = ir.dataset.ir;
});
document.addEventListener("change", async e => {
  const f = e.target.closest("[data-filtro]");
  if (f) { filtros[f.dataset.filtro] = f.value; render(); return; }
  const t = e.target.closest("[data-tarea]");
  if (t) {
    const [mid, tid] = t.dataset.tarea.split(":"); const m = db.mantenimientos.find(x => x.id === mid);
    await guardar("mantenimientos", { ...m, tareas: m.tareas.map(x => String(x.id) === tid ? { ...x, hecho: t.checked, fecha: t.checked ? L.hoyISO() : null } : x) });
    render();
  }
});
$("abrirMenu").onclick = () => $("lateral").classList.toggle("abierto");

// =========================================================
//  ARRANQUE
// =========================================================
async function entrar() {
  await cargarTodo();
  // automático al abrir: mensualidades y listas de mantenimiento del mes en curso
  await L.generarMensualidades(); await L.generarMantenimientos();
  $("login").hidden = true; $("app").hidden = false;
  $("btnNuevoTicket").innerHTML = `${ico("plus")}<span class="txt"> Ticket</span>`;
  $("lateralPie").innerHTML = modo === "firebase"
    ? `<span>${esc(firebase().auth.currentUser?.email || "")}</span><button data-acc="salir">${ico("log-out")} Salir</button>`
    : `<span>Modo local · datos en este navegador</span>`;
  if (modo === "local") { $("bandaLocal").hidden = false; $("bandaLocal").innerHTML = `${ico("alert-triangle")} <b>Modo local:</b> los datos se guardan solo en este navegador. Para usarlo en serio, conectá Firebase (ver README) y pasá los datos con un respaldo.`; }
  render();
}

if (modo === "local") entrar();
else {
  const fb = await iniciarFirebase();
  fb.A.onAuthStateChanged(fb.auth, async u => {
    if (u) { try { await entrar(); } catch (e) { $("app").hidden = true; $("login").hidden = false; $("lMsg").textContent = "Tu usuario no tiene acceso (falta en 'admins')."; console.error(e); } }
    else { $("app").hidden = true; $("login").hidden = false; }
  });
  $("loginForm").onsubmit = async e => {
    e.preventDefault(); $("lMsg").textContent = "";
    try { await fb.A.signInWithEmailAndPassword(fb.auth, $("lCorreo").value.trim(), $("lClave").value); }
    catch { $("lMsg").textContent = "Correo o contraseña incorrectos."; }
  };
}

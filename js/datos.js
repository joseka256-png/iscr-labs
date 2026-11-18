// =========================================================
//  Capa de datos: todo se carga en memoria al entrar y cada
//  cambio se guarda en el respaldo elegido:
//   · MODO LOCAL  → localStorage (solo este navegador)
//   · FIREBASE    → Firestore (con login)
// =========================================================
import { FIREBASE } from "./config.js?v=3";

export const COLECCIONES = ["clientes", "servicios", "tickets", "cambios", "cobros", "gastos", "mantenimientos", "ajustes"];
export const db = Object.fromEntries(COLECCIONES.map(c => [c, []]));
export const modo = FIREBASE ? "firebase" : "local";

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ahora = () => new Date().toISOString();

let fb = null; // { fs, auth, mods }

// ---------- MODO LOCAL ----------
const LKEY = c => `iscrlabs:${c}`;
const local = {
  async cargar() { for (const c of COLECCIONES) { try { db[c] = JSON.parse(localStorage.getItem(LKEY(c)) || "[]"); } catch { db[c] = []; } } },
  async guardar(c) { localStorage.setItem(LKEY(c), JSON.stringify(db[c])); },
  async borrar(c) { localStorage.setItem(LKEY(c), JSON.stringify(db[c])); }
};

// ---------- FIREBASE ----------
const V = "10.12.2";
export async function iniciarFirebase() {
  const app = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const auth = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const a = app.initializeApp(FIREBASE);
  fb = { app: a, auth: auth.getAuth(a), fs: fs.getFirestore(a), A: auth, F: fs };
  return fb;
}
export const firebase = () => fb;

const remoto = {
  async cargar() {
    const { F, fs } = fb;
    await Promise.all(COLECCIONES.map(async c => {
      const snap = await F.getDocs(F.collection(fs, c));
      db[c] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }));
  }
};

export async function cargarTodo() { return modo === "local" ? local.cargar() : remoto.cargar(); }

// Guarda (crea o actualiza) un registro
export async function guardar(c, obj) {
  const esNuevo = !obj.id;
  const reg = { ...obj, id: obj.id || nuevoId(), actualizado: ahora(), ...(esNuevo ? { creado: obj.creado || ahora() } : {}) };
  const i = db[c].findIndex(x => x.id === reg.id);
  if (i >= 0) db[c][i] = { ...db[c][i], ...reg }; else db[c].push(reg);
  const final = db[c].find(x => x.id === reg.id);
  if (modo === "local") await local.guardar(c);
  else { const { F, fs } = fb; const { id, ...datos } = final; await F.setDoc(F.doc(fs, c, id), JSON.parse(JSON.stringify(datos))); }
  return final;
}

export async function borrar(c, id) {
  db[c] = db[c].filter(x => x.id !== id);
  if (modo === "local") await local.borrar(c);
  else { const { F, fs } = fb; await F.deleteDoc(F.doc(fs, c, id)); }
}

// Respaldo completo (JSON) e importación
export function exportar() { return JSON.stringify({ app: "ISCR Labs", version: 1, fecha: ahora(), datos: db }, null, 2); }
// Nombre normalizado para comparar clientes (sin tildes, mayúsculas ni espacios de más)
export const normNombre = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Importa un respaldo. Al combinar, un cliente que ya existe con el mismo nombre
// (pero otro id) NO se vuelve a crear, y tampoco sus tickets, cobros, servicios, etc.
// Así subir los datos locales dos veces, o desde dos navegadores, no duplica clientes.
export async function importar(json, { reemplazar = false } = {}) {
  const d = JSON.parse(json).datos || {};
  const saltados = new Map(); // id importado → nombre
  if (!reemplazar) for (const c of d.clientes || []) {
    if (db.clientes.some(x => x.id === c.id)) continue; // es el mismo registro: se actualiza
    if (db.clientes.some(x => normNombre(x.nombre) === normNombre(c.nombre))) saltados.set(c.id, c.nombre);
  }
  // si en el mismo respaldo viene el cliente repetido, solo entra el primero
  const vistos = new Set(db.clientes.map(x => normNombre(x.nombre)));
  for (const c of d.clientes || []) {
    if (saltados.has(c.id) || db.clientes.some(x => x.id === c.id)) continue;
    if (vistos.has(normNombre(c.nombre))) saltados.set(c.id, c.nombre); else vistos.add(normNombre(c.nombre));
  }
  for (const c of COLECCIONES) {
    if (!Array.isArray(d[c])) continue;
    if (reemplazar) for (const r of [...db[c]]) await borrar(c, r.id);
    for (let r of d[c]) {
      if (c === "clientes" && saltados.has(r.id)) continue;
      if (c !== "clientes" && c !== "gastos" && saltados.has(r.clienteId)) continue;
      if (c === "gastos" && saltados.has(r.clienteId)) r = { ...r, clienteId: "" };
      // número de ticket ocupado por otro ticket → se le da el siguiente libre
      if (c === "tickets" && db.tickets.some(t => t.id !== r.id && +t.numero === +r.numero))
        r = { ...r, numero: db.tickets.reduce((m, t) => Math.max(m, +t.numero || 0), 0) + 1 };
      await guardar(c, r);
    }
  }
  return { saltados: [...new Set(saltados.values())] };
}

// Ajustes (un solo documento)
export const ajustes = () => db.ajustes.find(a => a.id === "general") || {};
export const guardarAjustes = a => guardar("ajustes", { ...ajustes(), ...a, id: "general" });

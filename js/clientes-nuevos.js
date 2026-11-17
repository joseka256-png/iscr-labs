// Clientes nuevos listos para cargar con un toque.
// En Inicio aparece un botón por cada uno que todavía no esté en la lista de clientes.
// Cuando ya se cargaron en todos los navegadores / en Firebase, se pueden quitar de aquí.
import { db, guardar } from "./datos.js?v=2";
import * as L from "./logica.js?v=2";

export const PENDIENTES = [
  {
    clave: "servegas",
    nombre: "Servegas",
    async cargar() {
      const c = await guardar("clientes", {
        nombre: "Servegas", estado: "prospecto", contacto: "Víctor Vega (electricista)", telefono: "8848-4264", correo: "",
        razonSocial: "", sitio: "", prueba: "https://joseka256-png.github.io/servegas/", repo: "joseka256-png/servegas",
        plan: { nombre: "", mensualidad: "", cambiosMes: "4", diaPago: 5, inicio: "", fin: "" },
        notas: "Trabajos eléctricos, más de 38 años de experiencia, servicio a todo el país, evaluaciones de red eléctrica. Miembro de la Cámara de Comercio. Todo el contacto es por WhatsApp 8848-4264 (todavía no tiene correo)."
      });
      await guardar("servicios", { clienteId: c.id, tipo: "hosting", nombre: "GitHub Pages (propuesta)", proveedor: "GitHub Pages", vence: "", costo: 0, moneda: "USD", cobroCliente: 0, renovacionAuto: true, cuenta: "joseka256-png", notas: "Repo joseka256-png/servegas. Pasar a dominio propio cuando cierre el plan." });
      await guardar("cambios", { clienteId: c.id, fecha: "2026-11-16", descripcion: "Primera versión del sitio: servicios, evaluación de red eléctrica, +38 años, Cámara de Comercio y contacto por WhatsApp", entorno: "prueba", commit: "", repo: "joseka256-png/servegas" });
      const tickets = [
        ["Publicar el sitio en GitHub Pages (repo servegas)", "nuevo", "alta", "abierto", "interno", false, "Crear el repo vacío joseka256-png/servegas, subir el sitio y activar Pages (main / raíz)."],
        ["Confirmar con Víctor la lista de servicios", "cambio", "media", "esperando", "whatsapp", true, "¿Eléctricos o también electrónicos? ¿Ofrece pintura, limpieza y mantenimiento (íconos del logo)? ¿Llega a las 7 provincias?"],
        ["Agregar correo cuando el cliente lo tenga", "cambio", "baja", "esperando", "whatsapp", true, "Por ahora todo el contacto va a WhatsApp 8848-4264."],
        ["Presentar propuesta y plan mensual", "soporte", "media", "abierto", "interno", false, "Planes de ₡30.000 o ₡40.000 al mes."]
      ];
      for (const [titulo, tipo, prioridad, estado, origen, incluido, descripcion] of tickets)
        await guardar("tickets", { numero: L.siguienteNumero(), clienteId: c.id, titulo, tipo, prioridad, estado, origen, incluido, descripcion, tiempo: [] });
      return c;
    }
  }
];

const norm = s => (s || "").toLowerCase().trim();
export const porCargar = () => PENDIENTES.filter(p => !db.clientes.some(c => norm(c.nombre) === norm(p.nombre)));

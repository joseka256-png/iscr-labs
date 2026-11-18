// Datos iniciales: Carnicería La Central (primer cliente de ISCR Labs).
// Se cargan con el botón de bienvenida; después se editan normal.
import { guardar } from "./datos.js?v=3";
import * as L from "./logica.js?v=3";

const COMMITS = [
  ["1f86761", "2026-11-16", "Versionar logos y favicon para que los cambios se vean sin caché"],
  ["b41464e", "2026-11-16", "Quitar 'Artigran S.A.' del logo, textos, mapa y contrato"],
  ["555d657", "2026-11-16", "Logo La Central · Cosecha Porcina S.A. en la página de la granja; menú 'Cliente frecuente'"],
  ["25d2f6b", "2026-11-14", "Buscador más robusto en celular: varios eventos, tecla Buscar, contador de resultados"],
  ["af1d23b", "2026-11-14", "Buscador: texto visible sobre fondo oscuro"],
  ["188d814", "2026-11-14", "Íconos de línea en lugar de emojis; correo cosechaporcina.sa@gmail.com en sitio y panel"],
  ["f950528", "2026-11-14", "Plantilla de contrato anual con branding del cliente"],
  ["1f05f1f", "2026-11-14", "Menú: 'Cosecha Porcina' en lugar de 'Nuestra granja'"],
  ["08beda1", "2026-11-14", "Versionar negocio.js para que los cambios se vean al instante"],
  ["590cbff", "2026-11-14", "Slider de promociones debajo del header"],
  ["060c5e9", "2026-11-14", "Página Cosecha Porcina: cerdos, ganado, biogás, galería"],
  ["80d686d", "2026-11-14", "Sección de la granja y botones de ½ kg / 1 kg"],
  ["b3486a7", "2026-11-14", "Menú real de productos y precios; carrito por kilo y búsqueda"],
  ["200374c", "2026-11-10", "Conectar al proyecto Firebase carniceria-la-central"],
  ["b8b1521", "2026-11-10", "Datos iniciales, logo y colores de La Central"]
];

export async function sembrar() {
  if (L.existeCliente("Carnicería La Central")) return null; // ya está: no duplicar
  const c = await guardar("clientes", {
    nombre: "Carnicería La Central", estado: "activo", contacto: "", telefono: "8321-7253", correo: "cosechaporcina.sa@gmail.com",
    razonSocial: "", sitio: "", prueba: "https://joseka256-png.github.io/carniceria-la-central/", repo: "joseka256-png/carniceria-la-central",
    plan: { nombre: "Cotizador web premium", mensualidad: "", cambiosMes: "4", diaPago: 5, inicio: "", fin: "" },
    notas: "Tel. del local 2551-1705. Sitio con catálogo y carrito por kilo, tarjeta de cliente frecuente con QR (Firebase), página Cosecha Porcina y slider de promociones."
  });
  await guardar("servicios", { clienteId: c.id, tipo: "dominio", nombre: "Dominio del sitio (Namecheap)", proveedor: "Namecheap", vence: "", costo: "", moneda: "USD", cobroCliente: "", renovacionAuto: true, cuenta: "", notas: "Completar el nombre del dominio y la fecha de vencimiento al comprarlo." });
  await guardar("servicios", { clienteId: c.id, tipo: "hosting", nombre: "Firebase (hosting + Firestore + Auth)", proveedor: "Firebase · plan Spark", vence: "", costo: 0, moneda: "USD", cobroCliente: 0, renovacionAuto: true, cuenta: "iscrtech.apps@gmail.com", notas: "Proyecto carniceria-la-central. Plan gratis." });
  for (const [h, f, d] of COMMITS) await guardar("cambios", { clienteId: c.id, fecha: f, descripcion: d, entorno: "prueba", commit: h, repo: "joseka256-png/carniceria-la-central" });
  const tickets = [
    ["Poner en producción con el dominio de Namecheap", "nuevo", "alta", "abierto", "interno", false, "Firebase Hosting + DNS en Namecheap + dominio autorizado en Auth. Ver pasos del 16 nov."],
    ["Cargar dirección exacta, horario y premio de la tarjeta", "cambio", "media", "esperando", "whatsapp", true, "Pendiente que el cliente los envíe."],
    ["Montar las promociones reales del slider", "cambio", "media", "esperando", "whatsapp", true, "Imágenes 1920×700 y 1080×1080."],
    ["Confirmar precios dudosos (tocineta Zar, jamón de pavo Don Luis) y unidades de embutidos", "cambio", "baja", "esperando", "interno", true, ""],
    ["Borrar tarjetas de prueba antes del lanzamiento", "soporte", "media", "abierto", "interno", false, "Dalia Marín (8337-2609) y Mario Solís (8990-7654)."]
  ];
  for (const [titulo, tipo, prioridad, estado, origen, incluido, descripcion] of tickets)
    await guardar("tickets", { numero: L.siguienteNumero(), clienteId: c.id, titulo, tipo, prioridad, estado, origen, cobro: incluido ? "plan" : "gratis", descripcion, tiempo: [] });
}

# ISCR Labs

Panel interno de **ISCR Tech** para llevar todo lo de los clientes en un solo lugar:

| Sección | Para qué |
|---|---|
| **Inicio** | Ingreso mensual recurrente, lo cobrado y lo pendiente del mes, cobros vencidos, tickets abiertos, horas trabajadas, renovaciones próximas, mantenimiento del mes y últimos cambios. |
| **Clientes** | Ficha de cada cliente: contacto, sitio, repo, plan, mensualidad, día de pago, contrato, cambios usados del mes, tickets, cobros, dominios y su historial de cambios. |
| **Tickets** | Cada pedido del cliente (por WhatsApp, llamada…) con prioridad, estado, fecha límite y **cronómetro de tiempo**. Marca si cuenta dentro de los cambios del plan o es extra. |
| **Cobros** | Las mensualidades se **generan solas** cada mes según el plan de cada cliente. Marcás "Pagó" con método y comprobante, o le mandás el **recordatorio por WhatsApp** con un toque. |
| **Renovaciones** | Dominios, hosting y otros servicios con fecha de vencimiento, lo que te cuestan y lo que le cobrás al cliente. Semáforo a 60 y 30 días. "Renovado" mueve la fecha un año y crea el cobro. |
| **Historial de cambios** | Lo que se publicó, en producción o en prueba, con el commit y el ticket relacionado. |
| **Mantenimiento** | Lista mensual por cliente (revisar sitio, respaldo, uso de Firebase, dominio, reporte…). Se crea sola cada mes. |
| **Ajustes** | Firma y SINPE para los recordatorios, tarifa por hora extra, lista base de mantenimiento, **respaldo** e importación. |

## Cómo se usa en el día a día

1. Llega un pedido por WhatsApp → botón **+ Ticket**.
2. Cuando empezás a trabajarlo → **Iniciar** (el cronómetro queda arriba aunque cambiés de página).
3. Hacés el commit en el repo del cliente; si querés, poné `#12` en el mensaje para ubicarlo luego.
4. **Marcar listo** → te ofrece registrar el cambio publicado (fecha, commit, producción/prueba).
5. **Avisar al cliente** abre WhatsApp con el mensaje listo.
6. A inicio de mes revisás **Cobros** y **Mantenimiento**.

## Modo local (para probar ya)

Con `js/config.js` en `FIREBASE = null`, la app guarda todo en el navegador (localStorage). Sirve para probar, pero si se borran los datos del navegador se pierden: **descargá un respaldo** desde Ajustes.

## Pasar a Firebase (producción)

1. En la consola de Firebase (cuenta iscrtech.apps@gmail.com) crear el proyecto **iscr-labs**.
2. **Authentication** → Método de acceso → activar *Correo/contraseña* → Agregar usuario (tu correo y contraseña).
3. **Firestore Database** → Crear base de datos (modo producción, región `nam5`).
4. En Firestore crear la colección **`admins`** con un documento cuyo ID sea **el UID de tu usuario** (campo `nombre: "José"`).
5. **Reglas** de Firestore → pegar el contenido de `firestore.rules` → Publicar.
6. Configuración del proyecto → Tus apps → **Web** → copiar la configuración y pegarla en `js/config.js` (`export const FIREBASE = {…}`).
7. Abrí la app, entrá con tu usuario y en **Ajustes → Importar respaldo** subí el respaldo que bajaste en modo local.

> La configuración web de Firebase (apiKey, etc.) **no es secreta**: lo que protege los datos son las reglas (solo quien está en `admins` puede leer o escribir).

## Publicación

- **GitHub Pages**: cada push a `main` publica la app (workflow `pages.yml`).
- **Dominio propio** (recomendado): `labs.iscrtech.com` → en Firebase Hosting (`firebase deploy --only hosting`) o apuntando el subdominio a GitHub Pages. Agregá ese dominio en *Authentication → Configuración → Dominios autorizados*.
- La app tiene `noindex`: Google no la muestra.

## Estructura

```
index.html        ← la app
css/app.css       ← estilos
js/config.js      ← Firebase (null = modo local)
js/datos.js       ← guardar / leer (local o Firestore), respaldo
js/logica.js      ← reglas: mensualidades, renovaciones, tiempo, planes
js/app.js         ← vistas y acciones
js/semilla.js     ← datos iniciales de Carnicería La Central
js/iconos.js      ← íconos (Lucide, ISC)
firestore.rules   ← seguridad
```

Sin dependencias ni paso de compilación: se edita y se sube.

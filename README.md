# Kmusic Radio · página web + panel administrador

- **Página pública:** `/` (index.html, assets/site.css, assets/site.js)
- **Panel administrador:** `/admin`
- **Contenido de ejemplo:** `config.default.json` (se muestra hasta que se publique desde el panel)

## Qué se edita desde el panel

Señal en vivo (con botón “Probar señal”), canción sonando ahora (manual o automática por API),
transmisión en video de YouTube Live, logo, colores, SEO, portada (imagen o video de fondo),
redes sociales, WhatsApp y contacto, programación por días y horas, Top 10 con carátulas y links,
videos (YouTube, Shorts, Vimeo o MP4), locutores con foto, eventos con entradas, noticias,
banners publicitarios rotativos, marcas aliadas, sección de pauta, app y pie de página.
También se pueden ocultar secciones.

El panel tiene vista previa en vivo (escritorio y celular), guarda borradores, publica con un clic,
guarda las últimas 30 versiones para restaurar y permite descargar/cargar un respaldo.

## Activarlo en Vercel (una sola vez)

1. En el proyecto de Vercel → **Storage** → **Create** → **Blob** → acceso **Public** → conectarlo al proyecto.
   Luego en el Blob → **Projects** → **Connect Project** → `kmusicradio`.
   Vercel crea sola la variable `BLOB_STORE_ID` (o `BLOB_READ_WRITE_TOKEN` en almacenes antiguos); el código acepta ambas.
2. En **Settings → Environment Variables** crear `ADMIN_PASSWORD` con la contraseña del panel.
3. **Redeploy** del proyecto.
4. Entrar a `https://tu-dominio/admin` con esa contraseña.

Las imágenes se comprimen solas antes de subirse. Los videos largos van mejor como link de YouTube;
un MP4 subido al panel debe pesar máximo 3 MB.

## Probar en local

```bash
npm install
npm run dev
```

Página en http://localhost:3000 y panel en http://localhost:3000/admin (contraseña local: `kmusic-local`).
En local todo se guarda en la carpeta `.data/`.

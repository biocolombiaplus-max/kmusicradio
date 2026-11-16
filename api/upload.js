import { saveUpload, checkAuth, send, readJson, storageReady } from "../lib/store.js";

// Recibe { name, type, data(base64) }. El panel comprime las imágenes antes de enviarlas
// para quedar por debajo del límite de 4.5 MB de las funciones de Vercel.
export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  if (!checkAuth(req)) return send(res, 401, { error: "Contraseña incorrecta" });
  if (!storageReady()) return send(res, 503, { error: "Falta conectar el almacenamiento (Vercel Blob)." });
  try {
    const { name, type, data } = await readJson(req);
    const buffer = Buffer.from(String(data || ""), "base64");
    if (!buffer.length) return send(res, 400, { error: "Archivo vacío" });
    if (buffer.length > 4 * 1024 * 1024) return send(res, 413, { error: "El archivo pesa más de 4 MB" });
    const url = await saveUpload(buffer, type, name);
    return send(res, 200, { url });
  } catch (e) {
    return send(res, 400, { error: e.message || "No se pudo subir el archivo" });
  }
}

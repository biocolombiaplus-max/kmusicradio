import { getConfig, saveConfig, checkAuth, send, readJson, storageReady } from "../lib/store.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const config = await getConfig();
      res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
      return send(res, 200, { config, storage: storageReady() });
    }
    if (req.method === "POST") {
      if (!checkAuth(req)) return send(res, 401, { error: "Contraseña incorrecta" });
      if (!storageReady()) return send(res, 503, { error: "Falta conectar el almacenamiento (Vercel Blob)." });
      const { config } = await readJson(req);
      if (!config || typeof config !== "object") return send(res, 400, { error: "Configuración inválida" });
      config.updatedAt = new Date().toISOString();
      await saveConfig(config);
      return send(res, 200, { ok: true, updatedAt: config.updatedAt });
    }
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    return send(res, 500, { error: e.message || "Error del servidor" });
  }
}

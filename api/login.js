import { checkAuth, send, storageReady } from "../lib/store.js";

export default function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  if (!checkAuth(req)) return send(res, 401, { error: "Contraseña incorrecta" });
  return send(res, 200, { ok: true, storage: storageReady() });
}

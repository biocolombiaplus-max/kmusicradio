import { listHistory, readHistory, checkAuth, send } from "../lib/store.js";

export default async function handler(req, res) {
  if (!checkAuth(req)) return send(res, 401, { error: "Contraseña incorrecta" });
  try {
    const id = new URL(req.url, "http://x").searchParams.get("id");
    if (id) return send(res, 200, { config: await readHistory(id) });
    return send(res, 200, { versions: await listHistory() });
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
}

// Servidor local para probar la landing y el panel sin Vercel: npm run dev
// Contraseña local por defecto: kmusic-local (o define ADMIN_PASSWORD).
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    try {
      const mod = await import(`./api/${name}.js`);
      return mod.default(req, res);
    } catch {
      res.statusCode = 404; return res.end("No encontrado");
    }
  }
  let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root) || file.includes("node_modules")) { res.statusCode = 403; return res.end(); }
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
    const data = await fs.readFile(file);
    res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404; res.end("No encontrado");
  }
}).listen(port, () => console.log(`Kmusic en http://localhost:${port}  ·  panel: http://localhost:${port}/admin/`));

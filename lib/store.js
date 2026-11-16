// Almacenamiento de la configuración y las imágenes.
// En Vercel usa Vercel Blob (requiere BLOB_READ_WRITE_TOKEN).
// En local (npm run dev) guarda en la carpeta .data/.
import { put, get, list, del } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CONFIG_PATH = "config/site.json";
const HISTORY_PREFIX = "config/history/";
const KEEP_HISTORY = 30;
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const onVercel = () => Boolean(process.env.VERCEL);
const LOCAL_DIR = path.join(process.cwd(), ".data");

export function storageReady() {
  return useBlob() || !onVercel();
}

async function readStream(stream) {
  return new Response(stream).text();
}

export async function getConfig() {
  if (useBlob()) {
    const r = await get(CONFIG_PATH, { access: "public", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await readStream(r.stream));
  }
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, CONFIG_PATH), "utf8"));
  } catch {
    return null;
  }
}

export async function saveConfig(config) {
  const body = JSON.stringify(config, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (useBlob()) {
    await put(CONFIG_PATH, body, {
      access: "public", addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json", cacheControlMaxAge: 60,
    });
    await put(`${HISTORY_PREFIX}${stamp}.json`, body, {
      access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
    const { blobs } = await list({ prefix: HISTORY_PREFIX, limit: 1000 });
    const old = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname)).slice(KEEP_HISTORY);
    if (old.length) await del(old.map((b) => b.url));
    return;
  }
  await fs.mkdir(path.join(LOCAL_DIR, HISTORY_PREFIX), { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, CONFIG_PATH), body);
  await fs.writeFile(path.join(LOCAL_DIR, HISTORY_PREFIX, `${stamp}.json`), body);
}

export async function listHistory() {
  if (useBlob()) {
    const { blobs } = await list({ prefix: HISTORY_PREFIX, limit: 1000 });
    return blobs
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .map((b) => ({ id: b.pathname.slice(HISTORY_PREFIX.length), url: b.url, date: b.uploadedAt }));
  }
  try {
    const files = await fs.readdir(path.join(LOCAL_DIR, HISTORY_PREFIX));
    return files.sort().reverse().map((f) => ({ id: f, url: `/.data/${HISTORY_PREFIX}${f}`, date: null }));
  } catch {
    return [];
  }
}

export async function readHistory(id) {
  if (!/^[\w-]+\.json$/.test(id)) throw new Error("Versión inválida");
  if (useBlob()) {
    const r = await get(HISTORY_PREFIX + id, { access: "public", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await readStream(r.stream));
  }
  return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, HISTORY_PREFIX, id), "utf8"));
}

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "video/mp4": "mp4" };

export async function saveUpload(buffer, contentType, name = "archivo") {
  const ext = TYPES[contentType];
  if (!ext) throw new Error("Tipo de archivo no permitido");
  const slug = String(name).toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "archivo";
  const file = `media/${slug}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  if (useBlob()) {
    const r = await put(file, buffer, { access: "public", addRandomSuffix: false, contentType });
    return r.url;
  }
  await fs.mkdir(path.join(LOCAL_DIR, "media"), { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, file), buffer);
  return `/.data/${file}`;
}

export function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD || (onVercel() ? "" : "kmusic-local");
  const given = String(req.headers["x-admin-key"] || "");
  if (!expected || !given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

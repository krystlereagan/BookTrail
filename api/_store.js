const crypto = require("crypto");

function hasStoreConfig() {
  return Boolean(getStoreUrl() && getStoreToken());
}

async function kv(command) {
  if (!hasStoreConfig()) {
    const error = new Error("Redis REST environment variables are required.");
    error.status = 503;
    throw error;
  }

  const response = await fetch(getStoreUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoreToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error || "BookTrail storage is unavailable.");
    error.status = 502;
    throw error;
  }

  return data.result;
}

function getStoreUrl() {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
}

function getStoreToken() {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
}

async function getBook(code) {
  const value = await kv(["GET", bookKey(code)]);
  return value ? JSON.parse(value) : null;
}

async function saveBook(book) {
  await kv(["SET", bookKey(book.code), JSON.stringify(book)]);
  await kv(["ZADD", "booktrail:books", Date.parse(book.createdAt) || Date.now(), book.code]);
  return book;
}

async function listBooks(limit = 50) {
  const codes = await kv(["ZREVRANGE", "booktrail:books", 0, limit - 1]);
  if (!codes.length) return [];
  const values = await kv(["MGET", ...codes.map(bookKey)]);
  return values.filter(Boolean).map((value) => JSON.parse(value));
}

function bookKey(code) {
  return `booktrail:book:${String(code).toUpperCase()}`;
}

async function getUserByEmail(email) {
  const value = await kv(["GET", userEmailKey(email)]);
  return value ? JSON.parse(value) : null;
}

async function getUserById(id) {
  const value = await kv(["GET", userKey(id)]);
  return value ? JSON.parse(value) : null;
}

async function saveUser(user) {
  await kv(["SET", userKey(user.id), JSON.stringify(user)]);
  await kv(["SET", userEmailKey(user.email), JSON.stringify(user)]);
  await kv(["ZADD", "booktrail:users", Date.parse(user.createdAt) || Date.now(), user.id]);
  return sanitizeUser(user);
}

async function listUsers(limit = 100) {
  const ids = await kv(["ZREVRANGE", "booktrail:users", 0, limit - 1]);
  if (!ids.length) return [];
  const values = await kv(["MGET", ...ids.map(userKey)]);
  return values.filter(Boolean).map((value) => sanitizeUser(JSON.parse(value)));
}

async function userCount() {
  return Number(await kv(["ZCARD", "booktrail:users"])) || 0;
}

async function createSession(user) {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
  };
  await kv(["SET", sessionKey(token), JSON.stringify(session), "EX", 60 * 60 * 24 * 30]);
  return token;
}

async function deleteSession(token) {
  if (token) await kv(["DEL", sessionKey(token)]);
}

async function getSessionUser(req) {
  const token = getCookie(req, "bt_session");
  if (!token) return null;
  const value = await kv(["GET", sessionKey(token)]);
  if (!value) return null;
  const session = JSON.parse(value);
  const user = await getUserById(session.userId);
  return user ? sanitizeUser(user) : null;
}

async function requireUser(req) {
  const user = await getSessionUser(req);
  if (!user) {
    const error = new Error("Please sign in to continue.");
    error.status = 401;
    throw error;
  }
  return user;
}

async function requireRole(req, roles) {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) {
    const error = new Error("Your account does not have permission to do that.");
    error.status = 403;
    throw error;
  }
  return user;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 310000, 32, "sha256").toString("base64url");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    libraryName: user.libraryName || "",
    createdAt: user.createdAt,
  };
}

function setSessionCookie(res, token) {
  const cookie = [
    `bt_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    "Max-Age=2592000",
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "bt_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0");
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function userKey(id) {
  return `booktrail:user:${id}`;
}

function userEmailKey(email) {
  return `booktrail:user-email:${String(email).toLowerCase()}`;
}

function sessionKey(token) {
  return `booktrail:session:${token}`;
}

function createCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `BT-${Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
}

function clean(value, limit = 500) {
  return String(value || "").trim().slice(0, limit);
}

function validateRequired(value, label) {
  if (!clean(value)) {
    const error = new Error(`${label} is required.`);
    error.status = 400;
    throw error;
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function sendError(res, error) {
  sendJson(res, error.status || 500, { error: error.message || "Unexpected server error." });
}

module.exports = {
  clearSessionCookie,
  clean,
  createSession,
  createCode,
  deleteSession,
  getBook,
  getCookie,
  getSessionUser,
  getUserByEmail,
  getUserById,
  hashPassword,
  hasStoreConfig,
  listBooks,
  listUsers,
  requireRole,
  requireUser,
  saveBook,
  saveUser,
  sendError,
  sendJson,
  setSessionCookie,
  sanitizeUser,
  userCount,
  validateRequired,
  verifyPassword,
};

const redis = require("../../lib/redis");
const { requireAdmin } = require("../../lib/adminAuth");

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const code = String(body.code || "").trim();
    const remark = String(body.remark || "").trim();
    const maxUses = Number(body.maxUses || 0);

    if (!code) {
      return sendJson(res, 400, { ok: false, error: "Code is required" });
    }

    if (!Number.isFinite(maxUses) || maxUses < 0) {
      return sendJson(res, 400, { ok: false, error: "maxUses must be >= 0" });
    }

    const key = `fps:code:${code}`;
    const exists = await redis.get(key);

    if (exists) {
      return sendJson(res, 409, { ok: false, error: "Code already exists" });
    }

    const now = Date.now();
    const data = {
      code,
      remark,
      maxUses,
      used: 0,
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    await redis.set(key, data);
    await redis.sadd("fps:codes", code);

    return sendJson(res, 200, { ok: true, item: data });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
};
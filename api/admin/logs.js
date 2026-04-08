const redis = require("../../lib/redis");
const { requireAdmin } = require("../../lib/adminAuth");

function sendJson(res, status, data) {
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));

    const keys = await redis.zrange("fps:usage:logs:index", 0, limit - 1, {
      rev: true
    });

    const list = [];
    for (const key of keys || []) {
      const item = await redis.get(key);
      if (item) list.push(item);
    }

    return sendJson(res, 200, {
      ok: true,
      list
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
};
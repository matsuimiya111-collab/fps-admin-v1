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

    if (!code) {
      return sendJson(res, 400, { ok: false, error: "Code is required" });
    }

    await redis.del(`fps:code:${code}`);
    await redis.srem("fps:codes", code);

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
};
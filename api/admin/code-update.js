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

    const key = `fps:code:${code}`;
    const info = await redis.get(key);

    if (!info) {
      return sendJson(res, 404, { ok: false, error: "Code not found" });
    }

    let next = { ...info };

    if (Object.prototype.hasOwnProperty.call(body, "remark")) {
      next.remark = String(body.remark || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const s = String(body.status || "").trim();
      if (!["active", "disabled"].includes(s)) {
        return sendJson(res, 400, { ok: false, error: "status must be active or disabled" });
      }
      next.status = s;
    }

    if (Object.prototype.hasOwnProperty.call(body, "maxUses")) {
      const maxUses = Number(body.maxUses);
      if (!Number.isFinite(maxUses) || maxUses < 0) {
        return sendJson(res, 400, { ok: false, error: "maxUses must be >= 0" });
      }
      next.maxUses = maxUses;
    }

    if (Object.prototype.hasOwnProperty.call(body, "usedDelta")) {
      const usedDelta = Number(body.usedDelta || 0);
      if (!Number.isFinite(usedDelta)) {
        return sendJson(res, 400, { ok: false, error: "usedDelta must be a number" });
      }
      const currentUsed = Number(next.used || 0);
      next.used = Math.max(0, currentUsed + usedDelta);
    }

    next.updatedAt = Date.now();

    await redis.set(key, next);

    return sendJson(res, 200, {
      ok: true,
      item: {
        code,
        remark: next.remark || "",
        status: next.status || "active",
        maxUses: Number(next.maxUses || 0),
        used: Number(next.used || 0),
        remaining: Math.max(0, Number(next.maxUses || 0) - Number(next.used || 0)),
        createdAt: next.createdAt || null,
        updatedAt: next.updatedAt || null
      }
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
};
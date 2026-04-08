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
    const codes = await redis.smembers("fps:codes");
    const list = [];

    for (const code of codes || []) {
      const item = await redis.get(`fps:code:${code}`);
      if (!item) continue;

      const maxUses = Number(item.maxUses || 0);
      const used = Number(item.used || 0);

      list.push({
        code,
        remark: item.remark || "",
        status: item.status || "active",
        maxUses,
        used,
        remaining: Math.max(0, maxUses - used),
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null
      });
    }

    list.sort((a, b) => {
      const ta = Number(a.createdAt || 0);
      const tb = Number(b.createdAt || 0);
      return tb - ta;
    });

    return sendJson(res, 200, {
      ok: true,
      list
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
};
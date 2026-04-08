const redis = require("../lib/redis");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, status, data) {
  setCors(res);
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const code = String(body.code || "").trim();

    if (!code) {
      return sendJson(res, 400, { ok: false, error: "Missing code" });
    }

    const key = `fps:code:${code}`;
    const info = await redis.get(key);

    if (!info) {
      return sendJson(res, 404, { ok: false, error: "Authorization code not found" });
    }

    const status = info.status || "active";
    const maxUses = Number(info.maxUses || 0);
    const used = Number(info.used || 0);
    const remaining = Math.max(0, maxUses - used);

    if (status !== "active") {
      return sendJson(res, 403, {
        ok: false,
        error: "Authorization code disabled",
        code,
        status,
        maxUses,
        used,
        remaining,
        remark: info.remark || ""
      });
    }

    if (remaining <= 0) {
      return sendJson(res, 403, {
        ok: false,
        error: "No remaining uses",
        code,
        status,
        maxUses,
        used,
        remaining,
        remark: info.remark || ""
      });
    }

    return sendJson(res, 200, {
      ok: true,
      code,
      status,
      maxUses,
      used,
      remaining,
      remark: info.remark || ""
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
};

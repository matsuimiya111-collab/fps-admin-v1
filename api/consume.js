const redis = require("../lib/redis");

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function makeLogId() {
  return `fps:usage:log:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const code = String(body.code || "").trim();
    const rowsAdded = Number(body.rowsAdded || 0);
    const pageUrl = String(body.pageUrl || "").slice(0, 1000);

    if (!code) {
      return sendJson(res, 400, { ok: false, error: "Missing code" });
    }

    const codeKey = `fps:code:${code}`;
    const info = await redis.get(codeKey);

    if (!info) {
      return sendJson(res, 404, { ok: false, error: "Authorization code not found" });
    }

    const status = info.status || "active";
    const maxUses = Number(info.maxUses || 0);
    const used = Number(info.used || 0);
    const beforeRemaining = Math.max(0, maxUses - used);

    if (status !== "active") {
      return sendJson(res, 403, { ok: false, error: "Authorization code disabled" });
    }

    if (beforeRemaining <= 0) {
      return sendJson(res, 403, { ok: false, error: "No remaining uses" });
    }

    const nextUsed = used + 1;
    const afterRemaining = Math.max(0, maxUses - nextUsed);
    const now = Date.now();

    const nextInfo = {
      ...info,
      used: nextUsed,
      updatedAt: now
    };

    await redis.set(codeKey, nextInfo);

    const log = {
      code,
      usedAt: now,
      rowsAdded,
      beforeRemaining,
      afterRemaining,
      pageUrl,
      remarkSnapshot: info.remark || ""
    };

    const logKey = makeLogId();
    await redis.set(logKey, log);
    await redis.zadd("fps:usage:logs:index", { score: now, member: logKey });

    return sendJson(res, 200, {
      ok: true,
      code,
      used: nextUsed,
      maxUses,
      remaining: afterRemaining
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message || "Server error" });
  }
};
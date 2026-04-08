function sendJson(res, status, data) {
  res.status(status).json(data);
}

function requireAdmin(req, res) {
  const pass = req.headers["x-admin-password"];
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    sendJson(res, 500, { ok: false, error: "ADMIN_PASSWORD not configured" });
    return false;
  }

  if (!pass || pass !== adminPassword) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
    return false;
  }

  return true;
}

module.exports = {
  requireAdmin
};
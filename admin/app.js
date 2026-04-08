const $ = (id) => document.getElementById(id);

function showMsg(text) {
  const el = $("msg");
  el.textContent = text;
  el.style.display = "block";
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => {
    el.style.display = "none";
  }, 2500);
}

function getAdminPassword() {
  return localStorage.getItem("fps_admin_password") || "";
}

function setAdminPassword(pwd) {
  localStorage.setItem("fps_admin_password", pwd);
}

function formatTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

async function api(path, options = {}) {
  const password = getAdminPassword();
  const headers = {
    "Content-Type": "application/json",
    "x-admin-password": password,
    ...(options.headers || {})
  };

  const res = await fetch(path, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

async function loadCodes() {
  const data = await api("/api/admin/codes");
  const tbody = $("codesTbody");
  tbody.innerHTML = "";

  for (const item of data.list) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(item.code)}</td>
      <td>
        <input class="inline-input" data-role="remark" data-code="${escapeAttr(item.code)}" value="${escapeAttr(item.remark || "")}" />
      </td>
      <td>
        <select class="small-input" data-role="status" data-code="${escapeAttr(item.code)}">
          <option value="active" ${item.status === "active" ? "selected" : ""}>active</option>
          <option value="disabled" ${item.status === "disabled" ? "selected" : ""}>disabled</option>
        </select>
      </td>
      <td>
        <input class="small-input" type="number" data-role="maxUses" data-code="${escapeAttr(item.code)}" value="${Number(item.maxUses || 0)}" />
      </td>
      <td>${Number(item.used || 0)}</td>
      <td>${Number(item.remaining || 0)}</td>
      <td>${formatTime(item.createdAt)}</td>
      <td>${formatTime(item.updatedAt)}</td>
      <td>
        <div class="mini-actions">
          <input class="small-input" type="number" placeholder="±次数" data-role="delta" data-code="${escapeAttr(item.code)}" />
          <button data-action="save" data-code="${escapeAttr(item.code)}">保存</button>
          <button data-action="delete" data-code="${escapeAttr(item.code)}">删除</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  }
}

async function loadLogs() {
  const data = await api("/api/admin/logs?limit=100");
  const tbody = $("logsTbody");
  tbody.innerHTML = "";

  for (const item of data.list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatTime(item.usedAt)}</td>
      <td>${escapeHtml(item.code || "")}</td>
      <td>${Number(item.rowsAdded || 0)}</td>
      <td>${Number(item.beforeRemaining || 0)}</td>
      <td>${Number(item.afterRemaining || 0)}</td>
      <td class="url-cell">${escapeHtml(item.pageUrl || "")}</td>
      <td>${escapeHtml(item.remarkSnapshot || "")}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

async function createCode() {
  const code = $("newCode").value.trim();
  const maxUses = Number($("newMaxUses").value || 0);
  const remark = $("newRemark").value.trim();

  if (!code) {
    showMsg("请输入授权码");
    return;
  }

  await api("/api/admin/code-create", {
    method: "POST",
    body: JSON.stringify({ code, maxUses, remark })
  });

  $("newCode").value = "";
  $("newMaxUses").value = "";
  $("newRemark").value = "";
  showMsg("新增成功");
  await loadCodes();
}

async function saveRow(code) {
  const remarkEl = document.querySelector(`[data-role="remark"][data-code="${cssEscape(code)}"]`);
  const statusEl = document.querySelector(`[data-role="status"][data-code="${cssEscape(code)}"]`);
  const maxUsesEl = document.querySelector(`[data-role="maxUses"][data-code="${cssEscape(code)}"]`);
  const deltaEl = document.querySelector(`[data-role="delta"][data-code="${cssEscape(code)}"]`);

  const remark = remarkEl ? remarkEl.value.trim() : "";
  const status = statusEl ? statusEl.value : "active";
  const maxUses = maxUsesEl ? Number(maxUsesEl.value || 0) : 0;
  const deltaRaw = deltaEl ? deltaEl.value.trim() : "";
  const payload = { code, remark, status, maxUses };

  if (deltaRaw !== "") {
    payload.usedDelta = Number(deltaRaw || 0);
  }

  await api("/api/admin/code-update", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  showMsg(`已保存：${code}`);
  await loadCodes();
}

async function deleteCode(code) {
  if (!confirm(`确定删除授权码 ${code} 吗？`)) return;

  await api("/api/admin/code-delete", {
    method: "POST",
    body: JSON.stringify({ code })
  });

  showMsg(`已删除：${code}`);
  await loadCodes();
}

function cssEscape(value) {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function bindEvents() {
  $("savePasswordBtn").addEventListener("click", async () => {
    const pwd = $("adminPassword").value.trim();
    setAdminPassword(pwd);
    showMsg("后台密码已保存到浏览器");
    try {
      await loadCodes();
      await loadLogs();
    } catch (err) {
      showMsg(err.message);
    }
  });

  $("createCodeBtn").addEventListener("click", async () => {
    try {
      await createCode();
    } catch (err) {
      showMsg(err.message);
    }
  });

  $("refreshCodesBtn").addEventListener("click", async () => {
    try {
      await loadCodes();
      showMsg("授权码列表已刷新");
    } catch (err) {
      showMsg(err.message);
    }
  });

  $("refreshLogsBtn").addEventListener("click", async () => {
    try {
      await loadLogs();
      showMsg("使用记录已刷新");
    } catch (err) {
      showMsg(err.message);
    }
  });

  $("codesTbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const code = btn.getAttribute("data-code");
    if (!code) return;

    try {
      if (action === "save") {
        await saveRow(code);
      } else if (action === "delete") {
        await deleteCode(code);
      }
    } catch (err) {
      showMsg(err.message);
    }
  });
}

async function init() {
  $("adminPassword").value = getAdminPassword();
  bindEvents();

  if (getAdminPassword()) {
    try {
      await loadCodes();
      await loadLogs();
    } catch (err) {
      showMsg(err.message);
    }
  }
}

init();
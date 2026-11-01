/*
 * Muse2API Loon 反代脚本 (v2)
 * 劫持 api.openai.com 请求 → 改写转发到自建 muse2api-http 网关（流式透传）
 *
 * v2: 上游地址自动跟随 —— 优先读 GitHub 的 muse-upstream.txt（本地缓存 120s），
 *     隧道换地址后无需改 Loon 参数；读取失败回退到参数 up。
 *
 * $argument: up=<网关基址(回退用)>&key=<网关Key>&model=<默认模型>&models=<模型列表>&auto=<1自动跟随/0关闭>&dbg=<1调试>
 */
const RESOLVER = "https://raw.githubusercontent.com/ruiruizl/loon-rules/main/muse-upstream.txt";
const ARG_UP = (arg.up || "").trim();
const KEY = arg.key || "muse2api-local";
const DEF_MODEL = arg.model || "muse-spark";
const MODEL_LIST = (arg.models || "muse-spark,muse,claude-sonnet-4,gpt-5").split(",").map(s => s.trim()).filter(Boolean);
const AUTO = arg.auto !== "0";
const TTL = 120000; // 缓存 2 分钟
const CKEY = "muse2api_upstream_v2";
const DBG = arg.dbg === "1";
const L = (m) => { if (DBG) { try { console.log("[muse2api-loon] " + m); } catch (e) {} } };
function done(obj) { if (typeof $done === "function") $done(obj); }

/* ---------- 上游地址解析 ---------- */
function resolveUp(cb) {
  if (!AUTO || !RESOLVER) { cb(ARG_UP); return; }
  let cached = null;
  try { const s = $persistentStore.read(CKEY); if (s) cached = JSON.parse(s); } catch (e) {}
  const now = Date.now();
  if (cached && cached.u && now - (cached.t || 0) < TTL) { cb(cached.u); return; }
  if (typeof $httpClient === "undefined") { cb(cached && cached.u ? cached.u : ARG_UP); return; }
  $httpClient.get({ url: RESOLVER, headers: { "Cache-Control": "no-cache", "User-Agent": "muse2api-loon" } }, function (status, resp) {
    let u = "";
    try {
      if (status >= 200 && status < 300 && resp && resp.body) {
        u = String(resp.body).trim().split(/\s+/)[0] || "";
        if (!/^https?:\/\//.test(u)) u = "";
      }
    } catch (e) { u = ""; }
    if (u) {
      L("resolved upstream: " + u);
      try { $persistentStore.write(CKEY, JSON.stringify({ u: u, t: now })); } catch (e) {}
      cb(u);
    } else {
      L("resolve fail status=" + status + " → 回退");
      cb(cached && cached.u ? cached.u : ARG_UP);
    }
  });
}

/* ---------- 请求改写 ---------- */
function rewrite(up) {
  const url = $request.url || "";
  const method = ($request.method || "GET").toUpperCase();
  const m = url.match(/^https?:\/\/api\.openai\.com(\/v1\/[^?#]*)(\?.*)?$/);
  if (!m) { L("skip: not api.openai.com"); done({}); return; }
  const path = m[1];

  if (!up) {
    done({
      response: {
        status: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: { message: "muse2api 上游不可用：自动解析失败且参数 up 未配置（稍后重试会再次解析）" } })
      }
    });
    return;
  }
  const newUrl = up.replace(/\/+$/, "") + path + (m[2] || "");

  const headers = {};
  const skip = { host: 1, "content-length": 1 };
  const src = ($request.headers || {});
  for (const k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) {
      const lk = String(k).toLowerCase();
      if (!skip[lk]) headers[k] = src[k];
    }
  }
  headers["Authorization"] = "Bearer " + KEY;
  headers["Content-Type"] = "application/json";
  headers["X-Muse2api-Loon"] = "1";

  let bodyStr = $request.body || "";
  if (method === "POST" && /chat\/completions/.test(path) && bodyStr) {
    try {
      const j = JSON.parse(bodyStr);
      const cur = (j.model || "").trim();
      if (!cur || MODEL_LIST.indexOf(cur) === -1) j.model = DEF_MODEL;
      bodyStr = JSON.stringify(j);
    } catch (e) { L("body parse fail: " + e); }
  }

  L(method + " " + path + " → " + newUrl);
  done({ url: newUrl, headers: headers, body: bodyStr });
}

/* ---------- 入口 ---------- */
try {
  resolveUp(function (up) {
    try { rewrite(up); } catch (e) {
      L("rewrite fatal: " + (e && e.stack || e));
      done({ response: { status: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: "muse2api-loon 脚本异常: " + e } }) } });
    }
  });
} catch (e) {
  L("fatal: " + (e && e.stack || e));
  done({ response: { status: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: "muse2api-loon 脚本异常: " + e } }) } });
}

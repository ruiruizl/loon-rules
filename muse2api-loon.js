/*
 * Muse2API Loon 反代脚本 (v1)
 * 劫持 api.openai.com 请求 → 改写转发到自建 muse2api-http 网关
 * （部署于 iSH + cloudflared 隧道）
 *
 * $argument: up=<网关基址>&key=<网关Key>&model=<默认模型>&models=<逗号分隔模型列表>&dbg=<1调试>
 * 路由：
 *   POST /v1/chat/completions → 改写到上游（流式透传）
 *   GET  /v1/models           → 上游透传
 *   其他 /v1/*                → 上游透传
 */
const UP = arg.up || "";
const KEY = arg.key || "muse2api-local";
const DEF_MODEL = arg.model || "muse-spark";
const MODEL_LIST = (arg.models || "muse-spark,muse,claude-sonnet-4,gpt-5").split(",").map(s => s.trim()).filter(Boolean);
const DBG = arg.dbg === "1";

const L = (m) => { try { console.log("[muse2api-loon] " + m); } catch (e) {} };

function done(obj) { if (typeof $done === "function") $done(obj); }

/* ---------- 请求改写（request 类型） ---------- */
function rewriteRequest() {
  const url = $request.url || "";
  const method = ($request.method || "GET").toUpperCase();
  const m = url.match(/^https?:\/\/api\.openai\.com(\/v1\/[^?#]*)(\?.*)?$/);
  if (!m) { L("skip: not api.openai.com"); done({}); return; }
  const path = m[1];

  if (!UP) {
    done({
      response: {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: { message: "插件参数 up 未配置（填 muse2api 网关基址）" } })
      }
    });
    return;
  }
  const newUrl = UP.replace(/\/+$/, "") + path + (m[2] || "");

  // 合并原始 headers，去掉 host / content-length
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
  // 标记请求已改写，避免 Loon 对响应再触发一次 MITM 脚本循环
  headers["X-Muse2api-Loon"] = "1";

  // 模型名改写：客户端填的 muse-spark 直接透传；填其他名字替换为默认
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
  rewriteRequest();
} catch (e) {
  L("fatal: " + (e && e.stack || e));
  done({
    response: {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: { message: "muse2api-loon 脚本异常: " + e } })
    }
  });
}

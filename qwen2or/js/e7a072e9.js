// qwen2or build e7a072e9  model=openai/gpt-5.2
/*
 * qwen2or.js — 把 Siri 发往千问的文本请求改走 OpenRouter，并按原事件流回给 Siri
 *
 * module argument:
 *   mode=auto|probe|rewrite   auto=JSON体才改写，其余只记录（默认）
 *   dry=0|1                   1=只记录不改写（探针）
 *   model=openai/gpt-5.2
 *   key=sk-or-v1-xxxx         为空或含 TOKEN_HERE 时自动进入 dry 模式
 *   upstream=https://openrouter.ai/api/v1/chat/completions
 *   sys=<urlencoded 系统提示词>
 *
 * 运行期覆盖（优先级高于 argument，由 $persistentStore 读写）:
 *   qwen2or_key / qwen2or_model / qwen2or_dry
 */
(function () {
  function parseArg(s) {
    var o = {};
    if (!s) return o;
    s.split("&").forEach(function (p) {
      var i = p.indexOf("=");
      if (i > 0) {
        try { o[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); } catch (e) { o[p.slice(0, i)] = p.slice(i + 1); }
      }
    });
    return o;
  }

  var ARG = parseArg(typeof $argument !== "undefined" ? $argument : "");
  var KEY = $persistentStore.read("qwen2or_key") || ARG.key || "";
  var MODEL = $persistentStore.read("qwen2or_model") || ARG.model || "openai/gpt-5.2";
  var MODE = ARG.mode || "auto";
  var UPSTREAM = ARG.upstream || "https://openrouter.ai/api/v1/chat/completions";
  var SYS = ARG.sys || "你是语音助手，只用口语短句回答，不超过三句，禁止 markdown、星号、井号、列表符号和 emoji。";

  var DRY = $persistentStore.read("qwen2or_dry");
  DRY = DRY === "1" ? "1" : (DRY === "0" ? "0" : (ARG.dry || "0"));
  if (!KEY || KEY.indexOf("TOKEN_HERE") >= 0) DRY = "1";
  if (MODE === "probe") DRY = "1";

  var req = $request;
  var url = req.url || "";
  var raw = req.body || "";
  var headers = {}, k;
  for (k in req.headers) headers[k] = req.headers[k];
  var ct = headers["Content-Type"] || headers["content-type"] || "";
  var host = headers.Host || headers.host || (url.match(/^https?:\/\/([^\/]+)/) || [])[1] || "";

  function trace(tag) {
    $persistentStore.write(tag.slice(0, 900), "qwen2or_last");
  }

  /* ---------- 非 JSON：原样放行，留痕 ---------- */
  var j = null;
  try { j = JSON.parse(raw); } catch (e) { j = null; }
  if (!j || typeof j !== "object") {
    trace("NONJSON " + host + " " + ct + " " + raw.length + "B :: " + raw.slice(0, 120).replace(/[\r\n]/g, " "));
    $notification.post("Qwen2OR", host + " 非JSON(" + ct + ")", raw.length + "B 未改写");
    $done({});
    return;
  }

  /* ---------- JSON：记录探测结果 ---------- */
  var peek = "";
  try {
    peek = JSON.stringify({ model: j.model, keys: Object.keys(j).slice(0, 12), msg: (j.messages && j.messages.length) || (j.prompt ? 1 : 0) }).slice(0, 160);
  } catch (e) { peek = "unserializable"; }
  trace((DRY === "1" ? "DRY " : "REW ") + host + " " + peek);

  if (DRY === "1") {
    $notification.post("Qwen2OR 探针", host + " JSON 命中", peek);
    $done({});
    return;
  }

  /* ---------- 改写 ---------- */
  j.model = MODEL;
  j.stream = typeof j.stream === "boolean" ? j.stream : true;
  j.temperature = 0.6;
  j.reasoning = { exclude: true };

  if (Array.isArray(j.messages)) {
    var last = null;
    for (var i = j.messages.length - 1; i >= 0; i--) {
      if (j.messages[i] && j.messages[i].role === "user") { last = j.messages[i].content; break; }
    }
    j.messages = [{ role: "system", content: SYS }];
    if (last != null) j.messages.push({ role: "user", content: last });
  }

  ["enable_thinking", "thinking_budget", "biz_id", "session_id", "request_id",
   "app_id", "api_key", "account_id", "device_id", "client_id"].forEach(function (f) {
    if (f in j) delete j[f];
  });

  var h = {};
  for (var n in headers) {
    var ln = n.toLowerCase();
    if (ln === "host" || ln === "authorization" || ln === "content-length" ||
        ln === "accept-encoding" || ln === "cookie" || ln === "x-apple-request-uuid") continue;
    h[n] = headers[n];
  }
  h["Host"] = "openrouter.ai";
  h["Authorization"] = "Bearer " + KEY;
  h["Content-Type"] = "application/json";
  h["HTTP-Referer"] = "https://openrouter.ai";
  h["X-Title"] = "Qwen2OR";
  h["Accept"] = "text/event-stream";

  $done({ url: UPSTREAM, headers: h, body: JSON.stringify(j) });
})();

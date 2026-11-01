# loon-rules

Loon 插件/规则统一收纳（由 Surge/Qx 转换，均收录于此）。

## 插件列表

| 文件 | 用途 | 安装 |
|---|---|---|
| `MT.plugin` | 美团去广告 | `https://cdn.jsdelivr.net/gh/ruiruizl/loon-rules@main/MT.plugin` |
| `muse2api-loon.plugin` | Muse2API 反代（api.openai.com → 自建 muse2api-http 网关） | `https://cdn.jsdelivr.net/gh/ruiruizl/loon-rules@main/muse2api-loon.plugin` |

## Muse2API 反代使用

1. 自建 muse2api-http 网关（iSH 或 VPS），得到公网地址（如 cloudflared 隧道 `https://xxx.trycloudflare.com/v1`）。
2. Loon → 插件 → 安装 `muse2api-loon.plugin`，参数里填 `网关地址`（含 /v1）和 `网关Key`。
3. 客户端（OpenCat/ChatBox 等）里 Base URL 填 `https://api.openai.com/v1`，Key 随便填，模型 `muse-spark`。
4. 原理：Loon MITM 劫持 `api.openai.com` 请求，脚本把 URL/Authorization 改写到你的网关，SSE 流式透传。

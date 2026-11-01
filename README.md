# Loon 规则集
Surge/Qx 规则转 Loon 插件合集。

## MT.plugin — 美团 App 去广告
- 上游：https://raw.githubusercontent.com/muktsoen/SurgeRules/main/MT.sgmodule（由 ZenmoFeiShi 的 Qx MT.snippet 转换）
- 拦截：shark 埋点 / httpdns / 巨量 IP 段（46 条）
- 脚本：MT.js 响应体去除首页、猜你喜欢、个人中心、搜索热词等广告位（8 个 http-response）
- 用量：Loon → 插件 → 通过 URL 添加 `https://raw.githubusercontent.com/ruiruizl/loon-rules/main/MT.plugin`，并配置 MITM 证书信任 / 开启脚本

# ASCS 免费 IPv6 节点 · 执行包

架构：客户端 →(VLESS+WS+TLS)→ Cloudflare →(隧道)→ cloudflared → Xray(127.0.0.1) → 公网
　　　客户端 →(Hysteria2 UDP/443)→ 服务器 IPv6 → Xray → 公网
IPv4-only 站点经 WARP(wireguard outbound) 出站。所有密钥在本机随机生成，只存在 `/etc/proxy/env`(600)。

## 顺序

1. 注册 → 领 Free 实例（Debian 13，$0，无卡）→ Running 后记下 IPv6 / SSH 用户名 / 密码
2. 面板 Console 登录 → `sudo -i` → 跑下面一行
3. （可选）有 Cloudflare 域名就换固定域名
4. 自检
5. 客户端导入订阅

## 2. 安装（控制台粘贴，一行）

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruiruizl/loon-rules@main/ascs/setup.sh -o /root/setup.sh || curl -fsSL https://raw.githubusercontent.com/ruiruizl/loon-rules/main/ascs/setup.sh -o /root/setup.sh; wc -c /root/setup.sh; bash -n /root/setup.sh && bash /root/setup.sh
```

预期：`XRAY_CONFIG_OK` → 四个服务 active → `HY2_TEST google: 204` → `SUB_URL=https://xxxx.trycloudflare.com/<随机>/sub` → `DONE`

## 3. 固定域名（可选）

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruiruizl/loon-rules@main/ascs/cfnamed.sh -o /root/cfnamed.sh && bash /root/cfnamed.sh node.example.com
```

Cloudflare 侧先建：Zero Trust → Networks → Tunnels → 新建 Cloudflared 隧道 →
Public Hostname：`node.example.com` → Service `HTTP` + `127.0.0.1:10086` → 复制令牌。
令牌在脚本里粘贴，不回显、不进进程列表。

## 4. 自检

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/ruiruizl/loon-rules@main/ascs/verify.sh -o /root/verify.sh && bash /root/verify.sh
```

## 5. 客户端

Shadowrocket / v2rayN / v2rayNG / NekoBox → 添加订阅 → 粘 SUB_URL → 更新。
出现 `ASCS-VLESS-CF`（无 IPv6 也能用）和 `ASCS-HY2`（需客户端有 IPv6）。

## 维护

```bash
systemctl status xray hysteria subweb cfnamed cfquick
python3 /etc/proxy/gen.py && systemctl restart xray hysteria   # 重生成订阅
rm /etc/proxy/env && bash /root/setup.sh                       # 换全部密钥
```

- 免费实例约 30 天要在面板点一下续期，否则回收。
- 临时隧道每次重启域名会变，订阅地址随之变；固定域名不受影响。
- HY2 自签证书（insecure=1），抗中间人弱于 VLESS-CF。

#!/bin/bash
# 第 3 步：把临时 tunnel 换成你自己的固定域名
# 用法：bash cfnamed.sh node.example.com
# 令牌从终端读，不回显、不进进程列表、不落 shell 历史
set -e
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
HOST=${1:?用法: bash cfnamed.sh node.example.com}
D=/etc/proxy
[ -d "$D" ] && [ -f "$D/gen.py" ] || { echo "先跑 setup.sh（$D 不存在或缺 gen.py）"; exit 1; }

read -rs -p "粘贴 Cloudflare 隧道令牌后回车: " T </dev/tty; echo
[ -n "$T" ] || { echo "令牌为空，退出"; exit 1; }
umask 077
echo "TUNNEL_TOKEN=$T" > "$D/cftoken"
chmod 600 "$D/cftoken"
unset T

systemctl disable --now cfquick >/dev/null 2>&1 || true

cat > /etc/systemd/system/cfnamed.service <<EOF
[Unit]
Description=Cloudflare named tunnel
After=network-online.target xray.service
[Service]
EnvironmentFile=/etc/proxy/cftoken
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate --edge-ip-version 6 run
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

echo "$HOST" > "$D/host"
python3 "$D/gen.py"
systemctl daemon-reload
systemctl enable --now cfnamed >/dev/null 2>&1
sleep 15

. "$D/env"
echo "cfnamed: $(systemctl is-active cfnamed)"
for i in 1 2 3 4 5 6; do
  code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "https://$HOST/$S/sub" || true)
  echo "  try$i https://$HOST/$S/sub -> $code"
  [ "$code" = 200 ] && break
  sleep 10
done
echo "SUB_URL=https://$HOST/$S/sub"

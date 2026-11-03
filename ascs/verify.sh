#!/bin/bash
# 第 4 步：装完自检。服务器上 root 执行：bash verify.sh
D=/etc/proxy
[ -f $D/env ] || { echo "没装过：$D/env 不存在"; exit 1; }
. $D/env; [ -f $D/ip6 ] && . $D/ip6
HOST=$(cat $D/host 2>/dev/null)

echo "== 服务"
for s in xray hysteria subweb cfquick cfnamed; do
  printf '  %-10s %s\n' "$s" "$(systemctl is-active $s 2>/dev/null)"
done
echo "== 监听"
ss -lntup 2>/dev/null | grep -E '10085|10086|10087|10808|:443' | awk '{print "  "$1, $5}'
echo "== 出站（经 xray + WARP，测 IPv4-only 站点）"
echo "  github  : $(curl -s -m 20 -o /dev/null -w '%{http_code}' -x socks5h://127.0.0.1:10808 https://github.com)"
echo "  cf google204: $(curl -s -m 20 -o /dev/null -w '%{http_code}' -x socks5h://127.0.0.1:10808 https://www.google.com/generate_204)"
echo "== 订阅"
echo "  本地 : $(curl -s -m 10 http://127.0.0.1:10087/$S/sub | wc -c | tr -d ' ') 字节"
if [ -n "$HOST" ]; then
  raw=$(curl -s -m 20 "https://$HOST/$S/sub")
  echo "  公网 : $(printf '%s' "$raw" | wc -c | tr -d ' ') 字节 (https://$HOST/$S/sub)"
  printf '%s' "$raw" | base64 -d 2>/dev/null | sed 's/^/    /'
else
  echo "  公网 : 还没 host（临时隧道未起或未切固定域名）"
fi
echo "== HY2 本机回环（需本机有公网 IPv6）"
cat > /tmp/hyc.yaml <<EOF
server: "[$IP6]:443"
auth: $H
tls:
  sni: www.bing.com
  insecure: true
socks5:
  listen: 127.0.0.1:1081
EOF
/usr/local/bin/hysteria client -c /tmp/hyc.yaml >/tmp/hyc.log 2>&1 &
HP=$!; sleep 4
echo "  hy2 -> google204: $(curl -s -m 20 -o /dev/null -w '%{http_code}' -x socks5h://127.0.0.1:1081 https://www.google.com/generate_204)"
kill $HP 2>/dev/null; rm -f /tmp/hyc.yaml
echo "== 密钥文件权限"
ls -l $D/env $D/cftoken 2>/dev/null

// 极简 KV 封装：走 Upstash / Vercel KV 的 REST 接口，零额外 npm 依赖。
// Vercel 上开通 KV(Redis) 后会自动注入 KV_REST_API_URL / KV_REST_API_TOKEN 两个环境变量。
const URL = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function cmd(args) {
  if (!URL || !TOKEN) throw new Error('KV 未配置：缺少 KV_REST_API_URL / KV_REST_API_TOKEN');
  const resp = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!resp.ok) throw new Error(`KV 请求失败: ${resp.status}`);
  const json = await resp.json();
  return json.result;
}

// 写入并设过期（秒）
async function setEx(key, value, ttlSeconds) {
  return cmd(['SET', key, value, 'EX', String(ttlSeconds)]);
}

// 读取；不存在返回 null
async function get(key) {
  return cmd(['GET', key]);
}

// 幂等占位：只有当 key 不存在时才写入，返回是否写入成功（用于 webhook 去重）
async function setNxEx(key, value, ttlSeconds) {
  const res = await cmd(['SET', key, value, 'NX', 'EX', String(ttlSeconds)]);
  return res === 'OK';
}

module.exports = { setEx, get, setNxEx };

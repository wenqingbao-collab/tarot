// 临时诊断接口：测试 KV 读写、列出已有报告、测试 DeepSeek 连通性。定位后删除。
const kv = require('../lib/kv');
const OpenAI = require('openai');

async function kvCmd(args) {
  const URL = process.env.KV_REST_API_URL, TOKEN = process.env.KV_REST_API_TOKEN;
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return (await r.json()).result;
}

module.exports = async function handler(req, res) {
  const out = {};

  // 1) KV 写+读
  try {
    await kv.setEx('debug:ping', 'pong', 60);
    out.kv = { ok: (await kv.get('debug:ping')) === 'pong' };
  } catch (e) { out.kv = { ok: false, error: e.message }; }

  // 2) 列出已有的 report:* key（看真实付款有没有生成过报告）
  try {
    const keys = await kvCmd(['KEYS', 'report:*']);
    out.reports = { count: (keys || []).length, sample: (keys || []).slice(0, 5) };
  } catch (e) { out.reports = { error: e.message }; }

  // 3) DeepSeek 连通性（小额调用）
  try {
    const ai = new OpenAI({
      apiKey: (process.env.DEEPSEEK_API_KEY || '').trim(),
      baseURL: 'https://api.deepseek.com',
    });
    const m = await ai.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 5,
      messages: [{ role: 'user', content: '说“好”' }],
    });
    out.deepseek = { ok: true, reply: m.choices[0].message.content };
  } catch (e) { out.deepseek = { ok: false, error: e.message, status: e.status }; }

  // env 存在性（不暴露值）
  out.env = {
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
  };

  return res.status(200).json(out);
};

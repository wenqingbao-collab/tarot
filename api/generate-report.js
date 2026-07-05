// 注意：报告的“生成”已移到 /api/webhook（付款验签成功后才生成）。
// 这个接口只负责“取报告”——前端付款回跳后凭 rid 来拉取。
// 伪造 rid 没有意义：只有真实、验签通过的付款才会在 KV 里写入 report:{rid}。
const kv = require('../lib/kv');

const ALLOWED_ORIGIN = process.env.SITE_ORIGIN || 'https://cyberarcana.org';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rid = req.query.rid;
  if (!rid) return res.status(400).json({ error: '缺少订单号' });

  try {
    const data = await kv.get(`report:${rid}`);
    if (!data) {
      // 还没生成好（webhook 通常几秒内完成），让前端轮询
      return res.status(202).json({ pending: true });
    }
    const report = typeof data === 'string' ? JSON.parse(data) : data;
    return res.status(200).json({ success: true, ...report });
  } catch (err) {
    console.error('get-report error:', err);
    return res.status(500).json({ error: '读取报告失败，请稍后重试' });
  }
};

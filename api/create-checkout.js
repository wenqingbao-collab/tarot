const { WaffoPancake } = require('@waffo/pancake-ts');
const crypto = require('crypto');

// 允许的前端来源（收紧 CORS，不再用 *）
const ALLOWED_ORIGIN = process.env.SITE_ORIGIN || 'https://cyberarcana.org';

// 智能清洗私钥：兼容粘贴时常见的坏法（首尾空白、包裹引号、\n 字面量、base64 编码）
function normalizePrivateKey(raw) {
  let k = (raw || '').trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  if (k.includes('\\n')) k = k.replace(/\\n/g, '\n'); // 字面量 \n → 真换行
  if (!k.includes('-----BEGIN')) {
    // 可能是 base64 编码的 PEM，尝试解码
    try {
      const decoded = Buffer.from(k, 'base64').toString('utf-8');
      if (decoded.includes('-----BEGIN')) k = decoded;
    } catch (_) { /* 保持原样，交给 SDK 判断 */ }
  }
  return k;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cards, question, name } = req.body || {};
  if (!cards || cards.length < 3 || !question) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const client = new WaffoPancake({
      // trim 掉复制粘贴时误带的首尾空白/换行（曾导致 Invalid merchantId ...\n）
      merchantId: (process.env.WAFFO_MERCHANT_ID || '').trim(),
      privateKey: normalizePrivateKey(process.env.WAFFO_PRIVATE_KEY),
    });

    // 本次占卜的唯一 ID：既作为回跳关联，也作为报告在 KV 里的 key
    const rid = 'rd_' + crypto.randomBytes(16).toString('hex');

    // 只把 AI 生成报告需要的字段放进 metadata（不含图片，避免超长）。
    // metadata 的值必须是字符串（SDK 类型 Record<string,string>）。
    const readingForAI = cards.slice(0, 3).map(c => ({
      n: c.n, isReversed: !!c.isReversed, up: c.up, rev: c.rev,
    }));

    const origin = req.headers.origin === ALLOWED_ORIGIN ? req.headers.origin : ALLOWED_ORIGIN;

    const session = await client.checkout.createSession({
      productId: (process.env.WAFFO_PRODUCT_ID || '').trim(),
      currency: 'USD',
      // successUrl 没有平台占位符机制，rid 由我们自己拼进 URL
      successUrl: `${origin}/?rid=${rid}`,
      // rid 也写进业务外部 ID，webhook 里会原样带回（orderMerchantExternalId）
      orderMerchantExternalId: rid,
      metadata: {
        rid,
        cards: JSON.stringify(readingForAI),
        question: String(question),
        name: String(name || ''),
      },
    });

    // 返回字段是 checkoutUrl（不是 url）
    return res.status(200).json({ url: session.checkoutUrl, rid });
  } catch (err) {
    console.error('create-checkout error:', err);
    // 临时调试：把真实错误暴露到响应里，定位后删除
    const rawPk = process.env.WAFFO_PRIVATE_KEY || '';
    return res.status(500).json({
      error: '创建支付失败，请稍后重试',
      _debug: {
        message: err && err.message,
        status: err && err.status,
        errors: err && err.errors,
        // 私钥安全指纹（不含密钥主体，仅暴露 PEM 头部/格式特征）
        pkLen: rawPk.length,
        pkHead: rawPk.slice(0, 30),
        pkHasBegin: rawPk.includes('-----BEGIN'),
        pkRealNewlines: (rawPk.match(/\n/g) || []).length,
        pkLiteralBackslashN: rawPk.includes('\\n'),
        pkQuoted: rawPk[0] === '"' || rawPk[0] === "'",
      },
    });
  }
};

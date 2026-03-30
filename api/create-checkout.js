const { WaffoPancake } = require('@waffo/pancake-ts');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cards, question, name } = req.body;
  if (!cards || !question) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const client = new WaffoPancake({
      merchantId: process.env.WAFFO_MERCHANT_ID,
      privateKey: process.env.WAFFO_PRIVATE_KEY,
    });

    const origin = req.headers.origin || 'https://cyberarcana.org';

    const session = await client.checkout.createSession({
      productId: process.env.WAFFO_PRODUCT_ID,
      successUrl: `${origin}?paid=1`,
      cancelUrl: `${origin}`,
      metadata: {
        cards: JSON.stringify(cards.map(c => ({
          n: c.n,
          isReversed: c.isReversed,
          up: c.up,
          rev: c.rev,
          img: c.img,
        }))),
        question,
        name: name || '',
      },
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('create-checkout error:', err);
    return res.status(500).json({ error: err.message || '创建支付失败，请稍后重试' });
  }
};

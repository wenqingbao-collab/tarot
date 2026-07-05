const { verifyWebhook, WebhookEventType } = require('@waffo/pancake-ts');
const OpenAI = require('openai');
const kv = require('../lib/kv');

// Webhook 必须读原始请求体来验签，关闭 Vercel 默认的 body 解析
module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function buildPrompt(cards, question, name) {
  return `你是一位神秘而睿智的塔罗占卜师。请为以下占卜结果生成一份完整的解读报告。

用户姓名：${name || '占卜者'}
用户的问题：${question}

抽到的三张牌：
- 过去（PAST）：${cards[0].n}（${cards[0].isReversed ? '逆位' : '正位'}）— ${cards[0].isReversed ? cards[0].rev : cards[0].up}
- 现在（PRESENT）：${cards[1].n}（${cards[1].isReversed ? '逆位' : '正位'}）— ${cards[1].isReversed ? cards[1].rev : cards[1].up}
- 未来（FUTURE）：${cards[2].n}（${cards[2].isReversed ? '逆位' : '正位'}）— ${cards[2].isReversed ? cards[2].rev : cards[2].up}

请生成一份结构化的深度解读报告，包含以下五个部分，每部分用对应标题开头：

【过去之牌解读】
【当下之牌解读】
【未来之牌解读】
【命运综合解读】
【星象建议】

语气：神秘、智慧、温暖，像一位真正的占卜师在引导用户认识自己。
每个部分150字左右，总计约800字。`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let event;
  try {
    const raw = await readRaw(req);
    // 签名头名字以 Waffo 后台/文档为准，这里同时兼容两种常见写法
    const sig = req.headers['x-waffo-signature'] || req.headers['x-signature'];
    event = verifyWebhook(raw, sig, { environment: 'test' }); // 上线改成 'prod'
  } catch (err) {
    console.error('webhook 验签失败:', err.message);
    return res.status(401).send('Invalid signature');
  }

  // 用投递记录 id 去重（Waffo 可能重发同一事件）
  const firstTime = await kv.setNxEx(`evt:${event.id}`, '1', 86400);
  if (!firstTime) return res.status(200).send('OK (dup)');

  try {
    if (event.eventType === WebhookEventType.OrderCompleted) {
      const md = event.data.orderMetadata || {};
      const rid = md.rid || event.data.orderMerchantExternalId;
      if (!rid) {
        console.error('webhook 缺少 rid，无法关联占卜');
        return res.status(200).send('OK (no rid)');
      }

      const cards = JSON.parse(md.cards || '[]');
      const question = md.question || '';
      const name = md.name || '';

      if (cards.length < 3) {
        console.error('webhook metadata 缺少牌面数据');
        return res.status(200).send('OK (no cards)');
      }

      const ai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
      });
      const msg = await ai.chat.completions.create({
        model: 'deepseek-chat',
        max_tokens: 1200,
        messages: [{ role: 'user', content: buildPrompt(cards, question, name) }],
      });
      const interpretation = msg.choices[0].message.content;

      // 按 rid 存报告，供前端回跳后来取（存 7 天）
      await kv.setEx(`report:${rid}`, JSON.stringify({
        interpretation, cards, question, name,
      }), 604800);
    }

    return res.status(200).send('OK');
  } catch (err) {
    // 已验签成功，但生成/存储出错：返回非 2xx 让 Waffo 重试
    console.error('webhook 处理出错:', err);
    return res.status(500).send('processing error');
  }
};

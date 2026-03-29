const OpenAI = require('openai');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cards, question, name } = req.body;
  if (!cards || cards.length < 3 || !question) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });

    const message = await client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `你是一位神秘而睿智的塔罗占卜师。请为以下占卜结果生成一份完整的解读报告。

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
每个部分150字左右，总计约800字。`,
      }],
    });

    const interpretation = message.choices[0].message.content;
    return res.status(200).json({ success: true, interpretation });

  } catch (err) {
    console.error('generate-report error:', err);
    return res.status(500).json({ error: err.message || '生成失败，请稍后重试' });
  }
};

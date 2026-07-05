// 一次性脚本：把线上 webhook 地址注册到 Waffo。
// 用法：先填好 STORE_ID 和环境变量，然后 `node scripts/register-webhook.js`
// 依赖 WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY 环境变量。
const { WaffoPancake } = require('@waffo/pancake-ts');

const STORE_ID = process.env.WAFFO_STORE_ID; // 形如 STO_xxx，从 Waffo 后台获取
const WEBHOOK_URL = (process.env.SITE_ORIGIN || 'https://cyberarcana.org') + '/api/webhook';

(async () => {
  if (!STORE_ID) throw new Error('请先设置 WAFFO_STORE_ID（STO_ 开头）');

  const client = new WaffoPancake({
    merchantId: process.env.WAFFO_MERCHANT_ID,
    privateKey: process.env.WAFFO_PRIVATE_KEY,
  });

  const res = await client.webhooks.add({
    storeId: STORE_ID,
    channel: 'http',
    url: WEBHOOK_URL,
    events: ['order.completed'], // 单次付费只需这一个事件
    testMode: true,              // 测试环境用 true；上线改成 false 重新注册一条
  });

  console.log('已注册 webhook:', WEBHOOK_URL);
  console.log(res);
})().catch(e => { console.error('注册失败:', e); process.exit(1); });

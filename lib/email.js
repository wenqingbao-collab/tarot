// 邮件发送：走 Resend REST API（零依赖，用原生 fetch）。
// 需要环境变量 RESEND_API_KEY；发信地址用 EMAIL_FROM（需在 Resend 验证 cyberarcana.org 域名）。
const POS = ['过去 · PAST', '现在 · PRESENT', '未来 · FUTURE'];

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildReportEmailHtml({ cards, question, name, interpretation }) {
  const cardsHtml = cards.slice(0, 3).map((c, i) => {
    const reversed = c.isReversed;
    const meaning = reversed ? c.rev : c.up;
    return `
      <td width="33%" valign="top" style="padding:8px;text-align:center;">
        <div style="font-size:11px;color:#8a7a55;letter-spacing:1px;margin-bottom:8px;">${esc(POS[i])}</div>
        ${c.img ? `<img src="${esc(c.img)}" width="90" alt="${esc(c.n)}" style="width:90px;border-radius:4px;border:1px solid rgba(212,175,55,.3);display:block;margin:0 auto 8px;">` : ''}
        <div style="font-size:13px;color:#d4af37;margin-bottom:4px;">${esc(c.n)}</div>
        <div style="font-size:12px;color:${reversed ? '#e07a7a' : '#79c67e'};margin-bottom:4px;">${reversed ? '⬇ 逆位' : '⬆ 正位'}</div>
        <div style="font-size:11px;color:#b8a878;line-height:1.5;">${esc(meaning)}</div>
      </td>`;
  }).join('');

  const interpHtml = String(interpretation || '').split('\n').filter(l => l.trim()).map(line =>
    line.trim().startsWith('【')
      ? `<div style="font-size:14px;color:#d4af37;letter-spacing:1px;margin:20px 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(212,175,55,.2);">${esc(line)}</div>`
      : `<p style="font-size:13px;line-height:1.9;color:#cdbd90;margin:0 0 8px;">${esc(line)}</p>`
  ).join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#05000f;">
  <div style="max-width:640px;margin:0 auto;background:#0a0018;padding:32px 28px;font-family:'Noto Serif SC',Georgia,serif;color:#e8d5a0;">
    <div style="text-align:center;border-bottom:1px solid rgba(212,175,55,.3);padding-bottom:20px;margin-bottom:20px;">
      <div style="font-size:24px;color:#d4af37;letter-spacing:6px;">✦ ARCANA ✦</div>
      <div style="font-size:11px;color:#7a6a48;letter-spacing:2px;margin-top:6px;">赛博巫师塔罗占卜系统 · 命运解读报告</div>
    </div>
    <div style="text-align:center;padding:14px;border:1px solid rgba(212,175,55,.2);border-radius:4px;background:rgba(212,175,55,.04);margin-bottom:20px;">
      <div style="font-size:15px;color:#d4af37;">「${esc(question)}」</div>
      ${name ? `<div style="font-size:12px;color:#7a6a48;margin-top:4px;">${esc(name)}</div>` : ''}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr>${cardsHtml}</tr></table>
    <div style="font-size:13px;color:#d4af37;letter-spacing:2px;text-align:center;margin-bottom:14px;">◈ 命运深度解读 ◈</div>
    ${interpHtml}
    <div style="margin-top:28px;text-align:center;font-size:10px;color:#4a3f28;letter-spacing:1px;border-top:1px solid rgba(212,175,55,.1);padding-top:14px;">
      塔罗的预测结果只是当下时刻对命运的线性近似 · 仅供娱乐 · 命由灵定 · 运在人为
    </div>
  </div>
</body></html>`;
}

// 发送报告邮件。无 RESEND_API_KEY 时优雅跳过（不报错），返回 {skipped}。
async function sendReportEmail(to, reading) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return { skipped: true, reason: 'no RESEND_API_KEY' };
  if (!to) return { skipped: true, reason: 'no recipient' };

  const from = (process.env.EMAIL_FROM || 'ARCANA <report@cyberarcana.org>').trim();
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: '✦ 你的命运解读报告 · ARCANA',
      html: buildReportEmailHtml(reading),
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Resend ${resp.status}: ${text}`);
  }
  return await resp.json();
}

module.exports = { sendReportEmail, buildReportEmailHtml };

// Al-Xorazmiy o'quv markazi — xabar roboti.
// Har ishga tushganda Markaz jurnali saytini bulutga ulangan holda ~3 daqiqa ochib turadi:
// navbatdagi Telegram xabarlarini yuboradi, test natijalarini, sabablar va vazifalarni qabul qiladi.
// Maxfiy kod (MARKAZ_KOD) faqat GitHub Secrets'da saqlanadi va hech qayerga yozilmaydi.
const { chromium } = require('playwright-core');

const SITE = process.env.SITE || 'https://jolly-druid-4a6460.netlify.app/';
const RUN_MS = +(process.env.RUN_MS || 170000);

(async () => {
  const code = (process.env.MARKAZ_KOD || '').trim();
  let cfg;
  try { cfg = JSON.parse(Buffer.from(code.replace(/^MRK/, ''), 'base64').toString('utf8')); } catch (e) {}
  if (!cfg || !cfg.u || !cfg.k) { console.log('❌ MARKAZ_KOD topilmadi yoki notoʻgʻri. Settings → Secrets → Actions ga qoʻshing.'); process.exit(1); }

  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ timezoneId: 'Asia/Tashkent', userAgent: 'MarkazRobot (Linux) kompyuter' });
  await ctx.addInitScript(([url, key, tg]) => {
    window.__ROBOT__ = 1;
    if (tg) window.__TGBASE__ = tg;
    try { localStorage.setItem('markaz-cloud', JSON.stringify({ url, key })); } catch (e) {}
  }, [cfg.u, cfg.k, process.env.TGBASE || '']);
  const page = await ctx.newPage();
  let errs = 0;
  page.on('pageerror', () => { errs++; });
  await page.goto(SITE, { waitUntil: 'load', timeout: 60000 });

  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < RUN_MS) {
    await page.waitForTimeout(10000);
    try { last = await page.evaluate(() => { const S = window.__getS && __getS(); return S ? { ob: (S.outbox || []).length, ok: !!S.token } : null; }); } catch (e) {}
  }
  // navbat boʻshaguncha yana biroz kutamiz (koʻpi bilan 60 soniya)
  for (let i = 0; i < 6 && last && last.ob > 0; i++) {
    await page.waitForTimeout(10000);
    try { last = await page.evaluate(() => ({ ob: (__getS().outbox || []).length, ok: !!__getS().token })); } catch (e) {}
  }
  await page.waitForTimeout(8000); // bulutga saqlanishi uchun
  console.log(last ? `✅ Robot ishladi. Navbatda qolgan xabarlar: ${last.ob}. Telegram bot: ${last.ok ? 'ulangan' : 'ulanmagan'}. Sahifa xatolari: ${errs}` : '⚠️ Ilova yuklanmadi');
  await browser.close();
})().catch(e => { console.log('❌ Xato: ' + (e && e.message ? e.message.split('\n')[0] : 'nomaʼlum')); process.exit(1); });

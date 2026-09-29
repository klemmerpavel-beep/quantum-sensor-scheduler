// Печать презентации src/deck.html в ../report.pdf (страницы 1280×720) через Chromium (Playwright).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + path.join(__dirname, 'deck.html'));
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(__dirname, '..', 'report.pdf'), width: '1280px', height: '720px',
                   printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('report.pdf — готово');
})();

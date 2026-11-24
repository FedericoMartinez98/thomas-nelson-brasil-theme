// Screenshots of the built preview. Usage: node scripts/shoot.js [page ...]
const { chromium } = require('playwright');
const path = require('path');
const pages = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const desk = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const mob = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  for (const p of pages) {
    const [file, mode] = p.split(':');
    const pg = mode === 'm' ? mob : desk;
    await pg.goto('file://' + path.join(__dirname, '..', 'dist', file + '.html'));
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
    await pg.waitForTimeout(700);
    await pg.screenshot({ path: path.join(__dirname, '..', 'shots', file + (mode === 'm' ? '-mobile' : '') + '.png'), fullPage: true });
  }
  await b.close();
})();

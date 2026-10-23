// Tarayıcı (arayüz) testleri — denetim raporundaki maddeleri gerçek Chromium'da doğrular.
// Gereksinim: Playwright ve Chromium.  npm i -D playwright && npx playwright install chromium
// Çalıştırma: node --test tools/test/arayuz.test.mjs
// (Playwright başka bir yerde kuruluysa: PLAYWRIGHT_MODULE=/yol/node_modules/playwright/index.js)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP = pathToFileURL(path.join(ROOT, 'index.html')).href;

// Not: node:test, üst düzey await sonrasında kaydedilen testleri çalıştırmaz; bu yüzden Playwright
// "before" içinde yüklenir ve kurulu değilse her test atlanır.
let browser = null;
before(async () => {
  try {
    const modPath = process.env.PLAYWRIGHT_MODULE;
    const mod = modPath ? await import(pathToFileURL(modPath).href) : await import('playwright');
    const chromium = mod.chromium || (mod.default && mod.default.chromium);
    browser = await chromium.launch();
  } catch (e) {
    browser = null;
  }
});
after(async () => { if (browser) await browser.close(); });

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, offline: true, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(APP);
  await page.waitForFunction(() => typeof results !== 'undefined' && results !== null);
  return { ctx, page, errors };
}
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const t = (name, fn) => test(name, async (tc) => { if (!browser) { tc.skip('Playwright kurulu değil'); return; } await fn(); });

t('çevrimdışı açılış: stil ve tüm ikonlar gömülü, hata yok (A-9)', async () => {
  const { ctx, page, errors } = await open();
  await page.evaluate(() => loadSampleProject()); await settle(page);
  const r = await page.evaluate(() => {
    const ids = new Set([...document.querySelectorAll('symbol')].map(s => s.id));
    const missing = [...document.querySelectorAll('use')].map(u => u.getAttribute('href').slice(1)).filter(h => !ids.has(h));
    return { bg: getComputedStyle(document.querySelector('header')).backgroundColor, missing: [...new Set(missing)] };
  });
  assert.equal(r.bg, 'rgb(15, 23, 42)');
  assert.deepEqual(r.missing, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

t('K-1: örnek projede kollektör debisi alt pompa debilerinin toplamı', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => loadSampleProject()); await settle(page);
  const r = await page.evaluate(() => {
    const id = x => state.rows.find(r => r.id === x).uid;
    return { kol: results.per[id('KOL-1')].flowLs, p1: results.per[id('P-1')].flowLs, p2: results.per[id('P-2')].flowLs };
  });
  assert.ok(Math.abs(r.kol - (r.p1 + r.p2)) < 1e-12);
  await ctx.close();
});

t('K-2: üst hat olarak alt dal seçilemez; döngü oluşmaz', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => loadSampleProject()); await settle(page);
  const inp = page.locator(`[data-key="${await page.evaluate(() => state.rows.find(r => r.id === 'P-1').uid)}:parent"]`);
  await inp.fill('H-1.1A'); await inp.press('Tab'); await settle(page);
  const r = await page.evaluate(() => ({ parent: state.rows.find(r => r.uid === state.rows.find(x => x.id === 'P-1').parentUid)?.id, toast: document.getElementById('toast').textContent, kw: results.totals.kw }));
  assert.equal(r.parent, 'KOL-1');
  assert.match(r.toast, /döngü/);
  assert.equal(r.kw, 185);
  await ctx.close();
});

t('K-3: silmeden sonra çocuk ID çakışmaz; kullanılan ID verilemez', async () => {
  const { ctx, page } = await open();
  const ids = await page.evaluate(async () => {
    addNode('pompa'); await new Promise(r => setTimeout(r, 30));
    const p = state.rows[0];
    addChildNode(p.uid); addChildNode(p.uid);
    deleteNode(state.rows.find(r => r.id === 'P-1.1').uid);
    addChildNode(p.uid);
    return state.rows.map(r => r.id);
  });
  assert.equal(new Set(ids).size, ids.length, ids.join(','));
  await settle(page);
  const uid = await page.evaluate(() => state.rows[1].uid);
  const inp = page.locator(`[data-key="${uid}:id"]`);
  await inp.fill('P-1'); await inp.press('Tab'); await settle(page);
  assert.notEqual(await page.evaluate(u => state.rows.find(r => r.uid === u).id, uid), 'P-1');
  await ctx.close();
});

t('K-4: PDF raporu A4 yataya sığar ve tüm sonuç sütunlarını içerir', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => loadSampleProject()); await settle(page);
  await page.evaluate(() => buildPrintReport());
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 1060, height: 1400 });
  const r = await page.evaluate(() => {
    const rep = document.getElementById('printReport');
    const tables = [...rep.querySelectorAll('table')];
    const head = [...rep.querySelectorAll('h2')].find(h => /Hidrolik hesap tablosu/.test(h.textContent)).nextElementSibling.nextElementSibling;
    return { maxW: Math.max(...tables.map(t => t.scrollWidth)), repW: rep.clientWidth, cols: [...head.querySelectorAll('th')].map(th => th.textContent), appHidden: getComputedStyle(document.getElementById('app')).display };
  });
  assert.equal(r.appHidden, 'none');
  assert.ok(r.maxW <= r.repW + 1, `tablo ${r.maxW}px > sayfa ${r.repW}px`);
  for (const c of ['Q L/s', 'Çap', 'V m/s', 'R Pa/m', 'Lokal kPa', 'ΔP mSS']) assert.ok(r.cols.includes(c), c);
  const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
  assert.ok(pdf.length > 10000);
  await ctx.close();
});

t('K-5: açık sistemde Hm yalnız uçta; mod değişiminde bayat debi kullanılmaz', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { setSystemMode('open'); }); await settle(page);
  await page.evaluate(() => loadSampleProject()); await settle(page);
  const r = await page.evaluate(() => {
    const k = state.rows.find(r => r.id === 'K-1');
    return { kHm: results.per[k.uid].hmApplied, disabled: document.querySelector(`[data-key="${k.uid}:hm"]`) === null,
      need: results.system.requiredM, booster: results.system.headM, supply: state.settings.supplyHeadMss, rho: results.fluid.rho };
  });
  assert.equal(r.kHm, 0);
  assert.ok(r.disabled, 'ara hatta Hm girişi kapalı');
  // booster (m akışkan) = gerekli − mevcut basınç (mSS su sütunu → akışkan metresi)
  assert.ok(Math.abs(r.booster - Math.max(0, r.need - r.supply * 1000 / r.rho)) < 1e-9);
  // kapalı devrede eklenen hat açık sisteme geçince eski kW debisini taşımaz
  const q = await page.evaluate(async () => {
    state.rows = []; setSystemMode('closed'); addNode('pompa'); await new Promise(r => setTimeout(r, 30));
    setSystemMode('open'); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return results.per[state.rows[0].uid].flowLs;
  });
  assert.equal(q, 0);
  await ctx.close();
});

t('K-6: bozuk özel kütüphane kaydı uygulamayı kilitlemez', async () => {
  const { ctx, page, errors } = await open();
  for (const bad of ['null', '{"a":1}', '[{"calcType":"zeta","val":1}]', 'çöp{']) {
    await page.evaluate(v => localStorage.setItem('mekanik_custom_fittings_v2', v), bad);
    await page.reload(); await page.waitForFunction(() => results);
    await page.evaluate(() => loadSampleProject()); await settle(page);
    assert.ok(await page.locator('.accordion-row').count() >= 1, bad);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

t('K-7: tırnak ve özel karakterli adlar bozulmaz', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => addNode('boru')); await settle(page);
  const uid = await page.evaluate(() => state.rows[0].uid);
  const name = `Kolon 1 1/4" hattı <b>x</b> 'y'`;
  const inp = page.locator(`[data-key="${uid}:name"]`);
  await inp.fill(name); await inp.press('Tab'); await settle(page);
  assert.equal(await inp.inputValue(), name);
  const idIn = page.locator(`[data-key="${uid}:id"]`);
  await idIn.fill("H'1"); await idIn.press('Tab'); await settle(page);
  await page.locator(`[data-act="add-child"][data-uid="${uid}"]`).click(); await settle(page);
  assert.equal(await page.evaluate(() => state.rows[1].id), "H'1.1");
  await ctx.close();
});

t('K-9: boru hatları paralel eklenir, girilen pompa yükü korunur', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    addNode('pompa'); await new Promise(r => setTimeout(r, 20));
    state.rows[0].kw = 250;
    addNode('boru'); addNode('boru'); addNode('boru');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { parents: state.rows.slice(1).map(r => r.parentUid === state.rows[0].uid), total: results.per[state.rows[0].uid].kwTotal };
  });
  assert.deepEqual(r.parents, [true, true, true]);
  assert.equal(r.total, 250 + 30 + 30);
  await ctx.close();
});

t('K-10: CSV Türkçe Excel biçiminde (; ve virgül), tırnaklar kaçışlı', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { loadSampleProject(); state.rows[0].name = 'Kollektör 5" "ana"'; }); await settle(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportCSV())]);
  const txt = readFileSync(await dl.path(), 'utf8');
  assert.ok(txt.startsWith('﻿'));
  assert.match(txt, /"Kollektör 5"" ""ana"""/);
  assert.match(txt, /;2,\d{4};/);
  assert.doesNotMatch(txt.split('\n')[1], /;\d+\.\d+;/);
  await ctx.close();
});

t('A-1: 400 hatta tek düzenleme hızlı; DOM boyutu doğrusal', async () => {
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    addNode('kollektor'); await raf();
    const kol = state.rows[0];
    for (let i = 0; i < 399; i++) state.rows.push(makeRow({ id: 'H-' + i, parentUid: i < 10 ? kol.uid : state.rows[1 + (i % 10)].uid, kw: 10, length: 10, sizeCode: 'DN25',
      fittings: [{ uid: newUid(), name: 'Dirsek', calcType: 'zeta', val: 0.75, qty: 4 }, { uid: newUid(), name: 'Radyatör', calcType: 'kpa', val: 5, qty: 1 }] }));
    ui.rowOrderKey = ''; renderNow(); document.body.offsetHeight; await raf();   // ilk tam çizim ölçüme dahil edilmez
    const row = state.rows[50];
    const el = document.querySelector(`[data-key="${row.uid}:length"]`);
    el.value = '13';
    const t0 = performance.now();
    el.dispatchEvent(new Event('change', { bubbles: true }));
    renderNow(); document.body.offsetHeight;
    return { ms: performance.now() - t0, dom: document.getElementsByTagName('*').length, options: document.querySelectorAll('#calcTable option').length };
  });
  assert.ok(r.ms < 600, `${r.ms} ms`);
  assert.ok(r.options < 400 * 30, `${r.options} option`);
  await ctx.close();
});

t('A-2: Tab ve Enter ile odak korunur', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => loadSampleProject()); await settle(page);
  const uids = await page.evaluate(() => results.order);
  const a = page.locator(`[data-key="${uids[3]}:length"]`);
  await a.fill('19'); await page.keyboard.press('Tab'); await settle(page);
  assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  await a.click(); await a.fill('20'); await page.keyboard.press('Enter'); await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.key), `${uids[4]}:length`);
  assert.equal(await page.evaluate(u => state.rows.find(r => r.uid === u).length, uids[3]), 20);
  await ctx.close();
});

t('A-4: ağaç katlanır, PDF şeması ayarı yerleşim değişiminde kaybolmaz', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => loadSampleProject()); await settle(page);
  const before = await page.locator('#cssTreeBody .sys-node-card').count();
  await page.locator('#cssTreeBody [data-act="tree-toggle"]').nth(1).click(); await settle(page);
  assert.ok(await page.locator('#cssTreeBody .sys-node-card').count() < before);
  await page.locator('#chkPrintTree').uncheck(); await settle(page);
  await page.evaluate(() => setTreeLayout('side')); await settle(page);
  await page.evaluate(() => buildPrintReport());
  assert.equal(await page.locator('#printReport .tree-wrap').count(), 0);
  assert.equal(await page.evaluate(() => state.settings.printIncludeTree), false);
  await ctx.close();
});

t('A-5 / A-6: KPI ikonu sıfırlanır; hızlı hesapta sıfır debi öneri üretmez', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { addNode('boru'); }); await settle(page);
  await page.evaluate(() => { state.rows[0].sizeCode = 'DN15'; state.rows[0].kw = 100; scheduleRender(); }); await settle(page);
  assert.match(await page.locator('#kpi4Icon').getAttribute('class'), /red/);
  await page.evaluate(() => { state.rows = []; scheduleRender(); }); await settle(page);
  assert.doesNotMatch(await page.locator('#kpi4Icon').getAttribute('class'), /red/);
  await page.evaluate(() => { switchTab('tabQuick'); document.getElementById('qcPower').value = '0'; runQuickCalculator(); });
  assert.equal(await page.locator('#qcRecLabel').textContent(), '—');
  await ctx.close();
});

t('A-8: otomatik kayıt, yeniden açılış ve geri al', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => loadSampleProject()); await settle(page);
  await page.waitForTimeout(600);
  await page.reload(); await page.waitForFunction(() => results);
  assert.equal(await page.evaluate(() => state.rows.length), 7);
  await page.evaluate(() => deleteNode(state.rows.find(r => r.id === 'H-2.1').uid)); await settle(page);
  assert.equal(await page.evaluate(() => state.rows.length), 6);
  await page.keyboard.press('Control+z'); await settle(page);
  assert.equal(await page.evaluate(() => state.rows.length), 7);
  await ctx.close();
});

t('M-9: metraj — kollektör ayrı, otomatik te/redüksiyon, cihazlar ayrı', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { loadSampleProject(); switchTab('tabBom'); }); await settle(page);
  const txt = await page.locator('#bomBody').innerText();
  assert.match(txt, /Kollektörler/);
  assert.match(txt, /Branşman te/);
  assert.match(txt, /Fan Coil Batarya Direnci/);
  await ctx.close();
});

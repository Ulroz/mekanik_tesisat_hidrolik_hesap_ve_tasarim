// Hesap motoru testleri: index.html içindeki <script id="hesap-motoru"> bloğunu Node'da çalıştırır.
// Çalıştırma: node --test tools/test/motor.test.mjs   (ek paket gerekmez)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(process.env.MOTOR_HTML || path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/<script id="hesap-motoru">([\s\S]*?)<\/script>/);
if (!m) throw new Error('hesap-motoru bloğu bulunamadı');
const ctx = vm.createContext({ console, Math, crypto: globalThis.crypto });
vm.runInContext(m[1] + '\n;globalThis.__M = { GRAVITY, RHO_REF, PIPE_STANDARDS, FLUIDS, SIMULTANEITY, fluidProps, frictionFactor, colebrookWhite, segmentHydraulics, kvToZeta, getPipeSpec, evaluateStatus, findOptimalSize, peakFlow, makeRow, normalizeProject, validateLibraryItems, mergeSettings, defaultSettings, solveProject, computeBom, isInSubtree, nextChildId, uniqueIdIn, breakCycles };', ctx);
const M = ctx.__M;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} beklenen ${b} ± ${tol}, bulunan ${a}`);
const row = (o) => M.makeRow(o);
const settings = (o = {}) => Object.assign(M.defaultSettings(), o);

function sampleClosed() {
  const kol = row({ id: 'KOL-1', type: 'kollektor', pipeType: 'steel_din2440', sizeCode: 'DN125', length: 3 });
  const p1 = row({ id: 'P-1', type: 'pompa', parentUid: kol.uid, sizeCode: 'DN50', length: 6 });
  const h11 = row({ id: 'H-1.1', parentUid: p1.uid, sizeCode: 'DN50', length: 24 });
  const a = row({ id: 'H-1.1A', parentUid: h11.uid, kw: 55, dt: 20, pipeType: 'pprc_pn20', sizeCode: 'Ø50', length: 18 });
  const b = row({ id: 'H-1.1B', parentUid: h11.uid, kw: 70, dt: 20, sizeCode: 'DN40', length: 32,
    fittings: [{ uid: 'f1', name: 'Fan Coil', calcType: 'kpa', val: 20, qty: 1 }] });
  const p2 = row({ id: 'P-2', type: 'pompa', parentUid: kol.uid, sizeCode: 'DN40', length: 5 });
  const h21 = row({ id: 'H-2.1', parentUid: p2.uid, kw: 60, dt: 15, sizeCode: 'DN40', length: 14,
    fittings: [{ uid: 'f2', name: 'Boyler', calcType: 'kpa', val: 18, qty: 1 }] });
  return { rows: [kol, p1, h11, a, b, p2, h21], kol, p1, h11, a, b, p2, h21 };
}

test('su özellikleri: 70 °C ve 10 °C', () => {
  const w70 = M.fluidProps({ type: 'water', tempC: 70 });
  near(w70.rho, 977.9, 0.05); near(w70.cp, 4.190, 0.001); near(w70.nu * 1e6, 0.413, 0.001);
  const w75 = M.fluidProps({ type: 'water', tempC: 75 });
  assert.ok(w75.rho < 977.9 && w75.rho > 971.9);
  const g = M.fluidProps({ type: 'meg30', tempC: -30 });
  assert.ok(g.warnings.length >= 1, 'tablo dışı sıcaklık uyarısı');
});

test('K-1: farklı ΔT\'li alt devrelerde üst hat debisi = alt debilerin toplamı', () => {
  const s = sampleClosed();
  const r = M.solveProject(s.rows, settings());
  const q = u => r.per[u.uid].flowLs;
  near(q(s.kol), q(s.p1) + q(s.p2), 1e-12, 'kollektör debisi');
  near(r.per[s.kol.uid].kwTotal, 185, 1e-9);
  const f = r.fluid;
  near(q(s.h21), 60 / (f.cp * 15) * 1000 / f.rho, 1e-12);
  // eski hatalı yaklaşım (185 kW / ΔT20) ile fark ~%10
  const wrong = 185 / (f.cp * 20) * 1000 / f.rho;
  assert.ok(q(s.kol) > wrong * 1.09);
  // etkin ΔT gösterimi
  near(r.per[s.kol.uid].dtEff, 185 / (f.cp * q(s.kol) * f.rho / 1000), 1e-9);
});

test('K-8: sürtünme faktörü süreklidir, Colebrook yakınsar', () => {
  const e = 0.001;
  const a = M.frictionFactor(2299.999, e).f, b = M.frictionFactor(2300, e).f;
  near(a, b, 1e-6, 'Re=2300 sürekliliği');
  const c = M.frictionFactor(3999.999, e).f, d = M.frictionFactor(4000, e).f;
  near(c, d, 1e-6, 'Re=4000 sürekliliği');
  assert.equal(M.frictionFactor(3000, e).regime, 'gecis');
  for (const [re, rr] of [[4000, 0.05], [1e8, 0], [1e5, 1e-4]]) {
    const f = M.colebrookWhite(re, rr);
    near(1 / Math.sqrt(f) + 2 * Math.log10(rr / 3.7 + 2.51 / (re * Math.sqrt(f))), 0, 1e-9, `Colebrook kalıntısı Re=${re}`);
  }
});

test('Kv → ζ dönüşümü: Kv=10, 5 m³/h → 25 kPa × ρ/1000', () => {
  const fluid = M.fluidProps({ type: 'water', tempC: 20 });
  const dIn = 42.4 - 2 * 3.25;
  const h = M.segmentHydraulics(5 / 3.6, dIn, 0.045, fluid);
  near(M.kvToZeta(10, dIn) * h.dynPa / 1000, 25 * fluid.rho / 1000, 1e-6);
});

test('M-1: otomatik çap R_maks ve hız kriterini birlikte sağlar', () => {
  const fluid = M.fluidProps({ type: 'water', tempC: 70 });
  const c = M.defaultSettings().criteria.closed;
  for (const q of [0.05, 0.2, 0.5, 1, 2, 5, 15]) {
    const { code, satisfied } = M.findOptimalSize('steel_din2440', q, 'boru', c, fluid);
    const s = M.PIPE_STANDARDS.steel_din2440.sizes.find(x => x.code === code);
    const h = M.segmentHydraulics(q, s.dOut - 2 * s.t, 0.045, fluid);
    assert.ok(satisfied);
    assert.ok(h.rPaM <= c.rMax + 1e-9, `R ${h.rPaM} @ ${q}`);
    assert.ok(h.v <= (s.dn <= 50 ? 1.0 : 1.5) + 1e-9);
  }
  // kollektör hedef hızı
  const k = M.findOptimalSize('steel_din2440', 2.5, 'kollektor', c, fluid);
  const ks = M.PIPE_STANDARDS.steel_din2440.sizes.find(x => x.code === k.code);
  assert.ok(M.segmentHydraulics(2.5, ks.dOut - 2 * ks.t, 0.045, fluid).v <= c.vCollIdeal);
});

test('M-2: tek yön modunda sürtünme ve ζ ×2, cihaz ve Kv ×1', () => {
  const s = sampleClosed();
  s.b.fittings.push({ uid: 'z', name: 'Dirsek', calcType: 'zeta', val: 1, qty: 1 }, { uid: 'k', name: 'Vana', calcType: 'kv', val: 10, qty: 1 });
  const r1 = M.solveProject(s.rows, settings({ lengthMode: 'total' }));
  const r2 = M.solveProject(s.rows, settings({ lengthMode: 'oneway' }));
  const a = r1.per[s.b.uid], b = r2.per[s.b.uid];
  near(b.frictionPa, 2 * a.frictionPa, 1e-9);
  near(b.fit.z.lossPa, 2 * a.fit.z.lossPa, 1e-9);
  near(b.fit.k.lossPa, a.fit.k.lossPa, 1e-9);
  near(b.fit.f1.lossPa, a.fit.f1.lossPa, 1e-9);
});

test('M-4: pompa zonları ayrık; sistem değeri en yüksek zon', () => {
  const s = sampleClosed();
  const r = M.solveProject(s.rows, settings());
  const z1 = r.zones.find(z => z.id === 'P-1');
  const per = r.per;
  near(z1.headPa, per[s.p1.uid].segPa + per[s.h11.uid].segPa + Math.max(per[s.a.uid].segPa, per[s.b.uid].segPa), 1e-6);
  assert.ok(!z1.pathUids.includes(s.kol.uid), 'kollektör pompa zonuna eklenmez');
  const top = Math.max(...r.zones.filter(z => z.hasPump).map(z => z.headPa));
  near(r.system.headPa, top, 1e-9);
  near(r.system.selectHeadM, r.system.headM * 1.1, 1e-9);
  // basma yüksekliği gerçek yoğunlukla: H = Δp / (ρ g)
  near(z1.headM, z1.headPa / (r.fluid.rho * M.GRAVITY), 1e-12);
});

test('M-3: balans fazlası ve vana yetkisi', () => {
  const s = sampleClosed();
  s.a.fittings.push({ uid: 'cv', name: 'Motorlu vana', calcType: 'kv', val: 4, qty: 1, role: 'control' });
  const r = M.solveProject(s.rows, settings());
  const pa = r.per[s.a.uid], pb = r.per[s.b.uid];
  const hi = Math.max(pa.subtreePa, pb.subtreePa);
  near(pa.excessPa, hi - pa.subtreePa, 1e-9);
  near(pb.excessPa, hi - pb.subtreePa, 1e-9);
  const a = pa.fit.cv.authority;
  near(a, pa.fit.cv.lossPa / (pa.subtreePa + pa.excessPa), 1e-12);
});

test('seri (ayrık olmayan) pompa üst zona dahil edilir', () => {
  const s = sampleClosed();
  s.p2.pumpDecoupled = false;
  const r = M.solveProject(s.rows, settings());
  near(r.per[s.kol.uid].subtreePa, r.per[s.kol.uid].segPa + r.per[s.p2.uid].subtreePa, 1e-9);
});

test('K-2: döngü kırılır, sonsuz büyüme yok', () => {
  const a = row({ id: 'A', kw: 10 }); const b = row({ id: 'B', kw: 10, parentUid: a.uid });
  a.parentUid = b.uid;
  const r1 = M.solveProject([a, b], settings());
  const r2 = M.solveProject([a, b], settings());
  assert.equal(r1.order.length, 2);
  near(r1.totals.kw, r2.totals.kw, 0);
  assert.ok(r1.warnings.some(w => /döngü/.test(w.text)));
  assert.ok(M.isInSubtree([a, b], a.uid, b.uid));
});

test('K-3: çocuk ID üretimi silmeden sonra çakışmaz; içe aktarmada tekrarlar düzeltilir', () => {
  const p = row({ id: 'P-1', type: 'pompa' });
  const c2 = row({ id: 'P-1.2', parentUid: p.uid });
  assert.equal(M.nextChildId([p, c2], p), 'P-1.3');
  const np = M.normalizeProject({ rows: [{ id: 'X', uid: 'u1' }, { id: 'X', uid: 'u2' }, { id: 'Y', parentId: 'X' }] });
  assert.equal(JSON.stringify(np.rows.map(r => r.id)), JSON.stringify(['X', 'X-2', 'Y']));
  assert.equal(np.rows[2].parentUid, 'u1');
});

test('K-6: kütüphane doğrulaması bozuk veriyi ayıklar', () => {
  assert.equal(M.validateLibraryItems(null).length, 0);
  assert.equal(M.validateLibraryItems({ a: 1 }).length, 0);
  const v = M.validateLibraryItems([{ calcType: 'zeta', val: 1 }, { name: 'A', calcType: 'x', val: 1 }, { name: 'B', calcType: 'kv', val: '3' }, { name: 'b', calcType: 'kv', val: 2 }]);
  assert.equal(v.length, 1); assert.equal(v[0].val, 3);
});

test('eski proje dosyası: boru tipleri ve parentId göçü', () => {
  const np = M.normalizeProject({ rows: [{ id: 'A', pipeType: 'pex_pe100', sizeCode: 'Ø20' }, { id: 'B', parentId: 'A', pipeType: 'pprc_pn25', sizeCode: 'zzz' }] });
  assert.equal(np.rows[0].pipeType, 'pe100_sdr11');
  assert.equal(np.rows[1].pipeType, 'pprc_komp');
  assert.equal(np.rows[1].sizeCode, 'Ø20');
  assert.equal(np.rows[1].parentUid, np.rows[0].uid);
  assert.throws(() => M.normalizeProject(null));
});

test('M-8: DIN 1988-300 eşzamanlılık', () => {
  near(M.peakFlow(0.32, 0, 'din_konut'), 1.48 * Math.pow(0.32, 0.19) - 0.94, 1e-12);
  near(M.peakFlow(40, 0, 'din_otel'), 0.70 * Math.pow(40, 0.48) - 0.13, 1e-12);
  near(M.peakFlow(0.15, 0, 'din_konut'), 0.15, 1e-12);            // < 0.2 L/s → toplam
  near(M.peakFlow(0.3, 0.3, 'din_konut'), 0.3, 1e-12);            // tek armatür azaltılmaz
  near(M.peakFlow(5, 0, 'none'), 5, 0);
});

test('K-5: açık sistemde Hm yalnız uçta, kot her segmentte; şebeke basıncı düşülür', () => {
  const p = row({ id: 'P-1', type: 'pompa', pipeType: 'pprc_pn20', sizeCode: 'Ø63', length: 5, hz: 0, hm: 50 });
  const k = row({ id: 'K', parentUid: p.uid, pipeType: 'pprc_pn20', sizeCode: 'Ø50', length: 10, hz: 9, hm: 50 });
  const d = row({ id: 'D', parentUid: k.uid, pipeType: 'pprc_pn20', sizeCode: 'Ø25', length: 8, hz: 0, hm: 10,
    fixtures: [{ uid: 'x1', name: 'Lavabo', vr: 0.07, qty: 2 }, { uid: 'x2', name: 'Duş', vr: 0.15, qty: 1 }] });
  const s = settings({ systemMode: 'open', supplyHeadMss: 5 });
  const r = M.solveProject([p, k, d], s);
  assert.equal(r.per[p.uid].hmApplied, 0);
  assert.equal(r.per[k.uid].hmApplied, 0);
  assert.equal(r.per[d.uid].hmApplied, 10);
  const sumVR = 0.07 * 2 + 0.15;
  near(r.per[d.uid].flowLs, M.peakFlow(sumVR, 0.15, 'din_konut'), 1e-12);
  const req = r.per[p.uid].segPa + r.per[k.uid].segPa + r.per[d.uid].segPa;
  near(r.system.requiredPa, req, 1e-6);
  near(r.zones[0].headPa, req - 5 * 1000 * M.GRAVITY, 1e-6);
  const r2 = M.solveProject([p, k, d], settings({ systemMode: 'open', supplyHeadMss: 500 }));
  assert.equal(r2.zones[0].headPa, 0, 'şebeke yeterliyse pompa yüksekliği 0');
});

test('BOM: tek yön modunda metraj ×2, otomatik te ve redüksiyon', () => {
  const s = sampleClosed();
  const st = settings({ lengthMode: 'oneway' });
  const r = M.solveProject(s.rows, st);
  const bom = M.computeBom(s.rows, r);
  const total = bom.pipes.reduce((a, p) => a + p.length, 0);
  const expected = s.rows.filter(x => x.type !== 'kollektor').reduce((a, x) => a + x.length, 0) * 2;
  near(total, expected, 1e-9);
  assert.equal(bom.collectors.length, 1);
  assert.ok(bom.auto.some(a => a.name === 'Branşman te'));
  assert.equal(bom.pumps.length, 2);
});

test('kriterler sisteme göre ayrı; eski tek kriter seti kapalı devreye taşınır', () => {
  const d = M.defaultSettings();
  assert.equal(d.criteria.closed.rMax, 200);
  assert.equal(d.criteria.open.rMax, 0);
  const m = M.mergeSettings({ criteria: { vSmall: 0.8, rMax: 150 } });
  assert.equal(m.criteria.closed.vSmall, 0.8);
  assert.equal(m.criteria.closed.rMax, 150);
  assert.equal(m.criteria.open.vSmall, 1.5);
});

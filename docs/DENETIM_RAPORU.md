# Kod ve Mühendislik Denetim Raporu

İlk yüklenen `index.html` sürümü (2958 satır) satır satır incelenmiş, bulgular gerçek bir Chromium tarayıcısında (Playwright) senaryolarla test edilerek doğrulanmıştır. Satır numaraları (`L…`) bu ilk sürüme aittir. Düzeltilen maddeler `[x]` ile işaretlenir.

## Doğrulanan (doğru çalışan) kısımlar

| Konu | Sonuç |
|---|---|
| Debi formülü Q = kW/(c_p·ΔT)·1000/ρ (L1248) | Boyutsal olarak doğru; c_p (4.195 / 4.180 / 4.192) ve 1 kW = 859.845 kcal/h doğru |
| Colebrook-White çözümü (L1092) | Kararlı; 6 iterasyon sonrası kalıntı ≤ 1.3·10⁻⁶ |
| Kv → ζ dönüşümü ζ = 0.0016·d⁴/Kv² (d mm) | Doğru; Kv=10, 5 m³/h, DN32 → 24.3 kPa (= 25 kPa × ρ/1000) |
| DIN 2440, Sch 40, PPRC PN10/16/20, Cu ölçüleri | Standartlarla uyumlu |
| Tek ağaçta yapraktan köke kritik hat toplamı | Doğru |
| Akışkan özelliğinin gidiş sıcaklığında alınması | R üzerindeki etkisi < %1 (105.5 → 106.4 Pa/m), kabul edilebilir |

## 1. Kritik hatalar

- [ ] **K-1 — Farklı ΔT'li alt devrelerde kütle dengesi bozuluyor** (L1212–1251). Üst hattın debisi, toplanan kW'ın üst hattın kendi ΔT'sine bölünmesiyle bulunuyor. Örnek projede KOL-1 = 2.27 L/s; doğrusu P-1 + P-2 = 2.51 L/s (−%9.8). Çözüm: yaprak debilerini hesaplayıp **debiyi** aşağıdan yukarı toplamak.
- [ ] **K-2 — Döngüsel ebeveyn atanabiliyor** (L1575–1578). Üst hat listesi yalnızca satırın kendisini dışlıyor. Test: döngüde kW her render'da +20 artıyor (80→100→120…), ağaç şeması boşalıyor, kritik hat anlamsızlaşıyor. Çözüm: alt ağaçtaki satırları listeden ve `updateRowField` içinde reddetmek.
- [ ] **K-3 — Hat ID çakışması** (L2213–2215, L2267–2274). (a) `${parentId}.${childCount}` silmeden sonra çakışıyor: `['P-1','P-1.2','P-1.2']`. (b) Yeniden adlandırmada benzersizlik kontrolü yok: iki 20 kW pompa → ikisi de 40 kW, zon sayısı 2→1. Kalıcı çözüm: bağları `parentUid` ile kurmak, `id`'yi yalnızca etiket yapmak.
- [ ] **K-4 — PDF raporunda hesap sonuçları basılmıyor** (L467–469, L156–244). `overflow-hidden` + `whitespace-nowrap`; tablo 2076 px, A4 yatay ≈1060 px. Debi, boru tipi, çap, d_iç, hız, boy, R, lokal, Hat ΔP sütunları kesiliyor. Çözüm: yazdırmaya özel, düz metinli rapor tablosu.
- [ ] **K-5 — Açık sistem modeli** (L1283–1289, L1250). (a) Hz+Hm her segmentte toplanıyor; Hm yalnızca uç birimde anlamlı. (b) Mod değişince debi bayat kalıyor (200 kW pompa: kapalı 2.452 L/s, açık 0.740 L/s). (c) Şebeke/emme basıncı girilemiyor.
- [ ] **K-6 — LocalStorage verisi doğrulanmıyor** (L1058–1065). `'null'` veya `'{}'` kaydı → `customLibrary is not iterable`, akordeon açılınca uygulama çöküyor; `name`'siz kayıt `localeCompare` hatası veriyor.
- [ ] **K-7 — HTML kaçışı yok** (L1618, L1642, L1796, L1744). `Kolon 1 1/4" hattı` adı `Kolon 1 1/4` olarak kesiliyor; ID'deki `'` inline `onclick`'i bozuyor.
- [ ] **K-8 — Laminer/türbülans geçişinde süreksizlik** (L1092–1104). Re=2299 → f=0.0278, Re=2300 → 0.0481 (+%73). 2300–4000 arası interpolasyon ve uyarı gerekli.
- [ ] **K-9 — Kullanıcı girdisi sessizce eziliyor** (L2168–2172, L1226–1229). "Boru Hattı Ekle" her hattı son satırın altına bağlayarak seri zincir kuruyor; 250 kW girilen pompaya alt dal eklenince pompa 20 kW oluyor.
- [ ] **K-10 — CSV Türkçe Excel'de bozuk** (L2884–2947). `;` ayraç + `.` ondalık → sayılar tarih olarak okunuyor; `"` kaçışlanmıyor; BOM CSV'si DOM metninden (birimli) üretiliyor.

## 2. Mühendislik iyileştirmeleri

- [ ] **M-1 — Yalnızca hız kriteriyle çap seçimi** (L1146–1169). DN15 @ 1.0 m/s → R ≈ 867 Pa/m; DN50 @ 1.0 m/s → 192 Pa/m. Çift kriter (v_max(DN) ve R_max ≈ 150–250 Pa/m), DN'ye kademeli hız, alt hız uyarısı; otomatik seçim satırın özel ε/et kalınlığını da dikkate almalı.
- [ ] **M-2 — Gidiş-dönüş belirsizliği.** "Boy L" tek yön mü, gidiş+dönüş mü tanımsız; tek yön girilirse kayıplar %50 eksik. Proje bazında ×2 anahtarı (sürtünme, fittings ve metraj tutarlı).
- [ ] **M-3 — Pompa seçimi eksikleri.** Emniyet payı, kaynak tarafı dirençleri (kazan/eşanjör/chiller), vana yetkisi (a ≥ 0.5) ve kritik olmayan dallar için "kısılması gereken ΔP" (balans vanası ön ayarı) sütunu.
- [ ] **M-4 — Sistem kritik hat KPI'ı pompa sınırlarını aşıyor** (L1321–1341). KOL→P-1→… toplamı tek bir pompanın basması gereken değer değil; iç içe pompalarda dış pompanın yolu hesaplanmıyor (L1356–1371). KPI "en yüksek zon Hm" olmalı, primer devre ayrıca modellenmeli.
- [ ] **M-5 — Akışkan ve birim tutarlılığı.** Hm dönüşümü ρ=1000 ile (L1292, L1366): 80°C'de ≈%2.8 düşük. Glikol ve 60°C kullanım suyu seçeneği yok; sıcaklık girdisi + interpolasyon önerilir.
- [ ] **M-6 — Boru kütüphanesi.** PN25 satırları PN16 kopyası (L951–966); DN200–300 DIN 2440 kapsamında değil (EN 10220/10217); PEX ve PE100 ayrılmalı; eski çelik için ε = 0.1–0.2 mm seçeneği.
- [ ] **M-7 — Fittings kütüphanesi.** Te ζ referans hızı tanımsız; balans ve üç yollu vana Kv/Kvs ile tanımlanmalı; `mss` tipi listede "Kv=" görünüyor (L1767); ε=0 girilemiyor (L2463–2465).
- [ ] **M-8 — Açık sistemde eşzamanlılık yok.** TS EN 806-3 / DIN 1988-300 yük birimi yöntemi; yangın için TS EN 12845 / NFPA mantığı.
- [ ] **M-9 — BOM gruplaması.** Özel et kalınlığı yok sayılıyor (L2076); kollektör/pompa satırları boru metrajına karışıyor; cihazlar ve fittings aynı listede; redüksiyonlar çıkmıyor; açık modda pompa tablosu kW basıyor.

## 3. Arayüz ve performans

- [ ] **A-1 — Her değişiklikte tam yeniden çizim.** Ölçüm (1 düzenleme, layout dahil): 50 hat 0.53 s, 100 hat 0.71 s, 200 hat 4.0 s, 400 hat 8.5 s (204 bin DOM düğümü, 170 bin `<option>`). Ebeveyn listesi O(n²). Kısmi güncelleme, paylaşımlı seçici, BOM'u yalnızca sekmesi açıkken çizme.
- [ ] **A-2 — Odak kaybı.** Düzenleme sonrası Tab → odak `<body>`'ye gidiyor; klavyeyle seri veri girişi yapılamıyor.
- [ ] **A-3 — Sonuç sütunları ekran dışında.** 1600 px'te R, Lokal, Hat ΔP yatay kaydırma gerektiriyor; sabit (sticky) ID ve sonuç sütunu.
- [ ] **A-4 — Ağaç şeması.** Zon-kritik de sistem-kritik gibi kırmızı; `crit-group` kritik olmayan kardeşleri de boyuyor; katlama yok; "PDF Raporuna Ekle" kapalıyken yerleşim değişince ayar kayboluyor (L2809–2825).
- [ ] **A-5 — KPI.** "Temizle" sonrası hız ikonu kırmızı kalıyor (L1519–1521); `fa-shield-check` FA6 Free'de yok.
- [ ] **A-6 — Hızlı hesaplayıcı.** Debi 0 → "DN300, V=0.00" öneriliyor (L2737–2741); `qcBadge` hiç güncellenmiyor (L749); lejant renkleri uyumsuz.
- [ ] **A-7 — Onay dosyası standardı.** Fittings dökümü basılmıyor; kabuller bloğu, Hazırlayan/Kontrol/Onay alanı, revizyon no ve sayfa numarası yok; hız rozetleri renksiz basılıyor.
- [ ] **A-8 — Kalıcılık.** Sayfa yenilenince proje kayboluyor; "Temizle"/"Sil" onay sormuyor; JSON proje kaydet/aç, otomatik taslak, özel kütüphane yönetimi gerekli.
- [ ] **A-9 — Tailwind Play CDN** (L9, L18). Üretim için değil; internetsiz ortamda sayfa stilsiz açılıyor ve `tailwind is not defined` hatası veriyor. Derlenmiş, gömülü CSS ve sabit sürümler.

## Öncelik sırası

1. **Hemen:** K-4, K-1, K-3, K-2
2. **Aynı sprintte:** K-5, K-6, K-7, K-9, K-10, M-1, M-2
3. **Sonra:** A-1/A-2, A-8, M-3/M-4, M-8

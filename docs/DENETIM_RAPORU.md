# Kod ve Mühendislik Denetim Raporu

İlk yüklenen `index.html` sürümü (2958 satır) satır satır incelenmiş, bulgular gerçek bir Chromium tarayıcısında (Playwright) senaryolarla test edilerek doğrulanmıştır. Satır numaraları (`L…`) bu ilk sürüme aittir. Düzeltilen maddeler `[x]` ile işaretlenmiş, her maddenin altına yapılan çözüm ve onu doğrulayan test yazılmıştır.

**Durum:** 28 maddenin tamamı çözüldü. Doğrulama: `npm test` (hesap motoru, 17 test) ve `npm run test:ui` (Chromium'da arayüz, 16 test).

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

- [x] **K-1 — Farklı ΔT'li alt devrelerde kütle dengesi bozuluyor** (L1212–1251). Üst hattın debisi, toplanan kW'ın üst hattın kendi ΔT'sine bölünmesiyle bulunuyor. Örnek projede KOL-1 = 2.27 L/s; doğrusu P-1 + P-2 = 2.51 L/s (−%9.8). Çözüm: yaprak debilerini hesaplayıp **debiyi** aşağıdan yukarı toplamak.
  - **Çözüm:** Kapalı devrede uç hatların debisi P/(cp·ΔT·ρ) ile, üst hatların debisi alt hat **debilerinin toplamı** ile bulunur; üst hatta alt devrelerden hesaplanan etkin ΔT gösterilir. Örnek projede KOL-1 = 2.50 L/s (P-1 + P-2). *Test: motor K-1, arayüz K-1.*
- [x] **K-2 — Döngüsel ebeveyn atanabiliyor** (L1575–1578). Üst hat listesi yalnızca satırın kendisini dışlıyor. Test: döngüde kW her render'da +20 artıyor (80→100→120…), ağaç şeması boşalıyor, kritik hat anlamsızlaşıyor. Çözüm: alt ağaçtaki satırları listeden ve `updateRowField` içinde reddetmek.
  - **Çözüm:** Bağlar `parentUid` ile tutulur. Üst hat girişi kendi alt ağacındaki bir hattı reddeder (uyarı verir); dosyadan gelen döngüler `breakCycles` ile kırılır, çözücü de ayrıca döngü güvenlidir. *Test: motor K-2, arayüz K-2.*
- [x] **K-3 — Hat ID çakışması** (L2213–2215, L2267–2274). (a) `${parentId}.${childCount}` silmeden sonra çakışıyor: `['P-1','P-1.2','P-1.2']`. (b) Yeniden adlandırmada benzersizlik kontrolü yok: iki 20 kW pompa → ikisi de 40 kW, zon sayısı 2→1. Kalıcı çözüm: bağları `parentUid` ile kurmak, `id`'yi yalnızca etiket yapmak.
  - **Çözüm:** Hat numarası yalnızca etikettir; bağlar uid ile kurulur. Çocuk numarası boş olan ilk sıra numarasını alır (`nextChildId`), yeniden adlandırmada kullanılan numara reddedilir, dosyadaki tekrarlar `-2`, `-3` ile düzeltilir. *Test: motor K-3, arayüz K-3.*
- [x] **K-4 — PDF raporunda hesap sonuçları basılmıyor** (L467–469, L156–244). `overflow-hidden` + `whitespace-nowrap`; tablo 2076 px, A4 yatay ≈1060 px. Debi, boru tipi, çap, d_iç, hız, boy, R, lokal, Hat ΔP sütunları kesiliyor. Çözüm: yazdırmaya özel, düz metinli rapor tablosu.
  - **Çözüm:** Yazdırma için ekran tablosu yerine ayrı, düz metinli bir rapor (`#printReport`) üretilir; A4 yataya sığar ve tüm sonuç sütunlarını içerir. *Test: arayüz K-4 (sığma ölçümü + PDF üretimi).*
- [x] **K-5 — Açık sistem modeli** (L1283–1289, L1250). (a) Hz+Hm her segmentte toplanıyor; Hm yalnızca uç birimde anlamlı. (b) Mod değişince debi bayat kalıyor (200 kW pompa: kapalı 2.452 L/s, açık 0.740 L/s). (c) Şebeke/emme basıncı girilemiyor.
  - **Çözüm:** (a) Δz her segmentte, uç akış basıncı Hm yalnız uç hatlarda eklenir; ara hatlarda Hm girişi kapalıdır. (b) Açık sistem debisi kapalı devre kW'ından türetilmez; girilmemiş uçlar kırmızı işaretlenir ve uyarı verilir. (c) Ayarlarda mevcut giriş basıncı (şebeke/depo) girilir; booster = gerekli − mevcut. *Test: motor K-5, arayüz K-5.*
- [x] **K-6 — LocalStorage verisi doğrulanmıyor** (L1058–1065). `'null'` veya `'{}'` kaydı → `customLibrary is not iterable`, akordeon açılınca uygulama çöküyor; `name`'siz kayıt `localeCompare` hatası veriyor.
  - **Çözüm:** Kütüphane `validateLibraryItems` ile şemaya göre ayıklanır (dizi değilse boş, adsız/geçersiz kayıtlar atlanır). Proje kaydı da `normalizeProject` ile doğrulanır. *Test: motor K-6, arayüz K-6 (null, nesne, adsız kayıt, bozuk JSON).*
- [x] **K-7 — HTML kaçışı yok** (L1618, L1642, L1796, L1744). `Kolon 1 1/4" hattı` adı `Kolon 1 1/4` olarak kesiliyor; ID'deki `'` inline `onclick`'i bozuyor.
  - **Çözüm:** Tüm kullanıcı metinleri `esc()` ile kaçışlanır; satır içi `onclick` yerine `data-*` öznitelikleri ve olay delegasyonu kullanılır. *Test: arayüz K-7 (`Kolon 1 1/4" hattı <b>x</b> 'y'`, ID'de `'`).*
- [x] **K-8 — Laminer/türbülans geçişinde süreksizlik** (L1092–1104). Re=2299 → f=0.0278, Re=2300 → 0.0481 (+%73). 2300–4000 arası interpolasyon ve uyarı gerekli.
  - **Çözüm:** Re < 2300 laminer (64/Re), 2300–4000 arası 64/2300 ile Colebrook(4000) arasında doğrusal geçiş, Re ≥ 4000 Colebrook-White (yakınsama toleranslı iterasyon). Geçiş/laminer satırlarda hız hücresinde not gösterilir. *Test: motor K-8 (süreklilik ve kalıntı).*
- [x] **K-9 — Kullanıcı girdisi sessizce eziliyor** (L2168–2172, L1226–1229). "Boru Hattı Ekle" her hattı son satırın altına bağlayarak seri zincir kuruyor; 250 kW girilen pompaya alt dal eklenince pompa 20 kW oluyor.
  - **Çözüm:** "+ Boru Hattı" son pompa devresinin (yoksa kollektörün) altına paralel ekler. Bir hatta ilk alt dal eklendiğinde girilmiş yük alt dala devredilir, toplam değişmez ve kullanıcı bilgilendirilir. *Test: arayüz K-9.*
- [x] **K-10 — CSV Türkçe Excel'de bozuk** (L2884–2947). `;` ayraç + `.` ondalık → sayılar tarih olarak okunuyor; `"` kaçışlanmıyor; BOM CSV'si DOM metninden (birimli) üretiliyor.
  - **Çözüm:** CSV'ler `;` ayraç ve virgül ondalık ile yazılır, metinlerde `"` → `""` kaçışı yapılır; metraj CSV'si DOM'dan değil doğrudan hesap verisinden üretilir; indirme URL'si serbest bırakılır. *Test: arayüz K-10.*

## 2. Mühendislik iyileştirmeleri

- [x] **M-1 — Yalnızca hız kriteriyle çap seçimi** (L1146–1169). DN15 @ 1.0 m/s → R ≈ 867 Pa/m; DN50 @ 1.0 m/s → 192 Pa/m. Çift kriter (v_max(DN) ve R_max ≈ 150–250 Pa/m), DN'ye kademeli hız, alt hız uyarısı; otomatik seçim satırın özel ε/et kalınlığını da dikkate almalı.
  - **Çözüm:** Otomatik çap çift kriterle seçilir: V ≤ V_maks(DN) **ve** R ≤ R_maks (varsayılan 200 Pa/m); kollektör hedef hızla. Renk durumu da hız ve R oranının büyüğüne göre verilir; düşük hız bilgi amaçlı gösterilir; satırın özel pürüzlülüğü dikkate alınır. Kriterler kapalı/açık sistem için ayrı ayarlanır. *Test: motor M-1.*
- [x] **M-2 — Gidiş-dönüş belirsizliği.** "Boy L" tek yön mü, gidiş+dönüş mü tanımsız; tek yön girilirse kayıplar %50 eksik. Proje bazında ×2 anahtarı (sürtünme, fittings ve metraj tutarlı).
  - **Çözüm:** Ayarlarda "L = gidiş+dönüş" / "L = tek yön (×2)" seçimi; tek yönde sürtünme, ζ elemanları ve boru/fittings metrajı ×2, Kv vanaları ve sabit cihazlar ×1. Sütun başlığı seçime göre değişir. *Test: motor M-2, motor BOM.*
- [x] **M-3 — Pompa seçimi eksikleri.** Emniyet payı, kaynak tarafı dirençleri (kazan/eşanjör/chiller), vana yetkisi (a ≥ 0.5) ve kritik olmayan dallar için "kısılması gereken ΔP" (balans vanası ön ayarı) sütunu.
  - **Çözüm:** Pompa emniyet payı (varsayılan %10, seçim = hesap × (1+pay)); kütüphaneye kazan, eşanjör, chiller dirençleri eklendi; Kv elemanları "kontrol vanası" işaretlenince yetki a = Δp_vana/(Δp_dal + Δp_balans) hesaplanır ve alt sınırın altında uyarılır; "Balans ΔP" sütunu her dalda kısılması gereken basıncı verir. *Test: motor M-3.*
- [x] **M-4 — Sistem kritik hat KPI'ı pompa sınırlarını aşıyor** (L1321–1341). KOL→P-1→… toplamı tek bir pompanın basması gereken değer değil; iç içe pompalarda dış pompanın yolu hesaplanmıyor (L1356–1371). KPI "en yüksek zon Hm" olmalı, primer devre ayrıca modellenmeli.
  - **Çözüm:** Sistem KPI'ı artık en yüksek **zon** basma yüksekliğidir. Ayrık pompa devreleri (kollektör/denge kabı/by-pass) birbirinden bağımsız; "ayrık değil" işaretlenen pompa seri kabul edilir ve üst zona eklenir; pompasız primer bölüm ayrıca bildirilir. *Test: motor M-4, seri pompa testi.*
- [x] **M-5 — Akışkan ve birim tutarlılığı.** Hm dönüşümü ρ=1000 ile (L1292, L1366): 80°C'de ≈%2.8 düşük. Glikol ve 60°C kullanım suyu seçeneği yok; sıcaklık girdisi + interpolasyon önerilir.
  - **Çözüm:** Basma yükseklikleri H = Δp/(ρ·g) ile işletme yoğunluğunda verilir. Akışkan: su (0–100 °C), etilen/propilen glikol %20/30/40 (kütlece) veya özel; özellikler CoolProp tablolarından sıcaklığa göre interpolasyonla; hazır rejimler (90/70, 80/60 … 7/12, KSS 60 °C) ortalama sıcaklığı kullanır; tablo dışı ve donma yakını uyarı verir. *Test: motor su özellikleri.*
- [x] **M-6 — Boru kütüphanesi.** PN25 satırları PN16 kopyası (L951–966); DN200–300 DIN 2440 kapsamında değil (EN 10220/10217); PEX ve PE100 ayrılmalı; eski çelik için ε = 0.1–0.2 mm seçeneği.
  - **Çözüm:** PN25 satırı "PPRC Kompozit — SDR6 çekirdek kabulü" olarak düzeltildi (iç çap notu ile); DN200–300 etiketleri ve standart notu EN 10217 olarak belirtildi; PE-X (EN ISO 15875) ve PE100 SDR11 (EN 12201) ayrıldı (eski dosyalar otomatik eşlenir); boru penceresine hazır pürüzlülük değerleri (yeni/kullanılmış/korozyonlu çelik, plastik, bakır, pürüzsüz) eklendi. *Test: motor göç testi.*
- [x] **M-7 — Fittings kütüphanesi.** Te ζ referans hızı tanımsız; balans ve üç yollu vana Kv/Kvs ile tanımlanmalı; `mss` tipi listede "Kv=" görünüyor (L1767); ε=0 girilemiyor (L2463–2465).
  - **Çözüm:** Te ζ adlarına referans hız notu eklendi; motorlu iki/üç yollu vana ve fark basınç vanası Kvs ile tanımlandı; listede `mss` tipi doğru gösterilir; ε = 0 kabul edilir.
- [x] **M-8 — Açık sistemde eşzamanlılık yok.** TS EN 806-3 / DIN 1988-300 yük birimi yöntemi; yangın için TS EN 12845 / NFPA mantığı.
  - **Çözüm:** Açık sistemde DIN 1988-300 eşzamanlılığı (konut, huzurevi, hastane, otel, okul/idari): V̇S = a·(ΣV̇R)^b − c, ΣV̇R < 0,2 L/s için ΣV̇R, V̇S ≥ en büyük tekil çekiş. Uç hatlara armatür listesi (V̇R × adet) girilebilir. Yangın/proses için "eşzamanlılık yok" seçeneği ve üst hatta tasarım debisini elle sabitleme. *Test: motor M-8, K-5.*
- [x] **M-9 — BOM gruplaması.** Özel et kalınlığı yok sayılıyor (L2076); kollektör/pompa satırları boru metrajına karışıyor; cihazlar ve fittings aynı listede; redüksiyonlar çıkmıyor; açık modda pompa tablosu kW basıyor.
  - **Çözüm:** Boru metrajı standart + çap + iç çapa göre gruplanır (özel et kalınlığı ayrı satır); kollektörler, fittings/vanalar, cihazlar ve armatürler ayrı tablolarda; branşman te'leri, redüksiyonlar, malzeme geçişleri ve kollektör çıkış ağızları ağaçtan otomatik çıkarılır; açık sistemde pompa tablosu kW göstermez. *Test: motor BOM, arayüz M-9.*

## 3. Arayüz ve performans

- [x] **A-1 — Her değişiklikte tam yeniden çizim.** Ölçüm (1 düzenleme, layout dahil): 50 hat 0.53 s, 100 hat 0.71 s, 200 hat 4.0 s, 400 hat 8.5 s (204 bin DOM düğümü, 170 bin `<option>`). Ebeveyn listesi O(n²). Kısmi güncelleme, paylaşımlı seçici, BOM'u yalnızca sekmesi açıkken çizme.
  - **Çözüm:** Hesap motoru arayüzden ayrıldı; tablo her hat için ayrı `<tbody>` ile çizilir ve yalnızca değişen **hücreler** yerinde güncellenir (tbody değiştirmek tüm tabloyu yeniden yerleştiriyordu); sabit sütun genişlikli tablo düzeni; üst hat seçimi tek ortak `<datalist>` ile (O(n)); ağaçta yalnızca değişen kartlar güncellenir; metraj yalnız sekmesi açıkken çizilir. Ölçüm: 400 hatta bir düzenleme ≈ 0.1 s (önce 8.5 s). *Test: arayüz A-1.*
- [x] **A-2 — Odak kaybı.** Düzenleme sonrası Tab → odak `<body>`'ye gidiyor; klavyeyle seri veri girişi yapılamıyor.
  - **Çözüm:** Render sonrası odak `data-key` ile geri yüklenir; Enter / Shift+Enter aynı sütunda alt/üst satıra geçer; sayısal alanlar virgül veya nokta kabul eder, geçersiz değer reddedilip eski değere dönülür. *Test: arayüz A-2.*
- [x] **A-3 — Sonuç sütunları ekran dışında.** 1600 px'te R, Lokal, Hat ΔP yatay kaydırma gerektiriyor; sabit (sticky) ID ve sonuç sütunu.
  - **Çözüm:** İşlem ve Hat No sütunları solda, Hat ΔP sağda sabit; başlık satırı tablo kaydırılırken sabit; açıklama sütununda hiyerarşi girintisi.
- [x] **A-4 — Ağaç şeması.** Zon-kritik de sistem-kritik gibi kırmızı; `crit-group` kritik olmayan kardeşleri de boyuyor; katlama yok; "PDF Raporuna Ekle" kapalıyken yerleşim değişince ayar kayboluyor (L2809–2825).
  - **Çözüm:** Zon kritik turuncu, sistem kritik kırmızı; bağlantı çizgileri yalnızca kritik çocuğa kadar renklenir; dallar tek tek veya toplu katlanabilir; "PDF raporuna ekle" ayarı projede saklanır ve yerleşim değişikliğinden etkilenmez. *Test: arayüz A-4.*
- [x] **A-5 — KPI.** "Temizle" sonrası hız ikonu kırmızı kalıyor (L1519–1521); `fa-shield-check` FA6 Free'de yok.
  - **Çözüm:** Durum ikonu her durumda (boş proje dahil) yeniden çizilir; Font Awesome'da olmayan ikon kaldırıldı ve derleme, kullanılan her ikonun var olduğunu doğrular. *Test: arayüz A-5, A-9 (eksik ikon kontrolü).*
- [x] **A-6 — Hızlı hesaplayıcı.** Debi 0 → "DN300, V=0.00" öneriliyor (L2737–2741); `qcBadge` hiç güncellenmiyor (L749); lejant renkleri uyumsuz.
  - **Çözüm:** Debi 0 veya geçersizse öneri yapılmaz; hiçbir çap uymazsa "uygun çap yok" rozeti; R_maks girişi ve Re/rejim sütunu eklendi; lejant düzeltildi; ayarlardaki akışkan kullanılır. *Test: arayüz A-6.*
- [x] **A-7 — Onay dosyası standardı.** Fittings dökümü basılmıyor; kabuller bloğu, Hazırlayan/Kontrol/Onay alanı, revizyon no ve sayfa numarası yok; hız rozetleri renksiz basılıyor.
  - **Çözüm:** Rapor: proje/doküman no/revizyon başlığı, kabuller ve yöntem bölümü, pompa zonu özeti, tam hesap tablosu, balans ve vana yetkisi tablosu, hat bazında lokal kayıp dökümü, uyarılar, isteğe bağlı şema, Hazırlayan/Kontrol eden/Onaylayan imza blokları; her sayfada alt bilgi ve "Sayfa X / Y"; renkler basılır. Metraj sekmesinden yazdırınca keşif listesi raporu üretilir.
- [x] **A-8 — Kalıcılık.** Sayfa yenilenince proje kayboluyor; "Temizle"/"Sil" onay sormuyor; JSON proje kaydet/aç, otomatik taslak, özel kütüphane yönetimi gerekli.
  - **Çözüm:** Proje tarayıcıya otomatik kaydedilir ve açılışta geri yüklenir; JSON olarak kaydet/aç (özel kütüphane dahil, Ctrl+S); 100 adımlık geri al/yinele (Ctrl+Z / Ctrl+Y); alt dalı olan hattı silme, temizleme, yeni proje ve dosya açma onay ister; ayarlar sekmesinde özel kütüphane yönetimi. *Test: arayüz A-8.*
- [x] **A-9 — Tailwind Play CDN** (L9, L18). Üretim için değil; internetsiz ortamda sayfa stilsiz açılıyor ve `tailwind is not defined` hatası veriyor. Derlenmiş, gömülü CSS ve sabit sürümler.
  - **Çözüm:** Tailwind CSS derlenip dosyaya gömüldü, Font Awesome yerine yalnızca kullanılan ikonlar SVG olarak gömüldü (`npm run build`); Google Fonts isteğe bağlı (yoksa sistem yazı tipi). GitHub Pages için `manifest.webmanifest`, `sw.js` ve ikonlar eklendi; site bir kez açıldıktan sonra internetsiz çalışır. *Test: arayüz A-9 (çevrimdışı açılış), service worker ile çevrimdışı yeniden yükleme.*

## Bilinen sınırlar ve kabuller

- DIN 1988-300 katsayıları 2012 baskısındaki Tablo 3 değerleridir (ikincil kaynaklardan doğrulandı); 2023 revizyonu "kullanım birimi" yerine "sıhhi mahal" tanımını getirir. Kesin proje için norm metniyle karşılaştırınız.
- Glikol özellikleri **kütlece** yüzdedir (CoolProp INCOMP::MEG/MPG). Hacimce oran veren üretici föyleri için "özel akışkan" kullanınız.
- Te, redüksiyon ve geçiş parçaları ağaç yapısından **tahmin edilir**; metrajda "kontrol ediniz" notuyla ayrı listelenir, hidrolik hesaba otomatik eklenmez.
- Açık sistemde seri (iç içe) pompalar ayrıca modellenmez; her pompa kaynaktan en kritik uca kadar olan güzergahı karşılayacak şekilde boyutlandırılır.
- Kollektör, hidrolik olarak kısa bir boru segmenti olarak modellenir; giriş/çıkış ağzı kayıpları fittings olarak eklenir.

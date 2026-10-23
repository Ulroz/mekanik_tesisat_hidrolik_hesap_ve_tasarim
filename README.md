# Mekanik Tesisat Hidrolik Hesap ve Tasarım Programı

Isıtma/soğutma (kapalı devre) ve sıhhi/yangın (açık uçlu) tesisatları için boru çapı, basınç kaybı, pompa zonu ve kritik devre hesabı yapan; balans, vana yetkisi, keşif-metraj listesi ve yazdırılabilir onay raporu üreten tek dosyalık bir hesap programıdır.

- **Hidrolik hesap:** Darcy-Weisbach; laminer (64/Re), geçiş (2300–4000, doğrusal) ve türbülanslı (Colebrook-White) rejimler. Lokal kayıplar ζ, Kv, sabit kPa veya sabit mSS olarak girilir.
- **Akışkan:** Su (0–100 °C), etilen/propilen glikol %20/30/40 veya özel akışkan; özellikler CoolProp verisinden sıcaklığa göre. Basma yükseklikleri işletme yoğunluğuyla H = Δp/(ρ·g).
- **Proje ağacı:** Kollektör → pompa devresi → boru hattı. Kapalı devrede üst hat debisi alt debilerin toplamıdır (farklı ΔT'li devrelerde kütle dengesi korunur).
- **Pompa zonları ve kritik hat:** Ayrık (kollektör/denge kabı) veya seri pompalar; zon başına kritik güzergah, hesap ve seçim (emniyet paylı) basma yüksekliği.
- **Balans:** Her dalda kısılması gereken ΔP ve kontrol vanası yetkisi.
- **Açık sistem:** DIN 1988-300 eşzamanlılığı, armatür listesi, segment kot farkı, uç akış basıncı, şebeke basıncı ve booster ihtiyacı.
- **Otomatik çap seçimi:** Hız sınırı **ve** birim kayıp (R) sınırı birlikte; kriterler kapalı/açık sistem için ayrı ayarlanır.
- **Keşif & metraj:** Pompa seçim tablosu, boru metrajı, kollektörler, fittings/vanalar, cihazlar, armatürler ve ağaçtan çıkarılan te/redüksiyon/geçiş parçaları.
- **Rapor:** A4 yatay; kabuller, zon özeti, tam hesap tablosu, balans, lokal kayıp dökümü, uyarılar, sistem şeması, imza blokları ve sayfa numarası.
- **Boru kütüphanesi:** Dikişli çelik (EN 10255 / DIN 2440), dikişsiz çelik (Sch 40), PPRC (PN10/16/20, kompozit), PE-X, PE100, bakır (EN 1057).

## Çalıştırma

Program tek bir HTML dosyasıdır (`index.html`) ve internet bağlantısı gerektirmez.

1. Dosya indirilir.
2. Güncel bir tarayıcıda (Chrome, Edge, Firefox, Safari) çift tıklanarak açılır.

Çalışma tarayıcıya otomatik kaydedilir ve dosya tekrar açıldığında geri gelir. Kalıcı kopya ve paylaşım için **Kaydet** ile proje `.json` dosyası alınır, **Aç** ile geri yüklenir.

| Kısayol | İşlev |
|---|---|
| Enter / Shift+Enter | Aynı sütunda alt / üst satıra geç |
| Ctrl+Z / Ctrl+Y | Geri al / yinele |
| Ctrl+S | Projeyi dosyaya kaydet |
| Ctrl+P | Etkin sekmenin raporunu yazdır / PDF |

### Web uygulaması (GitHub Pages)

Deponun *Settings → Pages* sayfasında **Source: Deploy from a branch**, **Branch: main**, klasör **/ (root)** seçilip kaydedildiğinde program birkaç dakika içinde `https://ulroz.github.io/mekanik_tesisat_hidrolik_hesap_ve_tasarim/` adresinde yayına girer. `main` dalına birleştirilen her değişiklik siteye otomatik yansır.

Site telefona veya bilgisayara uygulama olarak yüklenebilir (PWA) ve ilk açılıştan sonra internetsiz çalışır:
- **Android / Chrome, Edge:** Adres çubuğundaki yükle simgesi ya da menüdeki **"Uygulamayı yükle"**.
- **iPhone / Safari:** Paylaş düğmesi → **"Ana Ekrana Ekle"**.

GitHub Pages sitesi, depo gizli olsa bile herkese açıktır; Pages'in gizli depolarda kullanılabilmesi ücretli GitHub planı gerektirir.

## Dosya yapısı

| Dosya | Görevi |
|---|---|
| `index.html` | Programın kendisi: hesap motoru (`<script id="hesap-motoru">`), arayüz, gömülü CSS ve ikonlar |
| `manifest.webmanifest`, `icons/`, `sw.js` | Uygulama olarak yükleme ve çevrimdışı çalışma (PWA) |
| `docs/DENETIM_RAPORU.md` | Kod ve mühendislik denetimi: bulgular, çözümler ve bilinen sınırlar |
| `tools/build.mjs` | `index.html` içindeki gömülü Tailwind CSS'i ve SVG ikonlarını yeniden üretir |
| `tools/test/motor.test.mjs` | Hesap motoru testleri (Node, ek paket gerekmez) |
| `tools/test/arayuz.test.mjs` | Tarayıcı testleri (Playwright + Chromium) |

## Geliştirme

```bash
npm install          # bir kez: Tailwind CSS ve Font Awesome (yalnızca derleme için)
npm run build        # index.html'de sınıf veya ikon değiştirdikten sonra
npm test             # hesap motoru testleri
npm run test:ui      # arayüz testleri (Playwright gerekir: npm i -D playwright && npx playwright install chromium)
```

Program `index.html` üzerinde doğrudan düzenlenir. Tailwind sınıfları ve `ic('ikon-adı')` çağrıları derleme sırasında taranır; dinamik oluşturulan sınıf adları taranamayacağı için sınıflar kodda açıkça yazılmalı, değişkenle seçilen ikonlar ise `/* ikonlar: ad1 ad2 */` yorumuyla belirtilmelidir.

## Lisans

MIT — bkz. `LICENSE`. Gömülü ikonlar: Font Awesome Free (CC BY 4.0).

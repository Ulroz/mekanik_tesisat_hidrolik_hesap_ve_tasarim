# Mekanik Tesisat Hidrolik Hesap ve Tasarım Programı

Isıtma/soğutma (kapalı devre) ve sıhhi/yangın (açık uçlu) tesisatları için boru çapı, basınç kaybı ve kritik devre hesabı yapan, keşif-metraj listesi ve yazdırılabilir rapor üreten tek sayfalık bir hesap programıdır.

- **Hidrolik hesap:** Darcy-Weisbach + Colebrook-White; lokal kayıplar ζ, Kv, sabit kPa veya sabit mSS olarak girilebilir.
- **Proje ağacı:** Kollektör → pompa devresi → boru hattı hiyerarşisi; alt dalların kapasitesi üst hatta otomatik toplanır.
- **Kritik hat:** Her pompa zonu ve tüm sistem için en dirençli güzergah ve gereken basma yüksekliği.
- **Otomatik çap seçimi:** Kollektör ≈0.2 m/s, ≤DN50 1.0 m/s, >DN50 1.5 m/s hız sınırlarına göre.
- **Keşif & metraj (BOM):** Pompa seçim tablosu, boru ve fittings/cihaz metrajı; CSV dışa aktarımı.
- **Boru kütüphanesi:** Dikişli çelik (DIN 2440 / EN 10255), dikişsiz çelik (Sch 40), PPRC (PN10/16/20/25), PEX/PE100, bakır (EN 1057).

## Çalıştırma

Program tek bir HTML dosyasıdır (`index.html`).

1. Dosya indirilir.
2. Güncel bir tarayıcıda (Chrome, Edge, Firefox, Safari) çift tıklanarak açılır.

> Not: Şu anki sürüm görünüm için Tailwind CSS, Font Awesome ve Google Fonts'u internetten (CDN) yükler; internet bağlantısı olmadan sayfa stilsiz açılır. Bu bağımlılığın kaldırılması yapılacaklar listesindedir (bkz. denetim raporu A-9).

### Web uygulaması (GitHub Pages)

Deponun *Settings → Pages* sayfasında **Source: Deploy from a branch**, **Branch: main**, klasör **/ (root)** seçilip kaydedildiğinde program birkaç dakika içinde `https://ulroz.github.io/mekanik_tesisat_hidrolik_hesap_ve_tasarim/` adresinde yayına girer. `main` dalına birleştirilen her değişiklik siteye otomatik yansır.

GitHub Pages sitesi, depo gizli olsa bile herkese açıktır; Pages'in gizli depolarda kullanılabilmesi ücretli GitHub planı gerektirir.

## Dosya yapısı

| Dosya | Görevi |
|---|---|
| `index.html` | Programın kendisi; tek başına çalışır |
| `docs/DENETIM_RAPORU.md` | Kod ve mühendislik denetimi: bulunan hatalar ve iyileştirme listesi |
| `.nojekyll` | GitHub Pages'in dosyaları olduğu gibi yayımlaması için |

## Durum

İlk yüklenen sürüm üzerinde yapılan denetimin bulguları `docs/DENETIM_RAPORU.md` dosyasındadır. Düzeltmeler bu rapordaki numaralarla (K-1, M-1, A-1 …) ayrı değişiklikler halinde yapılacaktır.

## Lisans

MIT — bkz. `LICENSE`.

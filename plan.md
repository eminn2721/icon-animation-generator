# Animated Icons Pipeline — Implementation Plan

## Kararlar
- **Icon Source:** Lucide icon library + AI animation
- **Output:** Lottie JSON
- **Trigger:** REST API + Simple Web UI
- **Stack:** TypeScript + Node.js
- **Ek:** Animasyon türü input olarak verilebilir

## Proje Yapısı

```
icon-animation-generator/
├── src/
│   ├── server.ts              # Express API server
│   ├── pipeline/
│   │   ├── icon-matcher.ts    # Keyword → Lucide icon SVG eşleştirme
│   │   ├── animation-gen.ts   # Claude API → animasyon tanımı üretimi
│   │   └── lottie-builder.ts  # SVG + animasyon tanımı → Lottie JSON
│   ├── types.ts               # Shared types
│   └── config.ts              # Config & environment
├── public/
│   └── index.html             # Minimal Web UI
├── output/                    # Üretilen Lottie dosyaları
├── package.json
├── tsconfig.json
└── .env.example
```

## Pipeline Adımları

### Step 1: Icon Matching (`icon-matcher.ts`)
- Lucide icons npm paketinden SVG datası çekilir
- Keyword → icon eşleştirmesi:
  - Önce exact match (keyword === icon name)
  - Sonra fuzzy match (keyword "search" → "search", "magnifying-glass" vb.)
  - Eşleşme bulunamazsa Claude API ile en uygun icon seçtirilir
- Çıktı: Raw SVG string + icon metadata

### Step 2: Animation Generation (`animation-gen.ts`)
- Input: SVG string + animationType
- Claude API'ye SVG path'leri ve animasyon türü gönderilir
- Claude, SVG element'lerine uygun Lottie animasyon parametreleri üretir
- Desteklenen animasyon türleri:
  - `bounce` — yukarı-aşağı zıplama
  - `spin` — 360° dönme
  - `pulse` — büyüyüp küçülme
  - `shake` — sağa-sola titreşim
  - `fade-in` — opaklık ile belirme
  - `draw` — stroke path çizimi (line-draw effect)
  - `slide-in` — yandan kayarak girme
  - `morph` — path shape geçişi
- Çıktı: Animasyon tanımı (keyframes, easing, duration, vb.)

### Step 3: Lottie Builder (`lottie-builder.ts`)
- SVG parse edilir (svg path'ler, gruplar çıkarılır)
- Animasyon tanımı + SVG verisinden Lottie JSON oluşturulur
- Lottie JSON spec'ine uygun: layers, shapes, keyframes, transforms
- Dosyaya yazılır: `output/{keyword}-{animationType}.json`

## API Endpoints

```
POST /api/generate
Body: { keyword: string, animationType: string, options?: { duration?: number, loop?: boolean, size?: number } }
Response: { success: true, file: string, preview: string (base64), lottie: object }

GET /api/animation-types
Response: { types: string[] }

GET /api/preview/:filename
Response: Lottie JSON dosyası
```

## Web UI (`public/index.html`)
- Tek sayfa, vanilla HTML/CSS/JS
- Keyword text input
- Animation type dropdown
- "Generate" butonu
- Lottie player ile önizleme (lottie-web)
- Download butonu

## Adım Adım Implementation Sırası

1. Proje scaffolding (package.json, tsconfig, dependencies)
2. Types & config
3. Icon matcher (Lucide entegrasyonu)
4. Animation generator (Claude API entegrasyonu)
5. Lottie builder
6. Express API server
7. Web UI
8. Test: uçtan uca keyword → Lottie JSON

# NutriChoice — AI Food Product Comparison

A complete React + Express food shopping assistant with local OCR, manual correction, ingredient explanations, transparent nutrition scoring, traffic lights, side-by-side comparison, and smart alternatives.

## Demo data notice

`backend/data/foodProducts.json` contains 50 clearly labeled demonstration records across 10 food categories. It is not an official manufacturer database and must not be treated as complete or authoritative store information.

## Run

Node.js is required. If Node.js is not installed, approve the VS Code Node.js runtime installation task.

```powershell
npm install
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Health: http://localhost:5000/api/health

## Test

```powershell
npm test
npm run build
```

## Main flow

1. Upload and OCR Product A.
2. Correct name, brand, category, nutrition, ingredients, and allergens manually.
3. Upload and correct Product B.
4. Compare scores and traffic-light results.
5. Read the dynamic four-line explanation.
6. Review top alternatives from the same category in the built-in JSON dataset.

## API

- `GET /api/health`
- `POST /api/ocr` — multipart `label` image
- `POST /api/compare` — JSON `{ productA, productB }`
- `POST /api/alternatives` — JSON `{ productA, productB, category }`
- `GET /api/products/alternatives` — query parameters `productA`, `productB`, and `category`
- `POST /api/products/alternatives` — JSON `{ productA, productB, category }`

Smart alternatives dynamically load `backend/data/foodProducts.json`, which is the provided demonstration dataset. Dataset values are not official manufacturer information.

OCR uses Tesseract locally. Recommendations use transparent rule-based scoring and the local demo dataset.

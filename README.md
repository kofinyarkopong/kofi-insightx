# Football Prediction Dashboard

A full-stack, locally-runnable dashboard that automatically fetches today's Forebet predictions, expands the full catalogue behind the "More" button, scores every fixture against a weighted confidence model, and produces three ranked lists for practical betting decision support.

---

## Quick Start

```bash
# Clone or open the folder, then:
bash start.sh
```

That single script installs all dependencies, installs the Playwright Chromium browser, and starts both servers. The dashboard opens at **http://localhost:5173**.

---

## Manual Start (if you prefer separate terminals)

**Terminal 1 — Backend (port 3001)**
```bash
cd backend
npm install
npx playwright install chromium
cp .env.example .env
npx ts-node-dev --respawn --transpile-only src/server.ts
```

**Terminal 2 — Frontend (port 5173)**
```bash
cd frontend
npm install
npx vite
```

---

## Running Tests

```bash
cd backend
npm test
```

---

## Project Structure

```
football-prediction-dashboard/
├── start.sh                    ← one-command bootstrap
├── backend/
│   ├── src/
│   │   ├── server.ts           ← Express entry point (port 3001)
│   │   ├── routes/forebet.ts   ← API routes
│   │   ├── fetcher/
│   │   │   ├── playwrightFetcher.ts    ← Playwright automation
│   │   │   ├── cheerioParseFallback.ts ← Static HTML fallback
│   │   │   └── cache.ts               ← File-based daily cache
│   │   ├── parser/
│   │   │   └── fixtureParser.ts        ← HTML → Fixture objects
│   │   ├── scoring/
│   │   │   ├── scoringEngine.ts        ← Confidence scoring
│   │   │   └── riskFlags.ts            ← Risk detection
│   │   ├── deepVerify/
│   │   │   └── deepVerifier.ts         ← Per-match deep verification
│   │   └── types/Fixture.ts            ← Core data model
│   ├── tests/
│   │   ├── parser.test.ts
│   │   └── scoring.test.ts
│   └── cache/
│       └── sample-2024-05-24.json      ← Sample data for testing
└── frontend/
    └── src/
        ├── App.tsx
        ├── api/forebetApi.ts
        ├── components/
        │   ├── BestListCard.tsx
        │   ├── ConfidenceBadge.tsx
        │   ├── DateSelector.tsx
        │   ├── ExportBar.tsx
        │   ├── FetchPanel.tsx
        │   ├── FiltersPanel.tsx
        │   ├── FixtureTable.tsx
        │   ├── ManualPasteModal.tsx
        │   └── StatusBadge.tsx
        ├── hooks/
        │   ├── useFilters.ts
        │   └── useForebetData.ts
        ├── types/Fixture.ts
        └── utils/
            ├── export.ts
            └── filters.ts
```

---

## API Endpoints

| Method   | Path                               | Description                              |
|----------|------------------------------------|------------------------------------------|
| `GET`    | `/api/forebet?date=YYYY-MM-DD`     | Fetch and parse fixtures for a date      |
| `GET`    | `/api/forebet?refresh=true`        | Force re-fetch, ignore cache             |
| `POST`   | `/api/forebet/manual`              | Parse manually pasted Forebet text       |
| `POST`   | `/api/forebet/deep-verify`         | Deep-verify up to 10 shortlisted matches |
| `DELETE` | `/api/forebet/cache?date=...`      | Clear cache for a specific date          |
| `GET`    | `/api/forebet/robots`              | Proxy Forebet robots.txt                 |
| `GET`    | `/api/health`                      | Health check                             |

---

## How the Fetch Pipeline Works

1. **Playwright** launches a headless Chromium browser, navigates to the Forebet predictions page, dismisses any cookie banner, and clicks the "More" button up to 20 times (with a 1.5 s polite delay between each click) until no new fixtures appear.
2. The fully rendered HTML is extracted and passed to **Cheerio** for parsing.
3. If Playwright fails, a **static HTTP fetch** is attempted. If that also fails, the UI prompts you to use the **manual paste fallback**.
4. Every parsed fixture is **scored** by the confidence engine (weighted sum of home-win score, goals score, predicted-score score, motivation proxy, away-weakness score, form proxy, minus risk penalties).
5. Results are **cached** to `backend/cache/forebet-YYYY-MM-DD.json` to avoid redundant fetches.

---

## The Three Lists

| List | Criteria |
|------|----------|
| **A — Broad** | Upcoming, homeWinProb ≥ 45%, matching active toggles |
| **B — Strict** | List A + avgGoals ≥ 2.5 + predicted home-win score + no high-risk flags |
| **C — Best**   | Top N from List B ranked by confidenceScore (default N = 8) |

---

## Confidence Score (0–100)

```
confidenceScore =
  homeWinScore     × 0.30   (45% = 50, 70%+ = 100)
+ goalsScore       × 0.20   (2.5 = 60, 4.0+ = 100)
+ predictedScore   × 0.15   (3-1 = 95, 1-0 = 40)
+ motivationScore  × 0.15   (proxy: homeWinProb + goals + prediction)
+ awayWeakness     × 0.10
+ formProxy        × 0.10
− riskPenalty              (derby −20, cup −20, second leg −15, etc.)
```

---

## Risk Flags

| Flag | Penalty |
|------|---------|
| Derby risk | −20 |
| Cup competition | −20 |
| Second leg | −15 |
| Relegation trap risk | −15 |
| Low-block away side | −10 |
| Youth/reserve fixture | −10 |
| Low parse confidence | −10 |
| Missing avg goals | −10 |
| Unclear motivation | −10 |

---

## Deep Verify

After List C is generated, click **"Deep Verify Best List"** to have the backend visit each individual Forebet match page (up to 10), extract trend text (home scoring streak, away conceding streak, recent form, over-2.5 trend, league position), and update the reason summary and confidence score.

This is intentionally separate from the main fetch to keep the primary load fast.

---

## Manual Paste Fallback

If automatic fetching is blocked or fails:

1. Visit [forebet.com](https://www.forebet.com/en/football-tips-and-predictions-for-today) in your browser
2. Expand all fixtures using the "More" button
3. Select all (Ctrl+A / Cmd+A), copy, and paste into the "Manual Paste Fallback" modal
4. Click "Parse Text"

---

## Legal and Ethical Notice

This dashboard is built for personal use and research. It:

- Respects polite request rates (1.5 s between Playwright clicks, 2 s between deep-verify page loads)
- Caches data to minimise repeat requests
- Does **not** bypass logins, CAPTCHAs, paywalls or access controls
- Provides a manual fallback as the primary alternative if automated fetching is blocked
- You are responsible for reviewing Forebet's terms of service and robots.txt before use

---

## Environment Variables (backend/.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `CACHE_DIR` | `./cache` | Where to store daily cache files |
| `PLAYWRIGHT_HEADED` | `false` | Set to `true` to see the browser window |

---

## Requirements

- Node.js v18 or above
- npm v9 or above
- Internet connection (for Forebet fetching)
- Chromium will be downloaded automatically by Playwright (~150 MB)

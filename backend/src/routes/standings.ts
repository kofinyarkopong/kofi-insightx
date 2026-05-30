// ─────────────────────────────────────────────────────────────────────────────
// Standings API routes
//
// Proxies Football-Data.org so the API key never reaches the browser.
// Results are cached for 6 hours in footballDataService.
//
// GET /api/standings?league=Premier+League   — by league name (fuzzy)
// GET /api/standings?code=PL                 — by competition code (exact)
// GET /api/standings/batch?leagues=PL,BL1    — multiple at once
// GET /api/standings/supported               — list of covered competitions
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import {
  fetchStandings,
  fetchMultipleStandings,
  findCompetitionCode,
  SUPPORTED_COMPETITIONS,
} from '../services/footballDataService';

const router = Router();

// ── GET /api/standings?league=... or ?code=... ────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const leagueName  = req.query.league as string | undefined;
  const codeParam   = req.query.code   as string | undefined;

  const code = codeParam ?? (leagueName ? findCompetitionCode(leagueName) : null);

  if (!code) {
    res.status(404).json({
      error:    `No competition found for "${leagueName ?? codeParam}".`,
      hint:     'Use GET /api/standings/supported to see covered competitions.',
      supported: Object.keys(SUPPORTED_COMPETITIONS),
    });
    return;
  }

  if (!process.env.FOOTBALL_DATA_API_KEY) {
    res.status(503).json({
      error: 'FOOTBALL_DATA_API_KEY not configured on this server.',
      hint:  'Add it to backend/.env — get a free key at https://www.football-data.org/client/register',
    });
    return;
  }

  const standings = await fetchStandings(code);

  if (!standings) {
    res.status(502).json({
      error: `Could not fetch standings for ${code}. The competition may not be in your subscription tier.`,
      code,
    });
    return;
  }

  res.json(standings);
});

// ── GET /api/standings/batch?leagues=Premier+League,Bundesliga ────────────────

router.get('/batch', async (req: Request, res: Response): Promise<void> => {
  const leaguesParam = req.query.leagues as string | undefined;

  if (!leaguesParam) {
    res.status(400).json({ error: 'Provide ?leagues= as comma-separated league names or codes.' });
    return;
  }

  if (!process.env.FOOTBALL_DATA_API_KEY) {
    res.status(503).json({
      error: 'FOOTBALL_DATA_API_KEY not configured.',
      hint:  'Get a free key at https://www.football-data.org/client/register',
    });
    return;
  }

  const leagues  = leaguesParam.split(',').map(l => l.trim()).filter(Boolean);
  const resultMap = await fetchMultipleStandings(leagues);

  // Convert Map to plain object for JSON serialisation
  const result: Record<string, unknown> = {};
  resultMap.forEach((v, k) => { result[k] = v; });

  res.json({
    fetched: Object.keys(result).length,
    total:   leagues.length,
    standings: result,
  });
});

// ── GET /api/standings/supported ──────────────────────────────────────────────

router.get('/supported', (_req: Request, res: Response): void => {
  res.json({
    competitions: SUPPORTED_COMPETITIONS,
    note: 'Coverage depends on your Football-Data.org subscription tier. Free tier covers ~12 competitions.',
    keyRequired: !process.env.FOOTBALL_DATA_API_KEY,
    registerUrl: 'https://www.football-data.org/client/register',
  });
});

export default router;

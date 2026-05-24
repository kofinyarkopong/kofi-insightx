// ─────────────────────────────────────────────────────────────────────────────
// Scoring engine: calculates confidenceScore and sub-component scores
// ─────────────────────────────────────────────────────────────────────────────

import type { Fixture } from '../types/Fixture';
import {
  detectDerbyRisk,
  detectCupRisk,
  detectSecondLegRisk,
  detectYouthOrReserve,
  detectWomen,
  detectRelegationTrapRisk,
  calcLowBlockRisk,
  buildRiskFlags,
} from './riskFlags';

// ── Sub-scores ────────────────────────────────────────────────────────────────

export function homeWinScore(prob: number): number {
  if (prob >= 70) return 100;
  if (prob >= 65) return 90;
  if (prob >= 60) return 80;
  if (prob >= 55) return 70;
  if (prob >= 50) return 60;
  if (prob >= 45) return 50;
  return 0;
}

export function goalsScore(avgGoals: number): number {
  if (!avgGoals || isNaN(avgGoals)) return 0;
  if (avgGoals >= 4.0) return 100;
  if (avgGoals >= 3.5) return 90;
  if (avgGoals >= 3.0) return 80;
  if (avgGoals >= 2.8) return 70;
  if (avgGoals >= 2.5) return 60;
  return 30;
}

export function predictedScoreScore(correctScore: string): number {
  const map: Record<string, number> = {
    '4-0': 100, '4-1': 100, '4-2': 100, '5-0': 100, '5-1': 100,
    '3-1': 95,
    '3-0': 90,
    '3-2': 80,
    '2-0': 70,
    '2-1': 75,
    '1-0': 40,
  };
  const val = map[correctScore];
  if (val !== undefined) return val;
  // Draw or away win
  const parts = correctScore.split('-');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const a = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(a)) {
      if (h > a) return 40; // home win, not in map — moderate
      return 0;             // draw or away win
    }
  }
  return 0;
}

export function calcMotivationScore(
  homeWinProb: number,
  avgGoals: number,
  prediction: string,
  correctScore: string
): number {
  // Proxy heuristic — real table data is unavailable from Forebet main table
  let score = 60; // neutral baseline

  if (homeWinProb >= 65) score += 20;
  else if (homeWinProb >= 55) score += 10;
  else if (homeWinProb < 48) score -= 10;

  if (avgGoals >= 3.0) score += 10;
  if (prediction === '1') score += 5;

  const parts = correctScore.split('-');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const a = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(a) && h >= 2) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function calcFormProxyScore(
  homeWinProb: number,
  awayWinProb: number,
  prediction: string,
  correctScore: string
): { score: number; isProxy: boolean } {
  const gap = homeWinProb - awayWinProb;
  let score = 60;

  if (gap >= 40) score = 90;
  else if (gap >= 30) score = 80;
  else if (gap >= 20) score = 70;
  else if (gap >= 10) score = 65;
  else if (gap < 5) score = 50;

  if (prediction === '1') score = Math.min(score + 5, 100);

  return { score, isProxy: true };
}

export function calcAwayWeaknessScore(
  awayWinProb: number,
  avgGoals: number,
  correctScore: string,
  drawProb: number
): number {
  let score = 50;

  if (awayWinProb <= 10) score += 30;
  else if (awayWinProb <= 15) score += 20;
  else if (awayWinProb <= 20) score += 10;

  // Away team predicted to concede 2+
  const parts = correctScore.split('-');
  if (parts.length === 2) {
    const awayGoals = parseInt(parts[1], 10);
    if (!isNaN(awayGoals)) {
      if (awayGoals === 0) score += 15;
      else if (awayGoals === 1) score += 5;
    }
  }

  if (avgGoals >= 3.0) score += 10;
  if (drawProb < 20) score += 10;

  return Math.max(0, Math.min(100, score));
}

// ── Build home/away scoring proxies ─────────────────────────────────────────

export function calcHomeScoringScore(homeWinProb: number, avgGoals: number): number {
  // Proxy: strong home edge + high goals implies home team is scoring regularly
  let score = 60;
  if (homeWinProb >= 65 && avgGoals >= 3.0) score = 90;
  else if (homeWinProb >= 60 && avgGoals >= 2.8) score = 80;
  else if (homeWinProb >= 55) score = 70;
  return score;
}

export function calcAwayConcedingScore(awayWinProb: number, avgGoals: number): number {
  let score = 60;
  if (awayWinProb <= 10 && avgGoals >= 3.0) score = 90;
  else if (awayWinProb <= 15 && avgGoals >= 2.5) score = 80;
  else if (awayWinProb <= 20) score = 70;
  return score;
}

// ── Reason builder ────────────────────────────────────────────────────────────

export function buildReason(fixture: Partial<Fixture> & { flags: string[] }): string {
  const parts: string[] = [];

  if ((fixture.homeWinProb ?? 0) >= 65)
    parts.push(`Strong home edge (${fixture.homeWinProb}% home win probability)`);
  else if ((fixture.homeWinProb ?? 0) >= 55)
    parts.push(`Solid home edge (${fixture.homeWinProb}% home win probability)`);
  else
    parts.push(`Home edge at ${fixture.homeWinProb}%`);

  if ((fixture.avgGoals ?? 0) >= 2.5)
    parts.push(`over-2.5 goals profile (avg ${fixture.avgGoals?.toFixed(2)})`);

  if (fixture.correctScore)
    parts.push(`predicted score ${fixture.correctScore}`);

  if ((fixture.formProxyScore ?? 0) >= 75)
    parts.push('home team favoured in form proxy');

  if ((fixture.awayWeaknessScore ?? 0) >= 70)
    parts.push('away side likely to concede');

  if (fixture.flags && fixture.flags.length === 0)
    parts.push('no major trap flags');
  else if (fixture.flags && fixture.flags.length > 0)
    parts.push(`flags: ${fixture.flags.join(', ')}`);

  if (fixture.formProxyScore !== undefined && fixture.formProxyScore > 0)
    parts.push('(form proxy used — no live table data)');

  return parts.length > 0
    ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ', ' + parts.slice(1).join(', ') + '.'
    : 'Insufficient data to generate reason.';
}

// ── Master scoring function ───────────────────────────────────────────────────

export function scoreFixture(
  raw: Partial<Fixture>,
  penaliseWomens: boolean = false
): Fixture {
  const homeTeam = raw.homeTeam ?? '';
  const awayTeam = raw.awayTeam ?? '';
  const league = raw.league ?? '';
  const competition = raw.competition;
  const homeWinProb = raw.homeWinProb ?? 0;
  const awayWinProb = raw.awayWinProb ?? 0;
  const drawProb = raw.drawProb ?? 0;
  const avgGoals = raw.avgGoals ?? 0;
  const correctScore = raw.correctScore ?? '';
  const prediction = raw.prediction ?? '';
  const parseConfidence = raw.parseConfidence ?? 50;

  // Risk detection
  const isDerbyRisk = detectDerbyRisk(homeTeam, awayTeam);
  const isCup = detectCupRisk(league, competition);
  const isSecondLegRisk = detectSecondLegRisk(league, competition);
  const isYouthOrReserve = detectYouthOrReserve(homeTeam, awayTeam, league);
  const isWomen = detectWomen(homeTeam, awayTeam, league);
  const isRelegationTrapRisk = detectRelegationTrapRisk(homeWinProb, avgGoals, correctScore);
  const lowBlockRisk = calcLowBlockRisk(awayTeam, awayWinProb, drawProb, avgGoals, correctScore);

  // Component scores
  const hwScore = homeWinScore(homeWinProb);
  const gScore = goalsScore(avgGoals);
  const psScore = predictedScoreScore(correctScore);
  const motivationScore = calcMotivationScore(homeWinProb, avgGoals, prediction, correctScore);
  const { score: formScore, isProxy } = calcFormProxyScore(homeWinProb, awayWinProb, prediction, correctScore);
  const awayWeaknessScore = calcAwayWeaknessScore(awayWinProb, avgGoals, correctScore, drawProb);
  const homeScoringScore = calcHomeScoringScore(homeWinProb, avgGoals);
  const awayConcedingScore = calcAwayConcedingScore(awayWinProb, avgGoals);

  const { flags, riskPenalty } = buildRiskFlags(
    isDerbyRisk, isCup, isSecondLegRisk, isRelegationTrapRisk,
    isYouthOrReserve, isWomen, lowBlockRisk, parseConfidence,
    avgGoals, motivationScore, penaliseWomens
  );

  if (isProxy) flags.push('Form proxy used');

  // Weighted confidence score
  const rawScore =
    hwScore * 0.30 +
    gScore * 0.20 +
    psScore * 0.15 +
    motivationScore * 0.15 +
    awayWeaknessScore * 0.10 +
    formScore * 0.10 -
    riskPenalty;

  const confidenceScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const scored: Fixture = {
    id: raw.id ?? '',
    source: 'forebet',
    sourceUrl: raw.sourceUrl ?? '',
    date: raw.date ?? '',
    timeGMT: raw.timeGMT ?? '',
    league,
    competition,
    homeTeam,
    awayTeam,
    homeWinProb,
    drawProb,
    awayWinProb,
    prediction,
    correctScore,
    avgGoals,
    odds: raw.odds,
    status: raw.status ?? 'unknown',
    minute: raw.minute,
    isCup,
    isDerbyRisk,
    isSecondLegRisk,
    isRelegationTrapRisk,
    isYouthOrReserve,
    isWomen,
    lowBlockRisk,
    motivationScore,
    formProxyScore: formScore,
    homeScoringScore,
    awayConcedingScore,
    awayWeaknessScore,
    riskPenalty,
    confidenceScore,
    parseConfidence,
    flags,
    reason: '',
    matchUrl: raw.matchUrl,
    deepVerified: raw.deepVerified ?? false,
  };

  scored.reason = buildReason(scored);
  return scored;
}

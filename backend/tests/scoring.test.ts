// ─────────────────────────────────────────────────────────────────────────────
// Scoring engine tests
// ─────────────────────────────────────────────────────────────────────────────

import {
  homeWinScore,
  goalsScore,
  predictedScoreScore,
  calcMotivationScore,
  calcFormProxyScore,
  calcAwayWeaknessScore,
  scoreFixture,
} from '../src/scoring/scoringEngine';
import {
  detectDerbyRisk,
  detectCupRisk,
  detectYouthOrReserve,
  detectWomen,
  detectRelegationTrapRisk,
  calcLowBlockRisk,
} from '../src/scoring/riskFlags';

// ── homeWinScore ──────────────────────────────────────────────────────────────

describe('homeWinScore', () => {
  test('70%+ returns 100', () => expect(homeWinScore(72)).toBe(100));
  test('65% returns 90',   () => expect(homeWinScore(65)).toBe(90));
  test('60% returns 80',   () => expect(homeWinScore(60)).toBe(80));
  test('55% returns 70',   () => expect(homeWinScore(55)).toBe(70));
  test('50% returns 60',   () => expect(homeWinScore(50)).toBe(60));
  test('45% returns 50',   () => expect(homeWinScore(45)).toBe(50));
  test('40% returns 0',    () => expect(homeWinScore(40)).toBe(0));
});

// ── goalsScore ────────────────────────────────────────────────────────────────

describe('goalsScore', () => {
  test('4.0+ returns 100',  () => expect(goalsScore(4.1)).toBe(100));
  test('3.5 returns 90',    () => expect(goalsScore(3.5)).toBe(90));
  test('3.0 returns 80',    () => expect(goalsScore(3.0)).toBe(80));
  test('2.8 returns 70',    () => expect(goalsScore(2.8)).toBe(70));
  test('2.5 returns 60',    () => expect(goalsScore(2.5)).toBe(60));
  test('0 returns 0',       () => expect(goalsScore(0)).toBe(0));
});

// ── predictedScoreScore ───────────────────────────────────────────────────────

describe('predictedScoreScore', () => {
  test('3-1 returns 95',    () => expect(predictedScoreScore('3-1')).toBe(95));
  test('3-0 returns 90',    () => expect(predictedScoreScore('3-0')).toBe(90));
  test('2-1 returns 75',    () => expect(predictedScoreScore('2-1')).toBe(75));
  test('2-0 returns 70',    () => expect(predictedScoreScore('2-0')).toBe(70));
  test('1-0 returns 40',    () => expect(predictedScoreScore('1-0')).toBe(40));
  test('4-1 returns 100',   () => expect(predictedScoreScore('4-1')).toBe(100));
  test('1-1 (draw) = 0',    () => expect(predictedScoreScore('1-1')).toBe(0));
  test('0-1 (away) = 0',    () => expect(predictedScoreScore('0-1')).toBe(0));
});

// ── Risk flags ────────────────────────────────────────────────────────────────

describe('detectDerbyRisk', () => {
  test('Arsenal vs Tottenham is a derby', () => expect(detectDerbyRisk('Arsenal', 'Tottenham')).toBe(true));
  test('Real Madrid vs Atletico is a derby', () => expect(detectDerbyRisk('Real Madrid', 'Atletico Madrid')).toBe(true));
  test('Benfica vs Porto is a derby', () => expect(detectDerbyRisk('Benfica', 'Porto')).toBe(true));
  test('Random teams are not a derby', () => expect(detectDerbyRisk('Wolves', 'Norwich')).toBe(false));
});

describe('detectCupRisk', () => {
  test('FA Cup is detected', () => expect(detectCupRisk('FA Cup')).toBe(true));
  test('Champions League is detected', () => expect(detectCupRisk('UCL', 'Champions League')).toBe(true));
  test('League match is not flagged', () => expect(detectCupRisk('ENG P')).toBe(false));
  test('Final in competition is flagged', () => expect(detectCupRisk('ENG', 'Final')).toBe(true));
});

describe('detectYouthOrReserve', () => {
  test('U21 team is flagged', () => expect(detectYouthOrReserve('Arsenal U21', 'Chelsea U21', '')).toBe(true));
  test('Reserve team is flagged', () => expect(detectYouthOrReserve('Wolves Reserves', 'Coventry', '')).toBe(true));
  test('Normal teams are not flagged', () => expect(detectYouthOrReserve('Liverpool', 'Everton', 'ENG P')).toBe(false));
});

describe('detectWomen', () => {
  test('Women team is flagged', () => expect(detectWomen('Arsenal Women', 'Chelsea Women', '')).toBe(true));
  test('WFC is flagged', () => expect(detectWomen('West Ham WFC', 'Brighton', '')).toBe(true));
  test('Male teams are not flagged', () => expect(detectWomen('Arsenal', 'Chelsea', 'ENG P')).toBe(false));
});

describe('detectRelegationTrapRisk', () => {
  test('Low prob + low goals + defensive score = trap', () =>
    expect(detectRelegationTrapRisk(47, 2.0, '1-0')).toBe(true));
  test('High prob clears the risk', () =>
    expect(detectRelegationTrapRisk(70, 3.2, '3-1')).toBe(false));
});

describe('calcLowBlockRisk', () => {
  test('0-0 score + low goals = high low-block risk', () => {
    const risk = calcLowBlockRisk('Burnley', 10, 35, 2.1, '0-0');
    expect(risk).toBeGreaterThan(50);
  });
  test('High goals open game = lower risk', () => {
    const risk = calcLowBlockRisk('Brentford', 20, 25, 3.5, '2-1');
    expect(risk).toBeLessThan(60);
  });
});

// ── Full scoreFixture integration test ────────────────────────────────────────

describe('scoreFixture (integration)', () => {
  test('Strong shortlist game: 65% home, 3.5 goals, 3-1 score', () => {
    const scored = scoreFixture({
      id: 'test-1',
      homeTeam: 'Bayern Munich',
      awayTeam: 'Augsburg',
      league: 'GER 1',
      homeWinProb: 65,
      drawProb: 20,
      awayWinProb: 15,
      avgGoals: 3.5,
      correctScore: '3-1',
      prediction: '1',
      status: 'upcoming',
      parseConfidence: 90,
      timeGMT: '15:30',
      date: '2024-05-24',
      flags: [],
      reason: '',
    });
    expect(scored.confidenceScore).toBeGreaterThan(70);
    expect(scored.isDerbyRisk).toBe(false);
    expect(scored.isCup).toBe(false);
    expect(scored.isYouthOrReserve).toBe(false);
  });

  test('Derby match has reduced confidence', () => {
    const scored = scoreFixture({
      id: 'test-derby',
      homeTeam: 'Arsenal',
      awayTeam: 'Tottenham',
      league: 'ENG P',
      homeWinProb: 55,
      drawProb: 26,
      awayWinProb: 19,
      avgGoals: 2.8,
      correctScore: '2-1',
      prediction: '1',
      status: 'upcoming',
      parseConfidence: 90,
      timeGMT: '16:30',
      date: '2024-05-24',
      flags: [],
      reason: '',
    });
    expect(scored.isDerbyRisk).toBe(true);
    expect(scored.flags).toContain('Derby risk');
    expect(scored.riskPenalty).toBeGreaterThanOrEqual(20);
  });

  test('Cup fixture is flagged with penalty', () => {
    const scored = scoreFixture({
      id: 'test-cup',
      homeTeam: 'Chelsea',
      awayTeam: 'Liverpool',
      league: 'FA Cup',
      homeWinProb: 50,
      drawProb: 27,
      awayWinProb: 23,
      avgGoals: 2.6,
      correctScore: '2-1',
      prediction: '1',
      status: 'upcoming',
      parseConfidence: 90,
      timeGMT: '17:00',
      date: '2024-05-24',
      flags: [],
      reason: '',
    });
    expect(scored.isCup).toBe(true);
    expect(scored.flags).toContain('Cup competition');
  });

  test('Live fixture has status live', () => {
    const scored = scoreFixture({
      id: 'test-live',
      homeTeam: 'Milan',
      awayTeam: 'Juventus',
      league: 'ITA 1',
      homeWinProb: 55,
      drawProb: 26,
      awayWinProb: 19,
      avgGoals: 2.8,
      correctScore: '2-1',
      prediction: '1',
      status: 'live',
      minute: "67'",
      parseConfidence: 90,
      timeGMT: '14:00',
      date: '2024-05-24',
      flags: [],
      reason: '',
    });
    expect(scored.status).toBe('live');
  });

  test('Confidence score is clamped between 0 and 100', () => {
    const scored = scoreFixture({
      id: 'test-clamp',
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      league: '',
      homeWinProb: 10,
      drawProb: 45,
      awayWinProb: 45,
      avgGoals: 1.2,
      correctScore: '0-1',
      prediction: '2',
      status: 'upcoming',
      parseConfidence: 30,
      timeGMT: '15:00',
      date: '2024-05-24',
      flags: [],
      reason: '',
    });
    expect(scored.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(scored.confidenceScore).toBeLessThanOrEqual(100);
  });
});

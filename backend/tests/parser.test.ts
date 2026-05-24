// ─────────────────────────────────────────────────────────────────────────────
// Parser tests
// ─────────────────────────────────────────────────────────────────────────────

import { parseManualPaste } from '../src/parser/fixtureParser';

const DATE = '2024-05-24';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLine(line: string) {
  const { fixtures, needsReview } = parseManualPaste(line, DATE);
  return [...fixtures, ...needsReview];
}

// ── Test cases ────────────────────────────────────────────────────────────────

describe('Manual paste parser', () => {

  test('Normal fixture row is parsed correctly', () => {
    const line = '15:00 Arsenal Chelsea 62 23 15 1 2-1 2.95 1.55';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    const fx = results[0];
    expect(fx.timeGMT).toBe('15:00');
    expect(fx.homeWinProb).toBeGreaterThan(0);
    expect(fx.correctScore).toBe('2-1');
    expect(fx.avgGoals).toBeGreaterThan(0);
  });

  test('Fixture with missing odds does not error', () => {
    const line = '17:30 Barcelona Getafe 71 17 12 1 3-0 3.20';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    // No error thrown
    expect(results[0].odds).toBeUndefined();
  });

  test('Fixture with missing average goals is flagged', () => {
    const line = '20:00 Dortmund Augsburg 58 24 18 1 2-0';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].avgGoals).toBe(0);
    // Missing avg goals should lower confidence
    expect(results[0].parseConfidence).toBeLessThan(80);
  });

  test('Youth fixture is flagged as youth/reserve', () => {
    const line = '10:00 Arsenal U21 Chelsea U21 55 28 17 1 2-1 2.50 1.75';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].isYouthOrReserve).toBe(true);
  });

  test('Derby fixture is flagged', () => {
    const line = '12:30 Arsenal Tottenham 48 26 26 1 2-1 2.60 1.90';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].isDerbyRisk).toBe(true);
  });

  test('Women fixture is flagged', () => {
    const line = '14:00 Arsenal Women Chelsea Women 55 24 21 1 2-1 2.80 1.65';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].isWomen).toBe(true);
  });

  test('Strong shortlist game scores well', () => {
    const line = '16:00 Bayern Dortmund 65 20 15 1 3-1 3.50 1.45';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    const fx = results[0];
    expect(fx.homeWinProb).toBeGreaterThanOrEqual(60);
    expect(fx.avgGoals).toBeGreaterThanOrEqual(3.0);
    expect(fx.confidenceScore).toBeGreaterThanOrEqual(60);
  });

  test('Low-block predicted score (1-0) is handled', () => {
    const line = '19:45 Real Madrid Osasuna 52 28 20 1 1-0 1.95 1.80';
    const results = parseLine(line);
    expect(results.length).toBeGreaterThan(0);
    const fx = results[0];
    expect(fx.correctScore).toBe('1-0');
    expect(fx.lowBlockRisk).toBeGreaterThan(0);
  });

  test('Lines without a time pattern are skipped', () => {
    const text = 'Date: 24 May 2024\nPredictions for today';
    const { fixtures, needsReview } = parseManualPaste(text, DATE);
    expect(fixtures.length + needsReview.length).toBe(0);
  });

  test('Multiple fixtures are all parsed', () => {
    const text = [
      '15:00 Arsenal Chelsea 62 23 15 1 2-1 2.95 1.55',
      '17:30 Barcelona Getafe 71 17 12 1 3-0 3.20 1.35',
      '20:00 Dortmund Augsburg 58 24 18 1 2-0 2.80 1.65',
    ].join('\n');
    const { fixtures, needsReview } = parseManualPaste(text, DATE);
    expect(fixtures.length + needsReview.length).toBe(3);
  });

});

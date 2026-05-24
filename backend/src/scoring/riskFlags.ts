// ─────────────────────────────────────────────────────────────────────────────
// Risk flag detection utilities
// ─────────────────────────────────────────────────────────────────────────────

// Known derby rivalry pairs (both orderings checked)
const DERBY_PAIRS: [string, string][] = [
  ['liverpool', 'everton'],
  ['manchester city', 'manchester united'],
  ['man city', 'man united'],
  ['arsenal', 'tottenham'],
  ['arsenal', 'spurs'],
  ['celtic', 'rangers'],
  ['fenerbahce', 'galatasaray'],
  ['al ahly', 'zamalek'],
  ['boca juniors', 'river plate'],
  ['real madrid', 'atletico madrid'],
  ['atletico madrid', 'real madrid'],
  ['barcelona', 'espanyol'],
  ['inter', 'ac milan'],
  ['inter milan', 'ac milan'],
  ['roma', 'lazio'],
  ['benfica', 'sporting'],
  ['sporting', 'benfica'],
  ['porto', 'benfica'],
  ['ajax', 'feyenoord'],
  ['dortmund', 'schalke'],
  ['borussia dortmund', 'schalke'],
  ['chelsea', 'arsenal'],
  ['chelsea', 'tottenham'],
  ['newcastle', 'sunderland'],
  ['millwall', 'west ham'],
  ['porto', 'sporting'],
  ['besiktas', 'galatasaray'],
  ['besiktas', 'fenerbahce'],
];

// Cup / knockout competition keywords in league codes or names
const CUP_KEYWORDS = [
  'cup', 'copa', 'coupe', 'pokal', 'fa cup', 'league cup', 'carabao',
  'champions league', 'europa league', 'conference league',
  'libertadores', 'sudamericana', 'caf', 'afcon', 'world cup', 'euro',
  'final', 'playoff', 'play-off', 'semi-final', 'quarter-final',
  'second leg', '2nd leg', 'ucl', 'uel', 'uecl',
];

// League codes that are typically cup competitions
const CUP_LEAGUE_CODES = ['c', 'c1', 'c2', 'uca', 'uel', 'ucl', 'caf'];

// Youth / reserve / women indicators
const YOUTH_KEYWORDS = ['u19', 'u20', 'u21', 'u23', 'u18', 'u17', 'u16', 'ii', ' b ', '(b)', 'res', 'reserve', 'youth', 'academy', 'colts'];
const WOMEN_KEYWORDS = [' w ', ' w)', '(w)', 'women', 'wfc', 'lfc w', 'ladies', 'femenino', 'feminin', 'feminine', 'dames'];

// Low-block / defensive away team indicators in team names
const KNOWN_DEFENSIVE_STYLES = [
  'atletico madrid', 'burnley', 'stoke', 'sheffield united', 'nottm forest',
  'brentford', 'wolfsburg',
];

export function detectDerbyRisk(homeTeam: string, awayTeam: string): boolean {
  const home = homeTeam.toLowerCase();
  const away = awayTeam.toLowerCase();
  return DERBY_PAIRS.some(
    ([a, b]) => (home.includes(a) && away.includes(b)) || (home.includes(b) && away.includes(a))
  );
}

export function detectCupRisk(league: string, competition?: string): boolean {
  const text = `${league} ${competition ?? ''}`.toLowerCase();
  if (CUP_KEYWORDS.some(k => text.includes(k))) return true;
  const code = league.trim().toLowerCase();
  if (CUP_LEAGUE_CODES.includes(code)) return true;
  return false;
}

export function detectSecondLegRisk(league: string, competition?: string): boolean {
  const text = `${league} ${competition ?? ''}`.toLowerCase();
  return text.includes('second leg') || text.includes('2nd leg') || text.includes('return leg');
}

export function detectYouthOrReserve(homeTeam: string, awayTeam: string, league: string): boolean {
  const text = `${homeTeam} ${awayTeam} ${league}`.toLowerCase();
  return YOUTH_KEYWORDS.some(k => text.includes(k));
}

export function detectWomen(homeTeam: string, awayTeam: string, league: string): boolean {
  const text = `${homeTeam} ${awayTeam} ${league}`.toLowerCase();
  return WOMEN_KEYWORDS.some(k => text.includes(k));
}

export function detectRelegationTrapRisk(
  homeWinProb: number,
  avgGoals: number,
  correctScore: string
): boolean {
  const isLowProb = homeWinProb >= 45 && homeWinProb <= 52;
  const isLowGoals = avgGoals < 2.5;
  const isDefensiveScore = ['1-0', '0-0', '0-1'].includes(correctScore);
  // Two out of three signals triggers relegation trap flag
  const signals = [isLowProb, isLowGoals, isDefensiveScore].filter(Boolean).length;
  return signals >= 2;
}

export function calcLowBlockRisk(
  awayTeam: string,
  awayWinProb: number,
  drawProb: number,
  avgGoals: number,
  correctScore: string
): number {
  let score = 0;

  // Away side predicted to score 0
  const awayGoals = parseAwayGoals(correctScore);
  if (awayGoals === 0) score += 25;

  if (avgGoals < 2.3) score += 25;
  if (['1-0', '0-0'].includes(correctScore)) score += 20;
  if (drawProb > 30) score += 15;
  if (awayWinProb < 15 && drawProb > 25) score += 15;

  // Named defensive teams
  const team = awayTeam.toLowerCase();
  if (KNOWN_DEFENSIVE_STYLES.some(s => team.includes(s))) score += 20;

  return Math.min(score, 100);
}

function parseAwayGoals(correctScore: string): number | null {
  const parts = correctScore.split('-');
  if (parts.length === 2) {
    const val = parseInt(parts[1], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

export function buildRiskFlags(
  isDerby: boolean,
  isCup: boolean,
  isSecondLeg: boolean,
  isRelegationTrap: boolean,
  isYouth: boolean,
  isWomen: boolean,
  lowBlockRisk: number,
  parseConfidence: number,
  avgGoals: number,
  motivationScore: number,
  penaliseWomens: boolean
): { flags: string[]; riskPenalty: number } {
  const flags: string[] = [];
  let penalty = 0;

  if (isDerby) { flags.push('Derby risk'); penalty += 20; }
  if (isCup) { flags.push('Cup competition'); penalty += 20; }
  if (isSecondLeg) { flags.push('Second leg'); penalty += 15; }
  if (isRelegationTrap) { flags.push('Relegation trap risk'); penalty += 15; }
  if (lowBlockRisk >= 60) { flags.push('Low-block away side'); penalty += 10; }
  if (isYouth) { flags.push('Youth/reserve fixture'); penalty += 10; }
  if (isWomen && penaliseWomens) { flags.push('Women\'s fixture (penalised by setting)'); penalty += 10; }
  if (parseConfidence < 70) { flags.push('Low parse confidence'); penalty += 10; }
  if (avgGoals <= 0 || isNaN(avgGoals)) { flags.push('Missing avg goals'); penalty += 10; }
  if (motivationScore < 40) { flags.push('Unclear motivation'); penalty += 10; }

  return { flags, riskPenalty: Math.min(penalty, 60) };
}

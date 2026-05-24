'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — Extract raw fixture data from the fully-loaded Forebet HTML
//
// Selectors confirmed via live browser inspection:
//   Fixture row    : div.rcnt  (leaf-level only)
//   Home team      : span.homeTeam
//   Away team      : span.awayTeam
//   Match link     : a.tnmscn  (href = /en/football/matches/…)
//   Kickoff time   : a.tnmscn time
//   League         : div.shortagDiv
//   Probabilities  : div.fprc span[0,1,2] = home%, draw%, away%
//   Prediction     : div.predict
//   Predicted score: div.ex_sc
//   Avg goals      : div.avg_sc
// ─────────────────────────────────────────────────────────────────────────────

const cheerio = require('cheerio');
const crypto  = require('crypto');

function clean(str) {
  return (str ?? '').replace(/\s+/g, ' ').trim();
}

function toNum(str) {
  const n = parseFloat(clean(str));
  return isNaN(n) ? null : n;
}

function normaliseScore(raw) {
  const m = raw.match(/(\d+)\s*[-:]\s*(\d+)/);
  return m ? `${m[1]}-${m[2]}` : (raw || null);
}

function fixtureId(date, homeTeam, awayTeam) {
  return crypto
    .createHash('sha256')
    .update(`${date}|${homeTeam}|${awayTeam}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Parse all fixture rows from fully-rendered Forebet HTML.
 * @param {string} html   Full page HTML
 * @param {string} date   YYYY-MM-DD
 * @returns {Array<object>}  Raw fixture objects
 */
function extractFixtures(html, date) {
  const $   = cheerio.load(html);
  const fixtures = [];

  $('div.rcnt').each((_i, el) => {
    const $row = $(el);

    // Skip container rows that wrap other rcnt rows
    if ($row.find('div.rcnt').length > 0) return;

    const homeTeam = clean($row.find('span.homeTeam').first().text());
    const awayTeam = clean($row.find('span.awayTeam').first().text());
    if (!homeTeam || !awayTeam) return;

    const $link   = $row.find('a.tnmscn').first();
    const href    = $link.attr('href') ?? '';
    const rawTime = clean($link.find('time').first().text());
    const league  = clean($row.find('div.shortagDiv').first().text());

    const fprcSpans = $row.find('div.fprc span');
    const homeWinProb = toNum($(fprcSpans[0]).text());
    const drawProb    = toNum($(fprcSpans[1]).text());
    const awayWinProb = toNum($(fprcSpans[2]).text());

    const prediction    = clean($row.find('div.predict').first().text());
    const predictedScore = normaliseScore(clean($row.find('div.ex_sc').first().text()));
    const avgGoals      = toNum(clean($row.find('div.avg_sc').first().text()));

    fixtures.push({
      id:           fixtureId(date, homeTeam, awayTeam),
      date,
      kickoffTime:  rawTime || null,
      homeTeam,
      awayTeam,
      league:       league || null,
      href:         href || null,
      homeWinProb,
      drawProb,
      awayWinProb,
      prediction:   prediction || null,
      predictedScore,
      avgGoals,
      odds:         null,
      enriched:     false,
      enrichmentData: null,
      source:       'playwright',
    });
  });

  console.log(`[Extractor] Parsed ${fixtures.length} fixtures from HTML`);
  return fixtures;
}

module.exports = { extractFixtures };

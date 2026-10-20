import { recordMatchToSeasonStats } from './season-stats.js';
import { finalizeMatch, prepareTeamLineup } from './discipline.js';
import { t } from './i18n.js';

export function generateFixtures(teams) {
  const n = teams.length;
  const ids = teams.map(t => t.id);
  const rounds = [];

  if (n % 2 !== 0) ids.push(null);

  const total = ids.length;
  const half = total / 2;

  for (let round = 0; round < total - 1; round++) {
    const matches = [];
    for (let i = 0; i < half; i++) {
      const home = ids[i];
      const away = ids[total - 1 - i];
      if (home && away) matches.push({ home, away, played: false, homeGoals: null, awayGoals: null });
    }
    rounds.push(matches);
    const fixed = ids[0];
    const rotated = [fixed, ids[total - 1], ...ids.slice(1, total - 1)];
    ids.splice(0, ids.length, ...rotated);
  }

  const secondHalf = rounds.map(round =>
    round.map(m => ({
      home: m.away, away: m.home, played: false, homeGoals: null, awayGoals: null
    }))
  );

  return [...rounds, ...secondHalf];
}

export function getStandings(teams) {
  return [...teams]
    .sort((a, b) => {
      if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
      const sgA = a.stats.gf - a.stats.ga;
      const sgB = b.stats.gf - b.stats.ga;
      if (sgB !== sgA) return sgB - sgA;
      return b.stats.gf - a.stats.gf;
    });
}

export function applyResult(teams, homeId, awayId, homeGoals, awayGoals) {
  const home = teams.find(t => t.id === homeId);
  const away = teams.find(t => t.id === awayId);
  if (!home || !away) return;

  home.stats.played++;
  away.stats.played++;
  home.stats.gf += homeGoals;
  home.stats.ga += awayGoals;
  away.stats.gf += awayGoals;
  away.stats.ga += homeGoals;

  if (homeGoals > awayGoals) {
    home.stats.won++; home.stats.points += 3;
    away.stats.lost++;
  } else if (homeGoals < awayGoals) {
    away.stats.won++; away.stats.points += 3;
    home.stats.lost++;
  } else {
    home.stats.drawn++; away.stats.drawn++;
    home.stats.points++; away.stats.points++;
  }
}

export function getPlayerNextMatch(fixtures, currentRound, playerTeamId) {
  if (currentRound >= fixtures.length) return null;
  const round = fixtures[currentRound];
  return round.find(m => m.home === playerTeamId || m.away === playerTeamId) || null;
}

export function isSeasonOver(currentRound, fixtures) {
  return currentRound >= fixtures.length;
}

export function simulateAiMatches(fixtures, currentRound, teams, simulateMatch, options = {}) {
  const {
    skipTeamId = null,
    division = null,
    seasonStats = null,
    recordMatch = null,
    onMatchPlayed = null
  } = options || {};

  if (currentRound >= fixtures.length) return [];
  const round = fixtures[currentRound];
  const results = [];

  for (const match of round) {
    if (match.played) continue;
    if (skipTeamId && (match.home === skipTeamId || match.away === skipTeamId)) continue;

    const home = teams.find(t => t.id === match.home);
    const away = teams.find(t => t.id === match.away);
    if (!home || !away) continue;
    const hLineup = prepareTeamLineup(home, home.formation || '433');
    const aLineup = prepareTeamLineup(away, away.formation || '433');
    const result = simulateMatch(home, away, hLineup, aLineup);
    finalizeMatch(home, away, result, { seasonStats, division });
    match.played = true;
    match.homeGoals = result.homeGoals;
    match.awayGoals = result.awayGoals;
    applyResult(teams, match.home, match.away, result.homeGoals, result.awayGoals);
    if (recordMatch) {
      recordMatch(division, home, away, result);
    } else if (seasonStats && division) {
      recordMatchToSeasonStats(seasonStats, division, home, away, result);
    }
    if (onMatchPlayed) onMatchPlayed(home, away, result);
    results.push({ ...match, events: result.events, homeName: home.name, awayName: away.name });
  }
  return results;
}

export const PROMOTION_SPOTS = 4;
export const RELEGATION_SPOTS = 4;

function formatClubList(teams) {
  const names = teams.map(t => t.name);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

function swapDivisionTeams(fromLeague, toLeague, fromTeam, toTeam, fromDiv, toDiv) {
  const fromIdx = fromLeague.teams.findIndex(t => t.id === fromTeam.id);
  const toIdx = toLeague.teams.findIndex(t => t.id === toTeam.id);
  if (fromIdx === -1 || toIdx === -1) return false;

  fromLeague.teams[fromIdx] = { ...toTeam, division: fromDiv };
  toLeague.teams[toIdx] = { ...fromTeam, division: toDiv };
  return true;
}

export function processPromotionRelegation(serieA, serieB, serieC, playerTeamId) {
  const standingsA = getStandings(serieA.teams);
  const standingsB = getStandings(serieB.teams);
  const standingsC = getStandings(serieC.teams);

  const promotedToA = standingsB.slice(0, PROMOTION_SPOTS);
  const relegatedToB = standingsA.slice(-RELEGATION_SPOTS);
  const promotedToB = standingsC.slice(0, PROMOTION_SPOTS);
  const relegatedToC = standingsB.slice(-RELEGATION_SPOTS);

  const messages = [];
  let playerPromotedA = false;
  let playerRelegatedA = false;
  let playerPromotedB = false;
  let playerRelegatedC = false;

  for (let i = 0; i < PROMOTION_SPOTS; i++) {
    const promTeam = promotedToA[i];
    const relTeam = relegatedToB[i];
    if (!swapDivisionTeams(serieB, serieA, promTeam, relTeam, 2, 1)) continue;

    if (promTeam.id === playerTeamId) playerPromotedA = true;
    if (relTeam.id === playerTeamId) playerRelegatedA = true;
  }

  for (let i = 0; i < PROMOTION_SPOTS; i++) {
    const promTeam = promotedToB[i];
    const relTeam = relegatedToC[i];
    if (!swapDivisionTeams(serieC, serieB, promTeam, relTeam, 3, 2)) continue;

    if (promTeam.id === playerTeamId) playerPromotedB = true;
    if (relTeam.id === playerTeamId) playerRelegatedC = true;
  }

  if (playerPromotedA) messages.push(t('promoPlayerUp'));
  if (playerRelegatedA) messages.push(t('promoPlayerDown'));
  if (playerPromotedB) messages.push(t('promoPlayerUpB'));
  if (playerRelegatedC) messages.push(t('promoPlayerDownC'));

  if (!playerPromotedA && !playerRelegatedA) {
    messages.push(t('promoOthersAB', {
      promoted: formatClubList(promotedToA),
      relegated: formatClubList(relegatedToB)
    }));
  }
  if (!playerPromotedB && !playerRelegatedC) {
    messages.push(t('promoOthersBC', {
      promoted: formatClubList(promotedToB),
      relegated: formatClubList(relegatedToC)
    }));
  }

  const playerDivision = serieA.teams.some(t => t.id === playerTeamId) ? 1
    : serieB.teams.some(t => t.id === playerTeamId) ? 2
    : 3;
  return { playerDivision, messages };
}

function resetStats() {
  return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
}

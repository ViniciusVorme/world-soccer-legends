import { getStandings } from './league.js';
import { getAggregate, resolveKnockoutTie } from './tiebreak.js';
import { finalizeMatch, prepareTeamLineup } from './discipline.js';

export const COPA_FIRST_TURN_ROUNDS = 19;
export const BYE_COUNT = 4;

export const COPA_PHASES = [
  { key: 'phase1', legs: 1, ties: 28 },
  { key: 'round32', legs: 2, ties: 16 },
  { key: 'round16', legs: 2, ties: 8 },
  { key: 'quarter', legs: 2, ties: 4 },
  { key: 'semi', legs: 2, ties: 2 },
  { key: 'final', legs: 1, ties: 1 }
];

export function createEmptyHistory() {
  return { copaChampion: null, serieATop3: [] };
}

export function createIdleCopa() {
  return {
    season: 1,
    phase: 'idle',
    eventIndex: 0,
    byeTeams: [],
    ties: [],
    bracket: {},
    championId: null,
    championName: null,
    currentLeg: 1,
    playerEliminated: false,
    playerBestReach: null,
    copaPrizePaid: false
  };
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildCopaParticipants(serieA, serieB, serieC) {
  return [...serieA.teams, ...serieB.teams, ...serieC.teams];
}

export function findTeamById(participants, teamId) {
  return participants.find(t => t.id === teamId) || null;
}

/**
 * Seleciona 4 times com bye na 1ª fase.
 * Ordem: campeão copa, 1º/2º/3º Série A anterior; deduplica e usa 4º da A se necessário.
 */
export function selectByeTeams(history, serieATeams, season) {
  const standings = getStandings(serieATeams);
  const byeIds = [];
  const used = new Set();

  const addBye = (team) => {
    if (!team || used.has(team.id) || byeIds.length >= BYE_COUNT) return;
    byeIds.push(team.id);
    used.add(team.id);
  };

  if (history?.copaChampion?.teamId) {
    const champ = findTeamById(standings, history.copaChampion.teamId)
      || serieATeams.find(t => t.name === history.copaChampion.name);
    addBye(champ);
  }

  const topFromHistory = history?.serieATop3?.length
    ? history.serieATop3
    : null;

  if (topFromHistory) {
    for (const entry of topFromHistory.slice(0, 3)) {
      const team = findTeamById(standings, entry.teamId)
        || serieATeams.find(t => t.name === entry.name);
      addBye(team);
    }
  }

  for (const team of standings) {
    if (byeIds.length >= BYE_COUNT) break;
    addBye(team);
  }

  if (season === 1 && byeIds.length < BYE_COUNT) {
    const byStrength = [...serieATeams].sort((a, b) => (b.strength || 0) - (a.strength || 0));
    for (const team of byStrength) {
      addBye(team);
      if (byeIds.length >= BYE_COUNT) break;
    }
  }

  return byeIds.slice(0, BYE_COUNT);
}

function pickHomeTeam(teamA, teamB, seed) {
  const s = (seed * 7919 + teamA.id.charCodeAt(0)) % 2;
  return s === 0 ? teamA.id : teamB.id;
}

function makeLeg() {
  return { homeGoals: null, awayGoals: null, played: false };
}

export function createTie(id, homeId, awayId, legs = 1) {
  const legArr = Array.from({ length: legs }, () => makeLeg());
  return {
    id,
    home: homeId,
    away: awayId,
    legs: legArr,
    winnerId: null,
    decidedBy: null,
    penalties: null
  };
}

/**
 * Sorteio restrito da 1ª fase: 20 C vs A/B + 8 internos entre restantes A/B.
 */
export function drawPhase1(participants, byeIds, season) {
  const byeSet = new Set(byeIds);
  const serieA = participants.filter(t => t.division === 1 && !byeSet.has(t.id));
  const serieB = participants.filter(t => t.division === 2);
  const serieC = participants.filter(t => t.division === 3);

  const potAB = seededShuffle([...serieA, ...serieB], season * 17 + 3);
  const potC = seededShuffle([...serieC], season * 17 + 7);
  const ties = [];
  let tieNum = 0;

  const usedAB = new Set();
  for (let ci = 0; ci < potC.length; ci++) {
    const cTeam = potC[ci];
    const available = potAB.filter(t => !usedAB.has(t.id));
    if (!available.length) break;
    const pickSeed = (season * 97 + ci * 13) % available.length;
    const opponent = available[pickSeed];
    usedAB.add(opponent.id);
    const homeId = pickHomeTeam(cTeam, opponent, season + tieNum);
    const awayId = homeId === cTeam.id ? opponent.id : cTeam.id;
    ties.push(createTie(`p1-${tieNum++}`, homeId, awayId, 1));
  }

  const remaining = potAB.filter(t => !usedAB.has(t.id));
  const shuffledRemaining = seededShuffle(remaining, season * 31);
  for (let i = 0; i < shuffledRemaining.length; i += 2) {
    if (i + 1 >= shuffledRemaining.length) break;
    const a = shuffledRemaining[i];
    const b = shuffledRemaining[i + 1];
    const homeId = pickHomeTeam(a, b, season + tieNum);
    const awayId = homeId === a.id ? b.id : a.id;
    ties.push(createTie(`p1-${tieNum++}`, homeId, awayId, 1));
  }

  return ties;
}

export function getPhaseConfig(phaseKey) {
  return COPA_PHASES.find(p => p.key === phaseKey) || null;
}

export function getCopaEventCount() {
  return COPA_PHASES.reduce((sum, p) => sum + p.legs, 0);
}

export function getCopaEventLabel(eventIndex) {
  let idx = eventIndex;
  for (const phase of COPA_PHASES) {
    for (let leg = 1; leg <= phase.legs; leg++) {
      if (idx === 0) return { phase: phase.key, leg, legs: phase.legs };
      idx--;
    }
  }
  return null;
}

export function advanceBracket(winners, phaseKey, season, startIndex = 0) {
  const config = getPhaseConfig(phaseKey);
  if (!config) return [];
  const shuffled = seededShuffle(winners, season * 53 + startIndex);
  const ties = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 >= shuffled.length) break;
    const a = shuffled[i];
    const b = shuffled[i + 1];
    const homeId = pickHomeTeam(
      { id: a },
      { id: b },
      season + startIndex + i
    );
    const awayId = homeId === a ? b : a;
    ties.push(createTie(`${phaseKey}-${i / 2}`, homeId, awayId, config.legs));
  }
  return ties;
}

export function initCopaBrasil(serieA, serieB, serieC, history, season) {
  const participants = buildCopaParticipants(serieA, serieB, serieC);
  const byeTeams = selectByeTeams(history, serieA.teams, season);
  const ties = drawPhase1(participants, byeTeams, season);

  return {
    season,
    phase: 'phase1',
    eventIndex: 0,
    byeTeams,
    ties,
    bracket: { phase1: ties.map(t => ({ ...t, legs: t.legs.map(l => ({ ...l })) })) },
    championId: null,
    championName: null,
    currentLeg: 1,
    playerEliminated: false,
    playerBestReach: null,
    copaPrizePaid: false
  };
}

export function getPlayerCopaTie(copa, playerTeamId) {
  if (!copa || copa.phase === 'idle' || copa.phase === 'finished') return null;
  if (copa.byeTeams.includes(playerTeamId) && copa.phase === 'phase1') return null;
  if (copa.playerEliminated) return null;
  const legIdx = (copa.currentLeg || 1) - 1;
  return copa.ties.find(t =>
    !t.winnerId
    && (t.home === playerTeamId || t.away === playerTeamId)
    && t.legs[legIdx]
    && !t.legs[legIdx].played
  ) || null;
}

export function isPlayerOnCopaBye(copa, playerTeamId) {
  return copa?.phase === 'phase1' && copa.byeTeams?.includes(playerTeamId);
}

export function getLegHomeAway(tie, legIdx, participants) {
  const leg = tie.legs[legIdx];
  if (!leg) return null;
  const homeTeam = findTeamById(participants, tie.home);
  const awayTeam = findTeamById(participants, tie.away);
  if (!homeTeam || !awayTeam) return null;

  if (legIdx === 0) {
    return { home: homeTeam, away: awayTeam, leg };
  }
  return { home: awayTeam, away: homeTeam, leg };
}

export function applyLegResult(tie, legIdx, homeGoals, awayGoals) {
  const leg = tie.legs[legIdx];
  if (!leg) return;
  leg.homeGoals = homeGoals;
  leg.awayGoals = awayGoals;
  leg.played = true;
}

export function tryResolveTie(tie, participants, singleLeg = false) {
  if (singleLeg) {
    if (!tie.legs[0]?.played) return false;
  } else {
    if (!tie.legs[0]?.played || !tie.legs[1]?.played) return false;
  }

  const homeTeam = findTeamById(participants, tie.home);
  const awayTeam = findTeamById(participants, tie.away);
  if (!homeTeam || !awayTeam) return false;

  const resolution = resolveKnockoutTie(tie, homeTeam, awayTeam, singleLeg);
  tie.winnerId = resolution.winnerId;
  tie.decidedBy = resolution.decidedBy;
  tie.penalties = resolution.penalties;
  return true;
}

export function simulateCopaAiTies(copa, participants, simulateMatch, options = {}) {
  const { skipTeamId = null, legIdx = 0, singleLeg = false, finalizeOptions = null } = options;
  const results = [];

  for (const tie of copa.ties) {
    if (tie.winnerId) continue;
    if (skipTeamId && (tie.home === skipTeamId || tie.away === skipTeamId)) continue;

    const matchup = getLegHomeAway(tie, legIdx, participants);
    if (!matchup || matchup.leg.played) continue;

    const hLineup = prepareTeamLineup(matchup.home, matchup.home.formation || '433');
    const aLineup = prepareTeamLineup(matchup.away, matchup.away.formation || '433');
    const result = simulateMatch(matchup.home, matchup.away, hLineup, aLineup);
    if (finalizeOptions) {
      finalizeMatch(matchup.home, matchup.away, result, finalizeOptions);
    }
    applyLegResult(tie, legIdx, result.homeGoals, result.awayGoals);

    if (singleLeg && tie.legs[0]?.played) {
      tryResolveTie(tie, participants, true);
    } else if (!singleLeg && tie.legs[0]?.played && tie.legs[1]?.played) {
      tryResolveTie(tie, participants, false);
    }

    results.push({
      tie,
      homeName: matchup.home.name,
      awayName: matchup.away.name,
      ...result
    });
  }
  return results;
}

export function allCurrentLegsPlayed(copa, legIdx) {
  const active = copa.ties.filter(t => !t.winnerId);
  if (!active.length) return true;
  return active.every(t => t.legs[legIdx]?.played);
}

export function getWinnersFromTies(ties) {
  return ties.filter(t => t.winnerId).map(t => t.winnerId);
}

function snapshotTies(ties) {
  return ties.map(t => ({
    ...t,
    legs: t.legs.map(l => ({ ...l }))
  }));
}

export function advanceCopaPhase(copa, participants, season) {
  if (copa.phase && copa.phase !== 'finished' && copa.ties.length) {
    copa.bracket[copa.phase] = snapshotTies(copa.ties);
  }

  const winners = getWinnersFromTies(copa.ties);
  const phaseOrder = ['phase1', 'round32', 'round16', 'quarter', 'semi', 'final'];
  const idx = phaseOrder.indexOf(copa.phase);

  if (copa.phase === 'phase1') {
    const allWinners = [...winners, ...copa.byeTeams];
    const nextTies = advanceBracket(allWinners, 'round32', season, 0);
    copa.bracket.round32 = nextTies.map(t => ({ ...t, legs: t.legs.map(l => ({ ...l })) }));
    copa.ties = nextTies;
    copa.phase = 'round32';
    copa.currentLeg = 1;
    return;
  }

  if (copa.phase === 'final') {
    const champ = findTeamById(participants, winners[0]);
    copa.championId = winners[0] || null;
    copa.championName = champ?.name || null;
    copa.phase = 'finished';
    copa.ties = [];
    return;
  }

  const nextPhase = phaseOrder[idx + 1];
  if (!nextPhase) return;

  const nextTies = advanceBracket(winners, nextPhase, season, idx);
  copa.bracket[nextPhase] = nextTies.map(t => ({ ...t, legs: t.legs.map(l => ({ ...l })) }));
  copa.ties = nextTies;
  copa.phase = nextPhase;
  copa.currentLeg = 1;
}

/** Top 3 da Série A — deve ser calculado antes de promoção/rebaixamento. */
export function buildSerieATop3(serieATeams) {
  return getStandings(serieATeams).slice(0, 3).map((t, i) => ({
    pos: i + 1,
    teamId: t.id,
    name: t.name
  }));
}

export function updateHistoryAfterSeason(history, serieATop3, copa) {
  history.serieATop3 = serieATop3;

  if (copa?.championId) {
    history.copaChampion = {
      teamId: copa.championId,
      name: copa.championName,
      season: copa.season
    };
  }
}

/** Dados estruturados para exibir um confronto na UI. */
export function getTieDisplay(tie, participants) {
  const homeTeam = findTeamById(participants, tie.home);
  const awayTeam = findTeamById(participants, tie.away);
  if (!homeTeam || !awayTeam) return null;

  const leg1 = tie.legs[0];
  const leg2 = tie.legs[1];
  const twoLegs = tie.legs.length === 2;
  const display = {
    homeId: tie.home,
    awayId: tie.away,
    homeName: homeTeam.name,
    awayName: awayTeam.name,
    homeIsPlayer: !!homeTeam.isPlayer,
    awayIsPlayer: !!awayTeam.isPlayer,
    leg1: null,
    leg2: null,
    aggregate: null,
    penalties: tie.penalties,
    decidedBy: tie.decidedBy,
    winnerId: tie.winnerId,
    isTwoLeg: twoLegs,
    pending: !tie.legs.some(l => l?.played)
  };

  if (leg1?.played) {
    display.leg1 = { home: leg1.homeGoals, away: leg1.awayGoals };
  }
  if (leg2?.played) {
    // Volta: gols salvos do mandante da perna; exibir sempre na ordem tie.home × tie.away
    display.leg2 = { home: leg2.awayGoals, away: leg2.homeGoals };
  }
  if (display.leg1 || display.leg2) {
    display.aggregate = getAggregate(tie);
  }

  return display;
}

export function formatTieScore(tie, participants) {
  const d = getTieDisplay(tie, participants);
  if (!d) return '';
  if (d.pending) return '—';
  if (!d.isTwoLeg && d.leg1) {
    let s = `${d.leg1.home}×${d.leg1.away}`;
    if (d.decidedBy === 'penalties' && d.penalties) {
      s += ` (${d.penalties.home}-${d.penalties.away} pen)`;
    }
    return s;
  }
  if (d.aggregate) {
    let s = `${d.aggregate.home}×${d.aggregate.away}`;
    if (d.decidedBy === 'penalties' && d.penalties) {
      s += ` (${d.penalties.home}-${d.penalties.away} pen)`;
    }
    return s;
  }
  return '—';
}

export function getPhaseLabelKey(phase) {
  const map = {
    idle: 'copaIdle',
    phase1: 'copaPhase1',
    round32: 'copaRound32',
    round16: 'copaRound16',
    quarter: 'copaQuarter',
    semi: 'copaSemi',
    final: 'copaFinal',
    finished: 'copaFinished'
  };
  return map[phase] || 'copaIdle';
}

export function getPhaseShortLabelKey(phase) {
  const map = {
    phase1: 'copaPhase1Short',
    round32: 'copaRound32Short',
    round16: 'copaRound16Short',
    quarter: 'copaQuarterShort',
    semi: 'copaSemiShort',
    final: 'copaFinalShort'
  };
  return map[phase] || getPhaseLabelKey(phase);
}

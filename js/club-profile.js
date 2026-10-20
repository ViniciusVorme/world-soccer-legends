const PHASE_ORDER = ['phase1', 'round32', 'round16', 'quarter', 'semi', 'final'];

export const POPULARITY_MIN = 0;
export const POPULARITY_MAX = 100;
export const SEASON_POP_GAIN_CAP = 20;

const LEAGUE_POP_DELTA = [
  { maxPos: 1, delta: 4 },
  { maxPos: 4, delta: 4 },
  { maxPos: 8, delta: 3 },
  { maxPos: 14, delta: 0 },
  { maxPos: 17, delta: -2 },
  { maxPos: 20, delta: -5 }
];

const COPA_POP_DELTA = {
  champion: 9,
  final: 7,
  semi: 5,
  quarter: 3,
  round16: 2,
  round32: 1,
  phase1: 1,
  none: 0
};

const COPA_PHASE_MILESTONE_POP = {
  round16: 1,
  quarter: 1,
  semi: 2,
  final: 2
};

export function createSeasonMomentum() {
  return {
    winStreak: 0,
    streakBonuses: 0,
    hatTrickBonus: false,
    goalBurstBonus: false,
    homeThrashingBonus: false,
    top3WinBonuses: 0,
    t1: { firstWin: false, tenGames: false, copaStarted: false },
    playerGoalMatches: {}
  };
}

export function createClubProfile(division = 2) {
  return {
    popularity: initialPopularity(division),
    scoutLevel: 1,
    trophies: [],
    seasonHistory: [],
    seasonPopGained: 0,
    seasonMomentum: createSeasonMomentum(),
    saveMilestones: {
      copaDebut: false,
      copaPhases: {},
      copaChampion: false
    }
  };
}

export function initialPopularity(division) {
  if (division === 1) return 38;
  if (division === 2) return 24;
  return 18;
}

export function clampPopularity(value) {
  return Math.max(POPULARITY_MIN, Math.min(POPULARITY_MAX, Math.round(value)));
}

export function getPopularityTier(popularity) {
  if (popularity >= 80) return 'icon';
  if (popularity >= 60) return 'big';
  if (popularity >= 40) return 'national';
  if (popularity >= 20) return 'regional';
  return 'unknown';
}

export function ensureClubProfileFields(profile) {
  if (!profile.seasonMomentum) profile.seasonMomentum = createSeasonMomentum();
  if (profile.seasonPopGained == null) profile.seasonPopGained = 0;
  if (profile.scoutLevel == null) profile.scoutLevel = 1;
  if (!profile.saveMilestones) {
    profile.saveMilestones = { copaDebut: false, copaPhases: {}, copaChampion: false };
  }
  if (!profile.saveMilestones.copaPhases) profile.saveMilestones.copaPhases = {};
  return profile;
}

/** Aplica mudança de popularidade respeitando teto de +20 por temporada (só ganhos). */
export function addPopularity(profile, delta) {
  if (!delta) return 0;
  ensureClubProfileFields(profile);

  let applied = delta;
  if (delta > 0) {
    const room = SEASON_POP_GAIN_CAP - profile.seasonPopGained;
    applied = Math.min(delta, Math.max(0, room));
    if (applied <= 0) return 0;
    profile.seasonPopGained += applied;
  }

  profile.popularity = clampPopularity(profile.popularity + applied);
  return applied;
}

export function resetSeasonPopTracking(profile) {
  ensureClubProfileFields(profile);
  profile.seasonStartPop = profile.popularity;
  profile.seasonPopGained = 0;
  profile.seasonMomentum = createSeasonMomentum();
}

function leaguePopularityDelta(position) {
  for (const band of LEAGUE_POP_DELTA) {
    if (position <= band.maxPos) return band.delta;
  }
  return 0;
}

function promotionPopularityDelta(promoted, relegated) {
  if (promoted) return 6;
  if (relegated) return -3;
  return 0;
}

export function getPlayerCopaReach(copa, playerTeamId) {
  if (!copa || copa.phase === 'idle') return 'none';
  if (copa.championId === playerTeamId) return 'champion';

  let deepestIdx = copa.byeTeams?.includes(playerTeamId) ? 0 : -1;

  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const key = PHASE_ORDER[i];
    const ties = (key === copa.phase && copa.ties?.length)
      ? copa.ties
      : (copa.bracket?.[key] || []);

    for (const tie of ties) {
      if (tie.home !== playerTeamId && tie.away !== playerTeamId) continue;
      deepestIdx = Math.max(deepestIdx, i);
      if (tie.winnerId === playerTeamId && i + 1 < PHASE_ORDER.length) {
        deepestIdx = Math.max(deepestIdx, i + 1);
      }
    }
  }

  if (deepestIdx < 0) return 'none';
  return PHASE_ORDER[deepestIdx];
}

function copaPopularityDelta(reach) {
  return COPA_POP_DELTA[reach] ?? 0;
}

function trophyTypeForDivision(division) {
  if (division === 1) return 'serieA';
  if (division === 2) return 'serieB';
  return 'serieC';
}

function addTrophy(profile, type, season) {
  profile.trophies.unshift({ type, season });
}

function playerTeamSide(result, playerTeamId, homeId, awayId) {
  if (homeId === playerTeamId) return 'home';
  if (awayId === playerTeamId) return 'away';
  return null;
}

function goalsByPlayer(events, teamSide) {
  const counts = {};
  for (const e of events || []) {
    if (e.type !== 'goal' || e.team !== teamSide) continue;
    const key = e.playerId || e.player;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function updateGoalBurst(profile, goalCounts) {
  const m = profile.seasonMomentum;
  if (m.goalBurstBonus) return 0;

  for (const [playerKey, goals] of Object.entries(goalCounts)) {
    if (!goals) continue;
    if (!m.playerGoalMatches[playerKey]) m.playerGoalMatches[playerKey] = [];
    const arr = m.playerGoalMatches[playerKey];
    arr.push(goals);
    if (arr.length > 3) arr.shift();
    const total = arr.reduce((s, n) => s + n, 0);
    if (arr.length >= 3 && total >= 5) {
      m.goalBurstBonus = true;
      return addPopularity(profile, 1);
    }
  }
  return 0;
}

function checkHatTrick(profile, goalCounts) {
  const m = profile.seasonMomentum;
  if (m.hatTrickBonus) return 0;
  const hasHat = Object.values(goalCounts).some(n => n >= 3);
  if (!hasHat) return 0;
  m.hatTrickBonus = true;
  return addPopularity(profile, 1);
}

function checkWinStreak(profile, isLeague, isWin) {
  const m = profile.seasonMomentum;
  if (!isLeague) return 0;

  if (!isWin) {
    m.winStreak = 0;
    return 0;
  }

  m.winStreak += 1;
  if (m.winStreak < 3 || m.streakBonuses >= 3) return 0;

  m.winStreak = 0;
  m.streakBonuses += 1;
  return addPopularity(profile, 1);
}

function checkHomeThrashing(profile, isLeague, isHome, isWin, playerGoals) {
  const m = profile.seasonMomentum;
  if (!isLeague || m.homeThrashingBonus || !isHome || !isWin || playerGoals < 4) return 0;
  m.homeThrashingBonus = true;
  return addPopularity(profile, 1);
}

function checkTop3Win(profile, isLeague, isWin, opponentId, standingsBefore, playerTeamId) {
  const m = profile.seasonMomentum;
  if (!isLeague || !isWin || m.top3WinBonuses >= 2 || !standingsBefore?.length) return 0;

  const top3 = standingsBefore
    .filter(t => t.id !== playerTeamId)
    .slice(0, 3)
    .map(t => t.id);
  if (!top3.includes(opponentId)) return 0;

  m.top3WinBonuses += 1;
  return addPopularity(profile, 1);
}

function checkT1Milestones(profile, season, isLeague, isWin, gamesPlayed) {
  if (season !== 1) return 0;
  const t1 = profile.seasonMomentum.t1;
  let gained = 0;

  if (isLeague && isWin && !t1.firstWin) {
    t1.firstWin = true;
    gained += addPopularity(profile, 1);
  }
  if (isLeague && gamesPlayed >= 10 && !t1.tenGames) {
    t1.tenGames = true;
    gained += addPopularity(profile, 1);
  }
  return gained;
}

export function onCopaSeasonStarted(profile, season) {
  ensureClubProfileFields(profile);
  let gained = 0;

  if (!profile.saveMilestones.copaDebut) {
    profile.saveMilestones.copaDebut = true;
    gained += addPopularity(profile, 1);
  }
  if (season === 1 && !profile.seasonMomentum.t1.copaStarted) {
    profile.seasonMomentum.t1.copaStarted = true;
    gained += addPopularity(profile, 1);
  }
  return gained;
}

export function onPlayerCopaPhaseReached(profile, phaseKey) {
  ensureClubProfileFields(profile);
  const pop = COPA_PHASE_MILESTONE_POP[phaseKey];
  if (!pop) return 0;
  if (profile.saveMilestones.copaPhases[phaseKey]) return 0;

  profile.saveMilestones.copaPhases[phaseKey] = true;
  return addPopularity(profile, pop);
}

export function onPlayerCopaChampion(profile) {
  ensureClubProfileFields(profile);
  if (profile.saveMilestones.copaChampion) return 0;
  profile.saveMilestones.copaChampion = true;
  return addPopularity(profile, 3);
}

/**
 * Processa gatilhos de popularidade após partida do jogador.
 * @returns {number} Total aplicado nesta partida
 */
export function processMatchPopularity(profile, {
  season,
  isLeague,
  isWin,
  isDraw,
  isHome,
  playerGoals,
  opponentId,
  result,
  homeId,
  awayId,
  playerTeamId,
  standingsBefore,
  gamesPlayed
}) {
  ensureClubProfileFields(profile);
  let total = 0;

  const side = playerTeamSide(result, playerTeamId, homeId, awayId);
  const goalCounts = side ? goalsByPlayer(result.events, side) : {};

  total += checkWinStreak(profile, isLeague, isWin);
  total += checkHatTrick(profile, goalCounts);
  total += updateGoalBurst(profile, goalCounts);
  total += checkHomeThrashing(profile, isLeague, isHome, isWin, playerGoals);
  total += checkTop3Win(profile, isLeague, isWin, opponentId, standingsBefore, playerTeamId);
  total += checkT1Milestones(profile, season, isLeague, isWin, gamesPlayed);

  return total;
}

export function recordSeasonEnd(profile, data) {
  const {
    season,
    divisionBefore,
    divisionAfter,
    position,
    points,
    isChampion,
    copa,
    playerTeamId
  } = data;

  ensureClubProfileFields(profile);

  const promoted = divisionAfter < divisionBefore;
  const relegated = divisionAfter > divisionBefore;
  const copaReach = getPlayerCopaReach(copa, playerTeamId);
  const copaWon = copaReach === 'champion';

  const popBefore = profile.popularity;
  const seasonStart = profile.seasonStartPop ?? popBefore;
  let popDelta = leaguePopularityDelta(position);
  popDelta += promotionPopularityDelta(promoted, relegated);
  popDelta += copaPopularityDelta(copaReach);

  if (popDelta > 0) {
    popDelta = addPopularity(profile, popDelta);
  } else if (popDelta < 0) {
    profile.popularity = clampPopularity(profile.popularity + popDelta);
  }

  if (isChampion) {
    addTrophy(profile, trophyTypeForDivision(divisionBefore), season);
  }
  if (copaWon) {
    addTrophy(profile, 'copa', season);
  }

  profile.seasonHistory.unshift({
    season,
    division: divisionBefore,
    position,
    points,
    isChampion,
    promoted,
    relegated,
    copaReach,
    copaChampion: copa?.championName || null,
    popDelta: profile.popularity - seasonStart
  });

  if (profile.seasonHistory.length > 8) {
    profile.seasonHistory.length = 8;
  }

  return {
    popDelta: profile.popularity - popBefore,
    seasonPopDelta: profile.popularity - seasonStart,
    copaReach,
    promoted,
    relegated
  };
}

export function formatPopDelta(delta) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return '±0';
}
